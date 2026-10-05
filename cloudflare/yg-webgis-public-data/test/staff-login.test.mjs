import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/main.js';
const env={APPS_SCRIPT_BASE:'https://auth.invalid/exec'};
const request=(body={username:'fixture',password:'fixture-password'},origin='https://webgisyg.id')=>new Request('https://worker.test/api/staff/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
test('fast login forwards credentials in POST only and primes only an upstream-verified staff session',async()=>{
 const original=globalThis.fetch,calls=[];
 const token='test-login-'+crypto.randomUUID();
 globalThis.fetch=async(url,options={})=>{calls.push({url:String(url),options});if(options.method==='POST')return Response.json({ok:true,accepted:true});return Response.json({ok:true,sessionToken:token,username:'fixture',role:'operator',expiresAt:Date.now()+60000});};
 try{
  const response=await worker.fetch(request(),env);assert.equal(response.status,200);assert.equal((await response.json()).sessionToken,token);assert.equal(calls.length,2);
  assert.equal(new URLSearchParams(calls[0].options.body).get('password'),'fixture-password');assert.ok(calls.every(c=>!c.url.includes('fixture-password')));
  assert.equal(response.headers.get('cache-control'),'no-store');
  const gate=await worker.fetch(new Request('https://worker.test/api/staff/drone/jobs',{headers:{authorization:'Bearer '+token}}),{...env,PUBLIC_SNAPSHOTS:{list:async()=>({objects:[]}),get:async()=>null}});
  assert.equal(gate.status,200);assert.equal(calls.length,2,'opening internal workspace should reuse verified session, not reload staff reports');
 }finally{globalThis.fetch=original;}
});
test('failed credential check cannot prime session authorization',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async(url,options={})=>options.method==='POST'?Response.json({ok:true,accepted:true}):Response.json({ok:false,message:'Username atau password tidak benar.'});
 try{const r=await worker.fetch(request(),env);assert.equal((await r.json()).ok,false);assert.equal(r.headers.get('cache-control'),'no-store');}finally{globalThis.fetch=original;}
});
test('fast login rejects invalid payload and unapproved browser origins before contacting upstream',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected')};
 try{assert.equal((await worker.fetch(request({username:'fixture',password:''}),env)).status,400);assert.equal((await worker.fetch(request(undefined,'https://other.invalid'),env)).status,403);assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
test('fast login preflight permits POST JSON without exposing credentials',async()=>{
 const r=await worker.fetch(new Request('https://worker.test/api/staff/login',{method:'OPTIONS'}),env);assert.equal(r.status,204);assert.match(r.headers.get('access-control-allow-methods'),/POST/);assert.match(r.headers.get('access-control-allow-headers'),/content-type/);
});
