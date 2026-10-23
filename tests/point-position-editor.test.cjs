const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync(require('node:path').join(__dirname,'../js/polygon-editor.js'),'utf8');
function section(start,end) { return code.slice(code.indexOf(start),code.indexOf(end)); }
function harness() {
  const nodes = {};
  const document = {getElementById:id => nodes[id] ||= {value:'',textContent:'',disabled:false,hidden:false}};
  class Point {
    constructor() { this.dragEnabled = true; this.dragging={disable:()=>this.dragEnabled=false}; this.pm={disable:()=>{},disableLayerDrag:()=>this.dragEnabled=false}; }
    toGeoJSON() { return {geometry:{type:'Point',coordinates:[999,999]}}; }
    setLatLng(c) {this.coordinates=c;}
  }
  const context={document,L:{Marker:Point,CircleMarker:Point},console};
  vm.createContext(context);
  vm.runInContext(`let selectedFeature={geometry:{type:'Point',coordinates:[102.094672,1.52159]}};
    let editing=false,saveInProgress=false,creatingNew=false;
    const layer=new L.Marker();
    const editableLeafletLayer=()=>layer;
    const toggleButtons=()=>{};
    const setStatus=(s)=>document.getElementById('status').textContent=s;
    const updateMetrics=()=>{};
    ${section('  function startEdit()', '  function resetGeometry()')}
    this.app={startEdit,finishEdit,updateFromMap,syncPositionFields,applyPositionFields,
      feature:()=>selectedFeature,layer,mode:()=>editing,
      saving:v=>saveInProgress=v};`,context);
  return {app:context.app,nodes,document};
}
test('view mode locks coordinates and labels the database source',()=>{
  const {app,nodes}=harness();app.syncPositionFields();
  assert.equal(nodes['position-lat'].disabled,true);
  assert.equal(nodes['position-lng'].value,102.094672);
  assert.match(nodes['position-mode'].textContent,/Mode lihat/);
  assert.equal(nodes['save-object'].textContent,'Simpan Posisi');
});
test('touch/pan/late drag events never mutate a point in either mode',()=>{
  const {app}=harness();const before=JSON.stringify(app.feature());
  app.updateFromMap({target:app.layer});assert.equal(JSON.stringify(app.feature()),before);
  app.startEdit();assert.equal(app.layer.dragEnabled,false);
  for(const type of ['touchmove','move','pm:edit','pm:update','pm:dragend']) app.updateFromMap({type,target:app.layer});
  assert.equal(JSON.stringify(app.feature()),before);
});
test('explicit decimal coordinates update a local draft in longitude-latitude order',()=>{
  const {app,nodes}=harness();app.startEdit();
  nodes['position-lat'].value='1.522';nodes['position-lng'].value='102.095';
  app.finishEdit();
  assert.equal(JSON.stringify(app.feature().geometry.coordinates),'[102.095,1.522]');
  assert.equal(app.mode(),false);assert.equal(nodes['position-lat'].disabled,true);
});
test('invalid and blank coordinates keep original geometry and edit mode',()=>{
  for(const value of ['', '91','NaN']) {
    const {app,nodes}=harness();app.startEdit();const before=JSON.stringify(app.feature());
    nodes['position-lat'].value=value;nodes['position-lng'].value='102';
    assert.equal(app.finishEdit(),false);assert.equal(JSON.stringify(app.feature()),before);
    assert.equal(app.mode(),true);
  }
});
test('opaque POST and unchanged revisions cannot trigger a success confirmation', async()=>{
  const context={api:'https://example.test',console, successes:0, errors:0, setTimeout:()=>0,
    props:f=>f.properties, stableStringify:JSON.stringify,featureComparable:f=>f.geometry,
    callbackLoad:async()=>({features:[{properties:{Object_ID:'P',Revision:2},geometry:{type:'Point',coordinates:[102,1]}}]}),
    finishSaveSuccess:()=>context.successes++, finishSaveError:()=>context.errors++,
    saveOverlayText:{textContent:''}};
  vm.createContext(context);
  vm.runInContext(`let saveInProgress=true,creatingNew=false,savePollTimer;
    let pendingSave={objectId:'P',beforeRevision:2,fingerprint:JSON.stringify({type:'Point',coordinates:[102,1]})};
    ${section('  async function verifySavedObject(', '  async function sendSaveRequest(')}
    this.verify=verifySavedObject;`,context);
  await context.verify(0);assert.equal(context.successes,0);
  context.callbackLoad=async()=>({features:[{properties:{Object_ID:'P',Revision:3},geometry:{type:'Point',coordinates:[103,1]}}]});
  await context.verify(0);assert.equal(context.successes,0);
  context.callbackLoad=async()=>({features:[{properties:{Object_ID:'P',Revision:3},geometry:{type:'Point',coordinates:[102,1]}}]});
  await context.verify(0);assert.equal(context.successes,1);
});
test('database read-back failures terminate without reporting success',async()=>{
  const c={api:'https://example.test',console:{warn:()=>{}},success:false,error:'',props:f=>f.properties,
    callbackLoad:async()=>{throw Error('offline')},finishSaveSuccess:()=>c.success=true,
    finishSaveError:s=>c.error=s,saveOverlayText:{},setTimeout:()=>0};vm.createContext(c);
  vm.runInContext(`let saveInProgress=true,pendingSave={objectId:'P'},savePollTimer;
    ${section('  async function verifySavedObject(', '  async function sendSaveRequest(')}
    this.verify=verifySavedObject;`,c);
  await c.verify(15);assert.equal(c.success,false);assert.match(c.error,/belum terlihat/);
});
