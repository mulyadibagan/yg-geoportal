// Review-only overlay validation. This never replaces source geometry or approves indicators.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import A from '../js/restoration-scoring.js';
import {independentValidity,reviewSelfTouch} from './diagnose-restoration-geometry.mjs';
import {loadPackage} from './audit-restoration-bpbd.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validateCandidate(source,candidate,J,T,records=[]){
 const expected=reviewSelfTouch(source,J);
 if(!expected?.candidate||JSON.stringify(candidate.geometry)!==JSON.stringify(expected.candidate)||candidate.properties?.reviewOnly!==true||candidate.properties.analysisUnitApproved!==false||candidate.properties.scoringValidated!==false)throw Error('Candidate differs from exact unapproved source-derived review representation');
 const geometry=new J.io.GeoJSONReader().read(candidate.geometry);
 const hole=new J.io.GeoJSONReader().read({type:'Polygon',coordinates:[candidate.geometry.coordinates[1]]});
 const checks={boundaryEdgesPreserved:expected.boundaryEdgesPreserved,defaultJstsValid:independentValidity(candidate,J).valid,
  holeInteriorExcluded:!geometry.covers(hole.getInteriorPoint()),selfIntersectionUnchanged:geometry.intersection(geometry).equalsTopo(geometry),selfDifferenceEmpty:geometry.difference(geometry).isEmpty()};
 const b=T.bbox(candidate),reader=new J.io.GeoJSONReader();
 const membership=[];let originalCandidateDisagreements=0,candidateEngineDisagreements=0,boundaryRecords=0;
 for(const record of records){
  const points=record.feature.geometry.type==='Point'?[record.feature.geometry.coordinates]:record.feature.geometry.coordinates;
  let originalInside=false,candidateInside=false,jstsInside=false,onBoundary=false;
  for(const c of points){
   if(c[0]<b[0]||c[0]>b[2]||c[1]<b[1]||c[1]>b[3])continue;
   originalInside ||= A.contains(c,source.geometry);candidateInside ||= A.contains(c,candidate.geometry);
   const p=reader.read({type:'Point',coordinates:c}),covered=geometry.covers(p);
   jstsInside ||= covered;onBoundary ||= covered&&!geometry.contains(p);
  }
  if(originalInside!==candidateInside)originalCandidateDisagreements++;
  if(candidateInside!==jstsInside)candidateEngineDisagreements++;
  if(onBoundary)boundaryRecords++;
  if(originalInside||candidateInside||jstsInside||onBoundary)membership.push({recordRef:record.ref,originalEvenOddReference:originalInside,candidateEvenOddReference:candidateInside,candidateJstsCovers:jstsInside,onBoundary});
 }
 return {checks,technicalChecksPassed:Object.values(checks).every(Boolean),turfBooleanValid:T.booleanValid(candidate),turfKinkDetections:T.kinks(candidate).features.length,
  testedResponseRecords:records.length,pointComparisonPassed:records.length?originalCandidateDisagreements===0&&candidateEngineDisagreements===0:null,originalCandidateDisagreements,candidateEngineDisagreements,boundaryRecords,membership,
  sourceGeometryApproved:false,candidateApproved:false,score:null,limitations:['Original invalid-ring parity is diagnostic only, not a valid-source containment claim.','Agreement on observed response points does not prove all-point equivalence or authoritative cartographic intent.','Turf contact warnings remain visible; this report does not relax the application gate.']};
}
export async function run(directory,bpbdDirectory){
 const privateRoot=await fs.realpath(path.join(root,'private-data')),dir=await fs.realpath(path.resolve(root,directory));
 if(privateRoot!==path.join(await fs.realpath(root),'private-data')||!dir.startsWith(privateRoot+path.sep))throw Error('Private input required');
 async function read(name,max){const file=await fs.realpath(path.join(dir,name));if(!file.startsWith(dir+path.sep)||(await fs.stat(file)).size>max)throw Error('Invalid review input');return fs.readFile(file);}
 const diagnosticBytes=await read('diagnostic.json',4*1024*1024),candidateBytes=await read('review-only-candidates.geojson',4*1024*1024);
 const report=JSON.parse(diagnosticBytes),candidates=JSON.parse(candidateBytes),sourceBytes=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson')),original=JSON.parse(sourceBytes);
 if(report.access!=='staff_only'||report.sourceSha256!==sha(sourceBytes)||candidates.type!=='FeatureCollection'||!Array.isArray(candidates.features)||candidates.features.length>64||new Set(candidates.features.map(f=>f.id)).size!==candidates.features.length)throw Error('Invalid source/review provenance');
 const require=createRequire(path.join(privateRoot,'restoration-runtime/package.json')),J=require('jsts'),T=require('@turf/turf');
 if(require('jsts/package.json').version!=='2.7.1'||require('@turf/turf/package.json').version!=='7.2.0')throw Error('Unexpected validator version');
 const bpbd=bpbdDirectory?await loadPackage(path.resolve(root,bpbdDirectory),privateRoot):{sources:[],records:[]};
 const cases=candidates.features.map(candidate=>{
  const p=candidate.properties,entry=report.cases.find(c=>c.unitId===p.sourceUnitId);
  if(!entry||candidate.id!=='review-only-'+p.sourceUnitId||p.sourceSha256!==sha(sourceBytes)||entry.sourceFeatureIndex!==p.sourceFeatureIndex||!Number.isSafeInteger(p.sourceFeatureIndex)||p.sourceFeatureIndex<0||!original.features[p.sourceFeatureIndex])throw Error('Invalid candidate source reference');
  return {sourceUnitId:p.sourceUnitId,sourceFeatureIndex:p.sourceFeatureIndex,...validateCandidate(original.features[p.sourceFeatureIndex],candidate,J,T,bpbd.records)};
 });
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-candidate-validation-'));
 await fs.writeFile(path.join(output,'validation.json'),JSON.stringify({access:'staff_only',sourceSha256:sha(sourceBytes),diagnosticSha256:sha(diagnosticBytes),candidateSha256:sha(candidateBytes),bpbdManifestSha256:bpbd.manifestSha256??null,bpbdSources:bpbd.sources,jstsVersion:'2.7.1',turfVersion:'7.2.0',cases,sourceModified:false,approvalGranted:false,scoringValidated:false},null,2),{flag:'wx'});
 return {output,cases:cases.length,technicalChecksPassed:cases.filter(c=>c.technicalChecksPassed).length,originalCandidateDisagreements:cases.reduce((n,c)=>n+c.originalCandidateDisagreements,0),candidateEngineDisagreements:cases.reduce((n,c)=>n+c.candidateEngineDisagreements,0),approvalGranted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length<3||process.argv.length>4)throw Error('Provide private diagnostic package and optional private BPBD package');console.log(JSON.stringify(await run(process.argv[2],process.argv[3]),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
