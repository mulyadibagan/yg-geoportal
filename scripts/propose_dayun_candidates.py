"""Small native-RGB template trial. Scores are similarities, never probabilities."""
import argparse,csv,json
from pathlib import Path
import cv2
import numpy as np
import rasterio
from rasterio.windows import Window,bounds
from PIL import Image,ImageDraw

def suppress(points,distance=28,limit=60):
    kept=[]
    for score,x,y in sorted(points,reverse=True):
        if all((x-a[1])**2+(y-a[2])**2>=distance**2 for a in kept):
            kept.append((score,x,y))
            if len(kept)>=limit:break
    return kept

def propose(rgb,valid,templates,threshold=.43,distance=28,limit=60):
    gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY);scores=np.full(gray.shape,-1,dtype=np.float32)
    for template in templates:
        for scale in [.8,1.,1.2]:
            size=max(9,int(template.shape[0]*scale));size+=1-size%2
            patch=cv2.resize(template,(size,size))
            for turn in range(4):
                rotated=np.ascontiguousarray(np.rot90(patch,turn))
                if np.std(rotated)<3:continue
                result=cv2.matchTemplate(gray,rotated,cv2.TM_CCOEFF_NORMED)
                half=size//2
                full=cv2.erode(valid.astype('uint8'),np.ones((size,size),'uint8'),borderType=cv2.BORDER_CONSTANT,borderValue=0)
                target=scores[half:half+result.shape[0],half:half+result.shape[1]]
                np.maximum(target,np.where(full[half:half+result.shape[0],half:half+result.shape[1]]>0,result,-1),out=target)
    local=cv2.dilate(scores,np.ones((9,9),np.uint8));ys,xs=np.where((scores>=threshold)&(scores==local))
    return suppress([(float(scores[y,x]),int(x),int(y)) for y,x in zip(ys,xs)],distance=distance,limit=limit)

def run(config,output):
    config=json.loads(Path(config).read_text());output=Path(output);output.mkdir(parents=True,exist_ok=True)
    loaded={}
    for spec in config['samples']:
        with rasterio.open(spec['local_tif']) as ds:
            if ds.crs.to_epsg()!=4326:raise ValueError('trial_requires_epsg4326')
            win=Window(*spec['window']);data=ds.read(window=win)
            if data.shape[1:]!=(512,512) or data.shape[0]!=4:raise ValueError('expected_native_512_rgba')
            loaded[spec['id']]=(spec,np.moveaxis(data[:3],0,-1),data[3]>0,ds.transform,bounds(win,ds.transform))
    templates=[]
    for ref in config['templates']:
        _,rgb,valid,_,_=loaded[ref['sample']];x,y=ref['center'];half=ref['size']//2
        patch=rgb[y-half:y+half+1,x-half:x+half+1]
        if patch.shape[:2]!=(2*half+1,2*half+1) or not valid[y-half:y+half+1,x-half:x+half+1].all():raise ValueError('invalid_template')
        templates.append(cv2.cvtColor(patch,cv2.COLOR_RGB2GRAY))
    trial={'schema':'dayun-candidate-trial-v1','dataset_id':config['dataset_id'],'source_run':config['source_run'],'label':config['label'],
      'method':'native grayscale normalized template matching; three visual crown exemplars, four rotations, scales 0.8/1/1.2, local maxima and 28px suppression',
      'threshold':config.get('threshold',.43),'score_note':'Similarity score, not pineapple probability. Template source C is calibration, A is an unlabelled transfer trial. No independent species/count ground truth.',
      'limitation':'Visible radial crown candidates only. Weeds, litter, overlap and cut crowns cause false positives/negatives. No whole-gawangan extrapolation. Counts do not change census.',
      'samples':[]}
    features=[];rows=[]
    for sid,(spec,rgb,valid,transform,extent) in loaded.items():
        automatic=propose(rgb,valid,templates,trial['threshold'])
        visual=spec.get('visual_centers')
        proposals=[(None,int(x),int(y)) for x,y in visual] if visual is not None else automatic
        sample={k:spec[k] for k in ['id','gawangan','sourceCrop','window']}
        sample['automated_candidate_count']=len(automatic)
        sample['automated_pixel_proposals']=[{'score':round(s,5),'pixel':[x,y]} for s,x,y in automatic]
        sample['proposal_method']='visual_radial_crown_screening' if visual is not None else 'template_matching_trial'
        sample['bounds']=list(extent);sample['features']=[];sample['preview']='candidate-trial/previews/'+sid+'.png'
        image=Image.fromarray(rgb);draw=ImageDraw.Draw(image)
        for i,(score,x,y) in enumerate(proposals,1):
            lon,lat=transform*(spec['window'][0]+x+.5,spec['window'][1]+y+.5)
            if not(0<=x<512 and 0<=y<512 and valid[y,x]):raise ValueError('candidate_outside_valid_mask')
            feature={'type':'Feature','geometry':{'type':'Point','coordinates':[lon,lat]},'properties':{'id':sid+'-'+str(i).zfill(3),'sample_id':sid,'gawangan':spec['gawangan'],'status':'candidate','similarity':round(score,5) if score is not None else None,'pixel':[x,y],'method':sample['proposal_method'],'species_confirmed':False,'note':''}}
            sample['features'].append(feature);features.append(feature)
            draw.ellipse((x-9,y-9,x+9,y+9),outline='#ffb000',width=2);draw.text((x+10,y-9),str(i),fill='#f00055',stroke_width=1,stroke_fill='white')
        preview=output/sample['preview'];preview.parent.mkdir(parents=True,exist_ok=True);image.save(preview)
        trial['samples'].append(sample);rows.append({'sample':sid,'gawangan':spec['gawangan'],'candidate_count':len(proposals),'proposal_method':sample['proposal_method'],'automated_candidates':len(automatic),'accepted_count':0,'pineapple_count_validated':'','scope':'512x512 native pixels only'})
    (output/'candidate-trial.json').write_text(json.dumps(trial,indent=2),encoding='utf-8')
    (output/'candidate-trial.geojson').write_text(json.dumps({'type':'FeatureCollection','dataset_id':trial['dataset_id'],'features':features}),encoding='utf-8')
    with (output/'candidate-trial.csv').open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    print(json.dumps(rows))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--config',required=True);parser.add_argument('--output',required=True);args=parser.parse_args();run(args.config,args.output)
