"""Calibrate the existing radial engine from private, positive staff examples.

Spatial holdout is never used to choose scales, suppression or threshold.
Unmarked vegetation is not a negative class; no precision/whole-block accuracy
can be inferred from a small positive-only sample of one gawangan.
"""
import hashlib,json
from pathlib import Path
import numpy as np
import cv2
from rasterio.windows import Window
from PIL import Image,ImageDraw
from propose_dayun_candidates import radial_scores,radial_propose,template_scores,propose


def split_labels(pixels,radius=72):
    order=sorted(range(len(pixels)),key=lambda i:(pixels[i][1],pixels[i][0]))
    heldout=order[-max(4,len(order)//4):]
    train=[i for i in order if i not in heldout and min(np.linalg.norm(np.subtract(pixels[i],pixels[j])) for j in heldout)>2*radius+24]
    guard=[i for i in order if i not in train and i not in heldout]
    if len(train)<10:raise ValueError('insufficient_spatially_separated_labels')
    return train,heldout,guard


def calibrate(source,review_head,analysis_path,output):
    if review_head.get('analysis_path')!=analysis_path:raise ValueError('training_review_source_mismatch')
    labels=[f for f in review_head['review']['changes'] if f['properties'].get('origin')=='manual_addition' and f['properties'].get('status')=='accepted']
    if len(labels)<20:raise ValueError('insufficient_positive_review_labels')
    pixels=[list((~source.transform)*tuple(f['geometry']['coordinates'])) for f in labels]
    train,test,guard=split_labels(pixels);out=Path(output);out.mkdir(parents=True,exist_ok=True)
    grid=[10,14,18,22,28,36,44,56,72];patches=[];profiles=[]
    for x,y in pixels:
        win=Window(int(x)-128,int(y)-128,257,257);rgb=np.moveaxis(source.read([1,2,3],window=win),0,-1);valid=source.dataset_mask(window=win)>0
        if rgb.shape!=(257,257,3) or not valid[116:141,116:141].all():raise ValueError('training_label_without_native_coverage')
        patches.append((rgb,valid));profiles.append([float(radial_scores(rgb,valid,(r,))[116:141,116:141].max()) for r in grid])
    # Scale choice and operating threshold use training positives only.
    strengths=np.median(np.array(profiles)[train],axis=0);best=int(np.argmax(strengths));radii=grid[max(0,best-1):min(len(grid),best+2)]
    near=[min(np.linalg.norm(np.subtract(pixels[i],pixels[j])) for j in train if j!=i) for i in train]
    distance=int(np.clip(np.quantile(near,.10)*.55,20,48))
    training_peaks=[float(radial_scores(*patches[i],radii)[116:141,116:141].max()) for i in train]
    threshold=round(float(np.clip(np.quantile(training_peaks,.10)-.015,.20,.60)),3)
    metrics={};previews=[]
    for name,ids in [('training',train),('spatial_holdout',test),('guard_unused',guard)]:
        new_hits=old_hits=0
        for i in ids:
            rgb,valid=patches[i];new=radial_propose(rgb,valid,threshold=threshold,distance=distance,radii=radii);old=radial_propose(rgb,valid)
            hit=lambda p:any((x-128)**2+(y-128)**2<=12**2 for _,x,y in p)
            new_hits+=hit(new);old_hits+=hit(old)
            image=Image.fromarray(rgb);d=ImageDraw.Draw(image)
            for score,x,y in new:d.ellipse((x-4,y-4,x+4,y+4),outline='#ffb000',width=1)
            d.ellipse((121,121,135,135),outline='#ee00ff',width=2)
            previews.append((i,name,image))
        metrics[name]={'positive_labels':len(ids),'baseline_matched_within_12px':old_hits,'calibrated_matched_within_12px':new_hits,'positive_label_recovery':new_hits/len(ids) if ids else None,'precision':None,'exhaustive_count_recall':None}
    model={'schema':'dayun-positive-radial-calibration-v1','source_run':review_head['review']['source_run'],'source_analysis_path':analysis_path,'review_revision':review_head['revision'],'training_review_version':review_head['version'],'label_count':len(labels),'label_gawangan':sorted({z for f in labels for z in f['properties']['zones']}),'radii_native_pixels':radii,'suppression_native_pixels':distance,'threshold':threshold,'matching_tolerance_native_pixels':12,'label_pixels':pixels,'labels':labels,'split':{'train':train,'heldout':test,'guard_unused':guard,'minimum_train_holdout_separation_px':168},'training_scale_profile':dict(zip(map(str,grid),map(float,strengths))),'metrics':metrics,'confidence':'low_positive_only_single_gawangan','validated_pineapple_total':None,'census_changed':False,'limitations':['Only owner-accepted positive points from one compact area; unmarked vegetation is not a negative class.','Spatial holdout is separated from training; recovery at known positives is not exhaustive recall or precision.','No independent labelled count exists for other gawangan; weeds, MPTS, occlusion and different plant ages can cause errors.']}
    # Learn actual small-crown exemplars from training points. Keep at most four
    # diverse prototypes; the heldout pixels never select a prototype/threshold.
    half=max(radii);patchsize=2*half+1
    gray=[cv2.cvtColor(patches[i][0],cv2.COLOR_RGB2GRAY)[128-half:129+half,128-half:129+half] for i in train]
    vectors=np.array([(g.astype('float32').ravel()-g.mean())/(g.std()+1e-6) for g in gray])
    selected=[int(np.argmin(np.mean((vectors-vectors.mean(axis=0))**2,axis=1)))]
    while len(selected)<min(4,len(train)):
        nearest=np.min(np.array([np.mean((vectors-vectors[j])**2,axis=1) for j in selected]),axis=0)
        nearest[selected]=-1;selected.append(int(np.argmax(nearest)))
    templates=[gray[j] for j in selected];prototype_indices=[train[j] for j in selected]
    peaks=[]
    for i in train:
        other=[t for t,j in zip(templates,prototype_indices) if j!=i]
        peaks.append(float(template_scores(*patches[i],other)[116:141,116:141].max()))
    threshold=round(float(np.clip(np.quantile(peaks,.10)-.015,.40,.80)),3)
    model.update(schema='dayun-positive-template-calibration-v1',method='existing_native_grayscale_template_matcher_with_owner_prototypes',threshold=threshold,
                 template_size_native_pixels=patchsize,templates_gray=[t.tolist() for t in templates],prototype_label_indices=prototype_indices,
                 radial_scale_trial=model['metrics'],training_positive_peak_scores=peaks)
    metrics={};previews=[]
    for name,ids in [('training',train),('spatial_holdout',test),('guard_unused',guard)]:
        hits=oldhits=0
        for i in ids:
            rgb,valid=patches[i];evaluation_templates=[t for t,j in zip(templates,prototype_indices) if j!=i] if name=='training' else templates
            proposals=propose(rgb,valid,evaluation_templates,threshold=threshold,distance=distance,limit=1000)
            hit=lambda p:any((x-128)**2+(y-128)**2<=12**2 for _,x,y in p)
            hits+=hit(proposals);oldhits+=hit(radial_propose(rgb,valid))
            image=Image.fromarray(rgb);d=ImageDraw.Draw(image)
            for score,x,y in proposals:d.ellipse((x-5,y-5,x+5,y+5),outline='#ffb000',width=2)
            d.ellipse((121,121,135,135),outline='#ee00ff',width=2);previews.append((i,name,image))
        metrics[name]={'positive_labels':len(ids),'baseline_matched_within_12px':oldhits,'calibrated_matched_within_12px':hits,'positive_label_recovery':hits/len(ids) if ids else None,'precision':None,'exhaustive_count_recall':None,'own_prototype_excluded':name=='training'}
    model['template_trial']=metrics
    # The copied exemplars are diagnostic only. Use the orientation engine with
    # learned native scale and a broad positive-centre brightness guard. This
    # guard alone never makes a pixel a pineapple.
    lightness=[float(cv2.GaussianBlur(cv2.cvtColor(patches[i][0],cv2.COLOR_RGB2GRAY).astype('float32'),(9,9),0)[128,128]) for i in train]
    floor=round(max(0,float(np.quantile(lightness,.05))-15),2)
    distance=int(np.clip(np.quantile(near,.10)*.40,20,40))
    threshold=round(float(np.clip(np.quantile(training_peaks,.10)-.015,.15,.60)),3)
    model.update(schema='dayun-positive-radial-calibration-v1',method='native_radial_orientation_owner_calibrated_scale_and_centre_guard',threshold=threshold,suppression_native_pixels=distance,center_luma_min=floor)
    metrics={};previews=[]
    for name,ids in [('training',train),('spatial_holdout',test),('guard_unused',guard)]:
        hits=oldhits=0
        for i in ids:
            rgb,valid=patches[i];proposals=radial_propose(rgb,valid,threshold=threshold,distance=distance,radii=radii,center_luma_min=floor)
            hit=lambda p:any((x-128)**2+(y-128)**2<=12**2 for _,x,y in p)
            hits+=hit(proposals);oldhits+=hit(radial_propose(rgb,valid));image=Image.fromarray(rgb);d=ImageDraw.Draw(image)
            for score,x,y in proposals:d.ellipse((x-5,y-5,x+5,y+5),outline='#ffb000',width=2)
            d.ellipse((121,121,135,135),outline='#ee00ff',width=2);previews.append((i,name,image))
        metrics[name]={'positive_labels':len(ids),'baseline_matched_within_12px':oldhits,'calibrated_matched_within_12px':hits,'positive_label_recovery':hits/len(ids) if ids else None,'precision':None,'exhaustive_count_recall':None}
    model['metrics']=metrics
    model['model_signature']=hashlib.sha256(json.dumps(model,sort_keys=True).encode()).hexdigest()
    (out/'calibration.json').write_text(json.dumps(model,ensure_ascii=False),encoding='utf-8')
    sheet=Image.new('RGB',(6*257,5*281),'white');draw=ImageDraw.Draw(sheet)
    for i,name,im in previews:sheet.paste(im,((i%6)*257,(i//6)*281));draw.text(((i%6)*257+4,(i//6)*281+260),f'{i+1}: {name}',fill='black')
    sheet.save(out/'calibration-label-preview.png')
    print(json.dumps({k:model[k] for k in ['label_count','radii_native_pixels','suppression_native_pixels','threshold','metrics']}),flush=True)
    return model
