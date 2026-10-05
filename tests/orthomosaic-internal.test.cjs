const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const code=fs.readFileSync('js/orthomosaic-internal.js','utf8');
function setup({session=null,status=200}={}){
 const elements=new Map(),calls=[],layers=[];
 const el=id=>{if(!elements.has(id))elements.set(id,{hidden:id==='workspace',value:id==='opacity'?'1':'',disabled:false,textContent:'',children:[],replaceChildren(...children){this.children=children},append(x){this.children.push(x)},add(x){this.children.push(x)}});return elements.get(id)};
 const map={setView(){return this},addControl(){},on(){},fitBounds(){},remove(){},removeLayer(){}};
 const job={id:'drn-test',title:'Test RGB',status:'ready',cogKey:'private.tif'};
 const image={getGeoKeys:()=>({ProjectedCSTypeGeoKey:32648}),getFileDirectory:()=>({PhotometricInterpretation:2,BitsPerSample:[8,8,8]}),getSamplesPerPixel:()=>3,getBoundingBox:()=>[0,0,100,100],getResolution:()=>[1,-1],getGDALNoData:()=>null,getWidth:()=>100,getHeight:()=>100};
 const tiff={getImage:async()=>image,readRasters:async()=>[new Uint8Array([4,5,6,7]),new Uint8Array(4),new Uint8Array(4)]};
 const context={document:{getElementById:el,createElement:()=>({append(){},click(){}})},window:{YG_AUTH:{readStoredSession:()=>session},addEventListener(){}},Option:function(text,value){return{text,value}},L:{map:()=>map,tileLayer:()=>({addTo(){return this}}),featureGroup:()=>({addTo(){return this},getLayers:()=>[]}),Control:{Draw:function(){}},Draw:{Event:{CREATED:'created'}}},GeoTIFF:{fromUrl:async(url,options)=>{calls.push({url,options});return tiff}},GeoRasterLayer:function(options){layers.push(options);return{options:{},on(){},addTo(){},getBounds:()=>[[0,0],[1,1]]}},turf:{},fetch:async(url,options)=>{calls.push({url,options});return{status,ok:status===200,json:async()=>({jobs:[job]})}},Headers,AbortController,AbortSignal,Blob,URL,Date,setTimeout,clearTimeout,setInterval(){},confirm:()=>true};
 Object.assign(context.window,{L:context.L,GeoTIFF:context.GeoTIFF,GeoRasterLayer:context.GeoRasterLayer,turf:context.turf});
 vm.runInNewContext(code,context);
 return {el,calls,layers,image,settle:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('anonymous visitor cannot initialize map or request private catalogue',async()=>{const s=setup();await s.settle();assert.equal(s.el('workspace').hidden,true);assert.equal(s.calls.length,0);assert.match(s.el('gateStatus').textContent,/Masuk sebagai staf/)});
test('server rejection keeps internal workspace locked even with a stored session',async()=>{const s=setup({session:{token:'forged',expiresAt:Date.now()+10000},status:401});await s.settle();assert.equal(s.el('workspace').hidden,true);assert.match(s.el('gateStatus').textContent,/Akses ditolak/)});
test('authorized COG uses bearer header, lazy reads, preserves valid dark pixels',async()=>{const s=setup({session:{token:'test-token',expiresAt:Date.now()+10000}});await s.settle();assert.equal(s.el('workspace').hidden,false);s.el('job').value='drn-test';s.el('openJob').onclick();await s.settle();assert.equal(s.layers.length,1);const request=s.calls.find(c=>c.url.endsWith('/cog'));assert.equal(request.options.headers.Authorization,'Bearer test-token');assert.ok(!request.url.includes('test-token'));assert.equal(request.options.allowFullFile,false);const layer=s.layers[0];assert.equal(layer.pixelValuesToColorFn([0,0,0]),'rgb(0,0,0)');assert.equal(layer.pixelValuesToColorFn([5,5,5]),'rgb(5,5,5)');const bands=await layer.georaster.getValues({left:0,top:0,right:2,bottom:2,width:2,height:2});assert.deepEqual(Array.from(bands[0][1]),[6,7]);assert.equal(s.el('downloadTiff').disabled,false)});
