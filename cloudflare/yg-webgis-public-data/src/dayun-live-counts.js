import {booleanPointInPolygon,area,intersect,featureCollection} from '@turf/turf';
import {expandCandidateGrid} from './dayun-block-corrections.js';
import {linkedFruitFeatures,distance} from './dayun-fruit-links.js';
import plantingDetails from '../../../data/dayun-gawangan-details.json' with {type:'json'};
const root='drone/analysis/dayun/',inside=(p,b)=>p[0]>=b[0]&&p[0]<=b[2]&&p[1]>=b[1]&&p[1]<=b[3];
function index(f){const coords=[];function visit(x){if(typeof x[0]==='number')coords.push(x);else x.forEach(visit);}visit(f.geometry.coordinates);const b=coords.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);const rings=f.geometry.type==='Polygon'?f.geometry.coordinates:f.geometry.coordinates.flat();return{f,b,rings};}
// Local metric projection at Dayun's latitude; use distance to polygon edges,
// never centroids. Bounding-box lower bounds prune distant polygons.
export function allocator(features){const zones=features.filter(f=>/^GT-[ABC]-\d+$/.test(f.properties.id)).map(index).sort((a,b)=>a.f.properties.id.localeCompare(b.f.properties.id));
 return f=>{const p=f.geometry.coordinates,hit=zones.find(z=>inside(p,z.b)&&booleanPointInPolygon(f,z.f));if(hit)return{zone:hit.f.properties.id,outside:false};let best=Infinity,chosen=null;const sx=111320*Math.cos(p[1]*Math.PI/180),sy=111195;
 for(const z of zones){const dx=Math.max(z.b[0]-p[0],0,p[0]-z.b[2])*sx,dy=Math.max(z.b[1]-p[1],0,p[1]-z.b[3])*sy;if(dx*dx+dy*dy>best)continue;for(const ring of z.rings)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],ax=(a[0]-p[0])*sx,ay=(a[1]-p[1])*sy,bx=(b[0]-p[0])*sx,by=(b[1]-p[1])*sy,vx=bx-ax,vy=by-ay,t=Math.max(0,Math.min(1,-(ax*vx+ay*vy)/(vx*vx+vy*vy||1))),d=(ax+t*vx)**2+(ay+t*vy)**2;if(d<best){best=d;chosen=z.f.properties.id;}}}if(!chosen)throw Error('No active gawangan');return{zone:chosen,outside:true};};
}
class Plants{
 constructor(){this.byId=new Map();this.cells=new Map();}
 key(c){return[Math.floor(c[0]*111314),Math.floor(c[1]*110574)];}
 set(id,f){const old=this.byId.get(id);if(old){const k=this.key(old.geometry.coordinates).join('/');this.cells.get(k)?.delete(id);}this.byId.delete(id);if(!f||f.properties.status==='rejected')return;this.byId.set(id,f);const k=this.key(f.geometry.coordinates).join('/');if(!this.cells.has(k))this.cells.set(k,new Map());this.cells.get(k).set(id,f);}
 match(c){const [x,y]=this.key(c),found=[];for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const f of this.cells.get([x+dx,y+dy].join('/'))?.values()||[]){const d=distance(c,f.geometry.coordinates);if(d<=.45)found.push({f,d});}found.sort((a,b)=>a.d-b.d||a.f.properties.id.localeCompare(b.f.properties.id));return found[0]?.d<=.2&&(!found[1]||found[1].d-found[0].d>=.15)?found[0].f:null;}
}
export class IncrementalCounts{
 constructor(zones,masks){this.allocate=allocator(zones);this.masks=masks.map(f=>({...index(f),count:0}));this.rows=new Map(zones.filter(f=>/^GT-[ABC]-\d+$/.test(f.properties.id)).map(f=>[f.properties.id,{objectId:'DAYUN-'+f.properties.id,zone:f.properties.id,block:f.properties.id.split('-')[1],plants:0,newPlants:0,allocated:0,fruits:0}]));this.entries=new Map();this.classifications=0;}
 set(key,f,kind='plants'){const old=this.entries.get(key);if(old){const r=this.rows.get(old.zone);r[kind]--;if(kind==='plants'){r.newPlants-=old.fresh;r.allocated-=old.outside;old.masks.forEach(m=>m.count--);}this.entries.delete(key);}if(!f)return;this.classifications++;const a=this.allocate(f),masks=kind==='plants'?this.masks.filter(m=>inside(f.geometry.coordinates,m.b)&&booleanPointInPolygon(f,m.f)):[],fresh=masks.length?1:0,r=this.rows.get(a.zone);r[kind]++;if(kind==='plants'){r.newPlants+=fresh;r.allocated+=Number(a.outside);masks.forEach(m=>m.count++);}this.entries.set(key,{zone:a.zone,fresh,outside:Number(a.outside),masks});}
}
// Publish only the requested planting geometry and display metadata. Never leak
// private record IDs, source-image paths, notes, staff identities or other areas.
export function publicPlantingAreas(records,zones){
 const gt=zones.filter(f=>/^GT-[ABC]-\d+$/.test(f.properties.id)).map(index),seen=new Set(),features=[],counts={};
 for(const record of records){const match=/^Batas nanas baru Blok ([ABC])\b/.exec(record?.name||'');if(!match)continue;
  for(const f of record.collection.features){if(!['Polygon','MultiPolygon'].includes(f.geometry.type))continue;const key=JSON.stringify(f.geometry);if(seen.has(key))continue;seen.add(key);const b=index(f).b;let zone=null,best=0;
   for(const z of gt){if(b[0]>z.b[2]||b[2]<z.b[0]||b[1]>z.b[3]||b[3]<z.b[1])continue;const hit=intersect(featureCollection([f,z.f])),size=hit?area(hit):0;if(size>best){best=size;zone=z.f.properties.id;}}
   const block=zone?.split('-')[1]||match[1],n=counts[block]=(counts[block]||0)+1;
   features.push({type:'Feature',id:`new-${block}-${n}`,geometry:f.geometry,properties:{id:`new-${block}-${n}`,block,zoneId:zone,name:zone?'Tanaman baru '+zone:'Tanaman baru Blok '+block+' · Area '+n,areaM2:Number.isFinite(f.properties?.areaM2)?f.properties.areaM2:area(f)*(6378137/6371008.8)**2}});
  }
 }return features;
}
export class LiveDayunCounts{
 constructor(env,{details=plantingDetails}={}){this.env=env;this.details=details;this.cache=new Map();this.blocks=new Map();this.last=null;this.checkedAt=0;}
 async read(key){const meta=await this.env.PUBLIC_SNAPSHOTS.head(key),etag=meta?.etag||null,old=this.cache.get(key);if(old&&old.etag===etag)return old;if(!meta){const entry={etag:null,value:null};this.cache.set(key,entry);return entry;}const o=await this.env.PUBLIC_SNAPSHOTS.get(key);if(!o)throw Error('Source changed while reading');const entry={etag:o.etag||etag,value:JSON.parse(await o.text())};this.cache.set(key,entry);return entry;}
 async value(key){return(await this.read(key)).value;}
 async load({force=false}={}){if(!force&&this.last&&Date.now()-this.checkedAt<2000)return this.last;
  const manifest=await this.value(root+'results/Agro_ABC/index.json');if(!manifest?.run||!/^drone\/analysis\/dayun\/results\/Agro_ABC\/[\w-]+$/.test(manifest.prefix))throw Error('Analysis unavailable');
  // Planting months are canonical published metadata, not point-count snapshots.
  // Bundle them with the Worker so an older R2 census mirror cannot regress July.
  const detailsEntry={value:this.details,etag:this.details.updatedAt};
  const list=[];let cursor;do{const page=await this.env.PUBLIC_SNAPSHOTS.list({prefix:root+'areas/heads/',limit:1000,...(cursor?{cursor}:{})});list.push(...page.objects);cursor=page.truncated?page.cursor:null;}while(cursor);
  const records=await Promise.all(list.map(o=>this.value(o.key))),areas=records.filter(r=>/^Batas nanas baru Blok [ABC]\b/.test(r?.name||''));if(!areas.length)throw Error('Planting boundaries unavailable');
  const zoneEntries=await Promise.all('ABC'.split('').map(b=>{const path=manifest.block_analyses?.[b];if(!manifest.files?.includes(path))throw Error('Block unavailable');return this.read(manifest.prefix+'/'+path.slice(0,path.lastIndexOf('/')+1)+'zones.geojson');}));
  const geometryKey=JSON.stringify([manifest.run,zoneEntries.map(z=>z.etag),areas.map(r=>[r.id,r.revision]).sort()]),reset=geometryKey!==this.geometryKey;
  if(reset){const zones=zoneEntries.flatMap(e=>e.value.features);this.counts=new IncrementalCounts(zones,publicPlantingAreas(areas,zones));this.blocks.clear();this.geometryKey=geometryKey;this.geometryRevision=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(geometryKey))),b=>b.toString(16).padStart(2,'0')).join('');}
  const revisions={};let changed=reset;
  for(const block of 'ABC'){
   const path=manifest.block_analyses[block],folder=path.slice(0,path.lastIndexOf('/')+1),anchor=manifest.block_review_bases?.[block]||path,hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(anchor))),b=>b.toString(16).padStart(2,'0')).join('');
   const [head,fruit]=await Promise.all([this.read(root+`block-reviews/Agro_ABC/${manifest.run}/${hash}/head.json`),this.read(root+`fruit-reviews/Agro_ABC/${manifest.run}/${block}/head.json`)]);
   let state=this.blocks.get(block);const plantDirty=!state||state.path!==path||state.plantTag!==head.etag,fruitDirty=plantDirty||!state||state.fruitTag!==fruit.etag;
   if(!state||state.path!==path){if(state)throw Error('Analysis changed; retry');const analysis=await this.value(manifest.prefix+'/'+path),file=folder+(analysis.review_index||'candidates.geojson');if(!manifest.files.includes(file))throw Error('Candidate source unavailable');const raw=await this.value(manifest.prefix+'/'+file),base=analysis.review_index?expandCandidateGrid(raw,analysis):raw;state={path,base:new Map(base.features.map(f=>[f.properties.id,f])),versions:{},changes:new Map(),plants:new Plants(),fruitRows:new Map()};this.blocks.set(block,state);for(const f of base.features){state.plants.set(f.properties.id,f);this.counts.set(block+':p:'+f.properties.id,f.properties.status==='rejected'?null:f);}}
   if(plantDirty){const next=new Map((head.value?.review?.changes||[]).map(f=>[f.properties.id,f])),versions=head.value?.point_versions||{};for(const id of new Set([...state.changes.keys(),...next.keys()])){if(state.changes.has(id)===next.has(id)&&state.versions[id]===versions[id]&&JSON.stringify(state.changes.get(id))===JSON.stringify(next.get(id)))continue;const f=next.get(id)||state.base.get(id);state.plants.set(id,f);this.counts.set(block+':p:'+id,!f||f.properties.status==='rejected'?null:f);}state.changes=next;state.versions=versions;state.plantTag=head.etag;changed=true;}
   if(fruitDirty){const raw=(fruit.value?.changes||[]).filter(f=>f.properties.origin==='manual_fruiting_review'),resolved=linkedFruitFeatures(raw,state.plants),next=new Map();for(const f of resolved){if(f.properties.status!=='confirmed'||f.properties.counted===false)continue;const parent=f.properties.link_state==='linked'?state.plants.byId.get(f.properties.plant_id):null;next.set(f.properties.id,parent?{...f,geometry:parent.geometry}:f);}for(const id of new Set([...state.fruitRows.keys(),...next.keys()]))if(JSON.stringify(state.fruitRows.get(id))!==JSON.stringify(next.get(id)))this.counts.set(block+':f:'+id,next.get(id),'fruits');state.fruitRows=next;state.fruitTag=fruit.etag;changed=true;}
   revisions[block]={plants:head.value?.revision||0,fruits:fruit.value?.revision||0};
  }
  const details=detailsEntry.value,month=p=>/^\d{4}-\d{2}$/.test(p||'')?new Date(p+'-01T12:00:00Z').toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).replace(/^./,c=>c.toUpperCase()):p||null;
  const rows=[...this.counts.rows.values()].sort((a,b)=>a.zone.localeCompare(b.zone)).map(r=>{const crop=details.objects.find(o=>o.objectId===r.objectId)?.crops.find(c=>c.crop==='NANAS'),period=crop?.newPlantingIndication?.plantingPeriod||crop?.plantingCohorts?.at(-1)?.period,census=crop?.newPlantCensus;return{...r,...(census?{plants:r.plants-r.newPlants+census.count,newPlants:census.count,newPlantCensus:census}:{}),plantingMonth:crop?.plantingPeriod||null,newPlantingMonth:(census?.count||r.newPlants)?month(period):null};});
  const signature=JSON.stringify([revisions,geometryKey,detailsEntry.etag]);this.last={schema:'dayun-live-work-counts-v1',live:true,updatedAt:signature===this.signature?this.last.updatedAt:new Date().toISOString(),checkedAt:new Date().toISOString(),sourceRun:manifest.run,revisions,rows};this.signature=signature;this.checkedAt=Date.now();return this.last;
 }
 async mapData(){const data=await this.load();return{type:'FeatureCollection',schema:'dayun-agro-map-live-v1',live:true,checkedAt:data.checkedAt,revisions:data.revisions,rows:data.rows,geometryRevision:this.geometryRevision,features:this.counts.masks.map(m=>({...m.f,properties:{...m.f.properties,pointCount:m.count,plantingMonth:data.rows.find(r=>r.zone===m.f.properties.zoneId)?.newPlantingMonth||null}}))};}
}
