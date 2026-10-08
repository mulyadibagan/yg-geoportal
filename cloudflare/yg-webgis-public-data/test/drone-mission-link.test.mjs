import test from 'node:test';
import assert from 'node:assert/strict';
import {handleDroneRequest} from '../src/drone.js';
import {DroneQueue} from '../src/drone-queue.js';
function environment(){const values=new Map();return {values,PUBLIC_SNAPSHOTS:{async get(key){const data=values.get(key);return data==null?null:{text:async()=>data,body:data,size:data.length,writeHttpMetadata(){},httpEtag:'test'}},async put(key,value){values.set(key,String(value))}}}}
const origin='https://webgisyg.id',geometry={type:'Polygon',coordinates:[[[101,.7],[101.001,.7],[101.001,.701],[101,.7]]]};
function request(path,body,token,method='POST'){return new Request('https://drone.test'+path,{method,headers:{origin,'content-type':'application/json',...(token?{'x-job-token':token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})}
async function call(env,r){return handleDroneRequest(r,env,new URL(r.url))}
test('mission and polygon association survive upload, finalization and publication; terminal uploads rejected',async()=>{
 const env=environment(),created=await (await call(env,request('/api/drone/jobs',{sourceType:'upload',missionId:'DRN-unit-test',polygonIds:['DAYUN-BLOCK-A'],missionGeometry:geometry}))).json(),id=created.job.id,token=created.accessToken;
 assert.equal(created.job.missionId,'DRN-unit-test');assert.equal(created.job.accessToken,undefined);
 for(let i=0;i<3;i++){const r=new Request('https://drone.test/api/drone/jobs/'+id+'/files/photo'+i+'.jpg',{method:'PUT',headers:{origin,'x-job-token':token,'content-type':'image/jpeg','content-length':'3'},body:new Uint8Array([255,216,255])});assert.equal((await call(env,r)).status,200)}
 assert.equal((await call(env,request('/api/drone/jobs/'+id+'/finalize',undefined,token))).status,200);
 assert.equal((await call(env,request('/api/drone/jobs/'+id+'/finalize',undefined,token))).status,200);
 let job=JSON.parse(env.values.get('drone/jobs/'+id+'.json'));assert.equal(job.files.length,3);job.status='ready';job.cogKey='test.cog.tif';env.values.set('drone/jobs/'+id+'.json',JSON.stringify(job));env.values.set(job.cogKey,'TIFF');
 assert.equal((await call(env,request('/api/drone/jobs/'+id+'/finalize',undefined,token))).status,409);
 const publication=await (await call(env,request('/api/drone/jobs/'+id+'/publish',undefined,token))).json();assert.equal(publication.publicItem.missionId,'DRN-unit-test');assert.deepEqual(publication.publicItem.missionGeometry,geometry);
 assert.equal((await call(env,request('/api/drone/jobs/'+id+'/queue-complete',undefined,'wrong'))).status,401);
 assert.equal((await call(env,request('/api/drone/jobs/'+id+'/queue-complete',undefined,token))).status,200);
 assert.deepEqual(JSON.parse(env.values.get('drone/queue/pending.json')).jobs,[]);
});
test('invalid mission geometry rejected before storage',async()=>{const env=environment();const r=await call(env,request('/api/drone/jobs',{missionId:'DRN-unit-test',polygonIds:['DAYUN-BLOCK-A'],missionGeometry:{type:'Point',coordinates:[101,.7]}}));assert.equal(r.status,400);assert.equal(env.values.size,0)});
test('queue coordinator serializes additions and removal without erasing a newer job',async()=>{const env=environment(),store=new Map();let serial=Promise.resolve();const state={storage:{get:async key=>structuredClone(store.get(key)),put:async(key,v)=>store.set(key,structuredClone(v))},blockConcurrencyWhile(fn){const next=serial.then(fn);serial=next.catch(()=>{});return next}};const q=new DroneQueue(state,env);const update=(action,id)=>q.fetch(request('/',{action,id}));await Promise.all(Array.from({length:12},(_,i)=>update('add','drn-'+i)));await update('remove','drn-0');const data=await (await q.fetch(new Request('https://queue/'))).json();assert.equal(data.jobs.length,11);assert.ok(data.jobs.includes('drn-11'));assert.deepEqual(JSON.parse(env.values.get('drone/queue/pending.json')).jobs,data.jobs);});
