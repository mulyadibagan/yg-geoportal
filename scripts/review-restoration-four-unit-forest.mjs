// Native JRC comparison through an attributed COG mirror; not a final priority assessment.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadPackage} from './audit-restoration-bpbd.mjs';
import {cellAt} from './sample-restoration-candidate-loss.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base='https://data.source.coop/epoch/jrc-tmf',sha=b=>createHash('sha256').update(b).digest('hex');
export const PRODUCTS=Object.freeze(['AnnualChange_2024','AnnualChange_2025','TransitionMap_Subtypes']);
export function mirrorUrl(product){if(!PRODUCTS.includes(product))throw Error('Unsupported forest product');return `${base}/v1_2025/N10_E100/${product}.tif`;}
export function checkRange(request,contentRange,bytes){
 const q=/^bytes=(\d+)-(\d+)$/.exec(request||''),r=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange||'');
 if(!q||!r)throw Error('Exact single byte range required');
 const [start,end,total]=r.slice(1).map(Number),[requestedStart,requestedEnd]=q.slice(1).map(Number);
 if(![start,end,total,requestedStart,requestedEnd,bytes].every(Number.isSafeInteger)||start!==requestedStart||end!==Math.min(requestedEnd,total-1)||start>end||total<=end||bytes!==end-start+1||bytes>2*1024*1024)throw Error('Incomplete or changed range');
 return {start,end,total};
}
export function compareClasses(before,after,subtype){
 if(![before,after].every(x=>Number.isInteger(x)&&x>=0&&x<=6)||!Number.isInteger(subtype)||![0,10,11,12,21,22,23,24,25,26,31,32,33,41,42,51,52,53,54,61,62,63,64,65,66,67,71,72,73,74,81,82,83,84,85,86,91,92,93,94].includes(subtype))throw Error('Unknown JRC class');
 const plantation=[81,82,83,84,85,86].includes(subtype),priorForest=[1,2].includes(before),missing=before===0||after===0||subtype===0;
 const temporalConflict=before===3&&subtype===53||priorForest&&after===3&&[41,42,51,52,65,66].includes(subtype);
 return {beforeClass:before,afterClass:after,transitionSubtype:subtype,plantationClassObserved:plantation,
  deforestedLandObservedAtSample:after===3?true:null,
  temporalConflict,
  forestToDeforestedObserved:!missing&&!temporalConflict&&priorForest&&after===3&&subtype===53&&!plantation?true:null,
  forestDisturbanceObserved:!missing&&!temporalConflict&&priorForest&&(after===3&&subtype===53||after===2&&subtype===54)&&!plantation?true:null,
  reviewStatus:missing?'Data belum tersedia':temporalConflict?'Periksa ketidaksesuaian kelas tahunan dan transisi':plantation?'Kelas perkebunan sumber':priorForest&&after===3&&subtype===53?'Perubahan hutan ke lahan terdeforestasi terpetakan':after===3?'Lahan terdeforestasi historis terpetakan':priorForest&&after===2?'Hutan terdegradasi terpetakan':'Belum mendukung bukaan hutan pada sampel',validated:false,score:null};
}
async function gisRuntime(privateRoot){
 const require=createRequire(path.join(privateRoot,'restoration-runtime/package.json')),G=require('geotiff'),T=require('@turf/turf');
 const BaseDecoder=require(path.join(path.dirname(require.resolve('geotiff')),'compression/basedecoder.js')).default,{ZSTDDecoder}=require('zstddec'),zstd=new ZSTDDecoder();await zstd.init();
 G.addDecoder(50000,()=>class extends BaseDecoder{
  constructor(directory){super();this.expected=directory.TileWidth*directory.TileLength;if(!Number.isSafeInteger(this.expected)||this.expected<=0||this.expected>16*1024*1024)throw Error('Unsupported decoded block size');}
  decodeBlock(buffer){const result=zstd.decode(new Uint8Array(buffer),this.expected);if(result.length!==this.expected)throw Error('Incomplete decoded forest block');return result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength);}
 });
 return {G,T};
}
export async function replay(directory){
 const privateRoot=await fs.realpath(path.join(root,'private-data')),dir=await fs.realpath(path.resolve(root,directory));if(!dir.startsWith(privateRoot+path.sep))throw Error('Private replay input required');
 async function read(name,max){const f=await fs.realpath(path.join(dir,name));if(!f.startsWith(dir+path.sep)||(await fs.stat(f)).size>max)throw Error('Bounded replay file required');return fs.readFile(f);}
 const manifest=JSON.parse(await read('manifest.json',1024*1024)),review=JSON.parse(await read('review.json',8*1024*1024));
 if(manifest.access!=='staff_only'||review.access!=='staff_only'||!manifest.completeRequiredRanges||manifest.sources.length!==3||manifest.ranges.length>500)throw Error('Incomplete private review package');
 if(new Set(manifest.sources.map(s=>s.product)).size!==3)throw Error('Duplicate forest source');
 for(const supporting of manifest.supportingFiles||[]){const bytes=await read(supporting.name,8*1024*1024);if(bytes.length!==supporting.bytes||sha(bytes)!==supporting.sha256)throw Error('Changed forest documentation');}
 const {G}=await gisRuntime(privateRoot);let verifiedValues=0;
 for(const source of manifest.sources){
  if(source.url!==mirrorUrl(source.product))throw Error('Changed mirror source identity');
  const client={url:source.url,async request({headers}){
   const range=manifest.ranges.find(r=>r.product===source.product&&headers.Range===`bytes=${r.start}-${r.end}`);
   if(!range||range.etag!==source.etag||range.total!==source.bytes)throw Error('Required native range missing');
   const bytes=await read(range.name,2*1024*1024);checkRange(headers.Range,`bytes ${range.start}-${range.end}/${range.total}`,bytes.length);if(bytes.length!==range.bytes||sha(bytes)!==range.sha256)throw Error('Stored range checksum mismatch');
   return {ok:true,status:206,getHeader:name=>name.toLowerCase()==='content-range'?`bytes ${range.start}-${range.end}/${range.total}`:null,async getData(){return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}};
  }};
  const h=await G.fromCustomClient(client,{blockSize:65536,cacheSize:100,maxRanges:0,allowFullFile:false});
  try{const image=await h.getImage(),grid={origin:image.getOrigin().slice(0,2),resolution:image.getResolution().slice(0,2),width:image.getWidth(),height:image.getHeight()};if(JSON.stringify(grid)!==JSON.stringify(source.grid))throw Error('Changed native grid');
   for(const row of review.rows)for(const sample of row.samples){const expected=sample.sourceValues[source.product],cell=cellAt(sample.point,grid);if(!cell||cell.row!==expected.row||cell.column!==expected.column)throw Error('Changed sample cell');const value=await image.readRasters({window:[cell.column,cell.row,cell.column+1,cell.row+1],samples:[0],interleave:true});if(value[0]!==expected.value)throw Error('Changed sample value');verifiedValues++;}
  }finally{await h.close();}
 }
 for(const row of review.rows)for(const sample of row.samples)if(JSON.stringify(compareClasses(sample.sourceValues.AnnualChange_2024.value,sample.sourceValues.AnnualChange_2025.value,sample.sourceValues.TransitionMap_Subtypes.value))!==JSON.stringify(sample.comparison))throw Error('Changed source interpretation');
 return {verifiedValues,networkRequests:0,reviewedUnits:review.rows.length};
}
export async function run(reviewDirectory,bpbdDirectory,databaseDirectory){
 const privateRoot=await fs.realpath(path.join(root,'private-data'));if(privateRoot!==path.join(await fs.realpath(root),'private-data'))throw Error('Redirected private root');
 async function read(dir,name,max=32*1024*1024){const d=await fs.realpath(path.resolve(root,dir)),f=await fs.realpath(path.join(d,name));if(!d.startsWith(privateRoot+path.sep)||!f.startsWith(d+path.sep)||(await fs.stat(f)).size>max)throw Error('Private bounded input required');return fs.readFile(f);}
 const reviewBytes=await read(reviewDirectory,'review.json'),reviewManifestBytes=await read(reviewDirectory,'manifest.json',65536),review=JSON.parse(reviewBytes),reviewManifest=JSON.parse(reviewManifestBytes),dbBytes=await read(databaseDirectory,'validation-matrix.json'),dbManifestBytes=await read(databaseDirectory,'manifest.json',65536),db=JSON.parse(dbBytes),dbManifest=JSON.parse(dbManifestBytes);
 const originalBytes=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson')),original=JSON.parse(originalBytes),bpbd=await loadPackage(path.resolve(root,bpbdDirectory),privateRoot),records=new Map(bpbd.records.map(r=>[r.ref,r]));
 if([review,reviewManifest,db,dbManifest].some(d=>d.access!=='staff_only')||reviewManifest.bbsdlpSha256!==sha(originalBytes)||dbManifest.bbsdlpSha256!==sha(originalBytes)||reviewManifest.bpbdManifestSha256!==bpbd.manifestSha256)throw Error('Source lineage mismatch');
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-four-unit-forest-')),ranges=[],sources=[],supportingFiles=[];let downloaded=0,rangeSequence=0;
 for(const [name,url,max] of [['mirror-readme.md',base+'/README.md',65536],['provider-guide.pdf','https://forobs.jrc.ec.europa.eu/static/tmf/TMF_DataUsersGuide.pdf',8*1024*1024]]){
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Forest documentation unavailable');let length=0;const chunks=[];for await(const c of response.body){length+=c.length;if(length>max)throw Error('Documentation too large');chunks.push(c);}const bytes=Buffer.concat(chunks);await fs.writeFile(path.join(output,name),bytes,{flag:'wx'});supportingFiles.push({name,url,bytes:bytes.length,sha256:sha(bytes)});
 }
 const {G,T}=await gisRuntime(privateRoot);
 const rows=review.rows.filter(r=>r.samplesWithMappedCorridor>0).map(unit=>{
  const source=original.features[unit.sourceFeatureIndex],database=db.units.find(r=>r.unitId===unit.unitId);
  if(!source||!database||database.sourceFeatureIndex!==unit.sourceFeatureIndex||!database.geometryCheckPassed||unit.unitId!==`bbsdlp-${sha(originalBytes).slice(0,16)}-${String(unit.sourceFeatureIndex+1).padStart(4,'0')}`)throw Error('Invalid source unit');
  const samples=unit.samples.filter(s=>s.mappedCanalRoadObserved===true).map(sample=>{
   const record=records.get(sample.responseRef),g=record?.feature.geometry,point=g?.type==='Point'&&sample.pointIndex===0?g.coordinates:g?.type==='MultiPoint'?g.coordinates[sample.pointIndex]:null;
   const b=sample.sourceFootprintWgs84;if(!point||record.calendarDate!==sample.date||!T.booleanPointInPolygon(T.point(point),source)||!Array.isArray(b)||!(point[0]>=b[0]&&point[0]<b[2]&&point[1]>b[1]&&point[1]<=b[3]))throw Error('Response source mismatch');
   return {responseRef:sample.responseRef,pointIndex:sample.pointIndex,date:sample.date,point,sourceValues:{}};
  });
  if(samples.length!==unit.samplesWithMappedCorridor||new Set(samples.map(s=>s.responseRef+':'+s.pointIndex)).size!==samples.length)throw Error('Changed response sample count');
  return {unitId:unit.unitId,sourceFeatureIndex:unit.sourceFeatureIndex,samples,inventoryContext:database.readinessContext,canalConditionVerified:false,forestOpeningValidated:false,finalPriority:'Belum dinilai',score:null,sourceUnitApproved:false};
 });
 if(!rows.length||new Set(rows.map(r=>r.unitId)).size!==rows.length)throw Error('Invalid review selection');
 for(const product of PRODUCTS){
  const url=mirrorUrl(product);let identity=null;const cached=new Map();
  const client={url,async request({headers}){
   const range=headers.Range;if(cached.has(range))return cached.get(range);
   if(!/^bytes=\d+-\d+$/.test(range)||Number(range.split('-')[1])-Number(range.match(/\d+/)[0])+1>2*1024*1024)throw Error('Bounded source range required');
   const response=await fetch(url,{headers:{Range:range,'Accept-Encoding':'identity',...(identity?{'If-Match':identity.etag}:{})},redirect:'error',signal:AbortSignal.timeout(30000)});
   if(response.status!==206){await response.body?.cancel();throw Error(`Mirror range unavailable ${response.status}`);}
   const chunks=[];let bytes=0;for await(const chunk of response.body){bytes+=chunk.length;downloaded+=chunk.length;if(bytes>2*1024*1024||downloaded>32*1024*1024)throw Error('Mirror transfer bound exceeded');chunks.push(chunk);}
   const data=Buffer.concat(chunks),parsed=checkRange(range,response.headers.get('content-range'),bytes),etag=response.headers.get('etag');if(!etag||etag.startsWith('W/'))throw Error('Stable source identity required');
   if(identity&&(identity.etag!==etag||identity.bytes!==parsed.total))throw Error('Mirror changed during sampling');identity??={product,url,etag,bytes:parsed.total,lastModified:response.headers.get('last-modified')};
   const name=`range-${String(rangeSequence++).padStart(4,'0')}.bin`;await fs.writeFile(path.join(output,name),data,{flag:'wx'});ranges.push({product,name,...parsed,bytes,sha256:sha(data),etag});
   const result={ok:true,status:206,getHeader:n=>response.headers.get(n),async getData(){return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);}};cached.set(range,result);return result;
  }};
  const handle=await G.fromCustomClient(client,{blockSize:65536,cacheSize:100,maxRanges:0,allowFullFile:false});
  try{
   const image=await handle.getImage(),grid={origin:image.getOrigin().slice(0,2),resolution:image.getResolution().slice(0,2),width:image.getWidth(),height:image.getHeight()};
   if(image.getGeoKeys().GeographicTypeGeoKey!==4326||image.getSamplesPerPixel()!==1||image.fileDirectory.BitsPerSample[0]!==8)throw Error('Unsupported forest grid');
   if(sources.length&&JSON.stringify(grid)!==JSON.stringify(sources[0].grid))throw Error('Misaligned annual/transition grids');
   const pixels=new Map();for(const row of rows)for(const sample of row.samples){const cell=cellAt(sample.point,grid);if(!cell)throw Error('Response outside actual mirror extent');const key=`${cell.row}:${cell.column}`;if(!pixels.has(key)){const value=await image.readRasters({window:[cell.column,cell.row,cell.column+1,cell.row+1],samples:[0],interleave:true});pixels.set(key,value[0]);}sample.sourceValues[product]={...cell,value:pixels.get(key)};}
   sources.push({...identity,grid,nodata:image.getGDALNoData(),compression:image.fileDirectory.Compression});console.error(`Sampled ${product}: ${pixels.size} native cells`);
  }finally{await handle.close();}
 }
 for(const row of rows)for(const sample of row.samples)sample.comparison=compareClasses(sample.sourceValues.AnnualChange_2024.value,sample.sourceValues.AnnualChange_2025.value,sample.sourceValues.TransitionMap_Subtypes.value);
 const summary={reviewedUnits:rows.length,responseSamples:rows.reduce((n,r)=>n+r.samples.length,0),unitsWithDeforestedLandAtSample:rows.filter(r=>r.samples.some(s=>s.comparison.deforestedLandObservedAtSample===true)).length,unitsWithForestToDeforestedObservation:rows.filter(r=>r.samples.some(s=>s.comparison.forestToDeforestedObserved===true)).length,unitsWithTemporalClassConflict:rows.filter(r=>r.samples.some(s=>s.comparison.temporalConflict)).length,unitsWithPlantationClass:rows.filter(r=>r.samples.some(s=>s.comparison.plantationClassObserved)).length,canalConditionVerified:0,finalPriorityAssessed:0};
 await fs.writeFile(path.join(output,'review.json'),JSON.stringify({access:'staff_only',rows,summary,limitations:['JRC source data repackaged by Epoch as COGs; sampled mirror values have not been independently compared to complete original JRC rasters.','Sampled classes describe pixels containing BPBD response coordinates, not complete unit forest cover.','Class 6 includes both non-TMF cover and missing data; never proof of forest absence.','No inspection of current canal condition is present; historical road/canal proxy and construction inventories are not condition surveys.','Classifications remain source observations, not validated pressure values, fire causation or final priority.']},null,2),{flag:'wx'});
 await fs.writeFile(path.join(output,'review-units.geojson'),JSON.stringify({type:'FeatureCollection',metadata:{access:'staff_only',purpose:'Four-unit source review, not approved restoration priorities'},features:rows.map(r=>({type:'Feature',id:r.unitId,geometry:original.features[r.sourceFeatureIndex].geometry,properties:{sourceFeatureIndex:r.sourceFeatureIndex,forestToDeforestedObservedAtSample:r.samples.some(s=>s.comparison.forestToDeforestedObserved===true)?true:null,temporalClassConflict:r.samples.some(s=>s.comparison.temporalConflict),canalConditionVerified:false,sourceUnitApproved:false,finalPriority:'Belum dinilai',score:null}}))}),{flag:'wx'});
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({access:'staff_only',createdAt:new Date().toISOString(),version:'JRC TMF v1.2025, Epoch COG mirror',attribution:'European Commission Joint Research Centre; repackaged by Epoch; no endorsement implied',mirrorDocumentation:base+'/README.md',providerDocumentation:'https://forobs.jrc.ec.europa.eu/static/tmf/TMF_DataUsersGuide.pdf',reviewSha256:sha(reviewBytes),reviewManifestSha256:sha(reviewManifestBytes),databaseSha256:sha(dbBytes),databaseManifestSha256:sha(dbManifestBytes),bbsdlpSha256:sha(originalBytes),bpbdManifestSha256:bpbd.manifestSha256,supportingFiles,sources,ranges,downloadedBytes:downloaded,completeSourceFiles:false,completeRequiredRanges:true,approvalGranted:false},null,2),{flag:'wx'});
 return {output,...summary,downloadedBytes:downloaded};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{let result;if(process.argv.length===4&&process.argv[2]==='--verify')result=await replay(process.argv[3]);else{if(process.argv.length!==5)throw Error('Provide private canal review, BPBD and database packages, or --verify completed-package');result=await run(...process.argv.slice(2));}console.log(JSON.stringify(result,null,2));}catch(e){console.error('Review incomplete; partial ranges must not be assessed. '+e.stack);process.exitCode=1;}}
