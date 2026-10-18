import test from 'node:test';
import assert from 'node:assert/strict';
import {droneUsageGuard} from '../src/drone-usage.js';
import {handleDroneRequest} from '../src/drone.js';
const request=new Request('https://worker.test/api/staff/drone/analysis/Agro_ABC/asset-links',{method:'POST',headers:{origin:'https://webgisyg.id',authorization:'Bearer staff'},body:'{}'});
test('four sessions on one Wi-Fi have independent asset allowance and tokens are hashed',async()=>{
 const counts=new Map(),limiter={async limit({key}){counts.set(key,(counts.get(key)||0)+1);return{success:counts.get(key)<=20};}},env={DRONE_ASSET_LIMIT:limiter};
 for(let i=0;i<20;i++)assert.equal(await droneUsageGuard(request,env,'assets','session-1'),null);
 assert.equal((await droneUsageGuard(request,env,'assets','session-1')).status,429);
 for(const token of ['session-2','session-3','session-4'])assert.equal(await droneUsageGuard(request,env,'assets',token),null);
 assert.equal(counts.size,4);assert.ok([...counts.keys()].every(key=>!key.includes('session-')&&/^assets:[a-f0-9]{64}$/.test(key)));
});
test('quota-exhausted imagery returns retry guidance after auth; anonymous requests cannot consume a staff counter',async()=>{
 let count=0;const env={ENVIRONMENT:'production',DRONE_ASSET_LIMIT:{async limit(){count++;return{success:false};}}},url=new URL(request.url);
 const denied=await handleDroneRequest(request.clone(),env,url,async()=>false);assert.equal(denied.status,401);assert.equal(count,0);
 const limited=await handleDroneRequest(request.clone(),env,url,async()=>true);assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');assert.match(limited.headers.get('access-control-allow-origin'),/webgisyg/);assert.equal((await limited.json()).error,'drone_usage_limited');
});
test('expensive operations fail closed if their deployed limiter is missing',async()=>{
 assert.equal((await droneUsageGuard(request,{ENVIRONMENT:'production'},'assets','staff')).status,503);
 assert.equal(await droneUsageGuard(request,{},'assets','local-test'),null);
});
