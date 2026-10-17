const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('js/dayun-block-review.js','utf8');
function setup(){
 const element=tag=>({tag,children:[],value:'',hidden:true,textContent:'',style:{},append(...x){this.children.push(...x)},replaceChildren(...x){this.children=x},add(x){this.children.push(x)},setAttribute(){},showModal(){this.open=true},close(){this.open=false},insertBefore(x){this.children.unshift(x)}});
 const host=element('section'),requests=[],events={},layers=[],overlays=[];
 const layer={addTo(){return this},clearLayers(){},bindTooltip(){return this},on(){return this},getBounds(){return[[0,0],[1,1]]},getLayers(){return[]}};
 const context={window:{},document:{createElement:element},Option:function(text,value){return{text,value}},L:{layerGroup:()=>({...layer}),imageOverlay:(url,box,opts)=>{overlays.push(opts);return layer},geoJSON:()=>layer,featureGroup:()=>layer,circleMarker:(xy,opts)=>{const item={xy,opts,handlers:{}};layers.push(item);return{...layer,on(k,fn){item.handlers[k]=fn;return this}}}},URL:{createObjectURL:()=> 'blob:private',revokeObjectURL(){}},Promise,AbortController,setTimeout,clearTimeout};vm.runInNewContext(code,context);
 const result={schema:'dayun-block-analysis-v1',block:'A',source_run:'run',overview:'overview.jpg',bounds:[0,0,1,1],candidate_count:2,boundary_conflict_candidate_count:0,boundary_overlap_count:0,zones:[{id:'GT-A-01',kind:'active_source',candidate_crowns:2,boundary_conflict_candidates:0}],native_tiles:[{file:'native/one.tif',bounds:[0,0,1,1]}]};
 const options={host,map:{createPane(){return{style:{}}},getPane(){},setView(){},getCenter:()=>({lng:.5,lat:.5}),on(k,v){events[k]=v},off(k){delete events[k]},removeLayer(){},getZoom:()=>24,getBounds:()=>({contains:()=>true}),fitBounds(){}},manifest:{run:'run',block_analyses:{A:'block-A/analysis.json'},files:['analysis.json','zones.geojson','candidates.geojson','boundary-audit.geojson','overview.jpg','gawangan.csv','native/one.tif'].map(f=>'block-A/'+f)},base:'/api/staff/drone/analysis/Agro_ABC',api:async(path,config)=>{requests.push({path,config});return{json:async()=>path.endsWith('analysis.json')?result:{type:'FeatureCollection',features:[]},blob:async()=>new Blob(['image'])}},openRaster:async()=>{},save(){},current:()=>true};
 return{mount:context.window.YG_DAYUN_BLOCK.mount,options,host,requests,events,result,layers,overlays,context,find:text=>host.children.find(x=>x.textContent===text)};
}
test('block analysis uses only manifest-listed private read endpoints and cleans up',async()=>{
 const s=setup(),dispose=await s.mount(s.options);assert.equal(s.host.hidden,false);assert.ok(s.host.children.some(x=>x.textContent.includes('Bukan jumlah nanas')));await s.find('Buka seluruh Blok A').onclick();assert.ok(s.requests.every(r=>r.path.startsWith('/api/staff/drone/analysis/Agro_ABC/files/block-A/')&&!r.config));s.find('Periksa citra asli di titik peta').onclick();await s.events.click({latlng:{lng:.5,lat:.5}});assert.ok(s.requests.some(r=>r.path.endsWith('/native/one.tif')));dispose();assert.equal(s.host.hidden,true);assert.equal(s.events.click,undefined);
});
test('missing block analysis is skipped and wrong source run is refused before map access',async()=>{
 const s=setup();s.options.manifest.block_analyses={};await s.mount(s.options);assert.equal(s.requests.length,0);s.options.manifest.block_analyses={A:'block-A/analysis.json'};s.result.source_run='other';await assert.rejects(()=>s.mount(s.options),/tidak sesuai/);assert.equal(s.host.hidden,true);
});
test('an unlisted native tile cannot be requested',async()=>{
 const s=setup(),dispose=await s.mount(s.options);s.options.manifest.files=s.options.manifest.files.filter(p=>!p.endsWith('.tif'));s.find('Periksa citra asli di titik peta').onclick();await s.events.click({latlng:{lng:.5,lat:.5}});assert.ok(!s.requests.some(r=>r.path.endsWith('.tif')));assert.match(JSON.stringify(s.host.children),/belum tersedia/);dispose();
});

test('private database reference shows fractional values without claiming a validated image count',async()=>{
 const s=setup(),old=s.options.api;s.options.manifest.block_comparisons={A:'block-A/database-comparison.json'};s.options.manifest.files.push('block-A/database-comparison.json','block-A/database-comparison.csv');s.options.api=async(path,config)=>path.endsWith('database-comparison.json')?{json:async()=>({schema:'dayun-ortho-database-comparison-v1',block:'A',source_run:'run',database_updated_at:'2026-10-12',provenance:{monitoring_snapshot_at:'2026-10-16'},rows:[{gawangan:'GT-A-01',database_match:true,pineapple_planting_period:'agustus 2024',pineapple_cohorts:[{period:'2026-08',plantedCount:1029}],pineapple_source_initial:1406.25,pineapple_added_planted:1029,pineapple_living_census:null,seedling_stock:700,mpts:[{species:'RAMBUTAN',source_count:10.8,planting_period:'Jan 2024'}],image_candidates:1}]})}:old(path,config);const dispose=await s.mount(s.options);const text=JSON.stringify(s.host.children);assert.match(text,/Pembanding database/);assert.match(text,/1.406,25/);assert.match(text,/10,8/);assert.match(text,/citra bukan jumlah nanas/);assert.match(text,/Sensus hidup terpublikasi/);dispose();
});

test('dated report is downloadable only through its manifest-listed private file',async()=>{const s=setup(),saved=[];s.result.capture_date='2026-10-13';s.result.analysis_findings=['Detektor belum andal untuk jumlah nanas.'];s.result.analysis_report='analysis-20261013.txt';s.options.manifest.files.push('block-A/analysis-20261013.txt');s.options.save=(blob,name)=>saved.push(name);const dispose=await s.mount(s.options);assert.ok(s.host.children.some(x=>x.textContent.includes('2026-10-13 (keterangan pemilik data)')));await s.find('Unduh laporan analisis').onclick();assert.deepEqual(saved,['analysis-20261013.txt']);assert.ok(s.requests.at(-1).path.endsWith('/files/block-A/analysis-20261013.txt'));dispose();});

test('detail diagnostics reject another source and use only allowlisted staff files',async()=>{
 const s=setup(),old=s.options.api;s.options.manifest.block_details={A:'block-A/detail-analysis.json'};s.options.manifest.files.push('block-A/detail-analysis.json','block-A/detail-gawangan.csv');
 const data={schema:'dayun-block-detail-v1',source_run:'other',block:'A',cell_count:4,review_cell_count:1,zones:[{zone_id:'GT-A-01',polygon_area_m2:10,coverage_fraction:1,vegetation_proxy_fraction:.4,dark_fraction:.1,review_cells:1}],limitations:['No pineapple census inferred.']};
 s.options.api=async(path,config)=>{if(path.endsWith('/detail-analysis.json')){s.requests.push({path,config});return{json:async()=>data}}return old(path,config)};
 const dispose=await s.mount(s.options);await s.find('Analisis detail per gawangan').onclick();assert.match(JSON.stringify(s.host.children),/Sumber analisis detail tidak sesuai/);
 data.source_run='run';await s.find('Analisis detail per gawangan').onclick();assert.match(JSON.stringify(s.host.children),/Sedikit vegetasi bukan bukti nanas mati/);assert.match(JSON.stringify(s.host.children),/40.0%/);
 const panel=s.host.children.find(x=>x.tag==='div');await panel.children.find(x=>x.textContent==='Unduh tabel analisis detail').onclick();assert.ok(s.requests.at(-1).path.endsWith('/files/block-A/detail-gawangan.csv'));assert.ok(s.requests.every(r=>!r.config));dispose();
});

test('enlarged native sample opens privately and its TIFF is still manifest guarded',async()=>{
 const s=setup(),old=s.options.api;s.options.manifest.block_details={A:'block-A/detail-analysis.json'};s.options.manifest.files.push('block-A/detail-analysis.json','block-A/detail/GT-A-01.jpg');
 const data={schema:'dayun-block-detail-v1',source_run:'run',block:'A',cell_count:1,review_cell_count:1,zones:[{zone_id:'GT-A-01',polygon_area_m2:10,coverage_fraction:1,vegetation_proxy_fraction:.2,dark_fraction:0,review_cells:1,sample_sheet:'detail/GT-A-01.jpg'}],samples:[{zone_id:'GT-A-01',stratum:'low',native_tile:'native/not-allowed.tif'}],limitations:[]};
 s.options.api=async(path,config)=>path.endsWith('/detail-analysis.json')?{json:async()=>data}:old(path,config);
 const dispose=await s.mount(s.options);await s.find('Analisis detail per gawangan').onclick();
 const all=node=>[node,...(node.children||[]).flatMap(all)];await all(s.host).find(x=>x.textContent==='Lihat GT-A-01').onclick();const dialog=all(s.host).find(x=>x.tag==='dialog');assert.equal(dialog.open,true);assert.ok(s.requests.at(-1).path.endsWith('/files/block-A/detail/GT-A-01.jpg'));
 await all(dialog).find(x=>x.textContent==='Buka TIFF low').onclick();assert.ok(!s.requests.some(r=>r.path.endsWith('not-allowed.tif')));dispose();assert.equal(s.host.hidden,true);assert.equal(s.host.children.length,0);
});

test('whole block count opens all-block layers and exports full points without review writes',async()=>{
 const s=setup();s.result.full_block_count={processed_tiles:99,candidate_count:2400,threshold:.3,threshold_025_count:3100,threshold_040_count:1500};s.result.candidate_count=2400;s.options.autoOpen=true;let expanded=0;s.options.onAutoOpen=()=>expanded++;
 const saved=[];s.options.save=(blob,name)=>saved.push(name);const dispose=await s.mount(s.options);
 assert.equal(expanded,1);assert.match(JSON.stringify(s.host.children),/Seluruh 99 potongan native selesai/);assert.match(JSON.stringify(s.host.children),/bukan rentang jumlah tanaman/);
 assert.ok(s.requests.some(r=>r.path.endsWith('/candidates.geojson')));await s.find('Unduh seluruh titik hasil Blok A').onclick();assert.deepEqual(saved,['dayun-blok-A-kandidat-seluruh-blok.geojson']);assert.ok(s.requests.every(r=>!r.config));dispose();
});

test('versioned block results reuse only allowlisted original native assets',async()=>{
 const s=setup();s.result.asset_folder='original-A/';s.options.manifest.files.push('original-A/analysis.json','original-A/native/one.tif');s.options.manifest.files=s.options.manifest.files.filter(p=>p!=='block-A/native/one.tif');
 let dispose=await s.mount(s.options);s.find('Periksa citra asli di titik peta').onclick();await s.events.click({latlng:{lng:.5,lat:.5}});assert.ok(s.requests.some(r=>r.path.endsWith('/files/original-A/native/one.tif')));dispose();
 s.result.asset_folder='../unlisted/';await assert.rejects(()=>s.mount(s.options),/Aset citra asli/);
});

test('database comparison is below the map and row edit selects its zone in the private editor',async()=>{
 const s=setup(),old=s.options.api,comparison={children:[],hidden:true,replaceChildren(){this.children=[]},append(...xs){this.children.push(...xs)},scrollIntoView(){}};s.options.comparisonHost=comparison;let expanded=0;s.options.onEditMap=()=>expanded++;
 s.options.manifest.block_comparisons={A:'block-A/database-comparison.json'};s.options.manifest.files.push('block-A/database-comparison.json');s.options.api=async(path,config)=>path.endsWith('database-comparison.json')?{json:async()=>({schema:'dayun-ortho-database-comparison-v1',block:'A',source_run:'run',rows:[{gawangan:'GT-A-01',database_match:true,pineapple_source_initial:1406.25,pineapple_added_planted:10,pineapple_total_recorded:1416.25,image_candidates:2}]})}:old(path,config);
 const dispose=await s.mount(s.options),all=node=>[node,...(node.children||[]).flatMap(all)];assert.match(JSON.stringify(comparison),/Total tercatat awal/);assert.match(JSON.stringify(comparison),/1.416,25/);assert.ok(!JSON.stringify(s.host.children).includes('1.416,25'));await all(comparison).find(x=>x.textContent==='Edit titik GT-A-01').onclick();assert.equal(expanded,1);assert.equal(s.find('Gawangan Blok A'),undefined);assert.ok(s.requests.some(r=>r.path.endsWith('/zones.geojson')));dispose();assert.equal(comparison.hidden,true);assert.equal(comparison.children.length,0);
});

test('owner-calibrated result separates positive recovery, sensitivity and manual examples from count accuracy',async()=>{const s=setup();s.result.full_block_count={processed_tiles:99,candidate_count:20,threshold:.39,threshold_025_count:200,threshold_040_count:18,sensitivity_thresholds:[{threshold:.34,candidate_count:40},{threshold:.39,candidate_count:20}],model_proposals_represented_by_manual:2,sensitive_diagnostic_threshold:.2,sensitive_diagnostic_candidates:300};s.result.model_calibration={label_count:30,label_gawangan:['GT-A-07'],review_revision:4,radii_native_pixels:[14,18,22],suppression_native_pixels:24,metrics:{training:{positive_labels:17},spatial_holdout:{positive_labels:7,baseline_matched_within_12px:0,calibrated_matched_within_12px:3,sensitive_matched_within_12px:6},guard_unused:{positive_labels:6}}};s.result.previous_automatic_candidate_count=10;const dispose=await s.mount(s.options),text=JSON.stringify(s.host.children);assert.match(text,/Detektor dari koreksi tim/);assert.match(text,/hasil utama 3\/7/);assert.match(text,/bukan akurasi jumlah/);assert.match(text,/Kenaikan kandidat bukan bukti kenaikan jumlah nanas/);assert.match(text,/tidak dipakai sebagai lapisan utama/);assert.match(text,/ambang 0.34: 40/);assert.ok(!s.requests.some(r=>r.config));dispose();});


test('direct marker selection opens detail without writes; rejected points hide and can be restored to view',async()=>{
 const s=setup(),old=s.options.api;let picks=0,expanded=0;s.options.onEditMap=()=>expanded++;
 s.context.window.YG_DAYUN_BLOCK_EDIT={mount:async()=>({features:()=>[{geometry:{coordinates:[.5,.5]},properties:{id:'auto',status:'candidate',zones:[]}},{geometry:{coordinates:[.4,.4]},properties:{id:'bad',status:'rejected',zones:[]}}],pick:async()=>picks++,refresh(){},dispose(){}})};
 s.options.api=async(path,c)=>path.endsWith('candidates.geojson')?{json:async()=>({features:[]})}:old(path,c);
 const dispose=await s.mount(s.options);await s.find('Buka seluruh Blok A').onclick();assert.equal(s.layers.length,1);assert.equal(s.overlays[0].pane,'dayun-overview');assert.equal(s.layers[0].opts.bubblingMouseEvents,false);await s.layers[0].handlers.click();assert.equal(picks,1);assert.equal(expanded,1);assert.ok(s.requests.every(r=>!r.config));
 const label=s.host.children.find(x=>x.children?.some(y=>y.textContent===' Tampilkan titik yang ditolak')),check=label.children[0];check.checked=true;check.onchange();assert.ok(s.layers.some(x=>x.opts.color==='#c72d40'));dispose();
});

test('same native crop is reused and failed opening never establishes a usable native extent',async()=>{
 const s=setup();let opens=0,zoom=0;s.options.map.setView=(xy,z)=>zoom=z;s.options.openRaster=async()=>{opens++;return true};const dispose=await s.mount(s.options);
 for(let i=0;i<2;i++){s.find('Periksa citra asli di titik peta').onclick();await s.events.click({latlng:{lng:.5,lat:.5}});}
 assert.equal(opens,1);assert.equal(s.requests.filter(x=>x.path.endsWith('.tif')).length,1);assert.equal(zoom,24);dispose();
 const failed=setup();let attempts=0;failed.options.openRaster=async()=>{attempts++;return false};const stop=await failed.mount(failed.options);
 for(let i=0;i<2;i++){failed.find('Periksa citra asli di titik peta').onclick();await failed.events.click({latlng:{lng:.5,lat:.5}});}
 assert.equal(attempts,2);assert.equal(failed.requests.filter(x=>x.path.endsWith('.tif')).length,1);assert.match(JSON.stringify(failed.host.children),/TIFF asli gagal dibuka/);stop();
});

test('adding a point waits for native pixels rather than accepting the underlying JPEG preview',async()=>{
 const s=setup();let edit,source;s.context.window.YG_DAYUN_BLOCK_EDIT={mount:async opts=>(edit=opts,{dispose(){}})};s.options.getRasterSource=()=>source;s.options.openRaster=async(blob,opts)=>{source={title:opts.title,ready:false};return true};const dispose=await s.mount(s.options);
 assert.equal(await edit.preparePoint([.5,.5]),false);await assert.rejects(()=>edit.preparePoint([.5,.5]),/masih dimuat/);source.ready=true;assert.equal(await edit.preparePoint([.5,.5]),true);dispose();
});


function viewportFixture({maxRetained=2,concurrency=2,open}={}){
 const s=setup();let box=[0,0,2,1],zoom=24;const messages=[],opened=[];
 const tiles=[0,1,2,3].map(x=>({file:'native/'+x+'.tif',bounds:[x,0,x+1,1]}));
 const map={getZoom:()=>zoom,getCenter:()=>({lng:(box[0]+box[2])/2,lat:.5}),getBounds:()=>({getWest:()=>box[0],getEast:()=>box[2],getSouth:()=>box[1],getNorth:()=>box[3]})};
 const create=s.context.window.YG_DAYUN_BLOCK.createNativeViewport;
 const engine=create({map,tiles,maxRetained,concurrency,current:()=>true,onStatus:m=>messages.push(m),open:async(tile,changed,signal)=>{const h={ready:false,disposed:false,dispose(){this.disposed=true}};opened.push({tile,h,changed,signal});return open?open(tile,changed,signal,h):h;}});
 return{engine,opened,messages,pan:b=>box=b,zoom:z=>zoom=z,settle:()=>new Promise(r=>setImmediate(r))};
}

test('all intersecting native crops load together; panning retains neighbours, reuses pixels and bounds cache memory',async()=>{
 const s=viewportFixture();s.engine.refresh();await s.settle();assert.equal(s.opened.length,2);assert.equal(s.engine.readyAt([.5,.5]),false);
 for(const o of s.opened){o.h.ready=true;o.changed();}assert.equal(s.engine.readyAt([.5,.5]),true);assert.equal(s.engine.readyAt([1.5,.5]),true);assert.match(s.messages.at(-1),/2\/2/);
 s.pan([1,0,3,1]);s.engine.refresh();await s.settle();assert.equal(s.opened.length,3);assert.equal(s.opened[0].h.disposed,true);assert.equal(s.opened[1].h.disposed,false);s.engine.refresh();await s.settle();assert.equal(s.opened.length,3);s.engine.dispose();assert.ok(s.opened.every(o=>o.h.disposed));
});

test('quick pans cancel stale work, cap concurrent reads, and never attach a late crop after disposal',async()=>{
 const pending=[];const s=viewportFixture({concurrency:1,open:(t,c,signal,h)=>new Promise(resolve=>pending.push(()=>resolve(h)))});
 s.engine.refresh();await s.settle();assert.equal(s.opened.length,1);s.pan([2,0,4,1]);s.engine.refresh();assert.equal(s.opened[0].signal.aborted,true);pending.shift()();await s.settle();assert.equal(s.opened[0].h.disposed,true);assert.equal(s.opened.length,2);s.engine.dispose();pending.shift()();await s.settle();assert.ok(s.opened.every(o=>o.h.disposed));assert.equal(s.engine.readyAt([2.5,.5]),false);
});

test('native read failures stay unready and explicit inspection retries only the failed crop',async()=>{
 let fail=true;const s=viewportFixture({open:async(t,c,signal,h)=>{if(t.file==='native/0.tif'&&fail)throw Error('offline');return h;}});
 s.engine.refresh();await s.settle();assert.match(s.messages.at(-1),/gagal/);assert.equal(s.engine.readyAt([.5,.5]),false);fail=false;const h=await s.engine.ensure([.5,.5]);assert.equal(s.opened.length,3);h.ready=true;s.opened.at(-1).changed();assert.equal(s.engine.readyAt([.5,.5]),true);s.zoom(18);s.engine.refresh();assert.ok(s.opened.slice(1).every(o=>o.h.disposed));assert.match(s.messages.at(-1),/pratinjau/);s.engine.dispose();
});


test('suspending native imagery cancels queued requests before another raster can be overwritten',async()=>{
 const s=viewportFixture({concurrency:1});s.engine.refresh();s.engine.suspend();await s.settle();assert.equal(s.opened.length,0);assert.equal(s.engine.readyAt([.5,.5]),false);s.engine.dispose();
});


test('Blok B opens its own analysis, private native assets and database reference without reading Blok A',async()=>{
 const s=setup();s.options.block='B';s.result.block='B';s.result.zones=[{id:'GT-B-01',kind:'active_source',candidate_crowns:2}];s.result.model_calibration={transferred_from_block:'A'};s.options.manifest.block_analyses={B:'block-B/analysis.json'};s.options.manifest.files=s.options.manifest.files.map(f=>f.replace('block-A/','block-B/'));s.options.manifest.block_comparisons={B:'block-B/database-comparison.json'};s.options.manifest.files.push('block-B/database-comparison.json');const old=s.options.api;s.options.api=async(path,config)=>path.endsWith('database-comparison.json')?{json:async()=>({schema:'dayun-ortho-database-comparison-v1',block:'B',source_run:'run',rows:[{gawangan:'GT-B-01',image_candidates:2}]})}:old(path,config);
 const dispose=await s.mount(s.options);assert.ok(s.find('Buka seluruh Blok B'));await s.find('Buka seluruh Blok B').onclick();assert.ok(s.requests.every(r=>r.path.includes('/files/block-B/')&&!r.config));assert.match(JSON.stringify(s.host.children),/Akurasi pada Blok B belum diukur/);assert.match(JSON.stringify(s.host.children),/Pembanding database per gawangan/);dispose();
});


test('Blok C opens its own analysis, private native assets and database reference without reading Blok A',async()=>{
 const s=setup();s.options.block='C';s.result.block='C';s.result.zones=[{id:'GT-C-01',kind:'active_source',candidate_crowns:2}];s.result.model_calibration={transferred_from_block:'A'};s.options.manifest.block_analyses={C:'block-C/analysis.json'};s.options.manifest.files=s.options.manifest.files.map(f=>f.replace('block-A/','block-C/'));s.options.manifest.block_comparisons={C:'block-C/database-comparison.json'};s.options.manifest.files.push('block-C/database-comparison.json');const old=s.options.api;s.options.api=async(path,config)=>path.endsWith('database-comparison.json')?{json:async()=>({schema:'dayun-ortho-database-comparison-v1',block:'C',source_run:'run',rows:[{gawangan:'GT-C-01',image_candidates:2}]})}:old(path,config);
 const dispose=await s.mount(s.options);assert.ok(s.find('Buka seluruh Blok C'));await s.find('Buka seluruh Blok C').onclick();assert.ok(s.requests.every(r=>r.path.includes('/files/block-C/')&&!r.config));assert.match(JSON.stringify(s.host.children),/Akurasi pada Blok C belum diukur/);assert.match(JSON.stringify(s.host.children),/Pembanding database per gawangan/);dispose();
});

test('clean display filters staff acceptance without changing baseline points or saving decisions',async()=>{
 const s=setup();let attrs=new Map();const oldCreate=s.context.document.createElement;s.context.document.createElement=tag=>{const n=oldCreate(tag);n.setAttribute=(key,value)=>attrs.set(value,n);return n};
 const features=[['auto-unreviewed','candidate'],['manual-accepted','accepted'],['auto-rejected','rejected']].map(([id,status],i)=>({type:'Feature',geometry:{type:'Point',coordinates:[.2+i*.1,.5]},properties:{id,status,zones:['GT-A-01'],origin:id==='manual-accepted'?'manual_addition':'automated'}}));
 const before=JSON.stringify(features),api=s.options.api;s.options.api=async(path,config)=>path.endsWith('candidates.geojson')?{json:async()=>({features})}:api(path,config);
 let editMode;s.context.window.YG_DAYUN_BLOCK_EDIT={mount:async()=>({features:()=>features,refresh(){},dispose(){},setEditing:value=>editMode=value})};
 const dispose=await s.mount(s.options);await s.find('Buka seluruh Blok A').onclick();const mode=attrs.get('Titik yang ditampilkan');assert.ok(mode);assert.equal(s.layers.length,2);assert.ok(s.layers.every(l=>l.opts.radius===4&&l.opts.fillOpacity===0));
 mode.value='accepted';mode.onchange();assert.equal(s.layers.length,3);assert.equal(s.layers.at(-1).opts.color,'#2563eb');assert.match(JSON.stringify(s.host.children),/1 titik diterima tim/);
 mode.value='imagery';mode.onchange();assert.equal(editMode,false);assert.equal(s.layers.length,3);assert.match(JSON.stringify(s.host.children),/tanpa menghapus hasil/);
 assert.equal(JSON.stringify(features),before);assert.ok(s.requests.every(r=>!r.config));dispose();
});

test('clean overview avoids a carpet of candidates and an empty accepted view is explicitly not plant absence',async()=>{
 const s=setup();let mode;const create=s.context.document.createElement;s.context.document.createElement=tag=>{const n=create(tag);n.setAttribute=(key,value)=>{if(value==='Titik yang ditampilkan')mode=n};return n};
 const api=s.options.api;s.options.api=async(path,config)=>path.endsWith('candidates.geojson')?{json:async()=>({features:[{geometry:{coordinates:[.5,.5]},properties:{id:'auto',status:'candidate',zones:['GT-A-01']}}]})}:api(path,config);
 s.options.map.getZoom=()=>19;const dispose=await s.mount(s.options);await s.find('Buka seluruh Blok A').onclick();assert.equal(s.layers.length,0);mode.value='accepted';mode.onchange();assert.match(JSON.stringify(s.host.children),/bukan berarti tidak ada nanas/);assert.equal(s.layers.length,0);
 mode.value='all';s.options.map.getZoom=()=>24;mode.onchange();assert.equal(s.layers.length,1);assert.ok(s.requests.every(r=>!r.config));dispose();
});

test('private geometry trial keeps local holdout findings separate from whole-block species accuracy',async()=>{
 const s=setup(),path='detector-test/quality-trial.json';s.options.manifest.detector_quality_report=path;s.options.manifest.files.push(path,'detector-test/quality-holdout-preview.png');const api=s.options.api;
 const q={schema:'dayun-quality-trial-v1',source_run:'run',block:'A',production_species_validated:false,review_revision:13,preview:'quality-holdout-preview.png',metrics:{spatial_holdout_positive:{labels:7,baseline_proposed:3,sensitive_without_angular:6,angular_proposed:6},spatial_holdout_rejected_centres:{labels:2,baseline_proposed:2,angular_proposed:1}}};
 s.options.api=async(p,config)=>p.endsWith(path)?{json:async()=>q}:api(p,config);const dispose=await s.mount(s.options);const text=JSON.stringify(s.host.children);assert.match(text,/belum mengukur akurasi seluruh A/);assert.match(text,/Titik ditolak bukan otomatis/);const all=n=>[n,...(n.children||[]).flatMap(all)];await all(s.host).find(n=>n.textContent==='Lihat citra uji terpisah').onclick();assert.ok(s.requests.some(r=>r.path.endsWith('detector-test/quality-holdout-preview.png')));assert.ok(s.requests.every(r=>!r.config));dispose();
 q.source_run='other';const stop=await s.mount(s.options);assert.match(JSON.stringify(s.host.children),/Identitas uji detektor tidak sesuai/);stop();
});
