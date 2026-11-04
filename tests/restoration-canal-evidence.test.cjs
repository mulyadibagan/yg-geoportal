const test=require('node:test'),assert=require('node:assert/strict');
test('canal acquisition is pinned to official files and rejects arbitrary destinations',async()=>{
 const {FILES,sourceUrl}=await import('../scripts/acquire-restoration-canals.mjs');
 assert.equal(FILES.length,2);assert.equal(sourceUrl(FILES[0]),'https://stacks.stanford.edu/file/yj761xk5815/geotiffs.zip');
 for(const entry of [{id:'other',name:'geotiffs.zip'},{id:'yj761xk5815',name:'../secret'},{id:'yj761xk5815',name:'other.zip'}])assert.throws(()=>sourceUrl(entry),/Unknown/);
});
test('native corridor pixels retain grid positions and unknown classes never become absence',async()=>{
 const {mercator,tileName,firstMappedPixel}=await import('../scripts/extract-restoration-canal-evidence.mjs');
 assert.ok(Math.abs(mercator([100,0])[0]-11131949.079327356)<1e-6);
 assert.ok(Math.abs(mercator([0,0])[1])<1e-8);
 for(const p of [[0,90],[NaN,0],[181,0]])assert.throws(()=>mercator(p),/Invalid/);
 assert.equal(tileName('L15_1596E_1034N'),'geotiffs/L15-1596E-1034N.tif');
 assert.throws(()=>tileName('../other'),/Unknown/);
 assert.deepEqual(firstMappedPixel(new Uint8Array([0,1,1,0]),2,[[0,2]],0),{row:0,column:1});
 assert.equal(firstMappedPixel(new Uint8Array([0,0]),2,[[0,2]],0),null);
 assert.throws(()=>firstMappedPixel(new Uint8Array([2]),1,[[0,1]],0),/Unknown/);
});
test('three native candidate signals never approve proxies or fill missing observations with zero',async()=>{
 const {combine}=await import('../scripts/prepare-restoration-three-pressure-evidence.mjs');
 const corridor={units:[{unitId:'test-unit-only',sourceFeatureIndex:0,geometryEligible:true,mappedCanalRoadCorridorObserved:true,firstSourcePixel:{row:0,column:1},forestLossCandidate:{dataset:'test-only',period:'test-only',counts:{lossYearCounts:[0,1]}}}]};
 const database={units:[{unitId:'test-unit-only',sourceFeatureIndex:0,geometryCheckPassed:true,sourceReviewFlags:[],analysisUnitApproved:false,indicatorEvidence:{fireHistory:{bpbdResponseRecordRefs:['test-only'],partialBurnIndications:null}}}]};
 const before=JSON.stringify({corridor,database}),result=combine(corridor,database);
 assert.equal(result.summary.withThreeCandidateSignals,1);assert.equal(result.summary.finalPriorityAssessed,0);
 assert.equal(result.units[0].score,null);assert.equal(result.units[0].restorationPressures,null);
 assert.equal(JSON.stringify({corridor,database}),before);
 corridor.units[0].mappedCanalRoadCorridorObserved=null;
 assert.equal(combine(corridor,database).units[0].signals.mappedCanalRoadCorridor,null);
 database.units[0].unitId='different';assert.throws(()=>combine(corridor,database),/identity mismatch/);
});
