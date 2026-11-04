import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
const paths=['/api/staff/social-forestry-sungai-linau-field-updates','/api/staff/social-forestry-sungai-linau-photo-20261104','/api/staff/social-forestry-sungai-linau-photo-20261104-114630'];
test('PS field update and photo reject anonymous requests before reading storage',async()=>{
 let reads=0;for(const path of paths){const response=await worker.fetch(new Request('https://webgis-api.yayasangambut.org'+path),{PUBLIC_SNAPSHOTS:{get:async()=>{reads++;}}},{});assert.equal(response.status,401);}assert.equal(reads,0);
});
test('authenticated staff can read the protected report and photo with private cache headers',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({ok:true,scope:'webgis-staff',expiresAt:Date.now()+60000});
 try{for(const [i,path] of paths.entries()){
  let key;const response=await worker.fetch(new Request('https://webgis-api.yayasangambut.org'+path,{headers:{Authorization:'Bearer yg-google-test-fixture'}}),{PUBLIC_SNAPSHOTS:{get:async k=>{key=k;return {body:i?'test-image':'{}',size:i?10:2,httpEtag:'test'};}}},{});
  assert.equal(response.status,200);assert.match(key,/^internal\/social-forestry\/2942\//);assert.match(response.headers.get('cache-control'),/private/);assert.equal(response.headers.get('vary'),'Authorization');assert.equal(response.headers.get('content-type'),i?'image/png':'application/json; charset=utf-8');
 }}finally{globalThis.fetch=original;}
});
test('KUPS-only login cannot read internal PS evidence',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({ok:true,scope:'kups-finance',expiresAt:Date.now()+60000});let reads=0;
 try{for(const path of paths){const response=await worker.fetch(new Request('https://webgis-api.yayasangambut.org'+path,{headers:{Authorization:'Bearer yg-google-kups-test'}}),{PUBLIC_SNAPSHOTS:{get:async()=>{reads++;}}},{});assert.equal(response.status,401);}assert.equal(reads,0);}finally{globalThis.fetch=original;}
});

