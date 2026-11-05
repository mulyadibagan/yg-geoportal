// Export actual response coordinates as an unfilled private verification worklist.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {replay,mirrorUrl} from './review-restoration-four-unit-forest.mjs';
import {loadPackage} from './audit-restoration-bpbd.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),sha=b=>createHash('sha256').update(b).digest('hex');
export function buildTargets(review){
 if(review.access!=='staff_only'||!Array.isArray(review.rows)||!review.rows.length)throw Error('Private source review required');
 const ids=new Set(),targets=[];
 for(const unit of review.rows){
  if(!unit.unitId||ids.has(unit.unitId)||unit.score!==null||unit.sourceUnitApproved!==false||!unit.samples?.length)throw Error('Invalid or approved source unit');ids.add(unit.unitId);
  const grouped=new Map(),references=new Set();
  for(const sample of unit.samples){
   const p=sample.point,key=JSON.stringify(p),ref=`${sample.responseRef}:${sample.pointIndex}`;
   if(!Array.isArray(p)||![2,3].includes(p.length)||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90||typeof sample.responseRef!=='string'||!Number.isSafeInteger(sample.pointIndex)||sample.pointIndex<0||references.has(ref))throw Error('Invalid or repeated source sample');references.add(ref);
   if(!grouped.has(key))grouped.set(key,{type:'Feature',id:`${unit.unitId}-site-${sha(key).slice(0,12)}`,geometry:{type:'Point',coordinates:p.slice()},properties:{unitId:unit.unitId,sourceFeatureIndex:unit.sourceFeatureIndex,sourceSamples:[],status:'Belum diperiksa',observations:[],canalConditionVerified:false,sourceUnitApproved:false,finalPriority:'Belum dinilai',score:null,requiredEvidence:['Tanggal pengamatan dan identitas sumber/versi','Lokasi kanal atau bukti lapangan yang dapat dicocokkan ke titik ini','Pembedaan kanal, jalan, sungai atau objek belum teridentifikasi','Kondisi kanal terbuka/tertutup dan fungsi drainase yang benar-benar diamati','Foto/dokumen asli beserta tanggal dan referensi, tanpa menebak kondisi']}});
   grouped.get(key).properties.sourceSamples.push({responseRef:sample.responseRef,pointIndex:sample.pointIndex,date:sample.date,sourceValues:sample.sourceValues,comparison:sample.comparison});
  }
  targets.push(...grouped.values());
 }
 return {type:'FeatureCollection',metadata:{access:'staff_only',purpose:'Unfilled verification targets at original response coordinates; not surveyed canal points or final priorities',uniqueIncidents:null,observationsCompleted:0},features:targets};
}
export async function prepare(forestDirectory,bpbdDirectory,metadataDirectory){
 const privateRoot=await fs.realpath(path.join(root,'private-data'));if(privateRoot!==path.join(await fs.realpath(root),'private-data'))throw Error('Redirected private root');
 async function read(dir,name,max=8*1024*1024){const d=await fs.realpath(path.resolve(root,dir)),f=await fs.realpath(path.join(d,name));if(!d.startsWith(privateRoot+path.sep)||!f.startsWith(d+path.sep)||(await fs.stat(f)).size>max)throw Error('Private bounded input required');return fs.readFile(f);}
 const verification=await replay(forestDirectory),reviewBytes=await read(forestDirectory,'review.json'),manifestBytes=await read(forestDirectory,'manifest.json',1024*1024),review=JSON.parse(reviewBytes),manifest=JSON.parse(manifestBytes),originalBytes=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson')),original=JSON.parse(originalBytes),bpbd=await loadPackage(path.resolve(root,bpbdDirectory),privateRoot),records=new Map(bpbd.records.map(r=>[r.ref,r]));
 if(manifest.bbsdlpSha256!==sha(originalBytes)||manifest.bpbdManifestSha256!==bpbd.manifestSha256)throw Error('Source lineage changed');
 const require=createRequire(path.join(privateRoot,'restoration-runtime/package.json')),T=require('@turf/turf');
 const targets=buildTargets(review);
 for(const target of targets.features){const p=target.properties,source=original.features[p.sourceFeatureIndex];if(!source||p.unitId!==`bbsdlp-${sha(originalBytes).slice(0,16)}-${String(p.sourceFeatureIndex+1).padStart(4,'0')}`||!T.booleanPointInPolygon(target,source))throw Error('Original unit membership mismatch');
  for(const sample of p.sourceSamples){const record=records.get(sample.responseRef),g=record?.feature.geometry,point=g?.type==='Point'&&sample.pointIndex===0?g.coordinates:g?.type==='MultiPoint'?g.coordinates[sample.pointIndex]:null;if(JSON.stringify(point)!==JSON.stringify(target.geometry.coordinates)||record.calendarDate!==sample.date)throw Error('Original response coordinate/date mismatch');}
 }
 const metadataSources=[];
 for(const name of ['annual-change-collection.json','transition-map-subtypes-collection.json','N10_E100_2024.json','N10_E100_2025.json','N10_E100.json']){const bytes=await read(metadataDirectory,name,3*1024*1024),data=JSON.parse(bytes);metadataSources.push({name,bytes:bytes.length,sha256:sha(bytes),data});}
 for(const collection of metadataSources.filter(s=>s.name.endsWith('-collection.json')))if(collection.data.version!=='1.2025')throw Error('Unexpected metadata release');
 for(const [product,name] of [['AnnualChange_2024','N10_E100_2024.json'],['AnnualChange_2025','N10_E100_2025.json'],['TransitionMap_Subtypes','N10_E100.json']]){
  const item=metadataSources.find(s=>s.name===name).data,asset=item.assets?.data,source=manifest.sources.find(s=>s.product===product),grid=source?.grid;
  if(!asset||!grid||asset.href!==mirrorUrl(product)||asset['file:size']!==source.bytes||asset['proj:code']!=='EPSG:4326'||JSON.stringify(asset['proj:shape'])!==JSON.stringify([grid.height,grid.width])||JSON.stringify(asset['proj:transform'])!==JSON.stringify([grid.resolution[0],0,grid.origin[0],0,grid.resolution[1],grid.origin[1]]))throw Error('Metadata/raster identity mismatch');
 }
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-site-review-'));
 await fs.writeFile(path.join(output,'verification-targets.geojson'),JSON.stringify(targets,null,2),{flag:'wx'});
 await fs.writeFile(path.join(output,'verification-form.json'),JSON.stringify({access:'staff_only',purpose:targets.metadata.purpose,targets:targets.features.map(f=>({targetId:f.id,unitId:f.properties.unitId,sourceFeatureIndex:f.properties.sourceFeatureIndex,sourceReferences:f.properties.sourceSamples.map(s=>s.responseRef),status:'Belum diperiksa',observations:[],reviewer:null,reviewedAt:null,canalConditionVerified:false,finalPriority:'Belum dinilai',score:null})),instructions:['Isi hanya hasil pengamatan asli beserta tanggal, lokasi dan sumber.','Target adalah koordinat respons asli, bukan pengesahan titik kanal atau batas kebakaran.','Jangan memakai tanggal unggah/versi sebagai tanggal survei.','Bukti di titik tidak mewakili kondisi seluruh poligon.','Konflik waktu sumber tetap terbuka; jangan mengubah tahun atau menyalin nilai perkiraan.'],observationsCompleted:0},null,2),{flag:'wx'});
 await fs.writeFile(path.join(output,'metadata-review.json'),JSON.stringify({access:'staff_only',release:'1.2025',sourceItemsMatchStoredRasters:true,temporalConflictsResolved:0,remainingTemporalConflicts:review.summary.unitsWithTemporalClassConflict,conclusion:'STAC confirms assets, grids and observation periods; it does not explain the annual/transition inconsistency or verify current canals.',sources:metadataSources.map(({data,...s})=>s)},null,2),{flag:'wx'});
 for(const source of metadataSources)await fs.writeFile(path.join(output,source.name),await read(metadataDirectory,source.name,3*1024*1024),{flag:'wx'});
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({access:'staff_only',createdAt:new Date().toISOString(),forestReviewSha256:sha(reviewBytes),forestManifestSha256:sha(manifestBytes),bpbdManifestSha256:bpbd.manifestSha256,bbsdlpSha256:sha(originalBytes),sourceReplay:verification,metadataSources:metadataSources.map(({data,...s})=>s),approvalGranted:false,score:null},null,2),{flag:'wx'});
 return {output,units:review.rows.length,verificationTargets:targets.features.length,sourceResponseSamples:targets.features.reduce((n,f)=>n+f.properties.sourceSamples.length,0),observationsCompleted:0,temporalConflictsResolved:0,finalPriorityAssessed:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==5)throw Error('Provide private forest review, BPBD and STAC metadata packages');console.log(JSON.stringify(await prepare(...process.argv.slice(2)),null,2));}catch(e){console.error(e.stack);process.exitCode=1;}}
