const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync('js/map-layout.js','utf8');
function setup({responses={},source='intervention',key='sepahat|bandar laksamana|bengkalis'}={}){
 const elements=new Map(),requests=[];let initialized=false;
 const el=id=>{if(!elements.has(id))elements.set(id,{disabled:false,hidden:false,textContent:''});return elements.get(id)};
 const context={key,source,ready:false,loading:false,dataNotice:'',programAvailable:true,map:null,localInset:null,riauInset:null,active:{},SNAPSHOT:'https://webgis-api.yayasangambut.org/snapshots/current/objects.json',AbortController,setTimeout,clearTimeout,console:{error(){}},el,status:t=>{el('layout-status').textContent=t},L:{geoJSON:()=>({getBounds:()=>({isValid:()=>true})})},initMap:()=>{initialized=true;context.setReady(true)},fetch:async(url,options)=>{requests.push({url,options});const value=responses[url];if(value instanceof Error)throw value;return{ok:value!==undefined,status:value===undefined?503:200,json:async()=>value}}};
 const dataFunctions=code.slice(code.indexOf('function norm('),code.indexOf('function nameOf('));
 const loaderFunctions=code.slice(code.indexOf('async function json('),code.indexOf('function tile('));
 const init=code.slice(code.indexOf('async function init(){'),code.indexOf('el("retry-layout").addEventListener'));
 vm.createContext(context);vm.runInContext(dataFunctions+loaderFunctions+init,context);
 return {context,el,requests,initialized:()=>initialized};
}
const village={type:'Feature',properties:{Layer_ID:'desa_intervensi',WADMKD:'Sepahat',WADMKC:'Bandar Laksamana',WADMKK:'Bengkalis'},geometry:{type:'Polygon',coordinates:[[[101,1],[102,1],[102,2],[101,1]]]}};
const fc={type:'FeatureCollection',features:[village]};
const primary='https://webgis-api.yayasangambut.org/snapshots/current/objects.json';
test('Sepahat loads from production and only enables export after valid geometry',async()=>{
 const h=setup({responses:{[primary]:fc}});await h.context.init();
 assert.equal(h.initialized(),true);assert.equal(h.requests.length,1);assert.ok(h.requests[0].options.signal);assert.equal(h.el('export-png').disabled,false);
});
test('production failure uses the site snapshot rather than staging',async()=>{
 const h=setup({responses:{[primary]:new Error('network'),'data/master-database-snapshot.json':fc}});await h.context.init();
 assert.equal(h.initialized(),true);assert.match(h.context.dataNotice,/cadangan/);assert.equal(h.requests.length,2);
 assert.ok(h.requests.every(r=>!r.url.includes('staging')));
});
test('missing snapshots still allow the selected boundary and disable unavailable program data',async()=>{
 const h=setup({responses:{'data/desa_intervensi.geojson':fc}});await h.context.init();
 assert.equal(h.initialized(),true);assert.equal(h.context.programAvailable,false);assert.match(h.context.dataNotice,/kegiatan belum tersedia/);
});
test('missing village blocks exports and allows a successful retry',async()=>{
 const responses={[primary]:{features:[]},'data/desa_intervensi.geojson':{features:[]}};
 const h=setup({responses});await h.context.init();
 assert.equal(h.initialized(),false);assert.equal(h.el('export-pdf').disabled,true);assert.equal(h.el('retry-layout').hidden,false);assert.equal(h.context.loading,false);
 responses[primary]=fc;await h.context.init();assert.equal(h.initialized(),true);assert.equal(h.el('retry-layout').hidden,true);
});
test('same village name in another district is not substituted',async()=>{
 const wrong={...village,properties:{...village.properties,WADMKC:'Other district'}};
 const h=setup({responses:{[primary]:{features:[wrong]},'data/desa_intervensi.geojson':{features:[wrong]}}});await h.context.init();assert.equal(h.initialized(),false);
});
