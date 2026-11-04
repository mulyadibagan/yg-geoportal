// Research reference only. No local geometry is transmitted and no scores are approved.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const origin='https://data.mendeley.com',version=1;
export const SOURCES=Object.freeze({
 'deep-peat':{id:'c83z4df8ky',name:'DeepPeatMap_100.0m_EasternSumatra_UTM48S_190518.tif',hash:'2c506b483c4448615d1aafe64c9816bae7ad8a5bac4a6529f31895e098841fe1',bytes:8442611,fileId:'7c5bf66d-d207-4802-80de-fbf62f89cac3',type:'image/tiff'},
 'moisture':{id:'27y943wbkw',name:'moisture_dataset.csv',hash:'b82f193f18c5c4457dc73c8381afe8a68b17d76b76b87da459b2fef2f6c8aff3',bytes:6503,fileId:'3f97ff7e-f8c1-417a-9514-c1c5d05725f2',type:'text/csv'},
 'retention':{id:'jj35xcx98v',name:'riau_pf.csv',hash:'76c6243fae93850e9b911d42b7a25aef6f135700c8f380e5fe9b13c816c70413',bytes:2637,fileId:'b3635376-b642-4dcc-a4f5-f7ddb7dc38fd',type:'text/csv'}
});
function configuration(key){if(!Object.hasOwn(SOURCES,key))throw Error('Unknown research source');return SOURCES[key];}
async function get(url,limit){
 const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok||!r.body)throw Error('Research source status '+r.status);
 const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>limit)throw Error('Research response exceeds bound');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks);return {bytes,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export function validateSource(snapshot,files,key='deep-peat'){
 const expected=configuration(key),dataset=expected.id;
 if(snapshot.id!==dataset||snapshot.version!==version||snapshot.doi!=='10.17632/'+dataset+'.1'||snapshot.is_confidential!==false||snapshot.licence?.short_name!=='CC BY 4.0')throw Error('Unexpected source identity or licence');
 if(!Array.isArray(files)||files.length!==1)throw Error('Unexpected file inventory');
 const file=files[0],content=file.content_details;
 if(file.filename!==expected.name||content?.sha256_hash!==expected.hash||content.size!==expected.bytes||content.content_type!==expected.type)throw Error('Unexpected reference file version');
 const url=new URL(content.download_url);
 if(url.origin!==origin||url.pathname!=='/public-files/datasets/'+dataset+'/files/'+expected.fileId+'/file_downloaded'||url.search)throw Error('Unexpected download destination');
 return file;
}
export async function acquire(key='deep-peat'){
 const expected=configuration(key),dataset=expected.id;
 const privateRoot=path.join(root,'private-data');await fs.mkdir(privateRoot,{recursive:true});
 if(await fs.realpath(privateRoot)!==path.join(await fs.realpath(root),'private-data'))throw Error('Private root redirected');
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-research-peat-'));
 const metadataUrl=origin+'/public-api/datasets/'+dataset+'/snapshot/1';
 const inventoryUrl=origin+'/public-api/datasets/'+dataset+'/files?folder_id=root&version=1';
 const metadata=await get(metadataUrl,2*1024*1024),inventory=await get(inventoryUrl,2*1024*1024);
 const snapshot=JSON.parse(metadata.bytes),file=validateSource(snapshot,JSON.parse(inventory.bytes),key);
 const raster=await get(file.content_details.download_url,16*1024*1024);
 if(raster.sha256!==expected.hash||raster.bytes.length!==file.content_details.size)throw Error('Research file integrity mismatch');
 await fs.writeFile(path.join(output,'source-metadata.json'),metadata.bytes,{flag:'wx'});
 await fs.writeFile(path.join(output,'source-files.json'),inventory.bytes,{flag:'wx'});
 const rasterPath=path.join(output,file.filename);await fs.writeFile(rasterPath,raster.bytes,{flag:'wx'});
 let technical={format:expected.type,tableParsed:false};
 if(expected.type==='image/tiff'){
  const require=createRequire(path.join(privateRoot,'restoration-runtime/package.json')),G=require('geotiff');
  const handle=await G.fromFile(rasterPath);
  try{const image=await handle.getImage();technical={width:image.getWidth(),height:image.getHeight(),samples:image.getSamplesPerPixel(),geoKeys:image.getGeoKeys(),origin:image.getOrigin(),resolution:image.getResolution(),boundingBox:image.getBoundingBox(),noData:image.getGDALNoData()};}finally{await handle.close();}
 }
 const manifest={schemaVersion:1,access:'staff_only',retrievedAt:new Date().toISOString(),source:'https://data.mendeley.com/datasets/'+dataset+'/1',doi:snapshot.doi,version,publishedAt:snapshot.publish_date,attribution:{title:snapshot.name,contributors:snapshot.contributors},licence:snapshot.licence,metadata:{url:metadataUrl,sha256:metadata.sha256},inventory:{url:inventoryUrl,sha256:inventory.sha256},file:{name:file.filename,url:file.content_details.download_url,bytes:raster.bytes.length,sha256:raster.sha256},technical,scoringValidated:false,limitations:['Research reference is not an original BBSDLP class correction.','Moisture and retention are not water-table observations.','Publication year is not a universal measurement date.','Projected raster must not be overlaid with WGS84 polygons without verified reprojection.','Resolution is insufficient to decide sub-pixel source slivers.','No depth class, hydrological measurement, polygon area or score has been assigned.']};
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
 return {output,bytes:raster.bytes.length,sha256:raster.sha256,licence:snapshot.licence.short_name,technical,scoringValidated:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length>3)throw Error('Only a predefined source key is accepted');console.log(JSON.stringify(await acquire(process.argv[2]),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
