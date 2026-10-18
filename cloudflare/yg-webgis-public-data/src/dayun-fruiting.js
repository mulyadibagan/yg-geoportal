// Independent phenology review. This module never writes plant corrections or census.
import {booleanPointInPolygon} from '@turf/turf';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
const statuses=['pending','confirmed','rejected','unclear'];
const safePath=p=>typeof p==='string'&&/^[\w./-]+$/.test(p)&&!p.split('/').some(s=>!s||s==='.'||s==='..');
const inside=(c,b)=>Array.isArray(b)&&c[0]>=b[0]&&c[0]<=b[2]&&c[1]>=b[1]&&c[1]<=b[3];
const membership=(f,zones)=>[...new Set(zones.features.filter(z=>booleanPointInPolygon(f,z)).map(z=>z.properties.id))];
export function fruitingFeatures(proposals,head,zones){
  const changes=new Map((head?.changes||[]).map(f=>[f.properties.id,f]));
  const features=new Map(proposals.features.map(f=>[f.properties.id,f]));
  for(const [id,f]of changes)features.set(id,f);
  return [...features.values()].map(f=>({...f,properties:{...f.properties,status:changes.get(f.properties.id)?.properties.status||'pending',zones:membership(f,zones)}}));
}
export function fruitingSummary(features,zones){
  const rows=new Map(zones.features.map(z=>[z.properties.id,{zone_id:z.properties.id,pending:0,confirmed:0,rejected:0,unclear:0}]));
  rows.set('UNASSIGNED',{zone_id:'UNASSIGNED',pending:0,confirmed:0,rejected:0,unclear:0});
  for(const f of features)for(const id of f.properties.zones.length?f.properties.zones:['UNASSIGNED'])if(rows.has(id))rows.get(id)[f.properties.status]++;
  return [...rows.values()];
}
export async function fruitingOperation(env,body){
  if(body.label!=='Agro_ABC'||!['A','B','C'].includes(body.block))fail('invalid_fruiting_source');
  const read=async key=>{const o=await env.PUBLIC_SNAPSHOTS.get(key);return o?JSON.parse(await o.text()):null};
  const manifest=await read('drone/analysis/dayun/results/Agro_ABC/index.json');
  const path=manifest?.block_fruiting?.[body.block],analysisPath=manifest?.block_analyses?.[body.block];
  if(!manifest||!safePath(path)||!safePath(analysisPath)||!manifest.files?.includes(path)||!manifest.files.includes(analysisPath)||!/^drone\/analysis\/dayun\/results\/Agro_ABC\/[\w-]+$/.test(manifest.prefix)||!/^[\w-]+$/.test(manifest.run))fail('fruiting_unavailable',404);
  const zonePath=analysisPath.slice(0,analysisPath.lastIndexOf('/')+1)+'zones.geojson';
  if(!manifest.files.includes(zonePath))fail('fruiting_zones_unavailable',404);
  const [proposals,analysis,zones]=await Promise.all([read(manifest.prefix+'/'+path),read(manifest.prefix+'/'+analysisPath),read(manifest.prefix+'/'+zonePath)]);
  if(proposals?.schema!=='dayun-fruiting-shortlist-v1'||proposals.source_run!==manifest.run||proposals.block!==body.block||!Array.isArray(proposals.features)||proposals.features.length>10000||analysis?.source_run!==manifest.run||analysis.block!==body.block||!zones?.features)fail('fruiting_source_mismatch',409);
  const anchor=manifest.block_review_bases?.[body.block]||analysisPath;
  if(!safePath(anchor)||!manifest.files.includes(anchor))fail('invalid_review_base',409);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(anchor))),b=>b.toString(16).padStart(2,'0')).join('');
  const plantHead=await read(`drone/analysis/dayun/block-reviews/Agro_ABC/${manifest.run}/${hash}/head.json`);
  const plantChanges=new Map((plantHead?.review?.changes||[]).map(f=>[f.properties.id,f]));
  const root=`drone/analysis/dayun/fruit-reviews/Agro_ABC/${manifest.run}/${body.block}`;
  let head=await read(root+'/head.json')||{revision:0,changes:[],point_versions:{},point_operations:{}};
  if(head.source_run&&head.source_run!==manifest.run)fail('fruiting_source_mismatch',409);
  const response=()=>{
    const all=fruitingFeatures(proposals,head,zones);
    const features=all.filter(f=>plantChanges.get(f.properties.id)?.properties.status!=='rejected').map(f=>{
      const moved=plantChanges.has(f.properties.id)?{...f,geometry:plantChanges.get(f.properties.id).geometry}:f;
      return{...moved,properties:{...moved.properties,zones:membership(moved,zones)}};
    });
    return{...head,ok:true,schema:'dayun-fruiting-review-v1',source_run:manifest.run,block:body.block,proposal_path:path,features,rows:fruitingSummary(features,zones),suppressed_by_plant_rejection:all.length-features.length,census_changed:false,plant_corrections_changed:false};
  };
  if(body.action==='load')return response();
  if(body.action!=='save')fail('invalid_fruiting_action');
  const op=body.operation;
  if(body.source_run!==manifest.run||body.proposal_path!==path)fail('fruiting_source_mismatch',409);
  if(!op||typeof op.id!=='string'||!/^[\w-]{1,100}$/.test(op.id)||!Number.isSafeInteger(op.expected_version)||op.expected_version<0||typeof op.operation_id!=='string'||!/^[\w-]{8,100}$/.test(op.operation_id)||!statuses.includes(op.status)||typeof op.note!=='string'||op.note.length>1000)fail('invalid_fruiting_operation');
  if(head.point_operations[op.id]===op.operation_id)return response();
  if((head.point_versions[op.id]||0)!==op.expected_version)fail('fruiting_point_conflict_reload',409);
  const originals=new Map(proposals.features.map(f=>[f.properties.id,f])),saved=new Map(head.changes.map(f=>[f.properties.id,f]));
  const previous=saved.get(op.id)||originals.get(op.id);
  if(plantChanges.get(op.id)?.properties.status==='rejected')fail('plant_candidate_rejected_by_team',409);
  let coordinates=plantChanges.get(op.id)?.geometry.coordinates||previous?.geometry.coordinates;
  if(!previous){if(!new RegExp('^'+body.block+'-fruit-manual-[\\w-]{8,70}$').test(op.id))fail('unknown_fruiting_candidate');coordinates=op.coordinates;}
  if(!Array.isArray(coordinates)||coordinates.length!==2||!coordinates.every(Number.isFinite)||!inside(coordinates,analysis.bounds)||!analysis.native_tiles.some(t=>inside(coordinates,t.bounds)))fail('invalid_fruiting_location');
  const feature={type:'Feature',geometry:{type:'Point',coordinates},properties:{id:op.id,status:op.status,note:op.note,origin:originals.has(op.id)?'visual_shortlist':previous?.properties.origin||'manual_fruiting_review',fruiting_validated:false,confirmation_scope:op.status==='confirmed'?'staff_visual_or_field_assessment':'unconfirmed'}};
  saved.set(op.id,feature);if(saved.size>10000)fail('fruiting_review_limit');
  const revision=head.revision+1,version=root+'/versions/'+revision+'-'+crypto.randomUUID()+'.json';
  const next={schema:'dayun-fruiting-head-v1',source_run:manifest.run,block:body.block,revision,changes:[...saved.values()],point_versions:{...head.point_versions,[op.id]:(head.point_versions[op.id]||0)+1},point_operations:{...head.point_operations,[op.id]:op.operation_id},updated_at:new Date().toISOString(),previous_version:head.version||null,version,census_changed:false,plant_corrections_changed:false};
  const options={httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}};
  await env.PUBLIC_SNAPSHOTS.put(version,JSON.stringify(next),options);
  await env.PUBLIC_SNAPSHOTS.put(root+'/head.json',JSON.stringify(next),options);
  head=next;return response();
}
