// Private staging only. Raw evidence is never assigned an ecological indicator score.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import A from '../js/restoration-scoring.js';
import C from '../js/restoration-catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const FIELDS = ['KD_SL','SPT','JNTNH1','JNTNH2','JNTNH3','KETEBALAN','TAHUN','KK','KODE_GBT','KELAS_GBT','pH','SUBSTRATUM','PROVINSI','KABKOT','Luas_Ha'];
function bounds(geometry) {
  const result = [Infinity,Infinity,-Infinity,-Infinity];
  const visit = coordinates => {
    if (typeof coordinates[0] === 'number') {
      result[0]=Math.min(result[0],coordinates[0]);result[1]=Math.min(result[1],coordinates[1]);
      result[2]=Math.max(result[2],coordinates[0]);result[3]=Math.max(result[3],coordinates[1]);
    } else coordinates.forEach(visit);
  };
  visit(geometry.coordinates); return result;
}
const isPoint = feature => feature?.type==='Feature' && feature.geometry?.type==='Point' &&
  Array.isArray(feature.geometry.coordinates) && feature.geometry.coordinates.length>=2 &&
  feature.geometry.coordinates.slice(0,2).every(Number.isFinite) &&
  Math.abs(feature.geometry.coordinates[0])<=180 && Math.abs(feature.geometry.coordinates[1])<=90;

export function prepare(peat, hotspots, provenance) {
  C.validate(peat); // WGS84 polygon structure only; not topology/authority approval.
  if (hotspots?.type!=='FeatureCollection' || !Array.isArray(hotspots.features) || hotspots.features.length>250000)
    throw Error('Snapshot hotspot tidak valid atau terlalu besar.');
  if(hotspots.crs && !/^(?:urn:ogc:def:crs:OGC:1\.3:CRS84|urn:ogc:def:crs:EPSG::4326|EPSG:4326)$/i.test(hotspots.crs?.properties?.name||''))
    throw Error('CRS hotspot harus WGS84 longitude/latitude.');
  if (!/^[a-f0-9]{64}$/.test(provenance?.peatSha256||'') || !/^[a-f0-9]{64}$/.test(provenance?.hotspotSha256||''))
    throw Error('SHA-256 kedua sumber wajib tersedia.');
  const seenGeometry=new Map(), seenFeature=new Map();
  let duplicateGeometryRows=0,duplicateFeatureRows=0,districtConflicts=0;
  const units=peat.features.map((feature,index)=>{
    const geometryHash=sha(JSON.stringify(feature.geometry)),featureHash=sha(JSON.stringify(feature));
    const id='bbsdlp-'+provenance.peatSha256.slice(0,16)+'-'+String(index+1).padStart(4,'0');
    const duplicateGeometryOf=seenGeometry.get(geometryHash)||null, duplicateFeatureOf=seenFeature.get(featureHash)||null;
    if(duplicateGeometryOf)duplicateGeometryRows++;else seenGeometry.set(geometryHash,id);
    if(duplicateFeatureOf)duplicateFeatureRows++;else seenFeature.set(featureHash,id);
    const p=feature.properties||{};
    const districtConflict=Boolean(p.KK && p.KABKOT && A.district(p.KK)!==A.district(p.KABKOT));
    if(districtConflict)districtConflicts++;
    return {type:'Feature',id,geometry:feature.geometry,properties:{
      sourceFeatureIndex:index,sourceSha256:provenance.peatSha256,
      // Source values are retained verbatim, including categorical depth/pH/soil classes.
      sourceAttributes:Object.fromEntries(FIELDS.map(key=>[key,p[key]??null])),
      qa:{duplicateGeometryOf,duplicateFeatureOf,districtConflict,topologyValidated:false},
      restorationIndicators:Object.fromEntries(A.INDICATORS.map(i=>[i.id,{value:null,validated:false}])),
      evidence:{fireSnapshot:{observationCount:0,completeFireHistory:false,scoringValidated:false}}
    }};
  });
  const indexed=units.map(unit=>({unit,bbox:bounds(unit.geometry)}));
  let invalidPoints=0,matchedObservations=0,unmatchedObservations=0,multipleUnitObservations=0;
  for(const feature of hotspots.features){
    if(!isPoint(feature)){invalidPoints++;continue;}
    const point=feature.geometry.coordinates;let matches=0;
    for(const {unit,bbox:b} of indexed){
      if(point[0]<b[0]||point[0]>b[2]||point[1]<b[1]||point[1]>b[3])continue;
      if(A.contains(point,unit.geometry)){unit.properties.evidence.fireSnapshot.observationCount++;matches++;}
    }
    if(matches)matchedObservations++;else unmatchedObservations++;
    if(matches>1)multipleUnitObservations++;
  }
  const manifest={schemaVersion:1,access:'staff_only',purpose:'raw-evidence-preparation',scoringValidated:false,
    unitIdentity:'row-index-bound-to-exact-source-sha256; not cross-version or legal KHG identity',
    sources:[
      {id:'peat',source:'BBSDLP; data/Gambut_BBSDLP_2019.geojson',sha256:provenance.peatSha256,
        crs:peat.crs??null,years:[...new Set(peat.features.map(f=>f.properties?.TAHUN??null))],featureCount:units.length},
      {id:'hotspots',source:'data/hotspot-high-confidence.geojson',sha256:provenance.hotspotSha256,
        generatedAt:hotspots.generatedAt??null,coverageStart:hotspots.coverageStart??null,coverageEnd:hotspots.coverageEnd??null,
        periodDays:hotspots.periodDays??null,sourceStatus:hotspots.sourceStatus??null,
        skippedChunks:hotspots.skippedChunks??null,providers:hotspots.providers??null,featureCount:hotspots.features.length}
    ],
    qa:{structuralGeometryValidated:true,topologyValidated:false,duplicateGeometryRows,duplicateFeatureRows,districtConflicts,
      invalidPoints,matchedObservations,unmatchedObservations,multipleUnitObservations},
    limitations:[
      'All five indicator values remain null and unvalidated; no priority scores.',
      'Hotspot observations are raw snapshot detections, not unique fire events or verified fire history.',
      'Zero observations does not mean no historical fire; source coverage/failures must be reviewed.',
      'Multiple units may receive the same observation; counts are not additive across overlapping units.',
      'No area, polygon intersection, legal KHG identity, or hydrological condition is inferred.',
      'Source attributes and duplicate/conflicting units require expert and spatial QA before use.'
    ]};
  return {manifest,units:{type:'FeatureCollection',features:units}};
}

async function readJSON(relative){
  const file=path.join(root,relative);
  const handle=await fs.open(file,'r');
  try {
    // Bound the read even if the source grows after stat.
    if((await handle.stat()).size>64*1024*1024)throw Error('Sumber melampaui batas.');
    const chunks=[];let size=0;
    for await(const chunk of handle.createReadStream({autoClose:false})){
      size+=chunk.length;if(size>64*1024*1024)throw Error('Sumber melampaui batas.');chunks.push(chunk);
    }
    const bytes=Buffer.concat(chunks);return {data:JSON.parse(bytes.toString('utf8')),sha256:sha(bytes)};
  } finally {await handle.close();}
}
export async function stage(){
  const [peat,hotspots]=await Promise.all([readJSON('data/Gambut_BBSDLP_2019.geojson'),readJSON('data/hotspot-high-confidence.geojson')]);
  const result=prepare(peat.data,hotspots.data,{peatSha256:peat.sha256,hotspotSha256:hotspots.sha256});
  const archiveIndex=await readJSON('data/burned-area-monthly/index.json');
  if(!Array.isArray(archiveIndex.data.reports) || archiveIndex.data.reports.length>120)throw Error('Indeks arsip tidak valid.');
  const archives=[],archiveMetadata=[],months=new Set();
  for(const report of archiveIndex.data.reports){
    if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(report.month||'') || months.has(report.month) ||
      report.data!=='data/burned-area-monthly/'+report.month+'.geojson')throw Error('Jalur/bulan arsip tidak valid.');
    months.add(report.month);
    const source=await readJSON(report.data);C.validate(source.data);
    archives.push({month:report.month,data:source.data});
    archiveMetadata.push({month:report.month,source:report.data,sha256:source.sha256,status:report.status??null,
      generatedAt:source.data.generatedAt??null,method:source.data.method??null,areaCrs:source.data.areaCrs??null,
      featureCount:source.data.features.length,scoringValidated:false});
  }
  result.manifest.fireArchive={indexSha256:archiveIndex.sha256,reports:archiveMetadata,
    relationToUnits:'not-computed; no burned area assigned to peat units',
    completeness:'follow source status; partial is not complete history',scoringValidated:false,
    warning:'Satellite indications only; no field verification inferred. Monthly areas and repeated events are not summed.'};
  const privateRoot=path.join(root,'private-data');await fs.mkdir(privateRoot,{recursive:true});
  const resolvedRoot=await fs.realpath(root),resolvedPrivate=await fs.realpath(privateRoot);
  if(resolvedPrivate!==path.join(resolvedRoot,'private-data'))throw Error('Direktori privat tidak boleh dialihkan ke lokasi lain.');
  // Fresh directory; never overwrite a previously reviewed package.
  const output=await fs.mkdtemp(path.join(privateRoot,'restoration-sources-'));
  await fs.writeFile(path.join(output,'units.geojson'),JSON.stringify(result.units),{flag:'wx'});
  await fs.writeFile(path.join(output,'fire-archive.json'),JSON.stringify({index:archiveIndex.data,archives}),{flag:'wx'});
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(result.manifest,null,2),{flag:'wx'});
  return {output,featureCount:result.units.features.length,qa:result.manifest.qa,fireArchive:archiveMetadata.map(r=>({month:r.month,status:r.status,featureCount:r.featureCount}))};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try {if(process.argv.length!==2)throw Error('Tidak ada parameter yang didukung.');console.log(JSON.stringify(await stage(),null,2));}
  catch {console.error('Persiapan gagal. Periksa sumber asli dan direktori private-data; tidak ada skor yang dibuat.');process.exitCode=1;}
}
