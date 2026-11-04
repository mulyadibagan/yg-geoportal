// Public SiTMAT observations only. Keeps native units/timestamps and never approves scores.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const ORIGIN='https://sitmat.kemenlh.go.id';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function detailUrl(station){
 if(!station||typeof station.station_id!=='string'||! /^[A-Za-z0-9_.:-]{1,120}$/.test(station.station_id)||!['simatag','sipalaga'].includes(station.source))throw Error('Invalid public station identity');
 return ORIGIN+'/api/air-gambut/masyarakat/station-detail?'+new URLSearchParams({station_id:station.station_id,days:'30',source:station.source});
}
export function publicSelection(feature){
 const c=feature.geometry?.coordinates;
 return feature.geometry?.type==='Point'&&Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&c[0]>=99.9&&c[0]<=104.6&&c[1]>=-1.6&&c[1]<=2.6;
}
export function observationAudit(data){
 let p=data.properties; if(p?.properties)p=p.properties;
 const detail=p?.detail||{},rows=detail.ListIOTSensorWaterLevel;
 const records=Array.isArray(rows)?rows:[];
 return {recordCount:records.length,recordFields:[...new Set(records.flatMap(row=>Object.keys(row)))].sort(),
  firstRecord:records[0]??null,lastRecord:records.at(-1)??null,detailFields:Object.keys(detail).sort(),
  // Do not infer a timezone, datum, calibration or unit from a number or category.
  unitConfirmed:false,timezoneConfirmed:false,datumConfirmed:false,calibrationConfirmed:false,scoringValidated:false};
}
async function get(url){
 const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok||!r.body)throw Error('Public source status '+r.status);
 const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>32*1024*1024)throw Error('Response exceeds 32 MiB');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks);return {bytes,data:JSON.parse(bytes.toString('utf8')),sha256:sha(bytes)};
}
export async function acquire(){
 const privateRoot=path.join(root,'private-data');await fs.mkdir(privateRoot,{recursive:true});
 if(await fs.realpath(privateRoot)!==path.join(await fs.realpath(root),'private-data'))throw Error('Private root redirected');
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-tmat-'));
 const url=ORIGIN+'/api/air-gambut',index=await get(url);
 if(index.data.type!=='FeatureCollection'||!Array.isArray(index.data.features)||index.data.features.length>25000)throw Error('Invalid public station index');
 await fs.writeFile(path.join(output,'public-stations.geojson'),index.bytes,{flag:'wx'});
 const selected=index.data.features.filter(publicSelection),identities=new Set(),records=[];
 for(const feature of selected){
  const p=feature.properties,url=detailUrl(p),key=p.source+':'+p.station_id;
  if(identities.has(key))throw Error('Duplicate public station');identities.add(key);
  const name='station-'+String(records.length+1).padStart(4,'0')+'.json';
  try{
   const result=await get(url);
   if(result.data.success!==true||result.data.station_id!==p.station_id||result.data.source!==p.source)throw Error('Station response identity mismatch');
   await fs.writeFile(path.join(output,name),result.bytes,{flag:'wx'});
   records.push({stationId:p.station_id,source:p.source,url,name,sha256:result.sha256,bytes:result.bytes.length,retrievedAt:new Date().toISOString(),audit:observationAudit(result.data)});
  }catch(error){records.push({stationId:p.station_id,source:p.source,url,error:error.message,scoringValidated:false});}
 }
 const manifest={schemaVersion:1,access:'staff_only',retrievedAt:new Date().toISOString(),source:ORIGIN,index:{url,sha256:index.sha256,bytes:index.bytes.length},selection:{publicEnvelope:[99.9,-1.6,104.6,2.6],administrativeClip:false,localGeometryTransmitted:false},stationCount:selected.length,records,complete:records.every(row=>!row.error),scoringValidated:false};
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
 return {output,selectedStations:selected.length,downloaded:records.filter(row=>!row.error).length,measurementRecords:records.reduce((sum,row)=>sum+(row.audit?.recordCount||0),0),complete:manifest.complete,scoringValidated:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==2)throw Error('No external input accepted');console.log(JSON.stringify(await acquire(),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
