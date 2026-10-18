const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../js/private-r2-assets.js');
const base='/api/staff/drone/analysis/Agro_ABC';
function setup(){let active=true,clock=100000;const calls=[],downloads=[];const files=Array.from({length:130},(_,i)=>`block-A/${i}.tif`);
  const client=create({current:()=>active,now:()=>clock,api:async(path,options)=>{const body=JSON.parse(options.body);calls.push({path,body});return{json:async()=>({ok:true,links:body.files.map(file=>({file,url:'https://'+'a'.repeat(32)+'.r2.cloudflarestorage.com/private/'+file+'?X-Amz-Signature=test',expiresAt:clock+300000}))})}},fetcher:async(url,options)=>{downloads.push({url,options});return new Response('TIFF',{status:200})}});
  client.register(base,{assetDelivery:'r2-signed-v1',run:'one',files});return{client,calls,downloads,path:i=>base+'/files/'+files[i],expire:()=>clock+=280000,logout:()=>{active=false;client.clear();}};
}
test('simultaneous crop reads share one authorization batch and transfer directly from R2 without bearer',async()=>{
  const s=setup();await Promise.all([s.client.get(s.path(0),{headers:{Authorization:'Bearer secret',range:'bytes=0-15'}}),s.client.get(s.path(1))]);
  assert.equal(s.calls.length,1);assert.equal(s.calls[0].body.files.length,64);assert.equal(s.downloads.length,2);
  for(const d of s.downloads){assert.match(d.url,/r2\.cloudflarestorage\.com/);assert.equal(d.options.headers.has('authorization'),false);assert.equal(d.options.credentials,'omit');assert.equal(d.options.referrerPolicy,'no-referrer');}
  assert.equal(s.downloads[0].options.headers.get('range'),'bytes=0-15');
});
test('navigation reuses signed links, expiry refreshes them, and logout stops all reads',async()=>{
  const s=setup();await s.client.get(s.path(0));await s.client.get(s.path(3));assert.equal(s.calls.length,1);s.expire();await s.client.get(s.path(0));assert.equal(s.calls.length,2);
  s.logout();await assert.rejects(s.client.get(s.path(1)),/Sesi/);assert.equal(s.downloads.length,3);
});
test('failed batch is retryable and never falls back to Worker image proxy',async()=>{
  let attempts=0;const client=create({current:()=>true,api:async()=>{attempts++;throw Error('signer unavailable');},fetcher:async()=>{throw Error('must not fetch')}});client.register(base,{assetDelivery:'r2-signed-v1',files:['one.tif']});
  await assert.rejects(client.get(base+'/files/one.tif'),/signer unavailable/);await assert.rejects(client.get(base+'/files/one.tif'),/signer unavailable/);assert.equal(attempts,2);
});
