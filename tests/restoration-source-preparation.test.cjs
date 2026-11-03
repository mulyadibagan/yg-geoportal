const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const A=require('../js/restoration-scoring.js');
const fc=features=>({type:'FeatureCollection',features});
// Test-only synthetic geometry; never emitted as application data.
const polygon=properties=>({type:'Feature',properties,geometry:{type:'Polygon',coordinates:[[[100,0],[102,0],[102,2],[100,2],[100,0]]]}});
const point=(x,y)=>({type:'Feature',properties:{},geometry:{type:'Point',coordinates:[x,y]}});
const provenance={peatSha256:'a'.repeat(64),hotspotSha256:'b'.repeat(64)};
test('raw source fields survive unchanged; every ecological indicator remains null',async()=>{
  const {prepare}=await import('../scripts/prepare-restoration-sources.mjs');
  const peat=fc([polygon({KETEBALAN:'Dalam',pH:'Sangat Masam - Masam',TAHUN:2019,KK:'S I A K',KABKOT:'Siak'})]);
  const before=JSON.stringify(peat),r=prepare(peat,fc([point(101,1),point(110,0)]),provenance);
  assert.equal(JSON.stringify(peat),before);
  const unit=r.units.features[0];
  assert.equal(unit.geometry,peat.features[0].geometry);
  assert.equal(unit.properties.sourceAttributes.KETEBALAN,'Dalam');
  assert.equal(unit.properties.sourceAttributes.pH,'Sangat Masam - Masam');
  assert.equal(unit.properties.qa.districtConflict,false);
  assert.equal(unit.properties.evidence.fireSnapshot.observationCount,1);
  assert.equal(A.assess(unit.properties.restorationIndicators).score,null);
  for(const row of Object.values(unit.properties.restorationIndicators)){assert.equal(row.value,null);assert.equal(row.validated,false);}
  assert.equal(r.manifest.qa.unmatchedObservations,1);assert.equal(r.manifest.scoringValidated,false);
});
test('duplicate source rows and overlapping units are flagged and never silently removed',async()=>{
  const {prepare}=await import('../scripts/prepare-restoration-sources.mjs');
  const one=polygon({KK:'Kampar',KABKOT:'Siak'}),two=JSON.parse(JSON.stringify(one));
  const r=prepare(fc([one,two]),fc([point(101,1)]),provenance);
  assert.equal(r.units.features.length,2);assert.notEqual(r.units.features[0].id,r.units.features[1].id);
  assert.equal(r.manifest.qa.duplicateGeometryRows,1);assert.equal(r.manifest.qa.duplicateFeatureRows,1);
  assert.equal(r.manifest.qa.districtConflicts,2);assert.equal(r.manifest.qa.multipleUnitObservations,1);
  assert.equal(r.manifest.qa.matchedObservations,1);
  assert.equal(r.units.features[1].properties.qa.duplicateGeometryOf,r.units.features[0].id);
  assert.equal(r.review.decisionsApplied,false);
  assert.equal(r.review.duplicateGeometryGroups[0].classification,'identical-source-rows');
  assert.deepEqual(r.review.duplicateGeometryGroups[0].conflictingFields,[]);
  assert.equal(r.review.districtReviews.length,2);
  assert.ok(r.units.features.every(unit=>unit.properties.qa.reviewFlags.includes('identical-geometry')));
});
test('holes and invalid points are handled; zero snapshot counts do not become fire scores',async()=>{
  const {prepare}=await import('../scripts/prepare-restoration-sources.mjs');
  const poly=polygon({});poly.geometry.coordinates.push([[100.5,0.5],[100.5,1.5],[101.5,1.5],[101.5,0.5],[100.5,0.5]]);
  const r=prepare(fc([poly]),fc([point(101,1),point(NaN,0),point(190,0)]),provenance);
  assert.equal(r.manifest.qa.invalidPoints,2);assert.equal(r.manifest.qa.unmatchedObservations,1);
  const p=r.units.features[0].properties;assert.equal(p.evidence.fireSnapshot.observationCount,0);
  assert.equal(p.evidence.fireSnapshot.completeFireHistory,false);assert.equal(p.restorationIndicators.fireHistory.value,null);
});
test('source SHA controls version-bound identity and malformed inputs fail closed',async()=>{
  const {prepare}=await import('../scripts/prepare-restoration-sources.mjs');
  const data=fc([polygon({})]);
  assert.notEqual(prepare(data,fc([]),provenance).units.features[0].id,
    prepare(data,fc([]),{...provenance,peatSha256:'c'.repeat(64)}).units.features[0].id);
  assert.throws(()=>prepare(data,fc([]),{}));
  assert.throws(()=>prepare({...data,crs:{properties:{name:'EPSG:3857'}}},fc([]),provenance));
  assert.throws(()=>prepare(data,{features:[]},provenance));
  assert.throws(()=>prepare(data,{...fc([]),crs:{properties:{name:'EPSG:3857'}}},provenance));
});
test('actual BBSDLP rows retain duplicate/conflict QA and remain unassessed',async()=>{
  const {prepare}=await import('../scripts/prepare-restoration-sources.mjs');
  const bytes=fs.readFileSync(path.join(__dirname,'../data/Gambut_BBSDLP_2019.geojson'));
  const r=prepare(JSON.parse(bytes),fc([]),{...provenance,peatSha256:createHash('sha256').update(bytes).digest('hex')});
  assert.equal(r.units.features.length,736);assert.equal(r.manifest.qa.duplicateGeometryRows,11);
  assert.equal(r.manifest.qa.duplicateFeatureRows,3);assert.equal(r.manifest.qa.districtConflicts,105);
  assert.equal(new Set(r.units.features.map(f=>f.id)).size,736);
  assert.equal(r.review.duplicateGeometryGroups.length,9);
  assert.equal(r.manifest.qa.conflictingGeometryGroups,8);
  assert.equal(r.review.districtReviews.length,105);
  assert.ok(r.review.duplicateGeometryGroups.some(group=>group.conflictingFields.some(row=>row.field==='KETEBALAN')));
  assert.ok(r.review.districtReviews.every(row=>row.decision===null));
  assert.ok(r.units.features.every(f=>A.assess(f.properties.restorationIndicators).score===null));
});
test('conflicting soil classes in identical geometries are exposed without choosing a winner',async()=>{
  const {prepare}=await import('../scripts/prepare-restoration-sources.mjs');
  const r=prepare(fc([polygon({KETEBALAN:'Dalam'}),polygon({KETEBALAN:'Dangkal'})]),fc([]),provenance);
  const group=r.review.duplicateGeometryGroups[0];
  assert.equal(group.classification,'same-geometry-conflicting-attributes');assert.equal(group.decision,null);
  assert.deepEqual(group.conflictingFields[0].values.map(row=>row.value),['Dalam','Dangkal']);
  assert.ok(r.units.features.every(unit=>unit.properties.qa.analysisUnitApproved===false));
  assert.equal(r.units.features.length,2);
});
