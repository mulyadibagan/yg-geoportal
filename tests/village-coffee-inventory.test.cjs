const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/village-profile.js'),'utf8');
const context={number:v=>v==null||String(v).trim()===''?null:Number(v),normalized:v=>String(v).toLowerCase()};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('  function mergeFeatureCollections('),source.indexOf('  function isActivityFeature('))+source.slice(source.indexOf('  function vegetationClass('),source.indexOf('  function renderPrograms(')),context);
const feature=(id,count,extra={})=>({type:'Feature',geometry:null,properties:{Object_ID:id,Layer_ID:'kopi',Jumlah_Tanam:count,...extra}});

test('Temiang official planting total fills a blank snapshot without duplicate inventory',()=>{
 const coffee=JSON.parse(fs.readFileSync(path.join(root,'data/kopi.geojson')));
 const official=coffee.features.find(f=>f.properties.Object_ID==='KOPI-TEMIANG-2021-001');
 assert.equal(official.properties.Jumlah_Tanam,2700);
 const primary={features:[feature(official.properties.Object_ID,''),feature('BPDP',100),feature('ADDITIONAL',10)]};
 const result=context.mergeFeatureCollections(primary,[{features:[official]}]);
 assert.equal(result.length,3);
 assert.equal(context.plantInventory(result,[]).coffee,2810);
 assert.equal(primary.features[0].properties.Jumlah_Tanam,'');
 assert.equal(context.plantInventory(result,[result[2]]).coffee,2810);
});

test('explicit current values including zero override the official fallback; nursery excluded',()=>{
 for(const count of [0,3500]){
  const result=context.mergeFeatureCollections({features:[feature('A',count)]},[{features:[feature('A',2700)]}]);
  assert.equal(result[0].properties.Jumlah_Tanam,count);
 }
 assert.equal(context.plantInventory([feature('NURSERY',10000,{Layer_ID:'nursery_kopi'})],[]).coffee,0);
});


test('Imbo Putui report polygons share one reviewed 1200 total without merging evidence or unrelated plantings',()=>{
 const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data/master-database-snapshot.json')));
 const attributions=JSON.parse(fs.readFileSync(path.join(root,'data/village-activity-attributions.json'))).attributions;
 const ids=['YG-20260713-162454-182','YG-20260713-165007-843'];
 const reports=ids.map(id=>snapshot.features.find(f=>f.properties.Source_Report_ID===id));
 assert.equal(reports.filter(Boolean).length,2);assert.notDeepEqual(reports[0].geometry,reports[1].geometry);
 assert.equal(context.plantInventory([],reports,attributions).forest,1200);
 assert.equal(context.plantInventory([],reports.slice(0,1),attributions).forest,1200);
 const explicit=reports.map(f=>({...f,properties:{...f.properties,Jumlah_Tanam:1200}}));
 assert.equal(context.plantInventory(explicit,explicit,attributions).forest,1200);
 const separate=feature('SEPARATE',1200,{Layer_ID:'mineral_land_restoration_area',Nama_Objek:'Restorasi Hutan lain'});
 assert.equal(context.plantInventory([separate],explicit,attributions).forest,2400);
 const timeline=require('../js/village-activity-timeline.js');const rows=timeline.buildRecords(reports,[],{attributions});
 assert.equal(rows.length,2);assert.equal(rows.reduce((n,r)=>n+r.photos.length,0),4);
 assert.ok(rows.every(r=>r.donor==='Aliansi Kolibri'&&r.copy.includes('dihitung sekali')));
});
