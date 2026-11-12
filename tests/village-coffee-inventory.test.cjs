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
