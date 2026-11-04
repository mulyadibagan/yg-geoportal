(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YG_RESTORATION_INVENTORY=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_BYTES=4*1024*1024;
 const FIELDS=['Object_ID','Layer_ID','Layer_Label','Nama_Objek','Status_Objek','Kabupaten','Kecamatan','Desa','Tahun','Revision'];
 function select(data){
  if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length>25000)throw Error('Snapshot inventaris tidak valid');
  const crs=data.crs?.properties?.name;
  if(data.crs&&!['EPSG:4326','urn:ogc:def:crs:EPSG::4326','urn:ogc:def:crs:OGC:1.3:CRS84'].includes(crs))throw Error('CRS inventaris belum didukung');
  const counts=new Map();
  for(const f of data.features){const id=f?.properties?.Object_ID;if(typeof id==='string'&&id.trim())counts.set(id,(counts.get(id)||0)+1);}
  const output={fdrs:[],blocks:[]},excluded={inactive:0,ambiguousId:0,invalidPoint:0};
  for(const f of data.features){
   const p=f?.properties;if(!p||!['fdrs','sekat_kanal'].includes(p.Layer_ID))continue;
   if(p.Status_Objek!=='Aktif'){excluded.inactive++;continue;}
   if(typeof p.Object_ID!=='string'||!p.Object_ID.trim()||counts.get(p.Object_ID)!==1){excluded.ambiguousId++;continue;}
   const c=f.geometry?.coordinates;
   if(f.geometry?.type!=='Point'||!Array.isArray(c)||c.length!==2||!c.every(Number.isFinite)||Math.abs(c[0])>180||Math.abs(c[1])>90){excluded.invalidPoint++;continue;}
   const properties={};
   for(const key of FIELDS){const value=p[key];if(typeof value==='string'||typeof value==='number'&&Number.isFinite(value))properties[key]=value;}
   properties.Konteks='Inventaris infrastruktur; bukan pengukuran TMAT atau skor ekologis';
   output[p.Layer_ID==='fdrs'?'fdrs':'blocks'].push({type:'Feature',id:p.Object_ID,geometry:{type:'Point',coordinates:c.slice()},properties});
  }
  const generatedAt=typeof data.snapshotGeneratedAt==='string'?data.snapshotGeneratedAt:typeof data.generatedAt==='string'?data.generatedAt:null;
  return {fdrs:{type:'FeatureCollection',features:output.fdrs,generatedAt},blocks:{type:'FeatureCollection',features:output.blocks,generatedAt},excluded,scoringValidated:false};
 }
 async function read(response){
  if(!response.ok||!response.body)throw Error('Snapshot database belum tersedia (HTTP '+response.status+')');
  if(Number(response.headers.get('content-length'))>MAX_BYTES)throw Error('Snapshot inventaris terlalu besar');
  const reader=response.body.getReader(),chunks=[];let length=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX_BYTES)throw Error('Snapshot inventaris terlalu besar');chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return select(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
 }
 return {select,read,MAX_BYTES};
});
