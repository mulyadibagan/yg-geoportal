// Sparse, versioned staff map corrections only. No census or source-data writes.
import {booleanPointInPolygon} from '@turf/turf';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
const inside=(c,b)=>c[0]>=b[0]&&c[0]<=b[2]&&c[1]>=b[1]&&c[1]<=b[3];
function bbox(geometry){const all=[];const walk=x=>{if(typeof x[0]==='number')all.push(x);else x.forEach(walk)};walk(geometry.coordinates);return all.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);}
function locator(zones){const indexed=zones.features.map(f=>({f,b:bbox(f.geometry)}));return feature=>indexed.filter(z=>inside(feature.geometry.coordinates,z.b)&&booleanPointInPolygon(feature,z.f)).map(z=>z.f.properties.id);}

export function normalizeBlockReview(review,{manifest,path,analysis,candidates,zones}){
  if(review?.schema!=='dayun-block-corrections-v1'||review.source_run!==manifest.run||review.analysis_path!==path||review.block!=='A'||!Array.isArray(review.changes)||review.changes.length>30000)fail('block_review_source_mismatch');
  const originals=new Map(candidates.features.map(f=>[f.properties.id,f])),seen=new Set(),locate=locator(zones);
  const changes=review.changes.map(f=>{
    const p=f?.properties,c=f?.geometry?.coordinates,id=p?.id;
    if(f?.type!=='Feature'||f.geometry?.type!=='Point'||!Array.isArray(c)||c.length!==2||!c.every(Number.isFinite)||!inside(c,analysis.bounds)||!analysis.native_tiles.some(t=>inside(c,t.bounds))||typeof id!=='string'||!/^[\w-]{1,100}$/.test(id)||seen.has(id)||!['candidate','accepted','rejected'].includes(p.status)||typeof p.note!=='string'||p.note.length>1000)fail('invalid_block_review_point');
    const original=originals.get(id);if(!original&&!/^A-manual-[\w-]{8,80}$/.test(id))fail('unknown_block_candidate');seen.add(id);
    return{type:'Feature',geometry:{type:'Point',coordinates:c},properties:{id,status:p.status,note:p.note,origin:original?'automated':'manual_addition',zones:locate(f),species_confirmed:false}};
  });
  return{schema:'dayun-block-corrections-v1',source_run:manifest.run,analysis_path:path,block:'A',changes,census_changed:false};
}

export function blockReviewCounts(review,candidates,zones){
  const changed=new Map((review?.changes||[]).map(f=>[f.properties.id,f]));
  const effective=candidates.features.map(f=>changed.get(f.properties.id)||{...f,properties:{...f.properties,status:'candidate',origin:'automated'}});
  const originalIds=new Set(candidates.features.map(f=>f.properties.id));
  for(const f of changed.values())if(!originalIds.has(f.properties.id))effective.push(f);
  const counts={automatic_original:candidates.features.length,manual_additions:0,rejected:0,accepted_by_staff:0,unreviewed:0,working_total:0,unassigned:0,census_changed:false,validated_pineapple_total:null};
  const rows=new Map(zones.features.map(f=>[f.properties.id,{zone_id:f.properties.id,automatic:0,manual_additions:0,rejected:0,accepted_by_staff:0,unreviewed:0,working_total:0}]));
  rows.set('UNASSIGNED',{zone_id:'UNASSIGNED',automatic:0,manual_additions:0,rejected:0,accepted_by_staff:0,unreviewed:0,working_total:0});
  for(const f of effective){const p=f.properties,manual=p.origin==='manual_addition',rejected=p.status==='rejected',accepted=p.status==='accepted';
    if(manual)counts.manual_additions++;if(rejected)counts.rejected++;else{counts.working_total++;if(accepted)counts.accepted_by_staff++;else counts.unreviewed++;if(!p.zones?.length)counts.unassigned++;}
    for(const id of p.zones?.length?p.zones:['UNASSIGNED']){const r=rows.get(id);if(!r)continue;if(manual)r.manual_additions++;else r.automatic++;if(rejected)r.rejected++;else{r.working_total++;if(accepted)r.accepted_by_staff++;else r.unreviewed++;}}
  }
  return{...counts,zones:[...rows.values()]};
}

export async function blockReviewOperation(env,body){
  if(body.label!=='Agro_ABC'||body.block!=='A')fail('invalid_block_source');
  const read=async key=>{const object=await env.PUBLIC_SNAPSHOTS.get(key);return object?JSON.parse(await object.text()):null};
  const manifest=await read('drone/analysis/dayun/results/Agro_ABC/index.json'),path=manifest?.block_analyses?.A;
  if(!manifest||typeof path!=='string'||!manifest.files?.includes(path)||path.split('/').some(p=>!p||p==='.'||p==='..')||!manifest.prefix?.startsWith('drone/analysis/dayun/results/Agro_ABC/')||!/^[\w-]+$/.test(manifest.run))fail('block_analysis_unavailable',404);
  const folder=path.slice(0,path.lastIndexOf('/')+1);for(const file of ['zones.geojson','candidates.geojson'])if(!manifest.files.includes(folder+file))fail('block_assets_unavailable',404);
  const [analysis,candidates,zones]=await Promise.all([read(manifest.prefix+'/'+path),read(manifest.prefix+'/'+folder+'candidates.geojson'),read(manifest.prefix+'/'+folder+'zones.geojson')]);
  if(analysis?.source_run!==manifest.run||analysis.block!=='A'||!candidates?.features||!zones?.features)fail('block_analysis_source_mismatch',409);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(path));const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const root=`drone/analysis/dayun/block-reviews/Agro_ABC/${manifest.run}/${hash}`,head=await read(root+'/head.json');
  if(body.action==='load')return head||{ok:true,revision:0,review:null,counts:blockReviewCounts(null,candidates,zones),analysis_path:path};
  if(body.action!=='save')fail('invalid_block_review_action');
  if(!Number.isInteger(body.expected_revision)||body.expected_revision!==(head?.revision||0))fail('block_review_conflict_reload_before_saving',409);
  const review=normalizeBlockReview(body.review,{manifest,path,analysis,candidates,zones}),counts=blockReviewCounts(review,candidates,zones);
  const revision=(head?.revision||0)+1,version=`${root}/versions/${revision}-${crypto.randomUUID()}.json`;
  const result={ok:true,revision,review,counts,analysis_path:path,updated_at:new Date().toISOString(),previous_version:head?.version||null,version};
  const options={httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}};
  await env.PUBLIC_SNAPSHOTS.put(version,JSON.stringify(result),options);await env.PUBLIC_SNAPSHOTS.put(root+'/head.json',JSON.stringify(result),options);return result;
}
