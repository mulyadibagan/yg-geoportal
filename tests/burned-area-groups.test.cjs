const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {groupEvents,unknown}=require('../js/burned-area-groups.js');
const feature=(id,total,parts,names)=>({type:'Feature',properties:{eventId:id,estimatedAreaHa:total,villageAreas:parts,regencies:names||[]},geometry:null});
test('cross-regency events allocate area once and duplicate geometries do not duplicate totals',()=>{
 const f=feature('a',100,[{regency:'Siak',areaHa:40},{regency:'Bengkalis',areaHa:60}]);
 const m=groupEvents({features:[f,f]});assert.equal(m.events.length,1);assert.equal(m.events[0].features.length,2);assert.equal(m.areaHa,100);assert.deepEqual(m.groups.map(g=>[g.name,g.areaHa,g.events.length]),[['Bengkalis',60,1],['Siak',40,1]]);
});
test('unassigned area and multi-regency legacy records are kept in an explicit unknown group',()=>{
 const m=groupEvents({features:[feature('a',100,[{regency:'Siak',areaHa:70}]),feature('b',20,[],['Siak','Bengkalis'])]});
 assert.equal(m.groups.find(g=>g.name===unknown).areaHa,50);assert.equal(m.groups.find(g=>g.name==='Siak').areaHa,70);
});
test('rounding and overlap excess never inflate regency sums',()=>{
 const m=groupEvents({features:[feature('a',100,[{regency:'Siak',areaHa:80},{regency:'Bengkalis',areaHa:80}])]});assert.equal(m.groups.reduce((n,g)=>n+g.areaHa,0),100);
});
test('ambiguous combined regency names are never presented as an additional kabupaten',()=>{
 const m=groupEvents({features:[feature('a',10,[{regency:'Indragiri Hulu / Indragiri Hilir',areaHa:10}])]});assert.equal(m.groups[0].name,unknown);assert.equal(m.groups[0].areaHa,10);
});
test('current and monthly source totals reconcile with regency sums',()=>{
 for(const p of ['data/burned-area-estimates.geojson','data/burned-area-monthly/2026-09.geojson','data/burned-area-monthly/2026-08.geojson']){
 const m=groupEvents(JSON.parse(fs.readFileSync(p)));assert.ok(Math.abs(m.areaHa-m.groups.reduce((n,g)=>n+g.areaHa,0))<0.001,p);assert.ok(m.groups.every(g=>new Set(g.events.map(e=>e.id)).size===g.events.length));
 }
});
