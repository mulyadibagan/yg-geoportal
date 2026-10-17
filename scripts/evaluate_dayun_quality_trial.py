"""Replay a private native-patch trial; never publish a production plant count."""
import argparse,hashlib,json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from dayun_candidate_quality import angular_descriptor,fit_angular_guard,filter_proposals


def evaluate(dataset,output,gsd_m):
    dataset=Path(dataset);out=Path(output);out.mkdir(parents=True,exist_ok=True);data=json.loads(dataset.read_text(encoding='utf-8'));rows=data['rows'];split=data['positive_split'];descriptors={};patches={};digests={}
    radii=[10,14,18,22,28,36,44,56,72]
    for r in rows:
        path=dataset.parent/(r['id']+'.npz');digests[r['id']]=hashlib.sha256(path.read_bytes()).hexdigest()
        with np.load(path,allow_pickle=False) as p:rgb,valid=p['rgb'],p['valid']
        if rgb.shape!=(225,225,3):raise ValueError('unexpected_native_trial_patch')
        patches[r['id']]=(rgb,valid);descriptors[r['id']]=angular_descriptor(rgb,valid,radii)
    training=[descriptors[r['id']] for r in rows if r['status']=='accepted' and r['known_positive_index'] in split['train'] and r['proposal_score'] is not None]
    model=fit_angular_guard(training,source_run=data['source_run'],review_version=data['review_version'],radii=radii,gsd_m=gsd_m)
    negatives=sorted([r for r in rows if r['status']=='rejected'],key=lambda r:r['label_source_pixel'][0]);heldout_negative=negatives[:2]
    negative_train=[r for r in negatives[2:] if min(np.linalg.norm(np.subtract(r['label_source_pixel'],t['label_source_pixel'])) for t in heldout_negative)>168]
    metrics={};heldout=[]
    for name,items in [('training_positive',[r for r in rows if r['status']=='accepted' and r['known_positive_index'] in split['train']]),('spatial_holdout_positive',[r for r in rows if r['status']=='accepted' and r['known_positive_index'] in split['heldout']]),('training_rejected_centres',negative_train),('spatial_holdout_rejected_centres',heldout_negative)]:
        result={'labels':len(items),'baseline_proposed':0,'sensitive_without_angular':0,'angular_proposed':0}
        for r in items:
            score=r['proposal_score'];baseline=score is not None and score>=.393;sensitive=score is not None and score>=.25;keep=bool(filter_proposals(*patches[r['id']],[(score,112,112)],model,gsd_m)) if sensitive else False
            result['baseline_proposed']+=baseline;result['sensitive_without_angular']+=sensitive;result['angular_proposed']+=keep
            if name.startswith('spatial_holdout'):heldout.append({**r,'baseline':baseline,'angular':keep})
        metrics[name]=result
    report={'schema':'dayun-quality-trial-v1','source_run':data['source_run'],'block':'A','review_revision':data['review_revision'],'review_version':data['review_version'],'evaluation_scope':'local_crown_centre_quality_not_species_accuracy','metrics':metrics,
            'training_rule':model['threshold_rule'],'model_signature':model['signature'],'gsd_m':list(gsd_m),'production_species_validated':False,'production_candidates_replaced':False,'validated_pineapple_total':None,'global_species_precision':None,'census_changed':False,
            'preview':'quality-holdout-preview.png','limitations':['Seven positive holdout labels from one gawangan and two rejected-centre holdouts from another are too small for a whole-block accuracy claim.','Rejected locations are quality feedback, not confirmed examples of another species.','The sensitive proposal threshold and angular guard are reported separately; the recall gain must not be attributed to the angular guard alone.','No independent validation on B–F; original A–C candidate baselines and all staff correction histories remain in place.','DEF GSD differs: reuse requires explicit physical scale adjustment and independent validation.']}
    (out/'quality-trial.json').write_text(json.dumps(report,ensure_ascii=False),encoding='utf-8');(out/'angular-model.json').write_text(json.dumps(model));(out/'provenance.json').write_text(json.dumps({'dataset_sha256':hashlib.sha256(dataset.read_bytes()).hexdigest(),'native_patch_sha256':digests,'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'geometry_script_sha256':hashlib.sha256(Path(__file__).with_name('dayun_candidate_quality.py').read_bytes()).hexdigest()}))
    sheet=Image.new('RGB',(675,803),'white');pen=ImageDraw.Draw(sheet);pen.text((8,4),'UJI LOKAL A: bentuk tajuk, belum akurasi seluruh blok',fill='black');pen.text((8,18),'Biru: diusulkan baru. Merah: tidak diusulkan baru. 1=ya, 0=tidak.',fill='black')
    for i,r in enumerate(heldout):
        rgb,_=patches[r['id']];im=Image.fromarray(rgb);draw=ImageDraw.Draw(im);draw.ellipse((105,105,119,119),outline='#00d5ff' if r['angular'] else '#ff0066',width=2);x,y=(i%3)*225,32+(i//3)*257;sheet.paste(im,(x,y));pen.text((x+3,y+226),('Nanas acuan' if r['status']=='accepted' else 'Titik ditolak')+' lama:'+str(int(r['baseline']))+' baru:'+str(int(r['angular'])),fill='black')
    sheet.save(out/'quality-holdout-preview.png');(out/'quality-trial.txt').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    return report


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--dataset',required=True);p.add_argument('--output',required=True);p.add_argument('--gsd-m',required=True,nargs=2,type=float);a=p.parse_args();r=evaluate(a.dataset,a.output,a.gsd_m);print(json.dumps({'metrics':r['metrics'],'production_candidates_replaced':False,'census_changed':False}))
