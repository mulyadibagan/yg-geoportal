// Native mapped corridor observations only. No inferred centreline, length, area or ecological score.
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {intervals} from './extract-restoration-tree-loss.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
export function mercator(point){
 if(!Array.isArray(point)||point.length<2||!point.slice(0,2).every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>=85.05112878)throw Error('Invalid Web Mercator input');
 return [6378137*point[0]*Math.PI/180,6378137*Math.log(Math.tan(Math.PI/4+point[1]*Math.PI/360))];
}
export function tileName(label){if(typeof label!=='string'||!/^L15_\d{4}E_\d{4}N$/.test(label))throw Error('Unknown canal tile label');return 'geotiffs/'+label.replaceAll('_','-')+'.tif';}
export function firstMappedPixel(values,width,ranges,row){
 for(const [left,right] of ranges)for(let column=left;column<right;column++){
  const value=values[row*width+column];if(value!==0&&value!==1)throw Error('Unknown corridor raster class');
  if(value===1)return {row,column};
 }return null;
}
const overlaps=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
async function fileHash(file){const h=createHash('sha256');for await(const c of createReadStream(file))h.update(c);return h.digest('hex');}
export async function extract(unitsPath,packageDirectory,python){
 const privateRoot=await fs.realpath(path.join(root,'private-data'));
 if(privateRoot!==path.join(await fs.realpath(root),'private-data'))throw Error('Private root redirected');
 const input=await fs.realpath(path.resolve(root,unitsPath)),directory=await fs.realpath(path.resolve(root,packageDirectory));
 if(!input.startsWith(privateRoot+path.sep)||!directory.startsWith(privateRoot+path.sep)||(await fs.stat(input)).size>64*1024*1024)throw Error('Private bounded input required');
 const unitBytes=await fs.readFile(input),units=JSON.parse(unitBytes),manifestBytes=await fs.readFile(path.join(directory,'manifest.json')),manifest=JSON.parse(manifestBytes);
 if(manifest.access!=='staff_only'||manifest.source!=='https://purl.stanford.edu/yj761xk5815'||manifest.license!=='CC BY 3.0')throw Error('Invalid source manifest');
 for(const name of ['geotiffs.zip','index_map.geojson']){
  const entry=manifest.sources.find(s=>s.name===name),file=await fs.realpath(path.join(directory,name));
  if(!file.startsWith(directory+path.sep)||!entry||(await fs.stat(file)).size!==entry.bytes||await fileHash(file)!==entry.sha256)throw Error('Canal source checksum mismatch');
 }
 const originalBytes=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson')),original=JSON.parse(originalBytes),sourceSha=sha(originalBytes);
 const require=createRequire(path.join(privateRoot,'restoration-runtime/package.json')),T=require('@turf/turf'),G=require('geotiff');
 const ids=new Set(),rows=units.features.map(unit=>{
  const p=unit.properties,source=original.features[p?.sourceFeatureIndex];
  if(typeof unit.id!=='string'||!unit.id.trim()||ids.has(unit.id)||!Number.isSafeInteger(p?.sourceFeatureIndex)||p.sourceFeatureIndex<0||!source||p.sourceSha256!==sourceSha||JSON.stringify(source.geometry)!==JSON.stringify(unit.geometry))throw Error('Unit source lineage mismatch');ids.add(unit.id);
  const coordinates=unit.geometry.type==='Polygon'?[unit.geometry.coordinates]:unit.geometry.coordinates;
  const projected={type:'MultiPolygon',coordinates:coordinates.map(poly=>poly.map(ring=>ring.map(mercator)))};
  return {unit,projected,bbox:T.bbox(projected),eligible:p.qa?.geometryCheck?.passed===true,first:null,tilesRead:0};
 });
 const index=JSON.parse(await fs.readFile(path.join(directory,'index_map.geojson')));
 const selected=[];
 // Index selection uses its documented WGS84 bounding box, transformed locally.
 for(const tile of index.features){const b=T.bbox(tile),a=mercator([b[0],b[1]]),c=mercator([b[2],b[3]]),bbox=[a[0],a[1],c[0],c[1]];if(rows.some(r=>r.eligible&&overlaps(r.bbox,bbox)))selected.push({tile,bbox});}
 const archive=path.join(directory,'geotiffs.zip'),tiles=[];
 const readZip="import sys,zipfile\nz=zipfile.ZipFile(sys.argv[1]);i=z.getinfo(sys.argv[2])\nif i.file_size>32*1024*1024: raise ValueError('Tile too large')\nsys.stdout.buffer.write(z.read(i))";
 for(const {tile,bbox} of selected){
  const relevant=rows.filter(row=>row.eligible&&!row.first&&overlaps(row.bbox,bbox));if(!relevant.length)continue;
  const name=tileName(tile.properties.label),bytes=execFileSync(python,['-c',readZip,archive,name],{maxBuffer:32*1024*1024,timeout:30000}),tileSha=sha(bytes);
  const tiff=await G.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  try{
   const image=await tiff.getImage(),origin=image.getOrigin(),resolution=image.getResolution(),native=image.getBoundingBox();
   if(image.getGeoKeys().ProjectedCSTypeGeoKey!==3857||image.getWidth()!==4096||image.getHeight()!==4096||image.getSamplesPerPixel()!==1||resolution[0]<=0||resolution[1]>=0||image.getGDALNoData()!==null||native.some((v,i)=>Math.abs(v-bbox[i])>Math.abs(resolution[0])))throw Error('Unexpected canal tile CRS, extent or grid');
   const values=await image.readRasters({samples:[0],interleave:true}),width=image.getWidth();
   for(const row of relevant){
    if(!overlaps(row.bbox,native))continue;row.tilesRead++;
    const x0=Math.max(0,Math.floor((row.bbox[0]-origin[0])/resolution[0])),x1=Math.min(width,Math.ceil((row.bbox[2]-origin[0])/resolution[0]));
    const y0=Math.max(0,Math.floor((row.bbox[3]-origin[1])/resolution[1])),y1=Math.min(image.getHeight(),Math.ceil((row.bbox[1]-origin[1])/resolution[1]));
    for(let y=y0;y<y1&&!row.first;y++){
     const ranges=intervals(row.projected,origin[1]+(y+.5)*resolution[1],origin[0],resolution[0],x0,x1),hit=firstMappedPixel(values,width,ranges,y);
     if(hit)row.first={tile:name,tileSha256:tileSha,row:hit.row,column:hit.column,nativeValue:1};
    }
   }
   tiles.push({name,sha256:tileSha,bytes:bytes.length,crcVerifiedByZipfile:true,epsg:3857,origin,resolution});
  }finally{await tiff.close();}
 }
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-canal-evidence-'));
 const evidence=rows.map(row=>({unitId:row.unit.id,sourceFeatureIndex:row.unit.properties.sourceFeatureIndex,geometryEligible:row.eligible,
  mappedCanalRoadCorridorObserved:row.first?true:null,firstSourcePixel:row.first,tilesRead:row.tilesRead,coverageComplete:false,
  forestLossCandidate:row.unit.properties.evidence?.treeCoverLoss??null,restorationPressures:null,scoringValidated:false,score:null}));
 await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify({access:'staff_only',unitsSha256:sha(unitBytes),bbsdlpSha256:sourceSha,canalManifestSha256:sha(manifestBytes),indexCandidates:selected.length,tilesRead:tiles,units:evidence,definition:'Published canal/road drainage-corridor detections from 2017; native positive pixel presence only',limitations:['Roads are included by the published mapping method, not separated as surveyed canals.','Stop at first positive mapped pixel; this is neither pixel count, length nor area.','No observation is not absence; source footprint and current conditions remain unverified.','Forest-loss evidence remains a candidate, not automatically natural-forest opening.','No original geometry, pressure approval or final priority is changed.']},null,2),{flag:'wx'});
 return {output,units:rows.length,indexCandidates:selected.length,tilesRead:tiles.length,unitsWithMappedCorridors:rows.filter(r=>r.first).length,excludedGeometry:rows.filter(r=>!r.eligible).length,score:null};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==5)throw Error('Provide private units GeoJSON, canal source package and bundled Python executable');console.log(JSON.stringify(await extract(...process.argv.slice(2)),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
