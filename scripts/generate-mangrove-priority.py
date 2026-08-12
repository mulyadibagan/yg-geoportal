#!/usr/bin/env python3
"""Resumable, conservative Sentinel-2 mangrove rehabilitation screening."""
from __future__ import annotations
import argparse,json,math,sys,time,warnings
from datetime import datetime,timezone
from pathlib import Path
import numpy as np
import planetary_computer as pc
import rasterio
from pystac_client import Client
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.features import geometry_mask,shapes
from rasterio.transform import from_origin
from rasterio.vrt import WarpedVRT
from scipy import ndimage
from shapely.geometry import mapping,shape
from shapely.ops import transform as geom_transform,unary_union
from skimage import morphology

ROOT=Path(__file__).resolve().parents[1]
FOUNDATION=ROOT/'data'/'mangrove-priority-intervention.json'
SUMMARY=ROOT/'data'/'mangrove-priority-results.json'
BOUNDARIES=ROOT/'data'/'desa_intervensi.geojson'
PLANTING=ROOT/'data'/'area_mangrove.geojson'
PROGRESS=ROOT/'data'/'mangrove-priority-progress.json'
OUTPUT=ROOT/'data'/'mangrove-priority-candidates.geojson'
RESOLUTION=10; MAX_SCENES=5; CLOUD_LIMIT=70; MIN_PIXELS=9
CLEAR_SCL={2,4,5,6,7}

def dates(year): return f'{year}-04-01',f'{year}-09-30'
def utm(lon): return 32600+int((lon+180)//6)+1
def grid(feature,padding=600):
    geom=shape(feature['geometry']); epsg=utm(geom.centroid.x)
    forward=Transformer.from_crs(4326,epsg,always_xy=True).transform
    projected=geom_transform(forward,geom); minx,miny,maxx,maxy=projected.bounds
    minx=math.floor((minx-padding)/10)*10; miny=math.floor((miny-padding)/10)*10
    maxx=math.ceil((maxx+padding)/10)*10; maxy=math.ceil((maxy+padding)/10)*10
    return epsg,projected,from_origin(minx,maxy,10,10),int((maxx-minx)/10),int((maxy-miny)/10)
def coords(geom):
    polys=[geom['coordinates']] if geom['type']=='Polygon' else geom['coordinates']
    for poly in polys:
        for ring in poly:
            for xy in ring: yield xy
def search(catalog,bbox,year):
    start,end=dates(year); last=None
    for attempt in range(4):
        try:
            items=list(catalog.search(collections=['sentinel-2-l2a'],bbox=bbox,datetime=f'{start}/{end}',query={'eo:cloud_cover':{'lt':CLOUD_LIMIT}}).items())
            return sorted(items,key=lambda x:x.properties.get('eo:cloud_cover',100))[:MAX_SCENES]
        except Exception as exc:
            last=exc
            if attempt<3: time.sleep(3*(attempt+1))
    raise last
def read(item,key,epsg,affine,width,height,resampling):
    with rasterio.open(item.assets[key].href) as src,WarpedVRT(src,crs=f'EPSG:{epsg}',transform=affine,width=width,height=height,resampling=resampling) as vrt:
        return vrt.read(1,masked=True).astype('float32').filled(np.nan)
def composite(items,epsg,affine,width,height):
    obs=[]; used=[]
    for item in items:
        try:
            scl=read(item,'SCL',epsg,affine,width,height,Resampling.nearest)
            blue=read(item,'B02',epsg,affine,width,height,Resampling.bilinear)
            green=read(item,'B03',epsg,affine,width,height,Resampling.bilinear)
            red=read(item,'B04',epsg,affine,width,height,Resampling.bilinear)
            nir=read(item,'B08',epsg,affine,width,height,Resampling.bilinear)
            swir=read(item,'B11',epsg,affine,width,height,Resampling.bilinear)
            valid=np.isin(scl,list(CLEAR_SCL))&np.isfinite(blue+green+red+nir+swir)
            stack=np.stack([blue,green,red,nir,swir]).astype('float32'); stack[:,~valid]=np.nan
            if valid.mean()<.10: continue
            obs.append(stack); used.append(item)
        except Exception as exc: print('skip scene',item.id,exc,file=sys.stderr)
    if not obs:return None
    with warnings.catch_warnings():
        warnings.filterwarnings('ignore',message='All-NaN slice encountered')
        median=np.nanmedian(np.stack(obs),axis=0)
    clear=np.isfinite(np.stack(obs)[:,0]).sum(axis=0)
    b,g,r,n,s=median
    return {'ndvi':(n-r)/(n+r+1e-6),'ndmi':(n-s)/(n+s+1e-6),'mndwi':(g-s)/(g+s+1e-6),'clear':clear,'items':used}
def clean(mask):
    mask=morphology.remove_small_objects(mask,max_size=MIN_PIXELS-1)
    return morphology.opening(mask,morphology.disk(1))
def polygons(mask,affine,inverse,props):
    out=[]
    for geom,value in shapes(mask.astype('uint8'),mask=mask,transform=affine):
        if value==1: out.append({'type':'Feature','properties':dict(props),'geometry':mapping(geom_transform(inverse,shape(geom)))})
    return out
def boundary_for(v):
    all_features=json.loads(BOUNDARIES.read_text(encoding='utf-8'))['features']
    aliases={v['village'].casefold(),v['id'].replace('-',' ').casefold()}
    matches=[f for f in all_features if str(f.get('properties',{}).get('WADMKD','')).casefold() in aliases]
    if not matches: raise ValueError('boundary not found')
    return matches[0]
def planted_geometries(v):
    features=json.loads(PLANTING.read_text(encoding='utf-8'))['features']
    return [shape(f['geometry']) for f in features if str(f.get('properties',{}).get('Desa','')).casefold()==v['village'].casefold()]
def score_class(score): return 'tinggi' if score>=70 else 'sedang' if score>=45 else 'rendah'
def analyse(v,catalog,baseline,current):
    feature=boundary_for(v); points=list(coords(feature['geometry'])); bbox=[min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points)]
    epsg,vgeom,affine,width,height=grid(feature); village=geometry_mask([mapping(vgeom)],out_shape=(height,width),transform=affine,invert=True)
    periods=[]
    for year in (baseline,current): periods.append(composite(search(catalog,bbox,year),epsg,affine,width,height))
    base,now=periods
    common={'id':v['id'],'village':v['village'],'district':v['district'],'regency':v['regency'],'baseline':str(baseline),'current':str(current),'status':'insufficient-data'}
    if not base or not now:return {**common,'reason':'Komposit bebas awan tidak memadai.'},[]
    valid=village&(base['clear']>0)&(now['clear']>0)
    base_mangrove=(base['ndvi']>.48)&(base['ndmi']>.08)&(base['mndwi']<0)
    now_mangrove=(now['ndvi']>.48)&(now['ndmi']>.08)&(now['mndwi']<0)
    water=(now['mndwi']>.08)&valid
    loss_zone=ndimage.binary_dilation(water,iterations=30)
    opportunity_zone=ndimage.binary_dilation(water,iterations=15)
    mangrove_context=ndimage.binary_dilation(base_mangrove|now_mangrove,iterations=10)
    loss=clean(base_mangrove&~now_mangrove&valid&loss_zone)
    wet_open=(now['ndvi']>.12)&(now['ndvi']<.48)&(now['ndmi']>-.05)&(now['mndwi']<.08)
    opportunity=clean(wet_open&valid&opportunity_zone&mangrove_context)
    planting=planted_geometries(v)
    if planting:
        forward=Transformer.from_crs(4326,epsg,always_xy=True).transform
        planted=unary_union([geom_transform(forward,g) for g in planting])
        planted_mask=geometry_mask([mapping(planted)],out_shape=(height,width),transform=affine,invert=True)
        opportunity&=~planted_mask; loss&=~planted_mask
    candidate=clean(loss|opportunity)
    base_area=base_mangrove[valid].sum()/100; now_area=now_mangrove[valid].sum()/100; loss_area=loss.sum()/100; opp_area=opportunity.sum()/100; candidate_area=candidate.sum()/100
    clear=float(valid.sum()/max(village.sum(),1)); scenes=(len(base['items']),len(now['items']))
    confidence='tinggi' if clear>=.85 and min(scenes)>=3 else 'sedang' if clear>=.65 else 'rendah'
    loss_ratio=loss_area/max(base_area,1); need=min(100,round(30+min(40,loss_ratio*120)+min(25,loss_area*2)))
    stability=70 if loss_ratio<.08 else 50 if loss_ratio<.2 else 30
    suitability=min(85,round(stability+min(15,opp_area)+min(10,clear*10)))
    if candidate_area<.1: action='perlindungan mangrove eksisting' if now_area>1 else 'verifikasi lapangan'
    elif suitability>=70 and loss_area<20: action='regenerasi alami terbantu atau penanaman aktif terbatas'
    elif suitability>=70: action='perlindungan pantai dan verifikasi hidrodinamika sebelum penanaman'
    elif suitability>=45: action='pemulihan hidrologi dan verifikasi substrat dahulu'
    else: action='perlindungan pantai/perangkap sedimen dahulu'
    record={**common,'status':'analysed','baselineMangroveHa':round(base_area,2),'currentMangroveHa':round(now_area,2),'indicativeMangroveLossHa':round(loss_area,2),'openTidalOpportunityHa':round(opp_area,2),'candidateAreaHa':round(candidate_area,2),'needScore':need,'needClass':score_class(need),'suitabilityScore':suitability,'suitabilityClass':score_class(suitability),'recommendedAction':action,'confidence':confidence,'clearCoveragePct':round(clear*100,1),'baselineSceneCount':scenes[0],'currentSceneCount':scenes[1],'baselineScenes':[x.id for x in base['items']],'currentScenes':[x.id for x in now['items']],'resolutionM':10,'fieldVerification':'required'}
    inverse=Transformer.from_crs(epsg,4326,always_xy=True).transform
    feats=polygons(candidate,affine,inverse,{'id':v['id'],'village':v['village'],'district':v['district'],'regency':v['regency'],'type':'rehabilitation-candidate','confidence':confidence,'needClass':record['needClass'],'suitabilityClass':record['suitabilityClass'],'recommendedAction':action})
    return record,feats
def save(progress,records,features,foundation,baseline,current):
    now=datetime.now(timezone.utc).isoformat(); ids=[v['id'] for v in foundation['villages']]
    pending=[x for x in ids if x not in progress['completed']]
    progress.update(updatedAt=now,totalVillages=len(ids),completedCount=len(progress['completed']),nextVillage=pending[0] if pending else None,safeToResume=True,status='complete' if not pending else 'processing')
    PROGRESS.write_text(json.dumps(progress,ensure_ascii=False,indent=2),encoding='utf-8')
    product={'schemaVersion':1,'product':'Analisis indikatif prioritas rehabilitasi mangrove desa intervensi YG','generatedAt':now,'baseline':str(baseline),'current':str(current),'methodVersion':'s2-mangrove-screening-v1','status':progress['status'],'disclaimer':'Analisis indikatif berbasis Sentinel-2; bukan penetapan lokasi tanam. Verifikasi hidrologi, substrat, salinitas, penggunaan dan status lahan, serta persetujuan masyarakat wajib dilakukan.','villages':records}
    SUMMARY.write_text(json.dumps(product,ensure_ascii=False,indent=2),encoding='utf-8')
    OUTPUT.write_text(json.dumps({'type':'FeatureCollection','generatedAt':now,'methodVersion':'s2-mangrove-screening-v1','features':features},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
def main():
    p=argparse.ArgumentParser(); p.add_argument('--village'); p.add_argument('--force',action='store_true'); p.add_argument('--baseline-year',type=int,default=2016); p.add_argument('--year',type=int,default=2025); args=p.parse_args()
    foundation=json.loads(FOUNDATION.read_text(encoding='utf-8')); villages=foundation['villages']
    progress=json.loads(PROGRESS.read_text(encoding='utf-8')) if PROGRESS.exists() else {'schemaVersion':1,'completed':{},'failed':{}}
    existing=json.loads(SUMMARY.read_text(encoding='utf-8')) if SUMMARY.exists() else {'villages':[]}
    records={r['id']:r for r in existing.get('villages',[]) if r.get('status') in {'analysed','insufficient-data'}}
    features=json.loads(OUTPUT.read_text(encoding='utf-8')).get('features',[]) if OUTPUT.exists() else []
    selected=[v for v in villages if (not args.village or v['id']==args.village) and (args.force or v['id'] not in progress['completed'])]
    if args.village and not selected and args.village not in {v['id'] for v in villages}: p.error('unknown village id')
    catalog=Client.open('https://planetarycomputer.microsoft.com/api/stac/v1',modifier=pc.sign_inplace)
    for v in selected:
        try:
            record,parts=analyse(v,catalog,args.baseline_year,args.year); records[v['id']]=record
            features=[f for f in features if f.get('properties',{}).get('id')!=v['id']]+parts
            progress['completed'][v['id']]={'status':record['status'],'completedAt':datetime.now(timezone.utc).isoformat()}; progress['failed'].pop(v['id'],None)
            print(v['village'],record['status'],record.get('candidateAreaHa'),record.get('needScore'),record.get('suitabilityScore'),flush=True)
        except Exception as exc:
            progress['failed'][v['id']]={'error':str(exc),'at':datetime.now(timezone.utc).isoformat()}; print('failed',v['village'],exc,file=sys.stderr,flush=True)
        save(progress,list(records.values()),features,foundation,args.baseline_year,args.year)
    save(progress,list(records.values()),features,foundation,args.baseline_year,args.year)
    print(json.dumps(progress,ensure_ascii=False))
if __name__=='__main__':main()
