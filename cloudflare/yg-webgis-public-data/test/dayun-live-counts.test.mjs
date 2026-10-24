import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveDayunCounts,IncrementalCounts,allocator} from '../src/dayun-live-counts.js';
import worker from '../src/main.js';
const point=(id,x,y=.0005,status='candidate')=>({type:'Feature',geometry:{type:'Point',coordinates:[x,y]},properties:{id,status}});
const box=(id,x)=>({type:'Feature',properties:{id},geometry:{type:'Polygon',coordinates:[[[x,0],[x+.001,0],[x+.001,.001],[x,.001],[x,0]]]}});
async function fixture(){
 const values=new Map(),gets=new Map();let seq=0;const set=(key,value)=>values.set(key,{etag:String(++seq),value}),prefix='drone/analysis/dayun/results/Agro_ABC/run';
 const manifest={run:'run',prefix,files:[],block_analyses:{}};const keys={};
 for(const [i,b]of [...'ABC'].entries()){
  const path=`block-${b}/analysis.json`;manifest.block_analyses[b]=path;manifest.files.push(path,`block-${b}/candidates.geojson`,`block-${b}/zones.geojson`);set(prefix+'/'+path,{block:b,source_run:'run'});
  set(prefix+`/block-${b}/candidates.geojson`,{features:b==='A'?[point('p1',.0005),point('p2',.0019)]:[]});set(prefix+`/block-${b}/zones.geojson`,{features:b==='A'?[box('GT-A-01',0),box('GT-A-02',.002)]:[box(`GT-${b}-01`,.01*i)]});
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(path))),b=>b.toString(16).padStart(2,'0')).join('');keys[b]={plant:`drone/analysis/dayun/block-reviews/Agro_ABC/run/${hash}/head.json`,fruit:`drone/analysis/dayun/fruit-reviews/Agro_ABC/run/${b}/head.json`};set(keys[b].plant,{revision:1,review:{changes:[]},point_versions:{}});set(keys[b].fruit,{revision:1,changes:[]});
 }
 set('drone/analysis/dayun/results/Agro_ABC/index.json',manifest);set('dayun/gawangan-details.json',{objects:[{objectId:'DAYUN-GT-A-01',crops:[{crop:'NANAS',plantingPeriod:'Desember 2024',plantingCohorts:[{period:'2026-08',plantedCount:1}]}]}]});
 set('drone/analysis/dayun/areas/heads/area-1.json',{id:'area-1',name:'Batas nanas baru Blok A sampai A9',revision:1,collection:{features:[box('mask',0)]}});
 const env={PUBLIC_SNAPSHOTS:{head:async k=>values.has(k)?{etag:values.get(k).etag}:null,get:async k=>{gets.set(k,(gets.get(k)||0)+1);const v=values.get(k);return v?{etag:v.etag,text:async()=>JSON.stringify(v.value)}:null;},list:async({prefix})=>({objects:[...values.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key,etag:values.get(key).etag})),truncated:false})}};
 const live=new LiveDayunCounts(env),load=()=>{live.checkedAt=0;return live.load();};return{live,env,values,gets,set,keys,load,prefix};
}
test('nearest polygon edge allocation is unique including GM and unassigned points',()=>{const a=allocator([box('GT-A-01',0),box('GM-A-01',.001),box('GT-A-02',.002)]);assert.deepEqual(a(point('p',.0019)),{zone:'GT-A-02',outside:true});assert.deepEqual(a(point('p',.001)),{zone:'GT-A-01',outside:false});});
test('add, reject, undo, move, and delete update only the changed plant contribution',async()=>{
 const f=await fixture(),row=(d,id)=>d.rows.find(r=>r.zone===id);let d=await f.load();assert.equal(row(d,'GT-A-01').plants,1);assert.equal(row(d,'GT-A-01').newPlants,1);assert.equal(row(d,'GT-A-02').allocated,1);
 const initial=f.live.counts.classifications,reads=[...f.gets.values()].reduce((a,b)=>a+b,0);await f.load();assert.equal(f.live.counts.classifications,initial);assert.equal([...f.gets.values()].reduce((a,b)=>a+b,0),reads);
 const update=(revision,changes)=>f.set(f.keys.A.plant,{revision,review:{changes},point_versions:{p1:revision}});
 update(2,[point('p1',.0005,.0005,'rejected')]);d=await f.load();assert.equal(row(d,'GT-A-01').plants,0);assert.equal(f.live.counts.classifications,initial);
 update(3,[point('p1',.0005)]);d=await f.load();assert.equal(row(d,'GT-A-01').plants,1);assert.equal(f.live.counts.classifications,initial+1);
 update(4,[point('p1',.0019),point('A-manual-added',.0005)]);d=await f.load();assert.equal(row(d,'GT-A-01').plants,1);assert.equal(row(d,'GT-A-02').plants,2);
 update(5,[point('p1',.0019)]);d=await f.load();assert.equal(row(d,'GT-A-01').plants,0);assert.equal(row(d,'GT-A-02').plants,2);assert.equal(d.revisions.A.plants,5);
 assert.equal(f.gets.get(f.prefix+'/block-A/candidates.geojson'),1);
});
test('fruit confirmation, rejection, duplicate links, parent movement and cross-staff revisions are reflected',async()=>{
 const f=await fixture(),fruit=(id,parent,x=.0005,status='confirmed')=>({...point(id,x,.0005,status),properties:{id,status,origin:'manual_fruiting_review',plant_id:parent}}),sum=d=>d.rows.reduce((s,r)=>s+r.fruits,0);
 f.set(f.keys.A.fruit,{revision:2,changes:[fruit('fruit1','p1'),fruit('fruit2','p1'),fruit('pending',null,.0019,'pending')]});let d=await f.load();assert.equal(sum(d),1);assert.equal(d.rows.find(r=>r.zone==='GT-A-01').fruits,1);
 f.set(f.keys.A.plant,{revision:2,review:{changes:[point('p1',.0019)]},point_versions:{p1:2}});d=await f.load();assert.equal(d.rows.find(r=>r.zone==='GT-A-02').fruits,1);
 f.set(f.keys.A.fruit,{revision:3,changes:[fruit('fruit1','p1',.0005,'rejected'),fruit('fruit2','p1',.0005,'rejected'),fruit('outside',null,.0019)]});d=await f.load();assert.equal(sum(d),1);assert.equal(d.rows.find(r=>r.zone==='GT-A-02').fruits,1);assert.equal(d.revisions.A.fruits,3);
 assert(!JSON.stringify(d).includes('coordinates'));assert(!JSON.stringify(d).includes('fruit1'));
});
test('saved boundary edits invalidate membership; missing source fails instead of returning a frozen snapshot',async()=>{const f=await fixture();await f.load();f.set('drone/analysis/dayun/areas/heads/area-1.json',{id:'area-1',name:'Batas nanas baru Blok A sampai A9',revision:2,collection:{features:[box('mask',.002)]}});const d=await f.load();assert.equal(d.rows.find(r=>r.zone==='GT-A-01').newPlants,0);f.values.delete('drone/analysis/dayun/results/Agro_ABC/index.json');await assert.rejects(f.load(),/unavailable/);});
test('public endpoint returns only live aggregates, no-store CORS, rejects writes and never accesses staff credentials',async()=>{let calls=0;const env={DRONE_QUEUE:{idFromName:x=>x,get:()=>({fetch:async()=>{calls++;return Response.json({live:true,rows:[]});}})}};const r=await worker.fetch(new Request('https://worker.test/dayun/live-work-counts.json'),env);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('access-control-allow-origin'),'*');assert.equal(calls,1);assert.equal((await worker.fetch(new Request('https://worker.test/dayun/live-work-counts.json',{method:'POST'}),env)).status,405);});
