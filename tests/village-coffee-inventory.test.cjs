const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/village-profile.js'),'utf8');
const context={window:{YG_PLANTING_INVENTORY:require('../js/planting-inventory.js')},number:v=>v==null||String(v).trim()===''?null:Number(v),normalized:v=>String(v).toLowerCase()};
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


test('legacy IDs, report assets and monitoring chains resolve once while independent planting stays additive',()=>{
 const plot=feature('PLOT',100,{Layer_ID:'area_mangrove'});
 const report=(id,count,target,extra={})=>feature('MONITORING-'+id,999,{Layer_ID:'monitoring_reports',Kategori:'Penanaman Mangrove',Source_Type:'monitoring_report',Source_Report_ID:id,Jumlah_Bib:count,Target_Object_ID:target,...extra});
 const one=report('YG-ONE',110,'legacy',{targetFeatureProperties:{Object_ID:'PLOT',Layer_ID:'area_mangrove',Jumlah_Bib:100}});
 const two=report('YG-TWO',110,'MONITORING-YG-ONE');
 const three=report('YG-THREE',110,'legacy');
 const planting=feature('COMMUNITY-YG-NEW',20,{Layer_ID:'titik_penanaman',Source_Type:'community_report',Source_Report_ID:'YG-NEW',Target_Object_ID:'PLOT'});
 const baselineReport=feature('COMMUNITY-YG-BASELINE',100,{Layer_ID:'area_mangrove',Source_Type:'community_report',Source_Report_ID:'YG-BASELINE',Target_Object_ID:'PLOT'});
 const asset=feature('ASSET',20,{Layer_ID:'area_mangrove',Source_Type:'verified_report_asset',Source_Report_ID:'YG-NEW'});
 assert.equal(context.plantInventory([plot,asset],[one,two,three,planting,baselineReport]).mangrove,120);
 assert.equal(context.plantInventory([plot,asset],[three,two,planting,one,two]).mangrove,120);
 assert.equal(context.plantInventory([{...plot,properties:{...plot.properties,Jumlah_Tanam:0}}],[one,two]).mangrove,0);
 assert.equal(context.plantInventory([],[report('YG-ONLY',100,'PLOT'),report('YG-ONLY-2',100,'PLOT')]).mangrove,100);
 assert.equal(context.plantInventory([],[report('YG-SAMPLE',undefined,'PLOT',{Jumlah_Hidup:50,Jumlah_Mati_Rusak:2})]).mangrove,0);
});

test('actual village sources preserve unique plantings and ignore additional monitoring copies',()=>{
 const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data/master-database-snapshot.json'))),official=JSON.parse(fs.readFileSync(path.join(root,'data/area_mangrove.geojson')));
 const all=context.mergeFeatureCollections(snapshot,[official]);
 const byVillage=name=>all.filter(f=>(f.properties.Desa||'').replace(/ /g,'').toLowerCase()===name.replace(/ /g,'').toLowerCase());
 for(const [name,total] of [['Buruk Bakul',24820],['Kelapa Pati',11995],['Tanjung Kuras',4210],['Sepahat',5200]]){
  const selected=byVillage(name);if(name==='Kelapa Pati')selected.push(all.find(f=>f.properties.Source_Report_ID==='YG-20260725-160711-904'));const monitoring=selected.filter(f=>f.properties.Source_Type==='monitoring_report');
  assert.equal(context.plantInventory(selected,[]).mangrove,total,name);
  assert.equal(context.plantInventory(selected,monitoring.concat(monitoring)).mangrove,total,name+' repeated monitoring');
  assert.equal(context.plantInventory(selected.slice().reverse(),monitoring.slice().reverse()).mangrove,total,name+' input order');
 }
 const coffee=JSON.parse(fs.readFileSync(path.join(root,'data/area_kopi.geojson'))).features.find(f=>f.properties.Object_ID==='KOPI-GHIMBO-POMUAN-MA-EARTH-2026-001');
 assert.equal(context.vegetationClass(coffee),'coffee');
});
