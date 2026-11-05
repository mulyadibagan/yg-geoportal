// Convergence of native observations, not automatic validation of pressure proxies.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
export function combine(corridors,database){
 const fireRows=new Map(database.units.map(row=>[row.unitId,row]));
 if(fireRows.size!==database.units.length||new Set(corridors.units.map(row=>row.unitId)).size!==corridors.units.length||fireRows.size!==corridors.units.length)throw Error('Unit inventory mismatch');
 const units=corridors.units.map(row=>{
  const fire=fireRows.get(row.unitId);if(!fire||fire.sourceFeatureIndex!==row.sourceFeatureIndex)throw Error('Unit identity mismatch');
  const e=fire.indicatorEvidence.fireHistory,loss=row.forestLossCandidate;
  const eligible=row.geometryEligible===true&&fire.geometryCheckPassed===true;
  const signals={fireLocationOrBurnIndication:eligible&&(e.bpbdResponseRecordRefs.length>0||e.partialBurnIndications>0)?true:null,
   historicalTreeCoverLoss:eligible&&loss?.counts?.lossYearCounts?.slice(1).some(n=>n>0)?true:null,
   mappedCanalRoadCorridor:eligible&&row.mappedCanalRoadCorridorObserved===true?true:null};
  const positiveCandidateSignals=Object.values(signals).filter(v=>v===true).length;
  return {unitId:row.unitId,sourceFeatureIndex:row.sourceFeatureIndex,signals,positiveCandidateSignals,
   status:positiveCandidateSignals===3?'Kandidat tiga tekanan':'Bukti kandidat belum lengkap',
   references:{bpbdResponseRecordRefs:e.bpbdResponseRecordRefs,burnIndications:e.partialBurnIndications,forestDataset:loss?.dataset??null,forestPeriod:loss?.period??null,firstCorridorPixel:row.firstSourcePixel},
   sourceReviewFlags:fire.sourceReviewFlags,geometryEligible:eligible,sourceUnitApproved:fire.analysisUnitApproved,
   restorationPressures:null,finalPriority:'Belum dinilai',score:null,
   requiredReview:['Canal/road corridor proxy and 2017 observation vintage','Tree-cover loss proxy, forest type and study period','Fire response versus unique event and source period','Source unit boundaries, overlaps and lineage']};
 });
 return {access:'staff_only',units,summary:{unitCount:units.length,withFireCandidate:units.filter(u=>u.signals.fireLocationOrBurnIndication).length,
  withForestLossCandidate:units.filter(u=>u.signals.historicalTreeCoverLoss).length,withCorridorCandidate:units.filter(u=>u.signals.mappedCanalRoadCorridor).length,
  withThreeCandidateSignals:units.filter(u=>u.positiveCandidateSignals===3).length,finalPriorityAssessed:0},approvalGranted:false,scoringValidated:false};
}
export async function prepare(canalDirectory,databaseDirectory){
 const privateRoot=await fs.realpath(path.join(root,'private-data'));
 if(privateRoot!==path.join(await fs.realpath(root),'private-data'))throw Error('Private root redirected');
 async function read(directory,name,max){const dir=await fs.realpath(path.resolve(root,directory)),file=await fs.realpath(path.join(dir,name));if(!dir.startsWith(privateRoot+path.sep)||!file.startsWith(dir+path.sep)||(await fs.stat(file)).size>max)throw Error('Private bounded evidence required');return fs.readFile(file);}
 const canalBytes=await read(canalDirectory,'evidence.json',32*1024*1024),databaseBytes=await read(databaseDirectory,'validation-matrix.json',32*1024*1024),manifestBytes=await read(databaseDirectory,'manifest.json',65536);
 const canal=JSON.parse(canalBytes),database=JSON.parse(databaseBytes),manifest=JSON.parse(manifestBytes),originalSha=sha(await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson')));
 if(canal.access!=='staff_only'||database.access!=='staff_only'||manifest.access!=='staff_only'||canal.unitsSha256!==manifest.unitsSha256||canal.bbsdlpSha256!==originalSha||manifest.bbsdlpSha256!==originalSha)throw Error('Evidence source version mismatch');
 const result=combine(canal,database),output=await fs.mkdtemp(path.join(privateRoot,'restoration-three-pressure-evidence-'));
 await fs.writeFile(path.join(output,'candidates.json'),JSON.stringify(result,null,2),{flag:'wx'});
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({access:'staff_only',createdAt:new Date().toISOString(),canalEvidenceSha256:sha(canalBytes),databaseEvidenceSha256:sha(databaseBytes),databaseManifestSha256:sha(manifestBytes),unitsSha256:manifest.unitsSha256,bbsdlpSha256:originalSha,approvalGranted:false,scoringValidated:false,limitations:['Counts refer to source reference units, not dissolved unique restoration areas.','Signals come from different observation periods and do not prove simultaneous conditions.','No unknown signal is converted to false or zero.','No forest type, canal centreline, length, area or pressure validation is invented.']},null,2),{flag:'wx'});
 return {output,...result.summary,approvalGranted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==4)throw Error('Provide private canal-evidence and database-validation packages');console.log(JSON.stringify(await prepare(...process.argv.slice(2)),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
