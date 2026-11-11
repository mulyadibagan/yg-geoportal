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
async function app({feg=fc([feature(),feature()]),privateFetch,catalog={access:'staff_only',datasets:[]},display,displayFetch}={}) {
  const nodes=new Map(),drawn=[],removed=[],privateCalls=[],displayRequests=[];
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
  let session={token:'test-only'};
  const window={YG_RESTORATION:A,YG_RESTORATION_CATALOG:C,YG_RESTORATION_REVIEW:require('../js/restoration-review.js'),YG_AUTH:{readStoredSession:()=>session},addEventListener(){},YG_STAFF_DATA:{privateFetch:async input=>{privateCalls.push(input);if(privateFetch)return privateFetch(input);return {ok:true,json:async()=>feg};}}};window.top=window;window.self=window;
  const context={window,document,L,location:{hostname:'webgisyg.id',protocol:'https:'},AbortSignal,setTimeout,clearTimeout,crypto:webcrypto,TextDecoder,TextEncoder,Uint8Array,structuredClone,
    fetch:async (url,options)=>{
      if(url.endsWith('/catalog'))return {ok:true,json:async()=>catalog};
      if(url.endsWith('/display')){displayRequests.push({url,options});return displayFetch?displayFetch():new Response(JSON.stringify(display));}
      if(url==='data/restoration-priority-sources.json')return {ok:true,json:async()=>({sources:[]})};
      if(url.includes('batas_provinsi'))return {ok:true,json:async()=>fc([feature()])};
      if(url.includes('Gambut_BBSDLP')){const peat=feature();peat.properties={KABKOT:'Siak',Luas_Ha:10};return new Response(JSON.stringify(fc([peat])));}
      throw Error('Unexpected request: '+url);
    }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/restoration-priority.js'),'utf8'),context);
  for(let i=0;i<30&&!nodes.get('region-status')?.textContent;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(nodes.get('workspace').hidden,false);
  const click=id=>nodes.get(id).listeners.click();
  const change=id=>nodes.get(id).listeners.change();
  return {nodes,drawn,removed,privateCalls,displayRequests,click,change,endSession(){session=null;}};
}

function fireCatalog(display){
 const uuid='12345678-1234-4123-8123-123456789abc',bytes=Buffer.from(JSON.stringify(display));
 return {uuid,catalog:{access:'staff_only',datasets:[{datasetUuid:uuid,title:'KEBAKARANHUTLARIAU_PT_2026_250K',publisher:'Badan Penanggulangan Bencana Daerah Provinsi Riau',dataYear:2026,conflicts:[{field:'theme'}],artifacts:{display:{available:true,status:'ready',bytes:bytes.length,featureCount:display.features.length,sha256:createHash('sha256').update(bytes).digest('hex')}}}]}};
}
test('BPBD layer loads only on selection using staff authorization and preserves unassessed ecological totals',async()=>{
 const display=fc([{type:'Feature',properties:{event:'test-only'},geometry:{type:'MultiPoint',coordinates:[[100.75,.25],[110,5]]}}]);
 const {uuid,catalog}=fireCatalog(display),ui=await app({catalog,display});
 assert.equal(ui.displayRequests.length,0);
 const before=['area','polygon-count','priority-count'].map(id=>ui.nodes.get(id).textContent),id='layer-bpbd-'+uuid;
 ui.nodes.get(id).checked=true;await ui.change(id);
 assert.equal(ui.displayRequests.length,1);assert.equal(ui.displayRequests[0].options.headers.authorization,'Bearer test-only');
 const shown=ui.drawn.at(-1).data;
 assert.equal(shown.features.length,1);assert.equal(shown.features[0].geometry.coordinates.length,1);
 assert.deepEqual(['area','polygon-count','priority-count'].map(id=>ui.nodes.get(id).textContent),before);
 assert.match(ui.nodes.get('runtime-source-bpbd-'+uuid).textContent,/catatan metadata: 1/);
});
test('BPBD forbidden response hides staff workspace without accepting layer data',async()=>{
 const display=fc([{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[100.75,.25]}}]);
 const {uuid,catalog}=fireCatalog(display),ui=await app({catalog,display,displayFetch:()=>new Response('denied',{status:403})});
 const id='layer-bpbd-'+uuid;ui.nodes.get(id).checked=true;await ui.change(id);
 assert.equal(ui.nodes.get('workspace').hidden,true);assert.equal(ui.nodes.get(id).checked,false);
 assert.match(ui.nodes.get('state-bpbd-'+uuid).textContent,/HTTP 403/);
});
test('BPBD selection after the stored session ends sends no request and hides the workspace',async()=>{
 const display=fc([{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[100.75,.25]}}]);
 const {uuid,catalog}=fireCatalog(display),ui=await app({catalog,display});ui.endSession();
 const id='layer-bpbd-'+uuid;ui.nodes.get(id).checked=true;await ui.change(id);
 assert.equal(ui.displayRequests.length,0);assert.equal(ui.nodes.get('workspace').hidden,true);assert.equal(ui.nodes.get(id).checked,false);
});
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

test('county filter updates source region table without inventing priority counts',async()=>{
  const ui=await app();
  const rows=ui.nodes.get('regions').children;
  assert.equal(rows.length,1); assert.equal(rows[0].children[0].textContent,'Siak');
  assert.equal(rows[0].children[3].textContent,'Belum dinilai');
  assert.match(ui.nodes.get('region-status').textContent,/belum dapat ditetapkan/);
  ui.nodes.get('regency').value='Bengkalis'; await ui.change('regency');
  assert.equal(ui.nodes.get('regions').children.length,0);
});
test('staff local review import draws candidates, filters by county and clears without changing scoring totals',async()=>{
 const ui=await app(),peat=feature();peat.properties={KABKOT:'Siak',Luas_Ha:10};const hash=b=>createHash('sha256').update(b).digest('hex'),sourceHash=hash(JSON.stringify(fc([peat])));
 const g=fc([{type:'Feature',id:`bbsdlp-${sourceHash.slice(0,16)}-0001`,geometry:peat.geometry,properties:{sourceFeatureIndex:0,sourceFeatureSha256:hash(JSON.stringify(peat)),reviewCandidate:true,priority:'Belum dinilai',ecologicalScore:null,scoringValidated:false,sourceUnitApproved:false,forestObservationYear:null,canalObservationYear:null,implementationReadiness:{assessed:false,score:null},lossFragmentRefs:[1],canalPartsIntersecting:1}}]);g.metadata={access:'staff_only',sourceSha256:sourceHash};
 const data=Buffer.from(JSON.stringify(g)),manifest=Buffer.from(JSON.stringify({access:'staff_only',sourceGeometryModified:false,priorityAssessed:false,originalPeatSha256:sourceHash,reviewCandidatesSha256:hash(data)}));
 for(const [id,b]of [['review-data',data],['review-manifest',manifest]])ui.nodes.get(id).files=[{size:b.length,arrayBuffer:async()=>Uint8Array.from(b).buffer}];
 const before=ui.nodes.get('priority-count').textContent;await ui.click('review-load');
 assert.match(ui.nodes.get('review-status').textContent,/1 dari 1 kandidat/);assert.equal(ui.nodes.get('priority-count').textContent,before);assert.equal(ui.nodes.get('review-clear').disabled,false);
 ui.nodes.get('regency').value='Bengkalis';await ui.change('regency');assert.match(ui.nodes.get('review-status').textContent,/0 dari 1 kandidat/);
 await ui.click('review-clear');assert.match(ui.nodes.get('review-status').textContent,/Belum ada/);assert.equal(ui.nodes.get('review-clear').disabled,true);
});
test('expired staff session prevents opening local review files and hides workspace',async()=>{
 const ui=await app();let opened=0;ui.nodes.get('review-data').files=[{size:1,arrayBuffer:async()=>{opened++;return new ArrayBuffer(1);}}];ui.endSession();await ui.click('review-load');assert.equal(opened,0);assert.equal(ui.nodes.get('workspace').hidden,true);assert.match(ui.nodes.get('review-status').textContent,/Sesi staf berubah/);
});
