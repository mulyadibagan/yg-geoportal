const test=require('node:test'),assert=require('node:assert/strict');
const {freshest,create}=require('../js/village-timeline-sync.js');
const {buildRecords}=require('../js/village-activity-timeline.js');
const f=p=>({properties:p});
test('newer public snapshot wins without resurrecting removed records from stale R2',()=>{
 const old={generatedAt:'2026-11-04T00:00:00Z',features:[f({Object_ID:'removed'})]};
 const latest={generatedAt:'2026-11-12T00:00:00Z',features:[f({Object_ID:'new'})]};
 assert.equal(freshest([old,latest]),latest);assert.equal(freshest([latest,old]),latest);
 assert.throws(()=>freshest([null,{}]));
});
test('live sync fetches only changed revisions and retries after failures while preserving old records',async()=>{
 let version='A',loads=0,updates=0,fail=false,visible=true,errors=0,clock=30000;
 const controller=create({now:()=>clock,visible:()=>visible,revision:async()=>version,load:async()=>{loads++;if(fail)throw Error('offline');return {version};},apply:()=>{updates++;},onError:()=>{errors++;}});
 await controller.check(true);assert.equal(updates,1);
 // Force triggers intentionally reload; normal repeated calls are throttled.
 await controller.check();assert.equal(loads,1);
 clock+=60000;await controller.check();assert.equal(loads,1);
 version='B';fail=true;await controller.check(true);assert.equal(updates,1);assert.equal(errors,1);
 fail=false;await controller.check(true);assert.equal(updates,2);
 visible=false;await controller.check(true);assert.equal(updates,2);
 controller.stop();visible=true;await controller.check(true);assert.equal(updates,2);
});
test('Sepahat Aramco activities during its documented phase III period retain phase labels',()=>{
 const row=buildRecords([f({reportId:'SP',activityDate:'2026-07-09',Donor:'Aramco',photos:['https://drive.google.com/file/d/PHOTO/view?usp=one','https://drive.google.com/file/d/PHOTO/view?usp=two']})],[],{name:'Sepahat'})[0];
 assert.equal(row.phase,'Fase 3');assert.equal(row.photos.length,1);
 const later=buildRecords([f({reportId:'LATER',activityDate:'2028-01-01',Donor:'Aramco'})],[],{name:'Sepahat'})[0];assert.equal(later.phase,'');
});
test('report, asset and training evidence share one ID with donor metadata and newest photo revision',()=>{
 const donors=[{name:'Aramco Asia Singapore',programs:[{id:'P3',phase:'Fase 3'}],verifiedEvidence:[{evidenceId:'MONITORING-YG-1',programmeId:'P3'}]}];
 const records=buildRecords([
  f({Source_Report_ID:'YG-1',Source_Type:'verified_report_asset',Object_ID:'ASSET',Donor:'Aramco Asia Singapore',photos:['https://example.org/asset.jpg']}),
  f({reportId:'YG-1',Source_Type:'monitoring_report',Object_ID:'MONITORING-YG-1',Revision:2,photos:['https://example.org/new.jpg']}),
  f({reportId:'YG-1',Source_Type:'monitoring_report',Revision:1,photos:['https://example.org/old.jpg']}),
  f({reportId:'PENDING',status:'pending_review'}),f({reportId:'REJECTED',status:'Ditolak'})
 ],[{id:'MONITORING-YG-1',name:'Same training representation'}],{donors});
 assert.equal(records.length,1);assert.equal(records[0].donor,'Aramco Asia Singapore');assert.equal(records[0].phase,'Fase 3');
 assert.ok(records[0].photos.includes('https://example.org/new.jpg'));assert.ok(records[0].photos.includes('https://example.org/asset.jpg'));assert.ok(!records[0].photos.includes('https://example.org/old.jpg'));
});
test('explicit activity IDs and reviewed EWS reports merge photos, while distinct monitoring dates remain separate',()=>{
 let rows=buildRecords([f({reportId:'YG-20260901-201544-276',activityDate:'24/08/2026',photos:['https://example.org/a.jpg']}),f({reportId:'YG-20260901-202530-896',activityDate:'26/08/2026',photos:['https://example.org/b.jpg']})],[]);
 assert.equal(rows.length,1);assert.equal(rows[0].photos.length,2);assert.equal(rows[0].links.length,2);assert.equal(rows[0].date.label,'23–26 Agustus 2026');
 rows=buildRecords([f({reportId:'1',Event_ID:'EVENT'}),f({reportId:'2',Event_ID:'EVENT'}),f({reportId:'3',title:'Monitoring',activityDate:'2026-10-01'}),f({reportId:'4',title:'Monitoring',activityDate:'2026-11-01'})],[]);
 assert.equal(rows.length,3);
});
