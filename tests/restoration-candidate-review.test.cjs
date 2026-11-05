const test=require('node:test'),assert=require('node:assert/strict');
function inputs(year=2025,flags=[]){
 const counts=Array(26).fill(0);counts[25]=1;
 const candidates={units:[{unitId:'test-only',sourceFeatureIndex:0,positiveCandidateSignals:3,signals:{fireLocationOrBurnIndication:true,historicalTreeCoverLoss:true,mappedCanalRoadCorridor:true},sourceReviewFlags:flags,references:{bpbdResponseRecordRefs:['test-record-only'],burnIndications:null}}]};
 const canals={units:[{unitId:'test-only',sourceFeatureIndex:0,geometryEligible:true,mappedCanalRoadCorridorObserved:true,forestLossCandidate:{dataset:'GFC-2025-v1.13',counts:{lossYearCounts:counts}}}]};
 const database={units:[{unitId:'test-only',sourceFeatureIndex:0,geometryCheckPassed:true,analysisUnitApproved:false,sourceReviewFlags:flags,remainingIdenticalGeometry:false,indicatorEvidence:{fireHistory:{bpbdResponseRecordRefs:['test-record-only'],partialBurnIndications:null}}}],bpbd:{records:[{ref:'test-record-only',calendarDate:year+'-02-01',category:'Pemadaman',unitIds:['test-only']}]}};
 return [candidates,canals,database];
}
test('same-year evidence routes review without proving simultaneous pressures or approving priority',async()=>{
 const {review}=await import('../scripts/review-restoration-three-pressure-candidates.mjs');
 const values=inputs(),before=JSON.stringify(values),r=review(...values);
 assert.equal(r.summary.siteReviewQueue,1);assert.deepEqual(r.rows[0].sharedCalendarYears,[2025]);
 assert.equal(r.rows[0].simultaneousThreePressuresConfirmed,false);assert.equal(r.rows[0].sameLocationFireLossConfirmed,false);
 assert.equal(r.rows[0].score,null);assert.equal(r.rows[0].sourceUnitApproved,false);assert.equal(JSON.stringify(values),before);
});
test('2026 beyond GFC period, invalid dates and source conflicts remain explicit review routes',async()=>{
 const {review}=await import('../scripts/review-restoration-three-pressure-candidates.mjs');
 const r=review(...inputs(2026));assert.equal(r.summary.periodReviewQueue,1);assert.deepEqual(r.rows[0].fireYearsBeyondLossProduct,[2026]);
 assert.equal(review(...inputs(2025,['district-field-conflict'])).summary.sourceConflictQueue,1);
 const values=inputs();values[2].bpbd.records[0].calendarDate='2025-02-30';
 const bad=review(...values);assert.equal(bad.summary.periodReviewQueue,1);assert.equal(bad.rows[0].unresolvedDateRefs.length,1);
});
test('duplicate identities, wrong-unit references and altered annual classes fail closed',async()=>{
 const {review}=await import('../scripts/review-restoration-three-pressure-candidates.mjs');
 for(const mutate of [v=>v[2].bpbd.records.push({...v[2].bpbd.records[0]}),v=>v[2].bpbd.records[0].unitIds=[],v=>v[1].units[0].forestLossCandidate.counts.lossYearCounts[25]=-1,v=>v[0].units[0].references.bpbdResponseRecordRefs=[]]){
  const values=inputs();mutate(values);assert.throws(()=>review(...values));
 }
});
