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
test('FEG grouping uses source codes and keeps the exact original geometry objects',()=>{
  const first=fixture().features[0], second=fixture().features[0];
  first.properties={kode_khg:'KHG.source-A',nama_khg:'Nama sumber A'};
  second.properties={kode_khg:'KHG.source-A',nama_khg:'Nama sumber A'};
  const data={type:'FeatureCollection',features:[first,second]}, before=JSON.stringify(data);
  const result=C.groupFEG(data);
  assert.equal(result.groups.length,1); assert.equal(result.groups[0].features.length,2);
  assert.equal(result.groups[0].features[0],first); assert.equal(result.groups[0].features[1],second);
  assert.equal(JSON.stringify(data),before); assert.equal(result.standaloneBoundary,false); assert.equal(result.scoringValidated,false);
  assert.equal(Object.hasOwn(result.groups[0],'areaHa'),false);
});
test('missing KHG codes do not create invented groups; names do not replace identifiers',()=>{
  const rows=[undefined,null,'','   ','No Data','N/A',0].map(code=>({...fixture().features[0],properties:{kode_khg:code,nama_khg:'Same source name'}}));
  const result=C.groupFEG({type:'FeatureCollection',features:rows});
  assert.equal(result.groups.length,0); assert.equal(result.missingCode,rows.length);
});
test('FEG groups preserve naming conflicts and remain distinct when codes differ',()=>{
  const rows=[['KHG.A','Name 1'],['KHG.A','Name 2'],['KHG.B','Name 1'],['KHG.C',null]].map(([code,name])=>({...fixture().features[0],properties:{kode_khg:code,nama_khg:name}}));
  const r=C.groupFEG({type:'FeatureCollection',features:rows});
  assert.equal(r.groups.length,3); assert.equal(r.groups[0].nameConflict,true);
  assert.deepEqual(r.groups[0].names,['Name 1','Name 2']); assert.match(r.groups[0].label,/nama sumber berbeda/);
  assert.equal(r.groups[1].features.length,1); assert.equal(r.missingName,1);
});
test('malformed FEG geometries and projected CRS never enter the focus layer',()=>{
  const good=fixture().features[0];good.properties={kode_khg:'KHG.A'};
  const bad={...good,geometry:null};
  const r=C.groupFEG({type:'FeatureCollection',features:[good,bad]});
  assert.equal(r.groups[0].features.length,1);assert.equal(r.invalidGeometry,1);
  const projected=C.groupFEG({type:'FeatureCollection',crs:{properties:{name:'EPSG:3857'}},features:[good]});
  assert.equal(projected.groups.length,0);assert.equal(projected.invalidGeometry,1);
  assert.throws(()=>C.groupFEG({type:'Point',coordinates:[]}));
});
