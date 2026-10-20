// Independent phenology review. This module never writes plant corrections or census.
import {booleanPointInPolygon} from '@turf/turf';
import {expandCandidateGrid} from './dayun-block-corrections.js';
import {plantIndex,linkedFruitFeatures,distance} from './dayun-fruit-links.js';
const fail=(message,status=400,details={})=>{throw Object.assign(Error(message),{status,...details})};
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
  for(const f of features)for(const id of f.properties.zones.length?f.properties.zones:['UNASSIGNED'])if(rows.has(id)&&f.properties.counted!==false)rows.get(id)[f.properties.status]++;
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
  const folder=analysisPath.slice(0,analysisPath.lastIndexOf('/')+1),candidateFile=folder+(analysis.review_index||'candidates.geojson');
  if(!manifest.files.includes(candidateFile)||analysis.review_index&&!/^[\w-]+\.json$/.test(analysis.review_index))fail('fruiting_plants_unavailable',409);
  const rawCandidates=await read(manifest.prefix+'/'+candidateFile);
  const candidates=analysis.review_index?expandCandidateGrid(rawCandidates,analysis):rawCandidates;
  if(!Array.isArray(candidates?.features))fail('fruiting_plants_unavailable',409);
  const effectivePlants=new Map(candidates.features.map(f=>[f.properties.id,f]));for(const [id,f]of plantChanges)effectivePlants.set(id,f);
  const plants=plantIndex([...effectivePlants.values()]);
  const root=`drone/analysis/dayun/fruit-reviews/Agro_ABC/${manifest.run}/${body.block}`;
  let head=await read(root+'/head.json')||{revision:0,changes:[],point_versions:{},point_operations:{}};
  if(head.source_run&&head.source_run!==manifest.run)fail('fruiting_source_mismatch',409);
  // Fruit work is manual only. Immutable detector shortlists stay as historical
  // evidence, but must never become visible/countable again after a new run.
  const manual=f=>f.properties.origin==='manual_fruiting_review'&&new RegExp('^'+body.block+'-fruit-manual-[\\w-]{8,70}$').test(f.properties.id);
  const response=()=>{
    const all=fruitingFeatures({features:[]},head,zones).filter(manual);
    const features=linkedFruitFeatures(all,plants).map(f=>f.properties.link_state==='linked'?{...f,properties:{...f.properties,fruit_zones:f.properties.zones,zones:membership(plants.byId.get(f.properties.plant_id),zones)}}:f);
    const link_summary={linked:0,needs_link:0,plant_unavailable:0,duplicates:0};
    for(const f of features)if(f.properties.status!=='rejected'){link_summary[f.properties.link_state]++;if(f.properties.duplicate_of)link_summary.duplicates++;}
    return{...head,ok:true,schema:'dayun-fruiting-review-v1',manual_only:true,supports_batch:true,supports_plant_links:true,link_summary,source_run:manifest.run,block:body.block,proposal_path:path,features,rows:fruitingSummary(features,zones),suppressed_by_plant_rejection:0,census_changed:false,plant_corrections_changed:false};
  };
  if(body.action==='load')return response();
  if(body.action!=='save')fail('invalid_fruiting_action');
  if(body.source_run!==manifest.run||body.proposal_path!==path)fail('fruiting_source_mismatch',409);
  if(body.operation&&body.operations!==undefined)fail('invalid_fruiting_operation');
  const operations=body.operations===undefined?[body.operation]:body.operations;
  if(!Array.isArray(operations)||!operations.length||operations.length>250)fail('invalid_fruiting_batch');
  const originals=new Map(proposals.features.map(f=>[f.properties.id,f])),saved=new Map(head.changes.map(f=>[f.properties.id,f]));
  const pointVersions={...head.point_versions},pointOperations={...head.point_operations},ids=new Set();let changed=0;
  const resolvedBefore=new Map(linkedFruitFeatures([...saved.values()].filter(manual),plants).map(f=>[f.properties.id,f])),occupiedByPlant=new Map(),unresolved=new Map();
  for(const f of resolvedBefore.values())if(f.properties.status!=='rejected'){if(f.properties.plant_id){if(!occupiedByPlant.has(f.properties.plant_id))occupiedByPlant.set(f.properties.plant_id,new Set());occupiedByPlant.get(f.properties.plant_id).add(f.properties.id);}else unresolved.set(f.properties.id,f);}
  for(const op of operations){
    if(!op||typeof op.id!=='string'||!/^[-\w]{1,100}$/.test(op.id)||!Number.isSafeInteger(op.expected_version)||op.expected_version<0||typeof op.operation_id!=='string'||!/^[-\w]{8,100}$/.test(op.operation_id)||!statuses.includes(op.status)||typeof op.note!=='string'||op.note.length>1000||ids.has(op.id))fail('invalid_fruiting_operation');
    ids.add(op.id);
    if(head.point_operations[op.id]===op.operation_id)continue;
    if((head.point_versions[op.id]||0)!==op.expected_version)fail('fruiting_point_conflict_reload',409);
    const previous=saved.get(op.id)||originals.get(op.id);
    if((originals.has(op.id)||previous&&!manual(previous))&&op.status!=='rejected')fail('automatic_fruiting_disabled',409);
    // Removing known fruit evidence must still work after its plant was rejected or moved.
    const removing=op.status==='rejected'&&Boolean(previous);
    if(plantChanges.get(op.id)?.properties.status==='rejected'&&!removing)fail('plant_candidate_rejected_by_team',409);
    let coordinates=removing?previous.geometry.coordinates:plantChanges.get(op.id)?.geometry.coordinates||previous?.geometry.coordinates;
    if(!previous){if(!new RegExp('^'+body.block+'-fruit-manual-[\\w-]{8,70}$').test(op.id))fail('unknown_fruiting_candidate');coordinates=op.coordinates;}
    if(!Array.isArray(coordinates)||coordinates.length!==2||!coordinates.every(Number.isFinite)||(!removing&&(!inside(coordinates,analysis.bounds)||!analysis.native_tiles.some(t=>inside(coordinates,t.bounds)))))fail('invalid_fruiting_location');
    let parent=previous?.properties.plant_id||null,method=previous?.properties.link_method||null;
    const previousLink=resolvedBefore.get(op.id);
    if(!removing&&(!previous||op.plant_id||parent)){
      parent=op.plant_id||parent||plants.match(coordinates)?.properties.id;
      if(typeof parent!=='string'||!plants.byId.has(parent))fail('fruiting_plant_link_required',409);
      if(op.plant_id&&(!previous||op.plant_id!==previous.properties.plant_id)&&distance(coordinates,plants.byId.get(parent).geometry.coordinates)>.75)fail('fruiting_plant_too_far',409);
      if(op.link_method==='spatial_unique'&&plants.match(coordinates)?.properties.id!==parent)fail('fruiting_link_not_unique',409);
      method=op.link_method==='spatial_unique'?'spatial_unique':parent===previous?.properties.plant_id?method||'manual_selection':op.plant_id?'manual_selection':'spatial_unique';
      const occupied=[...(occupiedByPlant.get(parent)||[])].find(id=>id!==op.id);
      const alreadyLinked=previous?.properties.status!=='rejected'&&previousLink?.properties.plant_id===parent;
      if(occupied&&!alreadyLinked)fail('fruiting_plant_already_marked',409,{fruit_id:occupied});
      if(!previous){const nearby=[...unresolved.values()].find(f=>distance(f.geometry.coordinates,plants.byId.get(parent).geometry.coordinates)<=.6);if(nearby)fail('fruiting_nearby_unlinked',409,{fruit_id:nearby.properties.id});}
    }
    const feature={type:'Feature',geometry:{type:'Point',coordinates},properties:{id:op.id,status:op.status,note:op.note,origin:originals.has(op.id)?'visual_shortlist':previous?.properties.origin||'manual_fruiting_review',...(parent?{plant_id:parent,link_method:method||'manual_selection'}:{}),fruiting_validated:false,confirmation_scope:op.status==='confirmed'?'staff_visual_or_field_assessment':'unconfirmed'}};
    if(previousLink?.properties.plant_id)occupiedByPlant.get(previousLink.properties.plant_id)?.delete(op.id);unresolved.delete(op.id);if(op.status!=='rejected'&&parent){if(!occupiedByPlant.has(parent))occupiedByPlant.set(parent,new Set());occupiedByPlant.get(parent).add(op.id);}
    saved.set(op.id,feature);pointVersions[op.id]=(head.point_versions[op.id]||0)+1;pointOperations[op.id]=op.operation_id;changed++;
  }
  if(!changed)return response();
  if(saved.size>10000)fail('fruiting_review_limit');
  const revision=head.revision+1,version=root+'/versions/'+revision+'-'+crypto.randomUUID()+'.json';
  const next={schema:'dayun-fruiting-head-v1',source_run:manifest.run,block:body.block,revision,changes:[...saved.values()],point_versions:pointVersions,point_operations:pointOperations,updated_at:new Date().toISOString(),previous_version:head.version||null,version,census_changed:false,plant_corrections_changed:false};
  const options={httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}};
  await env.PUBLIC_SNAPSHOTS.put(version,JSON.stringify(next),options);
  await env.PUBLIC_SNAPSHOTS.put(root+'/head.json',JSON.stringify(next),options);
  head=next;return response();
}
