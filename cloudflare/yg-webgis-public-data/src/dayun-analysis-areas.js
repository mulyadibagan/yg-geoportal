import {area,length,booleanValid,kinks,earthRadius} from '@turf/turf';
export const areaRoot='drone/analysis/dayun/areas';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const validId=id=>typeof id==='string'&&/^area-[a-f0-9-]{36}$/.test(id);
// Match the pinned Turf 6.5 viewer area radius (Turf 7 uses a different default).
const viewerArea=f=>area(f)*(6378137/earthRadius)**2;
const headKey=id=>areaRoot+'/heads/'+id+'.json';
const read=async(env,key)=>{const o=await env.PUBLIC_SNAPSHOTS.get(key);return o?JSON.parse(await o.text()):null;};
const summary=d=>({id:d.id,name:d.name,revision:d.revision,updated_at:d.updated_at,feature_count:d.collection.features.length,areaM2:d.collection.features.length===1?d.collection.features[0].properties.areaM2??null:null});
export function validateAreaCollection(input){
 if(input?.type!=='FeatureCollection'||!Array.isArray(input.features)||!input.features.length||input.features.length>50)fail('invalid_area_collection');
 const collection=JSON.parse(JSON.stringify(input));let points=0;
 for(const f of collection.features){
  if(f?.type!=='Feature'||!['Polygon','MultiPolygon','LineString'].includes(f.geometry?.type))fail('invalid_area_geometry');
  const visit=coords=>{if(!Array.isArray(coords)||!coords.length)fail('invalid_area_coordinates');if(typeof coords[0]==='number'){if(coords.length!==2||!coords.every(Number.isFinite)||Math.abs(coords[0])>180||Math.abs(coords[1])>90||++points>10000)fail('invalid_area_coordinates');}else for(const part of coords)visit(part);};visit(f.geometry.coordinates);
  if(!booleanValid(f)||f.geometry.type!=='LineString'&&kinks(f).features.length)fail('invalid_area_geometry');
  if(f.properties!==null&&(typeof f.properties!=='object'||Array.isArray(f.properties)))fail('invalid_area_properties');
  f.properties={...f.properties,...(f.geometry.type==='LineString'?{lengthM:length(f,{units:'kilometers'})*1000}:{areaM2:viewerArea(f),areaHa:viewerArea(f)/10000,area_method:'spherical_WGS84_radius_6378137_m'})};
 }
 return collection;
}
export async function analysisAreasOperation(env,body){
 if(body.action==='list'){
  const page=await env.PUBLIC_SNAPSHOTS.list({prefix:areaRoot+'/heads/',limit:20,cursor:body.cursor});
  const records=await Promise.all(page.objects.map(o=>read(env,o.key)));
  return{ok:true,items:records.filter(Boolean).map(summary).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)),cursor:page.truncated?page.cursor:null,census_changed:false};
 }
 if(!validId(body.id))fail('invalid_area_id');
 const head=await read(env,headKey(body.id));
 if(body.action==='load'){if(!head)fail('area_not_found',404);return{ok:true,record:head,census_changed:false};}
 if(body.action!=='save')fail('invalid_area_action');
 if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>120||!Number.isSafeInteger(body.expected_revision)||body.expected_revision<0||typeof body.operation_id!=='string'||!/^[-\w]{8,100}$/.test(body.operation_id))fail('invalid_area_save');
 if(head?.operation_id===body.operation_id)return{ok:true,record:head,census_changed:false};
 if((head?.revision||0)!==body.expected_revision)fail('area_revision_conflict',409);
 const collection=validateAreaCollection(body.collection),revision=(head?.revision||0)+1;
 const version=areaRoot+'/versions/'+body.id+'/'+revision+'-'+crypto.randomUUID()+'.json';
 const next={schema:'dayun-analysis-area-v1',id:body.id,name:body.name.trim(),revision,operation_id:body.operation_id,collection,created_at:head?.created_at||new Date().toISOString(),updated_at:new Date().toISOString(),previous_version:head?.version||null,version,census_changed:false,plant_corrections_changed:false};
 const options={httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}};
 await env.PUBLIC_SNAPSHOTS.put(version,JSON.stringify(next),options);
 await env.PUBLIC_SNAPSHOTS.put(headKey(body.id),JSON.stringify(next),options);
 return{ok:true,record:next,census_changed:false};
}
