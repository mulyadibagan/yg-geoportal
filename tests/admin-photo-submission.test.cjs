const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../apps-script/webgis-backend/Kode.js'), 'utf8');

function harness(role = 'admin', staticTarget = false) {
  const rows = [], results = new Map();
  let emails = 0, uploads = 0, dispatches = 0, locked = false;
  const target = {type:'Feature', geometry:{type:'Point',coordinates:[102,1]},
    properties:{Object_ID:'SEKAT-PEDEKIK-2026-001',Layer_ID:'sekat_kanal',Nama_Objek:'Pedekik'}};
  const sheet = {
    appendRow(row) { assert.equal(locked, true); rows.push(row); },
    getLastRow() { return rows.length + 1; },
    getRange(row, col, count = 1, width = 1) {
      const range = {
        setVerticalAlignment(){return range;},setWrap(){return range;},
        setBackground(){return range;},setNumberFormat(){return range;},
        setValues(values){values[0].forEach((v,i)=>{rows[row-2][col-1+i]=v;});return range;},
        getDisplayValues(){return [rows[row-2].slice(col-1,col-1+width)];}
      };
      return range;
    }
  };
  const ctx = vm.createContext({console, Date, JSON, Number, String, Boolean, Array, Object, encodeURIComponent});
  vm.runInContext(source, ctx);
  Object.assign(ctx, {
    clean_:v=>String(v ?? '').trim(),
    assertEditorCredential_:token=>{if(token !== 'valid-session')throw Error('Invalid session');return {role,name:'Admin server',email:'admin@example.org'};},
    getObjectsFeatureCollection_:()=>({features:staticTarget?[]:[target]}),
    UrlFetchApp:{fetch:url=>{assert.equal(url,'https://webgisyg.id/data/sekat_kanal.geojson');return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({features:[target]})};}},
    claimReportSubmission_:id=>results.get(id), storeReportSubmissionStatus_:(id,r)=>results.set(id,r),
    normalizeMangroveMonitoringTarget_:()=>{},
    parseGeometry_:v=>v ? JSON.parse(v):null,validateGeometryForIncomingReport_:()=>{},
    parseCoordinate_:v=>Number(v),getOrCreateSheet_:()=>sheet,ensureExtendedColumns_:()=>{},
    assertIncomingMonitoringIsUnique_:()=>{},findPendingNearbyReport_:()=>null,
    buildTargetFeaturePropertiesForStorage_:d=>d.targetFeatureProperties,
    buildStoredProposedChanges_:d=>JSON.stringify({targetObjectId:d.targetObjectId}),
    createReportId_:()=>`report-${rows.length+1}`, saveImages_:()=>{uploads++;return ['https://example.org/photo.jpg'];},
    saveCapacityDocuments_:()=>[],mergeDocumentUrls_:()=>[],parseDate_:()=>'',
    LockService:{getScriptLock:()=>({waitLock(){locked=true;},releaseLock(){locked=false;}})},
    SpreadsheetApp:{flush(){}},notifyAdmin_:()=>emails++,
    notifyCloudflarePublication_:()=>{dispatches++;return {ok:true};},
    reportSubmissionResponse_:r=>r
  });
  const payload = {reportType:'Tambah Foto Kegiatan',sessionToken:'valid-session',clientSubmissionId:'submission-unique-photo-001',
    name:'Forged name',email:'forged@example.org',title:'Foto',description:'Dokumentasi',
    targetObjectId:target.properties.Object_ID,targetLayerId:'sekat_kanal',
    targetFeatureProperties:JSON.stringify({Object_ID:'forged'}),geometryGeoJSON:JSON.stringify({type:'Point',coordinates:[0,0]}),images:[{}]};
  return {ctx, rows, payload, submit:()=>ctx.doPost({parameter:{payload:JSON.stringify(payload)}}),
    stats:()=>({emails,uploads,dispatches,locked})};
}

test('verified admin publishes canonical target immediately without approval email; retry is idempotent',()=>{
  const h=harness(); const result=h.submit();
  assert.equal(result.ok,true); assert.equal(result.status,'Sudah Dipublikasikan');
  assert.equal(h.rows[0][3],'Admin server'); assert.equal(h.rows[0][23],'admin@example.org');
  assert.deepEqual(JSON.parse(h.rows[0][27]).coordinates,[102,1]);
  assert.equal(JSON.parse(h.rows[0][30]).Object_ID,h.payload.targetObjectId);
  assert.equal(h.submit().reportId,result.reportId);
  assert.deepEqual(h.stats(),{emails:0,uploads:1,dispatches:1,locked:false});
});
test('official repository target is supported before it is imported to OBJECTS',()=>{
  const h=harness('admin',true); assert.equal(h.submit().status,'Sudah Dipublikasikan');
});
test('public and non-admin submissions remain pending even with forged role',()=>{
  for(const token of ['', 'valid-session']){
    const h=harness('operator'); h.payload.sessionToken=token;h.payload.role='admin';
    const r=h.submit();assert.equal(r.status,'Menunggu Verifikasi');
    assert.equal(h.stats().emails,1);assert.equal(h.stats().dispatches,0);
  }
});
test('invalid session and missing target fail before uploading or publishing',()=>{
  for(const edit of [p=>p.sessionToken='forged',p=>p.targetObjectId='missing']){
    const h=harness(); edit(h.payload);assert.equal(h.submit().ok,false);
    assert.equal(h.stats().uploads,0);assert.equal(h.rows.length,0);
  }
});
