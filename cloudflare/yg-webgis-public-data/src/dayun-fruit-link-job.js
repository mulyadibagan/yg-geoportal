// One private maintenance request, executed through the existing serialized coordinator.
// No public route, new credential, census write or pineapple correction write.
export const jobRoot='drone/analysis/dayun/maintenance/fruit-links-21-20261020';
const read=async(env,key)=>{const o=await env.PUBLIC_SNAPSHOTS.get(key);return o?JSON.parse(await o.text()):null;};
export async function runFruitLinkJob(env){
  if(env.ENVIRONMENT!=='production')return;
  const plan=await read(env,jobRoot+'/request.json');if(!plan)return;
  const previous=await read(env,jobRoot+'/result.json');if(previous?.status==='complete'&&previous.source_run===plan.source_run)return previous;
  if(plan.schema!=='dayun-fruit-links-job-v1'||typeof plan.source_run!=='string'||!plan.pairs||Object.keys(plan.pairs).some(b=>!['A','B','C'].includes(b)))throw Error('invalid_private_fruit_link_job');
  const count=Object.entries(plan.pairs).reduce((n,[b,pairs])=>{if(!pairs||Array.isArray(pairs)||typeof pairs!=='object'||Object.entries(pairs).some(([id,parent])=>!new RegExp('^'+b+'-fruit-manual-[\\w-]{8,70}$').test(id)||typeof parent!=='string'||!/^[-\w]{1,100}$/.test(parent)))throw Error('invalid_private_fruit_link_pair');return n+Object.keys(pairs).length;},0);
  if(count!==21)throw Error('private_fruit_link_job_requires_21_pairs');
  const stub=env.DRONE_QUEUE.get(env.DRONE_QUEUE.idFromName('dayun-fruiting-review-Agro_ABC'));
  const call=async body=>{const r=await stub.fetch(new Request('https://queue.internal/dayun-fruiting-review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'private_fruit_link_job_failed');return d;};
  const report={schema:'dayun-fruit-links-job-result-v1',source_run:plan.source_run,requested:count,status:'complete',blocks:[],census_changed:false,plant_corrections_changed:false};
  for(const [block,pairs] of Object.entries(plan.pairs)){
    const load={label:'Agro_ABC',block,action:'load'},before=await call(load);
    if(before.source_run!==plan.source_run||before.supports_plant_links!==true)throw Error('private_fruit_link_job_source_changed');
    const raw=new Map(before.changes.map(f=>[f.properties.id,f])),features=new Map(before.features.map(f=>[f.properties.id,f])),operations=[],unresolved=[];
    for(const [id,parent] of Object.entries(pairs)){
      const old=raw.get(id),f=features.get(id);
      if(old?.properties.plant_id===parent)continue;
      if(!old||old.properties.plant_id||old.properties.status==='rejected'||f?.properties.link_state!=='linked'||f.properties.plant_id!==parent){unresolved.push(id);continue;}
      operations.push({id,plant_id:parent,link_method:'spatial_unique',status:old.properties.status,note:old.properties.note||'',expected_version:before.point_versions[id]||0,operation_id:crypto.randomUUID()});
    }
    const after=operations.length?await call({...load,action:'save',source_run:before.source_run,proposal_path:before.proposal_path,operations}):before;
    const final=new Map(after.changes.map(f=>[f.properties.id,f]));
    for(const op of operations){const a=raw.get(op.id),b=final.get(op.id);if(!b||b.properties.plant_id!==op.plant_id||JSON.stringify(a.geometry)!==JSON.stringify(b.geometry)||a.properties.status!==b.properties.status||(a.properties.note||'')!==(b.properties.note||''))throw Error('private_fruit_link_job_preservation_failed');}
    const stored=Object.entries(pairs).filter(([id,parent])=>final.get(id)?.properties.plant_id===parent).length;
    if(stored!==Object.keys(pairs).length)report.status='needs_review';
    report.blocks.push({block,revision_before:before.revision,revision_after:after.revision,requested:Object.keys(pairs).length,linked_now:operations.length,stored,unresolved,active_annotations:after.features.filter(f=>f.properties.status!=='rejected').length,point_ids_preserved:[...raw.keys()].every(id=>final.has(id)),evidence_preserved:operations.every(op=>JSON.stringify(raw.get(op.id).geometry)===JSON.stringify(final.get(op.id).geometry)),link_summary:after.link_summary});
  }
  report.completed_at=new Date().toISOString();
  await env.PUBLIC_SNAPSHOTS.put(jobRoot+'/result.json',JSON.stringify(report),{httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});
  return report;
}
