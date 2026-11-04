// Public KHG-code queries only. Never sends a local footprint, station, or staff credential.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const BASE='https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/SUMBER_DAYA_ALAM_DAN_LINGKUNGAN/MapServer/48';
export const PUBLIC_WHERE="kode_khg LIKE 'KHG.14%' OR kode_khg LIKE 'KHG.12-14%'";
export function queryUrl(ids){
  if(ids!==undefined&&(!Array.isArray(ids)||!ids.length||ids.length>100||ids.some(id=>!Number.isSafeInteger(id)||id<0)||new Set(ids).size!==ids.length))throw Error('Invalid public object IDs');
  const parameters=new URLSearchParams(ids?{f:'geojson',objectIds:ids.join(','),outFields:'*',outSR:'4326',returnGeometry:'true'}:
    {f:'json',where:PUBLIC_WHERE,returnIdsOnly:'true'});
  return BASE+'/query?'+parameters;
}
async function read(url){
  let failure;
  for(let attempt=0;attempt<3;attempt++){
    try{return await readOnce(url);}catch(error){failure=error;}
  }
  throw failure;
}
async function readOnce(url){
  const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
  if(!response.ok||!response.body)throw Error('Public source unavailable');
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>64*1024*1024)throw Error('Source response exceeds bound');chunks.push(chunk);}
  const bytes=Buffer.concat(chunks),data=JSON.parse(bytes.toString('utf8'));
  if(data.error)throw Error('Public service rejected query');
  return {bytes,data,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export async function acquire(){
  const privateRoot=path.join(root,'private-data');await fs.mkdir(privateRoot,{recursive:true});
  if(await fs.realpath(privateRoot)!==path.join(await fs.realpath(root),'private-data'))throw Error('Private root redirected');
  const output=await fs.mkdtemp(path.join(privateRoot,'restoration-big-reference-'));
  const meta=await read(BASE+'?f=pjson');
  const oidFields=(meta.data.fields||[]).filter(field=>field.type==='esriFieldTypeOID');
  if(!String(meta.data.capabilities||'').split(',').includes('Query')||oidFields.length!==1||oidFields[0].name!=='objectid_1')throw Error('Unexpected source schema');
  await fs.writeFile(path.join(output,'layer-metadata.json'),meta.bytes,{flag:'wx'});
  const index=await read(queryUrl()),ids=index.data.objectIds;
  if(!Array.isArray(ids)||!ids.length||ids.length>25000||ids.some(id=>!Number.isSafeInteger(id)||id<0)||new Set(ids).size!==ids.length)throw Error('Incomplete public object ID index');
  await fs.writeFile(path.join(output,'public-object-ids.json'),index.bytes,{flag:'wx'});
  ids.sort((a,b)=>a-b);const parts=[];let totalBytes=0;
  for(let start=0;start<ids.length;start+=100){
    const selected=ids.slice(start,start+100),url=queryUrl(selected),part=await read(url);
    if(part.data.type!=='FeatureCollection'||!Array.isArray(part.data.features)||part.data.exceededTransferLimit===true)throw Error('Incomplete GeoJSON response');
    const received=part.data.features.map(feature=>feature.properties?.objectid_1??feature.id);
    if(received.length!==selected.length||new Set(received).size!==selected.length||received.some(id=>!selected.includes(id)))throw Error('Object ID mismatch');
    totalBytes+=part.bytes.length;if(totalBytes>256*1024*1024)throw Error('Reference exceeds 256 MiB');
    const name='features-'+String(parts.length+1).padStart(4,'0')+'.geojson';
    await fs.writeFile(path.join(output,name),part.bytes,{flag:'wx'});
    parts.push({name,url,bytes:part.bytes.length,sha256:part.sha256,featureCount:received.length,objectIds:selected});
    if(parts.length%10===0)console.error('Received '+Math.min(start+100,ids.length)+' public reference features');
  }
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({schemaVersion:1,access:'staff_only',source:BASE,
    selection:PUBLIC_WHERE,selectionMethod:'public KHG codes only; no local geometry transmitted',
    retrievedAt:new Date().toISOString(),metadataSha256:meta.sha256,objectIdsSha256:index.sha256,
    featureCount:ids.length,totalBytes,parts,year:null,scoringValidated:false,
    limitations:['Official FEG reference, not the BBSDLP 2019 source itself.','Public KHG code selection is not an administrative boundary clip.',
      'Depth strings are preserved verbatim; no soil-class correction or ecological score is inferred.','Successful download is not validation of source topology or suitability.']},null,2),{flag:'wx'});
  return {output,featureCount:ids.length,parts:parts.length,totalBytes};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==2)throw Error('No input parameters supported');console.log(JSON.stringify(await acquire(),null,2));}catch(error){console.error('Reference acquisition incomplete: '+error.message);process.exitCode=1;}}
