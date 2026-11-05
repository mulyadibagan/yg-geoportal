// Compare source pixel footprints, without buffers, new canal lines or inferred scores.
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mercator,tileName} from './extract-restoration-canal-evidence.mjs';
import {cellAt} from './sample-restoration-candidate-loss.mjs';
import {loadPackage} from './audit-restoration-bpbd.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),sha=b=>createHash('sha256').update(b).digest('hex');
async function hashFile(file){const h=createHash('sha256');for await(const c of createReadStream(file))h.update(c);return h.digest('hex');}
export function pixelBounds(grid,row,column){
 if(!Number.isSafeInteger(row)||!Number.isSafeInteger(column)||row<0||column<0||row>=grid.height||column>=grid.width||!(grid.resolution[0]>0&&grid.resolution[1]<0))throw Error('Invalid native source cell');
 const [x,y]=grid.origin,[dx,dy]=grid.resolution;return [x+column*dx,y+(row+1)*dy,x+(column+1)*dx,y+row*dy];
}
export function centreWindow(bounds,grid){
 const [x,y]=grid.origin,[dx,dy]=grid.resolution;
 if(!(dx>0&&dy<0)||!bounds.every(Number.isFinite)||bounds[0]>=bounds[2]||bounds[1]>=bounds[3])throw Error('Invalid pixel footprint');
 // West/north inclusive, east/south exclusive, matching cellAt.
 return [Math.max(0,Math.ceil((bounds[0]-x)/dx-.5)),Math.max(0,Math.ceil((bounds[3]-y)/dy-.5)),Math.min(grid.width,Math.ceil((bounds[2]-x)/dx-.5)),Math.min(grid.height,Math.ceil((bounds[1]-y)/dy-.5))];
}
const overlap=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
export function inspectWindow(values,window,grid,accept){
 const [x0,y0,x1,y1]=window;if(!window.every(Number.isSafeInteger)||x0<0||y0<0||x1<x0||y1<y0||x1>grid.width||y1>grid.height||values.length!==(x1-x0)*(y1-y0))throw Error('Invalid native window');
 let examined=0,mappedCentres=0,first=null;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const value=values[(y-y0)*(x1-x0)+x-x0];if(value!==0&&value!==1)throw Error('Unknown native corridor class');
  const px=grid.origin[0]+(x+.5)*grid.resolution[0],py=grid.origin[1]+(y+.5)*grid.resolution[1];
  if(!accept([px,py]))continue;examined++;
  if(value===1){mappedCentres++;first??={row:y,column:x,value:1};}
 }
 return {examined,mappedCentres,first,mappedCanalRoadObserved:mappedCentres>0?true:null};
}
export async function run(reviewDirectory,bpbdDirectory,gfcDirectory,canalDirectory,python){
 const privateRoot=await fs.realpath(path.join(root,'private-data'));if(privateRoot!==path.join(await fs.realpath(root),'private-data'))throw Error('Redirected private root');
 async function file(dir,name,max=64*1024*1024){const d=await fs.realpath(path.resolve(root,dir)),f=await fs.realpath(path.join(d,name));if(!d.startsWith(privateRoot+path.sep)||!f.startsWith(d+path.sep)||(await fs.stat(f)).size>max)throw Error('Private bounded source required');return f;}
 const reviewBytes=await fs.readFile(await file(reviewDirectory,'review.json')),reviewManifestBytes=await fs.readFile(await file(reviewDirectory,'manifest.json',65536)),review=JSON.parse(reviewBytes),reviewManifest=JSON.parse(reviewManifestBytes);
 const originalBytes=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson')),original=JSON.parse(originalBytes);
 const bpbd=await loadPackage(path.resolve(root,bpbdDirectory),privateRoot),records=new Map(bpbd.records.map(r=>[r.ref,r]));
 const gfcBytes=await fs.readFile(await file(gfcDirectory,'manifest.json',65536)),gfc=JSON.parse(gfcBytes),canalBytes=await fs.readFile(await file(canalDirectory,'manifest.json',65536)),canal=JSON.parse(canalBytes);
 if([review,reviewManifest,gfc,canal].some(d=>d.access!=='staff_only')||reviewManifest.bbsdlpSha256!==sha(originalBytes)||reviewManifest.bpbdManifestSha256!==bpbd.manifestSha256||reviewManifest.gfcManifestSha256!==sha(gfcBytes)||gfc.version!=='GFC-2025-v1.13'||canal.source!=='https://purl.stanford.edu/yj761xk5815'||canal.observationPeriod!=='July–September 2017')throw Error('Source lineage mismatch');
 for(const name of ['index_map.geojson','geotiffs.zip']){const s=canal.sources.find(r=>r.name===name),f=await file(canalDirectory,name,320*1024*1024);if(!s||(await fs.stat(f)).size!==s.bytes||await hashFile(f)!==s.sha256)throw Error('Canal checksum mismatch');}
 const require=createRequire(path.join(privateRoot,'restoration-runtime/package.json')),T=require('@turf/turf'),G=require('geotiff'),grids=new Map();
 for(const s of gfc.sources.filter(s=>s.layer==='lossyear')){
  if(!['00N_100E','10N_100E'].includes(s.tile)||s.name!==`Hansen_GFC-2025-v1.13_lossyear_${s.tile}.tif`||grids.has(s.tile)||!reviewManifest.rasterSources.some(r=>r.name===s.name&&r.sha256===s.sha256))throw Error('Unknown GFC tile');
  const f=await file(gfcDirectory,s.name,128*1024*1024);if((await fs.stat(f)).size!==s.bytes||await hashFile(f)!==s.sha256)throw Error('GFC checksum mismatch');
  const h=await G.fromFile(f);try{
   const image=await h.getImage();if(image.getGeoKeys().GeographicTypeGeoKey!==4326||image.getSamplesPerPixel()!==1)throw Error('Unexpected GFC grid');
   const grid={origin:image.getOrigin().slice(0,2),resolution:image.getResolution().slice(0,2),width:image.getWidth(),height:image.getHeight()};grids.set(s.tile,grid);
   for(const sample of review.rows.flatMap(r=>r.samples).filter(p=>p.sameCalendarYear&&p.tile===s.tile)){
    pixelBounds(grid,sample.row,sample.column);
    const value=await image.readRasters({window:[sample.column,sample.row,sample.column+1,sample.row+1],samples:[0],interleave:true});
    if(value[0]!==sample.lossValue)throw Error('Changed native loss observation');
   }
  }finally{await h.close();}
 }
 if(grids.size!==2)throw Error('Incomplete GFC grids');
 const rows=[],jobs=[];
 for(const unit of review.rows.filter(r=>r.sameYearPointSamples>0)){
  const source=original.features[unit.sourceFeatureIndex];if(!source||unit.unitId!==`bbsdlp-${sha(originalBytes).slice(0,16)}-${String(unit.sourceFeatureIndex+1).padStart(4,'0')}`)throw Error('Invalid unit identity');
  const row={unitId:unit.unitId,sourceFeatureIndex:unit.sourceFeatureIndex,samples:[],finalPriority:'Belum dinilai',score:null,sourceUnitApproved:false};rows.push(row);
  const sampleIds=new Set();for(const sample of unit.samples.filter(s=>s.sameCalendarYear)){
   const id=`${sample.responseRef}:${sample.pointIndex}`;if(sampleIds.has(id))throw Error('Duplicate response sample');sampleIds.add(id);
   const record=records.get(sample.responseRef),geometry=record?.feature.geometry,point=geometry?.type==='Point'&&sample.pointIndex===0?geometry.coordinates:geometry?.type==='MultiPoint'?geometry.coordinates[sample.pointIndex]:null,grid=grids.get(sample.tile);
   if(!point||!grid||record.calendarDate!==sample.date||Number(sample.date.slice(0,4))!==sample.lossYear||sample.lossYear!==2000+sample.lossValue||sample.datamaskValue!==1||!T.booleanPointInPolygon(T.point(point),source))throw Error('Invalid matching response evidence');
   const cell=cellAt(point,grid);if(!cell||cell.row!==sample.row||cell.column!==sample.column)throw Error('Response/native-cell mismatch');
   const bbox=pixelBounds(grid,sample.row,sample.column),a=mercator(bbox.slice(0,2)),b=mercator(bbox.slice(2)),projected=[...a,...b];
   const item={responseRef:sample.responseRef,pointIndex:sample.pointIndex,date:sample.date,lossTile:sample.tile,lossRow:sample.row,lossColumn:sample.column,sourceFootprintWgs84:bbox,tilesRead:0,centresExaminedInsideSourceUnit:0,mappedCorridorCentreCount:0,firstMappedCentre:null,mappedCanalRoadObserved:null,absenceConfirmed:false};row.samples.push(item);jobs.push({item,projected,source});
  }
  if(row.samples.length!==unit.sameYearPointSamples)throw Error('Altered matching sample count');
 }
 if(new Set(rows.map(r=>r.unitId)).size!==rows.length)throw Error('Duplicate unit');
 const index=JSON.parse(await fs.readFile(await file(canalDirectory,'index_map.geojson',8*1024*1024))),tiles=[],archive=await file(canalDirectory,'geotiffs.zip',320*1024*1024);
 const unzip="import sys,zipfile\nz=zipfile.ZipFile(sys.argv[1]);i=z.getinfo(sys.argv[2])\nif i.file_size>32*1024*1024: raise ValueError('Tile too large')\nsys.stdout.buffer.write(z.read(i))";
 for(const feature of index.features){
  const b=T.bbox(feature),a=mercator(b.slice(0,2)),c=mercator(b.slice(2)),bbox=[...a,...c],relevant=jobs.filter(j=>overlap(j.projected,bbox));if(!relevant.length)continue;
  const name=tileName(feature.properties.label),bytes=execFileSync(python,['-c',unzip,archive,name],{maxBuffer:32*1024*1024,timeout:30000}),tileSha=sha(bytes),h=await G.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  try{
   const image=await h.getImage(),grid={origin:image.getOrigin().slice(0,2),resolution:image.getResolution().slice(0,2),width:image.getWidth(),height:image.getHeight()},native=image.getBoundingBox();
   if(image.getGeoKeys().ProjectedCSTypeGeoKey!==3857||grid.width!==4096||grid.height!==4096||image.getSamplesPerPixel()!==1||image.getGDALNoData()!==null||native.some((v,i)=>Math.abs(v-bbox[i])>Math.abs(grid.resolution[0])))throw Error('Unexpected corridor tile grid');
   for(const job of relevant){
    const window=centreWindow(job.projected,grid),[x0,y0,x1,y1]=window;if(x0>=x1||y0>=y1)continue;
    const values=await image.readRasters({window,samples:[0],interleave:true});job.item.tilesRead++;
    const observed=inspectWindow(values,window,grid,([px,py])=>T.booleanPointInPolygon(T.point([px/6378137*180/Math.PI,(2*Math.atan(Math.exp(py/6378137))-Math.PI/2)*180/Math.PI]),job.source));
    job.item.centresExaminedInsideSourceUnit+=observed.examined;job.item.mappedCorridorCentreCount+=observed.mappedCentres;
    if(observed.first){job.item.mappedCanalRoadObserved=true;job.item.firstMappedCentre??={tile:name,tileSha256:tileSha,...observed.first};}
   }
   tiles.push({name,sha256:tileSha,bytes:bytes.length,crcVerifiedByZipfile:true,grid});
  }finally{await h.close();}
 }
 const footprintId=s=>`${s.lossTile}:${s.lossRow}:${s.lossColumn}`;
 for(const row of rows){row.samplesWithMappedCorridor=row.samples.filter(s=>s.mappedCanalRoadObserved===true).length;row.distinctMatchingLossFootprints=new Set(row.samples.filter(s=>s.mappedCanalRoadObserved===true).map(footprintId)).size;row.reviewRoute=row.samplesWithMappedCorridor?'Tinjau perimpitan kanal/jalan historis':'Perlu verifikasi jaringan kanal';}
 const result={access:'staff_only',rows,summary:{reviewedUnits:rows.length,responseSamples:jobs.length,distinctLossFootprints:new Set(jobs.map(j=>footprintId(j.item))).size,unitsWithHistoricalCorridorInLossFootprint:rows.filter(r=>r.samplesWithMappedCorridor>0).length,samplesWithHistoricalCorridorInLossFootprint:jobs.filter(j=>j.item.mappedCanalRoadObserved===true).length,distinctMatchingLossFootprints:new Set(jobs.filter(j=>j.item.mappedCanalRoadObserved===true).map(j=>footprintId(j.item))).size,tilesRead:tiles.length,finalPriorityAssessed:0},limitations:['Native canal/road pixel centres are tested only inside the GFC response-cell footprint and original source unit; no buffer is applied.','Repeated response samples at the same native loss pixel are not unique incidents or independent loss events.','2017 canal/road detections do not distinguish roads or confirm present-day canal condition.','No positive corridor centre is unknown, not confirmed absence.','GFC does not identify natural forest; same-calendar-year response/loss does not establish cause.','All sources remain review evidence without final priority or approval.']};
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-canal-pixel-review-'));
 await fs.writeFile(path.join(output,'review.json'),JSON.stringify(result,null,2),{flag:'wx'});
 await fs.writeFile(path.join(output,'review-units.geojson'),JSON.stringify({type:'FeatureCollection',metadata:{access:'staff_only',purpose:'Historical source-pixel comparison only'},features:rows.map(r=>({type:'Feature',id:r.unitId,geometry:original.features[r.sourceFeatureIndex].geometry,properties:{sourceFeatureIndex:r.sourceFeatureIndex,samplesWithMappedCorridor:r.samplesWithMappedCorridor,reviewRoute:r.reviewRoute,finalPriority:'Belum dinilai',score:null,sourceUnitApproved:false}}))}),{flag:'wx'});
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({access:'staff_only',createdAt:new Date().toISOString(),reviewSha256:sha(reviewBytes),reviewManifestSha256:sha(reviewManifestBytes),bbsdlpSha256:sha(originalBytes),bpbdManifestSha256:bpbd.manifestSha256,gfcManifestSha256:sha(gfcBytes),canalManifestSha256:sha(canalBytes),observationPeriod:canal.observationPeriod,tiles,approvalGranted:false},null,2),{flag:'wx'});
 return {output,...result.summary};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==7)throw Error('Provide private response-review, BPBD, GFC, canal packages and bundled Python');console.log(JSON.stringify(await run(...process.argv.slice(2)),null,2));}catch(e){console.error(e.stack);process.exitCode=1;}}
