const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../js/map-v4.js'), 'utf8');
const body = code.slice(code.indexOf('  function mergeOfficialCanalPoints('), code.indexOf('  async function loadOfficialCanalPoints('));
const merge = vm.runInNewContext(body + '\nmergeOfficialCanalPoints');
const official = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/sekat_kanal.geojson'), 'utf8'));
test('preserves database coordinates and only supplements missing objects', () => {
  const stale = {type:'Feature', properties:{Object_ID:'SEKAT-PEDEKIK-2026-001',Layer_ID:'sekat_kanal',_ygPhotos:['https://example.org/approved.jpg']},geometry:{type:'Point',coordinates:[102.095,1.522]}};
  const other = {type:'Feature',properties:{Object_ID:'NEW-CANAL'},geometry:{type:'Point',coordinates:[102,1]}};
  const data = {type:'FeatureCollection',featureCount:3,features:[stale,structuredClone(stale),other]};
  merge(data, structuredClone(official));
  merge(data, structuredClone(official));
  for (const id of ['SEKAT-DAYUN-2026-001','SEKAT-PEDEKIK-2026-001']) {
    const found = data.features.filter(f => f.properties.Object_ID === id);
    assert.equal(found.length,1);
    assert.equal(found[0].properties.Layer_ID,'sekat_kanal');
    assert.equal(JSON.stringify(found[0].geometry),JSON.stringify(id===stale.properties.Object_ID?stale.geometry:official.features.find(f=>f.properties.Object_ID===id).geometry));
  }
  assert.ok(data.features.includes(other));
  assert.ok(data.features.find(f=>f.properties.Object_ID===stale.properties.Object_ID).properties._ygPhotos.includes('https://example.org/approved.jpg'));
  assert.equal(data.featureCount,data.features.length);
});
test('invalid official points do not remove an existing marker', () => {
  const feature={properties:{Object_ID:'X'},geometry:{type:'Point',coordinates:[102,1]}};
  const data={features:[feature]};
  merge(data,{type:'FeatureCollection',features:[{properties:{Object_ID:'X'},geometry:null}]});
  assert.equal(data.features[0],feature);
});
test('all network loading routes restore the reviewed canal layer', () => {
  assert.match(code,/\[loadOfficialCanalPoints, mergeOfficialCanalPoints, "sekat_kanal.geojson"\]/);
  assert.equal((code.match(/mergeOfficialCanalPoints\(data, await loadOfficialCanalPoints\(\)\)/g)||[]).length,2);
});

test('linked Pedekik symbol is centered on its actual database coordinate', () => {
  const start=code.indexOf('  function pointFor('), end=code.indexOf('  function addFeatureToSearch(');
  const source=code.slice(start,end);
  const pointFor=vm.runInNewContext(source+'\npointFor', {
    pointSymbolFor:()=> 'S', escapeHtml:x=>x,
    L:{marker:(latlng,options)=>({latlng,options}),divIcon:options=>options}
  });
  const latlng={lat:1.52159,lng:102.094672};
  const marker=pointFor({id:'sekat_kanal',label:'Sekat Kanal',color:'#00838f'},latlng,'points',{properties:{FDRS_Terkait_Object_ID:'FDRS-PEDEKIK-2026-001'}});
  assert.equal(marker.latlng,latlng);
  assert.equal(JSON.stringify(marker.options.icon.iconAnchor),'[20,20]');
  assert.equal(marker.options.title,'Sekat Kanal');
  assert.doesNotMatch(marker.options.icon.html,/dashed/);
  assert.equal(marker.options.draggable,false);
});

test('stale snapshots on reload and independent clients use the same live database geometry',async()=>{
  const start=code.indexOf('  async function refreshCanalPositionsFromDatabase(');
  const end=code.indexOf('  async function loadDatabase(',start);
  const live={type:'Feature',properties:{Object_ID:'SEKAT-PEDEKIK-2026-001',Layer_ID:'sekat_kanal',Revision:7},geometry:{type:'Point',coordinates:[102.095,1.522]}};
  let reads=0;
  const refresh=vm.runInNewContext(code.slice(start,end)+'\nrefreshCanalPositionsFromDatabase',{
    API:'https://example.test/objects',AbortController,window:{setTimeout,clearTimeout},
    fetch:async(url,options)=>{reads++;assert.equal(options.cache,'no-store');return {ok:true,json:async()=>({features:[structuredClone(live)]})}}});
  for(const client of ['tablet','reload','logout-login','desktop']){
    const data={features:structuredClone(official.features)};
    await refresh(data);merge(data,structuredClone(official));
    assert.equal(JSON.stringify(data.features.find(f=>f.properties.Object_ID===live.properties.Object_ID).geometry),JSON.stringify(live.geometry),client);
  }
  assert.equal(reads,4);
});

test('network failure falls back to live JSONP rather than trusting snapshot positions',async()=>{
  const start=code.indexOf('  async function refreshCanalPositionsFromDatabase('),end=code.indexOf('  async function loadDatabase(',start);
  const live={properties:{Object_ID:'SEKAT-PEDEKIK-2026-001',Layer_ID:'sekat_kanal'},geometry:{type:'Point',coordinates:[102.095,1.522]}};
  const refresh=vm.runInNewContext(code.slice(start,end)+'\nrefreshCanalPositionsFromDatabase',{
    API:'https://example.test',AbortController,window:{setTimeout,clearTimeout},fetch:async()=>{throw Error('CORS')},loadByJsonp:async()=>({features:[live]})});
  const data={features:structuredClone(official.features)};await refresh(data);
  assert.equal(JSON.stringify(data.features[0].geometry),JSON.stringify(live.geometry));
});

