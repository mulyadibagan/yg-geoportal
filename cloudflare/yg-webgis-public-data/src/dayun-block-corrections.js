// Sparse, versioned staff map corrections only. No census or source-data writes.
import {booleanPointInPolygon} from '@turf/turf';
import progressCounts from '../../../js/dayun-progress-counts.js';
const fail=(message,status=400,details={})=>{throw Object.assign(Error(message),{status,...details})};
const reviewLimit=block=>['B','C','D','E','F'].includes(block)?60000:30000;
const inside=(c,b)=>c[0]>=b[0]&&c[0]<=b[2]&&c[1]>=b[1]&&c[1]<=b[3];
function bbox(geometry){const all=[];const walk=x=>{if(typeof x[0]==='number')all.push(x);else x.forEach(walk)};walk(geometry.coordinates);return all.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);}
function locator(zones){const indexed=zones.features.map(f=>({f,b:bbox(f.geometry)}));return feature=>indexed.filter(z=>inside(feature.geometry.coordinates,z.b)&&booleanPointInPolygon(feature,z.f)).map(z=>z.f.properties.id);}

// Derive membership from current boundaries without touching the saved revision.
export function rebaseBlockReview(review,zones){if(!review)return null;const locate=locator(zones);return{...review,changes:review.changes.map(f=>({...f,properties:{...f.properties,zones:locate(f)}}))};}

export function expandCandidateGrid(grid,analysis){
  if(grid?.schema!=='dayun-review-grid-v1'||grid.source_run!==analysis.source_run||grid.block!==analysis.block||!Array.isArray(grid.transform)||grid.transform.length<6||!grid.transform.every(Number.isFinite)||!Array.isArray(grid.zones)||grid.zones.some(z=>typeof z!=='string')||!Array.isArray(grid.points)||grid.points.length>1000000||grid.points.length!==analysis.candidate_count||!Number.isInteger(grid.width)||!Number.isInteger(grid.height)||grid.width<1||grid.height<1)fail('invalid_candidate_review_grid',409);
  const [a,b,c,d,e,f]=grid.transform;if(!(a>0&&e<0&&b===0&&d===0))fail('invalid_candidate_review_grid',409);
  const ids=new Set(),features=grid.points.map(row=>{
    if(!Array.isArray(row)||row.length!==3||!Number.isInteger(row[0])||!Number.isInteger(row[1])||row[0]<0||row[1]<0||row[0]>=grid.width||row[1]>=grid.height||!Array.isArray(row[2])||!row[2].length||row[2].some(i=>!Number.isInteger(i)||i<0||i>=grid.zones.length))fail('invalid_candidate_review_grid',409);
    const [x,y,indices]=row,id=`${analysis.block}-radial-x${x}-y${y}`;if(ids.has(id))fail('invalid_candidate_review_grid',409);ids.add(id);
    return{type:'Feature',geometry:{type:'Point',coordinates:[a*(x+.5)+c,e*(y+.5)+f]},properties:{id,zones:indices.map(i=>grid.zones[i]),status:'candidate'}};
  });return{type:'FeatureCollection',features};
}

export function normalizeBlockReview(review,{manifest,path,analysis,candidates,zones}){
  const block=analysis.block;if(!['A','B','C','D','E','F'].includes(block))fail('invalid_block_source');
  if(review?.schema!=='dayun-block-corrections-v1'||review.source_run!==manifest.run||review.analysis_path!==path||review.block!==block||!Array.isArray(review.changes)||review.changes.length>reviewLimit(block))fail('block_review_source_mismatch');
  const originals=candidates.byId||new Map(candidates.features.map(f=>[f.properties.id,f])),seen=new Set(),locate=locator(zones);
  const changes=review.changes.map(f=>{
    const p=f?.properties,c=f?.geometry?.coordinates,id=p?.id,note=p?.note===undefined?'':p.note;
    if(f?.type!=='Feature'||f.geometry?.type!=='Point'||!Array.isArray(c)||c.length!==2||!c.every(Number.isFinite)||!inside(c,analysis.bounds)||!analysis.native_tiles.some(t=>inside(c,t.bounds))||typeof id!=='string'||!/^[\w-]{1,100}$/.test(id)||seen.has(id)||!['candidate','accepted','rejected'].includes(p.status)||typeof note!=='string'||note.length>1000)fail('invalid_block_review_point');
    const original=originals.get(id);if(!original&&!new RegExp('^'+block+'-manual-[\\w-]{8,80}$').test(id))fail('unknown_block_candidate');seen.add(id);
    const suppliedReason=p.rejection_reason??'unspecified';if(!['unspecified','not_pineapple','duplicate','misplaced','unclear'].includes(suppliedReason))fail('invalid_rejection_reason');const reason=p.status==='rejected'?suppliedReason:'unspecified';
    return{type:'Feature',geometry:{type:'Point',coordinates:c},properties:{id,status:p.status,note,origin:original?'automated':'manual_addition',zones:locate(f),species_confirmed:false,rejection_reason:reason}};
  });
  return{schema:'dayun-block-corrections-v1',source_run:manifest.run,analysis_path:path,block,changes,census_changed:false};
}

export function blockReviewCounts(review,candidates,zones){
  const changed=new Map((review?.changes||[]).map(f=>[f.properties.id,f]));
  const effective=candidates.features.map(f=>changed.get(f.properties.id)||f);
  const originalIds=new Set(candidates.features.map(f=>f.properties.id));
  for(const f of changed.values())if(!originalIds.has(f.properties.id))effective.push(f);
  const counts={automatic_original:candidates.features.length,manual_additions:0,rejected:0,accepted_by_staff:0,unreviewed:0,working_total:0,unassigned:0,census_changed:false,validated_pineapple_total:null};
  const rows=new Map(zones.features.map(f=>[f.properties.id,{zone_id:f.properties.id,automatic:0,manual_additions:0,rejected:0,accepted_by_staff:0,unreviewed:0,working_total:0}]));
  rows.set('UNASSIGNED',{zone_id:'UNASSIGNED',automatic:0,manual_additions:0,rejected:0,accepted_by_staff:0,unreviewed:0,working_total:0});
  for(const f of effective){const p=f.properties,edited=changed.has(p.id),manual=edited&&p.origin==='manual_addition',rejected=edited&&p.status==='rejected',accepted=edited&&p.status==='accepted';
    if(manual)counts.manual_additions++;if(rejected)counts.rejected++;else{counts.working_total++;if(accepted)counts.accepted_by_staff++;else counts.unreviewed++;if(!p.zones?.length)counts.unassigned++;}
    for(const id of p.zones?.length?p.zones:['UNASSIGNED']){const r=rows.get(id);if(!r)continue;if(manual)r.manual_additions++;else r.automatic++;if(rejected)r.rejected++;else{r.working_total++;if(accepted)r.accepted_by_staff++;else r.unreviewed++;}}
  }
  const training={positive:0,negative:0,rejected_without_species_label:0};for(const f of changed.values()){const p=f.properties;if(p.status==='accepted')training.positive++;else if(p.status==='rejected'){if(p.rejection_reason==='not_pineapple')training.negative++;else training.rejected_without_species_label++;}}
  return{...counts,training_examples:training,zones:[...rows.values()],progress:progressCounts.compute(candidates.features,effective,[...rows.keys()])};
}

// Legacy heads are upgraded in memory. Never rewrite stored user revisions on read.
export function collaborativeHead(head,empty){const value=head||empty;return{...value,collaboration:'per-point-v1',point_versions:value.point_versions||Object.fromEntries((value.review?.changes||[]).map(f=>[f.properties.id,value.revision])),point_operations:value.point_operations||{}};}

export function mergePointPatch(head,patch,context){
  const block=context.analysis.block;
  if(patch?.schema!=='dayun-block-point-patch-v1'||patch.source_run!==context.manifest.run||patch.analysis_path!==context.path||patch.block!==block||!Array.isArray(patch.operations)||!patch.operations.length||patch.operations.length>1000)fail('invalid_block_point_patch');
  const versions={...head.point_versions},operations={...head.point_operations},features=new Map((head.review?.changes||[]).map(f=>[f.properties.id,f])),seen=new Set(),conflicts=[];
  const incoming=patch.operations.map(op=>{
    if(!op||typeof op.id!=='string'||!/^[\w-]{1,100}$/.test(op.id)||seen.has(op.id)||!Number.isSafeInteger(op.expected_version)||op.expected_version<0||typeof op.operation_id!=='string'||!/^[\w-]{8,100}$/.test(op.operation_id))fail('invalid_block_point_operation');seen.add(op.id);
    if(op.feature===null){if(!new RegExp('^'+block+'-manual-[\\w-]{8,80}$').test(op.id))fail('only_manual_points_can_be_deleted');}
    else if(op.feature?.properties?.id!==op.id)fail('block_point_identity_mismatch');
    const feature=op.feature===null?null:normalizeBlockReview({schema:'dayun-block-corrections-v1',source_run:patch.source_run,analysis_path:patch.analysis_path,block,changes:[op.feature]},context).changes[0];
    const duplicate=operations[op.id]===op.operation_id;
    if(!duplicate&&op.expected_version!==(versions[op.id]||0))conflicts.push({id:op.id,current_version:versions[op.id]||0});
    if(!duplicate&&feature===null&&!features.has(op.id)&&!(versions[op.id]>0))fail('manual_point_not_found');
    return{...op,feature,duplicate};
  });
  if(conflicts.length)fail('block_points_conflict',409,{conflicts});
  let applied=0;for(const op of incoming){if(op.duplicate)continue;if(op.feature===null)features.delete(op.id);else features.set(op.id,op.feature);versions[op.id]=(versions[op.id]||0)+1;operations[op.id]=op.operation_id;applied++;}
  if(features.size>reviewLimit(block))fail('block_review_too_many_points');
  return{review:{schema:'dayun-block-corrections-v1',source_run:context.manifest.run,analysis_path:context.path,block,changes:[...features.values()],census_changed:false},point_versions:versions,point_operations:operations,applied};
}

export async function blockReviewOperation(env,body){
  if(!({Agro_ABC:['A','B','C'],Agro_DEF:['D','E','F']}[body.label]?.includes(body.block)))fail('invalid_block_source');
  const block=body.block;
  const read=async key=>{const object=await env.PUBLIC_SNAPSHOTS.get(key);return object?JSON.parse(await object.text()):null};
  const manifest=await read('drone/analysis/dayun/results/'+body.label+'/index.json'),path=manifest?.block_analyses?.[block];
  if(!manifest||typeof path!=='string'||!manifest.files?.includes(path)||path.split('/').some(p=>!p||p==='.'||p==='..')||!manifest.prefix?.startsWith('drone/analysis/dayun/results/'+body.label+'/')||!/^[\w-]+$/.test(manifest.run))fail('block_analysis_unavailable',404);
  const folder=path.slice(0,path.lastIndexOf('/')+1);for(const file of ['zones.geojson','candidates.geojson'])if(!manifest.files.includes(folder+file))fail('block_assets_unavailable',404);
  const analysis=await read(manifest.prefix+'/'+path);
  const readCandidates=async(a,dir)=>{if(a?.review_index){const file=dir+a.review_index;if(!/^[\w-]+\.json$/.test(a.review_index)||!manifest.files.includes(file))fail('invalid_candidate_review_grid',409);return expandCandidateGrid(await read(manifest.prefix+'/'+file),a);}return read(manifest.prefix+'/'+dir+'candidates.geojson');};
  const [candidates,zones]=await Promise.all([readCandidates(analysis,folder),read(manifest.prefix+'/'+folder+'zones.geojson')]);
  if(analysis?.source_run!==manifest.run||analysis.block!==block||!candidates?.features||!zones?.features)fail('block_analysis_source_mismatch',409);
  // A calibrated baseline keeps the existing private correction history. Reads
  // adapt its presentation/counts without rewriting any stored user revision.
  const anchor=manifest.block_review_bases?.[block]||path;let knownCandidates=candidates;
  if(anchor!==path&&(typeof anchor!=='string'||!manifest.files.includes(anchor)||anchor.split('/').some(p=>!p||p==='.'||p==='..')))fail('invalid_review_base');
  if(body.action==='save'&&anchor!==path){if(typeof anchor!=='string'||!manifest.files.includes(anchor)||anchor.split('/').some(p=>!p||p==='.'||p==='..'))fail('invalid_review_base');const previousFolder=anchor.slice(0,anchor.lastIndexOf('/')+1);if(!manifest.files.includes(previousFolder+'candidates.geojson'))fail('invalid_review_base');const previous=await read(manifest.prefix+'/'+anchor),original=await readCandidates(previous,previousFolder);if(previous?.source_run!==manifest.run||previous.block!==block||!original?.features)fail('review_base_source_mismatch',409);knownCandidates={type:'FeatureCollection',features:[...new Map([...original.features,...candidates.features].map(f=>[f.properties.id,f])).values()]};}
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(anchor));const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const root=`drone/analysis/dayun/block-reviews/${body.label}/${manifest.run}/${hash}`,stored=await read(root+'/head.json');
  if(stored?.review){if(stored.review.source_run!==manifest.run||stored.review.block!==block)fail('review_base_source_mismatch',409);knownCandidates={type:'FeatureCollection',features:[...new Map([...knownCandidates.features,...stored.review.changes.filter(f=>f.properties.origin==='automated')].map(f=>[f.properties.id,f])).values()]};}
  const raw=collaborativeHead(stored,{ok:true,revision:0,review:null,counts:blockReviewCounts(null,candidates,zones),analysis_path:path});
  const currentReview=analysis.boundary_revision?rebaseBlockReview(raw.review,zones):raw.review;
  const head={...raw,source_run:manifest.run,block,feedback_schema:'dayun-rejection-reason-v1',analysis_path:path,review:currentReview?{...currentReview,analysis_path:path}:null,counts:blockReviewCounts(currentReview,candidates,zones),review_base_analysis_path:anchor};
  if(body.action==='load')return head;
  if(body.action!=='save')fail('invalid_block_review_action');
  knownCandidates.byId=new Map(knownCandidates.features.map(f=>[f.properties.id,f]));
  const context={manifest,path,analysis,candidates:knownCandidates,zones};let merged;
  if(body.patch){merged=mergePointPatch(head,body.patch,context);if(!merged.applied)return head;}
  else{
    if(!Number.isInteger(body.expected_revision)||body.expected_revision!==head.revision)fail('block_review_conflict_reload_before_saving',409);
    const review=normalizeBlockReview(body.review,context),before=new Map((head.review?.changes||[]).map(f=>[f.properties.id,f])),after=new Map(review.changes.map(f=>[f.properties.id,f]));
    const point_versions={...head.point_versions},point_operations={...head.point_operations};for(const id of new Set([...before.keys(),...after.keys()])){if(JSON.stringify(before.get(id))!==JSON.stringify(after.get(id))){point_versions[id]=(point_versions[id]||0)+1;point_operations[id]='legacy-'+crypto.randomUUID();}}
    merged={review,point_versions,point_operations};
  }
  const {review,point_versions,point_operations}=merged,counts=blockReviewCounts(review,candidates,zones);
  const revision=(head?.revision||0)+1,version=`${root}/versions/${revision}-${crypto.randomUUID()}.json`;
  const result={ok:true,revision,review,counts,analysis_path:path,review_base_analysis_path:anchor,collaboration:'per-point-v1',feedback_schema:'dayun-rejection-reason-v1',point_versions,point_operations,updated_at:new Date().toISOString(),previous_version:head?.version||null,version};
  const options={httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}};
  await env.PUBLIC_SNAPSHOTS.put(version,JSON.stringify(result),options);await env.PUBLIC_SNAPSHOTS.put(root+'/head.json',JSON.stringify(result),options);return{...result,source_run:manifest.run,block};
}
