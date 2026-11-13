/* Annual achievements use establishment evidence, never upload or monitoring dates. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YG_DASHBOARD_YEARS=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const norm=v=>String(v||'').trim().toLowerCase(), num=v=>Number.isFinite(Number(v))?Number(v):0;
const key=v=>norm(v).replace(/^(community-|monitoring-)(yg-)/,'$2');
function year(value){
 const s=String(value||'').trim();if(/^20\d{2}$/.test(s))return s;
 if(/^20\d{2}-\d{2}-\d{2}(?:T.*)?$/.test(s)&&!Number.isNaN(Date.parse(s)))return s.slice(0,4);
 const m=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](20\d{2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
 if(m){const d=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));if(d.getUTCFullYear()===+m[3]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[1])return m[3];}
 return 'unknown';
}
function propertyYear(p){return year(p.Tanggal_Selesai||p.Completion_Date||p.Tanggal_Tanam||p.Planting_Date||p.Tahun);}
function historyParts(text,total){
 const parts=String(text||'').split(/;\s*(?=(?:[A-Za-z]+\s+)?20\d{2}(?:\s*[–—-]\s*20\d{2})?\s*:)/).map(s=>{const m=s.trim().match(/^(?:[A-Za-z]+\s+)?(20\d{2}(?:\s*[–—-]\s*20\d{2})?)\s*:\s*([\d.]+)\s*bibit\b/i);return m?{year:year(m[1]),count:Number(m[2].replace(/\./g,''))}:null;});
 return parts.length&&parts.every(Boolean)&&parts.reduce((n,p)=>n+p.count,0)===total?parts:null;
}
function build(input){
 const objects=input.planting.objects||[],index=new Map();
 objects.forEach(f=>{const p=f.properties||{};[p.Object_ID,p.Source_Report_ID,p.reportId].filter(Boolean).forEach(id=>{const k=key(id);if(!index.has(k))index.set(k,[]);index.get(k).push(f);});});
 const entries=[];
 (input.planting.rows||[]).forEach(row=>{
  if(!row.count)return;
  const features=[...new Set(row.sources.flatMap(id=>index.get(key(id))||[]))];
  const histories=features.map(f=>historyParts((f.properties||{}).Riwayat_Penanaman,row.count)).filter(Boolean);
  let parts;
  if(histories.length){const variants=new Set(histories.map(p=>JSON.stringify(p)));parts=variants.size===1?histories[0]:[{year:'unknown',count:row.count}];}
  else {
   // A multi-year history with an unallocated cumulative total must remain unassigned.
   const hasHistory=features.some(f=>String((f.properties||{}).Riwayat_Penanaman||'').trim());
   const primary=features.filter(f=>!/report/.test(norm((f.properties||{}).Source_Type))&&!/reports/.test(norm((f.properties||{}).Layer_ID)));
   const activities=features.filter(f=>{const p=f.properties||{};return norm(p.Source_Type)==='community_report'&&p.activityDate;});
   const dated=primary.length?primary:activities.map(f=>({properties:{Tanggal_Tanam:f.properties.activityDate}}));
   const years=[...new Set(dated.map(f=>propertyYear(f.properties||{})))];
   const historyYears=new Set(features.flatMap(f=>String((f.properties||{}).Riwayat_Penanaman||'').match(/20\d{2}/g)||[]));
   const y=years.length===1&&(!hasHistory||historyYears.size<=1)?years[0]:'unknown';
   parts=[{year:y,count:row.count}];
  }
  const source=features.find(f=>(f.properties||{}).Object_ID)||{},p=source.properties||{};
  parts.forEach(part=>entries.push({id:row.id,kind:'planting',category:row.category,year:part.year,count:part.count,villages:(row.villages||[]).map(v=>v.key),regencies:(row.villages||[]).map(v=>v.key.split('|')[2]),name:p.Nama_Objek||row.villages.map(v=>v.name).join(', ')||'Penanaman',donor:row.donor,url:'webgis.html?object='+encodeURIComponent(p.Object_ID||row.sources[0]),note:part.year==='unknown'?'Tahun penanaman belum dapat dipisahkan dari total lokasi.':''}));
 });
 const allowed=new Set(['sekat_kanal','fdrs','nursery_mangrove','nursery_kopi','apo','area_mangrove','area_kopi','mineral_land_restoration_area']);
 const seen=new Set();
 (input.features||[]).forEach(f=>{
  const p=f.properties||{},layer=norm(p.Layer_ID||p.Source_Layer),id=p.Object_ID;
  if(!allowed.has(layer)||!id||seen.has(key(id))||(/report/.test(norm(p.Source_Type))&&norm(p.Source_Type)!=='verified_report_asset'))return;
  if(/nonaktif|ditolak|menunggu|draft|rencana|planned|perlu perbaikan/i.test(p.Status_Objek||p.status||''))return;
  seen.add(key(id));
  // Area is a mapped footprint, kept separate from the cumulative restoration impact.
  const isArea=layer.startsWith('area_')||layer==='mineral_land_restoration_area';
  const area=num(p.Luas_Ha||p.Area_Ha||p.Luas);
  if(isArea&&area<=0)return;
  const footprintYears=[...new Set(String(p.Riwayat_Penanaman||'').match(/20\d{2}/g)||[])];
  const assetYear=isArea&&footprintYears.length?(footprintYears.length===1?footprintYears[0]:'unknown'):propertyYear(p);
  entries.push({id,kind:isArea?'area':layer,category:layer==='area_mangrove'?'mangrove':layer==='mineral_land_restoration_area'?'forest':'peat',year:assetYear,count:isArea?area:1,villages:p.Desa?[norm([p.Desa,p.Kecamatan,p.Kabupaten].join('|'))]:[],regencies:p.Kabupaten?[norm(p.Kabupaten)]:[],name:p.Nama_Objek||id,status:p.Status_Objek||p.status||'',donor:p.Donor||'',url:'webgis.html?object='+encodeURIComponent(id)});
 });
 const records=new Set(), regencyByVillage=new Map();
 entries.forEach(e=>e.villages.forEach(v=>{const a=v.split('|');if(a[2]){const k=a[0];if(!regencyByVillage.has(k))regencyByVillage.set(k,new Set());regencyByVillage.get(k).add(a[2]);}}));
 (input.capacity||[]).forEach(r=>{const id=r.id||[r.name,r.date,r.location].join('|');if(records.has(id))return;records.add(id);const village=norm(r.village||String(r.location||'').split(',')[0]);const known=regencyByVillage.get(village);const regency=norm(r.regency)||(known&&known.size===1?[...known][0]:'');entries.push({id,kind:r.kind==='activity-engagement'?'engagement':'training',year:year(r.achievementDate===undefined?r.date:r.achievementDate),count:1,participants:num(r.male)+num(r.female),villages:village?[village+'||'+regency]:[],regencies:regency?[regency]:[],group:r.group||'',name:r.name||'Kegiatan masyarakat',donor:r.donor||r.partner||'',url:'community-engagement.html'});});
 return entries;
}
function summary(entries,selected){
 const rows=selected==='all'?entries:entries.filter(e=>e.year===selected),out={plants:0,mangrove:0,coffee:0,peat:0,forest:0,area:0,canals:0,fdrs:0,nurseries:0,mangroveNurseries:0,wave:0,trainings:0,engagement:0,participants:0,villages:new Set(),regencies:new Set(),groups:new Set()};
 rows.forEach(e=>{if(e.kind==='planting'){out.plants+=e.count;out[e.category]+=e.count;}if(e.kind==='area')out.area+=e.count;if(e.kind==='sekat_kanal')out.canals+=e.count;if(e.kind==='fdrs')out.fdrs+=e.count;if(e.kind.startsWith('nursery_'))out.nurseries+=e.count;if(e.kind==='nursery_mangrove')out.mangroveNurseries+=e.count;if(e.kind==='apo')out.wave+=e.count;if(e.kind==='training')out.trainings++;if(e.kind==='engagement')out.engagement++;out.participants+=e.participants||0;e.villages.forEach(v=>{const a=v.split('|');out.villages.add(a[0]+'|'+(a[2]||''));});e.regencies.filter(Boolean).forEach(v=>out.regencies.add(v));if(e.group)out.groups.add(norm(e.group));});
 return out;
}
function mount(input){
 const trigger=document.getElementById('dash-restoration-area')?.closest('a');
 if(!trigger)return;
 // Keep annual reporting behind the existing restoration total.
 document.getElementById('achievement-years')?.remove();
 document.getElementById('achievement-year-details')?.remove();
 const entries=build(input),fmt=(n,d=0)=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:d}).format(n);
 const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const label=y=>y==='unknown'?'Belum teridentifikasi':y;
 const years=[...new Set(entries.map(e=>e.year).filter(y=>y!=='unknown'))].sort().reverse();
 if(entries.some(e=>e.year==='unknown'))years.push('unknown');
 let dialog=document.getElementById('restoration-achievements');
 const wasOpen=dialog?.open;
 if(!dialog){dialog=document.createElement('dialog');dialog.id='restoration-achievements';dialog.className='restoration-achievements';dialog.setAttribute('aria-labelledby','restoration-achievements-title');document.body.appendChild(dialog);}
 const all=summary(entries,'all');
 dialog.innerHTML='<div class="restoration-report-head"><div><span>CAPAIAN RESTORASI</span><h2 id="restoration-achievements-title">Capaian per tahun</h2><p>Penanaman dan infrastruktur yang telah tercatat dalam WebGIS.</p></div><button type="button" data-close-restoration aria-label="Tutup capaian restorasi">×</button></div>'+
 '<div class="restoration-report-content"><div class="restoration-report-totals">'+[['Bibit tertanam',all.plants,'tanaman'],['Sekat kanal',all.canals,'unit'],['FDRS',all.fdrs,'unit'],['Rumah bibit',all.nurseries,'unit']].map(m=>'<div><span>'+m[0]+'</span><strong>'+fmt(m[1])+'<small>'+m[2]+'</small></strong></div>').join('')+'</div>'+
 '<p class="restoration-report-hint">Pilih tahun untuk melihat rincian lokasi dan bukti kegiatan.</p><div class="restoration-report-table" tabindex="0" role="region" aria-label="Tabel capaian restorasi per tahun"><table><thead><tr><th scope="col">Tahun</th><th scope="col">Bibit tertanam</th><th scope="col">Sekat kanal</th><th scope="col">FDRS</th><th scope="col">Rumah bibit</th><th scope="col">Wave breaker</th></tr></thead><tbody>'+years.map(y=>{const t=summary(entries,y);return '<tr data-restoration-row="'+y+'"><th scope="row"><button type="button" data-restoration-year="'+y+'" aria-expanded="false" aria-controls="restoration-year-detail">'+label(y)+' <span aria-hidden="true">→</span></button></th>'+[t.plants,t.canals,t.fdrs,t.nurseries,t.wave].map(n=>'<td>'+fmt(n)+'</td>').join('')+'</tr>';}).join('')+'</tbody><tfoot><tr><th scope="row">Total</th>'+[all.plants,all.canals,all.fdrs,all.nurseries,all.wave].map(n=>'<td>'+fmt(n)+'</td>').join('')+'</tr></tfoot></table></div>'+
 '<section id="restoration-year-detail" hidden aria-live="polite"></section><details class="restoration-report-method"><summary>Dasar perhitungan</summary><p>Bibit dihitung sekali per lokasi penanaman. Monitoring ulang tidak menambah jumlah. Infrastruktur mengikuti tahun objek yang tercatat, termasuk objek yang masih dibangun; status pembangunan ditampilkan pada bukti rincian. Jumlah yang belum dapat dipisahkan per tahun ditempatkan pada “Belum teridentifikasi”.</p><p>Total luas restorasi pada dashboard mencakup dampak pemulihan dan rewetting. Luas polygon penanaman ditampilkan terpisah pada rincian tahun.</p></details></div>';
 function showYear(y){
  const t=summary(entries,y),detail=document.getElementById('restoration-year-detail');
  const restoration=entries.filter(e=>e.year===y&&!['training','engagement'].includes(e.kind));
  dialog.querySelectorAll('[data-restoration-year]').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.restorationYear===y)));
  dialog.querySelectorAll('[data-restoration-row]').forEach(row=>row.classList.toggle('is-selected',row.dataset.restorationRow===y));
  detail.hidden=false;
  detail.innerHTML='<div class="restoration-detail-heading"><h3>Rincian '+esc(label(y))+'</h3><span>'+fmt(t.plants)+' bibit tertanam</span></div><div class="restoration-detail-breakdown">'+[['Mangrove',t.mangrove],['Kopi',t.coffee],['Tanaman gambut',t.peat],['Tanaman hutan',t.forest]].map(m=>'<span>'+m[0]+' <b>'+fmt(m[1])+'</b></span>').join('')+'</div><p class="restoration-detail-area">Luas polygon penanaman terdata: <b>'+fmt(t.area,2)+' ha</b></p><details class="restoration-report-evidence"><summary>Lokasi dan bukti · '+restoration.length+' catatan</summary><ul>'+restoration.map(e=>'<li><a href="'+esc(e.url)+'">'+esc(e.name.length>150?e.name.slice(0,150)+'…':e.name)+'</a>'+(e.status&&e.status!=='Aktif'?'<small class="restoration-evidence-status">'+esc(e.status)+'</small>':'')+'<strong>'+fmt(e.count,e.kind==='area'?2:0)+' '+(e.kind==='planting'?'bibit':e.kind==='area'?'ha':'unit')+'</strong></li>').join('')+'</ul></details>';
 }
 dialog.onclick=e=>{const button=e.target.closest('[data-restoration-year]');if(button)showYear(button.dataset.restorationYear);if(e.target.closest('[data-close-restoration]')||e.target===dialog)dialog.close();};
 dialog.onclose=()=>{document.body.classList.remove('restoration-report-open');trigger.focus();};
 trigger.href='#restoration-achievements';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',dialog.id);
 const hint=trigger.querySelector('small');if(hint)hint.textContent='hektare · rincian tahunan →';
 trigger.onclick=e=>{e.preventDefault();if(!dialog.open)dialog.showModal();document.body.classList.add('restoration-report-open');};
 if(wasOpen)document.body.classList.add('restoration-report-open');
}
return {year,historyParts,build,summary,mount};
});
