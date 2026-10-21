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
 const element=tag=>({tag,children:[],value:'',hidden:true,disabled:false,textContent:'',files:[],append(...xs){this.children.push(...xs)},prepend(...xs){this.children.unshift(...xs)},replaceChildren(...xs){this.children=xs},setAttribute(){},add(x){this.children.push(x)}});
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
test('private save uses revision control; a new mount restores the saved decision',async()=>{
 const s=setup();let stored={ok:true,revision:0,review:null,model:null};const posts=[];
 s.options.api=async(path,options={})=>{if(path.endsWith('/review')){if(options.method==='POST'){const body=JSON.parse(options.body);posts.push(body);assert.equal(body.expected_revision,stored.revision);stored={ok:true,revision:stored.revision+1,review:body.review,model:{status:'waiting_for_complete_review',samples:[]}};}return{json:async()=>structuredClone(stored)}}return{json:async()=>trial(),blob:async()=>new Blob(['tif'])};};
 let dispose=await mount(s.options);await s.find('Buka sampel dan penanda').onclick();s.markers[0].handlers.click();s.host.children.find(x=>x.tag==='select'&&x.children.some(c=>c.value==='accepted')).value='accepted';s.find('Terapkan keputusan').onclick();await s.find('Simpan privat & perbarui hitungan').onclick();assert.equal(posts.length,1);assert.equal(stored.review.samples[0].features[0].properties.status,'accepted');dispose();
 dispose=await mount(s.options);await s.find('Buka sampel dan penanda').onclick();assert.ok(s.host.children.some(x=>x.textContent.includes('1 diterima pemeriksa')));assert.ok(s.host.children.some(x=>x.textContent.includes('Revisi privat 1')));dispose();
});
test('save conflicts preserve local decisions and cannot silently overwrite server labels',async()=>{
 const s=setup();s.options.api=async(path,options={})=>{if(path.endsWith('/review')){if(options.method==='POST')throw Error('HTTP 409');return{json:async()=>({ok:true,revision:2,review:null,model:null})};}return{json:async()=>trial(),blob:async()=>new Blob(['tif'])};};const dispose=await mount(s.options);await s.find('Buka sampel dan penanda').onclick();s.markers[0].handlers.click();s.host.children.find(x=>x.tag==='select'&&x.children.some(c=>c.value==='accepted')).value='accepted';s.find('Terapkan keputusan').onclick();await s.find('Simpan privat & perbarui hitungan').onclick();assert.match(s.host.children.at(-1).textContent,/Konflik revisi/);s.find('Ekspor koreksi').onclick();const data=JSON.parse(await s.saved[0].blob.text());assert.equal(data.samples[0].features[0].properties.status,'accepted');dispose();
});
test('clicking a blue automatic proposal adds one reviewable point, without duplicates',async()=>{
 const s=setup(),circles=[];global.L.circleMarker=()=>{const circle={handlers:{},bindTooltip(){return this},addTo(){circles.push(this);return this},on(k,f){this.handlers[k]=f;return this}};return circle;};
 s.options.api=async path=>path.endsWith('/review')?{json:async()=>({ok:true,revision:1,review:null,model:{status:'waiting_for_complete_review',samples:[{id:'ABC-A-01',automatic_count:1,feedback_candidate_count:1,accepted_by_reviewer:0,features:[{geometry:{type:'Point',coordinates:[102.007,.584]},properties:{id:'auto-1',feedback_origin:'thresholded_template_match'}}]}]}})}:{json:async()=>trial(),blob:async()=>new Blob(['tif'])};
 const dispose=await mount(s.options);await s.find('Buka sampel dan penanda').onclick();const toggle=s.host.children.find(x=>x.tag==='label'&&x.textContent.includes('biru')).children[0];toggle.checked=true;toggle.onchange();circles[0].handlers.click();circles.at(-1).handlers.click();s.find('Ekspor koreksi').onclick();const result=JSON.parse(await s.saved[0].blob.text());assert.equal(result.samples[0].features.length,2);assert.equal(result.samples[0].features[1].properties.status,'candidate');dispose();
});


test('only added candidates can be deleted, undone and saved without a negative training label',async()=>{
 const s=setup();let stored={revision:0,review:null,model:null};
 s.options.api=async(path,options={})=>{if(path.endsWith('/review')){if(options.method==='POST'){const body=JSON.parse(options.body);stored={revision:stored.revision+1,review:body.review,model:null};}return{json:async()=>structuredClone(stored)}}return{json:async()=>trial(),blob:async()=>new Blob(['tif'])};};
 const dispose=await mount(s.options);await s.find('Buka sampel dan penanda').onclick();
 const remove=s.find('Hapus kandidat tambahan'),undo=s.find('Urungkan hapus kandidat');
 s.markers[0].handlers.click();assert.equal(remove.disabled,true);remove.onclick();assert.equal(s.markers.length,1);
 s.find('Tambah kandidat di peta').onclick();s.listeners.click({latlng:{lat:.584,lng:102.007}});assert.equal(remove.disabled,false);remove.onclick();assert.equal(s.markers.length,1);assert.equal(undo.disabled,false);
 // Deleting stops add mode, so another map click cannot create a point.
 s.listeners.click({latlng:{lat:.584,lng:102.007}});assert.equal(s.markers.length,1);
 undo.onclick();assert.equal(s.markers.length,2);s.markers[1].handlers.click();remove.onclick();await s.find('Simpan privat & perbarui hitungan').onclick();
 assert.equal(stored.review.samples[0].features.length,1);assert.equal(stored.review.samples[0].features[0].properties.id,'ABC-A-01-001');assert.equal(stored.review.samples[0].features[0].properties.status,'candidate');assert.equal(stored.review.samples[0].complete,false);
 dispose();const restored=await mount(s.options);await s.find('Buka sampel dan penanda').onclick();assert.equal(s.markers.length,1);restored();
});

test('radial trial uses a separate private review and switching protects unsaved edits',async()=>{
 const s=setup();s.options.manifest.candidate_trials={'block-A-radial-v1':'radial/candidate-trial.json'};s.options.manifest.preferred_candidate_trial='block-A-radial-v1';s.options.manifest.files.push('radial/candidate-trial.json');
 const radial={...trial(),dataset_id:'run-radial'},stores={old:{revision:5,review:null,model:null},radial:{revision:0,review:null,model:null}},posts=[];
 s.options.api=async(path,options={})=>{s.requests.push(path);if(path.includes('/review')){const key=path.includes('?trial=')?'radial':'old';if(options.method==='POST'){const body=JSON.parse(options.body);posts.push({key,body});assert.equal(body.expected_revision,stores[key].revision);stores[key]={revision:stores[key].revision+1,review:body.review,model:null};}return{json:async()=>structuredClone(stores[key])};}return{json:async()=>structuredClone(path.includes('/radial/')?radial:trial()),blob:async()=>new Blob(['tif'])};};
 const all=n=>[n,...(n.children||[]).flatMap(all)],find=text=>all(s.host).find(x=>x.textContent===text);
 const dispose=await mount(s.options);assert.ok(s.requests.some(p=>p.endsWith('/review?trial=block-A-radial-v1')));
 await find('Buka sampel dan penanda').onclick();s.markers[0].handlers.click();all(s.host).find(x=>x.tag==='select'&&x.children.some(c=>c.value==='accepted')).value='accepted';find('Terapkan keputusan').onclick();
 const chooser=s.host.children[0];chooser.value='';await chooser.onchange();assert.equal(chooser.value,'block-A-radial-v1');assert.match(s.host.children[1].textContent,/Simpan privat atau ekspor/);
 await find('Simpan privat & perbarui hitungan').onclick();assert.equal(posts[0].key,'radial');assert.equal(posts[0].body.review.dataset_id,'run-radial');assert.equal(stores.old.revision,5);
 chooser.value='';await chooser.onchange();assert.ok(s.requests.at(-1).endsWith('/review'));assert.equal(stores.radial.revision,1);dispose();
});

test('direct sample opens its private raster and selects a point without saving decisions',async()=>{
 const s=setup();s.options.manifest.candidate_trials={'radial':'radial/candidate-trial.json'};s.options.manifest.files.push('radial/candidate-trial.json');Object.assign(s.options,{trialKey:'radial',initialSample:'ABC-A-01',initialPoint:'ABC-A-01-001',autoOpen:true});
 const requests=[];s.options.api=async(path,options={})=>{requests.push({path,options});return{json:async()=>path.includes('/review')?{revision:0,review:null,model:null}:trial(),blob:async()=>new Blob(['tif'])};};
 const dispose=await mount(s.options);assert.equal(s.opened.length,1);assert.equal(s.markers.length,1);assert.equal(s.find('Terapkan keputusan').disabled,false);assert.ok(s.host.children.some(n=>n.textContent.includes('ABC-A-01-001')));assert.ok(requests.every(r=>!r.options.method));dispose();
 s.options.initialSample='missing';await assert.rejects(()=>mount(s.options),/Sampel pada tautan/);
});

 test('measuring cannot add a sample candidate',async()=>{const s=setup(),reviewer=await mount(s.options);try{await s.find('Buka sampel dan penanda').onclick();s.find('Tambah kandidat di peta').onclick();s.options.map.orthoMeasuring=true;await s.listeners.click({latlng:{lng:102.005,lat:.582}});assert.equal(s.markers.length,1);}finally{reviewer();}});
