// Public Stanford source files only; no private geometries or staff credentials sent.
import fs from 'node:fs/promises';
import {createWriteStream,createReadStream} from 'node:fs';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const FILES=Object.freeze([
 {id:'yj761xk5815',name:'geotiffs.zip',maxBytes:300*1024*1024},
 {id:'zy089tj2215',name:'index_map.geojson',maxBytes:8*1024*1024}
].map(Object.freeze));
export function sourceUrl(entry){
 const match=FILES.find(f=>f.id===entry?.id&&f.name===entry?.name);
 if(!match)throw Error('Unknown canal source file');
 return 'https://stacks.stanford.edu/file/'+match.id+'/'+match.name;
}
export async function acquire(resumeDirectory){
 const privateRoot=await fs.realpath(path.join(root,'private-data'));
 if(privateRoot!==path.join(await fs.realpath(root),'private-data'))throw Error('Private root redirected');
 const output=resumeDirectory?await fs.realpath(path.resolve(root,resumeDirectory)):await fs.mkdtemp(path.join(privateRoot,'restoration-canals-')),sources=[];
 if(path.dirname(output)!==privateRoot||!path.basename(output).startsWith('restoration-canals-'))throw Error('Invalid private resume directory');
 if(await fs.stat(path.join(output,'manifest.json')).then(()=>true,()=>false))throw Error('Package already complete');
 for(const entry of FILES){
  const metadataUrl='https://purl.stanford.edu/'+entry.id+'/iiif/manifest';
  const response=await fetch(metadataUrl,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Official source manifest unavailable');
  const metadataBytes=Buffer.from(await response.arrayBuffer());if(metadataBytes.length>2*1024*1024)throw Error('Manifest too large');
  const metadata=JSON.parse(metadataBytes),url=sourceUrl(entry);
  if(metadata.id!==metadataUrl||!JSON.stringify(metadata).includes(url)||metadata.rights!=='https://creativecommons.org/licenses/by/3.0/legalcode')throw Error('Unexpected source identity, file or licence');
  const metadataFile=path.join(output,entry.id+'-manifest.json');
  if(!await fs.stat(metadataFile).then(()=>true,()=>false))await fs.writeFile(metadataFile,metadataBytes,{flag:'wx'});
  if(await fs.realpath(metadataFile)!==metadataFile||createHash('sha256').update(await fs.readFile(metadataFile)).digest('hex')!==createHash('sha256').update(metadataBytes).digest('hex'))throw Error('Stored source manifest changed');
  const file=path.join(output,entry.name),existing=await fs.stat(file).catch(()=>null);
  if(existing&&(await fs.realpath(file)!==file||!existing.isFile()||existing.size>entry.maxBytes))throw Error('Invalid partial source file');
  const offset=existing?.size||0;
  const download=await fetch(url,{headers:offset?{Range:'bytes='+offset+'-'}:{},signal:AbortSignal.timeout(240000)});
  if(!download.ok||!download.body)throw Error('Canal source unavailable: '+download.status);
  let expectedBytes=download.headers.get('content-length')===null?null:Number(download.headers.get('content-length'));
  if(offset){const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(download.headers.get('content-range')||'');if(download.status!==206||!range||Number(range[1])!==offset||Number(range[2])+1!==Number(range[3]))throw Error('Provider did not honor exact resume range');expectedBytes=Number(range[3]);
   const modified=Date.parse(download.headers.get('last-modified'));if(Number.isFinite(modified)&&modified>existing.birthtimeMs)throw Error('Provider source changed since partial download');}
  const hash=createHash('sha256');let bytes=offset;
  if(offset)for await(const chunk of createReadStream(file))hash.update(chunk);
  const bound=new Transform({transform(chunk,encoding,done){bytes+=chunk.length;if(bytes>entry.maxBytes)return done(Error('Canal source exceeds bound'));hash.update(chunk);done(null,chunk);}});
  await pipeline(Readable.fromWeb(download.body),bound,createWriteStream(file,{flags:offset?'a':'wx'}));
  if(expectedBytes!==null&&expectedBytes!==bytes)throw Error('Incomplete canal source download');
  if(entry.name.endsWith('.geojson')){const d=JSON.parse(await fs.readFile(path.join(output,entry.name),'utf8'));if(d.type!=='FeatureCollection'||!Array.isArray(d.features)||d.features.length>25000)throw Error('Invalid tile index');}
  sources.push({...entry,url,bytes,sha256:hash.digest('hex'),metadataUrl,metadataSha256:createHash('sha256').update(metadataBytes).digest('hex'),etag:download.headers.get('etag'),lastModified:download.headers.get('last-modified')});
  console.error('Received '+entry.name+' ('+bytes+' bytes)');
 }
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({access:'staff_only',retrievedAt:new Date().toISOString(),source:'https://purl.stanford.edu/yj761xk5815',indexSource:'https://purl.stanford.edu/zy089tj2215',license:'CC BY 3.0',observationPeriod:'July–September 2017',sources,scoringValidated:false,limitations:['Satellite detections are not a current field-surveyed canal inventory.','Verify raster class definitions: roads must not be assumed to be canals.','Local SHA-256 and transport length do not claim an unavailable publisher checksum.','No source is promoted to restorationPressures by acquisition alone.']},null,2),{flag:'wx'});
 return {output,files:sources.length,bytes:sources.reduce((n,s)=>n+s.bytes,0)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length>3)throw Error('Optional private resume directory only');console.log(JSON.stringify(await acquire(process.argv[2]),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
