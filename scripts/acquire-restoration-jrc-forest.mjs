// Fixed public ten-degree tile downloads, without private coordinates or credentials.
import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const DATASETS=Object.freeze(['TransitionMap_Subtypes','AnnualChange_2024','AnnualChange_2025']);
export function sourceUrl(dataset){if(!DATASETS.includes(dataset))throw Error('Unsupported JRC dataset');return `https://ies-ows.jrc.ec.europa.eu/iforce/tmf_v1/download.py?type=tile&dataset=${dataset}&lat=N10&lon=E100`;}
export async function acquire(){
 const privateRoot=path.join(root,'private-data');if(await fs.realpath(privateRoot)!==path.join(await fs.realpath(root),'private-data'))throw Error('Redirected private directory');
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-jrc-forest-')),sources=[];
 async function save(url,name,maxBytes,timeout=300000){
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(timeout)});if(!response.ok||!response.body)throw Error(`Source unavailable ${response.status}`);
  const declared=Number(response.headers.get('content-length'));if(declared>maxBytes)throw Error('Source too large');
  let bytes=0,last=0;const hash=createHash('sha256'),bounded=new Transform({transform(chunk,encoding,done){bytes+=chunk.length;if(bytes>maxBytes)return done(Error('Source exceeds bound'));hash.update(chunk);if(bytes-last>16*1024*1024){last=bytes;console.error(`${name}: ${bytes} bytes`);}done(null,chunk);}});
  const part=path.join(output,name+'.part');await pipeline(Readable.fromWeb(response.body),bounded,createWriteStream(part,{flags:'wx'}));
  if(declared&&bytes!==declared)throw Error('Incomplete JRC response');await fs.rename(part,path.join(output,name));
  const entry={name,url,bytes,sha256:hash.digest('hex'),contentDisposition:response.headers.get('content-disposition'),etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified')};sources.push(entry);console.error(`Received ${name} (${bytes} bytes)`);return entry;
 }
 for(const dataset of DATASETS){const entry=await save(sourceUrl(dataset),dataset+'.tif',128*1024*1024);entry.dataset=dataset;const name=entry.contentDisposition?.match(/filename="([^"]+)"/)?.[1];if(!name||!/^JRC_TMF_[A-Za-z0-9_]+_N10_E100\.tif$/.test(name))throw Error('Unexpected JRC file identity');entry.providerFileName=name;}
 for(const dataset of ['AnnualChange','TransitionMap_Subtypes'])await save(`https://forobs.jrc.ec.europa.eu/TMF/download?dataset=${dataset}&output=qgis&type=symbology`,dataset+'.qml',1024*1024,30000);
 await save('https://forobs.jrc.ec.europa.eu/TMF/data','provider-data.html',1024*1024,30000);
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({access:'staff_only',dataset:'JRC Tropical Moist Forest',providerCurrentRelease:'v2025 per provider data page; retain individual provider file names',tile:'N10_E100',retrievedAt:new Date().toISOString(),sources,scoringValidated:false,approvalGranted:false,limitations:['Annual class change is a remote-sensing observation, not a fire-cause or field canal diagnosis.','Provider symbology/ISO metadata may lag the current release; retain version limitations.','No raw private geometry is sent to the provider or published.']},null,2),{flag:'wx'});
 return {output,sources:sources.map(s=>({name:s.name,bytes:s.bytes,providerFileName:s.providerFileName}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==2)throw Error('No arguments supported');console.log(JSON.stringify(await acquire(),null,2));}catch(e){console.error('Acquisition incomplete; partial package must not be assessed. '+e.message);process.exitCode=1;}}
