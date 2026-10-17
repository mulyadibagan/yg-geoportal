// Private trial labels only. No census imports or writes.
const states=new Set(['candidate','accepted','rejected']);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
function point(pixel,b){return[b[0]+(pixel[0]+.5)/512*(b[2]-b[0]),b[3]-(pixel[1]+.5)/512*(b[3]-b[1])];}
function pixel(coords,b){return[(coords[0]-b[0])/(b[2]-b[0])*512-.5,(b[3]-coords[1])/(b[3]-b[1])*512-.5];}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function normalizeReview(input,trial){
  if(input?.schema!=='dayun-candidate-corrections-v1'||input.dataset_id!==trial.dataset_id||input.source_run!==trial.source_run||!Array.isArray(input.samples)||input.samples.length!==trial.samples.length)fail('review_source_mismatch');
  const seen=new Set(),ids=new Set(),samples=[];
  for(const row of input.samples){
    const original=trial.samples.find(s=>s.id===row.id);if(!original||seen.has(row.id)||!Array.isArray(row.features)||row.features.length>1000)fail('invalid_review_sample');seen.add(row.id);
    const features=row.features.map(f=>{const p=f?.properties,c=f?.geometry?.coordinates,b=original.bounds;
      if(f?.type!=='Feature'||f.geometry?.type!=='Point'||!Array.isArray(c)||c.length!==2||!c.every(Number.isFinite)||c[0]<b[0]||c[0]>b[2]||c[1]<b[1]||c[1]>b[3]||typeof p?.id!=='string'||!/^[\w-]{1,100}$/.test(p.id)||ids.has(p.id)||p.sample_id!==row.id||!states.has(p.status)||typeof p.note!=='string'||p.note.length>1000)fail('invalid_review_point');
      ids.add(p.id);return{type:'Feature',geometry:{type:'Point',coordinates:c},properties:{id:p.id,sample_id:row.id,gawangan:original.gawangan,status:p.status,note:p.note,method:original.features.some(x=>x.properties.id===p.id)?'reviewed_visual_candidate':'manual_addition',pixel:pixel(c,b),species_confirmed:false}};
    });
    if(original.features.some(f=>!features.some(x=>x.properties.id===f.properties.id)))fail('retain_original_ids_use_rejected');
    if(row.complete===true&&features.some(f=>f.properties.status==='candidate'))fail('review_incomplete_decisions');
    samples.push({id:row.id,complete:row.complete===true,features});
  }
  return{schema:'dayun-candidate-corrections-v1',dataset_id:trial.dataset_id,source_run:trial.source_run,samples,census_changed:false,not_a_validated_plant_count:true};
}
function evaluate(proposals,accepted,threshold){
  const available=new Set(accepted.map((_,i)=>i));let tp=0,fp=0;
  for(const p of proposals.filter(p=>p.score>=threshold).sort((a,b)=>b.score-a.score)){
    const near=[...available].map(i=>[distance(p.pixel,accepted[i]),i]).sort((a,b)=>a[0]-b[0])[0];
    if(near&&near[0]<=12){tp++;available.delete(near[1]);}else fp++;
  }
  const fn=available.size;return{tp,fp,fn,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,f1:2*tp+fp+fn?2*tp/(2*tp+fp+fn):0};
}
export function feedbackModel(review,trial){
  const allCompleted=review.samples.filter(s=>s.complete).sort((a,b)=>a.id.localeCompare(b.id));
  const completed=allCompleted.filter(s=>s.features.filter(f=>f.properties.status==='accepted').length>=3);
  // One complete window trains the threshold; other windows are reported separately.
  const train=completed[0],training=train?trial.samples.find(s=>s.id===train.id):null;
  const positives=s=>s.features.filter(f=>f.properties.status==='accepted').map(f=>pixel(f.geometry.coordinates,trial.samples.find(t=>t.id===s.id).bounds));
  let threshold=trial.threshold||.3,trainingMetrics=null;
  const grid=Array.isArray(trial.threshold_grid)&&trial.threshold_grid.length<=30&&trial.threshold_grid.every(t=>Number.isFinite(t)&&t>=0&&t<=1)?trial.threshold_grid:[.3,.35,.4,.45,.5,.55,.6];
  if(train){for(const t of grid){const m=evaluate(training.automated_pixel_proposals||[],positives(train),t);if(!trainingMetrics||m.f1>=trainingMetrics.f1){threshold=t;trainingMetrics=m;}}}
  const calibrated=Boolean(train&&trainingMetrics?.tp>0);
  if(!calibrated)threshold=trial.threshold||.3;
  const samples=review.samples.map(row=>{
    const src=trial.samples.find(s=>s.id===row.id),accepted=row.features.filter(f=>f.properties.status==='accepted'),rejected=row.features.filter(f=>f.properties.status==='rejected');
    const proposals=(src.automated_pixel_proposals||[]).filter(p=>p.score>=threshold);
    const remaining=proposals.filter(p=>![...accepted,...rejected].some(f=>{const original=src.features.find(x=>x.properties.id===f.properties.id);return distance(p.pixel,pixel(f.geometry.coordinates,src.bounds))<=12||(original&&distance(p.pixel,pixel(original.geometry.coordinates,src.bounds))<=12);}));
    const features=accepted.map(f=>({...f,properties:{...f.properties,feedback_origin:'reviewer_label'}}));
    // Complete review: don't resurrect unlabelled false positives in that window.
    if(!row.complete)remaining.forEach((p,i)=>features.push({type:'Feature',geometry:{type:'Point',coordinates:point(p.pixel,src.bounds)},properties:{id:src.id+'-auto-'+i,sample_id:src.id,status:'candidate',similarity:p.score,feedback_origin:trial.method?.includes('annular')?'thresholded_radial_orientation':'thresholded_template_match'}}));
    return{id:row.id,complete:row.complete,accepted_by_reviewer:accepted.length,rejected_by_reviewer:rejected.length,automatic_count:proposals.length,feedback_candidate_count:features.length,review_corrected_count:row.complete?accepted.length:null,pineapple_count_validated:null,features};
  });
  return{schema:'dayun-feedback-model-v1',status:calibrated?'calibrated_trial_not_independently_validated':train?'insufficient_matching_proposals':'waiting_for_complete_review',threshold,matching_radius_native_pixels:12,training_sample:train?.id||null,training_metrics:trainingMetrics,
    heldout:allCompleted.filter(s=>s.id!==train?.id).map(s=>({sample:s.id,metrics:evaluate(trial.samples.find(t=>t.id===s.id).automated_pixel_proposals||[],positives(s),threshold)})),samples,
    limitation:'Threshold calibration uses stored proposals only, down to '+(trial.proposal_floor??.30)+'. Accepted additions restore missed crowns in reviewed windows; this is feedback reconciliation, not proof of generalization or independent species validation. Never extrapolate to whole gawangan or census.'};
}
export async function reviewOperation(env,body){
  if(!['Agro_ABC','Agro_DEF'].includes(body.label))fail('invalid_source');
  const read=async key=>{const o=await env.PUBLIC_SNAPSHOTS.get(key);return o?JSON.parse(await o.text()):null};
  const manifest=await read(`drone/analysis/dayun/results/${body.label}/index.json`);
  if(body.trial_id!==undefined&&(typeof body.trial_id!=='string'||!/^[\w-]{1,64}$/.test(body.trial_id)))fail('invalid_trial_selector');
  const file=body.trial_id?manifest?.candidate_trials?.[body.trial_id]:'candidate-trial.json';
  if(!manifest||!/^[\w-]+$/.test(manifest.run)||typeof file!=='string'||!manifest.files?.includes(file)||file.split('/').some(p=>!p||p==='.'||p==='..')||!manifest.prefix?.startsWith(`drone/analysis/dayun/results/${body.label}/`))fail('trial_not_available',404);
  const trial=await read(manifest.prefix+'/'+file);if(!trial||trial.source_run!==manifest.run)fail('trial_source_mismatch',409);
  if(typeof trial.dataset_id!=='string'||!trial.dataset_id||trial.dataset_id.length>300)fail('invalid_trial_identity',409);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(trial.dataset_id));
  const trialHash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const root=`drone/analysis/dayun/reviews/${body.label}/${manifest.run}/${trialHash}`,head=await read(root+'/head.json');
  if(body.action==='load')return head||{ok:true,revision:0,review:null,model:null};
  if(body.action!=='save')fail('invalid_review_action');
  if(!Number.isInteger(body.expected_revision)||body.expected_revision!==(head?.revision||0))fail('review_conflict_reload_before_saving',409);
  const review=normalizeReview(body.review,trial),model=feedbackModel(review,trial);
  const revision=(head?.revision||0)+1,version=`${root}/versions/${revision}-${crypto.randomUUID()}.json`;
  const result={ok:true,revision,updated_at:new Date().toISOString(),review,model,previous_version:head?.version||null,version};
  const options={httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}};
  await env.PUBLIC_SNAPSHOTS.put(version,JSON.stringify(result),options);
  await env.PUBLIC_SNAPSHOTS.put(root+'/head.json',JSON.stringify(result),options);
  return result;
}
