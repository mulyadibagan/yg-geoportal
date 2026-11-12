const test=require('node:test');
const assert=require('node:assert/strict');
const timeline=require('../js/village-activity-timeline.js');
const feature=p=>({properties:p});
test('timeline uses activity date, merges repeated report IDs and retains distinct reports',()=>{
 const records=timeline.buildRecords([
  feature({Source_Report_ID:'A',Object_ID:'OBJECT-A',activityDate:'26/08/2026',Donor:'Penabulu',photos:['https://example.org/1.jpg','javascript:bad','https://example.org/1.jpg']}),
  feature({reportId:'A',activityDate:'2026-08-26'}),
  feature({reportId:'B',receivedAt:'2026-11-12',Tahun:'2026'}),
  feature({reportId:'C',activityDate:'2025-10-28',targetFeatureProperties:{Donor:'GEC'}})
 ],[{id:'TRAINING',date:'2024-10-28',name:'Nursery',partner:'Universitas'}]);
 assert.equal(records.length,4);
 assert.deepEqual(records.map(r=>r.id),['A','C','TRAINING','B']);
 assert.equal(records[0].photos.length,1);
 assert.equal(records[0].donor,'Yayasan Penabulu');
 assert.equal(records[1].donor,'Global Environment Centre');
 assert.equal(records[2].donor,'Donor belum tercatat');
 assert.equal(records[3].date.year,'unknown');
 assert.match(records[0].url,/OBJECT-A/);
});
test('invalid dates remain undated and ISO date never shifts across time zones',()=>{
 assert.equal(timeline.dateInfo('31/02/2026').year,'unknown');
 assert.equal(timeline.dateInfo('2026').year,'unknown');
 assert.equal(timeline.dateInfo('2026-08-26').year,'2026');
 assert.equal(timeline.dateInfo('2026-08-26').sort,timeline.dateInfo('26/08/2026').sort);
});
