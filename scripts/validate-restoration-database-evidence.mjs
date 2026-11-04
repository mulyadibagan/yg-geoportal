// Read-only evidence validation. No approval, normalization or ecological score is inferred.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import A from '../js/restoration-scoring.js';
import C from '../js/restoration-catalog.js';
import I from '../js/restoration-inventory.js';
import {calendarDate,numeric} from './audit-restoration-tmat.mjs';
import {loadPackage} from './audit-restoration-bpbd.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SOURCE='https://webgis-api.yayasangambut.org/snapshots/current/objects.json';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const text=value=>typeof value==='string'&&value.trim()?value.trim():null;
function bounds(feature){
 const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
 const b=[Infinity,Infinity,-Infinity,-Infinity];
 for(const polygon of polygons)for(const ring of polygon)for(const p of ring){b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);}return b;
}
export function waterObservation(properties){
 const raw=[properties.Water_Table_Cm,properties.waterTableCm,properties.monitoring?.waterTableCm].filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='');
 const values=raw.map(numeric);
 return {valueCm:!raw.length||values.some(v=>v===null)||new Set(values).size!==1?null:values[0],missing:!raw.length,invalid:values.some(v=>v===null),conflicting:new Set(values.filter(v=>v!==null)).size>1};
}
export function audit(units,snapshot,bpbd={sources:[],records:[]}){
 C.validate(units);
 const ids=new Set();
 const rows=units.features.map(feature=>{
  if(!text(feature.id)||ids.has(feature.id))throw Error('Analysis unit IDs must be unique');ids.add(feature.id);
  return {feature,bbox:bounds(feature),technical:feature.properties?.qa?.geometryCheck?.passed===true,inventory:{fdrs:[],blocks:[]},hydrology:[],degradation:[],bpbd:[]};
 });
 const inventory=I.select(snapshot);
 function membership(coordinates){
  const matches=[];let excluded=0;
  for(const row of rows){const b=row.bbox;if(coordinates[0]<b[0]||coordinates[0]>b[2]||coordinates[1]<b[1]||coordinates[1]>b[3])continue;
   if(!row.technical){excluded++;continue;}if(A.contains(coordinates,row.feature.geometry))matches.push(row);
  }
  return {matches,excluded};
 }
 const context={fdrs:inventory.fdrs.features.length,blocks:inventory.blocks.features.length,matchedInfrastructureRecords:0,unmatchedInfrastructureRecords:0,ambiguousInfrastructureRecords:0,incompleteInfrastructureMembership:0};
 for(const kind of ['fdrs','blocks'])for(const feature of inventory[kind].features){
  const result=membership(feature.geometry.coordinates);
  if(result.matches.length)context.matchedInfrastructureRecords++;else context.unmatchedInfrastructureRecords++;
  if(result.matches.length>1)context.ambiguousInfrastructureRecords++;if(result.excluded)context.incompleteInfrastructureMembership++;
  for(const row of result.matches)row.inventory[kind].push(feature.id);
 }
 const monitoring=snapshot.features.filter(f=>{const p=f.properties||{};return p.Source_Type==='monitoring_report'||!p.Source_Type&&p.reportType==='Monitoring';});
 const recordId=f=>text(f.properties.Source_Report_ID)||text(f.properties.reportId)||text(f.properties.Object_ID);
 const idCounts=new Map();for(const feature of monitoring){const id=recordId(feature);if(id)idCounts.set(id,(idCounts.get(id)||0)+1);}
 const summary={rows:monitoring.length,nonPeatRows:0,unknownDomainRows:0,ambiguousIdentityRows:0,rejectedLifecycleRows:0,invalidLocationRows:0,missingWaterRows:0,invalidWaterRows:0,conflictingWaterRows:0,missingActivityDateRows:0,hydrologyCandidates:0,degradationCandidates:0,unmatchedCandidates:0,ambiguousMembershipCandidates:0};
 const observations=[];
 for(const feature of monitoring){
  const p=feature.properties,id=recordId(feature),kind=text(p.Monitoring_Type)||text(p.monitoringType)||text(p.monitoring?.monitoringType)||'';
  const domain=[kind,p.Target_Layer_ID,p.targetLayerId].filter(Boolean).join(' ');
  if(/mangrove|mineral/i.test(domain)){summary.nonPeatRows++;continue;}
  if(!/gambut|peat|tmat|muka air|fdrs|water.?table|hidrolog/i.test(domain)){summary.unknownDomainRows++;continue;}
  if(!id||idCounts.get(id)!==1){summary.ambiguousIdentityRows++;continue;}
  if(['Ditolak','Duplikat','Nonaktif','Arsip'].includes(p.Status_Objek)||['Ditolak','Duplikat'].includes(p.status)){summary.rejectedLifecycleRows++;continue;}
  const c=feature.geometry?.coordinates;
  if(feature.geometry?.type!=='Point'||!Array.isArray(c)||c.length!==2||!c.every(Number.isFinite)||Math.abs(c[0])>180||Math.abs(c[1])>90){summary.invalidLocationRows++;continue;}
  const rawDate=text(p.activityDate),day=calendarDate(rawDate&&/^\d{4}-\d{2}-\d{2}/.test(rawDate)?rawDate.slice(0,10):rawDate);
  if(!day)summary.missingActivityDateRows++;
  const water=waterObservation(p);if(water.missing)summary.missingWaterRows++;if(water.invalid)summary.invalidWaterRows++;if(water.conflicting)summary.conflictingWaterRows++;
  const result=membership(c),observation={sourceReportId:id,sourceObjectId:text(p.Object_ID),sourceActivityDate:rawDate,measurementCalendarDate:day,coordinates:c.slice(),unitIds:result.matches.map(row=>row.feature.id),excludedInvalidUnitCandidates:result.excluded,uniqueMembership:result.matches.length===1&&result.excluded===0,unitDeclaredByField:'cm',timezone:null,measurementDatum:null,calibrationReference:null,scoringValidated:false};
  const hydro=water.valueCm!==null&&/tmat|muka air|fdrs|water.?table|hidrolog/i.test(kind);
  const degradation=/degradasi.*gambut|kondisi.*gambut|peat.*condition|peat.*degradation/i.test(kind)&&text(p.Kondisi||p.condition);
  if(!hydro&&!degradation)continue;
  if(!result.matches.length)summary.unmatchedCandidates++;if(result.matches.length>1||result.excluded)summary.ambiguousMembershipCandidates++;
  if(hydro){summary.hydrologyCandidates++;observations.push({...observation,indicator:'hydrology',nativeValue:water.valueCm});for(const row of result.matches)row.hydrology.push(id);}
  if(degradation){summary.degradationCandidates++;observations.push({...observation,indicator:'degradation',nativeValue:text(p.Kondisi||p.condition)});for(const row of result.matches)row.degradation.push(id);}
 }
 const responseMembership={matchedRecords:0,unmatchedRecords:0,ambiguousRecords:0,incompleteRecords:0};
 const responseRecords=[];
 for(const record of bpbd.records){
  const points=record.feature.geometry.type==='Point'?[record.feature.geometry.coordinates]:record.feature.geometry.coordinates;
  const matched=new Set();let incomplete=false;
  for(const point of points){const result=membership(point);if(result.excluded)incomplete=true;for(const row of result.matches)matched.add(row);}
  if(matched.size)responseMembership.matchedRecords++;else responseMembership.unmatchedRecords++;
  if(matched.size>1)responseMembership.ambiguousRecords++;if(incomplete)responseMembership.incompleteRecords++;
  for(const row of matched)row.bpbd.push(record.ref);
  const {feature,...metadata}=record;
  responseRecords.push({...metadata,unitIds:[...matched].map(row=>row.feature.id),incompleteMembership:incomplete,uniqueMembership:matched.size===1&&!incomplete});
 }
 const matrix=rows.map(row=>{
  const p=row.feature.properties,loss=p.evidence?.treeCoverLoss,burned=p.evidence?.burnedIndications;
  const depth=text(p.sourceAttributes?.KELAS_GBT);
  return {unitId:row.feature.id,sourceFeatureIndex:p.sourceFeatureIndex,geometryCheckPassed:row.technical,analysisUnitApproved:p.qa?.analysisUnitApproved===true,sourceReviewFlags:p.qa?.reviewFlags||[],remainingIdenticalGeometry:p.qa?.remainingIdenticalGeometry===true,
   readinessContext:row.inventory,indicatorEvidence:{degradation:{candidateReportIds:row.degradation},fireHistory:{bpbdResponseRecordRefs:row.bpbd,partialBurnIndications:Array.isArray(burned?.observations)?burned.observations.length:null,overlayErrors:burned?.overlayErrors??null,excludedFeatures:burned?.excludedFeatures??null,completeHistory:false,uniqueIncidents:null},hydrology:{candidateReportIds:row.hydrology},vegetationLoss:{nativeRasterObserved:!!loss?.counts&&loss.counts.mappedLandPixels>0,mappedLossObserved:!!loss?.counts?.lossYearCounts?.slice(1).some(n=>n>0),nativePixelReadComplete:loss?.counts?.mappedLandPixels>0&&loss?.coveredByAvailableTiles===true&&loss?.counts?.noDataPixels===0&&loss?.counts?.invalidValuePixels===0,polygonCoverageValidated:false},peatSensitivity:{sourceDepthClass:depth,sourceYear:p.sourceAttributes?.TAHUN??null}},
   blockedBy:[...(!row.technical?['geometry-review-required']:[]),...(p.qa?.analysisUnitApproved!==true?['analysis-unit-not-approved']:[]),...(p.qa?.reviewFlags?.length||p.qa?.remainingIdenticalGeometry?['source-review-required']:[]),...(A.assess(p.restorationIndicators).missing.length?['critical-indicators-incomplete']:[])],declaredInputStatus:A.assess(p.restorationIndicators).missing.length?'incomplete':'declared-input-complete',status:'Belum dinilai',score:null,approvalGranted:false};
 });
 // Preserve membership uncertainty and date/category checks beside version-bound references.
 const bpbdEvidence={sourceScope:'Official downloads for staff-catalogue UUIDs; equivalence to protected R2 copies not verified',sources:bpbd.sources,membership:responseMembership,records:responseRecords};
 const indicatorSummary=A.INDICATORS.map(def=>({id:def.id,label:def.label,unitsWithEvidence:matrix.filter(row=>{
  const e=row.indicatorEvidence[def.id];return def.id==='degradation'||def.id==='hydrology'?e.candidateReportIds.length>0:def.id==='fireHistory'?e.partialBurnIndications>0||e.bpbdResponseRecordRefs.length>0:def.id==='vegetationLoss'?e.nativeRasterObserved:e.sourceDepthClass!==null;
 }).length,validatedByThisAudit:0,blockers:{degradation:['Peat-specific condition observations and reviewed degradation method required'],fireHistory:['Response records are not unique fires; incident identity, coverage and reviewed normalization required'],hydrology:['Measured TMAT, time/datum/calibration and reviewed disturbance method required'],vegetationLoss:['Tree-cover loss is not all vegetation; reviewed period, denominator and normalization required'],peatSensitivity:['Conflicting source classes and reviewed sensitivity method require resolution']}[def.id]}));
 return {schemaVersion:1,access:'staff_only',scope:'evidence-readiness-not-ecological-approval',approvalGranted:false,scoringValidated:false,unitCount:matrix.length,unitGeometryIssues:matrix.filter(row=>!row.geometryCheckPassed).length,unitsWithSourceReviewFlags:matrix.filter(row=>row.sourceReviewFlags.length||row.remainingIdenticalGeometry).length,unitsWithInfrastructureContext:matrix.filter(row=>row.readinessContext.fdrs.length||row.readinessContext.blocks.length).length,bpbd:bpbdEvidence,sourceVersion:snapshot.snapshotGeneratedAt||snapshot.generatedAt||null,context,monitoring:summary,indicators:indicatorSummary,units:matrix,observations};
}
export async function run(inputPath,bpbdPath){
 const privateRoot=await fs.realpath(path.join(root,'private-data')),input=await fs.realpath(path.resolve(root,inputPath));
 if(privateRoot!==path.join(await fs.realpath(root),'private-data'))throw Error('Private root redirected');
 if(!input.startsWith(privateRoot+path.sep))throw Error('Input must remain within private-data');
 if((await fs.stat(input)).size>64*1024*1024)throw Error('Units exceed 64 MiB');
 const unitBytes=await fs.readFile(input),units=JSON.parse(unitBytes);
 const originalBytes=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson')),original=JSON.parse(originalBytes),sourceHash=hash(originalBytes);
 for(const feature of units.features||[]){const p=feature.properties,source=original.features[p?.sourceFeatureIndex];
  if(!Number.isSafeInteger(p?.sourceFeatureIndex)||p.sourceFeatureIndex<0||!source||p.sourceSha256!==sourceHash||JSON.stringify(source.geometry)!==JSON.stringify(feature.geometry)||!p.sourceAttributes||!Object.entries(p.sourceAttributes).every(([key,value])=>JSON.stringify(source.properties?.[key]??null)===JSON.stringify(value)))throw Error('Unit lineage differs from original BBSDLP');
 }
 const response=await fetch(SOURCE,{signal:AbortSignal.timeout(45000)});if(!response.ok||!response.body)throw Error('Database snapshot unavailable');
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>I.MAX_BYTES)throw Error('Database snapshot exceeds bound');chunks.push(chunk);}
 const bpbd=bpbdPath?await loadPackage(path.resolve(root,bpbdPath),privateRoot):{sources:[],records:[]};
 const snapshotBytes=Buffer.concat(chunks),snapshot=JSON.parse(snapshotBytes),result=audit(units,snapshot,bpbd);
 result.bpbdManifestSha256=bpbd.manifestSha256??null;
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-database-validation-'));
 await fs.writeFile(path.join(output,'source-snapshot.json'),snapshotBytes,{flag:'wx'});
 await fs.writeFile(path.join(output,'validation-matrix.json'),JSON.stringify(result,null,2),{flag:'wx'});
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({schemaVersion:1,access:'staff_only',retrievedAt:new Date().toISOString(),source:SOURCE,snapshotSha256:hash(snapshotBytes),unitsSha256:hash(unitBytes),bbsdlpSha256:sourceHash,sourceVersion:result.sourceVersion,approvalGranted:false,scoringValidated:false,limitations:['Prior geometry checks reused only after source geometry/attribute lineage verification; not new topology approval.','Point membership is reference evidence, not hydrological representativeness.','All source and derived files remain private.','No source database or indicator values were modified.']},null,2),{flag:'wx'});
 return {output,unitCount:result.unitCount,unitGeometryIssues:result.unitGeometryIssues,unitsWithInfrastructureContext:result.unitsWithInfrastructureContext,context:result.context,monitoring:result.monitoring,indicators:result.indicators.map(({id,unitsWithEvidence})=>({id,unitsWithEvidence})),approvalGranted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length<3||process.argv.length>4)throw Error('Provide private unit-evidence GeoJSON and optional private BPBD directory');console.log(JSON.stringify(await run(process.argv[2],process.argv[3]),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
