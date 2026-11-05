// Offline diagnostic evidence only: never repairs geometry or approves spatial/scoring inputs.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function independentValidity(feature,J){
 const geometry=new J.io.GeoJSONReader().read(feature.geometry);
 const operation=new J.operation.valid.IsValidOp(geometry),valid=operation.isValid(),error=operation.getValidationError();
 const coordinate=error?.getCoordinate();
 return {engine:'JSTS IsValidOp',valid,error:error?{code:error.getErrorType(),message:error.getMessage(),coordinate:coordinate?[coordinate.x,coordinate.y]:null}:null,
  selfTouchingRingFormingHoleAllowed:false,precisionReductionApplied:false,geometryModified:false,analysisUnitApproved:false};
}
export function reviewSelfTouch(feature,J){
 const g=feature.geometry,originalCheck=independentValidity(feature,J);
 if(g.type!=='Polygon'||g.coordinates.length!==1||originalCheck.valid||originalCheck.error?.code!==6)return null;
 const ring=g.coordinates[0],seen=new Map(),repeats=[];
 for(let i=0;i<ring.length-1;i++){const key=JSON.stringify(ring[i]);if(seen.has(key))repeats.push([seen.get(key),i]);else seen.set(key,i);}
 if(repeats.length!==1)return {status:'requires-manual-ring-review',candidate:null};
 const [a,b]=repeats[0],cycles=[ring.slice(a,b+1),[...ring.slice(b,-1),...ring.slice(0,a+1)]];
 if(cycles.some(c=>c.length<4))return {status:'requires-manual-ring-review',candidate:null};
 const reader=new J.io.GeoJSONReader(),parts=cycles.map(c=>reader.read({type:'Polygon',coordinates:[c]}));
 if(parts.some(p=>!new J.operation.valid.IsValidOp(p).isValid()))return {status:'invalid-cycle-review',candidate:null};
 const outer=parts[0].covers(parts[1])?0:parts[1].covers(parts[0])?1:null;
 if(outer===null||parts[0].getBoundary().intersection(parts[1].getBoundary()).getDimension()!==0)return {status:'non-nested-or-shared-edge-review',candidate:null};
 const candidate={type:'Polygon',coordinates:[cycles[outer],cycles[1-outer]]};
 const edgeSignature=rings=>{const entries=rings.flatMap(r=>r.slice(0,-1).map((p,i)=>JSON.stringify([p,r[i+1]]))).sort();return JSON.stringify(entries);};
 const boundaryEdgesPreserved=edgeSignature([ring])===edgeSignature(candidate.coordinates);
 const check=independentValidity({type:'Feature',geometry:candidate},J);
 return {status:'review-only-shell-hole-representation',repeatedVertexIndices:[a,b],cycleVertexCounts:cycles.map(c=>c.length),boundaryContactDimension:0,boundaryEdgesPreserved,
  candidateValidity:check,sourceModified:false,analysisUnitApproved:false,candidate:boundaryEdgesPreserved&&check.valid?candidate:null};
}
export function diagnose(feature,T){
 const geometry=feature?.geometry;
 if(!['Polygon','MultiPolygon'].includes(geometry?.type))throw Error('Polygon source required');
 const coordinates=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 const vertices=coordinates.flat().reduce((n,ring)=>n+ring.length,0);
 if(coordinates.length>128||vertices>30000)throw Error('Diagnostic geometry bound exceeded');
 const components=coordinates.map((rings,index)=>{
  const polygon=T.polygon(rings),kinks=T.kinks(polygon).features.length;
  const ringDiagnostics=rings.map((ring,ringIndex)=>{
   const seen=new Map(),repeatedVertexIndices=[],zeroLengthSegmentIndices=[];
   for(let i=0;i<ring.length;i++){
    const key=JSON.stringify(ring[i]);
    if(i<ring.length-1){if(seen.has(key))repeatedVertexIndices.push([seen.get(key),i]);else seen.set(key,i);}
    if(i&&JSON.stringify(ring[i-1])===key)zeroLengthSegmentIndices.push(i-1);
   }
   return {ringIndex,closed:JSON.stringify(ring[0])===JSON.stringify(ring.at(-1)),repeatedVertexIndices,zeroLengthSegmentIndices};
  });
  return {index,rings:rings.length,vertices:rings.reduce((n,r)=>n+r.length,0),ringDiagnostics,booleanValid:T.booleanValid(polygon),kinkDetections:kinks,polygon,bbox:T.bbox(polygon)};
 });
 const pairs=[];
 for(let i=0;i<components.length;i++)for(let j=i+1;j<components.length;j++){
  const a=components[i],b=components[j];
  if(a.bbox[0]>b.bbox[2]||a.bbox[2]<b.bbox[0]||a.bbox[1]>b.bbox[3]||a.bbox[3]<b.bbox[1])continue;
  let boundaryIntersectionDetections=null,positiveAreaIntersection=null,error=null;
  try{
   boundaryIntersectionDetections=T.lineIntersect(a.polygon,b.polygon).features.length;
   if(a.booleanValid&&!a.kinkDetections&&b.booleanValid&&!b.kinkDetections){
    const intersection=T.intersect(T.featureCollection([a.polygon,b.polygon]));
    positiveAreaIntersection=intersection?T.area(intersection)>0:false;
   }
  }catch(e){error=e.message;}
  if(boundaryIntersectionDetections||positiveAreaIntersection||error)pairs.push({componentIndices:[i,j],boundaryIntersectionDetections,positiveAreaIntersection,error});
 }
 const whole={booleanValid:T.booleanValid(feature),kinkDetections:T.kinks(feature).features.length};
 return {geometryType:geometry.type,whole,components:components.map(({polygon,bbox,...row})=>row),componentInteractions:pairs,
  findings:[...(components.some(c=>!c.booleanValid||c.kinkDetections)?['within-component-geometry-issue']:[]),...(pairs.some(p=>p.positiveAreaIntersection)?['positive-area-between-components']:[]),...(pairs.some(p=>p.boundaryIntersectionDetections)?['component-boundary-intersections']:[]),...(pairs.some(p=>p.error)?['component-comparison-error']:[])],
  geometryModified:false,geometryApproved:false,scoringValidated:false};
}
export async function run(directory){
 const privateRoot=await fs.realpath(path.join(root,'private-data')),dir=await fs.realpath(path.resolve(root,directory));
 if(privateRoot!==path.join(await fs.realpath(root),'private-data')||!dir.startsWith(privateRoot+path.sep))throw Error('Private input required');
 async function read(name,max){const file=await fs.realpath(path.join(dir,name));if(!file.startsWith(dir+path.sep)||(await fs.stat(file)).size>max)throw Error('Invalid private input file');return fs.readFile(file);}
 const matrixBytes=await read('validation-matrix.json',32*1024*1024),manifestBytes=await read('manifest.json',65536);
 const matrix=JSON.parse(matrixBytes),manifest=JSON.parse(manifestBytes);
 const sourceBytes=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson')),source=JSON.parse(sourceBytes);
 if(matrix.access!=='staff_only'||manifest.access!=='staff_only'||manifest.bbsdlpSha256!==sha(sourceBytes))throw Error('Source provenance mismatch');
 const queue=matrix.bpbd?.geometryReviewQueue;
 if(!Array.isArray(queue)||queue.length>64||new Set(queue.map(q=>q.unitId)).size!==queue.length)throw Error('Invalid geometry review queue');
 const require=createRequire(path.join(privateRoot,'restoration-runtime/package.json')),T=require('@turf/turf'),J=require('jsts');
 if(require('@turf/turf/package.json').version!=='7.2.0')throw Error('Use existing pinned Turf 7.2.0 runtime');
 if(require('jsts/package.json').version!=='2.7.1')throw Error('Use existing JSTS 2.7.1 runtime');
 const cases=queue.map(q=>{
  const row=matrix.units.find(unit=>unit.unitId===q.unitId);
  if(!row||row.geometryCheckPassed!==false||row.sourceFeatureIndex!==q.sourceFeatureIndex||!Number.isSafeInteger(q.sourceFeatureIndex)||q.sourceFeatureIndex<0||!source.features[q.sourceFeatureIndex])throw Error('Invalid source review reference');
  const feature=source.features[q.sourceFeatureIndex];
  return {unitId:q.unitId,sourceFeatureIndex:q.sourceFeatureIndex,sourceRowNumber:q.sourceFeatureIndex+1,candidateResponseRecords:q.bpbdResponseRefs.length,...diagnose(feature,T),independentTopology:independentValidity(feature,J),ringReview:reviewSelfTouch(feature,J)};
 });
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-geometry-diagnostic-'));
 const report={access:'staff_only',sourceSha256:sha(sourceBytes),matrixSha256:sha(matrixBytes),inputManifestSha256:sha(manifestBytes),turfVersion:'7.2.0',jstsVersion:'2.7.1',jstsBundleSha256:sha(await fs.readFile(require.resolve('jsts'))),cases,geometryModified:false,approvalGranted:false,limitations:['JSTS IsValidOp is separate from Turf booleanValid/kinks algorithms, not an independent expert review or GEOS certification.','Boundary intersections and positive-area component intersections are distinct.','No snapping, buffering, union, simplification, component removal or source correction is applied.','Source row numbers are one-based; sourceFeatureIndex is zero-based.','Engine disagreements do not alter original eligibility flags or source conflicts.']};
 await fs.writeFile(path.join(output,'diagnostic.json'),JSON.stringify(report,null,2),{flag:'wx'});
 const candidates={type:'FeatureCollection',features:cases.filter(c=>c.ringReview?.candidate).map(c=>({type:'Feature',id:'review-only-'+c.unitId,geometry:c.ringReview.candidate,properties:{reviewOnly:true,sourceUnitId:c.unitId,sourceFeatureIndex:c.sourceFeatureIndex,sourceSha256:sha(sourceBytes),analysisUnitApproved:false,scoringValidated:false,purpose:'Separate review candidate, never a replacement source or scoring input'}}))};
 await fs.writeFile(path.join(output,'review-only-candidates.geojson'),JSON.stringify(candidates),{flag:'wx'});
 return {output,cases:cases.length,withCandidateResponses:cases.filter(c=>c.candidateResponseRecords>0).length,withinComponentIssues:cases.filter(c=>c.findings.includes('within-component-geometry-issue')).length,positiveComponentIntersections:cases.filter(c=>c.findings.includes('positive-area-between-components')).length,jstsValid:cases.filter(c=>c.independentTopology.valid).length,jstsInvalid:cases.filter(c=>!c.independentTopology.valid).length,geometryModified:false,approvalGranted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==3)throw Error('Provide private validation package directory');console.log(JSON.stringify(await run(process.argv[2]),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
