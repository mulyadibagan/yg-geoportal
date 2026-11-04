// Local quality evidence. No interpolation, timezone assignment, normalization or scoring.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {ORIGIN,detailUrl,publicSelection} from './acquire-restoration-tmat.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function numeric(value){
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 if(typeof value!=='string'||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()))return null;
 const result=Number(value);return Number.isFinite(result)?result:null;
}
export function calendarDate(value){
 if(typeof value!=='string')return null;
 const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
 const named=/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value);
 const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
 const year=iso?Number(iso[1]):named?Number(named[3]):NaN;
 const month=iso?Number(iso[2]):named?months.indexOf(named[2].toLowerCase())+1:NaN;
 const day=iso?Number(iso[3]):named?Number(named[1]):NaN;
 if(!Number.isInteger(year)||year<1900||year>2100||month<1||month>12||day<1||day>31)return null;
 const check=new Date(Date.UTC(year,month-1,day));
 if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day)return null;
 // Calendar normalization only. This does not assign UTC to the measurement.
 return String(year)+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
export function auditRows(rows){
 if(!Array.isArray(rows))return {available:false,records:null};
 const seen=new Map(),details=new Map(),days=new Set();let numericValues=0,missingValues=0,invalidValues=0,missingDateTime=0,repeatedDateTime=0,conflictingDateTime=0;
 for(const [index,row] of rows.entries()){
  const value=numeric(row.WaterLevel);
  if(value!==null)numericValues++;
  else if(row.WaterLevel===null||row.WaterLevel===undefined||String(row.WaterLevel).trim()==='')missingValues++;
  else invalidValues++;
  const date=calendarDate(row.Tanggal);
  if(!date||typeof row.Jam!=='string'||!/^\d{2}:\d{2}(?::\d{2})?$/.test(row.Jam)||Number(row.Jam.slice(0,2))>23||Number(row.Jam.slice(3,5))>59||(row.Jam.length===8&&Number(row.Jam.slice(6,8))>59)){missingDateTime++;continue;}
  days.add(date);
  const key=date+' '+(row.Jam.length===5?row.Jam+':00':row.Jam);
  const comparable=value===null?JSON.stringify({raw:row.WaterLevel}):JSON.stringify(value);
  if(seen.has(key)){repeatedDateTime++;if(seen.get(key)!==comparable)conflictingDateTime++;}
  else seen.set(key,comparable);
  const entries=details.get(key)||[];entries.push({sourceRecordIndex:index,sourceDate:row.Tanggal,sourceClock:row.Jam,rawWaterLevel:row.WaterLevel,comparable});details.set(key,entries);
 }
 const conflictingTimes=[...details].filter(([,entries])=>new Set(entries.map(row=>row.comparable)).size>1).map(([localCalendarTime,entries])=>({localCalendarTime,timezone:null,records:entries.map(({comparable,...row})=>row),selectedValue:null,status:'source-review-required'}));
 const observedDates=[...days].sort();
 return {available:true,records:rows.length,numericValues,missingValues,invalidValues,missingDateTime,repeatedDateTime,conflictingDateTime,conflictingTimes,observedCalendarDays:days.size,firstObservedDate:observedDates[0]??null,lastObservedDate:observedDates.at(-1)??null,expectedCadence:null,completePeriodValidated:false,timezoneConfirmed:false,datumConfirmed:false,calibrationConfirmed:false,scoringValidated:false};
}
export async function audit(directory){
 const privateRoot=await fs.realpath(path.join(root,'private-data')),input=await fs.realpath(path.resolve(root,directory));
 if(path.dirname(input)!==privateRoot||!path.basename(input).startsWith('restoration-tmat-'))throw Error('Input must remain private');
 const manifestBytes=await fs.readFile(path.join(input,'manifest.json')),m=JSON.parse(manifestBytes);
 if(m.source!==ORIGIN||m.complete!==true||m.index.url!==ORIGIN+'/api/air-gambut')throw Error('Incomplete TMAT source');
 const indexBytes=await fs.readFile(path.join(input,'public-stations.geojson'));
 if(sha(indexBytes)!==m.index.sha256||indexBytes.length!==m.index.bytes)throw Error('Station index checksum mismatch');
 const index=JSON.parse(indexBytes),stations=new Map(index.features.map(f=>[f.properties.source+':'+f.properties.station_id,f]));
 const expected=new Set(index.features.filter(publicSelection).map(f=>f.properties.source+':'+f.properties.station_id));
 const received=new Set(m.records.map(r=>r.source+':'+r.stationId));
 if(expected.size!==m.stationCount||m.records.length!==expected.size||received.size!==expected.size||[...received].some(id=>!expected.has(id)))throw Error('Incomplete station selection');
 const require=createRequire(path.join(privateRoot,'restoration-runtime/package.json')),T=require('@turf/turf');
 const boundaryBytes=await fs.readFile(path.join(root,'data/batas_administrasi_desa_riau.geojson'));
 const sourceBytes=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson'));
 const makeIndex=bytes=>JSON.parse(bytes).features.map((feature,i)=>({feature,sourceRow:i+1,bbox:T.bbox(feature),valid:null}));
 const boundaries=makeIndex(boundaryBytes),units=makeIndex(sourceBytes);
 function spatialContext(coordinates){
  const point=T.point(coordinates),labels=[],sourceRows=[];let excludedBoundaries=0,excludedUnits=0;
  for(const [items,isBoundary] of [[boundaries,true],[units,false]])for(const row of items){
   const b=row.bbox;if(coordinates[0]<b[0]||coordinates[0]>b[2]||coordinates[1]<b[1]||coordinates[1]>b[3])continue;
   if(row.valid===null){try{row.valid=T.booleanValid(row.feature)&&T.kinks(row.feature).features.length===0;}catch{row.valid=false;}}
   if(!row.valid){if(isBoundary)excludedBoundaries++;else excludedUnits++;continue;}
   if(T.booleanPointInPolygon(point,row.feature)){if(isBoundary)labels.push({province:row.feature.properties.WADMPR??null,district:row.feature.properties.WADMKK??null});else sourceRows.push(row.sourceRow);}
  }
  return {boundaryReferenceLabels:labels,bbsdlpSourceRows:sourceRows,excludedBoundaries,excludedUnits,authoritativeDistrictCorrection:false,polygonHydrologyValidated:false};
 }
 const records=[];
 for(const r of m.records){
  if(!/^station-\d{4}\.json$/.test(r.name)||r.url!==detailUrl({station_id:r.stationId,source:r.source}))throw Error('Invalid station file');
  const bytes=await fs.readFile(path.join(input,r.name));if(bytes.length!==r.bytes||sha(bytes)!==r.sha256)throw Error('Station checksum mismatch');
  const data=JSON.parse(bytes),p=data.properties?.properties??data.properties,station=stations.get(r.source+':'+r.stationId);
  if(!station||data.station_id!==r.stationId||data.source!==r.source||p.station_id!==r.stationId)throw Error('Station identity mismatch');
  const coordinates=station.geometry.coordinates,detailCoordinates=[numeric(p.longitude),numeric(p.latitude)];
  records.push({stationId:r.stationId,source:r.source,coordinates,detailCoordinates,coordinateAgreement:detailCoordinates.every((v,i)=>v!==null&&v===coordinates[i]),
   sourceProvince:p.provinsi??null,sourceDistrict:p.kabupaten??null,historyDays:p.history_days??null,spatialContext:spatialContext(coordinates),
   audit:auditRows(p.detail?.ListIOTSensorWaterLevel),historySummaryRecords:Array.isArray(p.history)?p.history.length:null,
   unitEvidence:{publicUiLabel:r.source==='simatag'?'cm':'m',responseUnitExplicit:false},scoringValidated:false});
 }
 const result={schemaVersion:1,access:'staff_only',sourceManifestSha256:sha(manifestBytes),boundarySha256:sha(boundaryBytes),bbsdlpSha256:sha(sourceBytes),records,scoringValidated:false,
  limitations:['Public envelope selection includes surrounding provinces; not a Riau administrative clip.','Dates and clock strings are retained; timezone, measurement datum and calibration are not established.','Hourly/detail and daily history representations must not be summed as separate observations.','Zero is retained as a measurement; missing/invalid values are not replaced.','No inference of hydrological condition across a polygon from a station alone.']};
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-tmat-audit-'));
 await fs.writeFile(path.join(output,'audit.json'),JSON.stringify(result,null,2),{flag:'wx'});
 return {output,stations:records.length,stationsWithSeries:records.filter(r=>r.audit.records>0).length,stationsWithinRiauReference:records.filter(r=>r.spatialContext.boundaryReferenceLabels.some(l=>String(l.province).toLowerCase()==='riau')).length,stationsWithinBbsdLP:records.filter(r=>r.spatialContext.bbsdlpSourceRows.length>0).length,records:records.reduce((n,r)=>n+(r.audit.records||0),0),coordinateDisagreements:records.filter(r=>!r.coordinateAgreement).length,missingValues:records.reduce((n,r)=>n+(r.audit.missingValues||0),0),invalidValues:records.reduce((n,r)=>n+(r.audit.invalidValues||0),0),conflictingDateTime:records.reduce((n,r)=>n+(r.audit.conflictingDateTime||0),0),scoringValidated:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==3)throw Error('Provide a private TMAT package');console.log(JSON.stringify(await audit(process.argv[2]),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
