const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../js/drone-mission-core.js'),plans=require('../js/drone-mission-store.js');
function harness(){
 const values={altitude:'35',speed:'4',frontOverlap:'80',sideOverlap:'80',gimbal:'-90',gridHeading:'25',batteryMinutes:'30',batteryReserve:'30',boundaryClearance:'3',droneModel:'DJI Air 3S',areaName:'Dayun A',surveyType:'Sensus tanaman'},elements=new Map(),buttons=[{disabled:true}],timers=new Map(),saved=new Map(),blobs=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{value:values[id]||'',checked:false,innerHTML:'',textContent:'',addEventListener(type,fn){this[type]=fn},appendChild(){}});return elements.get(id)};
 const storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
 const geometry={type:'Polygon',coordinates:[[[101,.7],[101.002,.7],[101.002,.702],[101,.702],[101,.7]]]};
 const drawn={features:[{type:'Feature',properties:{},geometry}],toGeoJSON(){return{type:'FeatureCollection',features:this.features}},clearLayers(){this.features=[]},addLayer(l){this.features.push(l.feature)}};
 const layer=()=>({bindTooltip(){return this},addTo(){return this}});
 class Group{toGeoJSON(){return{type:'FeatureCollection',features:[]}}addTo(){return this}clearLayers(){}addLayer(){}}
 const map={fits:0,fitBounds(){this.fits++},on(){}},grid={clears:0,clearLayers(){this.clears++},addLayer(){}};
 const turf={buffer:f=>f,area:()=>40000};
 const L={FeatureGroup:Group,geoJSON:f=>({getBounds:()=>({pad(){return this}}),eachLayer(fn){fn({feature:f})}}),polyline:layer,circleMarker:layer,marker:layer,divIcon:()=>({}),Draw:{Event:{DRAWSTOP:'stop',CREATED:'created',EDITED:'edited',DELETED:'deleted'}}};
 let timerId=0;
 const ctx={window:{YGDroneMission:core,YGDronePlans:plans,turf,DayunDataSource:{fetchJSON:()=>new Promise(()=>{})}},document:{getElementById:element,querySelectorAll:()=>buttons,createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}},localStorage:storage,turf,L,Blob,URL:{createObjectURL(b){blobs.push(b);return 'blob:test'},revokeObjectURL(){}},setTimeout(fn){timers.set(++timerId,fn);return timerId},clearTimeout(id){timers.delete(id)},alert(){throw Error('Automatic updates must not alert')}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/drone-mission-ui.js','utf8'),ctx);ctx.window.YGDronePlanner.attach(map,drawn,grid,()=>{});
 return{element,buttons,blobs,map,grid,drawn,storage,planner:ctx.window.YGDronePlanner,edit(id,value){element(id).value=value;element(id).input()},flush(){const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn())},read:()=>plans.read(storage),timers};
}
test('height change updates same mission, photos, GSD and CSV without clearing area or moving map',async()=>{
 const h=harness();h.planner.generate();const before=h.read()[0],fits=h.map.fits,clears=h.grid.clears;
 h.edit('altitude','70');assert.equal(h.grid.clears,clears);assert.ok(h.buttons.every(b=>b.disabled));h.flush();
 const after=h.read()[0];assert.equal(h.read().length,1);assert.equal(after.id,before.id);assert.equal(after.createdAt,before.createdAt);assert.equal(after.options.altitude,70);assert.equal(after.options.heading,25);assert.deepEqual(after.targetGeometry,before.targetGeometry);assert.equal(after.area,'Dayun A');assert.ok(after.photos.length<before.photos.length);assert.ok(after.gsdCm>before.gsdCm);assert.equal(h.map.fits,fits);assert.ok(h.buttons.every(b=>!b.disabled));
 h.buttons[0].dataset={droneExport:'csv'};h.buttons[0].onclick();const csv=await h.blobs[0].text();assert.ok(csv.split('\r\n').slice(1).every(row=>row.split(',')[5]==='70'));
});
test('rapid height edits collapse to latest value; invalid intermediate value recovers same mission',()=>{
 const h=harness();h.planner.generate();const id=h.read()[0].id;h.edit('altitude','50');h.edit('altitude','60');h.edit('altitude','80');assert.equal(h.timers.size,1);h.flush();assert.equal(h.read()[0].options.altitude,80);
 h.edit('altitude','');h.flush();assert.ok(h.buttons.every(b=>b.disabled));assert.equal(h.read()[0].options.altitude,80);assert.match(h.element('missionStatus').textContent,/belum valid/);
 h.edit('altitude','65');h.flush();assert.equal(h.read()[0].id,id);assert.equal(h.read().length,1);assert.equal(h.read()[0].options.altitude,65);assert.ok(h.buttons.every(b=>!b.disabled));
});
test('rotation and overlap update automatically while empty areas do not generate missions',()=>{
 const h=harness();h.planner.generate();const id=h.read()[0].id;h.element('gridHeading').value='90';h.element('gridHeading').oninput();h.flush();assert.equal(h.read()[0].options.heading,90);assert.equal(h.read()[0].id,id);assert.ok(h.buttons.every(b=>!b.disabled));
 h.edit('sideOverlap','85');h.flush();assert.equal(h.read()[0].options.sideOverlap,85);assert.equal(h.read()[0].id,id);
 h.drawn.clearLayers();h.planner.invalidate();h.edit('altitude','75');assert.equal(h.timers.size,0);assert.ok(h.buttons.every(b=>b.disabled));
});
