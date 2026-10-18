"""Apply a frozen negative-control filter to existing native Dayun proposals.

No new candidate coordinates are invented, and no review/census data is written.
"""
import argparse,csv,hashlib,json,copy
from pathlib import Path
from collections import defaultdict
import numpy as np
from dayun_negative_filter import NativePatches,descriptor,score


def load(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def write(path,value):Path(path).write_text(json.dumps(value,ensure_ascii=False),encoding='utf-8')


def refine(directory,native,model_path,output,gsd_m):
    root=Path(directory);out=Path(output);out.mkdir(parents=True,exist_ok=True)
    analysis=load(root/'analysis.json');features=load(root/'candidates.geojson')['features'];model=load(model_path)
    if analysis['block'] not in ['A','B','C'] or analysis.get('source_label')!='Agro_ABC':raise ValueError('negative_filter_target_source_mismatch')
    if len(features)!=analysis['candidate_count']:raise ValueError('candidate_count_mismatch')
    evaluation=model.get('evaluation',{});positive=evaluation.get('1_heldout',{});negative=evaluation.get('0_heldout',{})
    if positive.get('samples',0)<7 or positive.get('retained',0)<6 or negative.get('samples',0)<600 or negative.get('retained_fraction',1)>.2:raise ValueError('negative_filter_validation_gate_failed')
    provenance={'model_sha256':hashlib.sha256(Path(model_path).read_bytes()).hexdigest(),'input_analysis_sha256':hashlib.sha256((root/'analysis.json').read_bytes()).hexdigest(),'input_candidates_sha256':hashlib.sha256((root/'candidates.geojson').read_bytes()).hexdigest(),'gsd_m':gsd_m,'descriptor_script_sha256':hashlib.sha256((Path(__file__).parent/'dayun_negative_filter.py').read_bytes()).hexdigest()}
    if (out/'refinement-provenance.json').exists() and load(out/'refinement-provenance.json')!=provenance:raise ValueError('negative_filter_resume_mismatch')
    write(out/'refinement-provenance.json',provenance);(out/'resume').mkdir(exist_ok=True)
    patches=NativePatches(native,gsd_m);grouped=defaultdict(list)
    for f in features:grouped[f['properties']['native_tile']].append(f)
    decisions={}
    for i,tile in enumerate(analysis['native_tiles'],1):
        cache=out/'resume'/(Path(tile['file']).stem+'.json')
        if cache.exists():rows=load(cache)
        else:
            rows=[]
            for f in grouped[tile['file']]:
                x,y=f['properties']['source_pixel'];values=[];unknown=False
                for scale in model.get('inference_context_scales',[1.]):
                    d=descriptor(patches.patch(x,y,scale))
                    if d is None:unknown=True
                    else:
                        values.append((float(score(d,model)),scale))
                        if values[-1][0]>=model['threshold']:break
                value,scale=max(values) if values else (None,None)
                rows.append({'id':f['properties']['id'],'keep':unknown or value is None or value>=model['threshold'],'score':value,'context_scale':scale,'context':'insufficient_context_retained' if unknown else 'native_metric_context'})
            write(cache,rows)
        decisions.update((r['id'],r) for r in rows)
        if i%10==0 or i==len(analysis['native_tiles']):print(json.dumps({'block':analysis['block'],'native_tiles_checked':i,'total_tiles':len(analysis['native_tiles']),'candidates_checked':len(decisions)}),flush=True)
    if len(decisions)!=len(features):raise ValueError('incomplete_native_refinement')
    kept=[]
    for f in features:
        decision=decisions[f['properties']['id']]
        if decision['keep']:
            f=copy.deepcopy(f);f['properties'].update(negative_comparison_score=decision['score'],negative_comparison_context=decision['context']);kept.append(f)
    zones=load(root/'zones.geojson');rows=[]
    for z in analysis['zones']:
        key=z['id'];z['candidate_crowns']=sum(f['properties']['zones']==[key] for f in kept);z['boundary_conflict_candidates']=sum(key in f['properties']['zones'] and len(f['properties']['zones'])>1 for f in kept);z['count_status']='negative_control_filtered_unvalidated';rows.append(z)
    for f in zones['features']:
        row=next(z for z in rows if z['id']==f['properties']['id']);f['properties'].update(candidate_crowns=row['candidate_crowns'],boundary_conflict_candidates=row['boundary_conflict_candidates'],count_status=row['count_status'])
    before=analysis['candidate_count'];summary={'schema':'dayun-negative-comparison-summary-v1','model_signature':model['signature'],'input_candidates':before,'retained_candidates':len(kept),'removed_proposals':before-len(kept),'unknown_context_retained':sum(r['context']=='insufficient_context_retained' for r in decisions.values()),'threshold':model['threshold'],'threshold_rule':model['threshold_rule'],'inference_context_scales':model.get('inference_context_scales',[1.]),'positive_evaluation_scope':'single_base_scale_at_known_staff_coordinates','training':model['provenance'],'evaluation':evaluation,'ABC_precision':None,'ABC_exhaustive_count_recall':None,'validated_pineapple_total':None,'census_changed':False}
    analysis.update(candidate_count=len(kept),zones=rows,boundary_conflict_candidate_count=sum(len(f['properties']['zones'])>1 for f in kept),negative_comparison=summary,previous_automatic_candidate_count=before,count_reliability='low_unvalidated_after_negative_control_filter')
    analysis['full_block_count'].update(candidate_count=len(kept),negative_comparison_applied=True,sensitivity_scope='upstream_radial_detector_before_negative_filter')
    analysis['method']+='; frozen physical-scale shape/relative-colour discriminant using owner-reported unplanted D negatives'
    analysis['analysis_findings']=[f'Penyaring pembanding tanpa nanas D–F: {before:,} usulan awal menjadi {len(kept):,} kandidat pada citra asli Blok {analysis["block"]}.','D digunakan melatih; E dan F terpisah dari pelatihan. Uji positif tetap dari satu area A; akurasi hitungan A–C belum terukur.','Titik tim tetap dimuat dari revisi privat terbaru; tidak dihapus oleh penyaring. Kandidat baru bukan sensus nanas.']
    analysis['limitations']+=['Negative controls and positive labels come from different flights; residual domain differences may affect transfer.','Only one compact positive-label area; mature, pale, occluded or differently sized pineapple may be removed. Filter scores are not probabilities.','All manual corrections remain separate. No field-validated population estimate, ABC precision or exhaustive recall is claimed.']
    write(out/'analysis.json',analysis);write(out/'candidates.geojson',{'type':'FeatureCollection','features':kept});write(out/'zones.geojson',zones);write(out/'filter-decisions.json',list(decisions.values()));write(out/'negative-comparison.json',summary)
    with (out/'gawangan.csv').open('w',encoding='utf-8',newline='') as f:
        w=csv.writer(f);w.writerow(['gawangan','kategori','kandidat_setelah_penyaring','kandidat_konflik','jumlah_nanas_tervalidasi','cakupan_valid_persen','luas_valid_ha','tanpa_data_ha'])
        for z in rows:c=z.get('coverage',{});w.writerow([z['id'],z['kind'],z['candidate_crowns'],z['boundary_conflict_candidates'],'',c.get('valid_coverage_percent'),c.get('valid_area_ha'),c.get('nodata_area_ha')])
    return analysis


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for arg in ['input','native','model','output']:p.add_argument('--'+arg,required=True)
    p.add_argument('--gsd',nargs=2,type=float,required=True)
    a=p.parse_args();refine(a.input,a.native,a.model,a.output,a.gsd)
