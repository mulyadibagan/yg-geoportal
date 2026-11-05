const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function api(){
 let source=fs.readFileSync(path.join(__dirname,'../js/monitoring-compilation.js'),'utf8');
 source=source.replace('  var saved=null;','  return {indexPublishedReports,normalizePublished,compilePublished,clusterDimensions};\n  var saved=null;');
 const node={addEventListener(){}};
 return vm.runInNewContext(source,{document:{getElementById:()=>node,addEventListener(){}},window:{},console,URLSearchParams,location:{search:''},setTimeout});
}
function report(id,target,phase='Phase III',date='2026-08-18'){
 return{properties:{reportId:id,reportType:'Monitoring',targetObjectId:target,targetLayerId:'area_mangrove',activityDate:date,targetFeatureProperties:{Object_ID:target,Desa:'Kelapa Pati',Ket:phase,Jumlah_Bib:100,Luas_Ha:0.05},proposedInformation:{monitoringType:'Penanaman Mangrove',aliveCount:90,deadOrDamagedCount:10}}};
}
test('monitoring follow-ups keep three Kelapa Pati phase III objects and retain all report histories',()=>{
 const h=api(),p='MANGROVE-KELAPA-PATI-PHASE-III-2026-';
 const features=[report('plot1',p+'001'),report('plot2',p+'002'),report('plot3',p+'003'),report('plot2-followup','MONITORING-plot2','Phase III','2026-10-11'),report('YG-20260819-192001-579','MANGROVE-KELAPA-PATI-PHASE-III-2025-001'),report('legacy-followup','MONITORING-YG-20260819-192001-579','Phase III','2026-10-11')];
 h.indexPublishedReports(features);
 const data=h.compilePublished(features.map(h.normalizePublished),'Penanaman Mangrove');
 const phase3=data.groups.filter(g=>h.clusterDimensions(g).phase.label==='Fase III');
 assert.equal(phase3.length,3);
 assert.equal(phase3.find(g=>g.key===p+'002').history.length,2);
 const corrected=data.groups.find(g=>g.history.some(r=>r.id==='legacy-followup'));
 assert.equal(h.clusterDimensions(corrected).phase.label,'Fase II');
 assert.equal(corrected.history.length,2);
 assert.equal(data.groups.flatMap(g=>g.history).length,features.length);
 assert(!data.groups.some(g=>g.key.startsWith('MONITORING-')));
});
test('cyclic monitoring references terminate without dropping the report',()=>{
 const h=api(),features=[report('cycle','MONITORING-cycle')];h.indexPublishedReports(features);
 assert(h.normalizePublished(features[0]));
});
