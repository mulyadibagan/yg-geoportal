import test from 'node:test';
import assert from 'node:assert/strict';
import {DroneQueue} from '../src/drone-queue.js';
import {handleDroneRequest} from '../src/drone.js';
const p=(id,x=.5)=>({type:'Feature',geometry:{type:'Point',coordinates:[x,.5]},properties:{id,status:'pending',zones:['forged']}});
async function fixture(){
 const prefix='drone/analysis/dayun/results/Agro_ABC/run',analysis='block-A/analysis.json',path='fruit-A/fruiting.json';
 const manifest={run:'run',prefix,block_analyses:{A:analysis},block_fruiting:{A:path},files:[analysis,'block-A/zones.geojson','block-A/candidates.geojson',path]};
 const zones={features:[{type:'Feature',properties:{id:'GT-A-01'},geometry:{type:'Polygon',coordinates:[[[0,0],[2,0],[2,2],[0,2],[0,0]]]}}]};
 const objects=new Map([['drone/analysis/dayun/results/Agro_ABC/index.json',manifest],[prefix+'/'+analysis,{block:'A',source_run:'run',bounds:[0,0,4,4],native_tiles:[{bounds:[0,0,3,3]}]}],[prefix+'/block-A/candidates.geojson',{features:[p('plant-1'),p('plant-2',1)]}],[prefix+'/block-A/zones.geojson',zones],[prefix+'/'+path,{schema:'dayun-fruiting-shortlist-v1',source_run:'run',block:'A',features:[p('auto-1'),p('auto-2',1)]}]]);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(analysis))),b=>b.toString(16).padStart(2,'0')).join('');
 const plantKey='drone/analysis/dayun/block-reviews/Agro_ABC/run/'+hash+'/head.json';objects.set(plantKey,{revision:13,review:{changes:[]}});
 const values=new Map([...objects].map(([k,v])=>[k,JSON.stringify(v)])),writes=[];
 const env={values,writes,PUBLIC_SNAPSHOTS:{get:async k=>values.has(k)?{text:async()=>values.get(k)}:null,put:async(k,v,options)=>{writes.push({k,options});values.set(k,v)}}};
 let serial=Promise.resolve();const queue=new DroneQueue({blockConcurrencyWhile(fn){const n=serial.then(fn);serial=n.catch(()=>{});return n}},env);env.DRONE_QUEUE={idFromName:x=>x,get:()=>queue};
 return{env,manifest,path,plantKey};
}
async function call(f,body,staff=true,block='A'){
 const url=new URL('https://worker.test/api/staff/drone/analysis/Agro_ABC/fruiting-review?block='+block);
 const r=await handleDroneRequest(new Request(url,{method:body?'POST':'GET',headers:{origin:'https://webgisyg.id','content-type':'application/json',...(staff?{authorization:'Bearer staff'}:{})},...(body?{body:JSON.stringify(body)}:{})}),f.env,url,async t=>t==='staff');
 return{status:r.status,headers:r.headers,body:await r.json()};
}
const manual1='A-fruit-manual-first111',manual2='A-fruit-manual-second222';
const decision=(id=manual1,version=0,status='confirmed',operation='operation-12345678')=>({source_run:'run',proposal_path:'fruit-A/fruiting.json',operation:{id,expected_version:version,status,note:'Diperiksa pada citra',operation_id:operation,coordinates:id===manual2?[1,.5]:[.5,.5]}});
const headKey='drone/analysis/dayun/fruit-reviews/Agro_ABC/run/A/head.json';

test('anonymous reads and writes fail before storage and unsupported blocks fail closed',async()=>{const f=await fixture();assert.equal((await call(f,null,false)).status,401);assert.equal((await call(f,decision(),false)).status,401);assert.equal((await call(f,null,true,'D')).status,400);assert.equal((await call(f,null,true,'B')).status,404);assert.equal(f.env.writes.length,0);});

test('automatic shortlists never appear or count, including regenerated proposals and old confirmations',async()=>{
 const f=await fixture();let r=await call(f);assert.equal(r.body.manual_only,true);assert.deepEqual(r.body.features,[]);assert.equal(r.body.rows[0].pending,0);
 f.env.values.set(headKey,JSON.stringify({source_run:'run',revision:8,changes:[{...p('auto-1'),properties:{id:'auto-1',origin:'visual_shortlist',status:'confirmed'}}],point_versions:{'auto-1':1},point_operations:{}}));
 r=await call(f);assert.deepEqual(r.body.features,[]);assert.equal(r.body.rows[0].confirmed,0);
 const source=f.manifest.prefix+'/'+f.path,proposals=JSON.parse(f.env.values.get(source));proposals.features.push(p('auto-new',1.1));f.env.values.set(source,JSON.stringify(proposals));
 r=await call(f);assert.deepEqual(r.body.features,[]);assert.equal(r.body.rows[0].pending,0);assert.equal(f.env.writes.length,0);
 for(const status of ['confirmed','pending','unclear']){r=await call(f,decision('auto-1',1,status));assert.equal(r.status,409);assert.equal(r.body.error,'automatic_fruiting_disabled');}assert.equal(f.env.writes.length,0);
});

test('manual fruit add/remove immediately changes zone and block totals in the private response only',async()=>{
 const f=await fixture(),before=new Map(f.env.values);let r=await call(f,decision());assert.equal(r.status,200);assert.equal(r.body.rows[0].confirmed,1);assert.equal(r.body.features.filter(f=>f.properties.status==='confirmed').length,1);assert.deepEqual(r.body.features[0].properties.zones,['GT-A-01']);assert.equal(r.body.rows[0].pending,0);assert.match(r.headers.get('cache-control'),/private, no-store/);
 r=await call(f,decision(manual1,1,'rejected','remove-manual-111'));assert.equal(r.status,200);assert.equal(r.body.rows[0].confirmed,0);assert.equal(r.body.rows[0].rejected,1);assert.equal(r.body.census_changed,false);assert.equal(r.body.plant_corrections_changed,false);
 for(const [k,v]of before)assert.equal(f.env.values.get(k),v);assert.ok(f.env.writes.every(w=>w.k.startsWith('drone/analysis/dayun/fruit-reviews/')&&w.options.httpMetadata.cacheControl==='private, no-store'));
});

test('multiple laptops merge independent points and reject same-point conflicts with idempotent retry',async()=>{
 const f=await fixture();const [a,b]=await Promise.all([call(f,decision()),call(f,decision(manual2,0,'confirmed','operation-22222222'))]);assert.equal(a.status,200);assert.equal(b.status,200);assert.equal((await call(f)).body.rows[0].confirmed,2);assert.equal((await call(f,decision())).body.revision,2);assert.equal((await call(f,decision(manual1,0,'rejected','stale-manual-111'))).status,409);assert.equal((await call(f,decision(manual1,1,'rejected','current-manual-111'))).body.rows[0].confirmed,1);assert.equal([...f.env.values.keys()].filter(k=>k.includes('/versions/')).length,3);
});

test('invalid run/path/identity/decision/coverage fail without writes',async()=>{
 for(const change of [d=>d.source_run='other',d=>d.proposal_path='../bad',d=>d.operation.id='fake',d=>d.operation.status='accepted',d=>d.operation.note='x'.repeat(1001),d=>d.operation.expected_version=-1,d=>d.operation.coordinates=[3.5,3.5]]){const f=await fixture(),d=decision();change(d);assert.ok((await call(f,d)).status>=400);assert.equal(f.env.writes.length,0);}
});

test('manual fruit survives rejection or movement of unrelated pineapple candidates',async()=>{
 const f=await fixture(),raw=JSON.stringify({revision:14,review:{changes:[{...p('auto-1',99),properties:{id:'auto-1',status:'rejected'}}]}});f.env.values.set(f.plantKey,raw);const d=decision();d.operation.coordinates=[2.5,2.5];const plant=JSON.parse(f.env.values.get(f.plantKey));plant.review.changes.push({...p('A-manual-unassigned1'),geometry:{type:'Point',coordinates:[2.5,2.5]},properties:{id:'A-manual-unassigned1',status:'accepted'}});f.env.values.set(f.plantKey,JSON.stringify(plant));const plantBefore=f.env.values.get(f.plantKey);let r=await call(f,d);assert.equal(r.status,200);assert.equal(r.body.rows.find(r=>r.zone_id==='UNASSIGNED').confirmed,1);assert.equal(f.env.values.get(f.plantKey),plantBefore);
});

test('failed head write cannot claim success or lose the previous readable revision',async()=>{
 const f=await fixture(),put=f.env.PUBLIC_SNAPSHOTS.put;let fail=true;f.env.PUBLIC_SNAPSHOTS.put=async(k,...args)=>{if(fail&&k.endsWith('/head.json'))throw Error('offline');return put(k,...args)};const d=decision();assert.equal((await call(f,d)).status,503);assert.equal((await call(f)).body.revision,0);fail=false;assert.equal((await call(f,d)).body.rows[0].confirmed,1);assert.equal((await call(f,d)).body.revision,1);
});

const batch=()=>({source_run:'run',proposal_path:'fruit-A/fruiting.json',operations:[decision('auto-1',0,'rejected','batch-operation-111').operation,decision('auto-2',0,'rejected','batch-operation-222').operation]});
test('legacy automatic cleanup stays recoverable, idempotent and never changes manual records',async()=>{
 const f=await fixture();await call(f,decision());const before=JSON.parse(f.env.values.get(headKey)).changes[0],r=await call(f,batch());assert.equal(r.status,200);assert.equal(r.body.revision,2);assert.equal(r.body.rows[0].confirmed,1);assert.equal(r.body.rows[0].rejected,0);assert.equal(r.body.features.length,1);assert.deepEqual(r.body.changes.find(f=>f.properties.id===manual1),before);assert.equal((await call(f,batch())).body.revision,2);
});

test('invalid or stale mixed batches never partially write',async()=>{
 for(const change of [b=>b.operations[1].expected_version=2,b=>b.operations[1].status='confirmed',b=>b.operations[1].id=b.operations[0].id,b=>b.operations=[],b=>b.operations=Array(251).fill(b.operations[0]),b=>b.operation=b.operations[0]]){const f=await fixture(),b=batch();change(b);assert.ok((await call(f,b)).status>=400);assert.equal(f.env.writes.length,0);assert.equal((await call(f)).body.revision,0);}
});

test('250 manual fruit adds and rectangle removals each write a single revision',async()=>{
 const f=await fixture(),before=f.env.values.get(f.plantKey),operations=Array.from({length:250},(_,i)=>({id:'A-fruit-manual-largebatch-'+i,expected_version:0,operation_id:'large-batch-operation-'+i,status:'confirmed',plant_id:'A-manual-parentbatch-'+i,coordinates:[.5+i*.00001,.5],note:'x'.repeat(1000)}));const plant=JSON.parse(before);plant.review.changes=operations.map(o=>({type:'Feature',geometry:{type:'Point',coordinates:o.coordinates},properties:{id:o.plant_id,status:'accepted'}}));f.env.values.set(f.plantKey,JSON.stringify(plant));const plantBefore=f.env.values.get(f.plantKey);let r=await call(f,{source_run:'run',proposal_path:f.path,operations});assert.equal(r.status,200);assert.equal(r.body.rows[0].confirmed,250);assert.equal(r.body.supports_batch,true);assert.equal(r.body.revision,1);assert.equal(f.env.writes.length,2);
 const removed=operations.map((o,i)=>({...o,status:'rejected',expected_version:1,operation_id:'rectangle-delete-'+i}));r=await call(f,{source_run:'run',proposal_path:f.path,operations:removed});assert.equal(r.status,200);assert.equal(r.body.rows[0].confirmed,0);assert.equal(r.body.revision,2);assert.equal(f.env.writes.length,4);assert.equal(f.env.values.get(f.plantKey),plantBefore);
});

test('removing old automatic evidence still works after its parent moved outside coverage',async()=>{
 const f=await fixture(),raw=JSON.stringify({revision:440,review:{changes:[{...p('auto-1',99),properties:{id:'auto-1',status:'rejected'}}]}});f.env.values.set(f.plantKey,raw);const d=decision('auto-1',0,'rejected','reject-stale-fruit-123');d.operation.coordinates=[88,88];const r=await call(f,d);assert.equal(r.status,200);assert.deepEqual(r.body.features,[]);assert.deepEqual(JSON.parse(f.env.values.get(headKey)).changes[0].geometry.coordinates,[.5,.5]);assert.equal(f.env.values.get(f.plantKey),raw);
});


test('two laptops cannot attach two fruit markers to the same plant and deleting fruit never edits its parent',async()=>{const f=await fixture(),plantBefore=f.env.values.get(f.plantKey),a=decision(),b=decision(manual2,0,'confirmed','concurrent-fruit-222');a.operation.plant_id='plant-1';b.operation.plant_id='plant-1';b.operation.coordinates=[.5000001,.5];const results=await Promise.all([call(f,a),call(f,b)]);assert.deepEqual(results.map(r=>r.status),[200,409]);assert.equal(results[1].body.error,'fruiting_plant_already_marked');assert.equal(results[1].body.fruit_id,manual1);assert.equal(f.env.writes.length,2);assert.equal((await call(f)).body.rows[0].confirmed,1);await call(f,decision(manual1,1,'rejected','remove-link-1111'));assert.equal((await call(f,b)).status,200);assert.equal(f.env.values.get(f.plantKey),plantBefore);});

test('legacy duplicate fruit annotations are preserved, linked and counted once, with archived revisions',async()=>{const f=await fixture(),legacy=[manual1,manual2].map(id=>({...p(id),properties:{id,origin:'manual_fruiting_review',status:'confirmed',note:'original team note'}}));f.env.values.set(headKey,JSON.stringify({source_run:'run',revision:4,changes:legacy,point_versions:{[manual1]:1,[manual2]:1},point_operations:{}}));const raw=f.env.values.get(headKey);let r=await call(f);assert.equal(r.body.features.length,2);assert.equal(r.body.link_summary.duplicates,1);assert.equal(r.body.rows[0].confirmed,1);assert.equal(f.env.values.get(headKey),raw);assert.equal(f.env.writes.length,0);const operations=legacy.map((l,i)=>({id:l.properties.id,status:'confirmed',note:l.properties.note,plant_id:'plant-1',link_method:'spatial_unique',expected_version:1,operation_id:'legacy-link-operation-'+i}));r=await call(f,{source_run:'run',proposal_path:f.path,operations});assert.equal(r.status,200);for(const l of legacy){const saved=r.body.changes.find(f=>f.properties.id===l.properties.id);assert.deepEqual(saved.geometry,l.geometry);assert.equal(saved.properties.note,l.properties.note);}assert.equal(r.body.rows[0].confirmed,1);assert.equal(r.body.features.length,2);assert.equal(r.body.revision,5);r=await call(f,decision(manual1,2,'rejected','remove-one-duplicate'));assert.equal(r.body.rows[0].confirmed,1);assert.equal(r.body.features.find(f=>f.properties.id===manual2).properties.counted,true);});

test('ambiguous old fruit requires explicit linking and blocks a nearby second annotation',async()=>{const f=await fixture(),plant=JSON.parse(f.env.values.get(f.plantKey));plant.review.changes=[{...p('plant-2'),geometry:{type:'Point',coordinates:[.500001,.5]},properties:{id:'plant-2',status:'accepted'}}];f.env.values.set(f.plantKey,JSON.stringify(plant));f.env.values.set(headKey,JSON.stringify({source_run:'run',revision:2,changes:[{...p(manual1),properties:{id:manual1,origin:'manual_fruiting_review',status:'confirmed',note:''}}],point_versions:{[manual1]:1},point_operations:{}}));let r=await call(f);assert.equal(r.body.features[0].properties.link_state,'needs_link');const second=decision(manual2);second.operation.plant_id='plant-1';second.operation.coordinates=[.5,.5];r=await call(f,second);assert.equal(r.body.error,'fruiting_nearby_unlinked');const link=decision(manual1,1);link.operation.plant_id='plant-1';r=await call(f,link);assert.equal(r.status,200);assert.equal(r.body.features[0].properties.plant_id,'plant-1');const other=decision(manual2);other.operation.plant_id='plant-2';other.operation.coordinates=[.500001,.5];assert.equal((await call(f,other)).status,200);});

test('a missing or rejected parent cannot receive a new marker, and an existing fruit is retained for review',async()=>{const f=await fixture();const d=decision();d.operation.plant_id='missing';assert.equal((await call(f,d)).status,409);assert.equal(f.env.writes.length,0);d.operation.plant_id='plant-1';assert.equal((await call(f,d)).status,200);const plant=JSON.parse(f.env.values.get(f.plantKey));plant.review.changes=[{...p('plant-1'),properties:{id:'plant-1',status:'rejected'}}];f.env.values.set(f.plantKey,JSON.stringify(plant));const r=await call(f);assert.equal(r.body.features.length,1);assert.equal(r.body.features[0].properties.link_state,'plant_unavailable');assert.equal(r.body.rows[0].confirmed,1);const b=decision(manual2);b.operation.plant_id='plant-1';assert.equal((await call(f,b)).status,409);});

test('linked fruit zone membership follows the parent while its original evidence coordinates remain unchanged',async()=>{const f=await fixture(),plant=JSON.parse(f.env.values.get(f.plantKey));plant.review.changes=[{...p('plant-1'),geometry:{type:'Point',coordinates:[1.999999,.5]},properties:{id:'plant-1',status:'accepted'}}];f.env.values.set(f.plantKey,JSON.stringify(plant));const d=decision();d.operation.plant_id='plant-1';d.operation.coordinates=[2.000001,.5];const r=await call(f,d);assert.equal(r.status,200);assert.deepEqual(r.body.features[0].geometry.coordinates,d.operation.coordinates);assert.deepEqual(r.body.features[0].properties.zones,['GT-A-01']);assert.deepEqual(r.body.features[0].properties.fruit_zones,[]);assert.equal(r.body.rows[0].confirmed,1);});
