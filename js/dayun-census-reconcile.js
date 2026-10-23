(function(root){
 'use strict';
 const PREFIX='[Penyesuaian sensus 2026-08]';
 const fc=features=>({type:'FeatureCollection',features});
 function parts(f,T){return f.geometry.type==='MultiPolygon'?f.geometry.coordinates.map(c=>T.polygon(c)):[f];}
 // Turf 6 in the viewer and Turf 7 in the tests have different signatures.
 const intersection=(a,b,T)=>T.intersect.length<2?T.intersect(fc([a,b])):T.intersect(a,b);
 function targets({records,census,boundaries,block,T}){
  const zones=new Map();for(const f of boundaries.features){const id=f.properties?.sourceGawanganId;if(id?.startsWith('GT-'+block+'-')){if(!zones.has(id))zones.set(id,[]);zones.get(id).push(f);}}
  const rows=new Map();for(const record of records.filter(r=>new RegExp('^Batas nanas baru Blok '+block+'\\b').test(r.name))){for(const area of record.collection.features){if(!/Polygon$/.test(area.geometry?.type))continue;
   const hits=[...zones].map(([id,polys])=>({id,polys,area:polys.reduce((sum,p)=>{const hit=intersection(area,p,T);return sum+(hit?T.area(hit):0);},0)})).sort((a,b)=>b.area-a.area);
   if(!hits[0]||hits[0].area/T.area(area)<.5)throw Error('Batas '+area.properties?.name+' belum cocok dengan satu gawangan.');
   const zone=hits[0].id,cohorts=census.objects.find(o=>o.objectId==='DAYUN-'+zone)?.crops.find(c=>c.crop==='NANAS')?.plantingCohorts?.filter(c=>c.period==='2026-08')||[];
   if(cohorts.length!==1||!Number.isSafeInteger(cohorts[0].plantedCount)||cohorts[0].plantedCount<0)continue;
   if(rows.has(zone))throw Error('Ada lebih dari satu batas tanaman baru untuk '+zone+'. Periksa sebelum menyesuaikan.');
   const allowed=hits[0].polys.flatMap(z=>{const p=intersection(area,z,T);return p?parts(p,T):[];});rows.set(zone,{zone,target:cohorts[0].plantedCount,area,allowed});
  }}return [...rows.values()];
 }
 async function plan({rows,points,T,block,validCoordinate=()=>true,id=()=>crypto.randomUUID(),yieldWork=()=>new Promise(r=>setTimeout(r,0))}){
  const all=[...new Map(points.map(f=>[f.properties.id,f])).values()],updates=[],summary=[],seen=new Set();
  const inside=(f,polys)=>polys.some(p=>T.booleanPointInPolygon(f,p));
  for(const row of rows){
   const existing=all.filter(f=>f.properties.status!=='rejected'&&inside(f,[row.area]));
   for(const f of existing){if(seen.has(f.properties.id))throw Error('Batas tanaman baru saling tumpang tindih pada titik '+f.properties.id);seen.add(f.properties.id);}
   let add=Math.max(0,row.target-existing.length),remove=Math.max(0,existing.length-row.target);
   const rank=f=>f.properties.note?.startsWith(PREFIX)?0:f.properties.status==='accepted'?3:f.properties.origin==='manual_addition'?2:1;
   const excess=[...existing].sort((a,b)=>rank(a)-rank(b)||a.properties.id.localeCompare(b.properties.id)).slice(0,remove);
   for(const f of excess){const next=JSON.parse(JSON.stringify(f));next.properties.status='rejected';next.properties.rejection_reason='unspecified';next.properties.note=(PREFIX+' Dikeluarkan dari hitungan sesuai instruksi pemilik; bukan penilaian spesies. '+(f.properties.note||'')).slice(0,1000);updates.push(next);}
   if(add){
    const b=T.bbox(row.area),sx=111320*Math.cos((b[1]+b[3])/2*Math.PI/180),sy=110574,cell=.2,occupied=new Set(all.map(f=>Math.floor((f.geometry.coordinates[0]-b[0])*sx/cell)+','+Math.floor((f.geometry.coordinates[1]-b[1])*sy/cell)));
    let candidates=[],checked=0;
    // These are count-derived positions, never image detections. Do not revive
    // rejected points or place new points outside imagery or official zones.
    for(let y=cell/2;y<(b[3]-b[1])*sy;y+=cell)for(let x=cell/2;x<(b[2]-b[0])*sx;x+=cell){
     const c=[+(b[0]+x/sx).toFixed(10),+(b[1]+y/sy).toFixed(10)],key=Math.floor(x/cell)+','+Math.floor(y/cell);
     if(!occupied.has(key)&&validCoordinate(c)&&inside(T.point(c),row.allowed))candidates.push(c);
     if(++checked%2500===0)await yieldWork();if(checked>2000000)throw Error('Area terlalu besar untuk penyesuaian otomatis.');
    }
    if(candidates.length<add)throw Error(row.zone+': ruang citra dalam batas tidak cukup untuk '+add+' titik perkiraan.');
    for(let i=0;i<add;i++){const c=candidates[Math.floor((i+.5)*candidates.length/add)];updates.push(T.point(c,{id:block+'-manual-census-'+id(),status:'candidate',origin:'manual_addition',zones:[row.zone],species_confirmed:false,rejection_reason:'unspecified',note:PREFIX+' '+row.zone+'; posisi perkiraan untuk menyamakan jumlah penanaman, bukan hasil citra atau tanaman terverifikasi.'}));}
   }
   summary.push({zone:row.zone,before:existing.length,target:row.target,add,remove});
  }
  return{updates,summary};
 }
 const api={PREFIX,targets,plan};root.YG_DAYUN_CENSUS_RECONCILE=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
