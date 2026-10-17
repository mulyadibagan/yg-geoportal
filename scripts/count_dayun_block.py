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


def count_block(directory,output,source,threshold=.30,rejected=None,source_identity=None,calibration=None,manual_points=None,review_version=None):
    root=Path(directory);out=Path(output);out.mkdir(parents=True,exist_ok=True)
    result=json.loads((root/'analysis.json').read_text())
    block=result['block']
    if block not in 'ABCDEF' or len(block)!=1:raise ValueError('invalid_block')
    geo=json.loads((root/'zones.geojson').read_text())
    zones=[(f['properties']['id'],shape(f['geometry'])) for f in geo['features']]
    region=unary_union([g for _,g in zones])
    radii=tuple(calibration['radii_native_pixels']) if calibration else (40,55,75)
    distance=calibration['suppression_native_pixels'] if calibration else 65
    tolerance=calibration.get('matching_tolerance_native_pixels',12) if calibration else 12
    if calibration:
        if calibration['source_run']!=result['source_run'] or calibration['schema']!='dayun-positive-radial-calibration-v1':raise ValueError('calibration_source_mismatch')
        threshold=calibration['threshold']
    positive_features=manual_points if manual_points is not None else calibration['labels'] if calibration else []
    positives=[(~source.transform)*tuple(f['geometry']['coordinates']) for f in positive_features if region.covers(Point(f['geometry']['coordinates']))]
    low=max(.10,round(threshold-.05,3));high=round(threshold+.05,3)
    provenance={'source_run':result['source_run'],'method':'native-radial-full-block-v1','threshold':threshold,
                'radii_native_pixels':list(radii),'suppression_native_pixels':distance,'halo_native_pixels':160,
                'zones_sha256':hashlib.sha256((root/'zones.geojson').read_bytes()).hexdigest(),
                'source_identity':source_identity or str(source.tags().get('TIFFTAG_IMAGEDESCRIPTION','')),
                'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                'detector_sha256':hashlib.sha256((Path(__file__).parent/'propose_dayun_candidates.py').read_bytes()).hexdigest(),
                'rejected_locations':rejected or [],'manual_exclusion_coordinates':[f['geometry']['coordinates'] for f in positive_features],
                'review_version':review_version,'matching_tolerance_native_pixels':tolerance,
                'source_grid':{'crs':str(source.crs),'transform':list(source.transform),'width':source.width,'height':source.height}}
    if calibration:provenance.update(method='native-owner-calibrated-radial-v1',model_signature=calibration['model_signature'],training_review_version=calibration['training_review_version'])
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
        proposals=radial_propose(np.moveaxis(data,0,-1),valid,zone_mask,threshold=min(.25,threshold,low) if calibration else min(.25,threshold),distance=distance,radii=radii,center_luma_min=calibration.get('center_luma_min') if calibration else None,limit=100000)
        found=[]
        for score,px,py in proposals:
            sx,sy=left+px,top+py
            if not (x<=sx<x+core.width and y<=sy<y+core.height):continue
            lon,lat=source.transform*(sx+.5,sy+.5);point=Point(lon,lat)
            matches=[key for key,g in zones if g.covers(point)]
            if not matches:continue
            rejected_point=any((sx+.5-a)**2+(sy+.5-b)**2<=tolerance**2 for a,b in rejected_pixels)
            matched_positive=any((sx+.5-a)**2+(sy+.5-b)**2<=tolerance**2 for a,b in positives)
            found.append({'type':'Feature','geometry':{'type':'Point','coordinates':[lon,lat]},'properties':{
                'id':f'{block}-radial-x{sx}-y{sy}','zones':matches,'boundary_conflict':len(matches)>1,
                'similarity':round(score,5),'status':'unvalidated_crown_candidate','source_pixel':[sx,sy],
                'native_tile':tile['file'],'excluded_by_owner_rejection':rejected_point,'represented_by_manual_point':matched_positive}})
        checkpoint.write_text(json.dumps(found));candidates.extend(found)
        print(json.dumps({'processed_native_tiles':i,'total_native_tiles':len(result['native_tiles']),'raw_crown_proposals':len(candidates)}),flush=True)
    all_kept=deduplicate(candidates,distance)
    eligible=lambda f:not f['properties']['excluded_by_owner_rejection'] and not f['properties'].get('represented_by_manual_point')
    kept=[f for f in all_kept if f['properties']['similarity']>=threshold and eligible(f)]
    rows=[]
    for feature in geo['features']:
        row=feature['properties'];key=row['id']
        single=sum(f['properties']['zones']==[key] for f in kept)
        conflicts=sum(key in f['properties']['zones'] and f['properties']['boundary_conflict'] for f in kept)
        row.update(candidate_crowns=single,boundary_conflict_candidates=conflicts,pineapple_count_validated=None,
                   count_status='whole_block_automated_low_confidence',census_changed=False)
        row['candidate_sensitivity_025']=sum(key in f['properties']['zones'] and eligible(f) for f in all_kept if f['properties']['similarity']>=.25)
        row['candidate_sensitivity_040']=sum(key in f['properties']['zones'] and eligible(f) for f in all_kept if f['properties']['similarity']>=.40)
        rows.append(row)
    total=lambda t:sum(f['properties']['similarity']>=t and eligible(f) for f in all_kept)
    result.update(candidate_count=len(kept),boundary_conflict_candidate_count=sum(f['properties']['boundary_conflict'] for f in kept),
                  zones=rows,method=f'Full native-resolution radial leaf-edge orientation; all native Blok {block} cores with 160px source halos; global suppression',
                  count_reliability='low_unvalidated_whole_block_estimate',pineapple_count_validated=None,census_changed=False,
                  full_block_count={'status':'processed_all_native_tiles','processed_tiles':len(result['native_tiles']),
                                    'threshold':threshold,'candidate_count':len(kept),'threshold_025_count':total(.25),'threshold_040_count':total(.40),
                                    'owner_rejected_locations':len(rejected_pixels),'excluded_candidates':sum(f['properties']['excluded_by_owner_rejection'] for f in all_kept),
                                    'confidence':'low','sensitivity_is_not_confidence_interval':True,'validated_pineapple_total':None})
    result['analysis_findings']=[f'Hitungan otomatis seluruh Blok {block}: {len(kept):,} kandidat tajuk dari {len(result["native_tiles"])} potongan native; keyakinan rendah, belum jumlah nanas terkonfirmasi.',
                                 'Citra asli diproses dengan halo 160 piksel dan penyaringan duplikat lintas potongan. Semua ID gawangan sumber tetap digabung.',
                                 'Koreksi tim tetap terpisah dari kandidat otomatis dan data sensus; jumlah kandidat belum tervalidasi sebagai jumlah tanaman.']
    result['limitations']=['Whole-block candidate count, not a confirmed living pineapple census. No measured precision or recall is available.',
                          'Radial crowns can include weeds and other species; small seedlings, overlapping or obscured leaves and pale plants can be missed.',
                          'Threshold .25/.40 counts are sensitivity checks, not lower/upper bounds or a confidence interval.',
                          'Active/dead follows original polygon category, not detected health. Overlap candidates are counted once globally.',
                          'Native source halos avoid crop-seam losses; full valid annuli are still required near source no-data edges.',
                          'Flight date is owner-reported; absolute boundary accuracy remains unverified. No source census records are changed.']
    if calibration:
        result['method']='Existing native radial engine calibrated with private owner positive examples; original source halos and global learned-distance suppression'
        result['model_calibration']={k:v for k,v in calibration.items() if k not in ['labels','label_pixels','templates_gray','training_positive_peak_scores']}
        result['full_block_count']['sensitivity_thresholds']=[{'threshold':t,'candidate_count':total(t)} for t in [low,threshold,high]]
        result['full_block_count']['manual_points_retained']=len(positives)
        result['full_block_count']['model_proposals_represented_by_manual']=sum(f['properties'].get('represented_by_manual_point',False) and f['properties']['similarity']>=threshold for f in all_kept)
        result['analysis_findings']=[f'Detektor dikalibrasi dari {len(positives)} titik positif pengguna. Seluruh {len(result["native_tiles"])} potongan native dihitung ulang; hasil otomatis tetap kandidat berkeyakinan rendah.',
                                   'Titik koreksi pengguna tetap terpisah. Usulan otomatis yang cocok dalam 12 piksel dengan titik manual dikeluarkan dari lapisan otomatis agar tidak dihitung dua kali.',
                                   'Uji positif lokal tidak mengukur presisi atau akurasi jumlah seluruh blok. Belum ada hitungan acuan lengkap maupun contoh negatif yang memadai.']
        result['limitations']=calibration['limitations']+['Native whole-block detections remain unvalidated; no source census records are changed.','Manual labels are displayed from private team corrections, not injected as automatic detections.']
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
