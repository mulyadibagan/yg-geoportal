// Exact native-cell observations at response coordinates; never a burned-area estimate.
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadPackage} from './audit-restoration-bpbd.mjs';
import {calendarDate} from './audit-restoration-tmat.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
export function cellAt(point,grid){
 if(!Array.isArray(point)||point.length<2||!point.slice(0,2).every(Number.isFinite))throw Error('Invalid response coordinate');
 const [x,y]=point,[ox,oy]=grid.origin,[dx,dy]=grid.resolution;
 if(!(dx>0&&dy<0)||!Number.isSafeInteger(grid.width)||!Number.isSafeInteger(grid.height))throw Error('Unsupported native grid');
 const column=Math.floor((x-ox)/dx)+0,row=Math.floor((y-oy)/dy)+0;
 return column>=0&&column<grid.width&&row>=0&&row<grid.height?{row,column}:null;
}
export function observation(loss,mask,date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||calendarDate(date)!==date)throw Error('Invalid observation date');
 if(!Number.isInteger(mask)||mask<0||mask>2||!Number.isInteger(loss)||loss<0||loss>25)throw Error('Unsupported native source class');
 const lossYear=mask===1&&loss>0?2000+loss:null;
 return {lossValue:loss,datamaskValue:mask,lossYear,status:mask===0?'Data belum tersedia':mask===2?'Perairan permanen sumber':loss===0?'Tidak ada kehilangan terpetakan pada piksel':'Kehilangan tutupan pohon terpetakan',sameCalendarYear:lossYear!==null&&Number(date.slice(0,4))===lossYear};
}
export async function run(reviewDirectory,bpbdDirectory,gfcDirectory){
 const privateRoot=await fs.realpath(path.join(root,'private-data'));
 if(privateRoot!==path.join(await fs.realpath(root),'private-data'))throw Error('Redirected private root');
 async function read(dir,name,max=32*1024*1024){const d=await fs.realpath(path.resolve(root,dir)),f=await fs.realpath(path.join(d,name));if(!d.startsWith(privateRoot+path.sep)||!f.startsWith(d+path.sep)||(await fs.stat(f)).size>max)throw Error('Private bounded input required');return fs.readFile(f);}
 const reviewBytes=await read(reviewDirectory,'review.json'),reviewManifestBytes=await read(reviewDirectory,'manifest.json',65536),review=JSON.parse(reviewBytes),reviewManifest=JSON.parse(reviewManifestBytes);
 const source=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson'));
 if(review.access!=='staff_only'||reviewManifest.access!=='staff_only'||reviewManifest.bbsdlpSha256!==sha(source))throw Error('Review lineage mismatch');
 const bpbd=await loadPackage(path.resolve(root,bpbdDirectory),privateRoot),records=new Map(bpbd.records.map(r=>[r.ref,r]));
 const manifestBytes=await read(gfcDirectory,'manifest.json',65536),manifest=JSON.parse(manifestBytes);
 if(manifest.access!=='staff_only'||manifest.version!=='GFC-2025-v1.13'||manifest.sources?.length!==4)throw Error('Unsupported GFC package');
 const require=createRequire(path.join(privateRoot,'restoration-runtime/package.json')),G=require('geotiff'),T=require('@turf/turf'),original=JSON.parse(source),handles=[],tiles=new Map(),seen=new Set();
 try{
  for(const s of manifest.sources){
   if(!['lossyear','datamask'].includes(s.layer)||!['00N_100E','10N_100E'].includes(s.tile)||s.name!==`Hansen_GFC-2025-v1.13_${s.layer}_${s.tile}.tif`||seen.has(s.name))throw Error('Unsupported raster identity');seen.add(s.name);
   const directory=await fs.realpath(path.resolve(root,gfcDirectory)),file=await fs.realpath(path.join(directory,s.name));if(!directory.startsWith(privateRoot+path.sep)||!file.startsWith(directory+path.sep)||(await fs.stat(file)).size!==s.bytes)throw Error('Invalid raster file');
   const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);if(hash.digest('hex')!==s.sha256)throw Error('Raster checksum mismatch');
   const handle=await G.fromFile(file);handles.push(handle);const image=await handle.getImage(),grid={origin:image.getOrigin().slice(0,2),resolution:image.getResolution().slice(0,2),width:image.getWidth(),height:image.getHeight()};
   if(image.getGeoKeys().GeographicTypeGeoKey!==4326||image.getSamplesPerPixel()!==1||image.getGDALNoData()!==null)throw Error('Unsupported raster georeferencing');
   const tile=tiles.get(s.tile)||{};tile[s.layer]={image,grid,sha256:s.sha256};tiles.set(s.tile,tile);
  }
  for(const tile of tiles.values())if(!tile.lossyear||!tile.datamask||JSON.stringify(tile.lossyear.grid)!==JSON.stringify(tile.datamask.grid))throw Error('Misaligned source grids');
  const queue=review.rows.filter(r=>r.route==='Antrean peninjauan lokasi');if(new Set(queue.map(r=>r.unitId)).size!==queue.length)throw Error('Duplicate review unit');
  const cache=new Map(),rows=[];
  for(const unit of queue){
   if(unit.sourceReviewFlags.length||!unit.sharedCalendarYears.length||new Set(unit.responseRecordRefs).size!==unit.responseRecordRefs.length)throw Error('Invalid site-review route');
   if(!Number.isSafeInteger(unit.sourceFeatureIndex)||unit.sourceFeatureIndex<0||!original.features[unit.sourceFeatureIndex]||unit.unitId!==`bbsdlp-${sha(source).slice(0,16)}-${String(unit.sourceFeatureIndex+1).padStart(4,'0')}`)throw Error('Invalid original unit identity');
   const samples=[];
   for(const ref of unit.responseRecordRefs){
    const record=records.get(ref);if(!record?.calendarDate)throw Error('Unresolved source record');
    const geometry=record.feature.geometry,points=geometry.type==='Point'?[geometry.coordinates]:geometry.type==='MultiPoint'?geometry.coordinates:null;if(!points?.length)throw Error('Unsupported response geometry');
    for(let pointIndex=0;pointIndex<points.length;pointIndex++){
     const point=points[pointIndex],matches=[...tiles].flatMap(([name,tile])=>{const cell=cellAt(point,tile.lossyear.grid);return cell?[{name,tile,cell}]:[];});if(matches.length!==1)throw Error('Response outside unique native tile');
     if(!T.booleanPointInPolygon(T.point(point),original.features[unit.sourceFeatureIndex]))throw Error('Response point outside original source polygon');
     const {name,tile,cell}=matches[0],key=`${name}:${cell.row}:${cell.column}`;
     if(!cache.has(key)){const window=[cell.column,cell.row,cell.column+1,cell.row+1],values=await Promise.all([tile.lossyear.image.readRasters({window,samples:[0],interleave:true}),tile.datamask.image.readRasters({window,samples:[0],interleave:true})]);cache.set(key,[values[0][0],values[1][0]]);}
     samples.push({responseRef:ref,pointIndex,date:record.calendarDate,category:record.category,tile:name,...cell,...observation(...cache.get(key),record.calendarDate)});
    }
   }
   rows.push({unitId:unit.unitId,sourceFeatureIndex:unit.sourceFeatureIndex,responseRecords:unit.responseRecordRefs.length,samples,sameYearPointSamples:samples.filter(s=>s.sameCalendarYear).length,canalObservationYear:2017,canalRoadProxyOnly:true,sourceUnitApproved:false,finalPriority:'Belum dinilai',score:null});
  }
  const result={access:'staff_only',rows,summary:{reviewedUnits:rows.length,unitsWithSameYearResponsePixel:rows.filter(r=>r.sameYearPointSamples>0).length,responsePointSamples:rows.reduce((n,r)=>n+r.samples.length,0),sameYearPointSamples:rows.reduce((n,r)=>n+r.sameYearPointSamples,0),finalPriorityAssessed:0},limitations:['Response coordinates are not burned-area polygons; no matching pixel does not prove absence of fire-related loss.','Same-year native-cell overlap does not establish causation or natural-forest status; plantations are included in GFC.','2017 canal/road proxy is unit-level evidence, not current canal verification.','Source unit boundaries remain unapproved; no ecological score or final priority is assigned.']};
  const output=await fs.mkdtemp(path.join(privateRoot,'restoration-response-pixel-review-'));
  await fs.writeFile(path.join(output,'review.json'),JSON.stringify(result,null,2),{flag:'wx'});
  await fs.writeFile(path.join(output,'review-units.geojson'),JSON.stringify({type:'FeatureCollection',metadata:{access:'staff_only',purpose:'Exact response-pixel review, not final restoration priority'},features:rows.map(r=>({type:'Feature',id:r.unitId,geometry:original.features[r.sourceFeatureIndex].geometry,properties:{sourceFeatureIndex:r.sourceFeatureIndex,sameYearPointSamples:r.sameYearPointSamples,reviewRoute:r.sameYearPointSamples>0?'Tinjau bukti berimpit pada piksel':'Perlu bukti spasial tambahan',canalObservationYear:2017,canalRoadProxyOnly:true,sourceUnitApproved:false,finalPriority:'Belum dinilai',score:null}}))}),{flag:'wx'});
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({access:'staff_only',createdAt:new Date().toISOString(),reviewSha256:sha(reviewBytes),reviewManifestSha256:sha(reviewManifestBytes),bpbdManifestSha256:bpbd.manifestSha256,gfcManifestSha256:sha(manifestBytes),bbsdlpSha256:sha(source),rasterSources:manifest.sources.map(s=>({name:s.name,sha256:s.sha256})),approvalGranted:false},null,2),{flag:'wx'});
  return {output,...result.summary};
 }finally{for(const handle of handles)await handle.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==5)throw Error('Provide private review, BPBD and GFC packages');console.log(JSON.stringify(await run(...process.argv.slice(2)),null,2));}catch(e){console.error(e.stack);process.exitCode=1;}}
