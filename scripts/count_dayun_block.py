"""Count exploratory crown proposals over an entire existing native block crop set.

Reuses the existing checkpoint reader, radial detector and source polygons.
Never writes native imagery, source boundaries, reviews or census records.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import re
import cv2
import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.windows import Window
from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union
from propose_dayun_candidates import radial_propose


def deduplicate(features, distance=65):
    cells={};kept=[]
    for f in sorted(features,key=lambda f:f['properties']['similarity'],reverse=True):
        x,y=f['properties']['source_pixel'];cell=(int(x//distance),int(y//distance))
        neighbors=[p for dx in (-1,0,1) for dy in (-1,0,1) for p in cells.get((cell[0]+dx,cell[1]+dy),[])]
        if any((x-a)**2+(y-b)**2<distance**2 for a,b in neighbors):continue
        cells.setdefault(cell,[]).append((x,y));kept.append(f)
    return kept


def count_block(directory,output,source,threshold=.30,rejected=None,source_identity=None):
    root=Path(directory);out=Path(output);out.mkdir(parents=True,exist_ok=True)
    result=json.loads((root/'analysis.json').read_text())
    geo=json.loads((root/'zones.geojson').read_text())
    zones=[(f['properties']['id'],shape(f['geometry'])) for f in geo['features']]
    region=unary_union([g for _,g in zones])
    provenance={'source_run':result['source_run'],'method':'native-radial-full-block-v1','threshold':threshold,
                'radii_native_pixels':[40,55,75],'suppression_native_pixels':65,'halo_native_pixels':160,
                'zones_sha256':hashlib.sha256((root/'zones.geojson').read_bytes()).hexdigest(),
                'source_identity':source_identity or str(source.tags().get('TIFFTAG_IMAGEDESCRIPTION','')),
                'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                'detector_sha256':hashlib.sha256((Path(__file__).parent/'propose_dayun_candidates.py').read_bytes()).hexdigest(),
                'rejected_locations':rejected or [],'source_grid':{'crs':str(source.crs),'transform':list(source.transform),'width':source.width,'height':source.height}}
    marker=out/'count-provenance.json'
    if marker.exists() and json.loads(marker.read_text())!=provenance:raise ValueError('count_resume_provenance_mismatch')
    marker.write_text(json.dumps(provenance));(out/'resume').mkdir(exist_ok=True)
    rejected_pixels=[(~source.transform)*(p[0],p[1]) for p in (rejected or [])]
    candidates=[];cv2.setNumThreads(2)
    for i,tile in enumerate(result['native_tiles'],1):
        path=root/tile['file'];match=re.fullmatch(r'x(\d+)_y(\d+)\.tif',path.name)
        if not match:raise ValueError('invalid_native_tile_name')
        x,y=map(int,match.groups())
        with rasterio.open(path) as native:
            if native.crs!=source.crs or native.transform!=source.window_transform(Window(x,y,native.width,native.height)):raise ValueError('native_source_grid_mismatch')
            core=Window(x,y,native.width,native.height)
        checkpoint=out/'resume'/(path.stem+'.json')
        if checkpoint.exists():candidates.extend(json.loads(checkpoint.read_text()));continue
        left,top=max(0,x-160),max(0,y-160)
        halo=Window(left,top,min(source.width,x+core.width+160)-left,min(source.height,y+core.height+160)-top)
        data=source.read([1,2,3],window=halo);valid=source.dataset_mask(window=halo)>0
        zone_mask=geometry_mask([mapping(region)],valid.shape,source.window_transform(halo),invert=True)
        proposals=radial_propose(np.moveaxis(data,0,-1),valid,zone_mask,threshold=min(.25,threshold),limit=100000)
        found=[]
        for score,px,py in proposals:
            sx,sy=left+px,top+py
            if not (x<=sx<x+core.width and y<=sy<y+core.height):continue
            lon,lat=source.transform*(sx+.5,sy+.5);point=Point(lon,lat)
            matches=[key for key,g in zones if g.covers(point)]
            if not matches:continue
            rejected_point=any((sx+.5-a)**2+(sy+.5-b)**2<=12**2 for a,b in rejected_pixels)
            found.append({'type':'Feature','geometry':{'type':'Point','coordinates':[lon,lat]},'properties':{
                'id':f'A-radial-x{sx}-y{sy}','zones':matches,'boundary_conflict':len(matches)>1,
                'similarity':round(score,5),'status':'unvalidated_crown_candidate','source_pixel':[sx,sy],
                'native_tile':tile['file'],'excluded_by_owner_rejection':rejected_point}})
        checkpoint.write_text(json.dumps(found));candidates.extend(found)
        print(json.dumps({'processed_native_tiles':i,'total_native_tiles':len(result['native_tiles']),'raw_crown_proposals':len(candidates)}),flush=True)
    all_kept=deduplicate(candidates)
    kept=[f for f in all_kept if f['properties']['similarity']>=threshold and not f['properties']['excluded_by_owner_rejection']]
    rows=[]
    for feature in geo['features']:
        row=feature['properties'];key=row['id']
        single=sum(f['properties']['zones']==[key] for f in kept)
        conflicts=sum(key in f['properties']['zones'] and f['properties']['boundary_conflict'] for f in kept)
        row.update(candidate_crowns=single,boundary_conflict_candidates=conflicts,pineapple_count_validated=None,
                   count_status='whole_block_automated_low_confidence',census_changed=False)
        row['candidate_sensitivity_025']=sum(key in f['properties']['zones'] and not f['properties']['excluded_by_owner_rejection'] for f in all_kept if f['properties']['similarity']>=.25)
        row['candidate_sensitivity_040']=sum(key in f['properties']['zones'] and not f['properties']['excluded_by_owner_rejection'] for f in all_kept if f['properties']['similarity']>=.40)
        rows.append(row)
    total=lambda t:sum(f['properties']['similarity']>=t and not f['properties']['excluded_by_owner_rejection'] for f in all_kept)
    result.update(candidate_count=len(kept),boundary_conflict_candidate_count=sum(f['properties']['boundary_conflict'] for f in kept),
                  zones=rows,method='Full native-resolution radial leaf-edge orientation; all native Blok A cores with 160px source halos; global 65px suppression',
                  count_reliability='low_unvalidated_whole_block_estimate',pineapple_count_validated=None,census_changed=False,
                  full_block_count={'status':'processed_all_native_tiles','processed_tiles':len(result['native_tiles']),
                                    'threshold':threshold,'candidate_count':len(kept),'threshold_025_count':total(.25),'threshold_040_count':total(.40),
                                    'owner_rejected_locations':len(rejected_pixels),'excluded_candidates':sum(f['properties']['excluded_by_owner_rejection'] for f in all_kept),
                                    'confidence':'low','sensitivity_is_not_confidence_interval':True,'validated_pineapple_total':None})
    result['analysis_findings']=[f'Hitungan otomatis seluruh Blok A: {len(kept):,} kandidat tajuk dari {len(result["native_tiles"])} potongan native; keyakinan rendah, belum jumlah nanas terkonfirmasi.',
                                 'Citra asli diproses dengan halo 160 piksel dan penyaringan duplikat lintas potongan. Semua ID gawangan sumber tetap digabung.',
                                 'Koreksi tambahan pengguna belum ditemukan tersimpan pada server. Dua lokasi kandidat yang ditolak melalui chat diperiksa untuk pengecualian; ini bukan pelatihan klasifikasi jenis tanaman.']
    result['limitations']=['Whole-block candidate count, not a confirmed living pineapple census. No measured precision or recall is available.',
                          'Radial crowns can include weeds and other species; small seedlings, overlapping or obscured leaves and pale plants can be missed.',
                          'Threshold .25/.40 counts are sensitivity checks, not lower/upper bounds or a confidence interval.',
                          'Active/dead follows original polygon category, not detected health. Overlap candidates are counted once globally.',
                          'Native source halos avoid crop-seam losses; full valid annuli are still required near source no-data edges.',
                          'Flight date is owner-reported; absolute boundary accuracy remains unverified. No source census records are changed.']
    def write(name,value):(out/name).write_text(json.dumps(value,ensure_ascii=False),encoding='utf-8')
    write('analysis.json',result);write('zones.geojson',geo);write('candidates.geojson',{'type':'FeatureCollection','features':kept})
    write('candidate-sensitivity.geojson',{'type':'FeatureCollection','features':all_kept})
    with (out/'gawangan.csv').open('w',newline='',encoding='utf-8-sig') as f:
        writer=csv.DictWriter(f,fieldnames=sorted(set(k for row in rows for k in row)));writer.writeheader();writer.writerows(rows)
    (out/'full-block-report.txt').write_text('\n'.join(result['analysis_findings'])+'\n\n'+json.dumps(result['full_block_count'],ensure_ascii=False)+'\n\n'+'\n'.join(result['limitations']),encoding='utf-8')
    print(json.dumps(result['full_block_count']),flush=True)
    return result


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--directory',required=True);parser.add_argument('--output',required=True);parser.add_argument('--source',required=True);parser.add_argument('--cache',default='tmp/dayun-block-A-source');parser.add_argument('--rejections');parser.add_argument('--expected-md5')
    a=parser.parse_args();rejected=[]
    if a.rejections:
        t=json.loads(Path(a.rejections).read_text());expected=json.loads((Path(a.directory)/'analysis.json').read_text())['source_run']
        if t.get('source_run')!=expected or not isinstance(t.get('rejections'),list):raise ValueError('rejection_source_mismatch')
        for row in t['rejections']:
            p=row.get('coordinates')
            if row.get('decision')!='rejected' or not isinstance(p,list) or len(p)!=2 or not all(isinstance(v,(float,int)) and np.isfinite(v) for v in p):raise ValueError('invalid_rejection_point')
            rejected.append(p)
    if a.source=='checkpoint':
        from dayun_checkpoint_reader import CheckpointReader
        reader=CheckpointReader('Agro_ABC',a.cache)
        if not a.expected_md5 or reader.index['identity'].get('md5Checksum')!=a.expected_md5:raise ValueError('checkpoint_source_identity_mismatch')
        with rasterio.open('source.tif',opener=reader.opener) as ds:count_block(a.directory,a.output,ds,rejected=rejected,source_identity=reader.index['identity'])
    else:
        with rasterio.open(a.source) as ds:count_block(a.directory,a.output,ds,rejected=rejected)
