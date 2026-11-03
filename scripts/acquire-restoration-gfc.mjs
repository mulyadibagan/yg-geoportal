// Download only public provider tiles. Never sends unit geometries or staff credentials.
import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base='https://storage.googleapis.com/earthenginepartners-hansen/GFC-2025-v1.13/';
export async function acquire(){
  const privateRoot=path.join(root,'private-data');await fs.mkdir(privateRoot,{recursive:true});
  if(await fs.realpath(privateRoot)!==path.join(await fs.realpath(root),'private-data'))throw Error('Private directory redirected');
  const output=await fs.mkdtemp(path.join(privateRoot,'restoration-gfc-'));
  const sources=[];
  for(const layer of ['lossyear','datamask']){
    const listing=await fetch(base+layer+'.txt',{signal:AbortSignal.timeout(20000)});
    if(!listing.ok)throw Error('Provider listing unavailable');
    const available=new Set((await listing.text()).split(/\s+/));
    for(const tile of ['00N_100E','10N_100E']){
      const name='Hansen_GFC-2025-v1.13_'+layer+'_'+tile+'.tif',url=base+name;
      if(!available.has(url))throw Error('Tile absent from official provider list');
      const response=await fetch(url,{signal:AbortSignal.timeout(180000)});
      if(!response.ok||!response.body)throw Error('Provider tile unavailable');
      let bytes=0;const hash=createHash('sha256');
      const bounded=new Transform({transform(chunk,encoding,done){bytes+=chunk.length;if(bytes>200*1024*1024)return done(Error('Tile exceeds 200 MiB'));hash.update(chunk);done(null,chunk);}});
      await pipeline(Readable.fromWeb(response.body),bounded,createWriteStream(path.join(output,name),{flags:'wx'}));
      const declared=response.headers.get('content-length');
      if(declared!==null&&Number(declared)!==bytes)throw Error('Incomplete provider tile');
      sources.push({name,url,layer,tile,bytes,sha256:hash.digest('hex'),etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified')});
      console.error('Received '+layer+' '+tile+' ('+bytes+' bytes)');
    }
  }
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({schemaVersion:1,access:'staff_only',dataset:'Hansen/UMD/Google/USGS/NASA Global Forest Change',version:'GFC-2025-v1.13',period:'2001–2025',
    providerDocumentation:base+'download.html',license:'CC BY 4.0',retrievedAt:new Date().toISOString(),scoringValidated:false,
    limitations:['Woody tree-cover loss, not all vegetation loss or peat degradation.','No definitive area or ecological score is inferred from pixel counts.','Datamask reflects provider baseline; no new land-use classification is inferred.'],sources},null,2),{flag:'wx'});
  return {output,files:sources.length,bytes:sources.reduce((sum,row)=>sum+row.bytes,0)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==2)throw Error('No arguments supported');console.log(JSON.stringify(await acquire(),null,2));}catch{console.error('Acquisition incomplete; do not use partial files.');process.exitCode=1;}}
