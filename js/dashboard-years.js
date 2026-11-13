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
  if(/nonaktif|ditolak|menunggu|draft|rencana|planned|construction|pembangunan|perlu perbaikan/i.test(p.Status_Objek||p.status||''))return;
  seen.add(key(id));
  // Area is a mapped footprint, kept separate from the cumulative restoration impact.
  const isArea=layer.startsWith('area_')||layer==='mineral_land_restoration_area';
  const area=num(p.Luas_Ha||p.Area_Ha||p.Luas);
  if(isArea&&area<=0)return;
  const footprintYears=[...new Set(String(p.Riwayat_Penanaman||'').match(/20\d{2}/g)||[])];
  const assetYear=isArea&&footprintYears.length?(footprintYears.length===1?footprintYears[0]:'unknown'):propertyYear(p);
  entries.push({id,kind:isArea?'area':layer,category:layer==='area_mangrove'?'mangrove':layer==='mineral_land_restoration_area'?'forest':'peat',year:assetYear,count:isArea?area:1,villages:p.Desa?[norm([p.Desa,p.Kecamatan,p.Kabupaten].join('|'))]:[],regencies:p.Kabupaten?[norm(p.Kabupaten)]:[],name:p.Nama_Objek||id,donor:p.Donor||'',url:'webgis.html?object='+encodeURIComponent(id)});
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
let selected='all',saved=null;
function mount(input){
 const grid=document.getElementById('category-grid'),host=document.getElementById('programme-overview');if(!grid||!host)return;
 const entries=build(input),years=[...new Set(entries.map(e=>e.year).filter(y=>y!=='unknown'))].sort().reverse();
 const ids=['dash-restoration-area','dash-seedlings-planted','dash-participants','dash-villages','dash-regencies','dash-participants-detail'];
 saved={grid:grid.innerHTML,values:Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?.textContent])),heading:document.querySelector('.hero-data-summary__head small')?.textContent,areaLabel:document.querySelector('#dash-restoration-area + span')?.textContent};
 let box=document.getElementById('achievement-years');if(!box){box=document.createElement('section');box.id='achievement-years';host.insertBefore(box,grid);}
 let details=document.getElementById('achievement-year-details');if(!details){details=document.createElement('section');details.id='achievement-year-details';host.appendChild(details);}
 const totals=input.totals||{};
 const fmt=(n,d=0)=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:d}).format(n),esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 Object.assign(saved.values,{'dash-restoration-area':fmt(totals.totalRestorationArea,2),'dash-seedlings-planted':fmt(totals.totalPlantedSeedlings),'dash-participants':fmt(totals.participants),'dash-villages':fmt(totals.villages),'dash-regencies':fmt(totals.regencies)});
 const label=y=>y==='all'?'Semua Tahun':y==='unknown'?'Belum teridentifikasi':y;
 const buckets=years.concat(entries.some(e=>e.year==='unknown')?['unknown']:[]);
 if(selected!=='all'&&!buckets.includes(selected))selected='all';
 box.innerHTML='<div class="achievement-year-toolbar"><label for="achievement-year">Capaian per tahun</label><select id="achievement-year"><option value="all">Semua Tahun</option>'+buckets.map(y=>'<option value="'+y+'">'+label(y)+'</option>').join('')+'</select></div><p class="achievement-year-note">Pilih tahun untuk melihat penanaman, infrastruktur, dan kegiatan yang tercatat pada tahun tersebut. Jumlah kehadiran dapat mencakup orang yang sama pada beberapa kegiatan.</p>';
 const select=document.getElementById('achievement-year');select.value=selected;
 function render(){
  const s=summary(entries,selected);select.value=selected;
  const set=(id,v)=>{const e=document.getElementById(id);if(e){e._ygCounterVersion=(e._ygCounterVersion||0)+1;e.textContent=v;}};
  const head=document.querySelector('.hero-data-summary__head small'),areaLabel=document.querySelector('#dash-restoration-area + span');
  if(selected==='all'){grid.innerHTML=saved.grid;ids.forEach(id=>set(id,saved.values[id]));if(head)head.textContent=saved.heading;if(areaLabel)areaLabel.textContent=saved.areaLabel;}
  else {
   set('dash-restoration-area',fmt(s.area,2));set('dash-seedlings-planted',fmt(s.plants));set('dash-participants',fmt(s.participants));set('dash-villages',fmt(s.villages.size));set('dash-regencies',fmt(s.regencies.size));set('dash-participants-detail','kehadiran pada kegiatan tercatat');if(head)head.textContent=label(selected);if(areaLabel)areaLabel.textContent='Luas penanaman terdata';
   const cards=[['Restorasi Mangrove',s.mangrove,'tanaman',[['Rumah bibit',s.mangroveNurseries,'unit'],['Wave breaker',s.wave,'unit']],'webgis.html?layer=area_mangrove'],['Restorasi Gambut',s.coffee+s.peat,'tanaman',[['Sekat kanal',s.canals,'unit'],['FDRS',s.fdrs,'unit']],'webgis.html?layer=sekat_kanal'],['Restorasi Lahan Mineral',s.forest,'tanaman',[],'webgis.html?layer=mineral_land_restoration_area'],['Pelibatan Masyarakat & Kapasitas',s.participants,'kehadiran',[['Pelatihan',s.trainings,'sesi'],['Kegiatan lapangan',s.engagement,'kegiatan']],'community-engagement.html']];
   grid.innerHTML=cards.map(c=>'<a class="programme-card dashboard-link" href="'+c[4]+'"><header><h3>'+c[0]+'</h3><span>→</span></header><div class="programme-current"><span>'+(c[2]==='tanaman'?'Bibit tertanam':'Kehadiran')+' · '+label(selected)+'</span><strong>'+fmt(c[1])+'</strong><small>'+c[2]+'</small></div><div class="programme-support-grid">'+c[3].map(r=>'<span><small>'+r[0]+'</small><strong>'+fmt(r[1])+' '+r[2]+'</strong></span>').join('')+'</div><div class="programme-card__meta">Sesuai bukti tahun yang tersedia · rincian di bawah</div></a>').join('');
  }
  const max=Math.max(1,...buckets.map(y=>summary(entries,y).plants));
  details.innerHTML='<details class="achievement-year-chart" '+(selected==='all'?'':'open')+'><summary>Perbandingan penanaman per tahun</summary><p>Jumlah tertanam per tahun, bukan jumlah tanaman hidup. Klik tahun untuk membuka rinciannya.</p>'+buckets.map(y=>{const n=summary(entries,y).plants;return '<button type="button" data-achievement-year="'+y+'" aria-pressed="'+(selected===y)+'"><span>'+label(y)+'</span><i aria-hidden="true"><b style="width:'+Math.max(n?1:0,n/max*100)+'%"></b></i><strong>'+fmt(n)+'</strong></button>';}).join('')+'</details><p class="achievement-year-note">Luas tahunan adalah luas polygon penanaman yang memiliki tahun, bukan total dampak restorasi atau rewetting. Desa dihitung sekali per tahun berdasarkan nama dan kabupaten yang tersedia. Data lintas tahun yang belum terurai masuk “Belum teridentifikasi”.</p>'+
  '<details class="achievement-year-records"><summary>Rincian bukti · '+esc(label(selected))+'</summary><div class="achievement-year-table"><table><thead><tr><th>Tahun</th><th>Kegiatan / lokasi</th><th>Capaian tercatat</th><th>Program / mitra</th></tr></thead><tbody>'+entries.filter(e=>selected==='all'||e.year===selected).map(e=>'<tr><td>'+label(e.year)+'</td><td><a href="'+esc(e.url)+'">'+esc(e.name)+'</a>'+(e.note?'<small>'+esc(e.note)+'</small>':'')+'</td><td>'+fmt(e.count,e.kind==='area'?2:0)+' '+(e.kind==='planting'?'tanaman':e.kind==='area'?'ha':e.kind==='training'?'sesi':e.kind==='engagement'?'kegiatan':'unit')+(e.participants?' · '+fmt(e.participants)+' kehadiran':'')+'</td><td>'+esc(e.donor||'Belum tercatat')+'</td></tr>').join('')+'</tbody></table></div></details>';
 }
 select.onchange=()=>{selected=select.value;render();};details.onclick=e=>{const button=e.target.closest('[data-achievement-year]');if(button){selected=button.dataset.achievementYear;render();}};render();
}
return {year,historyParts,build,summary,mount};
});
