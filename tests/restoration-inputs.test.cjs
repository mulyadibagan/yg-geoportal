const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../js/restoration-scoring.js');
const root = path.resolve(__dirname, '..');
const polygon = properties => ({type:'Feature', properties, geometry:{type:'Polygon',coordinates:[]}});
const collection = features => ({type:'FeatureCollection',features});
// Algorithm-only fixtures; never emitted as application datasets or approved results.
function inputs(value) {
  return Object.fromEntries(A.INDICATORS.map(i=>[i.id, {value,validated:true,validation:{reviewer:'test-only',reference:'test-only'},
    provenance:{source:'test-only',year:2026,version:'test-only'},normalization:{method:'test-only',min:0,max:100}}]));
}
test('audit flags absent indicators and never treats source attributes as approved scores', async()=>{
  const {inspect}=await import('../scripts/check-restoration-inputs.mjs');
  const report=inspect(collection([polygon({Luas_Ha:100,kubah_gmbt:'Kubah Gambut'})]));
  assert.equal(report.status,'incomplete'); assert.equal(report.assessed,0);
  assert.equal(report.unassessed,1); assert.equal(report.nextSteps.length,5);
  for(const indicator of report.indicators) assert.deepEqual(indicator.reasons,{'Data belum tersedia':1});
  assert.equal(report.approvalGranted,false); assert.equal(report.geometryValidated,false);
});
test('audit counts complete and blocked units separately without exposing raw properties', async()=>{
  const {inspect}=await import('../scripts/check-restoration-inputs.mjs');
  const source=collection([polygon({privateSecret:'do-not-output',restorationIndicators:inputs(75)}),polygon({restorationIndicators:inputs(50)}),polygon({})]);
  const original=JSON.stringify(source),report=inspect(source);
  assert.equal(report.assessed,2);assert.equal(report.unassessed,1);
  assert.equal(report.categories.Tinggi,1);assert.equal(report.categories.Sedang,1);
  assert.equal(report.status,'incomplete');assert.doesNotMatch(JSON.stringify(report),/do-not-output|coordinates|test-only/);
  assert.equal(JSON.stringify(source),original);
});
test('declared complete input is not geometry or expert approval; invalid provenance blocks scoring',async()=>{
  const {inspect}=await import('../scripts/check-restoration-inputs.mjs');
  const data=collection([polygon({restorationIndicators:inputs(100)})]);
  const report=inspect(data);assert.equal(report.status,'input-complete');assert.equal(report.approvalGranted,false);
  data.features[0].properties.restorationIndicators.hydrology.provenance.year=null;
  const blocked=inspect(data);assert.equal(blocked.assessed,0);assert.equal(blocked.indicators[2].blocked,1);
});
test('malformed and empty collections fail instead of reporting complete',async()=>{
  const {inspect}=await import('../scripts/check-restoration-inputs.mjs');
  for(const data of [null,collection([]),collection([null]),collection([{type:'Feature',properties:{},geometry:{type:'Point'}}])])
    assert.throws(()=>inspect(data));
});
test('real BBSDLP input produces reproducible aggregate report and CLI incomplete exit code', async()=>{
  const {readInput}=await import('../scripts/check-restoration-inputs.mjs');
  const file=path.join(root,'data/Gambut_BBSDLP_2019.geojson');
  const report=await readInput(file);
  assert.equal(report.featureCount,736);assert.equal(report.unassessed,736);assert.equal(report.assessed,0);
  assert.equal(report.inputSha256,createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
  const run=spawnSync(process.execPath,['scripts/check-restoration-inputs.mjs',file],{cwd:root,encoding:'utf8'});
  assert.equal(run.status,2);assert.equal(JSON.parse(run.stdout).inputSha256,report.inputSha256);
});
test('CLI error does not disclose filesystem path or malformed content',()=>{
  const run=spawnSync(process.execPath,['scripts/check-restoration-inputs.mjs','do-not-output-private-path'],{cwd:root,encoding:'utf8'});
  assert.equal(run.status,1);assert.doesNotMatch(run.stderr,/do-not-output-private-path/);
});
test('oversized input is refused before JSON parsing',async()=>{
  const {readInput,MAX_BYTES}=await import('../scripts/check-restoration-inputs.mjs');
  const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'restoration-input-test-'));
  const file=path.join(dir,'oversized.geojson');
  try {
    fs.writeFileSync(file,''); fs.truncateSync(file,MAX_BYTES+1);
    await assert.rejects(()=>readInput(file),/64 MiB/);
  } finally {fs.unlinkSync(file);fs.rmdirSync(dir);}
});
