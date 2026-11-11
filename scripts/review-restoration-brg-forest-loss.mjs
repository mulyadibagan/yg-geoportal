// Native GFC observations inside BRG swamp-forest/unit intersections; no inferred forest-loss score.
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {intervals,emptyCounts,tally} from './extract-restoration-tree-loss.mjs';
import {sha256} from './read-restoration-brg.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function naturalSwampForest(label){return label==='Hutan Rawa Primer'||label==='Hutan Rawa Sekunder';}
export function historicalFireCanalCandidate(u){
 return u.geometryValid===true&&Array.isArray(u.overlayErrors)&&u.overlayErrors.length===0&&Array.isArray(u.firePositiveRefs)&&u.firePositiveRefs.length>0&&Number.isSafeInteger(u.canalPartsIntersecting)&&u.canalPartsIntersecting>0;
}
export function summarizeCounts(c){
 if(!Array.isArray(c.lossYearCounts)||c.lossYearCounts.length!==26||!c.lossYearCounts.every(v=>Number.isSafeInteger(v)&&v>=0))throw Error('Invalid native year counts');
 const all=c.lossYearCounts.slice(1).reduce((a,b)=>a+b,0),recent=c.lossYearCounts.slice(18).reduce((a,b)=>a+b,0);
 return {mappedTreeLoss2001to2025:all>0?true:null,mappedTreeLoss2018to2025:recent>0?true:null,lossPixels2001to2025:all,lossPixels2018to2025:recent,archiveForestObservationYear:null,forestOpeningValidated:false,score:null};
}
async function hashFile(file){const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');}
export async function run(overlayDirectory,gfcDirectory){
 const privateRoot=await fs.realpath(path.join(root,'private-data'));if(privateRoot!==path.join(await fs.realpath(root),'private-data'))throw Error('Redirected private root');
 async function file(directory,name,max){const d=await fs.realpath(path.resolve(root,directory)),f=await fs.realpath(path.join(d,name));if(!d.startsWith(privateRoot+path.sep)||!f.startsWith(d+path.sep)||(await fs.stat(f)).size>max)throw Error('Bounded private input required');return f;}
 const overlayBytes=await fs.readFile(await file(overlayDirectory,'overlay.json',64*1024*1024)),overlayManifestBytes=await fs.readFile(await file(overlayDirectory,'manifest.json',1024*1024)),manifest=JSON.parse(overlayManifestBytes),overlay=JSON.parse(overlayBytes);
 const fragmentsFile=await file(overlayDirectory,'valid-main-fragments.ndjson',128*1024*1024),originalBytes=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson')),original=JSON.parse(originalBytes);
 if(manifest.access!=='staff_only'||manifest.peatSourceSha256!==sha256(originalBytes)||manifest['overlay.jsonSha256']!==sha256(overlayBytes)||manifest['valid-main-fragments.ndjsonSha256']!==await hashFile(fragmentsFile))throw Error('Overlay/source lineage mismatch');
 const gfcBytes=await fs.readFile(await file(gfcDirectory,'manifest.json',65536)),gfc=JSON.parse(gfcBytes);
 if(gfc.access!=='staff_only'||gfc.version!=='GFC-2025-v1.13'||gfc.sources.length!==4)throw Error('Unexpected GFC release');
 const require=createRequire(path.join(privateRoot,'restoration-runtime/package.json')),J=require('jsts'),G=require('geotiff'),T=require('@turf/turf');
 const reader=new J.io.GeoJSONReader(),writer=new J.io.GeoJSONWriter(),index=new J.index.strtree.STRtree(),units=[];
 for(const u of overlay.units){
  if(!historicalFireCanalCandidate(u))continue;
  const source=original.features[u.sourceFeatureIndex];if(u.unitId!==`bbsdlp-${sha256(originalBytes).slice(0,16)}-${String(u.sourceFeatureIndex+1).padStart(4,'0')}`||!source)throw Error('Unit source identity mismatch');
  const geometry=reader.read(source.geometry);if(!new J.operation.valid.IsValidOp(geometry).isValid())throw Error('Unit geometry changed');
  const row={unitId:u.unitId,sourceFeatureIndex:u.sourceFeatureIndex,g:geometry,naturalForestFragmentRefs:[],loss2001to2025Refs:[],loss2018to2025Refs:[],errors:[],forestOpeningValidated:false,score:null,finalPriority:'Belum dinilai'};units.push(row);index.insert(geometry.getEnvelopeInternal(),row);
 }
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-brg-forest-loss-')),tiles=[],handles=[],rasterSources=[],rows=[];let forestFragments=0;
 try{
  for(const tile of ['00N_100E','10N_100E']){
   const images={};for(const layer of ['lossyear','datamask']){
    const name=`Hansen_GFC-2025-v1.13_${layer}_${tile}.tif`,s=gfc.sources.find(s=>s.name===name&&s.tile===tile&&s.layer===layer),f=await file(gfcDirectory,name,128*1024*1024);
    if(!s||(await fs.stat(f)).size!==s.bytes||await hashFile(f)!==s.sha256)throw Error('GFC raster checksum mismatch');
    rasterSources.push({name,sha256:s.sha256});const h=await G.fromFile(f);handles.push(h);images[layer]=await h.getImage();
   }
   const loss=images.lossyear,mask=images.datamask,origin=loss.getOrigin(),resolution=loss.getResolution(),bbox=loss.getBoundingBox(),north=tile==='00N_100E'?0:10;
   if(loss.getGeoKeys().GeographicTypeGeoKey!==4326||mask.getGeoKeys().GeographicTypeGeoKey!==4326||loss.getSamplesPerPixel()!==1||mask.getSamplesPerPixel()!==1||loss.getWidth()!==mask.getWidth()||loss.getHeight()!==mask.getHeight()||JSON.stringify(origin)!==JSON.stringify(mask.getOrigin())||JSON.stringify(resolution)!==JSON.stringify(mask.getResolution())||resolution[0]<=0||resolution[1]>=0||bbox[0]!==100||bbox[1]!==north-10||bbox[2]!==110||bbox[3]!==north)throw Error('GFC native CRS/grid mismatch');
   tiles.push({tile,loss,mask,origin,resolution,bbox});
  }
  for await(const line of readline.createInterface({input:createReadStream(fragmentsFile),crlfDelay:Infinity})){
   const f=JSON.parse(line);if(!naturalSwampForest(f.facts.landCover))continue;forestFragments++;
   const g=reader.read(f.geometry);
   for(const u of index.query(g.getEnvelopeInternal()).toArray()){
    try{
     const intersection=g.intersection(u.g);if(intersection.isEmpty()||intersection.getArea()<=0)continue;
     if(!new J.operation.valid.IsValidOp(intersection).isValid())throw Error('Invalid overlay geometry');
     const geometry=writer.write(intersection),bbox=T.bbox({type:'Feature',geometry,properties:{}}),counts=emptyCounts();u.naturalForestFragmentRefs.push(f.sourceFeatureIndex);
     for(const tile of tiles){
      const b=tile.bbox;if(bbox[0]>=b[2]||bbox[2]<=b[0]||bbox[1]>=b[3]||bbox[3]<=b[1])continue;
      const [ox,oy]=tile.origin,[dx,dy]=tile.resolution,x0=Math.max(0,Math.floor((bbox[0]-ox)/dx)),x1=Math.min(tile.loss.getWidth(),Math.ceil((bbox[2]-ox)/dx)),y0=Math.max(0,Math.floor((bbox[3]-oy)/dy)),y1=Math.min(tile.loss.getHeight(),Math.ceil((bbox[1]-oy)/dy));
      for(let y=y0;y<y1;y+=64){
       const end=Math.min(y+64,y1),window=[x0,y,x1,end];if((x1-x0)*(end-y)>4*1024*1024)throw Error('Raster window bound');
       const [loss,mask]=await Promise.all([tile.loss.readRasters({window,samples:[0],interleave:true}),tile.mask.readRasters({window,samples:[0],interleave:true})]);
       for(let row=y;row<end;row++){const ranges=intervals(geometry,oy+(row+.5)*dy,ox,dx,x0,x1).map(([a,b])=>[a-x0,b-x0]);tally(counts,loss,mask,ranges,(row-y)*(x1-x0));}
      }
     }
     const summary=summarizeCounts(counts),coverageWithinTiles=bbox[0]>=100&&bbox[2]<=110&&bbox[1]>=-10&&bbox[3]<=10;
     rows.push({unitId:u.unitId,sourceFeatureIndex:u.sourceFeatureIndex,brgFragmentIndex:f.sourceFeatureIndex,archiveClass:f.facts.landCover,archiveForestObservationYear:null,counts,coverageWithinTiles,...summary});
     if(summary.mappedTreeLoss2001to2025)u.loss2001to2025Refs.push(f.sourceFeatureIndex);if(summary.mappedTreeLoss2018to2025)u.loss2018to2025Refs.push(f.sourceFeatureIndex);
     if(rows.length%100===0)console.log(JSON.stringify({stage:'forest-raster-overlay',pairs:rows.length,forestFragments}));
    }catch(e){u.errors.push({brgFragmentIndex:f.sourceFeatureIndex,reason:e.message});}
   }
  }
  const summary={candidateUnitsReviewed:units.length,validRiauNaturalSwampForestFragments:forestFragments,forestUnitIntersectionPairs:rows.length,unitsWithArchiveSwampForest:units.filter(u=>u.naturalForestFragmentRefs.length).length,unitsWithLoss2001to2025InsideArchiveSwampForest:units.filter(u=>u.loss2001to2025Refs.length).length,unitsWithLoss2018to2025InsideArchiveSwampForest:units.filter(u=>u.loss2018to2025Refs.length).length,pairsWithoutNativePixelCenters:rows.filter(r=>!r.counts.insidePixels).length,pairsWithIncompleteCoverage:rows.filter(r=>!r.coverageWithinTiles||r.counts.noDataPixels||r.counts.invalidValuePixels).length,overlayOrRasterErrors:units.reduce((n,u)=>n+u.errors.length,0),finalPriorityAssessed:0};
  const limitations=['Scope is topology-valid units with observed historical fire and canal-line intersections, independent of the Non-Hutan label; other units are not assessed here.','Archive forest-class observation year remains unknown; PL17 field naming is not independent year verification.','2018–2025 is an explicit search interval, not a verified post-baseline period.','Native pixel-center counts are tree-cover loss observations, not hectares, cause of loss or final ecological scores.','Plantation, mangrove and dryland forest classes are excluded from this peat-swamp-forest comparison.','Different unit/fragment rows can overlap spatially; their pixel counts must not be summed as unique loss.','No observation/coverage gap becomes false or zero pressure.','Channel observation date and present condition, source metadata and temporal conflicts remain unresolved.'];
  const result={access:'staff_only',summary,method:'Native GFC cell centers inside the exact valid intersection of a BRG swamp-forest polygon and an original peat unit; polygon holes excluded',limitations,rows,units:units.map(({g,...u})=>u)};
  const bytes=JSON.stringify(result,null,2);await fs.writeFile(path.join(output,'forest-loss-review.json'),bytes,{flag:'wx'});
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({access:'staff_only',createdAt:new Date().toISOString(),overlaySha256:sha256(overlayBytes),overlayManifestSha256:sha256(overlayManifestBytes),fragmentsSha256:manifest['valid-main-fragments.ndjsonSha256'],peatSha256:sha256(originalBytes),gfcManifestSha256:sha256(gfcBytes),rasterSources,forestLossReviewSha256:sha256(bytes),scoringValidated:false,summary},null,2),{flag:'wx'});
  console.log(JSON.stringify({output,summary},null,2));return output;
 }finally{for(const h of handles)await h.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run(...process.argv.slice(2)).catch(e=>{console.error(e.stack);process.exitCode=1;});
