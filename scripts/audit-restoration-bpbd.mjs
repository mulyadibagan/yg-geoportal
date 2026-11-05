// Offline audit of official BPBD response records; never a unique-fire count or score.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import C from '../js/restoration-catalog.js';
import {calendarDate} from './audit-restoration-tmat.mjs';
export const SOURCES=Object.freeze({'7345eba0-2739-4614-855b-adec8fc75480':2026,'ebd32377-bedd-484b-9825-0641d5543354':2025});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function inspect(data,source){
 C.validatePoints(data);
 const seen=new Set(),categories={},dates=[];
 let invalidDates=0,yearMismatches=0,exactDuplicateRows=0;
 const records=data.features.map((feature,index)=>{
  const p=feature.properties||{},raw=typeof p.tanggal==='string'?p.tanggal.trim():null;
  const day=calendarDate(raw),key=sha(JSON.stringify(feature));
  if(!day)invalidDates++;else {dates.push(day);if(Number(day.slice(0,4))!==source.titleYear)yearMismatches++;}
  const duplicate=seen.has(key);if(duplicate)exactDuplicateRows++;seen.add(key);
  const category=typeof p.kategori==='string'?p.kategori:null;
  categories[category??'Missing']=(categories[category??'Missing']||0)+1;
  return {ref:`${source.uuid}:${source.sha256}:${index}`,feature,calendarDate:day,category,exactDuplicate:duplicate};
 });
 dates.sort();
 return {source:{...source,responseRecords:records.length,invalidDates,yearMismatches,exactDuplicateRows,categories,firstDate:dates[0]??null,lastDate:dates.at(-1)??null,completeHistory:false,uniqueIncidents:null,scoringValidated:false},records};
}
export async function loadPackage(directory,privateRoot){
 const dir=await fs.realpath(directory);
 if(!dir.startsWith(privateRoot+path.sep))throw Error('BPBD input must remain private');
 const manifestFile=await fs.realpath(path.join(dir,'manifest.json'));
 if(!manifestFile.startsWith(dir+path.sep)||(await fs.stat(manifestFile)).size>65536)throw Error('Invalid BPBD manifest file');
 const manifestBytes=await fs.readFile(manifestFile);
 const manifest=JSON.parse(manifestBytes);
 if(manifest.access!=='staff_only'||!Array.isArray(manifest.records)||manifest.records.length!==2)throw Error('Invalid BPBD manifest');
 const seen=new Set(),sources=[],records=[];
 for(const entry of manifest.records){
  if(!SOURCES[entry.uuid]||seen.has(entry.uuid)||entry.titleYear!==SOURCES[entry.uuid]||entry.name!==entry.uuid+'.geojson'||entry.url!==`https://geoportal.riau.go.id/katalog/${entry.uuid}/download`)throw Error('Unknown BPBD source');
  seen.add(entry.uuid);
  const file=await fs.realpath(path.join(dir,entry.name));
  if(!file.startsWith(dir+path.sep)||(await fs.stat(file)).size>4*1024*1024)throw Error('Invalid BPBD file');
  const bytes=await fs.readFile(file),data=JSON.parse(bytes);
  if(bytes.length!==entry.bytes||sha(bytes)!==entry.sha256||data.features?.length!==entry.features)throw Error('BPBD source checksum/count mismatch');
  const result=inspect(data,entry);sources.push(result.source);records.push(...result.records);
 }
 return {manifestSha256:sha(manifestBytes),sources,records};
}
