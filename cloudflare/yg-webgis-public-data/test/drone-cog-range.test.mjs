import test from 'node:test';
import assert from 'node:assert/strict';
import {handleDroneRequest} from '../src/drone.js';
const id='drn-range-test';
const job={id,status:'ready',cogKey:'private.tif',accessToken:'owner'};
const env={PUBLIC_SNAPSHOTS:{async get(key,options){
  if(key===`drone/jobs/${id}.json`)return {text:async()=>JSON.stringify(job)};
  if(key==='private.tif')return {body:new Uint8Array(16),size:1024,range:options?.range?{offset:0,length:16}:undefined,httpEtag:'"test"',writeHttpMetadata:headers=>headers.set('content-type','image/tiff')};
}}};
const url=new URL(`https://worker.test/api/drone/jobs/${id}/cog`);
test('private COG rejects anonymous reads and serves authorized ranges with exposed headers',async()=>{
  const denied=await handleDroneRequest(new Request(url),env,url,async()=>false);
  assert.equal(denied.status,401);
  const response=await handleDroneRequest(new Request(url,{headers:{authorization:'Bearer staff',range:'bytes=0-15',origin:'https://webgisyg.id'}}),env,url,async token=>token==='staff');
  assert.equal(response.status,206);
  assert.equal(response.headers.get('content-range'),'bytes 0-15/1024');
  assert.equal(response.headers.get('content-length'),'16');
  assert.match(response.headers.get('access-control-expose-headers'),/content-range/);
  assert.match(response.headers.get('cache-control'),/private/);
});
test('COG preflight allows authorization and range',async()=>{
  const response=await handleDroneRequest(new Request(url,{method:'OPTIONS',headers:{origin:'https://webgisyg.id'}}),env,url);
  assert.match(response.headers.get('access-control-allow-headers'),/authorization, range/);
});
