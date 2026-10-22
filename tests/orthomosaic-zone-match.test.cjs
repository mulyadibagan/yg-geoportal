const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const turf=require('../cloudflare/yg-webgis-public-data/node_modules/@turf/turf');
const T={...turf,intersect:(a,b)=>turf.intersect(turf.featureCollection([a,b])),union:(a,b)=>turf.union(turf.featureCollection([a,b]))};
const context={window:{}};vm.runInNewContext(fs.readFileSync('js/orthomosaic-area-store.js','utf8'),context);const match=context.window.YG_ORTHO_AREA_STORE.matchZones;
const square=(x,id)=>turf.polygon([[[x,0],[x+2,0],[x+2,2],[x,2],[x,0]]],{sourceGawanganId:id});
test('saved names are matched by geometry rather than Area numbers; crossing two zones is explicit',()=>{
 const f=square(1);f.properties={name:'Area 9'};const result=match(turf.featureCollection([f]),turf.featureCollection([square(0,'GT-A-03'),square(2,'GT-A-04')]),T)[0];
 assert.equal(result.name,'Area 9');assert.equal(result.matches.length,2);for(const m of result.matches)assert.ok(Math.abs(m.percent-50)<.000001);assert.equal(result.matches.map(m=>m.zone).sort().join(','),'GT-A-03,GT-A-04');
});
test('duplicate multipart reference does not double count area and non-gawangan layers are excluded',()=>{
 const reference=turf.featureCollection([square(0,'GT-A-01'),square(0,'GT-A-01'),square(0,'GM-A-001')]);
 const result=match(turf.featureCollection([square(0)]),reference,T)[0];assert.equal(result.matches.length,1);assert.ok(Math.abs(result.matches[0].percent-100)<.000001);assert.equal(result.errors.length,0);
});
test('outside polygons and gaps are not assigned to nearest or numbered gawangan',()=>{
 const result=match(turf.featureCollection([square(4)]),turf.featureCollection([square(0,'GT-A-01'),square(8,'GT-A-03')]),T)[0];assert.equal(result.matches.length,0);assert.equal(result.errors.length,0);
});
