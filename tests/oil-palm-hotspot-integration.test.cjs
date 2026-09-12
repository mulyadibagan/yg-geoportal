const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const os=require('node:os');
const vm=require('node:vm');
const ref=require('../js/oil-palm-reference.js');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ring=[[0,0],[10,0],[10,10],[0,10],[0,0]],hole=[[4,4],[6,4],[6,6],[4,6],[4,4]];
const unit=(id,rings,type='Polygon')=>({type:'Feature',properties:{COMPANY_ID:id,PO_COMPANY:id,RSPO_GROUP:'Grup '+id,SUPPLY_BASE:'Estate '+id,REFERENCE_DISTRICTS:'Kampar'},geometry:{type,coordinates:rings}});
const point=(x,y)=>({type:'Feature',geometry:{type:'Point',coordinates:[x,y]},properties:{village:'Desa tetap',pbph052026:[{name:'PBPH tetap'}],oilPalmCompanyRef:[{name:'Lama'}]}});
test('polygon holes, multipart, duplicate units, stale references and unaffected attributes',()=>{
 const geo={type:'FeatureCollection',referenceVersion:ref.version,features:[unit('A',[ring,hole]),unit('A',[ring,hole]),unit('B',[[ring,hole]],'MultiPolygon')]};
 const points={features:[point(2,2),point(5,5),point(11,11)]};
 assert.equal(ref.attach(points,geo),1);
 assert.deepEqual(points.features[0].properties.oilPalmCompanyRef.map(x=>x.id),['A','B']);
 assert.ok(!points.features[1].properties.oilPalmCompanyRef);
 assert.ok(!points.features[2].properties.oilPalmCompanyRef);
 assert.ok(points.features.every(f=>f.properties.village==='Desa tetap'&&f.properties.pbph052026[0].name==='PBPH tetap'));
 assert.throws(()=>ref.attach(points,{...geo,referenceVersion:'old'}));
});
test('interactive reference layer binds and opens a company popup',async()=>{
 const script=read('js/map-v4.js');
 const start=script.indexOf('  async function loadReferenceLayer('),end=script.indexOf('  function appendReferenceControls(',start);
 let click,opened=false,options,popup;
 const feature={type:'Feature',properties:{COMPANY_ID:'A',PO_COMPANY:'PT A'},geometry:{type:'Polygon',coordinates:[ring]}};
 const layer={getBounds:()=>({isValid:()=>true})};
 const context={REFERENCE_LAYERS:{test:{type:'oil_palm_company',file:'data/test.geojson',label:'Referensi',version:'test'}},referenceLayerObjects:{},referenceLayerState:{},setStatus(){},fetch:async()=>({ok:true,json:async()=>({type:'FeatureCollection',features:[feature]})}),mergeReferenceSupplements:async(c,d)=>d,MAP_PANES:{reference:'reference'},vectorRendererFor:()=>({}),referenceStyle:()=>({}),referencePopup:(c,f)=>f.properties.PO_COMPANY,referenceCountInfo:()=>({count:1,featureCount:1,label:'1',statusLabel:'1'}),document:{querySelector:()=>null},L:{DomEvent:{stopPropagation(){}},geoJSON:(data,opts)=>{options=opts;opts.onEachFeature(feature,{bindPopup(v){popup=v},on(event,fn){click=fn},openPopup(){opened=true}});return layer}}};
 vm.createContext(context);vm.runInContext(script.slice(start,end)+'\nthis.load=loadReferenceLayer;',context);
 await context.load('test');assert.equal(options.interactive,true);assert.equal(options.bubblingMouseEvents,false);assert.equal(popup,'PT A');click({latlng:{lat:1,lng:1}});assert.equal(opened,true);
});
test('public release contains only compact GeoRSPO grower areas',()=>{
 const data=JSON.parse(read('data/PERUSAHAAN_SAWIT_RIAU_REFERENSI.geojson'));
 assert.equal(data.referenceVersion,ref.version);
 assert.equal(data.features.length,58);
 assert.equal(new Set(data.features.map(f=>f.properties.RSPO_GROUP)).size,8);
 assert.equal(new Set(data.features.map(f=>f.properties.PO_COMPANY)).size,33);
 assert.ok(data.features.every(f=>f.properties.NAME_SOURCE==='GeoRSPO / RSPO'&&f.properties.SUPPLY_BASE&&f.properties.REFERENCE_DISTRICTS));
 assert.ok(!data.features.some(f=>/Permata Group|PT\. PHI/i.test(JSON.stringify(f.properties))));
 assert.ok(data.features.every(f=>!['MemberNum','FID','MemberCat','Subsidiary','ManageUnit','CERTIFICATION_NUMBER','PO_HGU'].some(key=>key in f.properties)));
 assert.deepEqual(Object.keys(data.features[0].properties).sort(),['COMPANY_ID','NAME_SOURCE','PO_COMPANY','REFERENCE_DISTRICTS','REFERENCE_TYPE','REFERENCE_UPDATED','RSPO_GROUP','SUPPLY_BASE'].sort());
});
test('hourly enrichment uses same matching and keeps village and PBPH enrichment',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sawit-test-'));
 try{
  const village=unit('v',[ring]);village.properties={WADMKD:'Desa uji',WADMKC:'Kecamatan uji',WADMKK:'Kampar'};
  const permit=unit('p',[ring]);permit.properties={NAMOBJ:'PBPH uji',NO_SK:'SK uji'};
  const geo={type:'FeatureCollection',referenceVersion:ref.version,features:[unit('A',[ring,hole])]};
  for(const [name,data] of Object.entries({village:{features:[village]},permit:{features:[permit]},company:geo,hotspots:{features:[point(2,2),point(5,5),point(11,11)]}}))fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(data));
  const run=spawnSync(process.execPath,[path.join(root,'scripts/enrich_hotspot_villages.mjs')],{env:{...process.env,HOTSPOT_VILLAGE_BOUNDARY:path.relative(root,path.join(dir,'village.json')),HOTSPOT_PBPH_BOUNDARY:path.relative(root,path.join(dir,'permit.json')),HOTSPOT_OIL_PALM_BOUNDARY:path.relative(root,path.join(dir,'company.json')),HOTSPOT_POINTS_FILE:path.relative(root,path.join(dir,'hotspots.json'))},encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const out=JSON.parse(fs.readFileSync(path.join(dir,'hotspots.json'))).features;
  assert.equal(out[0].properties.oilPalmCompanyRef[0].name,'A');
  assert.equal(out[0].properties.village,'Desa uji');
  assert.equal(out[0].properties.pbph052026[0].name,'PBPH uji');
  assert.ok(!out[1].properties.oilPalmCompanyRef);
  assert.equal(out[1].properties.village,'Desa uji');
  assert.ok(!out[2].properties.oilPalmCompanyRef);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
