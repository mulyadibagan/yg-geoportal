import test from 'node:test';
import assert from 'node:assert/strict';
import {meritechTile} from '../src/meritech.js';
const url='https://api.example/api/staff/meritech/tile/17/102023/65224';
const request=(path=url,token='staff')=>new Request(path,{headers:{origin:'https://webgisyg.id',authorization:`Bearer ${token}`}});
test('anonymous and invalid tokens cannot request upstream tiles',async()=>{
 let calls=0; const upstream=()=>{calls++;throw Error('unexpected')};
 const result=await meritechTile(request(url,'bad'),{},async()=>false,upstream);
 assert.equal(result.status,401);assert.equal(calls,0);
});
test('invalid zoom and out-of-region tiles are rejected before upstream access',async()=>{
 let calls=0;const upstream=()=>{calls++;throw Error('unexpected')};
 for(const path of [url.replace('/17/','/20/'),url.replace('/102023/65224','/0/0')]) assert.equal((await meritechTile(request(path),{},async()=>true,upstream)).status,400);
 assert.equal(calls,0);
});
test('fixed Meritech origin, manual redirects, staff CORS and no token forwarding',async()=>{
 const result=await meritechTile(request(),{},async()=>true,async(target,options)=>{
  assert.equal(target,'https://petadasar.meritech.cloud/tile/17/102023/65224.jpg');
  assert.equal(options.redirect,'manual');assert.equal(options.headers,undefined);
  return new Response(new Uint8Array([255,216,255]),{headers:{'content-type':'Image/jpg'}});
 });
 assert.equal(result.status,200);assert.equal(result.headers.get('access-control-allow-origin'),'https://webgisyg.id');assert.equal((await result.arrayBuffer()).byteLength,3);
});
test('redirects, non-images and oversized streams fail without returning a partial tile',async()=>{
 for(const response of [new Response(null,{status:302,headers:{location:'https://other.example'}}),new Response('html',{headers:{'content-type':'text/html'}}),new Response(new Uint8Array(1048577),{headers:{'content-type':'image/jpeg'}})]) {
  assert.equal((await meritechTile(request(),{},async()=>true,async()=>response)).status,502);
 }
});

test('missing source tile returns 404 so export can preserve a transparent gap',async()=>{
 let calls=0;const result=await meritechTile(request(),{},async()=>true,async()=>{calls++;return new Response(null,{status:404});});
 assert.equal(result.status,404);assert.equal(calls,1);assert.equal((await result.json()).error,'source_tile_missing');
});
test('transient failures and timeouts are retried but never promoted to missing imagery',async()=>{
 for(const failure of ['status','network']){
  let calls=0;const result=await meritechTile(request(),{},async()=>true,async()=>{calls++;if(calls<3){if(failure==='network')throw Error('timeout');return new Response(null,{status:503});}return new Response(new Uint8Array([255,216,255]),{headers:{'content-type':'image/jpeg'}});});
  assert.equal(result.status,200);assert.equal(calls,3);
 }
 let calls=0;const result=await meritechTile(request(),{},async()=>true,async()=>{calls++;return new Response(null,{status:502});});
 assert.equal(result.status,502);assert.equal(calls,3);
});
