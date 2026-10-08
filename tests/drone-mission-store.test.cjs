const test = require('node:test');
const assert = require('node:assert/strict');
const plans = require('../js/drone-mission-store.js');
const geometry = {type:'Polygon',coordinates:[[[101,0],[101.01,0],[101.01,.01],[101,0]]]};
const mission = id => ({id,area:'Dayun A',drone:'DJI Air 3S',altitude:35,options:{takeoff:[101.005,.005]},geometry,targetGeometry:geometry,obstacles:{type:'FeatureCollection',features:[]},lines:[{}],photos:[{coordinates:[101.005,.005]}],footprints:[{largePreview:true}]});
function storage(reject = () => false) {
  const values = new Map();
  return {values,getItem:key=>values.get(key)||null,setItem(key,value){if(reject(key,value))throw Error('QuotaExceededError');values.set(key,value)}};
}
test('retains three restorable plans with target, takeoff and obstacles; legacy archive stores only summary',()=>{
  const s=storage();
  for(let i=0;i<4;i++) assert.equal(plans.save(s,mission('M'+i)).saved,true);
  const read=plans.read(s);
  assert.deepEqual(read.map(m=>m.id),['M3','M2','M1']);
  assert.deepEqual(read[0].targetGeometry,geometry);
  assert.deepEqual(read[0].options.takeoff,[101.005,.005]);
  assert.ok(read[0].obstacles);
  assert.equal(read[0].footprints,undefined);
  const last=JSON.parse(s.getItem('ygDroneLastMission'));
  assert.equal(last.lines,1);assert.equal(last.photos,undefined);assert.equal(last.geometry,undefined);
});
test('limited quota saves the newest plan; exhausted quota preserves existing plans',()=>{
  const s=storage((key,value)=>key==='ygDroneMissions' && JSON.parse(value).length>1);
  plans.save(s,mission('old'));
  assert.equal(plans.save(s,mission('new')).saved,true);
  assert.deepEqual(plans.read(s).map(m=>m.id),['new']);
  const full=storage(()=>true);full.values.set('ygDroneMissions',JSON.stringify([mission('existing')]));
  const result=plans.save(full,mission('unsaved'));
  assert.equal(result.saved,false);assert.match(result.warning,/Ekspor/);
  assert.equal(plans.read(full)[0].id,'existing');
});
test('invalid stored values do not break planner initialization',()=>{
  for(const value of ['invalid','{}','null','[null,{},1]']){
    const s=storage();s.values.set('ygDroneMissions',value);assert.deepEqual(plans.read(s),[]);
  }
});
