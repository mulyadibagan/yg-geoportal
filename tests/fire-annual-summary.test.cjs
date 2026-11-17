const test=require('node:test'),assert=require('node:assert/strict'),annual=require('../js/fire-annual-summary.js');
const report=(month,points=[])=>({month,status:'final',period:{start:month+'-01',end:month+'-30'},hotspots:points});
const point=date=>({date,time:'1230',longitude:101,latitude:1,satellite:'N20',village:'Desa A',district:'Kecamatan A',regency:'Bengkalis'});
test('2026 starts in July, excludes earlier and provisional months, and deduplicates detections',()=>{
 const july=point('2026-07-02'),aug=point('2026-08-03');
 const result=annual.aggregate('2026',[report('2026-06',[point('2026-06-01')]),report('2026-07',[july,july]),report('2026-08',[aug]),{...report('2026-09',[point('2026-09-01')]),status:'partial'}]);
 assert.equal(result.summary.hotspots,2);assert.equal(result.summary.villages,1);assert.equal(result.period.start,'2026-07-01');assert.deepEqual(result.months,['2026-07','2026-08']);assert.equal(result.status,'partial');assert.deepEqual(result.daily.map(x=>x.hotspots),[1,1]);
});
test('missing final months remain explicit rather than being treated as zero',()=>{assert.deepEqual(annual.aggregate('2026',[report('2026-07'),report('2026-09')]).missingMonths,['2026-08']);});
test('no final reports is an error',()=>assert.throws(()=>annual.aggregate('2026',[])));
