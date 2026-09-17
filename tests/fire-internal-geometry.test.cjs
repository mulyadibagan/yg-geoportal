const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze,area,project}=require('../js/fire-internal-geometry.js');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const rectangle=(x,y,w,h,properties={})=>({type:'Feature',properties,geometry:{type:'Polygon',coordinates:[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]]}});
const fc=features=>({type:'FeatureCollection',features});
const pbph=fc([rectangle(101,1,.02,.02,{PBPH_ID:'P1',NAMOBJ:'Test PBPH'})]);
const rspo=fc([rectangle(101,1,.02,.02,{Parent:'Test Group',MemberNum:'M1'})]);
const event=rectangle(101.002,1.002,.008,.008,{archiveEventId:'E1'});
const run=(burned,other={})=>analyze({burned:fc(burned),pbph,rspo,report:{hotspots:[]},...other});
test('UTM 47 matches reference projection and excludes holes',()=>{
  const [x,y]=project([101,1]);assert.ok(Math.abs(x-722561.73647886)<.002);assert.ok(Math.abs(y-110597.97252381)<.002);
  const outer=rectangle(101,1,.02,.02),hole=rectangle(101.005,1.005,.005,.005);
  assert.ok(Math.abs(area([[outer.geometry.coordinates[0],hole.geometry.coordinates[0]]])-(area([outer.geometry.coordinates])-area([hole.geometry.coordinates])))<1e-8);
});
test('duplicate events and overlapping categories do not double-count',()=>{
  const r=run([event,event]);const expected=area([event.geometry.coordinates]);
  assert.ok(Math.abs(r.pbph.uniqueHa-expected)<1e-7);assert.equal(r.pbph.rows[0].events.length,1);
  assert.equal(r.combinedHa,r.pbph.uniqueHa);assert.equal(r.rspo.groupLevel,true);
});
test('partial overlap is clipped and burned-only area appears',()=>{
  const r=run([rectangle(101.01,1.01,.02,.02)]);
  const expected=area([rectangle(101.01,1.01,.01,.01).geometry.coordinates]);
  assert.ok(Math.abs(r.pbph.uniqueHa-expected)<.00001);assert.equal(r.pbph.rows[0].hotspots,0);assert.ok(r.pbph.rows[0].percent<100);
});
test('hotspots exclude holes and same-day detections count one day',()=>{
  const p=rectangle(101,1,.02,.02,{PBPH_ID:'P1',NAMOBJ:'Test'});p.geometry.coordinates.push(rectangle(101.005,1.005,.005,.005).geometry.coordinates[0]);
  const r=run([],{pbph:fc([p]),report:{hotspots:[{longitude:101.007,latitude:1.007,date:'2026-08-01'},{longitude:101.002,latitude:1.002,date:'2026-08-02'},{longitude:101.003,latitude:1.003,date:'2026-08-02'}]}});
  assert.equal(r.pbph.rows[0].hotspots,2);assert.equal(r.pbph.rows[0].days,1);assert.equal(r.pbph.rows[0].burnedHa,0);
});
test('unavailable hotspot archive is not represented as zero',()=>{assert.equal(run([event],{report:{unavailable:true}}).pbph.rows[0].hotspots,null);});
test('verified PHI alias applies only to the matching parent group',()=>{
  const boundary=group=>fc([rectangle(101,1,.02,.02,{COMPANY_ID:'C1',PO_COMPANY:'PT PHI',RSPO_GROUP:group})]);
  const verified=run([event],{rspo:boundary('Permata Group Pte. Ltd.')}).rspo.rows[0];
  assert.equal(verified.name,'PT Permata Hijau Indonesia (PT PHI)');assert.match(verified.nameSource,/linkedin.com\/posts\/permatagroup/);
  assert.equal(run([event],{rspo:boundary('Another Group')}).rspo.rows[0].name,'PT PHI');
});
test('missing boundaries and invalid geometry fail visibly',()=>{
  assert.throws(()=>run([event],{pbph:fc([])}),/belum tersedia/);
  assert.throws(()=>run([{geometry:{type:'Point',coordinates:[101,1]}}]),/poligon/);
});
test('multiple pieces for same identity merge and multipart works',()=>{
  const p=rectangle(101,1,.02,.02,{PBPH_ID:'P1',NAMOBJ:'Test'});p.geometry={type:'MultiPolygon',coordinates:[p.geometry.coordinates]};
  const r=run([event],{pbph:fc([p,p])});assert.equal(r.pbph.boundaryCount,1);assert.equal(r.pbph.rows.length,1);assert.equal(r.pbph.rows[0].boundaryHa,area(p.geometry.coordinates));
});
test('public session never creates an internal panel or worker',async()=>{
  const context={window:{YG_STAFF_DATA:{session:()=>null}},document:new Proxy({},{get(){throw Error('Public DOM accessed');}}),Worker(){throw Error('Public worker started');}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/fire-monthly-internal.js'),'utf8'),context);
  await context.window.renderMonthlyInternal();
});
test('worker loads local dependencies and returns results without network',()=>{
  let result;const context={};context.self=context;context.postMessage=v=>result=v;
  vm.createContext(context);context.importScripts=(...urls)=>urls.forEach(url=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',url.split('?')[0]),'utf8'),context));
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/fire-internal-worker.js'),'utf8'),context);
  context.onmessage({data:{burned:fc([event]),pbph,rspo,report:{hotspots:[]}}});
  assert.equal(result.ok,true);assert.ok(result.result.combinedHa>0);
});
