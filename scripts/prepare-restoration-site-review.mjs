// Export actual response coordinates as an unfilled private verification worklist.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {replay,mirrorUrl} from './review-restoration-four-unit-forest.mjs';
import {loadPackage} from './audit-restoration-bpbd.mjs';
import {calendarDate} from './audit-restoration-tmat.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),sha=b=>createHash('sha256').update(b).digest('hex');
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&calendarDate(s)===s;
const textPresent=s=>typeof s==='string'&&s.trim().length>0&&s.length<=2000;
export function reviewFieldForm(form,targets,asOf,insideUnit){
 if(!validDay(asOf)||form.access!=='staff_only'||targets.metadata?.access!=='staff_only'||!Array.isArray(targets.features)||!targets.features.length||targets.features.length>500||!Array.isArray(form.targets)||form.targets.length!==targets.features.length)throw Error('Private complete target list and explicit valid review date required');
 const known=new Map(targets.features.map(f=>[f.id,f]));if(known.size!==targets.features.length)throw Error('Duplicate original target');
 const seen=new Set(),rows=[];
 for(const entry of form.targets){
  const target=known.get(entry.targetId),p=target?.properties;
  if(!p||seen.has(entry.targetId)||entry.unitId!==p.unitId||entry.sourceFeatureIndex!==p.sourceFeatureIndex||JSON.stringify(entry.sourceReferences)!==JSON.stringify(p.sourceSamples.map(s=>s.responseRef))||entry.score!==null||entry.canalConditionVerified!==false||entry.finalPriority!=='Belum dinilai'||entry.sourceUnitApproved===true||!Array.isArray(entry.observations)||entry.observations.length>100)throw Error('Changed target lineage or preapproved input');seen.add(entry.targetId);
  const observations=entry.observations.map((observation,index)=>{
   if(!observation||typeof observation!=='object'||Array.isArray(observation))throw Error('Observation object required');
   const issues=[],point=observation.geometry?.coordinates;
   if(!validDay(observation.observedAt)||observation.observedAt>asOf)issues.push('Tanggal pengamatan kosong, tidak sah atau sesudah tanggal pemeriksaan');
   if(observation.geometry?.type!=='Point'||!Array.isArray(point)||![2,3].includes(point.length)||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90)issues.push('Posisi pengamatan asli WGS84 tidak tersedia atau tidak sah');
   else if(!insideUnit(entry.unitId,point))issues.push('Posisi pengamatan di luar unit sumber');
   if(!['kanal','jalan','sungai','belum teridentifikasi'].includes(observation.objectType)||observation.objectType==='belum teridentifikasi')issues.push('Jenis objek belum teridentifikasi');
   if(observation.objectType==='kanal'&&(!['terbuka','tersumbat','bersekat'].includes(observation.condition)||!textPresent(observation.drainageObservation)))issues.push('Kondisi atau catatan fungsi kanal belum memadai');
   const evidence=observation.evidenceFiles;
   if(!Array.isArray(evidence)||!evidence.length||evidence.length>10)issues.push('Berkas bukti asli belum tersedia atau terlalu banyak');
   else for(const file of evidence)if(!textPresent(file.path)||path.isAbsolute(file.path)||/[\u0000:]/.test(file.path)||file.path.split(/[\\/]/).some(s=>s==='..'||s==='')||!/^([a-f0-9]{64})$/.test(file.sha256||'')||!textPresent(file.sourceReference)||!textPresent(file.version)||!validDay(observation.observedAt)||file.observationYear!==Number(observation.observedAt.slice(0,4)))issues.push('Rujukan, tahun, versi, hash atau path bukti tidak sah');
   return {index,objectType:observation.objectType??null,issues,evidenceFiles:Array.isArray(evidence)?evidence:[],intakeReady:false,canalConditionVerified:false,score:null};
  });
  rows.push({targetId:entry.targetId,unitId:entry.unitId,observations,status:observations.length?'Menunggu pemeriksaan berkas':'Belum diperiksa',canalConditionVerified:false,finalPriority:'Belum dinilai',score:null});
 }
 return {access:'staff_only',asOf,rows,approvalGranted:false,limitations:['This checks intake completeness, file integrity and source-unit membership only.','GPS, capture time, object identity, target relationship and hydraulic function still require source/field review.','Ready for review is not a validated pressure, verified canal condition or ecological priority.']};
}
export async function verifyEvidenceFile(directory,evidence,remainingBytes){
 if(!textPresent(evidence.path)||path.isAbsolute(evidence.path)||/[\u0000:]/.test(evidence.path)||evidence.path.split(/[\\/]/).some(s=>s==='..'||s==='')||!/^[a-f0-9]{64}$/.test(evidence.sha256||'')||!Number.isSafeInteger(remainingBytes)||remainingBytes<0)throw Error('Invalid evidence reference');
 const dir=await fs.realpath(directory),file=await fs.realpath(path.join(dir,evidence.path)),stat=await fs.stat(file);
 if(!file.startsWith(dir+path.sep)||!stat.isFile()||!stat.size||stat.size>Math.min(16*1024*1024,remainingBytes))throw Error('Evidence missing, outside package, empty or exceeds bound');
 const bytes=await fs.readFile(file);if(bytes.length!==stat.size||sha(bytes)!==evidence.sha256)throw Error('Evidence checksum mismatch');return bytes.length;
}
export async function inspectFieldPackage(directory,asOf){
 const privateRoot=await fs.realpath(path.join(root,'private-data')),dir=await fs.realpath(path.resolve(root,directory));if(privateRoot!==path.join(await fs.realpath(root),'private-data')||!dir.startsWith(privateRoot+path.sep))throw Error('Private field package required');
 async function read(name,max){const file=await fs.realpath(path.join(dir,name));if(!file.startsWith(dir+path.sep)||(await fs.stat(file)).size>max)throw Error('Bounded private input required');return fs.readFile(file);}
 const targetBytes=await read('verification-targets.geojson',8*1024*1024),formBytes=await read('verification-form.json',8*1024*1024),packageManifest=JSON.parse(await read('manifest.json',1024*1024)),targets=JSON.parse(targetBytes),form=JSON.parse(formBytes),originalBytes=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson')),original=JSON.parse(originalBytes),originalSha=sha(originalBytes);
 if(packageManifest.access!=='staff_only'||packageManifest.schemaVersion!==2||packageManifest.targetsSha256!==sha(targetBytes)||packageManifest.bbsdlpSha256!==originalSha||packageManifest.approvalGranted!==false)throw Error('Target checksum missing/changed; regenerate source-bound package before intake');
 const require=createRequire(path.join(privateRoot,'restoration-runtime/package.json')),T=require('@turf/turf'),units=new Map();
 for(const target of targets.features||[]){const p=target.properties,source=original.features[p?.sourceFeatureIndex];if(!source||p.unitId!==`bbsdlp-${originalSha.slice(0,16)}-${String(p.sourceFeatureIndex+1).padStart(4,'0')}`||target.id!==`${p.unitId}-site-${sha(JSON.stringify(target.geometry?.coordinates)).slice(0,12)}`||target.geometry?.type!=='Point'||!T.booleanPointInPolygon(target,source))throw Error('Original field target lineage mismatch');units.set(p.unitId,source);}
 const result=reviewFieldForm(form,targets,asOf,(id,point)=>T.booleanPointInPolygon(T.point(point),units.get(id)));let totalBytes=0;
 for(const row of result.rows)for(const observation of row.observations){
  if(observation.issues.length)continue;
  for(const evidence of observation.evidenceFiles){
   try{totalBytes+=await verifyEvidenceFile(dir,evidence,64*1024*1024-totalBytes);}
   catch{observation.issues.push('Berkas tidak tersedia, di luar paket atau melebihi batas');}
  }
  observation.intakeReady=observation.issues.length===0;
 }
 for(const row of result.rows)if(row.observations.length)row.status=row.observations.every(o=>o.intakeReady)?'Bukti siap ditelaah':'Bukti belum lengkap';
 result.summary={targets:result.rows.length,targetsWithObservations:result.rows.filter(r=>r.observations.length).length,observationsReadyForReview:result.rows.reduce((n,r)=>n+r.observations.filter(o=>o.intakeReady).length,0),canalConditionVerified:0,finalPriorityAssessed:0};
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-field-intake-'));
 await fs.writeFile(path.join(output,'intake-review.json'),JSON.stringify(result,null,2),{flag:'wx'});
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({access:'staff_only',createdAt:new Date().toISOString(),asOf,targetsSha256:sha(targetBytes),formSha256:sha(formBytes),bbsdlpSha256:originalSha,bytesInspected:totalBytes,approvalGranted:false},null,2),{flag:'wx'});
 return {output,...result.summary};
}
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
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({schemaVersion:2,access:'staff_only',createdAt:new Date().toISOString(),targetsSha256:sha(await fs.readFile(path.join(output,'verification-targets.geojson'))),formTemplateSha256:sha(await fs.readFile(path.join(output,'verification-form.json'))),forestReviewSha256:sha(reviewBytes),forestManifestSha256:sha(manifestBytes),bpbdManifestSha256:bpbd.manifestSha256,bbsdlpSha256:sha(originalBytes),sourceReplay:verification,metadataSources:metadataSources.map(({data,...s})=>s),approvalGranted:false,score:null},null,2),{flag:'wx'});
 return {output,units:review.rows.length,verificationTargets:targets.features.length,sourceResponseSamples:targets.features.reduce((n,f)=>n+f.properties.sourceSamples.length,0),observationsCompleted:0,temporalConflictsResolved:0,finalPriorityAssessed:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{let result;if(process.argv.length===5&&process.argv[2]==='--check-form')result=await inspectFieldPackage(process.argv[3],process.argv[4]);else{if(process.argv.length!==5)throw Error('Provide private forest review, BPBD and STAC metadata packages, or --check-form package YYYY-MM-DD');result=await prepare(...process.argv.slice(2));}console.log(JSON.stringify(result,null,2));}catch(e){console.error(e.stack);process.exitCode=1;}}
