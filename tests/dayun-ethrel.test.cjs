const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../js/dayun-ethrel.js');
const details=c=>({objects:[{objectId:'DAYUN-GT-B-12',block:'B',crops:[{crop:'NANAS',vegetationCount:1000,plantingDate:'2026-01-01',...c}]}]});
const event=(activityType,activityDetails,date='2026-10-01')=>({properties:{targetLayerId:'dayun_gawangan',targetObjectId:'DAYUN-GT-B-12',proposedInformation:JSON.stringify({monitoringType:'Agroforestri Dayun',crop:'NANAS',eventDate:date,activityType,activityDetails})}});
const row=(d,p)=>build(d,p,{asOf:'2026-10-12'}).rows[0];
test('August planting stays separate from old population and Ethrel history',()=>{
 const d=details({ethrelTotal:900,plantingCohorts:[{period:'2026-08',plantedCount:1029}]}),r=build(d,null,{asOf:'2026-10-12'}).rows;
 assert.equal(r.length,2);assert.equal(r[0].treated,900);assert.equal(r[0].plants,1000);
 assert.equal(r[1].plants,1029);assert.equal(r[1].age,2);assert.equal(r[1].group,'maintenance');assert.equal(r[1].treated,null);assert.equal(r[1].remaining,null);assert.match(r[1].reason,/Mei 2027|mei 2027/);
});
test('new planting displays even when old population is absent',()=>{
 const d=details({vegetationCount:null,plantingCohorts:[{period:'2026-08',plantedCount:4193}]}),r=build(d,null,{asOf:'2026-10-12'}).rows;
 assert.equal(r.length,1);assert.equal(r[0].plants,4193);assert.equal(r[0].group,'maintenance');
});
test('new cohort reaches inspection age without being auto declared ready',()=>{
 const d=details({vegetationCount:0,plantingCohorts:[{period:'2026-08',plantedCount:100}]}),r=build(d,null,{asOf:'2027-05-01'}).rows[0];assert.equal(r.age,9);assert.equal(r.group,'verify');assert.equal(r.treated,null);
});
test('supplied August counts reconcile to 16 gawangan and 29299 planted seedlings',()=>{
 const d=require('../data/dayun-gawangan-details.json');const cohorts=d.objects.flatMap(o=>(o.crops||[]).flatMap(c=>(c.plantingCohorts||[]).filter(x=>x.period==='2026-08')));assert.equal(cohorts.length,16);assert.equal(cohorts.reduce((s,x)=>s+x.plantedCount,0),29299);
});
test('nine months triggers inspection, never automatic ready status',()=>{
 const r=row(details({ethrelTotal:0}));assert.equal(r.age,9);assert.equal(r.group,'verify');assert.equal(r.remaining,1000);assert.match(r.reason,/Periksa tanaman/);assert.doesNotMatch(r.label,/Siap/);
});
test('unknown Ethrel is distinguished from zero and missing age stays unknown',()=>{
 const r=row(details({plantingDate:null,plantingPeriod:null}));assert.equal(r.age,null);assert.equal(r.treated,null);assert.equal(r.remaining,null);assert.equal(r.label,'Verifikasi umur');
});
test('unplanted polygons never inflate Ethrel candidates',()=>{
 assert.equal(build(details({vegetationCount:0}),null,{asOf:'2026-10-12'}).rows.length,0);
});
test('young plants remain in maintenance',()=>{
 assert.equal(row(details({plantingDate:'2026-06-01',ethrelTotal:0})).group,'maintenance');
});
test('partial Ethrel is kept visible for cohort verification',()=>{
 const r=row(details({ethrel:[{period:'2026-09-01',count:400}]}));assert.equal(r.group,'followup');assert.equal(r.remaining,600);assert.match(r.reason,/Jangan mengulang/);
});
test('latest published census wins and is not subtracted from older cohort totals',()=>{
 const p={features:[event('Sensus tanaman',{livingPlantCount:900},'2026-09-01'),event('Sensus tanaman',{livingPlantCount:600},'2026-10-01')]};
 const d=details({ethrelTotal:800}),r=row(d,p);assert.equal(r.plants,600);assert.equal(r.remaining,null);assert.equal(r.group,'verify');assert.equal(d.objects[0].crops[0].vegetationCount,1000);
});
test('published Ethrel deduplicates existing period and count',()=>{
 const r=row(details({ethrel:[{period:'2026-10-01',count:400}]}),{features:[event('Ethrel',{treatedPlantCount:400}),event('Ethrel',{treatedPlantCount:100},'2026-10-02')]});assert.equal(r.treated,500);assert.equal(r.history.length,2);
});
test('future reports and other layers do not affect current results',()=>{
 const e=event('Ethrel',{treatedPlantCount:100});e.properties.targetLayerId='other';
 const r=row(details({ethrelTotal:0}),{features:[event('Ethrel',{treatedPlantCount:200},'2026-12-01'),e]});assert.equal(r.treated,0);
});
test('flower or harvest records require separating untreated plants even without Ethrel log',()=>{
 const r=row(details({pineappleFlowerCount:100,ethrelTotal:0}));assert.equal(r.group,'verify');assert.equal(r.label,'Pisahkan kelompok tanaman');
});
test('published census adds a mapped gawangan absent from initial crop data',()=>{
 const e=event('Sensus tanaman',{livingPlantCount:350});e.properties.targetObjectId='DAYUN-GT-B-15';
 const result=build({objects:[]},{features:[e]},{asOf:'2026-10-12'});assert.equal(result.rows.length,1);assert.equal(result.rows[0].id,'DAYUN-GT-B-15');assert.equal(result.rows[0].plants,350);
});

