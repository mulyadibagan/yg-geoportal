// Offline comparison evidence only: never changes BBSDLP attributes or approves a score.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {BASE,PUBLIC_WHERE,queryUrl} from './acquire-restoration-big-reference.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const SOURCE_SHA='168b6afbcdc310c313a98876a74fb5feb47fdb0ddf69ea14304347e4617eb2e0';
export async function loadReference(directory){
 const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json')));
 if(manifest.source!==BASE||manifest.selection!==PUBLIC_WHERE||!Array.isArray(manifest.parts))throw Error('Unexpected reference manifest');
 const metadata=await fs.readFile(path.join(directory,'layer-metadata.json'));
 const indexBytes=await fs.readFile(path.join(directory,'public-object-ids.json'));
 if(hash(metadata)!==manifest.metadataSha256||hash(indexBytes)!==manifest.objectIdsSha256)throw Error('Reference metadata checksum mismatch');
 const ids=JSON.parse(indexBytes).objectIds;
 if(!Array.isArray(ids)||ids.length!==manifest.featureCount||new Set(ids).size!==ids.length)throw Error('Invalid reference index');
 const features=[],seen=new Set();let size=0;
 for(const part of manifest.parts){
  if(!/^features-\d{4}\.geojson$/.test(part.name)||part.url!==queryUrl(part.objectIds))throw Error('Invalid reference part');
  const bytes=await fs.readFile(path.join(directory,part.name));
  if(bytes.length!==part.bytes||hash(bytes)!==part.sha256)throw Error('Reference part checksum mismatch');
  const data=JSON.parse(bytes);
  if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length!==part.featureCount||data.exceededTransferLimit)throw Error('Incomplete reference part');
  for(const feature of data.features){
   const id=feature.properties?.objectid_1??feature.id;
   if(!part.objectIds.includes(id)||!ids.includes(id)||seen.has(id))throw Error('Reference identity mismatch');
   seen.add(id);features.push(feature);
  }
  size+=bytes.length;
 }
 if(seen.size!==ids.length||size!==manifest.totalBytes)throw Error('Incomplete reference package');
 return {manifest,manifestSha256:hash(await fs.readFile(path.join(directory,'manifest.json'))),features};
}
export function compareGroups(original,reference,T){
 const groups=new Map();
 original.features.forEach((feature,index)=>{const key=hash(JSON.stringify(feature.geometry));const rows=groups.get(key)||[];rows.push({sourceRow:index+1,feature});groups.set(key,rows);});
 const conflicts=[...groups.values()].filter(rows=>rows.length>1&&new Set(rows.map(row=>JSON.stringify(row.feature.properties))).size>1);
 const bboxOverlaps=(a,b)=>!(a[0]>b[2]||a[2]<b[0]||a[1]>b[3]||a[3]<b[1]);
 const valid=feature=>{try{return T.booleanValid(feature)&&T.kinks(feature).features.length===0;}catch{return false;}};
 const indexed=reference.map(feature=>{let bbox=null;try{bbox=T.bbox(feature);if(!bbox.every(Number.isFinite))bbox=null;}catch{}return {feature,bbox};});
 const validity=new Map();
 return conflicts.map(rows=>{
  const feature=rows[0].feature,unitValid=valid(feature),bbox=T.bbox(feature),observations=[];
  let excluded=0,errors=0,candidates=0;
  if(unitValid)for(const row of indexed){
   if(!row.bbox){excluded++;continue;}
   if(!bboxOverlaps(bbox,row.bbox))continue;
   candidates++;
   if(!validity.has(row.feature))validity.set(row.feature,valid(row.feature));
   if(!validity.get(row.feature)){excluded++;continue;}
   try{
    const intersection=T.intersect(T.featureCollection([feature,row.feature]));
    if(intersection&&T.area(intersection)>0){const p=row.feature.properties;observations.push({objectId:p.objectid_1??row.feature.id,kode_khg:p.kode_khg??null,peat_thick:p.peat_thick??null,tnh_gambut:p.tnh_gambut??null,feg_peat:p.feg_peat??null,feg_50k:p.feg_50k??null});}
   }catch{errors++;}
  }
  return {sourceRows:rows.map(row=>row.sourceRow),geometrySha256:hash(JSON.stringify(feature.geometry)),sourceAttributes:rows.map(row=>({sourceRow:row.sourceRow,attributes:row.feature.properties})),geometryCheckPassed:unitValid,bboxCandidates:candidates,observations,excludedReferenceFeatures:excluded,overlayErrors:errors,status:!unitValid||excluded||errors?'incomplete-reference-evidence':observations.length?'reference-overlaps-only':'no-reference-overlap',appliedCorrection:null,scoringValidated:false};
 });
}
export async function compare(directory){
 const privateRoot=await fs.realpath(path.join(root,'private-data')),input=await fs.realpath(path.resolve(root,directory));
 if(path.dirname(input)!==privateRoot||!path.basename(input).startsWith('restoration-big-reference-'))throw Error('Reference must remain private');
 const reference=await loadReference(input);
 const source=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson'));
 if(hash(source)!==SOURCE_SHA)throw Error('Unexpected BBSDLP source version');
 const require=createRequire(path.join(privateRoot,'restoration-runtime/package.json')),T=require('@turf/turf');
 const groups=compareGroups(JSON.parse(source),reference.features,T);
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-big-comparison-'));
 const result={schemaVersion:1,access:'staff_only',createdAt:new Date().toISOString(),sourceSha256:SOURCE_SHA,referenceManifestSha256:reference.manifestSha256,referenceFeatureCount:reference.features.length,groups,decisionsApplied:false,scoringValidated:false,limitations:['FEG reference is not the original BBSDLP source or a correction instruction.','Positive polygon intersection is context, not complete coverage or field validation.','No depth midpoint, district correction, area total or ecological score is inferred.','No administrative comparison is possible from the selected FEG fields.']};
 await fs.writeFile(path.join(output,'comparison.json'),JSON.stringify(result,null,2),{flag:'wx'});
 return {output,referenceFeatures:reference.features.length,conflictGroups:groups.length,groupsWithEvidence:groups.filter(row=>row.observations.length).length,incompleteGroups:groups.filter(row=>row.status==='incomplete-reference-evidence').length,correctionsApplied:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==3)throw Error('Provide a private reference directory');console.log(JSON.stringify(await compare(process.argv[2]),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
