const test=require('node:test'),assert=require('node:assert/strict');
const {mount,validateReview,counts}=require('../js/dayun-candidate-review.js');
const feature=()=>({type:'Feature',geometry:{type:'Point',coordinates:[102.005,.582]},properties:{id:'ABC-A-01-001',sample_id:'ABC-A-01',status:'candidate',note:''}});
const trial=()=>({schema:'dayun-candidate-trial-v1',dataset_id:'run-trial',source_run:'run',label:'Agro_ABC',samples:[{id:'ABC-A-01',gawangan:'GT-A-01',sourceCrop:'GT-A-01/crop.tif',bounds:[102,.58,102.01,.59],features:[feature()]}]});
const review=()=>({schema:'dayun-candidate-corrections-v1',dataset_id:'run-trial',source_run:'run',samples:[{id:'ABC-A-01',features:[feature()]}]});
test('corrections are bound to the exact imagery run, unique IDs, sample bounds and known decisions',()=>{
 assert.equal(validateReview(review(),trial()).samples.length,1);
 for(const mutate of [r=>r.source_run='other',r=>r.dataset_id='other',r=>r.samples[0].features.push(feature()),r=>r.samples[0].features[0].geometry.coordinates=[0,0],r=>r.samples[0].features[0].properties.status='counted',r=>r.samples[0].features[0].properties.note='x'.repeat(1001)]){const r=review();mutate(r);assert.throws(()=>validateReview(r,trial()));}
 assert.deepEqual(counts([feature()]),{candidate:1,accepted:0,rejected:0});
});
function setup(){
 const element=tag=>({tag,children:[],value:'',hidden:true,disabled:false,textContent:'',files:[],append(...xs){this.children.push(...xs)},replaceChildren(...xs){this.children=xs},setAttribute(){},add(x){this.children.push(x)}});
 global.document={createElement:element};global.Option=function(text,value){return{text,value}};
 const markers=[],listeners={},group={addTo(){return this},clearLayers(){markers.length=0}},map={on(k,f){listeners[k]=f},off(k){delete listeners[k]},fitBounds(){},removeLayer(){}};
 global.L={layerGroup:()=>group,divIcon:o=>o,marker:(latlng,options)=>{const m={latlng,options,handlers:{},addTo(){markers.push(this);return this},bindTooltip(){},on(k,f){this.handlers[k]=f},getLatLng(){return{lat:this.latlng[0],lng:this.latlng[1]}},setLatLng(p){this.latlng=p}};return m}};
 const host=element('section'),saved=[],requests=[],opened=[];let active=true;
 const options={host,map,manifest:{run:'run',files:['candidate-trial.json','GT-A-01/crop.tif']},base:'/api/staff/drone/analysis/Agro_ABC',current:()=>active,api:async path=>{requests.push(path);return{json:async()=>trial(),blob:async()=>new Blob(['tif'])}},openRaster:async(...args)=>opened.push(args),save:(blob,name)=>saved.push({blob,name})};
 return{options,host,markers,listeners,saved,opened,requests,setActive:v=>active=v,find:text=>host.children.find(x=>x.textContent===text)};
}
test('staff reviews, moves, adds and exports candidates without a census write; disposal removes all markers',async()=>{
 const s=setup(),dispose=await mount(s.options);await s.find('Buka sampel dan penanda').onclick();assert.equal(s.markers.length,1);assert.equal(s.opened.length,1);
 s.markers[0].handlers.click();const decision=s.host.children.find(x=>x.tag==='select'&&x.children.some(c=>c.value==='accepted'));decision.value='accepted';await s.find('Terapkan keputusan').onclick();
 s.markers[0].latlng=[.583,102.006];s.markers[0].handlers.dragend();s.find('Tambah kandidat di peta').onclick();s.listeners.click({latlng:{lat:.584,lng:102.007}});assert.equal(s.markers.length,2);
 s.find('Ekspor koreksi').onclick();const out=JSON.parse(await s.saved[0].blob.text());assert.equal(out.census_changed,false);assert.equal(out.not_a_validated_plant_count,true);assert.equal(out.samples[0].features[0].properties.status,'accepted');assert.deepEqual(out.samples[0].features[0].geometry.coordinates,[102.006,.583]);assert.equal(out.samples[0].features.length,2);assert.ok(s.requests.every(p=>p.startsWith('/api/staff/drone/analysis/')));
 dispose();assert.equal(s.host.hidden,true);assert.equal(s.listeners.click,undefined);
});
test('expired sessions cannot open or export; loading another run cannot replace a review',async()=>{
 const s=setup(),dispose=await mount(s.options);const input=s.host.children.find(x=>x.type==='file');input.files=[{size:20,text:async()=>JSON.stringify({...review(),source_run:'other'})}];await input.onchange();assert.match(s.host.children.at(-1).textContent,/bukan untuk citra/);
 s.setActive(false);await s.find('Buka sampel dan penanda').onclick();s.find('Ekspor koreksi').onclick();assert.equal(s.opened.length,0);assert.equal(s.saved.length,0);dispose();
});
