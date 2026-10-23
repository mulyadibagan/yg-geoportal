const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../js/private-r2-assets.js');
const base='/api/staff/drone/analysis/Agro_ABC';
function setup(options={}){let active=true,clock=100000;const calls=[],downloads=[];const files=Array.from({length:130},(_,i)=>`block-A/${i}.tif`);
  const client=create({...options,current:()=>active,now:()=>clock,api:async(path,options)=>{const body=JSON.parse(options.body);calls.push({path,body});return{json:async()=>({ok:true,links:body.files.map(file=>({file,url:'https://'+'a'.repeat(32)+'.r2.cloudflarestorage.com/private/'+file+'?X-Amz-Signature=test',expiresAt:clock+300000}))})}},fetcher:async(url,options)=>{downloads.push({url,options});return new Response('TIFF',{status:200})}});
  client.register(base,{assetDelivery:'r2-signed-v1',run:'one',files});return{client,calls,downloads,path:i=>base+'/files/'+files[i],expire:()=>clock+=280000,logout:()=>{active=false;client.clear();}};
}
test('simultaneous crop reads share one authorization batch and transfer directly from R2 without bearer',async()=>{
  const s=setup();await Promise.all([s.client.get(s.path(0),{headers:{Authorization:'Bearer secret',range:'bytes=0-15'}}),s.client.get(s.path(1))]);
  assert.equal(s.calls.length,1);assert.equal(s.calls[0].body.files.length,64);assert.equal(s.downloads.length,2);
  for(const d of s.downloads){assert.match(d.url,/r2\.cloudflarestorage\.com/);assert.equal(d.options.headers.has('authorization'),false);assert.equal(d.options.credentials,'omit');assert.equal(d.options.referrerPolicy,'no-referrer');}
  assert.equal(s.downloads[0].options.headers.get('range'),'bytes=0-15');
});
test('downloaded TIFF bytes survive signed-link expiry; uncached files refresh authorization and logout stops reads',async()=>{
  const s=setup();await s.client.get(s.path(0));await s.client.get(s.path(3));assert.equal(s.calls.length,1);s.expire();await s.client.get(s.path(0));assert.equal(s.calls.length,1);assert.equal(s.downloads.length,2);await s.client.get(s.path(4));assert.equal(s.calls.length,2);
  s.logout();await assert.rejects(s.client.get(s.path(1)),/Sesi/);assert.equal(s.downloads.length,3);
});
test('failed batch is retryable and never falls back to Worker image proxy',async()=>{
  let attempts=0;const client=create({current:()=>true,api:async()=>{attempts++;throw Error('signer unavailable');},fetcher:async()=>{throw Error('must not fetch')}});client.register(base,{assetDelivery:'r2-signed-v1',files:['one.tif']});
  await assert.rejects(client.get(base+'/files/one.tif'),/signer unavailable/);await assert.rejects(client.get(base+'/files/one.tif'),/signer unavailable/);assert.equal(attempts,2);
});

test('unchanged source manifests retain signed batches across reopening a block',async()=>{
 const s=setup();await s.client.get(s.path(0));s.client.register(base,{assetDelivery:'r2-signed-v1',run:'one',files:Array.from({length:130},(_,i)=>`block-A/${i}.tif`)});await s.client.get(s.path(1));assert.equal(s.calls.length,1);
});

test('only two complete body transfers run concurrently; logout discards queued downloads',async()=>{
 let current=true,running=0,peak=0;const release=[];const client=create({current:()=>current,api:async()=>({json:async()=>({ok:true,links:[0,1,2,3].map(i=>({file:i+'.tif',url:'https://'+'a'.repeat(32)+'.r2.cloudflarestorage.com/'+i+'?X-Amz-Signature=test',expiresAt:Date.now()+300000}))})}),fetcher:async()=>{running++;peak=Math.max(peak,running);return{status:200,ok:true,headers:new Headers(),blob:()=>new Promise(resolve=>release.push(()=>{running--;resolve(new Blob(['tiff']));}))};}});
 client.register(base,{assetDelivery:'r2-signed-v1',files:[0,1,2,3].map(i=>i+'.tif')});const promises=[0,1,2,3].map(i=>client.get(base+'/files/'+i+'.tif'));const all=Promise.allSettled(promises);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(running,2);assert.equal(release.length,2);current=false;client.clear();release.splice(0).forEach(fn=>fn());const results=await all;assert.equal(peak,2);assert.ok(results.every(r=>r.status==='rejected'));assert.equal(running,0);
});

test('rate-limit cooldown stops automatic signer retries while another session remains independent',async()=>{
 let calls=0,clock=0;const client=create({current:()=>true,now:()=>clock,api:async()=>{calls++;throw Object.assign(Error('Too fast'),{status:429,details:{retry_after:60}});}});client.register(base,{assetDelivery:'r2-signed-v1',files:['one.tif']});
 await assert.rejects(client.get(base+'/files/one.tif'),/Too fast/);await assert.rejects(client.get(base+'/files/one.tif'),/dijeda/);assert.equal(calls,1);clock=61000;await assert.rejects(client.get(base+'/files/one.tif'),/Too fast/);assert.equal(calls,2);
});


test('revisiting a cached TIFF 100 times makes no new Worker authorization or R2 transfer',async()=>{const s=setup();const first=await s.client.get(s.path(0));assert.equal(await first.text(),'TIFF');for(let i=0;i<100;i++){if(i===50)s.expire();assert.equal(await(await s.client.get(s.path(0))).text(),'TIFF');}assert.equal(s.calls.length,1);assert.equal(s.downloads.length,1);});

test('same-file concurrent consumers share one complete transfer and independently readable responses',async()=>{const s=setup();const responses=await Promise.all(Array.from({length:10},()=>s.client.get(s.path(0))));assert.deepEqual(await Promise.all(responses.map(r=>r.text())),Array(10).fill('TIFF'));assert.equal(s.downloads.length,1);assert.equal(s.calls.length,1);});

test('LRU byte and file bounds evict only old entries, while oversized files are not retained',async()=>{const s=setup({maxCacheBytes:8,maxCacheFiles:2});await s.client.get(s.path(0));await s.client.get(s.path(1));await s.client.get(s.path(0));await s.client.get(s.path(2));assert.equal(s.downloads.length,3);await s.client.get(s.path(0));assert.equal(s.downloads.length,3);await s.client.get(s.path(1));assert.equal(s.downloads.length,4);const small=setup({maxCacheBytes:3});await small.client.get(small.path(0));await small.client.get(small.path(0));assert.equal(small.downloads.length,2);});

test('new imagery identity invalidates bytes even if the file list and run names are unchanged',async()=>{const s=setup();await s.client.get(s.path(0));s.client.register(base,{assetDelivery:'r2-signed-v1',run:'one',prefix:'new-private-revision',files:Array.from({length:130},(_,i)=>`block-A/${i}.tif`)});await s.client.get(s.path(0));assert.equal(s.downloads.length,2);assert.equal(s.calls.length,2);});

test('partial responses and changing JSON are never served as cached full images',async()=>{const s=setup();await s.client.get(s.path(0));await s.client.get(s.path(0),{headers:{range:'bytes=0-2'}});assert.equal(s.downloads.length,2);s.client.register(base,{assetDelivery:'r2-signed-v1',run:'one',files:['analysis.json']});await s.client.get(base+'/files/analysis.json');await s.client.get(base+'/files/analysis.json');assert.equal(s.downloads.length,4);});

test('an aborted consumer does not cancel a second consumer or poison later cached visits',async()=>{let release,reads=0;const client=create({current:()=>true,api:async()=>({json:async()=>({ok:true,links:[{file:'one.tif',url:'https://'+'a'.repeat(32)+'.r2.cloudflarestorage.com/one?X-Amz-Signature=test',expiresAt:Date.now()+300000}]})}),fetcher:async()=>{reads++;await new Promise(r=>release=r);return new Response('TIFF');}});client.register(base,{assetDelivery:'r2-signed-v1',files:['one.tif']});const path=base+'/files/one.tif',controller=new AbortController(),one=client.get(path,{signal:controller.signal}),two=client.get(path);await new Promise(r=>setImmediate(r));controller.abort();await assert.rejects(one);release();assert.equal(await(await two).text(),'TIFF');assert.equal(await(await client.get(path)).text(),'TIFF');assert.equal(reads,1);});

test('explicit cache clear frees bytes and forces a fresh authorized transfer',async()=>{const s=setup();await s.client.get(s.path(0));s.client.clear();s.client.register(base,{assetDelivery:'r2-signed-v1',run:'one',files:Array.from({length:130},(_,i)=>`block-A/${i}.tif`)});await s.client.get(s.path(0));assert.equal(s.calls.length,2);assert.equal(s.downloads.length,2);});

test('run-scoped candidate and boundary GeoJSON reuse the existing private byte cache across block visits',async()=>{
 const s=setup(),files=['block-B/candidates.geojson','block-B/zones.geojson'];s.client.register(base,{assetDelivery:'r2-signed-v1',run:'one',files});
 for(let visit=0;visit<3;visit++){s.client.register(base,{assetDelivery:'r2-signed-v1',run:'one',files});for(const file of files)await s.client.get(base+'/files/'+file);}
 assert.equal(s.downloads.length,2);assert.equal(s.calls.length,1);
 s.client.register(base,{assetDelivery:'r2-signed-v1',run:'two',files});await s.client.get(base+'/files/'+files[0]);assert.equal(s.downloads.length,3);
});


test('unregistering a source never serves bytes from its previous signed-image manifest',async()=>{const s=setup();await s.client.get(s.path(0));s.client.register(base,{run:'new-source',files:['block-A/0.tif']});assert.equal(s.client.eligible(s.path(0)),null);await assert.rejects(s.client.get(s.path(0)),/tidak terdaftar/);assert.equal(s.downloads.length,1);});
