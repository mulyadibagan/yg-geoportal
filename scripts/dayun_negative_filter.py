"""Physical-scale second-stage filter for existing Dayun radial proposals.

Training labels and model artifacts are private. Scores are discriminants, never
species probabilities. Unavailable context stays unfiltered, not silently zero.
"""
import hashlib
import json
import cv2
import numpy as np

SCHEMA = 'dayun-negative-comparison-v1'
TARGET_GSD = .01869802574849237
HALF = 28  # 1.066 m square; smaller than the existing positive split buffer.
RADII = (5, 7, 9, 12, 16)


class NativePatches:
    """Read original block cores, joining neighbours across artificial seams."""
    def __init__(self, directory, gsd_m):
        from pathlib import Path
        from collections import OrderedDict
        import re
        self.root=Path(directory);self.gsd=gsd_m;self.cache=OrderedDict();self.tiles=[]
        for t in json.loads((self.root/'analysis.json').read_text(encoding='utf-8'))['native_tiles']:
            x,y=map(int,re.search(r'x(\d+)_y(\d+)',t['file']).groups())
            self.tiles.append((x,y,t['file']))

    def read(self, tile):
        import rasterio
        if tile not in self.cache:
            with rasterio.open(self.root/tile) as ds:data=ds.read()
            self.cache[tile]=(np.ascontiguousarray(np.moveaxis(data[:3],0,-1)),data[3]>0)
            if len(self.cache)>6:self.cache.popitem(last=False)
        self.cache.move_to_end(tile)
        return self.cache[tile]

    def patch(self, x, y, context_scale=1.):
        if context_scale not in (1.,2.,3.):raise ValueError('unsupported_crown_scale')
        gsd=np.asarray(self.gsd)/context_scale
        pad=int(np.ceil(HALF*TARGET_GSD/min(gsd)))+5
        nearby=[t for t in self.tiles if t[0]<=x+pad and t[0]+2048>x-pad and t[1]<=y+pad and t[1]+2048>y-pad]
        for sx,sy,file in nearby:
            if sx+pad<=x<sx+2048-pad and sy+pad<=y<sy+2048-pad:
                rgb,valid=self.read(file);return metric_patch(rgb,valid,x-sx,y-sy,gsd)
        left,top=int(np.floor(x))-pad,int(np.floor(y))-pad;size=pad*2+2
        rgb=np.zeros((size,size,3),'uint8');valid=np.zeros((size,size),bool)
        for sx,sy,file in nearby:
            source,mask=self.read(file);h,w=mask.shape
            l,t,r,b=max(left,sx),max(top,sy),min(left+size,sx+w),min(top+size,sy+h)
            if r<=l or b<=t:continue
            rgb[t-top:b-top,l-left:r-left]=source[t-sy:b-sy,l-sx:r-sx]
            valid[t-top:b-top,l-left:r-left]=mask[t-sy:b-sy,l-sx:r-sx]
        return metric_patch(rgb,valid,x-left,y-top,gsd)


def metric_patch(rgb, valid, x, y, gsd_m):
    scale = np.asarray(gsd_m, float)
    if scale.shape != (2,) or not np.isfinite(scale).all() or min(scale) <= 0 or max(scale)/min(scale) > 1.05:
        raise ValueError('invalid_metric_gsd')
    offset = np.arange(-HALF, HALF+1, dtype='float32') * TARGET_GSD
    mx, my = np.meshgrid((x + offset/scale[0]).astype('float32'), (y + offset/scale[1]).astype('float32'))
    if mx.min() < 0 or my.min() < 0 or mx.max() >= rgb.shape[1]-1 or my.max() >= rgb.shape[0]-1:
        return None
    left,top=max(0,int(mx.min())-4),max(0,int(my.min())-4)
    right,bottom=min(rgb.shape[1],int(np.ceil(mx.max()))+5),min(rgb.shape[0],int(np.ceil(my.max()))+5)
    mask=cv2.remap(valid[top:bottom,left:right].astype('uint8'),mx-left,my-top,cv2.INTER_NEAREST)
    if not mask.all():
        return None
    local=np.ascontiguousarray(rgb[top:bottom,left:right])
    ratio=TARGET_GSD/float(scale.mean())
    if ratio>1.05:
        local=cv2.GaussianBlur(local,(0,0),.5*np.sqrt(ratio*ratio-1))
    return cv2.remap(local, mx-left, my-top, cv2.INTER_LINEAR)


def descriptor(patch):
    if patch is None:
        return None
    if patch.shape != (2*HALF+1, 2*HALF+1, 3) or patch.dtype != np.uint8:
        raise ValueError('invalid_normalized_patch')
    rgb=patch.astype('float32')/255
    gray=cv2.GaussianBlur(cv2.cvtColor(patch,cv2.COLOR_RGB2GRAY).astype('float32'),(0,0),1)
    gx=cv2.Sobel(gray,cv2.CV_32F,1,0);gy=cv2.Sobel(gray,cv2.CV_32F,0,1);energy=gx*gx+gy*gy
    magnitude=np.sqrt(energy);weight=np.minimum(magnitude/(np.percentile(magnitude,80)+1e-6),1)
    yy,xx=np.mgrid[-HALF:HALF+1,-HALF:HALF+1];radius=np.hypot(xx,yy);theta=np.arctan2(yy,xx)
    aligned=((gy*gy-gx*gx)*np.cos(2*theta)-2*gx*gy*np.sin(2*theta))/(energy+1e-6)
    sector=np.floor((theta+np.pi)*12/(2*np.pi)).astype(int)%12
    green=(2*rgb[:,:,1]-rgb[:,:,0]-rgb[:,:,2])/(rgb.sum(axis=2)+.05)
    saturation=(rgb.max(axis=2)-rgb.min(axis=2))/(rgb.max(axis=2)+.05)
    context=(radius>=20)&(radius<=27);features=[]
    for r in RADII:
        ring=(radius>=r*.25)&(radius<=r)
        values=np.array([np.sum(aligned[ring&(sector==s)]*weight[ring&(sector==s)])/(np.sum(weight[ring&(sector==s)])+1e-6) for s in range(12)])
        # Orientation support plus local colour/texture contrast. No absolute
        # brightness or source identity feature can learn the flight directly.
        features.extend([values.mean(),np.quantile(values,.25),np.mean(values>.15),
                         green[ring].mean()-green[context].mean(),
                         saturation[ring].mean()-saturation[context].mean(),
                         gray[ring].std()/(gray.std()+1e-6),
                         magnitude[ring].mean()/(magnitude.mean()+1e-6)])
    return np.asarray(features,dtype='float64')


def fit(positive, negative, provenance):
    p,n=np.asarray(positive,float),np.asarray(negative,float)
    if p.ndim!=2 or n.ndim!=2 or p.shape[1]!=n.shape[1] or len(p)<10 or len(n)<100 or not np.isfinite(p).all() or not np.isfinite(n).all():
        raise ValueError('insufficient_training_features')
    joined=np.vstack([p,n]);mean=joined.mean(axis=0);std=np.maximum(joined.std(axis=0),.02)
    p=(p-mean)/std;n=(n-mean)/std
    cov=(np.cov(p,rowvar=False)+np.cov(n,rowvar=False))/2
    weights=np.linalg.solve(.9*np.eye(p.shape[1])+.1*cov,p.mean(axis=0)-n.mean(axis=0))
    bias=-float(np.dot((p.mean(axis=0)+n.mean(axis=0))/2,weights))
    scores=p@weights+bias
    model=dict(schema=SCHEMA,feature_version='metric-relative-shape-colour-v1',target_gsd_m=TARGET_GSD,
               patch_half=HALF,radii=list(RADII),mean=mean.tolist(),std=std.tolist(),weights=weights.tolist(),bias=bias,
               threshold=float(np.quantile(scores,.05)),threshold_rule='frozen_training_positive_lower_five_percent',
               shrinkage=.9,provenance=provenance,production_species_validated=False,validated_pineapple_total=None,census_changed=False)
    model['signature']=hashlib.sha256(json.dumps(model,sort_keys=True).encode()).hexdigest()
    return model


def score(features, model):
    if model.get('schema')!=SCHEMA or model.get('feature_version')!='metric-relative-shape-colour-v1' or model.get('target_gsd_m')!=TARGET_GSD or model.get('patch_half')!=HALF:
        raise ValueError('incompatible_negative_filter')
    f=np.asarray(features,float);mean=np.asarray(model['mean']);std=np.asarray(model['std']);w=np.asarray(model['weights'])
    if f.shape[-1:]!=mean.shape or mean.shape!=std.shape or mean.shape!=w.shape or not np.isfinite(f).all() or not np.isfinite([mean,std,w]).all() or np.any(std<=0):
        raise ValueError('invalid_filter_features')
    return ((f-mean)/std)@w+model['bias']
