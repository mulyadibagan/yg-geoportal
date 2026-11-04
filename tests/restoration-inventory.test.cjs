const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const I=require('../js/restoration-inventory.js');
const original=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/master-database-snapshot.json')));
const source=original.features.find(f=>f.properties?.Layer_ID==='fdrs'&&f.properties.Status_Objek==='Aktif');
const copy=()=>JSON.parse(JSON.stringify(source));
test('database inventory preserves source identity and geometry while excluding private fields and score inputs',()=>{
 const feature=copy();feature.properties.email='test-only@example.invalid';feature.properties.restorationIndicators={hydrology:{value:99,validated:true}};
 const before=JSON.stringify(feature),data=I.select({type:'FeatureCollection',features:[feature],generatedAt:'test-version'});
 assert.equal(data.fdrs.features.length,1);assert.equal(data.fdrs.generatedAt,'test-version');
 assert.deepEqual(data.fdrs.features[0].geometry,source.geometry);
 assert.equal(data.fdrs.features[0].properties.Object_ID,source.properties.Object_ID);
 assert.equal(data.fdrs.features[0].properties.email,undefined);assert.equal(data.fdrs.features[0].properties.restorationIndicators,undefined);
 assert.equal(data.scoringValidated,false);assert.equal(JSON.stringify(feature),before);
});
test('ambiguous IDs, inactive infrastructure and invalid/projected points do not enter inventory',()=>{
 const feature=copy();const duplicated=I.select({type:'FeatureCollection',features:[feature,copy()]});
 assert.equal(duplicated.fdrs.features.length,0);assert.equal(duplicated.excluded.ambiguousId,2);
 feature.properties.Status_Objek='Sedang dibangun';assert.equal(I.select({type:'FeatureCollection',features:[feature]}).fdrs.features.length,0);
 feature.properties.Status_Objek='Aktif';feature.geometry.coordinates=[100000,100000];
 assert.equal(I.select({type:'FeatureCollection',features:[feature]}).excluded.invalidPoint,1);
 assert.throws(()=>I.select({...original,crs:{properties:{name:'EPSG:3857'}}}),/CRS/);
});
test('inventory reader rejects HTTP failures, oversized bodies and malformed JSON',async()=>{
 await assert.rejects(I.read(new Response('{}',{status:401})),/HTTP 401/);
 await assert.rejects(I.read(new Response('x'.repeat(I.MAX_BYTES+1))),/terlalu besar/);
 await assert.rejects(I.read(new Response('not json')));
 const result=await I.read(new Response(JSON.stringify({type:'FeatureCollection',features:[copy()]})));
 assert.equal(result.fdrs.features.length,1);
});
test('staff module loads inventory only on explicit layer choice after backend authorization',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../js/restoration-priority.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../restoration-priority.html'),'utf8');
 assert.match(js,/id: 'fdrs'.*inventory: true/);
 assert.match(js,/id: 'blocks'.*inventory: true/);
 assert.doesNotMatch(js,/path: 'data\/sekat_kanal.geojson'/);
 assert.ok(js.indexOf("catalog.access !== 'staff_only'")<js.indexOf('renderControls();'));
 assert.match(js,/input.addEventListener\('change', \(\) => toggle\(def, input\)\)/);
 assert.match(html,/js\/restoration-inventory.js/);
});
test('simultaneous FDRS and canal selections share a request and failed loads remain retryable',async()=>{
 const vm=require('node:vm');const js=fs.readFileSync(path.join(__dirname,'../js/restoration-priority.js'),'utf8');
 const method=js.slice(js.indexOf('  async function layerData('),js.indexOf('  function popup('));
 const state={cache:new Map(),pendingData:new Map()};let requests=0,fail=true;
 const context={state,I,AbortSignal,fetch:async()=>{requests++;if(fail)throw Error('unavailable');return new Response(JSON.stringify({type:'FeatureCollection',features:[copy()]}));}};
 vm.runInNewContext(method,context);
 const def={id:'fdrs',inventory:true,path:'existing-snapshot'};
 await assert.rejects(context.layerData(def),/unavailable/);assert.equal(state.pendingData.size,0);assert.equal(state.cache.size,0);
 fail=false;
 const [fdrs,blocks]=await Promise.all([context.layerData(def),context.layerData({...def,id:'blocks'})]);
 assert.equal(requests,2);assert.equal(fdrs.features.length,1);assert.equal(blocks.features.length,0);assert.equal(state.pendingData.size,0);
});
test('inventory district filter uses existing normalized administrative attributes',()=>{
 const vm=require('node:vm');const js=fs.readFileSync(path.join(__dirname,'../js/restoration-priority.js'),'utf8');
 const method=js.slice(js.indexOf('  function scoped('),js.indexOf('  function draw('));
 const data=I.select(original).fdrs,regency=data.features[0].properties.Kabupaten;
 assert.ok(regency);
 const context={A:require('../js/restoration-scoring.js'),$:()=>({value:regency}),state:{filtered:[]}};
 vm.runInNewContext(method,context);
 const filtered=context.scoped({id:'fdrs',inventory:true},data);
 assert.ok(filtered.length>0);assert.ok(filtered.every(f=>context.A.district(f.properties.Kabupaten)===context.A.district(regency)));
});
