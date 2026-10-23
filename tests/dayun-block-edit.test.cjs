const test=require('node:test'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const editor=require('../js/dayun-block-edit.js');
const point=(id,status='candidate')=>({type:'Feature',geometry:{type:'Point',coordinates:[1,1]},properties:{id,status,zones:['GT-A-01'],note:'',origin:id.startsWith('A-manual-')?'manual_addition':'automated'}});
function server(){let revision=0,changes=[],versions={},operations={};const original=[point('auto-1'),point('auto-2')];return{snapshot(){return structuredClone({analysis_path:'block/analysis.json',feedback_schema:'dayun-rejection-reason-v1',revision,review:{source_run:'run',analysis_path:'block/analysis.json',changes},point_versions:versions,point_operations:operations,counts:editor.summarize(editor.effective(original,changes),2,['GT-A-01'])});},save(patch){const conflicts=patch.operations.filter(op=>operations[op.id]!==op.operation_id&&op.expected_version!==(versions[op.id]||0)).map(op=>({id:op.id,current_version:versions[op.id]||0}));if(conflicts.length)throw Object.assign(Error('HTTP 409'),{status:409,details:{conflicts}});let count=0;for(const op of patch.operations){if(operations[op.id]===op.operation_id)continue;changes=changes.filter(f=>f.properties.id!==op.id);if(op.feature)changes.push(op.feature);versions[op.id]=(versions[op.id]||0)+1;operations[op.id]=op.operation_id;count++;}if(count)revision++;return this.snapshot();},remote(f){return this.save({operations:[{id:f.properties.id,expected_version:versions[f.properties.id]||0,operation_id:webcrypto.randomUUID(),feature:f}]});}};}
function setup(shared=server()){const element=tag=>({tag,children:[],textContent:'',value:'',append(...xs){this.children.push(...xs)},replaceChildren(...xs){this.children=xs},setAttribute(){}}),host=element('section'),events={},calls=[];let prepared=false,counts,failResponse=false,delay=null;
 global.document={createElement:element};global.window={turf:{booleanPointInPolygon:()=>true},addEventListener(){},removeEventListener(){}};global.L={layerGroup:()=>({addTo(){return this},clearLayers(){}}),divIcon:x=>x,marker:()=>({addTo(){return this},on(){return this}})};global.crypto=webcrypto;
 const original={type:'FeatureCollection',features:[point('auto-1'),point('auto-2')]},before=JSON.stringify(original),options={host,map:{on(k,v){events[k]=v},off(k){delete events[k]},removeLayer(){},getZoom:()=>24},manifest:{run:'run'},result:{candidate_count:2,bounds:[0,0,3,3],native_tiles:[{bounds:[0,0,3,3]}],zones:[{id:'GT-A-01'}]},analysisPath:'block/analysis.json',base:'/api/staff/drone/analysis/Agro_ABC',getCandidates:()=>original,getZones:()=>({features:[{properties:{id:'GT-A-01'}}]}),current:()=>true,save(){},onChanged:info=>counts=info.counts,preparePoint:async()=>{const was=prepared;prepared=true;return was},api:async(path,config)=>{calls.push({path,config});const response=config?shared.save(JSON.parse(config.body).patch):shared.snapshot();if(config&&delay)await delay;if(config&&failResponse){failResponse=false;throw Error('response lost');}return{json:async()=>response}}};
 const all=node=>[node,...(node.children||[]).flatMap(all)];return{host,events,calls,original,before,options,shared,button:text=>all(host).find(n=>n.textContent===text),counts:()=>counts,loseResponse:()=>failResponse=true,delay:p=>delay=p};}
async function add(s){s.button('Tambah titik nanas').onclick();await s.events.click({latlng:{lng:1,lat:1}});await s.events.click({latlng:{lng:1,lat:1}});}

test('census adjustment backs up first and persists per-point batches without altering originals',async()=>{
 const s=setup(),backups=[],normalApi=s.options.api;let posts=0,backupBeforePosts=false;
 s.options.save=(blob,name)=>{backups.push({blob,name});if(name.startsWith("cadangan"))backupBeforePosts=posts===0;};
 s.options.api=async(path,config)=>{if(path.includes('/areas'))return{json:async()=>path.includes('?id=')?{record:{id:'area-test',revision:1,collection:{features:[]}}}:{items:[{id:'area-test',name:'Batas nanas baru Blok A'}]}};if(config)posts++;return normalApi(path,config);};
 global.fetch=async()=>({ok:true,json:async()=>({})});
 global.window.YG_DAYUN_CENSUS_RECONCILE={fingerprint:points=>JSON.stringify(points),targets:()=>[{zone:'GT-A-01',target:262,area:{}}],plan:async()=>({updates:Array.from({length:260},(_,i)=>point('A-manual-census-test-'+i)),summary:[{zone:'GT-A-01',before:2,target:262,add:260,remove:0}]})};
 const e=await editor.mount(s.options);try{
  await s.button('Siapkan penyesuaian titik sesuai sensus').onclick();assert.equal(posts,0);assert.equal(s.button('Terapkan penyesuaian sensus').disabled,false);
  await s.button('Terapkan penyesuaian sensus').onclick();assert.equal(backups.length,2);assert.equal(backupBeforePosts,true);assert.match(backups[0].name,/cadangan/);assert.equal(JSON.parse(await backups[0].blob.text()).features.length,2);assert.equal(posts,2);assert.equal(s.shared.snapshot().counts.working_total,262);assert.equal(JSON.stringify(s.original),s.before);assert.equal(e.canLeave(),true);
 }finally{e.dispose();delete global.fetch;}
});
test('census adjustment refuses a changed team revision before writing or downloading a backup',async()=>{
 const s=setup(),normalApi=s.options.api;let backups=0;s.options.save=()=>backups++;
 s.options.api=async(path,config)=>path.includes('/areas')?{json:async()=>path.includes('?id=')?{record:{id:'area-test',revision:1,collection:{features:[]}}}:{items:[{id:'area-test',name:'Batas nanas baru Blok A'}]}}:normalApi(path,config);
 global.fetch=async()=>({ok:true,json:async()=>({})});global.window.YG_DAYUN_CENSUS_RECONCILE={fingerprint:points=>JSON.stringify(points),targets:()=>[{zone:'GT-A-01',target:3,area:{}}],plan:async()=>({updates:[point('A-manual-census-test-1')],summary:[{zone:'GT-A-01',before:2,target:3,add:1,remove:0}]})};
 const e=await editor.mount(s.options);try{await s.button('Siapkan penyesuaian titik sesuai sensus').onclick();s.shared.remote(point('auto-1','rejected'));await s.button('Terapkan penyesuaian sensus').onclick();assert.equal(backups,0);assert.equal(s.calls.filter(c=>c.config).length,0);assert.equal(s.shared.snapshot().counts.working_total,1);}finally{e.dispose();delete global.fetch;}
});

test('ready native pixels select and box-delete locally without repeated inspection or preparation',async()=>{
 const s=setup();let inspected=0,prepared=0,bindings,focused=0;
 s.options.isPointReady=()=>true;s.options.onInspect=async()=>inspected++;s.options.preparePoint=async()=>{prepared++;throw Error('Unexpected reload');};
 global.window.YG_DAYUN_POINT_SHORTCUTS={mount:o=>{bindings=o;return{focus(){focused++},dispose(){}}}};
 const e=await editor.mount(s.options);try{
  await e.pick(e.features()[0]);assert.equal(inspected,0);assert.ok(focused>0);
  s.options.map.orthoMeasuring=true;assert.equal(bindings.enabled(),false);s.options.map.orthoMeasuring=false;assert.equal(bindings.enabled(),true);
  global.L.circleMarker=()=>({addTo(){return this}});
  bindings.selectBounds({contains:()=>true});bindings.deleteSelection();
  assert.equal(s.counts().working_total,0);assert.equal(prepared,0);assert.equal(s.calls.filter(c=>c.config).length,0);
  await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(s.shared.snapshot().counts.working_total,0);
 }finally{e.dispose();}
});

test('unchanged team polling avoids redrawing counts while remote changes still update them',async()=>{
 const s=setup();let draws=0;const changed=s.options.onChanged;s.options.onChanged=x=>{draws++;changed(x)};
 const e=await editor.mount(s.options);try{const initial=draws;await s.button('Muat ulang koreksi tim').onclick();assert.equal(draws,initial);s.shared.remote(point('auto-1','rejected'));await s.button('Muat ulang koreksi tim').onclick();assert.equal(draws,initial+1);assert.equal(s.counts().working_total,1);}finally{e.dispose();}
});

test('four laptops keep independent additions and converge without duplicate plants',async()=>{
 const shared=server(),sessions=Array.from({length:4},()=>setup(shared)),editors=[];
 try{for(const s of sessions)editors.push(await editor.mount(s.options));for(const s of sessions)await add(s);
  await Promise.all(sessions.map(s=>s.button('Simpan koreksi Blok A privat').onclick()));
  await Promise.all(sessions.map(s=>s.button('Muat ulang koreksi tim').onclick()));
  assert.equal(shared.snapshot().counts.working_total,6);assert.equal(shared.snapshot().counts.manual_additions,4);
  for(const e of editors){assert.equal(e.features().length,6);assert.equal(new Set(e.features().map(f=>f.properties.id)).size,6);assert.equal(e.canLeave(),true);}
 }finally{for(const e of editors)e.dispose();}
});

test('503 after a committed save automatically retries the same operation without duplicates or lost team points',async()=>{
 const retry=require('../js/dayun-save-retry.js'),s=setup(),api=s.options.api;let fail=true;const waits=[];
 s.shared.remote(point('A-manual-anotherstaff','accepted'));
 s.options.api=(path,config)=>retry.run(async()=>{const response=await api(path,config);if(config&&fail){fail=false;throw Object.assign(Error('HTTP 503'),{status:503});}return response;},{path,options:config,...config?.saveRetry,wait:async ms=>waits.push(ms),random:()=>0});
 const e=await editor.mount(s.options);try{await add(s);await s.button('Simpan koreksi Blok A privat').onclick();const posts=s.calls.filter(c=>c.config);assert.equal(posts.length,2);assert.equal(posts[0].config.body,posts[1].config.body);assert.deepEqual(waits,[5000]);assert.equal(s.shared.snapshot().revision,2);assert.equal(s.shared.snapshot().counts.manual_additions,2);assert.equal(e.canLeave(),true);assert.equal(JSON.stringify(s.original),s.before);}finally{e.dispose();}
});

function boxFixture(s){let disabled=0,highlights=0;global.L.Draw={Rectangle:class{constructor(map,options){this.options=options;}enable(){}disable(){disabled++;}}};global.L.circleMarker=()=>({addTo(){highlights++;return this;}});return{draw:contains=>{s.button('Blok titik dengan mouse').onclick();s.events['draw:created']({layer:{options:{dayunPlantSelection:true},addTo(){return this;},getBounds:()=>({contains:contains||(()=>true)})}});},disabled:()=>disabled,highlights:()=>highlights};}

test('undo restores original candidates before and after saving and can undo successive deletes',async()=>{
 const s=setup(),e=await editor.mount(s.options);try{
  for(const id of ['auto-1','auto-2']){await e.pick(e.features().find(f=>f.properties.id===id));s.button('Hapus dari hitungan').onclick();}
  assert.equal(s.counts().working_total,0);assert.equal(e.undoDelete(),true);assert.equal(s.counts().working_total,1);assert.equal(e.undoDelete(),true);assert.equal(s.counts().working_total,2);
  await s.button('Simpan koreksi Blok A privat').onclick();assert.ok(e.features().every(f=>f.properties.status==='candidate'));
  await e.pick(e.features()[0]);s.button('Hapus dari hitungan').onclick();await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(e.undoDelete(),true);await s.button('Simpan koreksi Blok A privat').onclick();
  assert.equal(s.shared.snapshot().counts.working_total,2);assert.equal(new Set(e.features().map(f=>f.properties.id)).size,2);assert.equal(e.undoDelete(),false);assert.equal(JSON.stringify(s.original),s.before);
 }finally{e.dispose();}
});

test('one undo restores a saved batch of manual and automatic plants with their original IDs and positions',async()=>{
 const s=setup(),box=boxFixture(s),e=await editor.mount(s.options);try{
  await add(s);await s.button('Simpan koreksi Blok A privat').onclick();const before=e.features().map(f=>({id:f.properties.id,coordinates:f.geometry.coordinates,status:f.properties.status}));
  s.options.preparePoint=async()=>true;box.draw();await s.button('Hapus titik terpilih').onclick();await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(s.counts().working_total,0);
  assert.equal(e.undoDelete(),true);await s.button('Simpan koreksi Blok A privat').onclick();assert.deepEqual(e.features().map(f=>({id:f.properties.id,coordinates:f.geometry.coordinates,status:f.properties.status})),before);assert.equal(s.shared.snapshot().counts.working_total,3);assert.equal(s.shared.snapshot().counts.manual_additions,1);
 }finally{e.dispose();}
});

test('undo of a never-saved manual deletion queues the same plant once',async()=>{
 const s=setup(),e=await editor.mount(s.options);try{await add(s);const id=e.features().find(f=>f.properties.origin==='manual_addition').properties.id;s.button('Hapus dari hitungan').onclick();assert.equal(s.counts().working_total,2);assert.equal(e.undoDelete(),true);await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(e.features().filter(f=>f.properties.id===id).length,1);assert.equal(s.shared.snapshot().counts.manual_additions,1);}finally{e.dispose();}
});

test('undo during an in-flight delete preserves the acknowledged point version',async()=>{
 const s=setup(),e=await editor.mount(s.options);let release;try{
  await e.pick(e.features()[0]);s.button('Hapus dari hitungan').onclick();s.delay(new Promise(r=>release=r));const saving=s.button('Simpan koreksi Blok A privat').onclick();assert.equal(e.undoDelete(),true);release();await saving;s.delay(null);await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(s.shared.snapshot().counts.working_total,2);assert.equal(e.canLeave(),true);
 }finally{release?.();e.dispose();}
});

test('undo after a lost delete response retries safely without duplicate points',async()=>{
 const s=setup(),e=await editor.mount(s.options);try{
  await add(s);await s.button('Simpan koreksi Blok A privat').onclick();s.button('Hapus dari hitungan').onclick();s.loseResponse();await s.button('Simpan koreksi Blok A privat').onclick();
  assert.equal(e.undoDelete(),true);await s.button('Simpan koreksi Blok A privat').onclick();await s.button('Simpan koreksi Blok A privat').onclick();
  assert.equal(s.shared.snapshot().counts.manual_additions,1);assert.equal(s.shared.snapshot().counts.working_total,3);assert.equal(e.canLeave(),true);
 }finally{e.dispose();}
});

test('undo refuses to overwrite a known newer team decision and version conflicts protect unseen changes',async()=>{
 const s=setup(),e=await editor.mount(s.options);try{
  await e.pick(e.features()[0]);s.button('Hapus dari hitungan').onclick();await s.button('Simpan koreksi Blok A privat').onclick();const remote=point('auto-1','accepted');remote.properties.note='Keputusan staf lain';s.shared.remote(remote);
  await s.button('Muat ulang koreksi tim').onclick();assert.equal(e.undoDelete(),false);assert.equal(e.features().find(f=>f.properties.id==='auto-1').properties.note,'Keputusan staf lain');
  await e.pick(e.features().find(f=>f.properties.id==='auto-2'));s.button('Hapus dari hitungan').onclick();await s.button('Simpan koreksi Blok A privat').onclick();const unseen=point('auto-2','accepted');unseen.properties.note='Baru dari laptop lain';s.shared.remote(unseen);
  assert.equal(e.undoDelete(),true);await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(e.canLeave(),false);assert.equal(s.shared.snapshot().review.changes.find(f=>f.properties.id==='auto-2').properties.note,'Baru dari laptop lain');
 }finally{e.dispose();}
});

test('box selection previews without writes; cancel leaves all points unchanged',async()=>{
 const s=setup(),box=boxFixture(s),e=await editor.mount(s.options);try{box.draw();assert.equal(box.highlights(),2);assert.equal(s.counts().working_total,2);assert.equal(s.calls.filter(c=>c.config).length,0);assert.equal(e.canLeave(),true);s.button('Batal pilih area').onclick();assert.equal(s.button('Hapus titik terpilih').disabled,true);assert.equal(JSON.stringify(s.original),s.before);}finally{e.dispose();assert.equal(s.events['draw:created'],undefined);}
});

test('box delete removes manual points and reversibly rejects candidates in one private patch',async()=>{
 const s=setup(),box=boxFixture(s);const e=await editor.mount(s.options);try{await add(s);s.options.preparePoint=async()=>true;await s.button('Simpan koreksi Blok A privat').onclick();const before=s.calls.filter(c=>c.config).length;box.draw();await s.button('Hapus titik terpilih').onclick();assert.equal(s.counts().working_total,0);assert.equal(s.counts().rejected,2);assert.equal(s.counts().training_examples.negative,0);assert.equal(e.canLeave(),false);await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(s.calls.filter(c=>c.config).length,before+1);const ops=JSON.parse(s.calls.filter(c=>c.config).at(-1).config.body).patch.operations;assert.equal(ops.length,3);assert.equal(ops.filter(op=>op.feature===null).length,1);assert.equal(s.shared.snapshot().counts.working_total,0);assert.equal(JSON.stringify(s.original),s.before);assert.equal(e.canLeave(),true);}finally{e.dispose();}
});

test('box selection respects shown gawangan/filter and does not touch excluded points',async()=>{
 const s=setup(),box=boxFixture(s);s.options.preparePoint=async()=>true;s.options.selectionFilter=f=>f.properties.id==='auto-1';const e=await editor.mount(s.options);try{box.draw();assert.equal(box.highlights(),1);await s.button('Hapus titik terpilih').onclick();assert.equal(s.counts().working_total,1);assert.equal(e.features().find(f=>f.properties.id==='auto-2').properties.status,'candidate');await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(s.shared.snapshot().review.changes.length,1);}finally{e.dispose();}
});

test('box deletion requires native pixels and aborts a preview changed by another laptop',async()=>{
 const s=setup(),box=boxFixture(s);let native=false;s.options.preparePoint=async()=>native;const e=await editor.mount(s.options);try{box.draw();await s.button('Hapus titik terpilih').onclick();assert.equal(e.canLeave(),true);assert.equal(s.counts().working_total,2);native=true;s.shared.remote(point('auto-1','accepted'));await s.button('Muat ulang koreksi tim').onclick();await s.button('Hapus titik terpilih').onclick();assert.equal(e.canLeave(),true);assert.equal(s.counts().working_total,2);assert.equal(s.calls.filter(c=>c.config).length,0);}finally{e.dispose();}
});

test('box deletion preserves unrelated remote additions and failed saves keep local decisions',async()=>{
 const s=setup(),box=boxFixture(s);s.options.preparePoint=async()=>true;const e=await editor.mount(s.options);try{box.draw();s.shared.remote(point('A-manual-other-laptop','accepted'));await s.button('Hapus titik terpilih').onclick();s.loseResponse();await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(e.canLeave(),false);await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(e.canLeave(),true);assert.equal(s.shared.snapshot().counts.working_total,1);assert.equal(s.shared.snapshot().review.changes.find(f=>f.properties.id==='A-manual-other-laptop').properties.status,'accepted');}finally{e.dispose();}
});

test('box is bounded to 250 plants and zoom detail; cancelling during pixel preparation changes nothing',async()=>{
 const s=setup(),box=boxFixture(s);let zoom=21;s.options.map.getZoom=()=>zoom;let release;s.options.preparePoint=()=>new Promise(r=>release=r);const e=await editor.mount(s.options);try{s.button('Blok titik dengan mouse').onclick();assert.equal(s.button('Hapus titik terpilih').disabled,true);zoom=24;box.draw();const waiting=s.button('Hapus titik terpilih').onclick();e.setEditing(false);release(true);await waiting;assert.equal(s.counts().working_total,2);assert.equal(e.canLeave(),true);s.original.features=Array.from({length:251},(_,i)=>point('many-'+i));box.draw();assert.equal(s.button('Hapus titik terpilih').disabled,true);assert.equal(s.calls.filter(c=>c.config).length,0);}finally{e.dispose();}
});

test('passive sync reads once a minute, pauses hidden tabs and backs off failures without blocking saves',async()=>{
 const originalInterval=global.setInterval,originalClear=global.clearInterval,originalNow=Date.now;let tick,now=100000,interval;
 global.setInterval=(fn,ms)=>{tick=fn;interval=ms;return 1;};global.clearInterval=()=>{};Date.now=()=>now;
 const s=setup();let fail=false;const api=s.options.api;s.options.api=async(...args)=>{if(fail&&!args[1])throw Error('HTTP 429');return api(...args);};let e;
 try{e=await editor.mount(s.options);assert.equal(interval,60000);now+=60000;global.document.visibilityState='hidden';tick();await new Promise(r=>setImmediate(r));assert.equal(s.calls.length,1);
 global.document.visibilityState='visible';fail=true;tick();await new Promise(r=>setImmediate(r));fail=false;now+=60000;tick();await new Promise(r=>setImmediate(r));assert.equal(s.calls.length,1);
 await e.pick(e.features()[0]);s.button('Hapus dari hitungan').onclick();await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(s.shared.snapshot().revision,1);assert.equal(e.canLeave(),true);
 now+=240000;tick();await new Promise(r=>setImmediate(r));assert.equal(s.calls.filter(c=>!c.config).length,2);
 }finally{e?.dispose();global.setInterval=originalInterval;global.clearInterval=originalClear;Date.now=originalNow;}
});

test('additional proposals stay outside counts until acceptance and use deterministic per-point collaboration',async()=>{
 const shared=server(),a=setup(shared),b=setup(shared),ea=await editor.mount(a.options),eb=await editor.mount(b.options),f=point('A-manual-suggest-x220-y220');f.geometry.coordinates=[2,2];f.properties.model_signature='trained';
 try{assert.equal(a.counts().working_total,2);assert.equal(await ea.reviewSuggestion(f,'accepted'),false);assert.equal(a.counts().working_total,2);assert.equal(await ea.reviewSuggestion(f,'accepted'),true);assert.equal(a.counts().working_total,3);await a.button('Simpan koreksi Blok A privat').onclick();assert.equal(ea.hasReviewedSuggestion(f.properties.id),true);assert.equal(await eb.reviewSuggestion(f,'accepted'),false);assert.equal(shared.snapshot().counts.working_total,3);assert.equal(shared.snapshot().counts.manual_additions,1);assert.equal(JSON.stringify(a.original),a.before);}finally{ea.dispose();eb.dispose()}
});
test('rejected suggestions do not increase counts and deleted suggestions retain a tombstone',async()=>{
 const s=setup(),e=await editor.mount(s.options),f=point('A-manual-suggest-x230-y230');f.geometry.coordinates=[2,2];
 try{await e.reviewSuggestion(f,'rejected');assert.equal(await e.reviewSuggestion(f,'rejected'),true);assert.equal(s.counts().working_total,2);await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(s.shared.snapshot().counts.training_examples.negative,0);assert.equal(e.hasReviewedSuggestion(f.properties.id),true);
 await e.pick(e.features().find(p=>p.properties.id===f.properties.id));s.button('Hapus dari hitungan').onclick();await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(e.hasReviewedSuggestion(f.properties.id),true);assert.equal(s.shared.snapshot().counts.working_total,2);
 }finally{e.dispose()}
});
test('an additional proposal cannot overwrite a nearby plant or bypass native imagery checks',async()=>{
 const s=setup(),e=await editor.mount(s.options),f=point('A-manual-suggest-x240-y240');
 try{assert.equal(await e.reviewSuggestion(f,'accepted'),false);assert.equal(s.calls.filter(c=>c.config).length,0);f.geometry.coordinates=[4,4];await assert.rejects(()=>e.reviewSuggestion(f,'accepted'),/di luar cakupan/);assert.equal(s.counts().working_total,2);}finally{e.dispose()}
});
test('live sync status does not claim a failed save succeeded and recovers after an idempotent retry',async()=>{
 const s=setup(),states=[],selected=[];s.options.onSyncState=x=>states.push(x);s.options.onSelected=x=>selected.push(x);const e=await editor.mount(s.options);
 try{assert.equal(states.at(-1).ready,true);await e.pick(e.features()[0]);s.button('Hapus dari hitungan').onclick();assert.equal(s.counts().working_total,1);assert.equal(states.at(-1).dirty,true);assert.ok(selected.some(f=>f?.properties.id==='auto-1'));s.loseResponse();await s.button('Simpan koreksi Blok A privat').onclick();assert.ok(states.some(x=>x.saving));assert.equal(states.at(-1).error,'response lost');assert.equal(states.at(-1).dirty,true);await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(states.at(-1).error,null);assert.equal(states.at(-1).dirty,false);assert.equal(states.at(-1).revision,1);assert.equal(s.counts().working_total,1);}finally{e.dispose();}
});
test('effective points preserve originals and count additions, rejection and zone totals separately',()=>{const original=[point('one'),point('two')],p=point('A-manual-12345678','accepted'),f=editor.effective(original,[{...original[0],properties:{...original[0].properties,status:'rejected'}},p]),c=editor.summarize(f,2,['GT-A-01']);assert.equal(c.working_total,2);assert.equal(c.rejected,1);assert.equal(c.manual_additions,1);assert.equal(c.accepted_by_staff,1);assert.equal(original[0].properties.status,'candidate');});

test('dragging a detector point without a note saves an empty note and preserves the original candidate',async()=>{
 const s=setup();delete s.original.features[0].properties.note;const before=JSON.stringify(s.original);let drag;
 global.L.marker=()=>({addTo(){return this},getLatLng:()=>({lng:1.2,lat:1.4}),on(event,fn){if(event==='dragend')drag=fn;return this}});
 const e=await editor.mount(s.options);try{await e.pick(e.features()[0]);drag();await s.button('Simpan koreksi Blok A privat').onclick();const op=JSON.parse(s.calls.find(c=>c.config).config.body).patch.operations[0];assert.equal(op.feature.properties.note,'');assert.deepEqual(op.feature.geometry.coordinates,[1.2,1.4]);assert.equal(op.feature.properties.status,'candidate');assert.equal(e.canLeave(),true);assert.equal(JSON.stringify(s.original),before);}finally{e.dispose();}
});

test('HTTP 400 keeps the local correction and explains the service error until retry succeeds',async()=>{
 const s=setup(),api=s.options.api,states=[];let reject=true;s.options.onSyncState=x=>states.push(x);s.options.api=async(path,config)=>{if(config&&reject)throw Object.assign(Error('HTTP 400'),{status:400,details:{error:'invalid_block_review_point'}});return api(path,config)};
 const e=await editor.mount(s.options);try{await e.pick(e.features()[0]);s.button('Hapus dari hitungan').onclick();await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(e.canLeave(),false);assert.equal(s.counts().working_total,1);assert.match(states.at(-1).error,/invalid_block_review_point/);assert.equal(s.shared.snapshot().revision,0);assert.ok(s.button('Ekspor koreksi tim'));reject=false;await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(e.canLeave(),true);assert.equal(states.at(-1).error,null);assert.equal(s.shared.snapshot().counts.working_total,1);}finally{e.dispose();}
});
test('native first click opens detail; second adds; autosave and reload retain team correction',async()=>{const s=setup(),oldSet=global.setTimeout,oldClear=global.clearTimeout;let task;global.setTimeout=fn=>(task=fn,1);global.clearTimeout=()=>{};let e;try{e=await editor.mount(s.options);s.button('Tambah titik nanas').onclick();const event={latlng:{lng:1,lat:1}};await s.events.click(event);assert.equal(s.counts().manual_additions,0);await s.events.click(event);assert.equal(s.counts().manual_additions,1);assert.equal(e.canLeave(),false);await task();assert.equal(e.canLeave(),true);assert.equal(s.calls.filter(c=>c.config).length,1);assert.ok(s.calls.every(c=>c.path.endsWith('/block-review?block=A')));assert.equal(JSON.stringify(s.original),s.before);await s.button('Muat ulang koreksi tim').onclick();assert.equal(s.counts().manual_additions,1);}finally{e?.dispose();global.setTimeout=oldSet;global.clearTimeout=oldClear;}});
test('manual deletion and same-point conflicts preserve local edits until explicit resolution',async()=>{const s=setup(),e=await editor.mount(s.options);try{await add(s);s.button('Hapus dari hitungan').onclick();assert.equal(s.counts().manual_additions,0);await e.pick(e.features()[0]);assert.equal(s.button('Hapus dari hitungan').disabled,false);s.button('Tolak titik').onclick();s.shared.remote(point('auto-1','accepted'));await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(e.canLeave(),false);assert.equal(s.counts().rejected,1);await s.button('Muat ulang koreksi tim').onclick();assert.equal(s.counts().rejected,1);assert.equal(JSON.stringify(s.original),s.before);await s.button('Gunakan titik tim').onclick();assert.equal(e.canLeave(),true);assert.equal(s.counts().rejected,0);assert.equal(s.counts().accepted_by_staff,1);}finally{e.dispose();}assert.equal(s.events.click,undefined);});
test('three laptop editors merge additions and synchronization preserves unsaved local additions',async()=>{const shared=server(),sessions=[setup(shared),setup(shared),setup(shared)],editors=[];try{for(const s of sessions)editors.push(await editor.mount(s.options));for(const s of sessions)await add(s);await sessions[0].button('Simpan koreksi Blok A privat').onclick();await sessions[1].button('Muat ulang koreksi tim').onclick();assert.equal(sessions[1].counts().manual_additions,2);assert.equal(editors[1].canLeave(),false);await Promise.all(sessions.slice(1).map(s=>s.button('Simpan koreksi Blok A privat').onclick()));for(const s of sessions)await s.button('Muat ulang koreksi tim').onclick();assert.equal(shared.snapshot().counts.manual_additions,3);sessions.forEach((s,i)=>{assert.equal(s.counts().manual_additions,3);assert.equal(editors[i].canLeave(),true);assert.equal(JSON.stringify(s.original),s.before);});}finally{editors.forEach(e=>e.dispose());}});
test('edits made while an earlier save is in flight retain the acknowledged point version',async()=>{const s=setup(),e=await editor.mount(s.options);let release;try{await add(s);s.delay(new Promise(resolve=>release=resolve));const saving=s.button('Simpan koreksi Blok A privat').onclick();await e.pick(e.features().find(f=>f.properties.origin==='manual_addition'));s.button('Tolak titik').onclick();release();await saving;assert.equal(e.canLeave(),false);s.delay(null);await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(e.canLeave(),true);assert.equal(s.shared.snapshot().counts.rejected,1);}finally{release?.();e.dispose();}});
test('retry after response loss does not duplicate a plant and explicit local conflict resolution saves only that point',async()=>{const s=setup(),e=await editor.mount(s.options);try{await add(s);s.loseResponse();await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(e.canLeave(),false);await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(s.shared.snapshot().revision,1);assert.equal(s.shared.snapshot().counts.manual_additions,1);await e.pick(e.features()[0]);s.button('Tolak titik').onclick();s.shared.remote(point('auto-1','accepted'));await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(e.canLeave(),false);s.button('Simpan versi saya untuk titik ini').onclick();await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(e.canLeave(),true);assert.equal(s.shared.snapshot().counts.rejected,1);assert.equal(s.shared.snapshot().counts.manual_additions,1);}finally{e.dispose();}});
test('a conflict on one crown does not block another queued addition',async()=>{const s=setup(),e=await editor.mount(s.options);try{await add(s);await e.pick(e.features()[0]);s.button('Tolak titik').onclick();s.shared.remote(point('auto-1','accepted'));await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(s.shared.snapshot().counts.manual_additions,0);await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(s.shared.snapshot().counts.manual_additions,1);assert.equal(e.canLeave(),false);await s.button('Gunakan titik tim').onclick();assert.equal(e.canLeave(),true);}finally{e.dispose();}});
test('automatic team synchronization imports remote points without discarding pending local points',async()=>{const s=setup(),oldInterval=global.setInterval,oldClear=global.clearInterval;let poll,cleared=false,e;global.setInterval=fn=>(poll=fn,12345);global.clearInterval=()=>cleared=true;try{e=await editor.mount(s.options);await add(s);s.shared.remote(point('A-manual-remote0001','accepted'));poll();await new Promise(resolve=>setImmediate(resolve));assert.equal(s.counts().manual_additions,2);assert.equal(e.canLeave(),false);e.dispose();assert.equal(cleared,true);}finally{e?.dispose();global.setInterval=oldInterval;global.clearInterval=oldClear;}});
test('a lost older response can be acknowledged while a newer local edit remains pending',async()=>{const s=setup(),e=await editor.mount(s.options);let release;try{await add(s);s.delay(new Promise(resolve=>release=resolve));s.loseResponse();const saving=s.button('Simpan koreksi Blok A privat').onclick();await e.pick(e.features().find(f=>f.properties.origin==='manual_addition'));s.button('Tolak titik').onclick();release();await saving;s.delay(null);await s.button('Muat ulang koreksi tim').onclick();assert.equal(e.canLeave(),false);await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(e.canLeave(),true);assert.equal(s.shared.snapshot().counts.rejected,1);assert.equal(s.shared.snapshot().counts.manual_additions,1);}finally{release?.();e.dispose();}});


test('direct selection changes no decisions and delete excludes automatic points with a reversible private rejection',async()=>{
 const s=setup();let inspected=0;s.options.onInspect=async()=>inspected++;const e=await editor.mount(s.options);try{
 await e.pick(e.features()[0]);assert.equal(e.isEditing(),true);assert.equal(inspected,1);assert.equal(e.canLeave(),true);assert.equal(s.calls.filter(c=>c.config).length,0);
 s.button('Hapus dari hitungan').onclick();assert.equal(s.counts().working_total,1);assert.equal(s.counts().rejected,1);await s.button('Simpan koreksi Blok A privat').onclick();const op=JSON.parse(s.calls.find(c=>c.config).config.body).patch.operations[0];assert.equal(op.id,'auto-1');assert.equal(op.feature.properties.status,'rejected');assert.equal(JSON.stringify(s.original),s.before);
 await e.pick(e.features().find(f=>f.properties.id==='auto-1'));s.button('Terima titik').onclick();assert.equal(s.counts().working_total,2);
 }finally{e.dispose();}
});


test('Blok B additions use an independent endpoint, block identity and manual-point prefix',async()=>{
 const s=setup();s.options.result.block='B';s.options.analysisPath='block-B/analysis.json';const api=s.options.api;s.options.api=async(...args)=>{const response=await api(...args);return{json:async()=>{const value=await response.json();value.analysis_path=s.options.analysisPath;value.review.analysis_path=s.options.analysisPath;return value;}}};const e=await editor.mount(s.options);try{await add(s);const manual=e.features().find(f=>f.properties.origin==='manual_addition');assert.match(manual.properties.id,/^B-manual-/);await s.button('Simpan koreksi Blok B privat').onclick();const call=s.calls.find(c=>c.config);assert.match(call.path,/block=B$/);const patch=JSON.parse(call.config.body).patch;assert.equal(patch.block,'B');assert.equal(patch.analysis_path,'block-B/analysis.json');assert.equal(JSON.stringify(s.original),s.before);}finally{e.dispose();}
});


test('Blok C additions use an independent endpoint, block identity and manual-point prefix',async()=>{
 const s=setup();s.options.result.block='C';s.options.analysisPath='block-C/analysis.json';const api=s.options.api;s.options.api=async(...args)=>{const response=await api(...args);return{json:async()=>{const value=await response.json();value.analysis_path=s.options.analysisPath;value.review.analysis_path=s.options.analysisPath;return value;}}};const e=await editor.mount(s.options);try{await add(s);const manual=e.features().find(f=>f.properties.origin==='manual_addition');assert.match(manual.properties.id,/^C-manual-/);await s.button('Simpan koreksi Blok C privat').onclick();const call=s.calls.find(c=>c.config);assert.match(call.path,/block=C$/);const patch=JSON.parse(call.config.body).patch;assert.equal(patch.block,'C');assert.equal(patch.analysis_path,'block-C/analysis.json');assert.equal(JSON.stringify(s.original),s.before);}finally{e.dispose();}
});

test('staff rejection reasons remain private point decisions and duplicate points are not species negatives',async()=>{
 const s=setup(),e=await editor.mount(s.options);const all=n=>[n,...(n.children||[]).flatMap(all)];try{
 await e.pick(e.features()[0]);const reason=all(s.host).find(n=>n.tag==='select'&&n.children.some(o=>o.value==='not_pineapple'));assert.ok(reason);assert.equal(e.canLeave(),true);reason.value='duplicate';s.button('Tolak titik').onclick();await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(s.shared.snapshot().review.changes[0].properties.rejection_reason,'duplicate');assert.equal(s.counts().training_examples.negative,0);
 await e.pick(e.features().find(f=>f.properties.id==='auto-2'));reason.value='not_pineapple';s.button('Tolak titik').onclick();await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(s.counts().training_examples.negative,1);assert.equal(s.counts().training_examples.rejected_without_species_label,1);
 await e.pick(e.features().find(f=>f.properties.id==='auto-2'));s.button('Terima titik').onclick();await s.button('Simpan koreksi Blok A privat').onclick();assert.equal(s.counts().training_examples.negative,0);assert.equal(s.counts().training_examples.positive,1);assert.equal(JSON.stringify(s.original),s.before);
 }finally{e.dispose();}
});

test('an older server cannot silently discard a new species-rejection label',async()=>{
 const s=setup(),api=s.options.api;s.options.api=async(...args)=>{const response=await api(...args);return{json:async()=>{const value=await response.json();delete value.feedback_schema;return value}}};const e=await editor.mount(s.options),all=n=>[n,...(n.children||[]).flatMap(all)];try{await e.pick(e.features()[0]);const reason=all(s.host).find(n=>n.tag==='select'&&n.children.some(o=>o.value==='not_pineapple'));assert.equal(reason.disabled,true);reason.value='not_pineapple';s.button('Tolak titik').onclick();assert.equal(e.canLeave(),true);assert.ok(!s.calls.some(c=>c.config));assert.match(JSON.stringify(s.host),/Layanan belum mendukung/);}finally{e.dispose();}
});


test('adding a manual point reveals its actual zone without changing its identity or save payload',async()=>{const s=setup(),placed=[];s.options.onPointPlaced=f=>placed.push(structuredClone(f));const e=await editor.mount(s.options);try{await add(s);assert.equal(placed.length,1);assert.deepEqual(placed[0].properties.zones,['GT-A-01']);assert.equal(e.canLeave(),false);await s.button('Simpan koreksi Blok A privat').onclick();const f=s.shared.snapshot().review.changes.find(f=>f.properties.id===placed[0].properties.id);assert.deepEqual(f.geometry,placed[0].geometry);assert.deepEqual(f.properties.zones,['GT-A-01']);assert.equal(e.canLeave(),true);}finally{e.dispose();}});

 test('measuring a boundary cannot create pineapple corrections',async()=>{const s=setup();s.options.preparePoint=async()=>true;const e=await editor.mount(s.options);try{s.button('Tambah titik nanas').onclick();s.options.map.orthoMeasuring=true;await s.events.click({latlng:{lng:1,lat:1}});assert.equal(e.features().length,2);assert.equal(s.calls.filter(c=>c.config).length,0);}finally{e.dispose();}});
