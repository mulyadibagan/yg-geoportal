const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const api=require('../js/dashboard-years.js'),plants=require('../js/planting-inventory.js');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',p)));
const objects=plants.mergeFeatureCollections(read('master-database-snapshot.json'),['area_mangrove.geojson','kopi.geojson','area_kopi.geojson'].map(read));
const rows=plants.summarize(objects,read('village-activity-attributions.json').attributions,read('desa_intervensi.geojson').features);
const entries=api.build({planting:{objects,rows},features:objects,capacity:read('capacity-building.json')});
test('annual planting buckets reconcile to the deduplicated inventory',()=>{
 const totals=plants.aggregate(rows),years=[...new Set(entries.map(e=>e.year))];
 assert.equal(years.reduce((n,y)=>n+api.summary(entries,y).plants,0),Object.values(totals).reduce((a,b)=>a+b,0));
 for(const c of Object.keys(totals))assert.equal(years.reduce((n,y)=>n+api.summary(entries,y)[c],0),totals[c]);
});
test('Temiang splits explicit cohorts and leaves the 2021–2022 baseline unassigned',()=>{
 const records=entries.filter(e=>e.id==='reviewed:temiang-coffee-2021-2025-source-reconciled');
 assert.deepEqual(records.map(e=>[e.year,e.count]),[['unknown',400],['2023',200],['2024',500],['2025',1200]]);
});
test('Pematang Duku planting history takes precedence over mapping year',()=>{
 const r=entries.filter(e=>e.kind==='planting'&&e.name.includes('Pematang Duku'));
 assert.ok(r.some(e=>e.year==='2025'&&e.count===2500));
});
test('monitoring dates do not become planting years; shared reviewed total remains one cohort',()=>{
 const r=entries.filter(e=>e.id==='reviewed:imbo-putui-restoration-2025-1200');
 assert.equal(r.length,1);assert.equal(r[0].year,'unknown');assert.equal(r[0].count,1200);
});
test('unknown dates, duplicate assets, and repeated attendance have separate semantics',()=>{
 const f={properties:{Object_ID:'FDRS-X',Layer_ID:'fdrs',Tahun:'2025',Desa:'X',Kabupaten:'Siak'}};
 const input={planting:{objects:[],rows:[]},features:[f,f],capacity:[{id:'A',date:'2025-03-01',male:10,village:'X',regency:'Siak'},{id:'A',date:'2025-03-01',male:10,village:'X',regency:'Siak'},{id:'B',date:'2025-04-01',male:10,village:'X',regency:'Siak'}]};
 const s=api.summary(api.build(input),'2025');assert.equal(s.fdrs,1);assert.equal(s.trainings,2);assert.equal(s.participants,20);assert.equal(s.villages.size,1);
 assert.equal(api.year('2021–2022'),'unknown');assert.equal(api.year('2026-11-12T00:00:00Z'),'2026');assert.equal(api.historyParts('2025: 200 bibit',400),null);
});

test('Indonesian report dates are parsed without using publication dates',()=>{assert.equal(api.year('17/07/2026'),'2026');assert.equal(api.year('31/02/2026'),'unknown');const records=api.build({planting:{objects:[],rows:[]},features:[],capacity:[{id:'R1',date:'2026-11-13',achievementDate:'',male:20},{id:'R2',achievementDate:'25/07/2026',male:43}]});assert.equal(api.summary(records,'2026').participants,43);assert.equal(api.summary(records,'unknown').participants,20);});
