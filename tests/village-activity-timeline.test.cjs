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

test('verified attribution enriches exact existing IDs without adding events or inferring numbered phases',()=>{
 const features=[feature({reportId:'YG-ONE',Donor:'Donor belum tercatat',targetFeatureProperties:{Fase:'Fase 2'},photos:['https://example.org/photo.jpg']}),feature({reportId:'OTHER',activityDate:'2026-07-01'})];
 const attributions=[{evidenceId:'MONITORING-YG-ONE',donor:'Aramco',phase:'Fase 3',source:'https://example.org/report'},{evidenceId:'OTHER',donor:'GEC',phase:'',source:'https://example.org/report'},{evidenceId:'ABSENT',donor:'GEC',source:'https://example.org/report'}];
 const rows=timeline.buildRecords(features,[],{attributions});
 assert.equal(rows.length,2);const row=rows.find(r=>r.id==='YG-ONE');assert.equal(row.donor,'Aramco Asia Singapore');assert.equal(row.phase,'Fase 3');assert.equal(row.photos.length,1);assert.equal(rows.find(r=>r.id==='OTHER').phase,'');
 assert.equal(timeline.buildRecords([feature({reportId:'YG-ONE-similar'})],[],{attributions})[0].donor,'Donor belum tercatat');
});
