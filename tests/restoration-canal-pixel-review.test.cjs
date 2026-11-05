const {test}=require('node:test'),assert=require('node:assert/strict');
const modulePromise=import('../scripts/review-restoration-canal-pixels.mjs');
test('Native footprint windows respect pixel centres and tile seams without buffers',async()=>{
 const {pixelBounds,centreWindow}=await modulePromise,grid={origin:[0,4],resolution:[1,-1],width:4,height:4};
 assert.deepEqual(pixelBounds(grid,1,2),[2,2,3,3]);
 assert.deepEqual(centreWindow([.5,1.5,2.5,3.5],grid),[0,0,2,2]);
 assert.deepEqual(centreWindow([3,0,5,4],grid),[3,0,4,4]);
 assert.throws(()=>pixelBounds(grid,-1,0));assert.throws(()=>pixelBounds(grid,0,4));
 assert.throws(()=>centreWindow([2,1,1,2],grid));
});
test('Original-unit membership excludes corridor pixels in holes and zero never proves absence',async()=>{
 const {inspectWindow}=await modulePromise,grid={origin:[0,2],resolution:[1,-1],width:2,height:2},window=[0,0,2,2];
 const seen=[];const result=inspectWindow([1,0,0,1],window,grid,p=>{seen.push(p);return p[0]<1;});
 assert.deepEqual(seen,[[.5,1.5],[1.5,1.5],[.5,.5],[1.5,.5]]);
 assert.equal(result.examined,2);assert.equal(result.mappedCentres,1);assert.equal(result.mappedCanalRoadObserved,true);
 assert.deepEqual(result.first,{row:0,column:0,value:1});
 const excluded=inspectWindow([1,0,0,1],window,grid,()=>false);assert.equal(excluded.mappedCanalRoadObserved,null);assert.equal(excluded.examined,0);
 assert.equal(inspectWindow([0,0,0,0],window,grid,()=>true).mappedCanalRoadObserved,null);
 assert.throws(()=>inspectWindow([2,0,0,0],window,grid,()=>false));
 assert.throws(()=>inspectWindow([1],window,grid,()=>true));
});
