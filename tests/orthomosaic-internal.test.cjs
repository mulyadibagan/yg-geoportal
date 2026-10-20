const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const code=fs.readFileSync('js/orthomosaic-internal.js','utf8');
function setup({session=null,status=200,search='',fetcher,candidateMount,privateAssets=false}={}){
 const timers=[],elements=new Map(),calls=[],layers=[],instances=[],removed=[];
 const el=id=>{if(!elements.has(id))elements.set(id,{hidden:id==='workspace',value:id==='opacity'?'1':'',disabled:false,textContent:'',children:[],replaceChildren(...children){this.children=children},append(x){this.children.push(x)},add(x){this.children.push(x)}});return elements.get(id)};
 const map={createPane(){return{style:{}}},setView(){return this},addControl(){},on(){},fitBounds(){},remove(){},removeLayer(layer){removed.push(layer)}};
 const job={id:'drn-test',title:'Test RGB',status:'ready',cogKey:'private.tif'};
 const image={getGeoKeys:()=>({ProjectedCSTypeGeoKey:32648}),getFileDirectory:()=>({PhotometricInterpretation:2,BitsPerSample:[8,8,8]}),getSamplesPerPixel:()=>3,getBoundingBox:()=>[0,0,100,100],getResolution:()=>[1,-1],getGDALNoData:()=>null,getWidth:()=>100,getHeight:()=>100,readRasters:async options=>{calls.push({reader:'native-image',rasterOptions:options});return [new Uint8Array([4,5,6,7]),new Uint8Array(4),new Uint8Array(4)]}};
 const tiff={getImage:async()=>image,readRasters:async options=>{calls.push({reader:'automatic-overview',rasterOptions:options});return [new Uint8Array([4,5,6,7]),new Uint8Array(4),new Uint8Array(4)]}};
 const context={document:{getElementById:el,createElement:()=>({children:[],append(...x){this.children.push(...x)},add(x){this.children.push(x)},click(){}})},window:{location:{search},YG_DAYUN_CANDIDATES:candidateMount?{mount:candidateMount}:undefined,YG_AUTH:{readStoredSession:()=>session},addEventListener(){}},Option:function(text,value){return{text,value}},L:{map:()=>map,tileLayer:()=>({addTo(){return this}}),featureGroup:()=>({addTo(){return this},getLayers:()=>[]}),Control:{Draw:function(){}},Draw:{Event:{CREATED:'created'}}},GeoTIFF:{fromUrl:async(url,options)=>{calls.push({url,options});return tiff}},GeoRasterLayer:function(options){layers.push(options);const layer={options:{updateWhenZooming:true,updateWhenIdle:false,keepBuffer:16},handlers:{},on(k,fn){this.handlers[k]=fn},addTo(){this.handlers.loading?.()},setOpacity(value){this.opacity=value},getBounds:()=>[[0,0],[1,1]]};instances.push(layer);return layer},turf:{},fetch:async(url,options)=>{calls.push({url,options});if(fetcher)return fetcher(url,options);return{status,ok:status===200,json:async()=>({jobs:[job]})}},Headers,AbortController,AbortSignal,Blob,URL,URLSearchParams,Date,setTimeout,clearTimeout,setInterval(fn,ms){timers.push({fn,ms});},confirm:()=>true};
 if(privateAssets)context.window.YG_PRIVATE_R2={create:options=>require('../js/private-r2-assets.js').create({...options,fetcher:(...args)=>context.fetch(...args)})};
 Object.assign(context.window,{L:context.L,GeoTIFF:context.GeoTIFF,GeoRasterLayer:context.GeoRasterLayer,turf:context.turf});
 vm.runInNewContext(code,context);
 return {timers,el,calls,layers,instances,removed,image,context,map,settle:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('anonymous visitor cannot initialize map or request private catalogue',async()=>{const s=setup();await s.settle();assert.equal(s.el('workspace').hidden,true);assert.equal(s.calls.length,0);assert.match(s.el('gateStatus').textContent,/Masuk sebagai staf/)});

test('Dayun viewer routes manifest assets directly to private R2 while staff APIs keep bearer authentication',async()=>{
 const direct=[],worker=[];const files=['metadata.json','D1/sample.tif'];
 const s=setup({privateAssets:true,session:{token:'staff',expiresAt:Date.now()+100000},fetcher:async(url,options)=>{
  if(url.includes('.r2.cloudflarestorage.com/')){direct.push({url,options});assert.equal(options.headers.has('authorization'),false);return new Response(JSON.stringify({gawangan:[]}));}
  worker.push(url);assert.equal(options.headers.Authorization,'Bearer staff');
  const data=url.endsWith('/asset-links')?{ok:true,links:JSON.parse(options.body).files.map(file=>({file,url:'https://'+'a'.repeat(32)+'.r2.cloudflarestorage.com/private/'+file+'?X-Amz-Signature=test',expiresAt:Date.now()+300000}))}:url.endsWith('/analysis/Agro_DEF')?{assetDelivery:'r2-signed-v1',run:'run',download:{ok:true},analysis:{ok:true},files}:{jobs:[]};return{ok:true,status:200,json:async()=>data};
 }});await s.settle();s.el('dayunSource').value='Agro_DEF';await s.el('openDayun').onclick();
 assert.equal(direct.length,1);assert.ok(direct[0].url.includes('metadata.json'));assert.equal(worker.filter(url=>url.endsWith('/asset-links')).length,1);assert.ok(worker.every(url=>!url.includes('/files/')));
});

test('sample link preserves its local login return and never bypasses staff authorization',async()=>{
 const search='?source=Agro_ABC&trial=block-A-radial-v1&sample=ABC-A01-R01&point=ABC-A01-R01-x121-y115';
 const s=setup({search});await s.settle();assert.equal(s.calls.length,0);const target=new URLSearchParams(s.el('sampleLogin').href.split('?')[1]).get('return');assert.equal(target,'orthomosaic-internal.html'+search);
 const denied=setup({search,session:{token:'forged',expiresAt:Date.now()+10000},status:401});await denied.settle();assert.ok(!denied.calls.some(c=>c.url.includes('/analysis/')));
});

test('authorized sample link forwards only validated IDs to the private read-only viewer',async()=>{
 const mounted=[];const s=setup({search:'?source=Agro_ABC&trial=block-A-radial-v1&sample=ABC-A01-R01',session:{token:'staff',expiresAt:Date.now()+10000},candidateMount:async options=>{mounted.push(options);return()=>{}},fetcher:async url=>({ok:true,status:200,json:async()=>url.endsWith('/analysis/Agro_ABC')?{download:{ok:true},analysis:{ok:true},files:['metadata.json']}:url.endsWith('metadata.json')?{gawangan:[]}:{jobs:[]}})});
 await s.settle();assert.equal(mounted.length,1);assert.equal(mounted[0].initialTrial,'block-A-radial-v1');assert.equal(mounted[0].initialSample,'ABC-A01-R01');assert.equal(mounted[0].autoOpen,true);assert.ok(s.calls.every(c=>!c.options.method));
 const invalid=setup({search:'?source=Agro_ABC&trial=../../secrets&sample=ABC-A01-R01',session:{token:'staff',expiresAt:Date.now()+10000}});await invalid.settle();assert.ok(!invalid.calls.some(c=>c.url.endsWith('/analysis/Agro_ABC')));
});

test('whole Blok A link opens block results rather than a sample and remains staff gated',async()=>{
 const anon=setup({search:'?source=Agro_ABC&block=A'});await anon.settle();assert.equal(anon.calls.length,0);assert.match(decodeURIComponent(anon.el('sampleLogin').href),/source=Agro_ABC&block=A/);
 let opened;const s=setup({search:'?source=Agro_ABC&block=A',session:{token:'staff',expiresAt:Date.now()+10000},fetcher:async url=>({ok:true,status:200,json:async()=>url.endsWith('/analysis/Agro_ABC')?{download:{ok:true},analysis:{ok:true},files:['metadata.json']}:url.endsWith('metadata.json')?{gawangan:[]}:{jobs:[]}})});
 s.context.window.YG_DAYUN_BLOCK={mount:async options=>{opened=options;return()=>{}}};await s.settle();assert.equal(opened.autoOpen,true);assert.ok(s.calls.every(c=>!c.options.method));
});
test('server rejection keeps internal workspace locked even with a stored session',async()=>{const s=setup({session:{token:'forged',expiresAt:Date.now()+10000},status:401});await s.settle();assert.equal(s.el('workspace').hidden,true);assert.match(s.el('gateStatus').textContent,/Akses ditolak/)});

test('Dayun shows failed download as blocked and sends staff bearer header',async()=>{
 const s=setup({session:{token:'staff',expiresAt:Date.now()+10000}});await s.settle();
 s.context.fetch=async(url,options)=>{assert.ok(url.endsWith('/analysis/Agro_ABC'));assert.equal(options.headers.Authorization,'Bearer staff');return{ok:true,status:200,json:async()=>({download:{ok:false,error:'drive_credentials_missing'}})}};
 s.el('dayunSource').value='Agro_ABC';await s.el('openDayun').onclick();
 assert.match(s.el('dayunStatus').textContent,/Belum diunduh.*drive_credentials_missing/);assert.equal(s.el('dayunResults').children.length,0);
});

test('Dayun does not treat a partial inspector output as completed coverage',async()=>{
 const s=setup({session:{token:'staff',expiresAt:Date.now()+10000}});await s.settle();
 s.context.fetch=async()=>({ok:true,status:200,json:async()=>({download:{ok:true},analysis:{ok:false},files:['metadata.json']})});
 s.el('dayunSource').value='Agro_DEF';await s.el('openDayun').onclick();assert.match(s.el('dayunStatus').textContent,/belum lengkap/);
});

test('staff can paste a Drive link; queued is not displayed as completed analysis',async()=>{
 const s=setup({session:{token:'staff',expiresAt:Date.now()+10000}});await s.settle();const calls=[];
 s.context.fetch=async(url,options)=>{calls.push({url,options});return{ok:true,status:200,json:async()=>options.method==='POST'?{job:{label:'Agro_ABC'},reused:false}:{jobs:[{label:'Agro_ABC',status:'pending'}]}}};
 s.el('dayunDriveUrl').value='https://drive.google.com/file/d/11kWmzkdTWVuxrDJMOYk3JfN34xeoZNRx/view';await s.el('submitDayun').onclick();
 const call=calls.find(c=>c.options.method==='POST');assert.equal(call.options.headers.Authorization,'Bearer staff');assert.equal(JSON.parse(call.options.body).driveUrl,s.el('dayunDriveUrl').value);assert.match(s.el('dayunQueueStatus').textContent,/masuk antrean.*belum selesai/);assert.equal(s.el('submitDayun').disabled,false);
});
test('authorized COG uses bearer header, lazy reads, preserves valid dark pixels',async()=>{const s=setup({session:{token:'test-token',expiresAt:Date.now()+10000}});await s.settle();assert.equal(s.el('workspace').hidden,false);s.el('job').value='drn-test';s.el('openJob').onclick();await s.settle();assert.equal(s.layers.length,1);const request=s.calls.find(c=>c.url.endsWith('/cog'));assert.equal(request.options.headers.Authorization,'Bearer test-token');assert.ok(!request.url.includes('test-token'));assert.equal(request.options.allowFullFile,false);const layer=s.layers[0];assert.equal(layer.pane,'ortho-imagery');assert.equal(layer.resolution,256);assert.equal(s.instances[0].options.keepBuffer,1);assert.equal(layer.pixelValuesToColorFn([0,0,0]),'rgb(0,0,0)');assert.equal(layer.pixelValuesToColorFn([5,5,5]),'rgb(5,5,5)');const bands=await layer.georaster.getValues({left:0,top:0,right:2,bottom:2,width:2,height:2});assert.deepEqual(Array.from(bands[0][1]),[6,7]);assert.equal(s.el('downloadTiff').disabled,false)});

test('staff opens a manifest-listed native crop through the private API without a public image URL',async()=>{
 const s=setup({session:{token:'staff',expiresAt:Date.now()+10000}});await s.settle();
 s.context.document.createElement=tag=>({tag,children:[],value:'',append(...items){this.children.push(...items)},add(option){this.children.push(option)},click(){}});
 let opened=false;const privateCalls=[];
 s.context.GeoTIFF.fromBlob=async blob=>{assert.ok(blob instanceof Blob);opened=true;return{getImage:async()=>s.image}};
 s.context.fetch=async(url,options)=>{
   privateCalls.push(url);assert.equal(options.headers.Authorization,'Bearer staff');assert.ok(url.startsWith('https://webgis-api.yayasangambut.org/api/staff/drone/analysis/Agro_DEF'));
   return{ok:true,status:200,json:async()=>url.endsWith('metadata.json')?{crs:'EPSG:32648',gsd_m:[.02,.02],gawangan:[]}:{download:{ok:true},analysis:{ok:true},files:['metadata.json','D1/sample.tif']},blob:async()=>new Blob(['native crop'])};
 };
 s.el('dayunSource').value='Agro_DEF';await s.el('openDayun').onclick();
 const controls=s.el('dayunResults').children;
 controls.find(el=>el.tag==='select').value='D1/sample.tif';
 await controls.find(el=>el.textContent==='Buka potongan terpilih di peta').onclick();
 assert.ok(opened);assert.equal(s.layers.length,1);assert.ok(privateCalls.some(url=>url.endsWith('/files/D1/sample.tif')));assert.match(s.el('dayunStatus').textContent,/jumlah nanas masih memerlukan/);
});


test('concurrent native crops retain independent rendering, authenticated range clients and cancellation',async()=>{
 let mounted;const s=setup({search:'?source=Agro_ABC&block=A',session:{token:'staff',expiresAt:Date.now()+10000},fetcher:async url=>({ok:true,status:200,json:async()=>url.endsWith('/analysis/Agro_ABC')?{download:{ok:true},analysis:{ok:true},files:['metadata.json']}:url.endsWith('metadata.json')?{gawangan:[]}:{jobs:[]}})});
 s.context.window.YG_DAYUN_BLOCK={mount:async options=>{mounted=options;return()=>{}}};await s.settle();assert.ok(mounted.openNativeRaster);
 const opts={title:'native',onState(){}};const [a,b]=await Promise.all([mounted.openNativeRaster('/api/staff/drone/analysis/Agro_ABC/files/a.tif',opts),mounted.openNativeRaster('/api/staff/drone/analysis/Agro_ABC/files/b.tif',opts)]);
 assert.equal(s.instances.length,2);assert.equal(s.removed.length,0);assert.equal(a.ready,false);for(const layer of s.instances){assert.equal(layer.options.keepBuffer,1);assert.equal(layer.options.minZoom,22);assert.equal(layer.options.updateWhenIdle,true);assert.equal(layer.options.updateWhenZooming,false);}await s.layers[0].georaster.getValues({left:20,top:30,right:22,bottom:32,width:2,height:2});const read=s.calls.find(c=>c.reader==='native-image');assert.ok(read);assert.deepEqual(Array.from(read.rasterOptions.window),[20,30,22,32]);assert.equal(read.rasterOptions.resampleMethod,'nearest');assert.ok(!s.calls.some(c=>c.reader==='automatic-overview'));s.instances[0].handlers.load();assert.equal(a.ready,true);assert.equal(b.ready,false);s.instances[1].handlers.tileerror();s.instances[1].handlers.load();assert.equal(b.ready,false);assert.ok(b.error);
 const calls=s.calls.filter(c=>c.url?.endsWith('.tif'));assert.equal(calls.length,2);for(const c of calls){assert.equal(c.options.headers.Authorization,'Bearer staff');assert.equal(c.options.allowFullFile,false);assert.ok(!c.url.includes('Bearer'));}assert.ok(s.layers.every(o=>o.pane==='ortho-imagery'&&o.resolution===256));
 a.dispose();assert.equal(s.removed.length,1);assert.equal(b.disposed,false);s.el('opacity').value='.5';s.el('opacity').oninput();assert.equal(s.instances[1].opacity,.5);
 s.el('dayunSource').value='Agro_ABC';await s.el('openDayun').onclick();assert.equal(b.disposed,true);assert.equal(s.removed.length,2);
});


test('Blok B link selects its block and passes that identity to the existing private viewer',async()=>{
 let mounted;const s=setup({search:'?source=Agro_ABC&block=B',session:{token:'staff',expiresAt:Date.now()+10000},fetcher:async url=>({ok:true,status:200,json:async()=>url.endsWith('/analysis/Agro_ABC')?{download:{ok:true},analysis:{ok:true},files:['metadata.json']}:url.endsWith('metadata.json')?{gawangan:[]}:{jobs:[]}})});s.context.window.YG_DAYUN_BLOCK={mount:async opts=>(mounted=opts,()=>{})};await s.settle();assert.equal(s.el('dayunBlock').value,'B');assert.equal(mounted.block,'B');assert.equal(mounted.autoOpen,true);assert.ok(s.calls.every(c=>!c.options.method));
});

test('stalled native rendering reports timeout for viewport recovery and ready crops cancel the deadline',async()=>{
 let mounted;const timers=new Map();let id=0;const s=setup({search:'?source=Agro_ABC&block=A',session:{token:'staff',expiresAt:Date.now()+10000},fetcher:async url=>({ok:true,status:200,json:async()=>url.endsWith('/analysis/Agro_ABC')?{download:{ok:true},analysis:{ok:true},files:['metadata.json']}:url.endsWith('metadata.json')?{gawangan:[]}:{jobs:[]}})});
 s.context.window.YG_DAYUN_BLOCK={mount:async options=>(mounted=options,()=>{})};await s.settle();s.context.setTimeout=fn=>{timers.set(++id,fn);return id};s.context.clearTimeout=k=>timers.delete(k);
 let reported;const a=await mounted.openNativeRaster('/api/staff/drone/analysis/Agro_ABC/files/a.tif',{title:'native',onState:x=>reported=x.error});assert.equal(timers.size,1);const callback=[...timers.values()][0];timers.clear();callback();assert.match(reported,/batas waktu/);assert.equal(a.ready,false);a.dispose();
 const b=await mounted.openNativeRaster('/api/staff/drone/analysis/Agro_ABC/files/b.tif',{title:'native'});s.instances[1].handlers.load();assert.equal(b.ready,true);assert.equal(timers.size,0);b.dispose();
});


test('unsaved block decisions prevent switching blocks and retain the displayed block',async()=>{
 const s=setup({search:'?source=Agro_ABC&block=A',session:{token:'staff',expiresAt:Date.now()+10000},fetcher:async url=>({ok:true,status:200,json:async()=>url.endsWith('/analysis/Agro_ABC')?{download:{ok:true},analysis:{ok:true},files:['metadata.json']}:url.endsWith('metadata.json')?{gawangan:[]}:{jobs:[]}})});let disposed=0;s.context.window.YG_DAYUN_BLOCK={mount:async()=>{const d=()=>disposed++;d.canLeave=()=>false;return d}};await s.settle();const reads=s.calls.length;s.el('dayunBlock').value='B';s.el('dayunBlock').onchange();assert.equal(s.el('dayunBlock').value,'A');assert.equal(s.calls.length,reads);assert.equal(disposed,0);assert.match(s.el('dayunStatus').textContent,/Simpan atau ekspor/);
});


test('Blok C link selects its block and passes that identity to the existing private viewer',async()=>{
 let mounted;const s=setup({search:'?source=Agro_ABC&block=C',session:{token:'staff',expiresAt:Date.now()+10000},fetcher:async url=>({ok:true,status:200,json:async()=>url.endsWith('/analysis/Agro_ABC')?{download:{ok:true},analysis:{ok:true},files:['metadata.json']}:url.endsWith('metadata.json')?{gawangan:[]}:{jobs:[]}})});s.context.window.YG_DAYUN_BLOCK={mount:async opts=>(mounted=opts,()=>{})};await s.settle();assert.equal(s.el('dayunBlock').value,'C');assert.equal(mounted.block,'C');assert.equal(mounted.autoOpen,true);assert.ok(s.calls.every(c=>!c.options.method));
});

test('published block imagery does not inherit the source-wide coverage outlines',async()=>{
 let mounted;const s=setup({search:'?source=Agro_ABC&block=C',session:{token:'staff',expiresAt:Date.now()+10000},fetcher:async url=>({ok:true,status:200,json:async()=>url.endsWith('/analysis/Agro_ABC')?{download:{ok:true},analysis:{ok:true},block_analyses:{C:'block-C/analysis.json'},files:['metadata.json','coverage.geojson','block-C/analysis.json']}:url.endsWith('metadata.json')?{gawangan:[]}:{jobs:[]}})});
 s.context.window.YG_DAYUN_BLOCK={mount:async opts=>(mounted=opts,()=>{})};await s.settle();assert.equal(mounted.block,'C');assert.ok(!s.calls.some(c=>c.url.endsWith('coverage.geojson')));assert.ok(s.calls.every(c=>!c.options.method));
});

test('DEF block links and block/source switching select the matching private source without writes',async()=>{
 let mounted;const s=setup({search:'?source=Agro_DEF&block=E',session:{token:'staff',expiresAt:Date.now()+10000},fetcher:async url=>({ok:true,status:200,json:async()=>url.includes('/analysis/')&&!url.includes('/files/')?{download:{ok:true},analysis:{ok:true},files:['metadata.json']}:url.endsWith('metadata.json')?{gawangan:[]}:{jobs:[]}})});
 s.context.window.YG_DAYUN_BLOCK={mount:async opts=>(mounted=opts,()=>{})};await s.settle();assert.equal(s.el('dayunBlock').value,'E');assert.equal(mounted.block,'E');assert.equal(mounted.autoOpen,true);assert.equal(mounted.base,'/api/staff/drone/analysis/Agro_DEF');
 s.el('dayunBlock').value='B';await s.el('dayunBlock').onchange();await s.settle();assert.equal(s.el('dayunSource').value,'Agro_ABC');assert.equal(mounted.block,'B');
 s.el('dayunSource').value='Agro_DEF';await s.el('dayunSource').onchange();await s.settle();assert.equal(s.el('dayunBlock').value,'D');assert.equal(mounted.block,'D');assert.ok(s.calls.every(c=>!c.options.method));
});


test('queue polling stops for completed jobs, hidden pages and service failure; manual retry remains available',async()=>{
 let phase='processing';const s=setup({session:{token:'staff',expiresAt:Date.now()+100000},fetcher:async url=>({ok:phase!=='failed',status:phase==='failed'?429:200,json:async()=>({jobs:url.endsWith('/analysis/requests')?[{label:'Agro_ABC',status:phase}]:[]})})});await s.settle();const poll=s.timers.find(t=>t.ms===60000);assert.ok(poll);const reads=()=>s.calls.filter(c=>c.url?.endsWith('/analysis/requests')).length;
 assert.equal(reads(),1);s.context.document.visibilityState='hidden';poll.fn();await s.settle();assert.equal(reads(),1);s.context.document.visibilityState='visible';phase='coverage_ready';poll.fn();await s.settle();assert.equal(reads(),2);poll.fn();await s.settle();assert.equal(reads(),2);
 phase='processing';await s.el('refreshDayunRequests').onclick();phase='failed';poll.fn();await s.settle();const failed=reads();poll.fn();await s.settle();assert.equal(reads(),failed);phase='coverage_ready';await s.el('refreshDayunRequests').onclick();assert.equal(reads(),failed+1);
});


test('native viewport reads zoom windows from a private Blob with no URL range requests',async()=>{
 let mounted,blobReads=0;const s=setup({session:{token:'staff',expiresAt:Date.now()+100000},search:'?source=Agro_ABC&block=A',fetcher:async url=>({ok:true,status:200,json:async()=>url.endsWith('/analysis/Agro_ABC')?{download:{ok:true},analysis:{ok:true},files:['metadata.json']}:url.endsWith('metadata.json')?{gawangan:[]}:{jobs:[]}})});
 s.context.window.YG_DAYUN_BLOCK={mount:async o=>(mounted=o,()=>{})};s.context.GeoTIFF.fromBlob=async b=>{assert.ok(b instanceof Blob);blobReads++;return{getImage:async()=>s.image}};await s.settle();const start=s.calls.length;
 const handle=await mounted.openNativeRaster(new Blob(['private core']),{title:'native core'});for(const left of [0,10,20])await s.layers[0].georaster.getValues({left,top:0,right:left+2,bottom:2,width:2,height:2});assert.equal(blobReads,1);assert.equal(s.calls.slice(start).filter(c=>c.url).length,0);assert.equal(s.calls.slice(start).filter(c=>c.reader==='native-image').length,3);handle.dispose();
});


test('visible native grid cells become ready without waiting for stale off-screen layer loads',async()=>{
 let mounted,zoom=23,view={min:{x:0,y:0},max:{x:256,y:256}};
 const s=setup({search:'?source=Agro_ABC&block=A',session:{token:'staff',expiresAt:Date.now()+100000},fetcher:async url=>({ok:true,status:200,json:async()=>url.endsWith('/analysis/Agro_ABC')?{download:{ok:true},analysis:{ok:true},files:['metadata.json']}:url.endsWith('metadata.json')?{gawangan:[]}:{jobs:[]}})});
 s.context.window.YG_DAYUN_BLOCK={mount:async o=>{mounted=o;return()=>{}}};await s.settle();
 s.map.getZoom=()=>zoom;s.map.getPixelBounds=()=>view;s.map.project=p=>p;
 const state=await mounted.openNativeRaster('/api/staff/drone/analysis/Agro_ABC/files/a.tif',{title:'native'}),layer=s.instances[0];
 layer.getBounds=()=>({getNorthWest:()=>({x:0,y:0}),getSouthEast:()=>({x:512,y:256})});layer.getTileSize=()=>({x:256,y:256});
 const first={coords:{z:23,x:0,y:0}},second={coords:{z:23,x:1,y:0}},before=s.calls.length;
 layer.handlers.tileloadstart(first);layer.handlers.tileloadstart(second);assert.equal(state.ready,false);
 layer.handlers.tileload(first);assert.equal(state.ready,true);assert.equal(state.error,null);
 view={min:{x:256,y:0},max:{x:512,y:256}};layer.handlers.loading();assert.equal(state.ready,false);layer.handlers.tileload(second);assert.equal(state.ready,true);
 zoom=18;layer.handlers.loading();assert.equal(state.ready,true);zoom=23;layer.handlers.loading();assert.equal(state.ready,true);
 layer.handlers.tileerror(second);assert.equal(state.ready,false);assert.match(state.error,/gagal/);layer.handlers.tileloadstart(second);layer.handlers.tileload(second);assert.equal(state.ready,true);assert.equal(state.error,null);
 assert.equal(s.calls.length,before);state.dispose();assert.equal(state.disposed,true);
});
