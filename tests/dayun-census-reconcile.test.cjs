const {test}=require('node:test'),assert=require('node:assert/strict'),T=require('../cloudflare/yg-webgis-public-data/node_modules/@turf/turf'),tool=require('../js/dayun-census-reconcile.js');
const area=T.polygon([[[102,0],[102.0001,0],[102.0001,.0001],[102,.0001],[102,0]]]);
const pt=(id,x=102.00002,status='candidate',origin='automated')=>T.point([x,.00002],{id,status,origin,zones:['GT-A-01'],note:''});
test('reconcile exact count inside saved area, preserve all outside and rejected features',async()=>{
 const points=[pt('observed'),pt('rejected',102.00003,'rejected'),pt('outside',103)],before=JSON.stringify(points);let i=0;
 const r=await tool.plan({rows:[{zone:'GT-A-01',target:20,area,allowed:[area]}],points,T,block:'A',id:()=>String(++i).padStart(12,'0'),validCoordinate:c=>c[0]<102.00008,yieldWork:()=>Promise.resolve()});
 assert.equal(r.updates.length,19);assert.equal(JSON.stringify(points),before);for(const f of r.updates){assert(T.booleanPointInPolygon(f,area));assert(f.geometry.coordinates[0]<102.00008);assert(f.properties.note.startsWith(tool.PREFIX));assert.equal(f.properties.status,'candidate');assert.equal(f.properties.species_confirmed,false);}
 const effective=new Map(points.map(f=>[f.properties.id,f]));r.updates.forEach(f=>effective.set(f.properties.id,f));const all=[...effective.values()];assert.equal(all.filter(f=>f.properties.status!=='rejected'&&T.booleanPointInPolygon(f,area)).length,20);
 const repeat=await tool.plan({rows:[{zone:'GT-A-01',target:20,area,allowed:[area]}],points:all,T,block:'A'});assert.equal(repeat.updates.length,0);
});
test('excess points excluded reversibly, protect accepted and manual first; no negative species label',async()=>{
 const points=[pt('accepted',102.00002,'accepted'),pt('manual',102.00003,'candidate','manual_addition'),pt('auto',102.00004)],before=JSON.stringify(points);
 const r=await tool.plan({rows:[{zone:'GT-A-01',target:2,area,allowed:[area]}],points,T,block:'A'});assert.equal(r.updates.length,1);assert.equal(r.updates[0].properties.id,'auto');assert.equal(r.updates[0].properties.status,'rejected');assert.equal(r.updates[0].properties.rejection_reason,'unspecified');assert.equal(JSON.stringify(points),before);
});
test('missing census skipped; mapping uses geometry instead of Area number; duplicate zone fails closed',()=>{
 const boundaries=T.featureCollection([{...area,properties:{sourceGawanganId:'GT-A-01'}}]),census={objects:[{objectId:'DAYUN-GT-A-01',crops:[{crop:'NANAS',plantingCohorts:[{period:'2026-08',plantedCount:10}]}]}]},record={name:'Batas nanas baru Blok A sampai A9',collection:T.featureCollection([{...area,properties:{name:'Area 9'}}])};
 assert.equal(tool.targets({records:[record],census,boundaries,block:'A',T})[0].zone,'GT-A-01');assert.equal(tool.targets({records:[record],census:{objects:[]},boundaries,block:'A',T}).length,0);assert.throws(()=>tool.targets({records:[record,record],census,boundaries,block:'A',T}),/lebih dari satu/);
});
test('insufficient native image coverage fails before any updates; shared points reject ambiguous masks',async()=>{
 const row={zone:'GT-A-01',target:20,area,allowed:[area]};await assert.rejects(tool.plan({rows:[row],points:[],T,block:'A',validCoordinate:()=>false,yieldWork:()=>Promise.resolve()}),/tidak cukup/);
 await assert.rejects(tool.plan({rows:[{...row,target:1},{...row,zone:'GT-A-02',target:1}],points:[pt('observed')],T,block:'A'}),/tumpang tindih/);
});
