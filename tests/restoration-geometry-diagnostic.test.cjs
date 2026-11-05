const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const runtime=createRequire(path.join(__dirname,'../private-data/restoration-runtime/package.json'));
const T=runtime('@turf/turf');
const J=runtime('jsts');
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/Gambut_BBSDLP_2019.geojson')));
test('actual shell/hole candidates preserve hole exclusion and set-operation identities without approval',async()=>{
 const {reviewSelfTouch}=await import('../scripts/diagnose-restoration-geometry.mjs');
 const {validateCandidate}=await import('../scripts/validate-restoration-ring-candidates.mjs');
 for(const index of [493,609]){
  const feature=source.features[index],before=JSON.stringify(feature),candidate={type:'Feature',geometry:reviewSelfTouch(feature,J).candidate,properties:{reviewOnly:true,analysisUnitApproved:false,scoringValidated:false}};
  const result=validateCandidate(feature,candidate,J,T);
  assert.ok(Object.values(result.checks).every(Boolean));assert.equal(result.technicalChecksPassed,true);
  assert.equal(result.testedResponseRecords,0);assert.equal(result.pointComparisonPassed,null);
  assert.equal(result.sourceGeometryApproved,false);assert.equal(result.candidateApproved,false);assert.equal(result.score,null);
  assert.ok(result.turfKinkDetections>0,'Keep disagreement about point contacts visible');
  assert.equal(JSON.stringify(feature),before);
 }
});
test('candidate validation refuses shell-only geometry or promoted approval flags',async()=>{
 const {reviewSelfTouch}=await import('../scripts/diagnose-restoration-geometry.mjs');
 const {validateCandidate}=await import('../scripts/validate-restoration-ring-candidates.mjs');
 const feature=source.features[493],geometry=reviewSelfTouch(feature,J).candidate;
 const properties={reviewOnly:true,analysisUnitApproved:false,scoringValidated:false};
 assert.throws(()=>validateCandidate(feature,{geometry:{type:'Polygon',coordinates:[geometry.coordinates[0]]},properties},J,T),/differs/);
 assert.throws(()=>validateCandidate(feature,{geometry,properties:{...properties,analysisUnitApproved:true}},J,T),/differs/);
});
test('two real self-touching rings yield separate review-only hole candidates preserving every source edge',async()=>{
 const {reviewSelfTouch,independentValidity}=await import('../scripts/diagnose-restoration-geometry.mjs');
 for(const [index,indices] of [[493,[331,334]],[609,[0,127]]]){
  const feature=source.features[index],before=JSON.stringify(feature),result=reviewSelfTouch(feature,J);
  assert.deepEqual(result.repeatedVertexIndices,indices);
  assert.equal(result.boundaryEdgesPreserved,true);assert.equal(result.boundaryContactDimension,0);
  assert.equal(result.candidate.coordinates.length,2);assert.equal(result.candidateValidity.valid,true);
  assert.equal(result.sourceModified,false);assert.equal(result.analysisUnitApproved,false);
  assert.equal(independentValidity(feature,J).valid,false);assert.equal(JSON.stringify(feature),before);
 }
 assert.equal(reviewSelfTouch(source.features[298],J),null);
});
test('independent JSTS topology resolves engine disagreement on actual unmodified source cases',async()=>{
 const {independentValidity}=await import('../scripts/diagnose-restoration-geometry.mjs');
 for(const index of [298,304,311,615,617,643]){
  const before=JSON.stringify(source.features[index]),result=independentValidity(source.features[index],J);
  assert.equal(result.valid,true);assert.equal(result.error,null);
  assert.equal(result.analysisUnitApproved,false);assert.equal(result.geometryModified,false);
  assert.equal(result.precisionReductionApplied,false);assert.equal(JSON.stringify(source.features[index]),before);
 }
 for(const index of [493,609]){
  const result=independentValidity(source.features[index],J);
  assert.equal(result.valid,false);assert.equal(result.error.code,6);assert.equal(result.error.message,'Ring Self-intersection');
  assert.ok(result.error.coordinate.every(Number.isFinite));
  assert.equal(result.selfTouchingRingFormingHoleAllowed,false);
 }
});
test('actual BBSDLP component contacts remain distinct from self-ring issues without repair',async()=>{
 const {diagnose}=await import('../scripts/diagnose-restoration-geometry.mjs');
 for(const index of [298,304,311,615,617,643]){
  const feature=source.features[index],before=JSON.stringify(feature),result=diagnose(feature,T);
  assert.equal(result.whole.booleanValid,false);
  assert.ok(result.components.every(c=>c.booleanValid&&c.kinkDetections===0));
  assert.ok(result.componentInteractions.some(p=>p.boundaryIntersectionDetections>0));
  assert.ok(result.componentInteractions.every(p=>p.positiveAreaIntersection===false&&p.error===null));
  assert.equal(result.geometryApproved,false);assert.equal(result.geometryModified,false);
  assert.equal(JSON.stringify(feature),before);
 }
 for(const index of [493,609]){
  const result=diagnose(source.features[index],T);
  assert.ok(result.findings.includes('within-component-geometry-issue'));
  assert.ok(result.components[0].ringDiagnostics[0].repeatedVertexIndices.length>0);
  assert.equal(result.scoringValidated,false);
 }
});
test('geometry diagnostic rejects nonpolygon and oversized component collections',async()=>{
 const {diagnose}=await import('../scripts/diagnose-restoration-geometry.mjs');
 assert.throws(()=>diagnose({geometry:{type:'Point',coordinates:[0,0]}},T),/Polygon source/);
 const component=source.features[298].geometry.coordinates[0];
 assert.throws(()=>diagnose({geometry:{type:'MultiPolygon',coordinates:Array(129).fill(component)}},T),/bound exceeded/);
});
