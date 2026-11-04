// Review routing by source flags and observed calendar-year overlap, never a new priority score.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {calendarDate} from './audit-restoration-tmat.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
export function review(candidates,corridors,database){
 const unique=(rows,key)=>{const m=new Map(rows.map(r=>[r[key],r]));if(m.size!==rows.length)throw Error('Duplicate review identity');return m;};
 const canalRows=unique(corridors.units,'unitId'),dbRows=unique(database.units,'unitId'),records=unique(database.bpbd.records,'ref');
 unique(candidates.units,'unitId');
 const rows=candidates.units.filter(r=>r.positiveCandidateSignals===3).map(candidate=>{
  const canal=canalRows.get(candidate.unitId),db=dbRows.get(candidate.unitId);
  if(!canal||!db||canal.sourceFeatureIndex!==candidate.sourceFeatureIndex||db.sourceFeatureIndex!==candidate.sourceFeatureIndex||!canal.geometryEligible||!db.geometryCheckPassed)throw Error('Candidate source unit mismatch');
  const loss=canal.forestLossCandidate,counts=loss?.counts?.lossYearCounts;
  if(loss.dataset!=='GFC-2025-v1.13'||!Array.isArray(counts)||counts.length!==26||!counts.every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('Unsupported annual loss evidence');
  const lossYears=counts.flatMap((n,i)=>i>0&&n>0?[2000+i]:[]),fireYears=new Set(),categories={},dates=[],unresolvedRefs=[];
  const refs=candidate.references.bpbdResponseRecordRefs,sourceRefs=db.indicatorEvidence.fireHistory.bpbdResponseRecordRefs;
  if(!['fireLocationOrBurnIndication','historicalTreeCoverLoss','mappedCanalRoadCorridor'].every(k=>candidate.signals?.[k]===true)||canal.mappedCanalRoadCorridorObserved!==true||!lossYears.length||candidate.references.burnIndications!==db.indicatorEvidence.fireHistory.partialBurnIndications||(!refs.length&&!(candidate.references.burnIndications>0))||new Set(refs).size!==refs.length||refs.length!==sourceRefs.length||refs.some(ref=>!sourceRefs.includes(ref)))throw Error('Candidate signal/reference mismatch');
  for(const ref of candidate.references.bpbdResponseRecordRefs){
   const record=records.get(ref);
   if(!record||!record.unitIds.includes(candidate.unitId)||!db.indicatorEvidence.fireHistory.bpbdResponseRecordRefs.includes(ref))throw Error('Unresolved response record provenance');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(record.calendarDate||'')||calendarDate(record.calendarDate)!==record.calendarDate){unresolvedRefs.push(ref);continue;}
   fireYears.add(Number(record.calendarDate.slice(0,4)));dates.push(record.calendarDate);
   categories[record.category??'Missing']=(categories[record.category??'Missing']||0)+1;
  }
  dates.sort();const years=[...fireYears].sort((a,b)=>a-b),sharedYears=years.filter(y=>lossYears.includes(y));
  const flags=[...new Set([...(candidate.sourceReviewFlags||[]),...(db.sourceReviewFlags||[]),...(db.remainingIdenticalGeometry?['remaining-identical-geometry']:[])])];
  const route=flags.length?'Periksa konflik sumber':sharedYears.length&&!unresolvedRefs.length?'Antrean peninjauan lokasi':'Periksa periode bukti';
  return {unitId:candidate.unitId,sourceFeatureIndex:candidate.sourceFeatureIndex,route,sourceReviewFlags:flags,
   lossObservationYears:lossYears,bpbdObservationYears:years,sharedCalendarYears:sharedYears,
   fireYearsBeyondLossProduct:years.filter(y=>y>2025),firstBpbdDate:dates[0]??null,lastBpbdDate:dates.at(-1)??null,
   responseRecordCategories:categories,responseRecordRefs:candidate.references.bpbdResponseRecordRefs,unresolvedDateRefs:unresolvedRefs,
   burnIndicationCount:candidate.references.burnIndications,canalObservationYear:2017,
   simultaneousThreePressuresConfirmed:false,sameLocationFireLossConfirmed:false,sourceUnitApproved:db.analysisUnitApproved,
   finalPriority:'Belum dinilai',score:null};
 });
 return {access:'staff_only',rows,summary:{candidateUnits:rows.length,withSharedCalendarYear:rows.filter(r=>r.sharedCalendarYears.length).length,
  siteReviewQueue:rows.filter(r=>r.route==='Antrean peninjauan lokasi').length,periodReviewQueue:rows.filter(r=>r.route==='Periksa periode bukti').length,
  sourceConflictQueue:rows.filter(r=>r.route==='Periksa konflik sumber').length,finalPriorityAssessed:0},approvalGranted:false,scoringValidated:false};
}
export async function run(candidateDirectory,canalDirectory,databaseDirectory){
 const privateRoot=await fs.realpath(path.join(root,'private-data'));
 if(privateRoot!==path.join(await fs.realpath(root),'private-data'))throw Error('Private root redirected');
 async function read(dir,name,max=32*1024*1024){const directory=await fs.realpath(path.resolve(root,dir)),file=await fs.realpath(path.join(directory,name));if(!directory.startsWith(privateRoot+path.sep)||!file.startsWith(directory+path.sep)||(await fs.stat(file)).size>max)throw Error('Private bounded review input required');return fs.readFile(file);}
 const candidateBytes=await read(candidateDirectory,'candidates.json'),manifestBytes=await read(candidateDirectory,'manifest.json',65536),canalBytes=await read(canalDirectory,'evidence.json'),dbBytes=await read(databaseDirectory,'validation-matrix.json'),dbManifestBytes=await read(databaseDirectory,'manifest.json',65536);
 const candidates=JSON.parse(candidateBytes),manifest=JSON.parse(manifestBytes),canals=JSON.parse(canalBytes),database=JSON.parse(dbBytes),dbManifest=JSON.parse(dbManifestBytes);
 const sourceBytes=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson')),bbsdlpSha=sha(sourceBytes),original=JSON.parse(sourceBytes);
 if([candidates,manifest,canals,database,dbManifest].some(d=>d.access!=='staff_only')||manifest.canalEvidenceSha256!==sha(canalBytes)||manifest.databaseEvidenceSha256!==sha(dbBytes)||manifest.databaseManifestSha256!==sha(dbManifestBytes)||manifest.bbsdlpSha256!==bbsdlpSha||canals.bbsdlpSha256!==bbsdlpSha||dbManifest.bbsdlpSha256!==bbsdlpSha||manifest.unitsSha256!==canals.unitsSha256||manifest.unitsSha256!==dbManifest.unitsSha256)throw Error('Review source version mismatch');
 const result=review(candidates,canals,database),output=await fs.mkdtemp(path.join(privateRoot,'restoration-candidate-review-'));
 await fs.writeFile(path.join(output,'review.json'),JSON.stringify(result,null,2),{flag:'wx'});
 const collection={type:'FeatureCollection',metadata:{access:'staff_only',purpose:'Review routing only; not final restoration priority',sourceSha256:bbsdlpSha},features:result.rows.map(row=>{
  const source=original.features[row.sourceFeatureIndex];if(!Number.isSafeInteger(row.sourceFeatureIndex)||row.sourceFeatureIndex<0||!source)throw Error('Invalid original geometry reference');
  return {type:'Feature',id:row.unitId,geometry:source.geometry,properties:{sourceFeatureIndex:row.sourceFeatureIndex,sourceSha256:bbsdlpSha,reviewRoute:row.route,sourceDistrictLabel:source.properties?.KABKOT??null,sourceAlternativeDistrictLabel:source.properties?.KK??null,sourceReviewFlags:row.sourceReviewFlags,sharedCalendarYears:row.sharedCalendarYears,sourceUnitApproved:row.sourceUnitApproved,finalPriority:'Belum dinilai',score:null}};
 })};
 await fs.writeFile(path.join(output,'review-units.geojson'),JSON.stringify(collection),{flag:'wx'});
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({access:'staff_only',createdAt:new Date().toISOString(),candidateSha256:sha(candidateBytes),candidateManifestSha256:sha(manifestBytes),canalEvidenceSha256:sha(canalBytes),databaseEvidenceSha256:sha(dbBytes),bbsdlpSha256:bbsdlpSha,approvalGranted:false,limitations:['Routing is a review worklist, not an ecological ranking or approved source correction.','A shared year within a unit does not prove same-pixel burning/loss or causation.','2017 mapped canal/road corridors do not prove present-day canal condition.','2026 response records have no matching 2026 layer in GFC-2025; not absence of opening.','No source input, approval flag, numerical score or production data is modified.']},null,2),{flag:'wx'});
 return {output,...result.summary,approvalGranted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==5)throw Error('Provide private candidate, canal and database packages');console.log(JSON.stringify(await run(...process.argv.slice(2)),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
