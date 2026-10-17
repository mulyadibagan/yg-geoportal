const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('js/dayun-block-review.js','utf8');
function setup(){
 const element=tag=>({tag,children:[],value:'',hidden:true,textContent:'',append(...x){this.children.push(...x)},replaceChildren(...x){this.children=x},add(x){this.children.push(x)},setAttribute(){},showModal(){this.open=true},close(){this.open=false}});
 const host=element('section'),requests=[],events={},layers=[];
 const layer={addTo(){return this},clearLayers(){},bindTooltip(){return this},on(){return this},getBounds(){return[[0,0],[1,1]]},getLayers(){return[]}};
 const context={window:{},document:{createElement:element},Option:function(text,value){return{text,value}},L:{layerGroup:()=>({...layer}),imageOverlay:()=>layer,geoJSON:()=>layer,featureGroup:()=>layer,circleMarker:()=>{layers.push(1);return layer}},URL:{createObjectURL:()=> 'blob:private',revokeObjectURL(){}},Promise};vm.runInNewContext(code,context);
 const result={schema:'dayun-block-analysis-v1',block:'A',source_run:'run',overview:'overview.jpg',bounds:[0,0,1,1],candidate_count:2,boundary_conflict_candidate_count:0,boundary_overlap_count:0,zones:[{id:'GT-A-01',kind:'active_source',candidate_crowns:2,boundary_conflict_candidates:0}],native_tiles:[{file:'native/one.tif',bounds:[0,0,1,1]}]};
 const options={host,map:{on(k,v){events[k]=v},off(k){delete events[k]},removeLayer(){},getZoom:()=>24,getBounds:()=>({contains:()=>true}),fitBounds(){}},manifest:{run:'run',block_analyses:{A:'block-A/analysis.json'},files:['analysis.json','zones.geojson','candidates.geojson','boundary-audit.geojson','overview.jpg','gawangan.csv','native/one.tif'].map(f=>'block-A/'+f)},base:'/api/staff/drone/analysis/Agro_ABC',api:async(path,config)=>{requests.push({path,config});return{json:async()=>path.endsWith('analysis.json')?result:{type:'FeatureCollection',features:[]},blob:async()=>new Blob(['image'])}},openRaster:async()=>{},save(){},current:()=>true};
 return{mount:context.window.YG_DAYUN_BLOCK.mount,options,host,requests,events,result,find:text=>host.children.find(x=>x.textContent===text)};
}
test('block analysis uses only manifest-listed private read endpoints and cleans up',async()=>{
 const s=setup(),dispose=await s.mount(s.options);assert.equal(s.host.hidden,false);assert.ok(s.host.children.some(x=>x.textContent.includes('Bukan jumlah nanas')));await s.find('Buka seluruh Blok A').onclick();assert.ok(s.requests.every(r=>r.path.startsWith('/api/staff/drone/analysis/Agro_ABC/files/block-A/')&&!r.config));s.find('Periksa citra asli di titik peta').onclick();await s.events.click({latlng:{lng:.5,lat:.5}});assert.ok(s.requests.some(r=>r.path.endsWith('/native/one.tif')));dispose();assert.equal(s.host.hidden,true);assert.equal(s.events.click,undefined);
});
test('missing block analysis is skipped and wrong source run is refused before map access',async()=>{
 const s=setup();s.options.manifest.block_analyses={};await s.mount(s.options);assert.equal(s.requests.length,0);s.options.manifest.block_analyses={A:'block-A/analysis.json'};s.result.source_run='other';await assert.rejects(()=>s.mount(s.options),/tidak sesuai/);assert.equal(s.host.hidden,true);
});
test('an unlisted native tile cannot be requested',async()=>{
 const s=setup(),dispose=await s.mount(s.options);s.options.manifest.files=s.options.manifest.files.filter(p=>!p.endsWith('.tif'));s.find('Periksa citra asli di titik peta').onclick();await s.events.click({latlng:{lng:.5,lat:.5}});assert.ok(!s.requests.some(r=>r.path.endsWith('.tif')));assert.ok(s.host.children.at(-1).textContent.includes('belum tersedia'));dispose();
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
 const all=node=>[node,...node.children.flatMap(all)];await all(s.host).find(x=>x.textContent==='Lihat GT-A-01').onclick();const dialog=all(s.host).find(x=>x.tag==='dialog');assert.equal(dialog.open,true);assert.ok(s.requests.at(-1).path.endsWith('/files/block-A/detail/GT-A-01.jpg'));
 await all(dialog).find(x=>x.textContent==='Buka TIFF low').onclick();assert.ok(!s.requests.some(r=>r.path.endsWith('not-allowed.tif')));dispose();assert.equal(s.host.hidden,true);assert.equal(s.host.children.length,0);
});
