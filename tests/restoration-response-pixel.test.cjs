const {test}=require('node:test');
const assert=require('node:assert/strict');
const modulePromise=import('../scripts/sample-restoration-candidate-loss.mjs');
test('Native pixel selection uses half-open bounds and distinguishes equator tiles',async()=>{
 const {cellAt}=await modulePromise,north={origin:[100,10],resolution:[1,-1],width:10,height:10},south={...north,origin:[100,0]};
 assert.deepEqual(cellAt([100,10],north),{row:0,column:0});
 assert.equal(cellAt([110,5],north),null);assert.equal(cellAt([100,0],north),null);
 assert.deepEqual(cellAt([100,0],south),{row:0,column:0});
 assert.deepEqual(cellAt([101.5,8.5],north),{row:1,column:1});
 assert.throws(()=>cellAt([NaN,1],north));assert.throws(()=>cellAt([101,1],{...north,resolution:[1,1]}));
});
test('Loss observations preserve missing/water classes and cannot infer fire cause or 2026 loss',async()=>{
 const {observation}=await modulePromise;
 assert.equal(observation(25,1,'2025-12-31').sameCalendarYear,true);
 assert.equal(observation(25,1,'2026-01-01').sameCalendarYear,false);
 assert.equal(observation(0,1,'2025-01-01').lossYear,null);
 for(const mask of [0,2]){const o=observation(25,mask,'2025-01-01');assert.equal(o.lossYear,null);assert.equal(o.sameCalendarYear,false);}
 assert.throws(()=>observation(26,1,'2025-01-01'));assert.throws(()=>observation(1,3,'2025-01-01'));
 assert.throws(()=>observation(25,1,'2025-02-29'));assert.throws(()=>observation(25,1,null));
 assert.equal(Object.hasOwn(observation(25,1,'2025-01-01'),'score'),false);
});
