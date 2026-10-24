const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const data=require('../data/dayun-work-counts.json'),details=require('../data/dayun-gawangan-details.json'),api=require('../js/dayun-work-summary.js');
test('unified allocation counts each point once and reconciles to the complete Excel',()=>{
 assert.equal(data.rows.length,40);assert.equal(new Set(data.rows.map(r=>r.zone)).size,40);
 assert.deepEqual(api.totals(data.rows),{plants:74465,newPlants:30244,fruits:2005,allocated:3113});
 for(const r of data.rows){assert(r.plants>=r.newPlants);assert(r.plants>=r.allocated);assert(Number.isInteger(r.fruits));}
});
test('profile and block filters retain assigned outside points and GM fruit',()=>{
 const b15=api.rowsFor(data,'DAYUN-GT-B-15')[0];assert.equal(b15.plants,2370);assert.equal(b15.fruits,229);assert.equal(b15.plantingMonth,'Desember 2024');
 assert.deepEqual(api.totals(api.rowsFor(data,null,'B')),{plants:27684,newPlants:7098,fruits:1602,allocated:data.rows.filter(r=>r.block==='B').reduce((s,r)=>s+r.allocated,0)});
 for(const [id,count]of [['GT-A-03',219],['GT-A-05',210],['GT-A-11',1084]])assert.equal(data.rows.find(r=>r.zone===id).newPlants,count);
});
test('July B5-B8 planting update leaves original census and planting period intact',()=>{
 for(const [id,count]of [['GT-B-05',467],['GT-B-06',1476],['GT-B-07',2],['GT-B-08',14]]){
  const r=data.rows.find(r=>r.zone===id),crop=details.objects.find(o=>o.objectId==='DAYUN-'+id).crops.find(c=>c.crop==='NANAS');
  assert.equal(r.newPlants,count);assert.equal(r.newPlantingMonth,'Juli 2026');assert.equal(crop.newPlantingIndication.plantingPeriod,'2026-07');assert.equal(crop.newPlantingIndication.plantCount,null);assert(!crop.plantingCohorts?.some(c=>c.period==='2026-08'));
 }
 assert.equal(data.rows.find(r=>r.zone==='GT-A-12').newPlants,0);
});
test('all requested web surfaces refresh live counts without falling back to frozen snapshots',()=>{
 for(const file of ['dayun-gawangan.html','dayun-blok.html','orthomosaic-internal.html']){const html=fs.readFileSync(file,'utf8');assert.match(html,/data-dayun-work-summary=/);assert.match(html,/dayun-work-summary\.js\?v=20261024-live1/);}
 const js=fs.readFileSync('js/dayun-work-summary.js','utf8');assert.match(js,/cache:'no-store'/);assert.match(js,/live-work-counts\.json/);assert.match(js,/dayun:work-saved/);assert.match(js,/15000/);assert.doesNotMatch(js,/fetch\('data\/dayun-work-counts/);
});
