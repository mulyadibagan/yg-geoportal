const test=require('node:test'),assert=require('node:assert/strict');
const retry=require('../js/dayun-save-retry.js');
const path='/api/staff/drone/analysis/Agro_ABC/block-review?block=A';
const options={method:'POST',body:JSON.stringify({patch:{schema:'dayun-block-point-patch-v1',operations:[{operation_id:'operation-12345678'}]}})};
const failure=(status,name)=>Object.assign(Error('temporary'),{status,...(name?{name}:{})});
test('transient saves back off, honor Retry-After, and stop after three retries',async()=>{
  const delays=[],notices=[];let calls=0;
  await assert.rejects(retry.run(async()=>{calls++;throw Object.assign(failure(503),{retryAfterMs:30000});},{path,options,wait:async ms=>delays.push(ms),random:()=>0,onRetry:n=>notices.push(n)}));
  assert.equal(calls,4);assert.deepEqual(delays,[30000,30000,30000]);assert.deepEqual(notices.map(n=>n.attempt),[1,2,3]);
});
test('network/timeout and 502/503/504/429 recover; validation, conflicts and access failures never loop',async()=>{
  for(const error of [failure(502),failure(503),failure(504),failure(429),failure(undefined,'TypeError'),failure(undefined,'TimeoutError')]){
    let calls=0;const delays=[];
    assert.equal(await retry.run(async()=>{if(++calls===1)throw error;return 'saved';},{path,options,wait:async ms=>delays.push(ms),random:()=>0}),'saved');
    assert.equal(calls,2);assert.deepEqual(delays,[5000]);
  }
  for(const status of [400,401,403,409,413]){let calls=0;await assert.rejects(retry.run(async()=>{calls++;throw failure(status);},{path,options,wait:async()=>assert.fail('must not wait')}));assert.equal(calls,1);}
});
test('only explicitly idempotent point/fruit POSTs retry; legacy snapshots and unrelated endpoints run once',async()=>{
  for(const [p,o]of [[path,{...options,body:'{}'}],[path,{...options,body:'invalid'}],[path,{...options,method:'GET'}],['/api/staff/drone/analysis/areas',options],['/api/staff/drone/jobs',options]]){
    let calls=0;await assert.rejects(retry.run(async()=>{calls++;throw failure(503);},{path:p,options:o}));assert.equal(calls,1);
  }
  const fruit='/api/staff/drone/analysis/Agro_ABC/fruiting-review?block=B';
  assert.equal(retry.eligible(fruit,{method:'POST',body:JSON.stringify({operation:{operation_id:'fruit-operation-1234'}})}),true);
  assert.equal(retry.eligible(fruit,{method:'POST',body:JSON.stringify({operations:[{operation_id:'fruit-operation-1234'},{}]})}),false);
});
test('leaving the editor or ending the session cancels the delayed retry',async()=>{
  let active=true,calls=0;
  await assert.rejects(retry.run(async()=>{calls++;throw failure(503);},{path,options,current:()=>active,wait:async()=>{active=false;}}));
  assert.equal(calls,1);
});
