const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const A=require('../js/restoration-scoring.js'),I=require('../js/restoration-inventory.js');
const original=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/Gambut_BBSDLP_2019.geojson')));
const snapshot=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/master-database-snapshot.json')));
let station,polygon;
for(const feature of I.select(snapshot).fdrs.features){polygon=original.features.find(p=>A.contains(feature.geometry.coordinates,p.geometry));if(polygon){station=feature;break;}}
assert.ok(station&&polygon,'Use existing real station/peat geometry, never random spatial fixtures');
function units(passed=true){return {type:'FeatureCollection',features:[{...polygon,id:'test-unit-only',properties:{sourceAttributes:{KELAS_GBT:polygon.properties.KELAS_GBT,TAHUN:2019},qa:{geometryCheck:{passed},analysisUnitApproved:false},restorationIndicators:{}}}]};}
function observation(values={}){return {...station,properties:{Object_ID:'test-object-only',Source_Report_ID:'test-report-only',Source_Type:'monitoring_report',Layer_ID:'monitoring_reports',Monitoring_Type:'Tinggi Muka Air Gambut',Water_Table_Cm:0,activityDate:'2026-11-04',Status_Objek:'Aktif',...values}};}
const fc=features=>({type:'FeatureCollection',features});
test('BPBD response dates and duplicates remain evidence, never unique incidents',async()=>{
 const {inspect}=await import('../scripts/audit-restoration-bpbd.mjs');
 const {audit}=await import('../scripts/validate-restoration-database-evidence.mjs');
 const feature={...station,properties:{tanggal:'2026-01-12',kategori:'Water drop'}};
 const source={uuid:'test-only',sha256:'test-only',titleYear:2026};
 const original=JSON.stringify(feature);
 const result=inspect(fc([feature,feature,{...feature,properties:{tanggal:'2025-02-29'}},{...feature,properties:{tanggal:'2025-01-01'}}]),source);
 assert.equal(result.source.exactDuplicateRows,1);assert.equal(result.source.invalidDates,1);assert.equal(result.source.yearMismatches,1);
 assert.equal(result.source.uniqueIncidents,null);assert.equal(result.source.completeHistory,false);
 const matrix=audit(units(),fc([]),{sources:[result.source],records:result.records});
 assert.equal(matrix.units[0].indicatorEvidence.fireHistory.bpbdResponseRecordRefs.length,4);
 assert.equal(matrix.units[0].score,null);assert.equal(JSON.stringify(feature),original);
});
test('BPBD packages reject unknown provenance before opening source files',async()=>{
 const {loadPackage}=await import('../scripts/audit-restoration-bpbd.mjs');
 const os=require('node:os');const directory=fs.mkdtempSync(path.join(os.tmpdir(),'restoration-test-'));
 const privateDir=path.join(directory,'private');fs.mkdirSync(privateDir);
 fs.writeFileSync(path.join(privateDir,'manifest.json'),JSON.stringify({access:'staff_only',records:[{uuid:'unknown'},{uuid:'unknown2'}]}));
 const resolved=await fs.promises.realpath(directory),tempRoot=await fs.promises.realpath(os.tmpdir());
 assert.equal(path.dirname(resolved),tempRoot);assert.ok(path.basename(resolved).startsWith('restoration-test-'));
 try{await assert.rejects(loadPackage(privateDir,resolved),/Unknown BPBD source/);}finally{fs.rmSync(resolved,{recursive:true,force:true});}
});
test('BPBD geometry review queue names excluded candidates without assigning containment',async()=>{
 const {inspect}=await import('../scripts/audit-restoration-bpbd.mjs');
 const {audit}=await import('../scripts/validate-restoration-database-evidence.mjs');
 const record={...station,geometry:{type:'MultiPoint',coordinates:[station.geometry.coordinates,station.geometry.coordinates]},properties:{tanggal:'2026-01-12',kategori:'Pemadaman'}};
 const source=inspect(fc([record]),{uuid:'test-only',sha256:'test-only',titleYear:2026});
 const matrix=audit(units(false),fc([]),{sources:[source.source],records:source.records});
 assert.equal(matrix.bpbd.membership.incompleteRecords,1);
 assert.equal(matrix.bpbd.records[0].uniqueMembership,false);
 assert.deepEqual(matrix.bpbd.records[0].unitIds,[]);
 assert.deepEqual(matrix.bpbd.records[0].excludedGeometryCandidateIds,['test-unit-only']);
 assert.equal(matrix.bpbd.geometryReviewQueue[0].bpbdResponseRefs.length,1);
 assert.equal(matrix.units[0].indicatorEvidence.fireHistory.bpbdResponseRecordRefs.length,0);
 assert.equal(matrix.units[0].score,null);
});
test('zero TMAT remains a native observation without ecological normalization or approval',async()=>{
 const {audit}=await import('../scripts/validate-restoration-database-evidence.mjs');
 const input=units(),source=fc([observation()]),before=JSON.stringify({input,source});
 const result=audit(input,source);
 assert.equal(result.observations.length,1);assert.equal(result.observations[0].nativeValue,0);
 assert.equal(result.observations[0].measurementDatum,null);assert.equal(result.observations[0].timezone,null);
 assert.equal(result.units[0].score,null);assert.equal(result.approvalGranted,false);
 assert.equal(JSON.stringify({input,source}),before);
});
test('missing, nonnumeric and conflicting TMAT fields never become zero',async()=>{
 const {waterObservation}=await import('../scripts/validate-restoration-database-evidence.mjs');
 for(const value of [null,undefined,'',' ',NaN,'No Data'])assert.equal(waterObservation({Water_Table_Cm:value}).valueCm,null);
 assert.equal(waterObservation({Water_Table_Cm:0,waterTableCm:-40}).conflicting,true);
 assert.equal(waterObservation({Water_Table_Cm:'-40'}).valueCm,-40);
});
test('mangrove/mineral monitoring is excluded even where point and numerical fields match peat',async()=>{
 const {audit}=await import('../scripts/validate-restoration-database-evidence.mjs');
 const result=audit(units(),fc([observation({Monitoring_Type:'Penanaman Mangrove'}),observation({Monitoring_Type:'Monitoring Restorasi Hutan Mineral',Source_Report_ID:'test-other-only'})]));
 assert.equal(result.monitoring.nonPeatRows,2);assert.equal(result.observations.length,0);
 assert.equal(result.indicators.find(i=>i.id==='hydrology').unitsWithEvidence,0);
});
test('duplicate report IDs are not resolved by choosing or averaging measurements',async()=>{
 const {audit}=await import('../scripts/validate-restoration-database-evidence.mjs');
 const result=audit(units(),fc([observation({Water_Table_Cm:-40}),observation({Water_Table_Cm:-60})]));
 assert.equal(result.monitoring.ambiguousIdentityRows,2);assert.equal(result.observations.length,0);
});
test('infrastructure remains readiness context and failed unit geometry blocks spatial assignment',async()=>{
 const {audit}=await import('../scripts/validate-restoration-database-evidence.mjs');
 const context=audit(units(),fc([station]));assert.equal(context.unitsWithInfrastructureContext,1);assert.equal(context.observations.length,0);
 const invalid=audit(units(false),fc([observation()]));assert.equal(invalid.unitGeometryIssues,1);
 assert.equal(invalid.observations[0].unitIds.length,0);assert.equal(invalid.observations[0].uniqueMembership,false);
 assert.equal(invalid.units[0].score,null);
});
test('no raster pixel centers and absent burned evidence remain unavailable, not validated coverage',async()=>{
 const {audit}=await import('../scripts/validate-restoration-database-evidence.mjs');
 const input=units();input.features[0].properties.evidence={treeCoverLoss:{coveredByAvailableTiles:true,counts:{mappedLandPixels:0,noDataPixels:0,invalidValuePixels:0,lossYearCounts:[]}}};
 const row=audit(input,fc([])).units[0];
 assert.equal(row.indicatorEvidence.vegetationLoss.nativePixelReadComplete,false);
 assert.equal(row.indicatorEvidence.fireHistory.partialBurnIndications,null);
 assert.equal(row.status,'Belum dinilai');
});
