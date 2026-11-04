const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const api=require('../js/aramco-phase3-reconciliation.js'),data=require('../data/aramco-phase3-final.json');
const json=f=>JSON.parse(fs.readFileSync(f)),old=f=>JSON.parse(cp.execFileSync('git',['show','HEAD:'+f],{maxBuffer:30e6,encoding:'utf8'}));
test('canonical establishment ledger reconciles all phases and excludes replacements and duplicate events',()=>{
 assert.deepEqual(api.totals(data),{trees:18480,target:18000});const tk=data.villages.at(-1);assert.equal(api.villageCount(tk),4010);assert.equal(tk.events.slice(0,-1).reduce((n,e)=>n+e.seedlings,0),3727);
 assert.equal(api.villageCount({...tk,events:tk.events.concat(tk.events)}),4010);assert.equal(api.cumulative(json('data/donors.json').find(d=>d.id==='DNR-ARAMCO')),44125);
 assert.equal(api.totals(data).trees/data.villages.reduce((n,v)=>n+v.target,0)*100,102.66666666666666);
});
test('other donors and Phase I/II are identical; milestone tags link existing training IDs',()=>{
 const before=old('data/donors.json'),after=json('data/donors.json');for(const d of before){const updated=after.find(a=>a.id===d.id);if(d.id!=='DNR-ARAMCO')assert.deepEqual(updated,d);else{assert.deepEqual(updated.programs.slice(0,2),d.programs.slice(0,2));for(const id of ['CB-2026-007','CB-2026-009',data.training.evidenceId])assert(updated.verifiedEvidence.some(e=>e.evidenceId===id&&e.programmeId==='PRG-ARAMCO-PHASE-03'));}}
 assert.equal(data.training.postTestRespondents,31);assert.equal(data.training.averagePercent,87.1);assert.equal(data.reporting.submitted,false);
 assert.deepEqual(api.reconcileDonors(after,data),after);
});
test('all polygon coordinates and monitoring results survive; planting documentation is not monitoring',()=>{
 const before=old('data/area_mangrove.geojson'),after=json('data/area_mangrove.geojson');for(const f of before.features){const updated=after.features.find(a=>a.properties.Object_ID===f.properties.Object_ID);assert.deepEqual(updated.geometry,f.geometry);if(f.properties.Object_ID!==data.villages.at(-1).objectId)assert.deepEqual(updated,f);}
 const master=old('data/master-database-snapshot.json'),updated=json('data/master-database-snapshot.json');for(const f of master.features){const current=updated.features.find(a=>a.properties.Object_ID===f.properties.Object_ID);if(!current)throw Error('Missing '+f.properties.Object_ID);assert.deepEqual(current.geometry,f.geometry);for(const k of ['Survival','Jumlah_Hidup','Jumlah_Mati_Rusak'])assert.deepEqual(current.properties[k],f.properties[k]);}
 assert.equal(updated.features.filter(f=>f.properties.Object_ID===data.activity.id).length,1);const activity=updated.features.find(f=>f.properties.Object_ID===data.activity.id);assert.equal(activity.geometry,null);assert.equal(activity.properties.documentationType,'planting_activity');assert.equal(activity.properties.photos.length,2);
 assert.deepEqual(api.applyObjects(updated,data),updated);
});
