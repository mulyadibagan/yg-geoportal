import test from 'node:test';
import assert from 'node:assert/strict';
import {DroneQueue} from '../src/drone-queue.js';
const request=()=>new Request('https://queue.internal/dayun',{method:'POST',body:JSON.stringify({action:'submit',job:{label:'Agro_ABC',status:'pending',id:'test-only'}})});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('slow R2 I/O exceeds 30 seconds without a runtime gate/reset or concurrent lost update',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let value=null,reads=0,writes=0,firstDone=false,secondDone=false;
  const q=new DroneQueue({blockConcurrencyWhile(){throw Error('Do not hold the 30-second initialization gate for R2 I/O');}},
    {PUBLIC_SNAPSHOTS:{get:async()=>{reads++;return value?{text:async()=>value}:null;},put:async(key,body)=>{writes++;await new Promise(resolve=>setTimeout(resolve,31000));value=body;}}});
  const first=q.fetch(request()).then(r=>{firstDone=true;return r.json();});
  const second=q.fetch(request()).then(r=>{secondDone=true;return r.json();});
  await flush();assert.equal(reads,1);assert.equal(writes,1);
  t.mock.timers.tick(30000);await flush();assert.equal(firstDone,false);assert.equal(secondDone,false);assert.equal(reads,1);
  t.mock.timers.tick(1000);const [a,b]=await Promise.all([first,second]);
  assert.equal(a.reused,false);assert.equal(b.reused,true);assert.equal(writes,1);assert.equal(reads,2);
});

test('an unexpected failed request releases the serial queue for the next request',async()=>{
  const q=new DroneQueue({}, {PUBLIC_SNAPSHOTS:{get:async()=>null,put:async()=>{}}});
  const bad=q.fetch(new Request('https://queue.internal/dayun',{method:'POST',body:'{invalid'}));
  const good=q.fetch(request());
  await assert.rejects(bad,SyntaxError);assert.equal((await good).status,200);
});
