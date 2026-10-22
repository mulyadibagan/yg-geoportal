const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const turf=require('../cloudflare/yg-webgis-public-data/node_modules/@turf/turf');
const T={...turf,union:(a,b)=>turf.union(turf.featureCollection([a,b]))};
const square=(x=0)=>turf.polygon([[[x,0],[x+2,0],[x+2,2],[x,2],[x,0]]]);
function setup(shared={records:new Map()}){
 const nodes=[],listeners={},events={},requests=[],groups=[];let fail=false,allowed=true;
 const el=tag=>{const n={tag,children:[],textContent:'',_value:null,setAttribute(){},append(...xs){this.children.push(...xs)},prepend(n){this.children.unshift(n)},replaceChildren(){this.children=[];this._value=null},remove(){},get options(){return this.children},get value(){return this._value??this.children[0]?.value??''},set value(v){this._value=v}};nodes.push(n);return n;};
 const makeLayer=f=>({toGeoJSON:()=>structuredClone(f)});
 const layerGroup=()=>{const group={items:[],addTo(){return this},addLayer(l){this.items.push(l)},getLayers(){return this.items},clearLayers(){this.items=[]},getBounds(){return[]}};groups.push(group);return group;};
 const map={on(names,fn){for(const n of names.split(' '))(listeners[n]??=[]).push(fn)},off(){},removeLayer(){},fitBounds(){},orthoMeasuring:false};
 const emit=(n,e)=>{for(const fn of listeners[n]||[])fn(e)};
 let snapshot={block:'A',ready:true,dirty:false,revision:7,sourceRun:'run-test',features:[turf.point([1,1],{id:'one',status:'accepted'})]};
 const context={window:{turf:T,L:{featureGroup:layerGroup,geoJSON:f=>({getLayers:()=>[makeLayer(f)]}),Draw:{Polygon:function(){this.enable=()=>{};this.disable=()=>{}}},EditToolbar:{Edit:function(){this.enable=()=>{};this.save=()=>{};this.disable=()=>{}}}},confirm:()=>allowed,addEventListener:(n,f)=>events[n]=f,removeEventListener:n=>delete events[n]},document:{createElement:el},Option:function(text,value){return{textContent:text,value}},crypto:webcrypto,Blob};
 vm.runInNewContext(fs.readFileSync('js/dayun-new-planting.js','utf8'),context);
 const api=async(path,options)=>{requests.push({path,options});if(options){const b=JSON.parse(options.body),prior=shared.records.get(b.id);if(prior?.operation_id===b.operation_id)return{json:async()=>({record:prior})};if((prior?.revision||0)!==b.expected_revision)throw Object.assign(Error('conflict'),{status:409});const record={...b,revision:b.expected_revision+1};shared.records.set(b.id,record);if(fail){fail=false;throw Error('response lost')};return{json:async()=>({record})};}const id=new URL('https://x'+path).searchParams.get('id');return{json:async()=>id?{record:shared.records.get(id)}:{items:[...shared.records.values()],cursor:null}};};
 const control=context.window.YG_DAYUN_NEW_PLANTING.mount({host:el('div'),map,api,current:()=>true,getSnapshot:()=>snapshot,save(){},loadCensus:async()=>({objects:[{objectId:'DAYUN-GT-A-02',crops:[{crop:'NANAS',plantingCohorts:[{period:'2026-08',plantedCount:1029}]}]}]})});
 return{context,control,shared,requests,events,nodes,button:text=>nodes.find(n=>n.textContent===text),select:nodes.filter(n=>n.tag==='select')[1],emit,add:f=>emit('draw:created',{layer:{options:{dayunNewPlanting:true},toGeoJSON:()=>structuredClone(f)}}),fail:()=>fail=true,setSnapshot:s=>{snapshot=s;emit('dayun:plantschanged')},output:()=>nodes.filter(n=>n.tag==='p')[0].textContent,allow:v=>allowed=v};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('overlapping polygons count unique non-rejected points, include edges and exclude holes',()=>{
 const s=setup(),fn=s.context.window.YG_DAYUN_NEW_PLANTING.countPoints;
 const polys=[square(),square(1)],points=[turf.point([1,1],{id:'a',status:'accepted'}),turf.point([1,1],{id:'a',status:'accepted'}),turf.point([3,2],{id:'b',origin:'manual_addition'}),turf.point([1,1],{id:'r',status:'rejected'}),turf.point([8,8],{id:'out'})];
 assert.deepEqual(JSON.parse(JSON.stringify(fn(polys,points,T))),{total:2,accepted:1,unreviewed:1,manual:1});
 const hole=turf.polygon([square().geometry.coordinates[0],[[.5,.5],[.5,1.5],[1.5,1.5],[1.5,.5],[.5,.5]]]);assert.equal(fn([hole],points,T).total,0);s.control.dispose();
});
test('saved cohort boundary reopens on another device, preserving geometry and metadata without census writes',async()=>{
 const a=setup();await flush();a.add(square());a.add(square(1));await a.button('Simpan layer tanaman baru').onclick();assert.equal(a.shared.records.size,1);const record=[...a.shared.records.values()][0];assert.equal(record.collection.features.length,2);const p=record.collection.features[0].properties;assert.equal(p.plantingPeriod,'2026-08');assert.equal(p.zoneId,'GT-A-02');assert.equal(p.pointCount,1);assert.equal(p.reviewRevision,7);
 const b=setup(a.shared);await flush();await b.button('Muat daftar batas').onclick();await b.button('Buka batas tersimpan').onclick();assert.match(b.output(),/2 bagian/);assert.match(b.output(),/Titik dalam batas: 1/);assert.ok([...a.requests,...b.requests].every(r=>r.path.startsWith('/api/staff/drone/analysis/areas')));a.control.dispose();b.control.dispose();
});
test('lost response retry is idempotent and retains subsequent local polygons as unsaved',async()=>{
 const s=setup();await flush();s.add(square());s.fail();await s.button('Simpan layer tanaman baru').onclick();const first=s.requests.find(r=>r.options).options.body;s.add(square(1));await s.button('Simpan layer tanaman baru').onclick();const writes=s.requests.filter(r=>r.options);assert.equal(writes[1].options.body,first);let prevented=false;s.events.beforeunload({preventDefault(){prevented=true}});assert.equal(prevented,true);await s.button('Simpan layer tanaman baru').onclick();assert.equal(s.shared.records.size,1);assert.equal([...s.shared.records.values()][0].collection.features.length,2);s.control.dispose();
});
test('wrong block and unsynced points show unavailable, never a false zero',async()=>{const s=setup();await flush();s.add(square());s.setSnapshot({block:'B',ready:true,features:[]});assert.match(s.output(),/Hitungan belum tersedia/);s.setSnapshot({block:'A',ready:true,dirty:true,features:[]});assert.match(s.output(),/Hitungan belum tersedia/);await s.button('Simpan layer tanaman baru').onclick();assert.equal([...s.shared.records.values()][0].collection.features[0].properties.pointCount,null);s.control.dispose();});
test('census cohort selection matches all 29,299 August plants in the real source',()=>{const s=setup(),rows=s.context.window.YG_DAYUN_NEW_PLANTING.censusRows(JSON.parse(fs.readFileSync('data/dayun-gawangan-details.json')));assert.equal(rows.length,16);assert.equal(rows.reduce((a,r)=>a+r.count,0),29299);s.control.dispose();});
