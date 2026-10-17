"""Select a conservative operating point from a complete private proposal pool.

The threshold is the median training-positive peak, not a database target or a
heldout-tuned count. Preserve a sensitive diagnostic, without calling it plants.
"""
import csv,copy,hashlib,json
from pathlib import Path
import numpy as np


def select_result(directory,calibration,training_scores,baseline,output):
    root=Path(directory);out=Path(output);out.mkdir(parents=True,exist_ok=True)
    result=json.loads((root/'analysis.json').read_text());provenance=json.loads((root/'count-provenance.json').read_text())
    if result['full_block_count']['processed_tiles']!=len(result['native_tiles']) or calibration['source_run']!=result['source_run'] or provenance['model_signature']!=calibration['model_signature']:raise ValueError('incomplete_or_different_calibrated_pool')
    old_threshold=calibration['threshold'];threshold=round(float(np.median(training_scores)),3)
    model=copy.deepcopy(calibration);model.pop('model_signature',None);model.update(threshold=threshold,recovery_threshold=old_threshold,operating_point_rule='median_training_positive_peak_not_heldout_or_database_tuned',training_radial_peak_scores=training_scores)
    model.pop('templates_gray',None);model.pop('training_positive_peak_scores',None)
    pool=json.loads((root/'candidate-sensitivity.geojson').read_text())['features']
    raw=[f for f in pool if f['properties']['similarity']>=threshold and not f['properties']['excluded_by_owner_rejection']]
    kept=[f for f in raw if not f['properties'].get('represented_by_manual_point')]
    def recovery(features,indices):
        cells={};tol=12
        for f in features:
            x,y=f['properties']['source_pixel'];cells.setdefault((int(x//tol),int(y//tol)),[]).append((x+.5,y+.5))
        hits=0
        for i in indices:
            x,y=model['label_pixels'][i];cx,cy=int(x//tol),int(y//tol)
            hits+=any((x-a)**2+(y-b)**2<=tol**2 for dx in (-1,0,1) for dy in (-1,0,1) for a,b in cells.get((cx+dx,cy+dy),[]))
        return hits
    metrics={};old=baseline['features'];sensitive=[f for f in pool if f['properties']['similarity']>=old_threshold and not f['properties']['excluded_by_owner_rejection']]
    for name,key in [('training','train'),('spatial_holdout','heldout'),('guard_unused','guard_unused')]:
        ids=model['split'][key];metrics[name]={'positive_labels':len(ids),'baseline_matched_within_12px':recovery(old,ids),'calibrated_matched_within_12px':recovery(raw,ids),'sensitive_matched_within_12px':recovery(sensitive,ids),'precision':None,'exhaustive_count_recall':None}
    model['patch_trial_metrics']=model['metrics'];model['metrics']=metrics;model['evaluation_scope']='actual_whole_block_native_detections_before_manual_overlap_exclusion'
    model['model_signature']=hashlib.sha256(json.dumps(model,sort_keys=True).encode()).hexdigest()
    total=lambda t:sum(f['properties']['similarity']>=t and not f['properties']['excluded_by_owner_rejection'] and not f['properties'].get('represented_by_manual_point') for f in pool)
    zones=json.loads((root/'zones.geojson').read_text());rows=[]
    for f in zones['features']:
        row=f['properties'];key=row['id'];row.update(candidate_crowns=sum(p['properties']['zones']==[key] for p in kept),boundary_conflict_candidates=sum(key in p['properties']['zones'] and p['properties']['boundary_conflict'] for p in kept),count_status='owner_calibrated_conservative_unvalidated',candidate_sensitivity_025=sum(key in p['properties']['zones'] and p['properties']['similarity']>=.25 and not p['properties']['excluded_by_owner_rejection'] and not p['properties'].get('represented_by_manual_point') for p in pool),candidate_sensitivity_040=sum(key in p['properties']['zones'] and p['properties']['similarity']>=.40 and not p['properties']['excluded_by_owner_rejection'] and not p['properties'].get('represented_by_manual_point') for p in pool));rows.append(row)
    full=result['full_block_count'];full.update(threshold=threshold,candidate_count=len(kept),threshold_025_count=total(.25),threshold_040_count=total(.4),model_proposals_represented_by_manual=len(raw)-len(kept),sensitivity_thresholds=[{'threshold':t,'candidate_count':total(t)} for t in [round(max(.1,threshold-.05),3),threshold,round(threshold+.05,3)]],sensitive_diagnostic_threshold=old_threshold,sensitive_diagnostic_candidates=total(old_threshold))
    result.update(candidate_count=len(kept),zones=rows,boundary_conflict_candidate_count=sum(f['properties']['boundary_conflict'] for f in kept),model_calibration={k:v for k,v in model.items() if k not in ['labels','label_pixels','training_radial_peak_scores']},analysis_report='calibrated-block-report.txt',candidate_inspection='calibration-label-preview.png')
    result['analysis_findings']=[f'Kalibrasi dari {model["label_count"]} titik positif pengguna; seluruh {full["processed_tiles"]} potongan native diproses ulang.',f'Ambang utama konservatif {threshold}: {len(kept):,} kandidat otomatis. Titik manual tetap terpisah; {len(raw)-len(kept)} usulan yang cocok dengan titik manual dikeluarkan agar tidak dihitung ganda.','Ambang dipilih dari median skor titik latih. Hasil bukan jumlah nanas tervalidasi; presisi belum dapat diukur dari contoh positif satu gawangan saja.']
    report='\n'.join(result['analysis_findings'])+'\n\n'+json.dumps({'whole_block':full,'evaluation':metrics,'training_review_version':model['training_review_version']},ensure_ascii=False,indent=2)+'\n\n'+'\n'.join(model['limitations'])
    def write(n,v):(out/n).write_text(json.dumps(v,ensure_ascii=False),encoding='utf-8')
    write('analysis.json',result);write('zones.geojson',zones);write('candidates.geojson',{'type':'FeatureCollection','features':kept});write('calibration.json',model);write('count-provenance.json',{**provenance,'selection_script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'raw_pool_sha256':hashlib.sha256((root/'candidate-sensitivity.geojson').read_bytes()).hexdigest(),'selected_model_signature':model['model_signature'],'selected_threshold':threshold})
    with (out/'gawangan.csv').open('w',newline='',encoding='utf-8-sig') as f:
        writer=csv.DictWriter(f,fieldnames=sorted({k for r in rows for k in r}));writer.writeheader();writer.writerows(rows)
    (out/'calibrated-block-report.txt').write_text(report,encoding='utf-8')
    print(json.dumps({'conservative_candidates':len(kept),'threshold':threshold,'model_overlap_with_manual':len(raw)-len(kept),'metrics':metrics,'census_changed':False}),flush=True)
    return result
