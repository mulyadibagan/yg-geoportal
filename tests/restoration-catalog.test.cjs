const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto, createHash } = require('node:crypto');
const C = require('../js/restoration-catalog.js');
const UUID = '12345678-1234-4123-8123-123456789abc';
// Pure algorithm fixtures only; never published or presented as real KHG data.
const fixture = () => ({ type: 'FeatureCollection', features: [{ type:'Feature', properties:{NAMA_KHG:'unit-test-only'}, geometry:{type:'Polygon',coordinates:[[[100,0],[101,0],[101,1],[100,0]]]}}] });
function entry() {return {datasetUuid:UUID,title:'Kesatuan Hidrologis Gambut Riau',artifacts:{display:{available:true,status:'ready',bytes:500,sha256:'a'.repeat(64),featureCount:1}}};}
test('only unambiguous display-ready KHG entries with bounded integrity metadata can be selected',()=>{
  const row=entry(), catalog={access:'staff_only',datasets:[row]};
  assert.equal(C.candidates(catalog)[0].uuid, UUID);
  assert.equal(C.candidates({...catalog,datasets:[null,'invalid',row]}).length,1);
  assert.equal(C.candidates({...catalog,access:'public'}).length,0);
  assert.equal(C.candidates({...catalog,datasets:[row,row]}).length,0);
  for(const mutate of [r=>r.title='Tutupan Lahan',r=>r.datasetUuid='../private',r=>r.artifacts.display.available=false,r=>r.artifacts.display.status='pending',r=>r.artifacts.display.bytes=C.MAX_BYTES+1,r=>r.artifacts.display.sha256='',r=>r.artifacts.display.featureCount=25001]) {
    const r=entry();mutate(r);assert.equal(C.candidates({...catalog,datasets:[r]}).length,0);
  }
});
test('geometry validator rejects missing features, projected coordinates, open rings and nonpolygon types',()=>{
  assert.equal(C.validate(fixture()).features.length,1);
  for(const mutate of [d=>d.features=[],d=>d.crs={properties:{name:'EPSG:3857'}},d=>d.features[0].geometry.type='LineString',d=>d.features[0].geometry.coordinates[0].pop(),d=>d.features[0].geometry.coordinates[0][1]=[500000,100000],d=>d.features[0].geometry.coordinates[0][1]=[NaN,1]]){
    const d=fixture();mutate(d);assert.throws(()=>C.validate(d));
  }
});
test('display stream must match SHA-256, length and feature count before use',async()=>{
  const text=JSON.stringify(fixture()),bytes=Buffer.from(text),item={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),featureCount:1};
  assert.equal((await C.readDisplay(new Response(text),item,webcrypto)).features.length,1);
  for(const changes of [{sha256:'0'.repeat(64)},{bytes:bytes.length-1},{bytes:bytes.length+1},{featureCount:2}]) await assert.rejects(C.readDisplay(new Response(text),{...item,...changes},webcrypto));
  await assert.rejects(C.readDisplay(new Response('denied',{status:403}),item,webcrypto),/HTTP 403/);
});
test('HTTP success does not make corrupt JSON or failed streaming acceptable',async()=>{
  const bytes=Buffer.from('{invalid'), item={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),featureCount:1};
  await assert.rejects(C.readDisplay(new Response(bytes),item,webcrypto));
  const body=new ReadableStream({pull(controller){controller.error(Error('body transport failure'));}});
  await assert.rejects(C.readDisplay(new Response(body),item,webcrypto),/transport failure/);
});
test('selection labels preserve source attributes without inventing KHG names',()=>{
  assert.equal(C.label({properties:{NAMA_KHG:'Nama sumber'}},0),'Nama sumber');
  assert.equal(C.label({properties:{}},4),'Poligon KHG 5');
});
