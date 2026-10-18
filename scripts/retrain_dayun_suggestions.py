"""Retrain existing Dayun shape engines; propose additions, never change a census.

Private snapshot/native inputs and versioned private outputs only. The existing
radial proposer finds centres, and the existing metric descriptor discriminant
scores them. Training spatial cells and their buffer never enter holdout fitting.
Unlabelled and unspecified rejections are not species-negative training labels.
"""
import argparse
import copy
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

import cv2
import numpy as np
import rasterio
from affine import Affine
from PIL import Image, ImageDraw
from rasterio.features import geometry_mask
from rasterio.windows import Window
from shapely.geometry import Point, shape, mapping
from shapely.ops import unary_union

from dayun_checkpoint_reader import CheckpointReader
from dayun_negative_filter import NativePatches, descriptor, fit, score
from propose_dayun_candidates import radial_scores, radial_propose


def load(p):return json.loads(Path(p).read_text(encoding='utf-8'))
def write(p,v):Path(p).write_text(json.dumps(v,ensure_ascii=False),encoding='utf-8')
def digest(v):return hashlib.sha256(json.dumps(v,sort_keys=True).encode()).hexdigest()


def spatial_split(pixels,gsd,cell_m=5.,buffer_m=4.):
    cells=[tuple(np.floor(np.asarray(p)*gsd/cell_m).astype(int)) for p in pixels]
    held=[i for i,c in enumerate(cells) if int(digest(list(map(int,c)))[:8],16)%4==0]
    if len(held)<10:raise ValueError('insufficient_spatial_holdout')
    train=[];guard=[];used=Counter()
    for i,p in enumerate(pixels):
        if i in held:continue
        distance=min(np.linalg.norm((np.asarray(p)-pixels[j])*gsd) for j in held)
        if distance<buffer_m or used[cells[i]]>=8:guard.append(i)
        else:train.append(i);used[cells[i]]+=1
    if len(train)<20:raise ValueError('insufficient_spatial_training')
    return {'train':train,'heldout':held,'guard_unused':guard}


def fresh_controls(block,root,native,metadata,previous,count):
    cached=root/('controls-'+block+'.json')
    if cached.exists():return load(cached)
    original=load(native/block/'count/candidates.geojson')['features']
    candidates={f['properties']['id']:f for f in original}
    prior=[candidates[k]['properties']['source_pixel'] for k in previous if k in candidates]
    gsd=np.asarray(metadata['gsd_m']);prior=np.array(prior,float)
    reader=NativePatches(native/block/'assets',metadata['gsd_m']);rows=[];used=set();selected=[]
    for f in sorted(original,key=lambda f:digest(f['properties']['id'])):
        p=f['properties'];xy=np.array(p['source_pixel']);cell=tuple(np.floor(xy*gsd/2).astype(int))
        if cell in used or (len(prior) and np.min(np.linalg.norm((prior-xy)*gsd,axis=1))<3.5):continue
        used.add(cell);selected.append(f)
        if len(selected)>=count+100:break
    # Keep original TIFF reads spatially ordered, rather than reopening random
    # 2048px cores for every hard-negative patch.
    for f in sorted(selected,key=lambda f:f['properties']['native_tile']):
        p=f['properties'];xy=np.array(p['source_pixel']);ds=[descriptor(reader.patch(*xy,scale)) for scale in (1.,2.)]
        if any(d is None for d in ds):continue
        rows.append({'id':p['id'],'block':block,'xy':xy.tolist(),'descriptors':[d.tolist() for d in ds]})
        if len(rows)>=count:break
    if len(rows)<100:raise ValueError('insufficient_fresh_negative_controls_'+block)
    write(root/('controls-'+block+'.json'),rows)
    return rows


def train(root,native,cache,control_history):
    root=Path(root);native=Path(native);manifest=load(root/'manifest.json');meta=load(native/'Agro_ABC-source-metadata.json');gsd=np.array(meta['gsd_m']);inv=~Affine(*meta['transform'][:6])
    if not control_history:raise ValueError('explicit_previous_control_history_required')
    history={str(Path(p)):hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in control_history};history_path=root/'control-history-provenance.json'
    if history_path.exists() and load(history_path)!=history:raise ValueError('negative_control_history_changed')
    if not history_path.exists() and (root/'controls-D.json').exists():raise ValueError('legacy_control_cache_requires_new_private_run_directory')
    write(history_path,history)
    labels=[];snapshots={};excluded=Counter()
    for b in 'ABC':
        h=load(root/b/'head.json');snapshots[b]={'revision':h['revision'],'version':h.get('version'),'sha256':hashlib.sha256((root/b/'head.json').read_bytes()).hexdigest()}
        if h.get('review') and (h['review']['source_run']!=manifest['run'] or h['review']['block']!=b):raise ValueError('training_source_mismatch')
        for f in (h.get('review') or {}).get('changes',[]):
            if f['properties']['status']=='accepted':labels.append(copy.deepcopy(f))
            elif f['properties']['status']=='rejected':excluded[f['properties'].get('rejection_reason','unspecified')]+=1
    pixels=[np.asarray(inv*tuple(f['geometry']['coordinates'])) for f in labels]
    split=spatial_split(pixels,gsd);reader=CheckpointReader('Agro_ABC',cache,load(Path(cache)/'checkpoint.json'))
    if reader.index['identity'].get('md5Checksum')!='ed607f7c49d72c1d044e4cc36a07492b':raise ValueError('source_identity_mismatch')
    grid=[5,7,9,11,14,18,22,28,36];patches=[];profiles=[];descriptors=[];metric=NativePatches(native/'A/assets',meta['gsd_m']);cv2.setNumThreads(2)
    cache_path=root/'training-native-descriptors.json';cached=load(cache_path) if cache_path.exists() else None
    if cached:
        if cached['label_digest']!=digest(labels):raise ValueError('training_native_cache_mismatch')
        profiles=cached['profiles'];descriptors=cached['descriptors'];patches=[np.array(p,dtype='uint8') for p in cached['patches']]
    with rasterio.Env(GDAL_CACHEMAX=128*1024*1024),rasterio.open('source.tif',opener=reader.opener) as source:
        for i,(f,(x,y)) in enumerate(zip(labels,pixels)):
            if i<len(profiles):continue
            win=Window(int(x)-128,int(y)-128,258,258);rgb=np.moveaxis(source.read([1,2,3],window=win),0,-1);valid=source.dataset_mask(window=win)>0
            if rgb.shape!=(258,258,3) or not valid.all():raise ValueError('training_point_without_full_native_context')
            small=cv2.resize(rgb,(129,129),interpolation=cv2.INTER_AREA);mask=np.ones((129,129),bool);patches.append(small)
            profiles.append([float(radial_scores(small,mask,(r,))[58:71,58:71].max()) for r in grid])
            ds=[descriptor(metric.patch(x-.5,y-.5,scale)) for scale in (1.,2.)]
            if any(d is None for d in ds):raise ValueError('training_point_metric_context_missing')
            descriptors.append([d.tolist() for d in ds])
            if (i+1)%100==0:print(json.dumps({'training_native_points':i+1,'total':len(labels)}),flush=True)
    if not cached:write(cache_path,{'label_digest':digest(labels),'profiles':profiles,'descriptors':descriptors,'patches':[p.tolist() for p in patches]})
    profile=np.asarray(profiles);best=Counter(np.argmax(profile[split['train']],axis=1).tolist());indices=[i for i,_ in best.most_common(5)];radii=sorted(grid[i] for i in indices)
    peaks=profile[split['train']][:,indices].max(axis=1);radial_threshold=float(np.clip(np.quantile(peaks,.25),.25,.60))
    previous=[]
    for path in control_history:
        rows=load(path)
        if not isinstance(rows,list):raise ValueError('invalid_previous_control_history')
        previous.extend(rows)
    controls={}
    for b,count in [('D',800),('E',250),('F',250)]:
        controls[b]=fresh_controls(b,root,native,load(native/'Agro_DEF-source-metadata.json'),{r['id'] for r in previous if r.get('block')==b},count)
        print(json.dumps({'fresh_control_block':b,'samples':len(controls[b])}),flush=True)
    positive=np.array([d for i in split['train'] for d in descriptors[i]]);negative=np.array([d for r in controls['D'] for d in r['descriptors']])
    provenance={'source_run':manifest['run'],'snapshots':snapshots,'positive_labels':len(labels),'positive_training_labels':len(split['train']),'positive_holdout_labels':len(split['heldout']),'spatial_cell_m':5,'minimum_train_holdout_distance_m':4,'negative_training_block':'D','negative_validation_block':'E','negative_holdout_block':'F','threshold_uses_holdout':False,'census_used_for_fit':False,'unclassified_rejections_excluded':dict(excluded),'negative_basis':'owner reports D-F never planted with pineapple','control_history_sha256':history}
    model=fit(positive,negative,provenance)
    # Conservative, training-only operating point. Both scale views of the same
    # plant stay in the same split. No E/F result selects weights or threshold.
    training_positive=np.array([max(score(np.array(descriptors[i]),model)) for i in split['train']]);training_negative=np.array([max(score(np.array(r['descriptors']),model)) for r in controls['D']])
    model['threshold']=float(max(np.quantile(training_positive,.25),np.quantile(training_negative,.99)))
    model['threshold_rule']='max_training_positive_quartile_and_training_D_negative_99_percentile';model['inference_context_scales']=[1.,2.]
    model.update(radial_radii_half_native_pixels=radii,radial_threshold=radial_threshold,detector_downsample=2,suppression_half_native_pixels=12,matching_tolerance_native_pixels=12,duplicate_exclusion_m=.22)
    evaluation={}
    for name,ids in split.items():
        hits=passed=0
        for i in ids:
            small=patches[i];proposals=radial_propose(small,np.ones(small.shape[:2],bool),threshold=radial_threshold,distance=12,radii=radii,limit=10000)
            hits+=any((x-64)**2+(y-64)**2<=6**2 for _,x,y in proposals)
            passed+=max(score(np.array(descriptors[i]),model))>=model['threshold']
        evaluation['positive_'+name]={'labels':len(ids),'radial_centres_found_within_12_native_px':hits,'known_coordinate_descriptor_pass':int(passed),'precision':None,'exhaustive_recall':None}
    for b,rows in controls.items():
        passing=sum(max(score(np.array(r['descriptors']),model))>=model['threshold'] for r in rows)
        evaluation['negative_'+b]={'labels':len(rows),'retained':int(passing),'retained_fraction':passing/len(rows),'fresh_distance_from_prior_controls_m':3.5}
    model['evaluation']=evaluation;model['signature']=digest({k:v for k,v in model.items() if k!='signature'})
    write(root/'model.json',model);write(root/'training-labels.json',{'labels':labels,'pixels':[p.tolist() for p in pixels],'split':split,'descriptors':descriptors,'profiles':profiles})
    chosen=split['heldout'][:24];sheet=Image.new('RGB',(6*258,4*286),'white');pen=ImageDraw.Draw(sheet)
    for j,i in enumerate(chosen):
        image=Image.fromarray(patches[i]).resize((258,258));d=ImageDraw.Draw(image);d.ellipse((121,121,137,137),outline='#00b7ff',width=2);sheet.paste(image,((j%6)*258,(j//6)*286));pen.text(((j%6)*258+4,(j//6)*286+260),','.join(labels[i]['properties']['zones']),fill='black')
    sheet.save(root/'heldout-original-pixels.png');print(json.dumps({'labels':len(labels),'split':{k:len(v) for k,v in split.items()},'radii_half_native':radii,'radial_threshold':radial_threshold,'evaluation':evaluation}),flush=True)
    return model


def exclude_near(features,coordinates,gsd,transform,distance_m):
    inverse=~transform;size=distance_m/min(gsd);cells={}
    for c in coordinates:
        x,y=inverse*tuple(c);cell=(int(x//size),int(y//size));cells.setdefault(cell,[]).append((x,y))
    kept=[]
    for f in features:
        x,y=inverse*tuple(f['geometry']['coordinates']);cell=(int(x//size),int(y//size))
        near=[p for dx in (-1,0,1) for dy in (-1,0,1) for p in cells.get((cell[0]+dx,cell[1]+dy),[])]
        if any(np.linalg.norm((np.array([x,y])-p)*gsd)<distance_m for p in near):continue
        cells.setdefault(cell,[]).append((x,y));kept.append(f)
    return kept


def native_window(reader,left,top,width,height):
    """Join existing original-resolution cores; absent exterior context is invalid."""
    rgb=np.zeros((height,width,3),'uint8');valid=np.zeros((height,width),bool)
    for sx,sy,file in reader.tiles:
        if sx>=left+width or sy>=top+height or sx+2048<=left or sy+2048<=top:continue
        source,mask=reader.read(file);h,w=mask.shape
        l,t,r,b=max(left,sx),max(top,sy),min(left+width,sx+w),min(top+height,sy+h)
        if r<=l or b<=t:continue
        rgb[t-top:b-top,l-left:r-left]=source[t-sy:b-sy,l-sx:r-sx];valid[t-top:b-top,l-left:r-left]=mask[t-sy:b-sy,l-sx:r-sx]
    return rgb,valid


def infer(root,native,cache,block):
    root=Path(root);native=Path(native);model=load(root/'model.json');manifest=load(root/'manifest.json');a=load(root/block/'analysis.json');out=root/block/'suggestions-buffer4';out.mkdir(exist_ok=True)
    meta=load(native/'Agro_ABC-source-metadata.json');transform=Affine(*meta['transform'][:6]);gsd=meta['gsd_m'];reader=CheckpointReader('Agro_ABC',cache,load(Path(cache)/'checkpoint.json'));patcher=NativePatches(native/block/'assets',gsd)
    geo=load(root/block/'zones.geojson');zones=[(f['properties']['id'],shape(f['geometry'])) for f in geo['features']];region=unary_union([g for _,g in zones]);all_features=[];cv2.setNumThreads(2)
    provenance={'model_signature':model['signature'],'analysis_sha256':digest(a),'zones_sha256':digest(geo),'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'source_md5':reader.index['identity'].get('md5Checksum')}
    if (out/'provenance.json').exists() and load(out/'provenance.json')!=provenance:raise ValueError('suggestion_resume_mismatch')
    write(out/'provenance.json',provenance)
    with rasterio.Env(GDAL_CACHEMAX=128*1024*1024),rasterio.open(native/block/'assets'/a['native_tiles'][0]['file']) as sample:
        if sample.crs.to_string()!=meta['crs']:raise ValueError('native_source_crs_mismatch')
        for i,tile in enumerate(a['native_tiles'],1):
            resume=out/(Path(tile['file']).stem+'.json')
            if resume.exists():all_features+=load(resume);continue
            x,y=map(int,re.search(r'x(\d+)_y(\d+)',tile['file']).groups());left,top=max(0,x-160),max(0,y-160);width=x+2048+160-left;height=y+2048+160-top
            rgb,valid=native_window(patcher,left,top,width,height)
            mask=geometry_mask([mapping(region)],valid.shape,transform*Affine.translation(left,top),invert=True);w,h=width//2,height//2;small=cv2.resize(rgb,(w,h),interpolation=cv2.INTER_AREA);v=cv2.resize(valid.astype('float32'),(w,h),interpolation=cv2.INTER_AREA)>=1-1e-6;z=cv2.resize(mask.astype('uint8'),(w,h),interpolation=cv2.INTER_NEAREST)>0
            proposals=radial_propose(small,v,z,threshold=model['radial_threshold'],radii=model['radial_radii_half_native_pixels'],distance=model['suppression_half_native_pixels'],limit=100000)
            found=[]
            for radial,px,py in proposals:
                sx=int(round(left+(px+.5)*width/w-.5));sy=int(round(top+(py+.5)*height/h-.5))
                if not (x<=sx<x+2048 and y<=sy<y+2048):continue
                xy=transform*(sx+.5,sy+.5);point=Point(xy);membership=list(dict.fromkeys(k for k,g in zones if g.covers(point)))
                if not membership:continue
                ds=[descriptor(patcher.patch(sx,sy,s)) for s in (1.,2.)];values=[float(score(d,model)) for d in ds if d is not None]
                if not values or max(values)<model['threshold']:continue
                found.append({'type':'Feature','geometry':{'type':'Point','coordinates':list(xy)},'properties':{'id':f'{block}-manual-suggest-x{sx}-y{sy}','zones':membership,'source_pixel':[sx,sy],'native_tile':tile['file'],'radial_score':radial,'comparison_score':max(values),'status':'suggestion','model_signature':model['signature']}})
            write(resume,found);all_features+=found
            if i%5==0 or i==len(a['native_tiles']):print(json.dumps({'block':block,'processed_tiles':i,'total_tiles':len(a['native_tiles']),'qualified_before_dedup':len(all_features)}),flush=True)
    baseline=load(root/block/'candidates.geojson')['features'];head=load(root/block/'head.json');changes=(head.get('review') or {}).get('changes',[])
    # Exclude original centres too, even after a move/rejection. Existing team
    # decisions are authoritative. Runtime dedup also checks the latest edits.
    anchors=[f['geometry']['coordinates'] for f in baseline+changes]
    ordered=sorted(all_features,key=lambda f:f['properties']['comparison_score'],reverse=True);kept=exclude_near(ordered,anchors,gsd,transform,model['duplicate_exclusion_m'])
    data={'schema':'dayun-additional-suggestions-v1','source_run':manifest['run'],'block':block,'analysis_path':manifest['block_analyses'][block],'model_signature':model['signature'],'review_revision':head['revision'],'candidate_count':len(kept),'processed_tiles':len(a['native_tiles']),'total_tiles':len(a['native_tiles']),'duplicate_exclusion_m':model['duplicate_exclusion_m'],'features':kept,'zones':[{'zone_id':k,'suggestions':sum(k in f['properties']['zones'] for f in kept)} for k,_ in zones],'evaluation':model['evaluation'],'training':model['provenance'],'validated_pineapple_total':None,'census_changed':False,'team_corrections_changed':False,'limitations':['Additional proposals only; not added to the plant count until staff acceptance.','Two-times reduced radial search, followed by original native metric-patch scoring; source imagery unchanged.','Original native cores are joined at internal seams; missing context outside the existing crop set is masked and can miss edge plants.','A positive examples only: B and C transfer has no independent positive validation.','Sparse positive recovery and negative controls do not measure ABC population precision or exhaustive recall.']}
    write(out/'suggestions.json',data)
    with (out/'gawangan.csv').open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,fieldnames=['zone_id','suggestions']);w.writeheader();w.writerows(data['zones'])
    print(json.dumps({'block':block,'additional_suggestions':len(kept),'all_native_tiles_processed':len(a['native_tiles'])}),flush=True)
    return data


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('mode',choices=['train','infer']);p.add_argument('--root',required=True);p.add_argument('--native',required=True);p.add_argument('--cache',required=True);p.add_argument('--block',choices=list('ABC'));p.add_argument('--control-history',nargs='+',help='Private JSON histories of previously evaluated negative locations; required for training');a=p.parse_args()
    if a.mode=='train':train(a.root,a.native,a.cache,a.control_history)
    elif a.block:infer(a.root,a.native,a.cache,a.block)
    else:p.error('--block required for infer')
