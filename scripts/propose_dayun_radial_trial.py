"""Prepare reviewable native Blok A samples with the existing crown engine."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.windows import Window, bounds
from PIL import Image, ImageDraw
from propose_dayun_candidates import radial_propose


def build(directory, config_path, output):
    root=Path(directory);out=Path(output);out.mkdir(parents=True,exist_ok=True)
    detail=json.loads((root/'detail-analysis.json').read_text())
    config=json.loads(Path(config_path).read_text())
    if config['source_run']!=detail['source_run']:raise ValueError('radial_source_run_mismatch')
    signature=hashlib.sha256(Path(config_path).read_bytes()+Path(__file__).read_bytes()+
                             (Path(__file__).parent/'propose_dayun_candidates.py').read_bytes()+
                             (root/'detail-provenance.json').read_bytes()).hexdigest()[:16]
    folder='radial-A-'+signature
    zones={f['properties']['id']:f['geometry'] for f in json.loads((root/'zones.geojson').read_text())['features']}
    result={'schema':'dayun-candidate-trial-v1','title':'Blok A — detektor tajuk radial',
            'dataset_id':detail['source_run']+'-'+folder,'source_run':detail['source_run'],'label':'Agro_ABC',
            'method':'native annular leaf-edge orientation; radii 40/55/75px; 65px suppression; centre inside dissolved zone',
            'threshold':.30,'proposal_floor':.20,'threshold_grid':[.20,.25,.30,.35,.40,.45,.50,.55,.60],
            'score_note':'Skor kesesuaian bentuk radial, bukan probabilitas nanas. Pola ukuran tajuk dewasa; bibit kecil dapat terlewat.',
            'limitation':'Kandidat perlu diterima/ditolak/digeser; tambahkan tanaman terlewat. Gulma, daun bertumpuk, tanaman kering dan batas sampel bisa menyebabkan kesalahan. Hitungan hanya jendela sampel; tidak diekstrapolasi ke blok atau sensus.',
            'capture_date':detail.get('capture_date'),'capture_date_status':detail.get('capture_date_status'),
            'census_changed':False,'pineapple_count_validated':None,'samples':[], 'folder':folder,
            'sample_selection':config['samples']}
    baseline=json.loads((root/'detail-trial.json').read_text()) if (root/'detail-trial.json').exists() else {'samples':[]}
    provenance=[]
    for selection in config['samples']:
        src=next(s for s in detail['samples'] if s['zone_id']==selection['zone_id'] and s['stratum']==selection['stratum'])
        sid=selection['id']
        if not sid.replace('-','').isalnum() or len(sid)>60:raise ValueError('invalid_sample_id')
        with rasterio.open(root/src['native_tile']) as ds:
            win=Window(*src['pixel_window']);data=ds.read(window=win)
            if data.shape!=(4,512,512) or ds.crs.to_epsg()!=4326:raise ValueError('expected_native_rgba_512')
            trans=ds.window_transform(win);extent=list(bounds(win,ds.transform));rgb=np.moveaxis(data[:3],0,-1)
            zone=geometry_mask([zones[src['zone_id']]],(512,512),trans,invert=True)
            proposals=radial_propose(rgb,data[3]>0,zone,threshold=.20)
            profile=ds.profile.copy();profile.update(width=512,height=512,transform=trans,compress='deflate',tiled=True,blockxsize=256,blockysize=256)
            crop=out/'native'/f'{sid}.tif';crop.parent.mkdir(exist_ok=True)
            with rasterio.open(crop,'w',**profile) as dst:dst.write(data)
        features=[];image=Image.fromarray(rgb);draw=ImageDraw.Draw(image)
        shown=[p for p in proposals if p[0]>=.30]
        for number,(score,x,y) in enumerate(shown,1):
            lon,lat=trans*(x+.5,y+.5)
            features.append({'type':'Feature','geometry':{'type':'Point','coordinates':[lon,lat]},'properties':{
                'id':f'{sid}-x{x}-y{y}','sample_id':sid,'gawangan':src['zone_id'],'status':'candidate',
                'method':'radial_leaf_orientation','similarity':round(score,5),'pixel':[x,y],
                'species_confirmed':False,'note':''}})
            draw.ellipse((x-8,y-8,x+8,y+8),outline='#ffb000',width=2)
            draw.text((x+9,y-9),str(number),fill='#e60055',stroke_width=1,stroke_fill='white')
        preview=out/'previews'/f'{sid}.png';preview.parent.mkdir(exist_ok=True);image.save(preview)
        old=next((s['candidate_count'] for s in baseline['samples'] if s['zone_id']==src['zone_id'] and s['stratum']==src['stratum']),None)
        sample={'id':sid,'gawangan':src['zone_id'],'role':selection['role'],'stratum':src['stratum'],
                'sourceCrop':folder+'/native/'+sid+'.tif','window':[0,0,512,512],'bounds':extent,
                'preview':folder+'/previews/'+sid+'.png','features':features,'proposal_method':'radial_leaf_orientation',
                'automated_candidate_count':len(shown),'baseline_template_candidates':old,
                'automated_pixel_proposals':[{'score':round(s,5),'pixel':[x,y]} for s,x,y in proposals],
                'at_threshold_040':sum(s>=.40 for s,_,_ in proposals),'at_threshold_050':sum(s>=.50 for s,_,_ in proposals),
                'pineapple_count_validated':None}
        result['samples'].append(sample)
        provenance.append(dict(src,crop_sha256=hashlib.sha256(crop.read_bytes()).hexdigest()))
        print(json.dumps({'sample':sid,'radial_candidates':len(shown),'old_template_candidates':old,'role':selection['role']}),flush=True)
    (out/'candidate-trial.json').write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
    (out/'provenance.json').write_text(json.dumps({'dataset_id':result['dataset_id'],'sources':provenance,
                                                'config':config,'method_signature':signature,'census_changed':False}),encoding='utf-8')
    return result


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--directory',required=True);parser.add_argument('--config',required=True);parser.add_argument('--output',required=True)
    args=parser.parse_args();build(args.directory,args.config,args.output)
