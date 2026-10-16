import test from 'node:test';
import assert from 'node:assert/strict';
import {handleDroneRequest,isDroneRoute} from '../src/drone.js';
const base='/api/staff/drone/analysis/Agro_ABC';
const prefix='drone/analysis/dayun/results/Agro_ABC/123-1';
const manifest={prefix,files:['metadata.json','A-01/x0_y0.tif']};
function environment(){const reads=[];return{reads,PUBLIC_SNAPSHOTS:{async get(key){reads.push(key);if(key.endsWith('/index.json'))return{text:async()=>JSON.stringify(manifest)};return{body:'private result',size:14}}}}}
async function request(path,env,token=''){const url=new URL('https://worker.test'+path);return handleDroneRequest(new Request(url,{headers:token?{authorization:'Bearer '+token}:{}}),env,url,async token=>token==='staff');}
test('private analysis authenticates before any storage access',async()=>{const env=environment();assert.ok(isDroneRoute(base));assert.equal((await request(base,env)).status,401);assert.equal(env.reads.length,0)});
test('private analysis permits only manifest files and never exposes checkpoint prefix',async()=>{const env=environment();const response=await request(base+'/files/metadata.json',env,'staff');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/json');assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal((await request(base+'/files/credentials.json',env,'staff')).status,404);assert.equal((await request('/api/staff/drone/analysis/checkpoints',env,'staff')).status,404);});
