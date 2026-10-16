import test from 'node:test';
import assert from 'node:assert/strict';
import {handleDroneRequest} from '../src/drone.js';
import {DroneQueue} from '../src/drone-queue.js';
const route='/api/staff/drone/analysis/requests';
function setup(){
 const values=new Map(),storage=new Map();let serial=Promise.resolve();
 const env={PUBLIC_SNAPSHOTS:{get:async key=>values.has(key)?{text:async()=>values.get(key)}:null,put:async(key,v)=>values.set(key,String(v))}};
 const state={storage:{get:async key=>storage.get(key),put:async(key,v)=>storage.set(key,v)},blockConcurrencyWhile(fn){const next=serial.then(fn);serial=next.catch(()=>{});return next;}};
 const queue=new DroneQueue(state,env);env.DRONE_QUEUE={idFromName:name=>{assert.equal(name,'dayun-analysis');return name;},get:()=>queue};
 return{env,values,async call(driveUrl,authorized=true){const url=new URL('https://worker.test'+route);const request=new Request(url,{method:'POST',headers:{origin:'https://webgisyg.id','content-type':'application/json',authorization:authorized?'Bearer staff':''},body:JSON.stringify({driveUrl})});return handleDroneRequest(request,env,url,async token=>token==='staff');}};
}
const abc='https://drive.google.com/file/d/11kWmzkdTWVuxrDJMOYk3JfN34xeoZNRx/view?usp=drive_link';
test('staff paste link creates one private request and duplicate clicks reuse it',async()=>{
 const s=setup();const responses=await Promise.all([s.call(abc),s.call(abc)]),data=await Promise.all(responses.map(r=>r.json()));
 assert.ok(responses.every(r=>r.status===202));assert.equal(data[0].job.id,data[1].job.id);assert.equal(data[0].job.label,'Agro_ABC');assert.equal(data[0].job.status,'pending');
 assert.deepEqual([...s.values.keys()],['drone/analysis/dayun/requests/Agro_ABC.json']);assert.ok(!s.values.has('drone/queue/pending.json'));
});
test('anonymous requests and non-Drive or unregistered links never write jobs',async()=>{
 const s=setup();assert.equal((await s.call(abc,false)).status,401);
 for(const link of ['http://drive.google.com/file/d/id/view','https://drive.google.com.evil.test/file/d/id/view','https://drive.google.com/drive/folders/anything','https://drive.google.com/file/d/unregistered/view'])assert.equal((await s.call(link)).status,400);
 assert.equal(s.values.size,0);
});
test('completed analysis can be rerun without touching a census or JPEG queue',async()=>{
 const s=setup(),first=await(await s.call(abc)).json(),key='drone/analysis/dayun/requests/Agro_ABC.json';
 s.values.set(key,JSON.stringify({...first.job,status:'coverage_ready'}));const second=await(await s.call(abc)).json();assert.notEqual(second.job.id,first.job.id);assert.equal(second.job.censusChanged,false);
});
