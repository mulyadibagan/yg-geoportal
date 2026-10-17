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


test('native TIFF byte ranges remain authenticated, allowlisted, private and precisely bounded',async()=>{
 const env=environment(),bytes=new TextEncoder().encode('private result'),reads=[];
 env.PUBLIC_SNAPSHOTS.head=async key=>{reads.push(key);return{size:bytes.length}};
 const get=env.PUBLIC_SNAPSHOTS.get;env.PUBLIC_SNAPSHOTS.get=async(key,options)=>{if(key.endsWith('/index.json'))return get(key);reads.push(key);const r=options?.range;return{body:r?bytes.slice(r.offset,r.offset+r.length):bytes,size:bytes.length}};
 const call=(range,token='staff',method='GET',file='A-01/x0_y0.tif')=>{const url=new URL('https://worker.test'+base+'/files/'+file);return handleDroneRequest(new Request(url,{method,headers:{range,...(token?{authorization:'Bearer '+token}:{})}}),env,url,async t=>t==='staff');};
 assert.equal((await call('bytes=0-3','')).status,401);assert.equal(reads.length,0);assert.equal((await call('bytes=0-3','staff','GET','missing.tif')).status,404);assert.equal(reads.length,0);
 for(const [range,text,contentRange]of [['bytes=0-3','priv','bytes 0-3/14'],['bytes=8-','result','bytes 8-13/14'],['bytes=-6','result','bytes 8-13/14'],['bytes=8-100','result','bytes 8-13/14']]){const r=await call(range);assert.equal(r.status,206);assert.equal(await r.text(),text);assert.equal(r.headers.get('content-range'),contentRange);assert.equal(r.headers.get('content-length'),String(text.length));assert.match(r.headers.get('cache-control'),/private, no-store/);assert.equal(r.headers.get('accept-ranges'),'bytes');}
 const head=await call('bytes=2-5','staff','HEAD');assert.equal(head.status,206);assert.equal(head.headers.get('content-length'),'4');assert.equal(await head.text(),'');
 for(const range of ['bytes=14-','bytes=5-2','bytes=-0','bytes=-','bytes=0-1,4-5','bytes=0-9007199254740992','bytes=-9999999999999999999']){const r=await call(range);assert.equal(r.status,416,range);assert.equal(r.headers.get('content-range'),'bytes */14');assert.match(r.headers.get('cache-control'),/private, no-store/);}
 assert.ok(reads.every(key=>key.startsWith(prefix+'/')));
});
