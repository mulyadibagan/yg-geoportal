"""Reuse the existing matcher with explicit local visual exemplars on native samples.

Calibration examples are recorded separately; there are no species-confirmed
labels, no accuracy estimate and no extrapolation to whole-gawangan counts.
"""
import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.windows import Window
from PIL import Image, ImageDraw
from shapely.geometry import mapping, shape
from propose_dayun_candidates import propose


def trial(directory, config_path):
    root = Path(directory)
    detail = json.loads((root/'detail-analysis.json').read_text())
    config = json.loads(Path(config_path).read_text())
    if config['source_run'] != detail['source_run']:
        raise ValueError('template_source_run_mismatch')
    zones = {f['properties']['id']:shape(f['geometry']) for f in json.loads((root/'zones.geojson').read_text())['features']}
    samples = {(s['zone_id'],s['stratum']):s for s in detail['samples']}
    templates = []
    calibration = set()
    for ref in config['templates']:
        spec = samples[(ref['zone_id'], ref['stratum'])]
        calibration.add(spec['native_tile'])
        with rasterio.open(root/spec['native_tile']) as ds:
            win = Window(*spec['pixel_window'])
            rgb = np.moveaxis(ds.read([1,2,3], window=win),0,-1)
            valid = ds.read(4,window=win)>0
        x,y = ref['center']; half=ref['size']//2
        if x-half<0 or y-half<0 or x+half>=rgb.shape[1] or y+half>=rgb.shape[0] or not valid[y-half:y+half+1,x-half:x+half+1].all():
            raise ValueError('invalid_native_calibration_patch')
        templates.append(cv2.cvtColor(rgb[y-half:y+half+1,x-half:x+half+1],cv2.COLOR_RGB2GRAY))
    output = root/'detail-trial'; output.mkdir(exist_ok=True)
    features, rows = [], []
    sheets = {}
    for spec in detail['samples']:
        key = spec['zone_id']
        with rasterio.open(root/spec['native_tile']) as ds:
            win = Window(*spec['pixel_window'])
            rgb = np.moveaxis(ds.read([1,2,3],window=win),0,-1)
            valid = (ds.read(4,window=win)>0) & geometry_mask([mapping(zones[key])],rgb.shape[:2],ds.window_transform(win),invert=True)
            proposals = propose(rgb,valid,templates,threshold=.43,distance=45,limit=1000)
            sample_id = key+'-'+spec['stratum']
            image = Image.fromarray(rgb); draw = ImageDraw.Draw(image)
            for i,(score,x,y) in enumerate(proposals,1):
                lon,lat = ds.window_transform(win)*(x+.5,y+.5)
                f = {'type':'Feature','geometry':{'type':'Point','coordinates':[lon,lat]},'properties':{
                    'id':sample_id+'-'+str(i).zfill(3),'sample_id':sample_id,'zone_id':key,'similarity':round(score,5),
                    'pixel':[x,y],'status':'unvalidated_local_crown_trial','species_confirmed':False,
                    'calibration_tile':spec['native_tile'] in calibration}}
                features.append(f)
                draw.ellipse((x-9,y-9,x+9,y+9),outline='#ffb000',width=2)
                draw.text((x+10,y-9),str(i),fill='#e60055',stroke_width=1,stroke_fill='white')
            row = dict(spec,sample_id=sample_id,candidate_count=len(proposals),
                       at_threshold_050=sum(score>=.50 for score,_,_ in proposals),
                       at_threshold_060=sum(score>=.60 for score,_,_ in proposals),
                       calibration_tile=spec['native_tile'] in calibration,
                       pineapple_count_validated=None,preview=f'detail-trial/{sample_id}.jpg')
            rows.append(row)
            image.save(root/row['preview'],quality=95)
            sheets.setdefault(key,[]).append((spec['stratum'],image,len(proposals)))
        print(f'Local crown trial {sample_id}: {len(proposals)} unvalidated',flush=True)
    for key,values in sheets.items():
        sheet=Image.new('RGB',(1536,560),'white'); draw=ImageDraw.Draw(sheet)
        for i,(label,img,count) in enumerate(values):
            sheet.paste(img,(i*512,48)); draw.text((i*512+8,8),f'{key} {label}: {count} unvalidated crown proposals',fill='black')
        sheet.save(output/(key+'.jpg'),quality=95)
    result={'schema':'dayun-local-crown-trial-v1','block':detail['block'],'source_run':detail['source_run'],
            'method':'Existing grayscale crown template matcher on native 512px samples; local Blok A visual exemplars; rotations 0/90/180/270; scales .8/1/1.2; threshold .43; 45px suppression',
            'calibration':config,'samples':rows,'census_changed':False,'pineapple_count_validated':None,
            'config_sha256':hashlib.sha256(Path(config_path).read_bytes()).hexdigest(),
            'limitations':['Local visual exemplars are unconfirmed species. Matching crown shape is not pineapple identification.',
                           'Samples include calibration tiles and spatially selected vegetation strata, not independent validation ground truth.',
                           'Different sample windows can overlap. Their counts must not be summed or extrapolated to a gawangan or block.',
                           'Threshold sensitivity is shown; similarity is not a probability and does not establish precision or recall.']}
    (root/'detail-trial.json').write_text(json.dumps(result),encoding='utf-8')
    (root/'detail-trial.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features}),encoding='utf-8')
    return result


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--directory',required=True);parser.add_argument('--config',required=True)
    args=parser.parse_args();trial(args.directory,args.config)
