const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/report-v6.js'),'utf8');
function fn(name){const a=source.search(new RegExp('  (?:async )?function '+name+'\\('));const b=source.slice(a+3).search(/\n  (?:async )?function /);return source.slice(a,b<0?undefined:a+3+b);}
test('unresponsive image worker terminates and falls back without blocking submission',async()=>{
 let timeout,worker,terminated=0,fallback=0;
 class Worker {constructor(){worker=this;}postMessage(){}terminate(){terminated++;}}
 const ctx=vm.createContext({window:{Worker},Worker,FileReader:class{},setTimeout:f=>(timeout=f,1),clearTimeout(){},console:{warn(){}},compressImageOnPage:async()=>{fallback++;return 'data:image/jpeg;base64,ok';}});
 vm.runInContext(fn('compressImageInWorker')+'\n'+fn('compressImage'),ctx);
 const pending=ctx.compressImage({type:'image/jpeg'},1280,.7);timeout();
 assert.equal(await pending,'data:image/jpeg;base64,ok');assert.equal(terminated,1);assert.equal(fallback,1);
 worker.onmessage({data:{ok:true,blob:{}}});assert.equal(terminated,1);
});
test('stalled polygon fetch aborts and master selection falls back to JSONP',async()=>{
 let timeout,aborted=0,fallback=0;
 const ctx=vm.createContext({AbortController,setTimeout:f=>(timeout=f,1),clearTimeout(){},Date,OBJECTS_API:'https://example.org/exec?page=objects',fetch:(_,o)=>new Promise((_,reject)=>o.signal.addEventListener('abort',()=>{aborted++;reject(Error('aborted'));})),jsonpRequest:async()=>{fallback++;return {features:[{properties:{Object_ID:'TANJUNG-KURAS'}}]};}});
 vm.runInContext(fn('readPolygonJSON')+'\n'+fn('readMasterPolygons'),ctx);
 const pending=ctx.readMasterPolygons();timeout();const result=await pending;
 assert.equal(aborted,1);assert.equal(fallback,1);assert.equal(result.features[0].properties.Object_ID,'TANJUNG-KURAS');
});
