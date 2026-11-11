(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YG_RESTORATION_REVIEW=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX=12*1024*1024;
 async function decode(data,manifestBytes,source,sourceHash,crypto){
  if(!(data instanceof Uint8Array)||!data.length||data.length>MAX||!(manifestBytes instanceof Uint8Array)||manifestBytes.length>65536)throw Error('Ukuran paket tidak valid');
  const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
  const m=JSON.parse(new TextDecoder().decode(manifestBytes));
  if(m.access!=='staff_only'||m.sourceGeometryModified!==false||m.priorityAssessed!==false||m.originalPeatSha256!==sourceHash||m.reviewCandidatesSha256!==await digest(data))throw Error('Manifest atau checksum tidak cocok dengan sumber gambut');
  const g=JSON.parse(new TextDecoder().decode(data));
  if(g.type!=='FeatureCollection'||g.metadata?.access!=='staff_only'||g.metadata.sourceSha256!==sourceHash||!Array.isArray(g.features)||!g.features.length||g.features.length>source.length)throw Error('Paket kandidat tidak valid');
  const seen=new Set(),features=[];
  for(const f of g.features){
   const p=f.properties,i=p?.sourceFeatureIndex,original=source[i];
   if(!Number.isSafeInteger(i)||i<0||!original||seen.has(i)||f.id!==`bbsdlp-${sourceHash.slice(0,16)}-${String(i+1).padStart(4,'0')}`||JSON.stringify(f.geometry)!==JSON.stringify(original.geometry)||p.reviewCandidate!==true||p.priority!=='Belum dinilai'||p.ecologicalScore!==null||p.scoringValidated!==false||p.sourceUnitApproved!==false||p.forestObservationYear!==null||p.canalObservationYear!==null||p.implementationReadiness?.assessed!==false||p.implementationReadiness?.score!==null)throw Error('Identitas, geometri atau status kandidat berubah');
   if(!Array.isArray(p.lossFragmentRefs)||!p.lossFragmentRefs.length||p.lossFragmentRefs.length>100000||!p.lossFragmentRefs.every(Number.isSafeInteger)||!Number.isSafeInteger(p.canalPartsIntersecting)||p.canalPartsIntersecting<1)throw Error('Rujukan bukti tidak valid');
   if(p.sourceFeatureSha256!==await digest(new TextEncoder().encode(JSON.stringify(original))))throw Error('Checksum unit sumber tidak cocok');
   seen.add(i);features.push({type:'Feature',id:f.id,geometry:original.geometry,properties:{sourceFeatureIndex:i,KABKOT:original.properties?.KABKOT||'',candidateReview:true,priority:'Belum dinilai',ecologicalScore:null,lossFragmentCount:p.lossFragmentRefs.length,canalPartsIntersecting:p.canalPartsIntersecting}});
  }
  return {type:'FeatureCollection',features};
 }
 return {decode,MAX_BYTES:MAX};
});
