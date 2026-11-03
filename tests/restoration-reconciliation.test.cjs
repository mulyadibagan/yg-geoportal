const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createRequire}=require('node:module');
const runtime=createRequire(path.resolve(__dirname,'../private-data/restoration-runtime/package.json'));
const T=runtime('@turf/turf');
const fc=features=>({type:'FeatureCollection',features});
const poly=(properties,x0=100,x1=102)=>({type:'Feature',properties,geometry:{type:'Polygon',coordinates:[[[x0,0],[x1,0],[x1,2],[x0,2],[x0,0]]]}});
const provenance={peatSha256:'a'.repeat(64),hotspotSha256:'b'.repeat(64)};
async function prepare(features){return (await import('../scripts/prepare-restoration-sources.mjs')).prepare(fc(features),fc([]),provenance);}
test('canonical derivative removes only fully identical source features and preserves lineage',async()=>{
  const {canonicalize}=await import('../scripts/reconcile-restoration-evidence.mjs');
  const one=poly({KETEBALAN:'Dalam'}),two=structuredClone(one),three=poly({KETEBALAN:'Dangkal'});
  const original=fc([one,two,three]),source=await prepare(original.features),before=JSON.stringify(source.units);
  const result=canonicalize(source.units,original);
  assert.equal(result.units.features.length,2);assert.equal(result.decisions.length,1);
  assert.equal(result.units.features[0].properties.sourceUnitIds.length,2);
  assert.equal(result.units.features[0].properties.qa.remainingIdenticalGeometry,true);
  assert.equal(JSON.stringify(source.units),before);
  assert.deepEqual(result.units.features.map(f=>f.properties.sourceAttributes.KETEBALAN),['Dalam','Dangkal']);
});
test('modified or mismatched source rows cannot be silently deduplicated',async()=>{
  const {canonicalize}=await import('../scripts/reconcile-restoration-evidence.mjs');
  const original=fc([poly({KETEBALAN:'Dalam'})]),source=await prepare(original.features);
  source.units.features[0].properties.sourceAttributes.KETEBALAN='Dangkal';
  assert.throws(()=>canonicalize(source.units,original),/does not match/);
});
test('district overlays record both labels without choosing a district or approving indicators',async()=>{
  const {enrich}=await import('../scripts/reconcile-restoration-evidence.mjs');
  const source=await prepare([poly({KK:'Kampar',KABKOT:'Siak'})]);
  const summary=enrich(source.units,fc([poly({WADMKK:'Siak'},100,101),poly({WADMKK:'Kampar'},101,102)]),{archives:[{month:'2026-07',data:fc([poly({eventId:'test-only',status:'estimate'},100.5,101.5)])}]},T);
  const p=source.units.features[0].properties;
  assert.deepEqual(p.qa.districtReference.labels,['Kampar','Siak']);assert.equal(p.qa.districtReference.appliedDistrict,null);
  assert.equal(p.qa.analysisUnitApproved,false);assert.equal(summary.unitsWithBurnIndications,1);
  assert.equal(p.evidence.burnedIndications.completeHistory,false);
  assert.ok(Object.values(p.restorationIndicators).every(row=>row.value===null&&row.validated===false));
});
test('invalid geometry is excluded with an explicit incomplete status, never a zero indicator',async()=>{
  const {enrich}=await import('../scripts/reconcile-restoration-evidence.mjs');
  const source=await prepare([poly({})]);source.units.features[0].geometry.coordinates=[[[100,0],[102,2],[100,2],[102,0],[100,0]]];
  const summary=enrich(source.units,fc([]),{archives:[]},T);
  assert.equal(summary.geometryIssues,1);
  assert.equal(source.units.features[0].properties.evidence.burnedIndications.observations,null);
});
