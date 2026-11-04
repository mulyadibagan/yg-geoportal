const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const runtime=createRequire(path.join(__dirname,'../private-data/restoration-runtime/package.json'));
const T=runtime('@turf/turf');
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/Gambut_BBSDLP_2019.geojson')));
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
