const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/riau-reference-workspace.js'),'utf8');
const fragment=source.slice(source.indexOf('  function addMeritech(panel)'),source.indexOf('  function createPanel()'));
function harness(){
  const nodes=new Map();
  function node(key){if(!nodes.has(key))nodes.set(key,{checked:false,value:'.85',textContent:'',handlers:{},addEventListener(k,fn){this.handlers[k]=fn;},dispatchEvent(e){return this.handlers[e.type]?.(e);}});return nodes.get(key);}
  const box={innerHTML:'',querySelector:node,remove(){}};
  const map={setView(target,z){this.view=[target,z];},fitBounds(){},removeLayer(){},getPane(){return true;},on(){},off(){}};
  let fetches=0,groups=0,images=0,click;
  const data={type:'FeatureCollection',metadata:{updatedAt:'2026-10-06',total:1,counts:{imagery:1,not_detected:0,error:0,pending:0}},features:[{properties:{id:'R1',state:'imagery',target:[1.48,102.12]}}]};
  const context={document:{createElement(){return box;}},session:()=>({token:'test'}),escapeHtml:String,AbortController,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},Event:class{constructor(type){this.type=type;}},fetch:async()=>{fetches++;return {ok:true,json:async()=>data};},window:{YG_MAP:{map},L:{},matchMedia:()=>({matches:false})},L:{geoJSON(d,opts){groups++;opts.onEachFeature(d.features[0],{bindTooltip(){},on(type,fn){click=fn;}});return {addTo(){return this;},getBounds(){return [];}};},tileLayer(){images++;return {};}}};
  vm.runInNewContext(fragment+';addMeritech({appendChild(){},querySelector:box.querySelector});',{...context,box});
  return {node,box,map,click:()=>click(),counts:()=>[fetches,groups,images]};
}
test('page opening loads no Meritech index, geometry or imagery',()=>{
  const h=harness();assert.deepEqual(h.counts(),[0,0,0]);
  assert.doesNotMatch(h.box.innerHTML,/data-meritech-(coverage|toggle) checked/);
});
test('checking grid loads saved index without loading source imagery',async()=>{
  const h=harness();const n=h.node('[data-meritech-coverage]');n.checked=true;await n.handlers.change();
  assert.deepEqual(h.counts(),[1,1,0]);
  h.click();assert.deepEqual(Array.from(h.map.view[0]),[1.48,102.12]);assert.equal(h.map.view[1],17);
  assert.equal(h.node('[data-meritech-toggle]').checked,false);
  assert.deepEqual(h.counts(),[1,1,0]);
});
