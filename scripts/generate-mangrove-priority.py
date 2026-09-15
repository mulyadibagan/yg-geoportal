#!/usr/bin/env python3
"""Resumable, conservative Sentinel-2 mangrove rehabilitation screening."""
from __future__ import annotations
import argparse,json,math,sys,time,warnings
from datetime import date,datetime,timezone
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
COASTAL_BOUNDARIES=ROOT/'data'/'coastal-villages-riau.geojson'
COASTAL_CHANGE=ROOT/'data'/'coastal-change-non-intervention-annual.geojson'
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
def search_latest(catalog,bbox,year):
    last=None; today=datetime.now(timezone.utc).date(); end=min(today,date(year,12,31)).isoformat()
    for attempt in range(4):
        try:
            items=list(catalog.search(collections=['sentinel-2-l2a'],bbox=bbox,datetime=f'{year}-01-01/{end}',query={'eo:cloud_cover':{'lt':CLOUD_LIMIT}}).items())
            return sorted(items,key=lambda x:(x.properties.get('eo:cloud_cover',100),str(x.datetime)),reverse=False)[:MAX_SCENES]
        except Exception as exc:
            last=exc
            if attempt<3:time.sleep(3*(attempt+1))
    raise last
def read(item,key,epsg,affine,width,height,resampling):
    # Remote COGs occasionally stop responding. A bounded timeout lets the
    # composite skip that scene and continue with the remaining observations.
    with rasterio.Env(GDAL_HTTP_TIMEOUT='30',GDAL_HTTP_MAX_RETRY='2',GDAL_HTTP_RETRY_DELAY='2'):
        with rasterio.open(item.assets[key].href) as src,WarpedVRT(src,crs=f'EPSG:{epsg}',transform=affine,width=width,height=height,resampling=resampling) as vrt:
            return vrt.read(1,masked=True).astype('float32').filled(np.nan)
def composite(items,epsg,affine,width,height):
    obs=[]; used=[]
    for item in items:
        try:
            print(f"  scene {item.id}",flush=True)
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
    all_features=json.loads(BOUNDARIES.read_text(encoding='utf-8'))['features']+json.loads(COASTAL_BOUNDARIES.read_text(encoding='utf-8'))['features']
    aliases={v['village'].casefold(),v['id'].replace('-',' ').casefold()}
    matches=[f for f in all_features if str(f.get('properties',{}).get('WADMKD','')).casefold() in aliases and str(f.get('properties',{}).get('WADMKK') or f.get('properties',{}).get('WIADKK') or '').casefold()==v['regency'].casefold()]
    if not matches: raise ValueError('boundary not found')
    return matches[0]
def planted_geometries(v):
    features=json.loads(PLANTING.read_text(encoding='utf-8'))['features']
    return [shape(f['geometry']) for f in features if str(f.get('properties',{}).get('Desa','')).casefold()==v['village'].casefold()]
def coastal_analysis_feature(v,feature):
    if not COASTAL_CHANGE.exists():return feature
    changes=json.loads(COASTAL_CHANGE.read_text(encoding='utf-8')).get('features',[])
    matches=[shape(f['geometry']) for f in changes if str(f.get('properties',{}).get('village','')).casefold()==v['village'].casefold() and str(f.get('properties',{}).get('regency','')).casefold()==v['regency'].casefold()]
    if not matches:return feature
    boundary=shape(feature['geometry']);epsg=utm(boundary.centroid.x)
    forward=Transformer.from_crs(4326,epsg,always_xy=True).transform;inverse=Transformer.from_crs(epsg,4326,always_xy=True).transform
    projected=geom_transform(forward,boundary);coast=unary_union([geom_transform(forward,g) for g in matches]).buffer(2500)
    clipped=projected.intersection(coast)
    if clipped.is_empty:return feature
    return {'type':'Feature','properties':feature.get('properties',{}),'geometry':mapping(geom_transform(inverse,clipped))}
def score_class(score): return 'tinggi' if score>=70 else 'sedang' if score>=45 else 'rendah'
def shared_composites(villages,catalog,baseline,current,latest_year):
    features=[coastal_analysis_feature(v,boundary_for(v)) for v in villages]
    merged=mapping(unary_union([shape(f['geometry']) for f in features]))
    shared={'type':'Feature','properties':{},'geometry':merged};points=list(coords(merged))
    bbox=[min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points)]
    epsg,_,affine,width,height=grid(shared)
    print(f"batch {','.join(v['id'] for v in villages)} grid={width}x{height}",flush=True)
    base=composite(search(catalog,bbox,baseline),epsg,affine,width,height)
    now=composite(search(catalog,bbox,current),epsg,affine,width,height)
    latest=composite(search_latest(catalog,bbox,latest_year),epsg,affine,width,height)
    return {'epsg':epsg,'affine':affine,'width':width,'height':height,'base':base,'now':now,'latest':latest}
def analyse(v,catalog,baseline,current,latest_year,shared=None):
    print(f"analyse {v['village']}",flush=True)
    feature=coastal_analysis_feature(v,boundary_for(v)); points=list(coords(feature['geometry'])); bbox=[min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points)]
    if shared:
        epsg,affine,width,height=shared['epsg'],shared['affine'],shared['width'],shared['height'];base,now,latest=shared['base'],shared['now'],shared['latest']
        forward=Transformer.from_crs(4326,epsg,always_xy=True).transform;vgeom=geom_transform(forward,shape(feature['geometry']))
    else:
        epsg,vgeom,affine,width,height=grid(feature)
        base=composite(search(catalog,bbox,baseline),epsg,affine,width,height);now=composite(search(catalog,bbox,current),epsg,affine,width,height);latest=composite(search_latest(catalog,bbox,latest_year),epsg,affine,width,height)
    village=geometry_mask([mapping(vgeom)],out_shape=(height,width),transform=affine,invert=True)
    common={'id':v['id'],'village':v['village'],'district':v['district'],'regency':v['regency'],'baseline':str(baseline),'current':str(current),'status':'insufficient-data'}
    common['latest']=str(latest_year)
    if not base or not now or not latest:return {**common,'reason':'Komposit bebas awan tidak memadai.'},[]
    valid=village&(base['clear']>0)&(now['clear']>0)&(latest['clear']>0)
    base_mangrove=(base['ndvi']>.48)&(base['ndmi']>.08)&(base['mndwi']<0)
    now_mangrove=(now['ndvi']>.48)&(now['ndmi']>.08)&(now['mndwi']<0)
    latest_mangrove=(latest['ndvi']>.48)&(latest['ndmi']>.08)&(latest['mndwi']<0)
    latest_open=(latest['ndvi']<.48)&(latest['ndmi']>-.12)&(latest['mndwi']<.08)&(latest['clear']>0)
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
    candidate=clean((loss|opportunity)&latest_open&~latest_mangrove)
    base_area=base_mangrove[valid].sum()/100; now_area=now_mangrove[valid].sum()/100; loss_area=loss.sum()/100; opp_area=opportunity.sum()/100; candidate_area=candidate.sum()/100
    clear=float(valid.sum()/max(village.sum(),1)); scenes=(len(base['items']),len(now['items']),len(latest['items']))
    confidence='tinggi' if clear>=.85 and min(scenes)>=3 else 'sedang' if clear>=.65 else 'rendah'
    loss_ratio=loss_area/max(base_area,1); need=min(100,round(30+min(40,loss_ratio*120)+min(25,loss_area*2)))
    stability=70 if loss_ratio<.08 else 50 if loss_ratio<.2 else 30
    suitability=min(85,round(stability+min(15,opp_area)+min(10,clear*10)))
    if candidate_area<.1: action='perlindungan mangrove eksisting' if now_area>1 else 'verifikasi lapangan'
    elif suitability>=70 and loss_area<20: action='regenerasi alami terbantu atau penanaman aktif terbatas'
    elif suitability>=70: action='perlindungan pantai dan verifikasi hidrodinamika sebelum penanaman'
    elif suitability>=45: action='pemulihan hidrologi dan verifikasi substrat dahulu'
    else: action='perlindungan pantai/perangkap sedimen dahulu'
    record={**common,'status':'analysed','baselineMangroveHa':round(base_area,2),'currentMangroveHa':round(now_area,2),'indicativeMangroveLossHa':round(loss_area,2),'openTidalOpportunityHa':round(opp_area,2),'candidateAreaHa':round(candidate_area,2),'needScore':need,'needClass':score_class(need),'suitabilityScore':suitability,'suitabilityClass':score_class(suitability),'recommendedAction':action,'confidence':confidence,'clearCoveragePct':round(clear*100,1),'baselineSceneCount':scenes[0],'currentSceneCount':scenes[1],'latestSceneCount':scenes[2],'baselineScenes':[x.id for x in base['items']],'currentScenes':[x.id for x in now['items']],'latestScenes':[x.id for x in latest['items']],'latestOpenScreen':True,'resolutionM':10}
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
    p=argparse.ArgumentParser(); p.add_argument('--village'); p.add_argument('--force',action='store_true'); p.add_argument('--batch-size',type=int,default=4); p.add_argument('--baseline-year',type=int,default=2016); p.add_argument('--year',type=int,default=2025); p.add_argument('--latest-year',type=int,default=datetime.now(timezone.utc).year); args=p.parse_args()
    foundation=json.loads(FOUNDATION.read_text(encoding='utf-8')); villages=foundation['villages']
    progress=json.loads(PROGRESS.read_text(encoding='utf-8')) if PROGRESS.exists() else {'schemaVersion':1,'completed':{},'failed':{}}
    existing=json.loads(SUMMARY.read_text(encoding='utf-8')) if SUMMARY.exists() else {'villages':[]}
    records={r['id']:r for r in existing.get('villages',[]) if r.get('status') in {'analysed','insufficient-data'}}
    features=json.loads(OUTPUT.read_text(encoding='utf-8')).get('features',[]) if OUTPUT.exists() else []
    selected=[v for v in villages if (not args.village or v['id']==args.village) and (args.force or v['id'] not in progress['completed'])]
    if args.village and not selected and args.village not in {v['id'] for v in villages}: p.error('unknown village id')
    print('open catalog',flush=True)
    catalog=Client.open('https://planetarycomputer.microsoft.com/api/stac/v1',modifier=pc.sign_inplace)
    print('catalog ready',flush=True)
    batches=[]
    for district in dict.fromkeys(v['district'] for v in selected):
        group=sorted([v for v in selected if v['district']==district],key=lambda x:(x['lon'],x['lat']))
        batches.extend(group[i:i+args.batch_size] for i in range(0,len(group),args.batch_size))
    for batch in batches:
      try:
        shared=shared_composites(batch,catalog,args.baseline_year,args.year,args.latest_year) if len(batch)>1 else None
      except Exception as exc:
        print('batch fallback',exc,file=sys.stderr,flush=True);shared=None
      for v in batch:
        try:
            record,parts=analyse(v,catalog,args.baseline_year,args.year,args.latest_year,shared); records[v['id']]=record
            features=[f for f in features if f.get('properties',{}).get('id')!=v['id']]+parts
            progress['completed'][v['id']]={'status':record['status'],'completedAt':datetime.now(timezone.utc).isoformat()}; progress['failed'].pop(v['id'],None)
            print(v['village'],record['status'],record.get('candidateAreaHa'),record.get('needScore'),record.get('suitabilityScore'),flush=True)
        except Exception as exc:
            progress['failed'][v['id']]={'error':str(exc),'at':datetime.now(timezone.utc).isoformat()}; print('failed',v['village'],exc,file=sys.stderr,flush=True)
        save(progress,list(records.values()),features,foundation,args.baseline_year,args.year)
      del shared
    save(progress,list(records.values()),features,foundation,args.baseline_year,args.year)
    print(json.dumps(progress,ensure_ascii=False))
if __name__=='__main__':main()
