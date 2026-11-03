const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash, webcrypto } = require('node:crypto');
const A = require('../js/restoration-scoring.js');
const C = require('../js/restoration-catalog.js');
// Isolated DOM/Leaflet doubles and numeric fixtures exercise control wiring;
// no real login, private datasets, or application result data are embedded.
function feature(code='KHG.test-A',name='Test name') {
  return {type:'Feature',properties:{kode_khg:code,nama_khg:name},geometry:{type:'Polygon',coordinates:[[[100,0],[101,0],[101,1],[100,0]]]}};
}
const fc = features => ({type:'FeatureCollection',features});
async function app({feg=fc([feature(),feature()]),privateFetch,catalog={access:'staff_only',datasets:[]},display}={}) {
  const nodes=new Map(),drawn=[],removed=[],privateCalls=[];
  class Element {
    constructor(tag='div'){this.tag=tag;this.children=[];this.listeners={};this.disabled=true;this.hidden=true;this.checked=false;this.value='';this.textContent='';}
    set id(value){this._id=value;nodes.set(value,this);}
    get id(){return this._id;}
    append(...items){items.forEach(x=>this.appendChild(x));}
    appendChild(item){this.children.push(item);if(this.tag==='select'&&this.children.length===1)this.value=item.value;if(item.tag==='script')item.onload();return item;}
    replaceChildren(...items){this.children=[];this.value='';this.append(...items);}
    addEventListener(name,handler){this.listeners[name]=handler;}
  }
  const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element(['khg','regency','khg-dataset'].includes(id)?'select':'div'));return nodes.get(id);},createElement:tag=>new Element(tag),head:new Element()};
  const bounds={isValid:()=>true,getWest:()=>100,getSouth:()=>0,getEast:()=>101,getNorth:()=>1};
  const map={setView(){return this;},fitBounds(){},removeLayer(layer){removed.push(layer);},invalidateSize(){}};
  const L={map:()=>map,tileLayer:()=>({addTo(){}}),control:{scale:()=>({addTo(){}})},geoJSON:(data,options={})=>{
    const layer={data,options,popups:[],addTo(){return this;},getBounds:()=>bounds};drawn.push(layer);
    if(options.onEachFeature)(data.type==='FeatureCollection'?data.features:[data]).forEach(f=>options.onEachFeature(f,{bindPopup(fn){layer.popups.push(fn);}}));
    return layer;
  }};
  const window={YG_RESTORATION:A,YG_RESTORATION_CATALOG:C,YG_AUTH:{readStoredSession:()=>({token:'test-only'})},addEventListener(){},YG_STAFF_DATA:{privateFetch:async input=>{privateCalls.push(input);if(privateFetch)return privateFetch(input);return {ok:true,json:async()=>feg};}}};window.top=window;window.self=window;
  const context={window,document,L,location:{hostname:'webgisyg.id',protocol:'https:'},AbortSignal,setTimeout,clearTimeout,crypto:webcrypto,
    fetch:async url=>{
      if(url.endsWith('/catalog'))return {ok:true,json:async()=>catalog};
      if(url.endsWith('/display'))return new Response(JSON.stringify(display));
      if(url==='data/restoration-priority-sources.json')return {ok:true,json:async()=>({sources:[]})};
      if(url.includes('batas_provinsi'))return {ok:true,json:async()=>fc([feature()])};
      if(url.includes('Gambut_BBSDLP')){const peat=feature();peat.properties={KABKOT:'Siak',Luas_Ha:10};return {ok:true,json:async()=>fc([peat])};}
      throw Error('Unexpected request: '+url);
    }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/restoration-priority.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(nodes.get('workspace').hidden,false);
  const click=id=>nodes.get(id).listeners.click();
  const change=id=>nodes.get(id).listeners.change();
  return {nodes,drawn,removed,privateCalls,click,change};
}
test('staff FEG button populates source KHG groups; focus keeps original parts and summary unchanged',async()=>{
  const feg=fc([feature(),feature()]),ui=await app({feg});
  assert.equal(ui.privateCalls.length,0);
  const before=['area','polygon-count','priority-count'].map(id=>ui.nodes.get(id).textContent);
  await ui.click('use-feg-khg');
  assert.deepEqual(ui.privateCalls,['data/FEG_SK130_RIAU.geojson']);
  assert.equal(ui.nodes.get('khg').disabled,false);assert.equal(ui.nodes.get('khg').children.length,2);
  assert.match(ui.nodes.get('khg').children[1].textContent,/2 bagian FEG/);
  assert.match(ui.nodes.get('khg-focus-source').textContent,/Bukan batas KHG mandiri/);
  ui.nodes.get('khg').value='0';await ui.change('khg');
  const selected=ui.drawn.at(-1);
  assert.equal(selected.data.features.length,2);assert.equal(selected.data.features[0],feg.features[0]);
  assert.match(selected.popups[0]().children[0].textContent,/bukan batas KHG mandiri/);
  assert.deepEqual(['area','polygon-count','priority-count'].map(id=>ui.nodes.get(id).textContent),before);
  ui.nodes.get('layer-feg').checked=false;await ui.change('layer-feg');
  assert.equal(ui.nodes.get('khg').value,'');assert.ok(ui.removed.includes(selected));
});
test('simultaneous FEG checkbox and KHG button share one protected request',async()=>{
  let release;const pending=new Promise(resolve=>release=resolve);
  const ui=await app({privateFetch:()=>pending});
  ui.nodes.get('layer-feg').checked=true;
  const layer=ui.change('layer-feg'),groups=ui.click('use-feg-khg');
  assert.equal(ui.privateCalls.length,1);
  release({ok:true,json:async()=>fc([feature()])});await Promise.all([layer,groups]);
  assert.equal(ui.nodes.get('khg').children.length,2);assert.equal(ui.nodes.get('use-feg-khg').disabled,false);
});
test('catalog and FEG focus sources switch explicitly; toggling FEG cannot replace an active catalog selection',async()=>{
  const display=fc([feature()]);display.features[0].properties={NAMA_KHG:'Catalog source name'};
  const bytes=Buffer.from(JSON.stringify(display)),uuid='12345678-1234-4123-8123-123456789abc';
  const catalog={access:'staff_only',datasets:[{datasetUuid:uuid,title:'KHG test-only',artifacts:{display:{available:true,status:'ready',bytes:bytes.length,featureCount:1,sha256:createHash('sha256').update(bytes).digest('hex')}}}]};
  const ui=await app({catalog,display});await ui.click('use-feg-khg');await ui.click('load-khg');
  assert.equal(ui.nodes.get('khg').children[1].textContent,'Catalog source name');
  assert.match(ui.nodes.get('khg-focus-source').textContent,/katalog staf/);
  ui.nodes.get('layer-feg').checked=false;await ui.change('layer-feg');ui.nodes.get('layer-feg').checked=true;await ui.change('layer-feg');
  assert.equal(ui.nodes.get('khg').children[1].textContent,'Catalog source name');
  await ui.click('use-feg-khg');assert.match(ui.nodes.get('khg').children[1].textContent,/bagian FEG/);
});
test('failed loading can retry; FEG without a source code never invents a KHG choice',async()=>{
  let attempt=0;const ui=await app({privateFetch:async()=>{if(!attempt++)throw Error('network unavailable');return {ok:true,json:async()=>fc([feature(null)])};}});
  await ui.click('use-feg-khg');assert.match(ui.nodes.get('feg-khg-status').textContent,/Data belum tersedia/);
  assert.equal(ui.nodes.get('use-feg-khg').disabled,false);assert.equal(ui.nodes.get('khg').disabled,true);
  await ui.click('use-feg-khg');assert.equal(ui.privateCalls.length,2);assert.equal(ui.nodes.get('khg').disabled,true);
  assert.match(ui.nodes.get('feg-khg-status').textContent,/0 kode KHG/);
});
