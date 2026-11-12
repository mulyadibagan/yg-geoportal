const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const source=fs.readFileSync(path.join(root,'js/village-profile.js'),'utf8');
const context={window:{location:{search:''}},URLSearchParams,console};vm.createContext(context);
vm.runInContext(source.slice(0,source.lastIndexOf('  el("print-profile")'))+'globalThis.h={mergeFeatureCollections,featureMatchesPlace,activityMatchesPlace,isActivityFeature,isProgramFeature,plantInventory,plantInventoryLedger};})();',context);
const snapshot=read('data/master-database-snapshot.json'),objects=context.h.mergeFeatureCollections(snapshot,['area_mangrove.geojson','kopi.geojson','area_kopi.geojson'].map(p=>read('data/'+p))),attributions=read('data/village-activity-attributions.json').attributions;
const villages=read('data/desa_intervensi.geojson').features.map(boundary=>{
 const p=boundary.properties,name=p.WADMKD||p.Desa||p.NAMOBJ,district=p.WADMKC||p.Kecamatan,regency=p.WADMKK||p.Kabupaten;
 const programs=objects.filter(f=>context.h.isProgramFeature(f)&&context.h.featureMatchesPlace(f,name,district,regency,boundary));
 const reports=objects.filter(f=>context.h.isActivityFeature(f)&&context.h.activityMatchesPlace(f,name,district,regency,boundary));
 const totals=context.h.plantInventory(programs,reports,attributions),monitoring=reports.filter(f=>f.properties.Source_Type==='monitoring_report');
 const stable=v=>JSON.parse(JSON.stringify(v));
 assert.deepEqual(stable(context.h.plantInventory(programs,reports.concat(monitoring,monitoring),attributions)),stable(totals),name+' repeated monitoring changed inventory');
 assert.deepEqual(stable(context.h.plantInventory(programs.slice().reverse(),reports.slice().reverse(),attributions)),stable(totals),name+' input order changed inventory');
 const ledger=context.h.plantInventoryLedger(programs,reports,attributions);
 return {village:name,totals,sharedLocations:Object.entries(ledger).flatMap(([category,rows])=>Object.entries(rows).filter(([,row])=>row.sources.length>1).map(([location,row])=>({category,location,count:row.count,reportsAndObjects:row.sources.length}))) };
});
console.log(JSON.stringify({snapshotGeneratedAt:snapshot.snapshotGeneratedAt,villageCount:villages.length,checks:'Repeated monitoring and input order preserve all village totals; source records remain unchanged.',villages},null,2));
