// Native raster observations only. No area conversion, normalization, or ecological score.
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

export function intervals(geometry,latitude,originX,pixelWidth,minCol,maxCol){
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  const ranges=[];
  for(const rings of polygons){
    const xs=[];
    for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[i],b=ring[j];
      if((a[1]>latitude)!==(b[1]>latitude))xs.push(a[0]+(latitude-a[1])*(b[0]-a[0])/(b[1]-a[1]));
    }
    xs.sort((a,b)=>a-b);
    if(xs.length%2)throw Error('Odd scanline intersections');
    for(let i=0;i<xs.length;i+=2){
      const left=Math.max(minCol,Math.ceil((xs[i]-originX)/pixelWidth-.5));
      const right=Math.min(maxCol,Math.ceil((xs[i+1]-originX)/pixelWidth-.5));
      if(left<right)ranges.push([left,right]);
    }
  }
  ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
  for(const range of ranges){const previous=merged.at(-1);if(previous&&range[0]<=previous[1])previous[1]=Math.max(previous[1],range[1]);else merged.push([...range]);}
  return merged;
}
export function emptyCounts(){return {insidePixels:0,mappedLandPixels:0,waterPixels:0,noDataPixels:0,invalidValuePixels:0,lossYearCounts:Array(26).fill(0)};}
export function tally(counts,loss,mask,ranges,offset=0){
  for(const [left,right] of ranges)for(let x=left;x<right;x++){
    const i=offset+x;counts.insidePixels++;
    if(mask[i]===0){counts.noDataPixels++;continue;}
    if(mask[i]===2){counts.waterPixels++;continue;}
    if(mask[i]!==1||!Number.isInteger(loss[i])||loss[i]<0||loss[i]>25){counts.invalidValuePixels++;continue;}
    counts.mappedLandPixels++;counts.lossYearCounts[loss[i]]++;
  }
}
async function checksum(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
export async function extract(input,gfcDirectory){
  const privateRoot=await fs.realpath(path.join(root,'private-data'));
  if(privateRoot!==path.join(await fs.realpath(root),'private-data'))throw Error('Redirected private root');
  input=await fs.realpath(input);gfcDirectory=await fs.realpath(gfcDirectory);
  if(!input.startsWith(privateRoot+path.sep)||!gfcDirectory.startsWith(privateRoot+path.sep))throw Error('Private input required');
  const source=JSON.parse(await fs.readFile(path.join(input,'canonical-units.geojson'),'utf8'));
  const manifest=JSON.parse(await fs.readFile(path.join(gfcDirectory,'manifest.json'),'utf8'));
  if(manifest.access!=='staff_only'||manifest.version!=='GFC-2025-v1.13'||manifest.sources?.length!==4)throw Error('Unsupported GFC manifest');
  const runtime=createRequire(path.join(privateRoot,'restoration-runtime','package.json')),G=runtime('geotiff'),T=runtime('@turf/turf');
  const tiles=[],handles=[];
  try{
    for(const tile of ['00N_100E','10N_100E']){
      const images={};
      for(const layer of ['lossyear','datamask']){
        const name='Hansen_GFC-2025-v1.13_'+layer+'_'+tile+'.tif';
        const row=manifest.sources.find(row=>row.name===name),file=path.join(gfcDirectory,name);
        if(!row||await checksum(file)!==row.sha256)throw Error('Raster checksum mismatch');
        const tiff=await G.fromFile(file);handles.push(tiff);images[layer]=await tiff.getImage();
      }
      const loss=images.lossyear,mask=images.datamask,origin=loss.getOrigin(),resolution=loss.getResolution(),bbox=loss.getBoundingBox();
      const north=tile==='00N_100E'?0:10;
      if(loss.getGeoKeys().GeographicTypeGeoKey!==4326||mask.getGeoKeys().GeographicTypeGeoKey!==4326||
        loss.getWidth()!==mask.getWidth()||loss.getHeight()!==mask.getHeight()||
        JSON.stringify(origin)!==JSON.stringify(mask.getOrigin())||JSON.stringify(resolution)!==JSON.stringify(mask.getResolution())||
        resolution[0]<=0||resolution[1]>=0||bbox[0]!==100||bbox[1]!==north-10||bbox[2]!==110||bbox[3]!==north)
        throw Error('Raster CRS/grid alignment mismatch');
      tiles.push({tile,loss,mask,origin,resolution,bbox});
    }
    let processed=0,excludedGeometry=0,unitsWithLossObservations=0,noCenterPixels=0,unitsWithIncompleteCoverage=0;
    for(const unit of source.features){
      if(unit.properties.qa.geometryCheck?.passed!==true){unit.properties.evidence.treeCoverLoss={status:'geometry-not-validated',scoringValidated:false,counts:null};excludedGeometry++;continue;}
      const bbox=T.bbox(unit),counts=emptyCounts();
      const coveredByAvailableTiles=bbox[0]>=100&&bbox[2]<=110&&bbox[1]>=-10&&bbox[3]<=10;
      for(const tile of tiles){
        const b=tile.bbox;if(bbox[0]>=b[2]||bbox[2]<=b[0]||bbox[1]>=b[3]||bbox[3]<=b[1])continue;
        const [ox,oy]=tile.origin,[dx,dy]=tile.resolution;
        const x0=Math.max(0,Math.floor((bbox[0]-ox)/dx)),x1=Math.min(tile.loss.getWidth(),Math.ceil((bbox[2]-ox)/dx));
        const y0=Math.max(0,Math.floor((bbox[3]-oy)/dy)),y1=Math.min(tile.loss.getHeight(),Math.ceil((bbox[1]-oy)/dy));
        for(let y=y0;y<y1;y+=128){
          const end=Math.min(y+128,y1),window=[x0,y,x1,end];
          const [loss,mask]=await Promise.all([tile.loss.readRasters({window,samples:[0],interleave:true}),tile.mask.readRasters({window,samples:[0],interleave:true})]);
          for(let row=y;row<end;row++){
            const ranges=intervals(unit.geometry,oy+(row+.5)*dy,ox,dx,x0,x1).map(([left,right])=>[left-x0,right-x0]);
            tally(counts,loss,mask,ranges,(row-y)*(x1-x0));
          }
        }
      }
      const incomplete=!coveredByAvailableTiles||counts.noDataPixels>0||counts.invalidValuePixels>0;
      if(!counts.insidePixels)noCenterPixels++;if(incomplete)unitsWithIncompleteCoverage++;
      if(counts.lossYearCounts.slice(1).some(value=>value>0))unitsWithLossObservations++;
      unit.properties.evidence.treeCoverLoss={status:!counts.insidePixels?'no-native-pixel-centers':incomplete?'partial-raster-observations':'native-raster-observations',
        method:'native-grid pixel-center inclusion; polygon holes excluded',dataset:'GFC-2025-v1.13',period:'2001–2025',
        lossCodeMeaning:'0: no mapped loss, 1–25: 2001–2025; counts only on datamask=1',
        counts,coveredByAvailableTiles,scoringValidated:false,areaHa:null};processed++;
      if(processed%50===0)console.error('Read raster evidence for '+processed+' units');
    }
    const output=await fs.mkdtemp(path.join(privateRoot,'restoration-indicator-evidence-'));
    await fs.writeFile(path.join(output,'units-with-evidence.geojson'),JSON.stringify(source),{flag:'wx'});
    const summary={processed,excludedGeometry,unitsWithLossObservations,noCenterPixels,unitsWithIncompleteCoverage};
    await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({schemaVersion:1,access:'staff_only',scoringValidated:false,
      sourcePackage:path.basename(input),sourceUnitsSha256:await checksum(path.join(input,'canonical-units.geojson')),
      gfcPackage:path.basename(gfcDirectory),gfcManifestSha256:await checksum(path.join(gfcDirectory,'manifest.json')),
      attribution:'Hansen/UMD/Google/USGS/NASA',providerDocumentation:'https://storage.googleapis.com/earthenginepartners-hansen/GFC-2025-v1.13/download.html',
      runtime:{geotiff:'2.1.3',turf:'7.2.0'},summary,
      limitations:['Tree-cover loss is not all vegetation loss or degradation.','Pixel-center counts are raw mapped observations, not definitive hectares.','Overlapping unit counts must not be summed.','All five ecological indicators remain null and unvalidated.']},null,2),{flag:'wx'});
    return {output,summary};
  } finally{for(const handle of handles)await handle.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==4)throw Error('Two private directories required');console.log(JSON.stringify(await extract(process.argv[2],process.argv[3]),null,2));}catch(error){console.error('Extraction failed: '+error.message);process.exitCode=1;}}
