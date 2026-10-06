const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/riau-reference-workspace.js'),'utf8');
const fragment=source.slice(source.indexOf('  function addMeritech(panel)'),source.indexOf('  function createPanel()'));
function harness(){
  const nodes=new Map(), layers=new Set(), events={};
  function node(key){if(!nodes.has(key))nodes.set(key,{checked:false,value:'.85',textContent:'',handlers:{},addEventListener(k,fn){this.handlers[k]=fn;},dispatchEvent(e){return this.handlers[e.type]?.(e);}});return nodes.get(key);}
  const box={innerHTML:'',querySelector:node,remove(){}};
  const map={zoom:9,getZoom(){return this.zoom;},hasLayer(l){return layers.has(l);},setView(target,z){this.view=[target,z];this.zoom=z;events.zoomend?.();},fitBounds(){},removeLayer(l){layers.delete(l);},getPane(){return true;},on(k,f){events[k]=f;},off(k,f){if(events[k]===f)delete events[k];}};
  let fetches=0,images=0,markerClick,tileClick,style;
  const data={type:'FeatureCollection',metadata:{kind:'verified-xyz-tiles',updatedAt:'2026-10-06',counts:{imagery:1},locations:[{target:[1.48,102.12],tileCount:1}]},features:[{properties:{id:'17/102716/64997',state:'imagery',target:[1.48,102.12]}}]};
  const group=kind=>({kind,addTo(){layers.add(this);return this;},getBounds(){return [];}});
  const context={document:{createElement(){return box;}},session:()=>({token:'test'}),escapeHtml:String,AbortController,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},Event:class{constructor(type){this.type=type;}},fetch:async()=>{fetches++;return {ok:true,json:async()=>data};},window:{YG_MAP:{map},L:{},matchMedia:()=>({matches:false})},L:{
    canvas(){return {};},
    geoJSON(d,opts){style=opts.style;opts.onEachFeature(d.features[0],{bindTooltip(){},on(k,f){tileClick=f;}});return group('tiles');},
    featureGroup(){return group('locators');},
    circleMarker(){return {bindTooltip(){return this;},on(k,f){markerClick=f;return this;}};},
    tileLayer(){images++;return {};}
  }};
  vm.runInNewContext(fragment+';addMeritech({appendChild(){},querySelector:box.querySelector});',{...context,box});
  return {node,box,map,layers,style:()=>style,click:()=>tileClick(),counts:()=>[fetches,images]};
}
test('opening page does not load index, boundaries, markers or imagery',()=>{
  const h=harness();assert.deepEqual(h.counts(),[0,0]);assert.equal(h.layers.size,0);
  assert.doesNotMatch(h.box.innerHTML,/data-meritech-(coverage|toggle) checked/);
});
test('grid remains visible at province scale; clicking zooms without enabling imagery',async()=>{
  const h=harness(),n=h.node('[data-meritech-coverage]');n.checked=true;await n.handlers.change();
  assert.deepEqual([...h.layers].map(x=>x.kind),['tiles']);
  h.click();assert.deepEqual(Array.from(h.map.view[0]),[1.48,102.12]);assert.equal(h.map.view[1],17);
  assert.deepEqual([...h.layers].map(x=>x.kind),['tiles']);assert.equal(h.style().fill,false);assert.equal(h.style().weight,1);assert.equal(h.style().color,'#007bff');
  assert.equal(h.node('[data-meritech-toggle]').checked,false);assert.deepEqual(h.counts(),[1,0]);
  n.checked=false;n.handlers.change();assert.equal(h.layers.size,0);
  h.map.setView([1,102],9);assert.equal(h.layers.size,0);
});
