// Source-bound review queue only. No ranking, automatic validation or public geometry.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {sha256} from './read-restoration-brg.mjs';
import {historicalFireCanalCandidate} from './review-restoration-brg-forest-loss.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function reviewFeature(source,unit,overlay,sourceSha){
 if(!source?.geometry||!unit||unit.unitId!==overlay?.unitId||unit.sourceFeatureIndex!==overlay.sourceFeatureIndex||unit.score!==null||unit.forestOpeningValidated!==false||unit.finalPriority!=='Belum dinilai'||unit.errors.length||!unit.loss2018to2025Refs.length||!historicalFireCanalCandidate(overlay))throw Error('Unapproved source-bound candidate required');
 const expected=`bbsdlp-${sourceSha.slice(0,16)}-${String(unit.sourceFeatureIndex+1).padStart(4,'0')}`;if(unit.unitId!==expected)throw Error('Source identity mismatch');
 return {type:'Feature',id:unit.unitId,geometry:structuredClone(source.geometry),properties:{sourceFeatureIndex:unit.sourceFeatureIndex,sourceFeatureSha256:sha256(JSON.stringify(source)),sourceAttributes:structuredClone(source.properties),reviewCandidate:true,reviewBasis:'Observed GFC 2018–2025 tree-cover-loss centers inside archival BRG swamp-forest/unit intersections, with unit-level historical fire and canal-line evidence',lossFragmentRefs:unit.loss2018to2025Refs.slice(),fireFragmentRefs:overlay.firePositiveRefs.map(r=>({sourceFeatureIndex:r.sourceFeatureIndex,years:r.years.slice()})),canalPartsIntersecting:overlay.canalPartsIntersecting,forestObservationYear:null,canalObservationYear:null,scoringValidated:false,sourceUnitApproved:false,ecologicalScore:null,implementationReadiness:{assessed:false,score:null},priority:'Belum dinilai',restrictions:['Metadata land-cover claim 2016 and PL17 field hint remain unresolved','AREA_KANAL is source-described one-kilometre reach context, not a direct line intersection','Separate canal-line observation date remains unknown','Signals at unit scale do not prove common-location or simultaneous pressure','Original unit overlaps and source attribute conflicts are retained']}};
}
export async function run(overlayDirectory,forestDirectory,metadataDirectory,reviewDate){
 if(typeof reviewDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(reviewDate)||!Number.isFinite(Date.parse(reviewDate))||new Date(reviewDate).toISOString().slice(0,10)!==reviewDate)throw Error('Explicit valid review date YYYY-MM-DD required');
 const privateRoot=await fs.realpath(path.join(root,'private-data'));if(privateRoot!==path.join(await fs.realpath(root),'private-data'))throw Error('Redirected private root');
 async function read(directory,name,max=64*1024*1024){const dir=await fs.realpath(path.resolve(root,directory)),file=await fs.realpath(path.join(dir,name));if(!dir.startsWith(privateRoot+path.sep)||!file.startsWith(dir+path.sep)||(await fs.stat(file)).size>max)throw Error('Private bounded input required');return fs.readFile(file);}
 const overlayBytes=await read(overlayDirectory,'overlay.json'),overlayManifest=JSON.parse(await read(overlayDirectory,'manifest.json',1024*1024)),forestBytes=await read(forestDirectory,'forest-loss-review.json'),forestManifest=JSON.parse(await read(forestDirectory,'manifest.json',1024*1024)),metadataBytes=await read(metadataDirectory,'metadata-review.json',2*1024*1024),metadata=JSON.parse(metadataBytes),sourceBytes=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson')),sourceSha=sha256(sourceBytes);
 if([overlayManifest,forestManifest,metadata].some(m=>m.access!=='staff_only')||overlayManifest['overlay.jsonSha256']!==sha256(overlayBytes)||forestManifest.forestLossReviewSha256!==sha256(forestBytes)||forestManifest.overlaySha256!==sha256(overlayBytes)||overlayManifest.peatSourceSha256!==sourceSha||forestManifest.peatSha256!==sourceSha||metadata.inventorySha256!==overlayManifest.inventorySha256)throw Error('Evidence lineage mismatch');
 const overlay=JSON.parse(overlayBytes),forest=JSON.parse(forestBytes),original=JSON.parse(sourceBytes),byId=new Map(overlay.units.map(u=>[u.unitId,u])),reviewed=new Set(forest.units.map(u=>u.unitId)),eligible=overlay.units.filter(historicalFireCanalCandidate),missing=eligible.filter(u=>!reviewed.has(u.unitId));
 if(new Set(forest.units.map(u=>u.unitId)).size!==forest.units.length)throw Error('Repeated forest unit identity');
 const features=[];
 for(const u of forest.units)if(u.loss2018to2025Refs.length&&u.errors.length===0){
  const o=byId.get(u.unitId),fragments=new Set(forest.rows.filter(r=>r.unitId===u.unitId&&r.mappedTreeLoss2018to2025===true&&r.lossPixels2018to2025>0).map(r=>r.brgFragmentIndex));
  if(u.loss2018to2025Refs.some(i=>!fragments.has(i)))throw Error('Untraced raster evidence');
  features.push(reviewFeature(original.features[u.sourceFeatureIndex],u,o,sourceSha));
 }
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-brg-review-queue-'));
 const selectionAudit={access:'staff_only',reviewDate,eligibleFromFireAndVectorCanals:eligible.length,forestUnitsAlreadyReviewed:forest.units.length,missingEligibleUnits:missing.map(u=>u.unitId),selectionUsesNonForestLabel:false,candidatesForReview:features.length,scoringValidated:false};
 const geojson={type:'FeatureCollection',metadata:{access:'staff_only',purpose:'Review candidates only; not final restoration priorities',sourceSha256:sourceSha,ecologicalScore:null},features},geoBytes=JSON.stringify(geojson);
 await fs.writeFile(path.join(output,'review-candidates.geojson'),geoBytes,{flag:'wx'});await fs.writeFile(path.join(output,'selection-audit.json'),JSON.stringify(selectionAudit,null,2),{flag:'wx'});
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({access:'staff_only',createdAt:new Date().toISOString(),overlaySha256:sha256(overlayBytes),forestReviewSha256:sha256(forestBytes),metadataReviewSha256:sha256(metadataBytes),originalPeatSha256:sourceSha,reviewCandidatesSha256:sha256(geoBytes),sourceGeometryModified:false,priorityAssessed:false,summary:selectionAudit},null,2),{flag:'wx'});
 console.log(JSON.stringify({output,...selectionAudit},null,2));return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run(...process.argv.slice(2)).catch(e=>{console.error(e.stack);process.exitCode=1;});
