const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const history=require('../js/map-hotspot-history.js');
test('uses available reports from July onward, including future months, without duplicates',()=>{
  const reports=['2026-06','2026-07','2026-10','2027-01','bad','2026-07'].map(month=>({month}));
  assert.deepEqual(history.entries({reports}).map(r=>r.month),['2026-07','2026-10','2027-01']);
});
test('preserves separate satellite detections and rejects wrong-month or invalid coordinates',()=>{
  const p={date:'2026-07-09',time:'0722',latitude:2,longitude:100,satellite:'N21'};
  const rows=[p,{...p},{...p,satellite:'SNPP'},{...p,time:'0822'},{...p,date:'2026-08-09'},{...p,latitude:null},{...p,longitude:'bad'}];
  assert.equal(history.points({hotspots:rows},'2026-07').length,3);
});
test('popup escapes report text and links to the source month without private attributes',()=>{
  const html=history.popup({date:'2026-07-09',time:'0722',latitude:2,longitude:100,village:'<script>',permits:['private']},'2026-07','final');
  assert.match(html,/07:22 UTC/);assert.match(html,/&lt;script&gt;/);assert.match(html,/fire-monthly-report.html\?month=2026-07/);assert.doesNotMatch(html,/private/);
});
test('partial network failures remain explicit and retry succeeds without reloading completed months',async()=>{
  const rows=[{month:'2026-07',generatedAt:'1',status:'final'},{month:'2026-08',generatedAt:'1',status:'final'}],cache={};
  let failed=true,calls=[];
  const fetcher=async url=>{calls.push(url);const month=url.match(/2026-\d{2}/)[0];if(month==='2026-08'&&failed)throw Error('offline');return{month,hotspots:[]};};
  let results=await history.loadReports(rows,fetcher,cache);
  assert.equal(results.filter(r=>r.error).length,1);
  failed=false;results=await history.loadReports(rows,fetcher,cache);
  assert.equal(results.filter(r=>r.error).length,0);assert.equal(calls.length,3);
});
test('recent detections stay in Riau and do not duplicate finalized months',()=>{
  const boundary={features:[{geometry:{type:'Polygon',coordinates:[[[100,0],[104,0],[104,3],[100,3],[100,0]]]}}]};
  const feature=(date,coordinates)=>({geometry:{type:'Point',coordinates},properties:{acq_date:date,acq_time:'0700',satellite:'N21'}});
  const data={features:[feature('2026-11-24',[101,1]),feature('2026-10-01',[101,1]),feature('2026-11-24',[110,1])]};
  assert.equal(history.recentPoints(data,boundary,new Set(['2026-10'])).length,1);
  assert.doesNotMatch(history.popup(history.recentPoints(data,boundary,new Set(['2026-10']))[0],'2026-11','recent'),/fire-monthly-report/);
});
test('unavailable report is not cached as zero detections',async()=>{
  const cache={};const results=await history.loadReports([{month:'2026-07'}],async()=>({month:'2026-07',unavailable:true,hotspots:[]}),cache);
  assert.ok(results[0].error);assert.equal(Object.keys(cache).length,0);
});
test('report fixtures retain every valid detection',()=>{
  for(const month of ['2026-07','2026-08','2026-09']){
    const report=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/fire-monthly/'+month+'.json'),'utf8'));
    assert.equal(history.points(report,month).length,report.summary.hotspots);
  }
});
