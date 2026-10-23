const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const turf=require('../cloudflare/yg-webgis-public-data/node_modules/@turf/turf');
const T={...turf,union:(a,b)=>turf.union(turf.featureCollection([a,b])),intersect:(a,b)=>turf.intersect(turf.featureCollection([a,b]))};
const square=(x=0)=>turf.polygon([[[x,0],[x+2,0],[x+2,2],[x,2],[x,0]]]);
test('indexed polygon counts preserve union, accepted/manual totals and rejected exclusions',()=>{
 const context={window:{},globalThis:{}};vm.runInNewContext(fs.readFileSync('js/dayun-new-planting.js','utf8'),context);const count=context.window.YG_DAYUN_NEW_PLANTING.countPoints;
 const points=[['a',1,1,'accepted','manual_addition'],['b',2,1,'candidate','automated'],['c',1,1,'rejected','automated'],['d',9,9,'accepted','manual_addition']].map(([id,x,y,status,origin])=>turf.point([x,y],{id,status,origin}));let candidates=0;
 const query=b=>{assert.equal(b.getWest(),0);assert.equal(b.getEast(),3);const rows=points.filter(f=>f.geometry.coordinates[0]<=b.getEast());candidates=rows.length;return rows;};
 assert.equal(JSON.stringify(count([square(),square(1)],query,T)),JSON.stringify(count([square(),square(1)],points,T)));assert.equal(candidates,3);
});
function setup(shared={records:new Map()},measurementFeatures=[],initialSnapshot,boundaryFeatures){
 const nodes=[],listeners={},events={},requests=[],groups=[];let fail=false,allowed=true;
 const el=tag=>{const n={tag,children:[],textContent:'',_value:null,setAttribute(){},append(...xs){this.children.push(...xs)},prepend(n){this.children.unshift(n)},replaceChildren(){this.children=[];this._value=null},remove(){},get options(){return this.children},get value(){return this._value??this.children[0]?.value??''},set value(v){this._value=v}};nodes.push(n);return n;};
 const makeLayer=f=>({toGeoJSON:()=>structuredClone(f)});
 const layerGroup=()=>{const group={items:[],addTo(){return this},addLayer(l){this.items.push(l)},getLayers(){return this.items},clearLayers(){this.items=[]},getBounds(){return[]}};groups.push(group);return group;};
 const map={on(names,fn){for(const n of names.split(' '))(listeners[n]??=[]).push(fn)},off(){},removeLayer(){},fitBounds(){},orthoMeasuring:false};
 const emit=(n,e)=>{for(const fn of listeners[n]||[])fn(e)};
 let snapshot=initialSnapshot===undefined?{block:'A',ready:true,dirty:false,revision:7,sourceRun:'run-test',features:[turf.point([1,1],{id:'one',status:'accepted'})]}:initialSnapshot;
 const context={window:{turf:T,L:{featureGroup:layerGroup,geoJSON:f=>({getLayers:()=>[makeLayer(f)]}),Draw:{Polygon:function(){this.enable=()=>{};this.disable=()=>{}}},EditToolbar:{Edit:function(){this.enable=()=>{};this.save=()=>{};this.disable=()=>{}}}},confirm:()=>allowed,addEventListener:(n,f)=>events[n]=f,removeEventListener:n=>delete events[n]},document:{createElement:el},Option:function(text,value){return{textContent:text,value}},crypto:webcrypto,Blob};
 vm.runInNewContext(fs.readFileSync('js/dayun-new-planting.js','utf8'),context);
 const api=async(path,options)=>{requests.push({path,options});if(options){const b=JSON.parse(options.body),prior=shared.records.get(b.id);if(prior?.operation_id===b.operation_id)return{json:async()=>({record:prior})};if((prior?.revision||0)!==b.expected_revision)throw Object.assign(Error('conflict'),{status:409});const record={...b,revision:b.expected_revision+1};shared.records.set(b.id,record);if(fail){fail=false;throw Error('response lost')};return{json:async()=>({record})};}const id=new URL('https://x'+path).searchParams.get('id');return{json:async()=>id?{record:shared.records.get(id)}:{items:[...shared.records.values()],cursor:null}};};
 const control=context.window.YG_DAYUN_NEW_PLANTING.mount({host:el('div'),map,api,current:()=>true,getSnapshot:()=>snapshot,getMeasurements:()=>measurementFeatures,save(){},loadBoundaries:async()=>({type:'FeatureCollection',features:boundaryFeatures||[turf.polygon([[[-2,-2],[10,-2],[10,10],[-2,10],[-2,-2]]],{shortId:'GT-A-02',boundaryRevision:'test-rev'})]}),loadCensus:async()=>({objects:[{objectId:'DAYUN-GT-A-02',crops:[{crop:'NANAS',plantingCohorts:[{period:'2026-08',plantedCount:1029}]}]}]})});
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

test('ordinary map polygon previews its count and can become a saved cohort boundary',async()=>{
 const s=setup(undefined,[square()]);await flush();
 s.emit('draw:created',{layer:{options:{},toGeoJSON:()=>square()}});
 assert.match(s.output(),/Pratinjau poligon peta/);assert.match(s.output(),/Titik dalam batas: 1/);
 assert.equal(s.button('Simpan layer tanaman baru').disabled,true);
 s.button('Gunakan poligon yang sudah digambar').onclick();
 assert.doesNotMatch(s.output(),/Pratinjau/);assert.match(s.output(),/Titik dalam batas: 1/);
 assert.equal(s.button('Simpan layer tanaman baru').disabled,false);
 await s.button('Simpan layer tanaman baru').onclick();
 const record=[...s.shared.records.values()][0];assert.equal(record.collection.features[0].properties.pointCount,1);assert.equal(record.collection.features[0].properties.zoneId,'GT-A-02');s.control.dispose();
});

test('mount before any block or census is loaded does not abort map initialization',async()=>{
 const s=setup(undefined,[],null);await flush();assert.match(s.output(),/Belum ada batas/);
 s.add(square());assert.match(s.output(),/Hitungan belum tersedia/);
 s.setSnapshot({block:'A',ready:true,dirty:false,features:[turf.point([1,1],{id:'later'})]});
 assert.match(s.output(),/Titik dalam batas: 1/);s.control.dispose();
});

test('gawangan reference merges every source part without filling gaps or mutating source',()=>{
 const s=setup(),fn=s.context.window.YG_DAYUN_NEW_PLANTING.boundaryFor;
 const data=turf.featureCollection([square(),square(4)]);for(const f of data.features)f.properties={sourceGawanganId:'GT-A-02',boundaryRevision:'rev-18-oct'};
 const original=JSON.stringify(data),boundary=fn(data,'GT-A-02',T);
 assert.equal(boundary.geometry.type,'MultiPolygon');assert.equal(boundary.properties.boundaryRevision,'rev-18-oct');
 assert.ok(Math.abs(turf.area(boundary)-turf.area(data))<.001);assert.equal(turf.booleanPointInPolygon(turf.point([3,1]),boundary),false);assert.equal(JSON.stringify(data),original);s.control.dispose();
});
test('partial draw clips to source edges and excludes gap and outside points from saved count',async()=>{
 const left=square(),right=square(4);for(const f of [left,right])f.properties={shortId:'GT-A-02',boundaryRevision:'rev-18-oct'};
 const s=setup(undefined,[],undefined,[left,right]);await flush();
 s.setSnapshot({block:'A',ready:true,dirty:false,revision:9,features:[turf.point([1,1],{id:'in-left'}),turf.point([5,1],{id:'in-right',origin:'manual_addition'}),turf.point([3,1],{id:'gap'}),turf.point([8,1],{id:'out'})]});
 s.add(turf.polygon([[[-1,-1],[9,-1],[9,3],[-1,3],[-1,-1]]]));assert.match(s.output(),/2 bagian/);assert.match(s.output(),/Titik dalam batas: 2/);
 await s.button('Simpan layer tanaman baru').onclick();const fs=[...s.shared.records.values()][0].collection.features;
 assert.equal(fs.length,2);assert.equal(fs[0].properties.pointCount,2);assert.equal(fs[0].properties.boundaryMethod,'digitasi_dipotong_gawangan');assert.equal(fs[0].properties.boundaryRevision,'rev-18-oct');
 for(const f of fs)assert.equal(turf.difference(turf.featureCollection([f,T.union(left,right)])),null);s.control.dispose();
});
test('use entire gawangan saves all source parts with matching area and provenance',async()=>{
 const data=[square(),square(4)];for(const f of data)f.properties={shortId:'GT-A-02',boundaryRevision:'revised'};
 const s=setup(undefined,[],undefined,data);await flush();s.button('Pakai seluruh batas gawangan').onclick();await s.button('Simpan layer tanaman baru').onclick();
 const fs=[...s.shared.records.values()][0].collection.features;assert.equal(fs.length,2);assert.ok(Math.abs(turf.area(turf.featureCollection(fs))-turf.area(turf.featureCollection(data)))<.001);assert.equal(fs[0].properties.boundaryMethod,'seluruh_batas_gawangan_revisi');s.control.dispose();
});
test('missing reference or nonintersecting polygon cannot create an unrestricted saved boundary',async()=>{
 const s=setup(undefined,[],undefined,[]);await flush();s.add(square());await s.button('Simpan layer tanaman baru').onclick();assert.equal(s.shared.records.size,0);assert.equal(s.button('Gambar bagian tanaman baru').disabled,true);s.control.dispose();
 const t=setup(undefined,[],undefined,[{...square(4),properties:{shortId:'GT-A-02'}}]);await flush();t.add(square());await t.button('Simpan layer tanaman baru').onclick();assert.equal(t.shared.records.size,0);t.control.dispose();
});
test('actual A1 revised reference includes all three parts and remains separate from A2',()=>{
 const s=setup(),fn=s.context.window.YG_DAYUN_NEW_PLANTING.boundaryFor,data=JSON.parse(fs.readFileSync('data/dayun-map.geojson'));
 const a1=fn(data,'GT-A-01',T),parts=data.features.filter(f=>f.properties.sourceGawanganId==='GT-A-01');assert.equal(parts.length,3);assert.equal(a1.geometry.coordinates.length,3);for(const rings of a1.geometry.coordinates)assert.equal(turf.kinks(turf.polygon(rings)).features.length,0);assert.ok(turf.area(a1)>2000&&turf.area(a1)<2200);assert.notDeepEqual(a1.geometry,fn(data,'GT-A-02',T).geometry);s.control.dispose();
});
