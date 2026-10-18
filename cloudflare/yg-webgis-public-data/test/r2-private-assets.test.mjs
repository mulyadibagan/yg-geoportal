import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {signPrivateAsset} from '../src/r2-private-assets.js';
import {handleDroneRequest} from '../src/drone.js';
const settings={DRONE_R2_ACCOUNT_ID:'a'.repeat(32),DRONE_R2_BUCKET:'private-drone',DRONE_R2_ACCESS_KEY_ID:'test-access',DRONE_R2_SECRET_ACCESS_KEY:'test-secret'};
const base='/api/staff/drone/analysis/Agro_ABC',prefix='drone/analysis/dayun/results/Agro_ABC/run-1';
function environment(){return {...settings,PUBLIC_SNAPSHOTS:{get:async key=>key.endsWith('/index.json')?{text:async()=>JSON.stringify({run:'run-1',prefix,files:['block-A/native.tif','metadata.json']})}:null}};}
async function call(body,staff=true,options={}){const env=environment();const url=new URL('https://worker.test'+base+'/asset-links');return handleDroneRequest(new Request(url,{method:'POST',headers:{origin:options.origin||'https://webgisyg.id','content-type':'application/json',...(staff?{authorization:'Bearer staff'}:{})},body:JSON.stringify(body)}),env,url,async token=>token==='staff');}
test('signature matches independently calculated AWS SigV4 and does not sign range or staff headers',async()=>{
  const now=new Date('2026-10-18T14:00:00Z'),signed=await signPrivateAsset(settings,prefix+'/a b+!.tif',{now,ttl:9999}),url=new URL(signed.url);
  assert.equal(signed.expiresAt,now.getTime()+300000);assert.equal(url.searchParams.get('X-Amz-Expires'),'300');
  assert.equal(url.searchParams.get('X-Amz-SignedHeaders'),'host');assert.equal(url.searchParams.get('response-cache-control'),'private, no-store');
  const signature=url.searchParams.get('X-Amz-Signature');url.searchParams.delete('X-Amz-Signature');
  const enc=s=>encodeURIComponent(s).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
  const query=[...url.searchParams].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>enc(k)+'='+enc(v)).join('&');
  // AWS sorts raw ASCII keys, uppercase X precedes lowercase response.
  const ascii=[...url.searchParams].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>enc(k)+'='+enc(v)).join('&');
  const canonical=['GET',url.pathname,ascii,`host:${url.host}\n`,'host','UNSIGNED-PAYLOAD'].join('\n');
  const hmac=(k,v)=>createHmac('sha256',k).update(v).digest();let key='AWS4test-secret';for(const value of ['20261018','auto','s3','aws4_request'])key=hmac(key,value);
  const expected=hmac(key,'AWS4-HMAC-SHA256\n20261018T140000Z\n20261018/auto/s3/aws4_request\n'+createHash('sha256').update(canonical).digest('hex')).toString('hex');
  assert.equal(signature,expected);assert.ok(url.pathname.includes('a%20b%2B%21.tif'));assert.ok(!signed.url.includes('test-secret'));
});
test('only authenticated staff receive manifest-scoped short lived links',async()=>{
  assert.equal((await call({files:['block-A/native.tif']},false)).status,401);
  assert.equal((await call({files:['block-A/native.tif']},true,{origin:'https://evil.test'})).status,403);
  const response=await call({files:['block-A/native.tif','metadata.json']}),data=await response.json();assert.equal(response.status,200);assert.equal(data.links.length,2);assert.equal(response.headers.get('cache-control'),'no-store');
  const url=new URL(data.links[0].url);assert.ok(decodeURIComponent(url.pathname).endsWith(prefix+'/block-A/native.tif'));assert.ok(!JSON.stringify(data).includes('test-secret'));assert.ok(!JSON.stringify(data).includes('Bearer'));
});
test('unlisted files, traversal, invalid batches and over-sized batches never produce links',async()=>{
  for(const files of [[],['../../secrets'],['not-listed.tif'],['metadata.json','not-listed.tif'],Array(65).fill('metadata.json')])assert.ok([400,404].includes((await call({files})).status));
  const env=environment();delete env.DRONE_R2_SECRET_ACCESS_KEY;const url=new URL('https://worker.test'+base+'/asset-links');const r=await handleDroneRequest(new Request(url,{method:'POST',headers:{origin:'https://webgisyg.id',authorization:'Bearer staff'},body:'{"files":["metadata.json"]}'}),env,url,async()=>true);assert.equal(r.status,503);
});
