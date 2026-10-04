(function(){
 'use strict';
 const $=id=>document.getElementById(id),cache=new Map();let data=null,chart=null,request=0;
 const fmt=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('id-ID',{maximumFractionDigits:d}):'—';
 const date=t=>t?new Date(t+'+07:00').toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+' WIB':'—';
 const month=t=>new Date(t+'-01T00:00:00+07:00').toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'Asia/Jakarta'});
 function draw(){
  if(!data)return;const selected=$('annual-month').value;let labels,sets;
  if(!selected){labels=data.daily.map(d=>d.date);sets=[{label:'Tertinggi harian',data:data.daily.map(d=>d.max),borderColor:'#087d75'},{label:'Terendah harian',data:data.daily.map(d=>d.min),borderColor:'#3182bd'}]}
  else{const start=new Date(data.hourly.start+'+07:00').getTime();labels=[];const values=[];data.hourly.values.forEach((v,i)=>{const t=new Date(start+i*3600000+7*3600000).toISOString().slice(0,16);if(t.startsWith(selected)){labels.push(t.replace('T',' '));values.push(v)}});sets=[{label:'Muka laut per jam',data:values,borderColor:'#087d75'}]}
  if(chart)chart.destroy();chart=new Chart($('annual-tide-chart'),{type:'line',data:{labels,datasets:sets.map(s=>({...s,pointRadius:0,borderWidth:1.5,tension:0,spanGaps:false}))},options:{responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},scales:{x:{ticks:{maxTicksLimit:8,maxRotation:0}},y:{title:{display:true,text:'Meter terhadap MSL model'}}},plugins:{legend:{position:'bottom'}}}});
  $('annual-chart-caption').textContent=selected?'Detail per jam · '+month(selected)+' · WIB':'Tertinggi dan terendah setiap hari · Oktober 2025–September 2026. Hari dengan data kurang dari 24 jam ditampilkan sebagai celah.';
 }
 function render(d){
  data=d;const s=d.summary;$('annual-title').textContent='Pasang surut tahunan · '+d.location.name;
  $('annual-source').textContent=(d.regionalFallback?'REFERENSI LAUT REGIONAL — titik desa tidak memiliki data. ':'')+d.dataKind+'. Periode 1 Oktober 2025–30 September 2026 (WIB). Sumber: '+d.source+'. Data diambil '+d.retrievedAt.slice(0,10)+'.';
  $('annual-grid').textContent='Titik desa '+d.location.lat.toFixed(6)+', '+d.location.lon.toFixed(6)+' · grid laut '+d.grid.lat.toFixed(4)+', '+d.grid.lon.toFixed(4)+' · jarak '+fmt(d.grid.distanceKm,1)+' km. Desa berdekatan dapat menggunakan grid yang sama. Datum: MSL global.';
  $('annual-coverage').textContent=fmt(s.validHours,0)+' / '+fmt(s.expectedHours,0)+' jam ('+fmt(s.validHours/s.expectedHours*100,1)+'%)';
  $('annual-high').textContent=fmt(s.max)+' m';$('annual-high-date').textContent=date(s.maxTime);
  $('annual-low').textContent=fmt(s.min)+' m';$('annual-low-date').textContent=date(s.minTime);
  $('annual-days').textContent=fmt(s.completeDays,0)+' / 365 hari lengkap';
  $('annual-month').innerHTML='<option value="">Setahun · rentang harian</option>'+d.monthly.map(m=>'<option value="'+m.month+'">'+month(m.month)+'</option>').join('');
  $('annual-table').innerHTML=d.monthly.map(m=>'<tr><th scope="row">'+month(m.month)+'</th><td>'+fmt(m.max)+'<small>'+date(m.maxTime)+'</small></td><td>'+fmt(m.min)+'<small>'+date(m.minTime)+'</small></td><td>'+fmt(m.mean)+'</td><td>'+fmt(m.meanDailyRange)+'</td><td>'+fmt(m.hours/m.expectedHours*100,1)+'%</td></tr>').join('');
  const complete=d.monthly.filter(m=>m.hours===m.expectedHours&&m.max!==null);let text='';
  if(complete.length){const top=complete.reduce((a,b)=>a.max>b.max?a:b),range=complete.reduce((a,b)=>a.meanDailyRange>b.meanDailyRange?a:b);text='Di antara bulan dengan data lengkap, muka laut tertinggi terjadi pada '+month(top.month)+' ('+fmt(top.max)+' m terhadap MSL). Rata-rata selisih tertinggi–terendah harian terbesar terjadi pada '+month(range.month)+' ('+fmt(range.meanDailyRange)+' m). '}
  text+=s.validHours===s.expectedHours?'Seluruh 12 bulan memiliki data per jam lengkap.':'Data belum lengkap; bulan kosong tidak diisi atau diperkirakan. Ringkasan hanya menggambarkan jam yang tersedia.';
  $('annual-analysis').textContent=text;$('annual-content').hidden=false;$('annual-status').hidden=true;draw();
 }
 async function load(id){const token=++request;data=null;if(chart){chart.destroy();chart=null}$('annual-content').hidden=true;$('annual-status').hidden=false;$('annual-status').textContent='Memuat arsip tahunan…';try{if(!cache.has(id))cache.set(id,fetch('data/coastal-tides/'+encodeURIComponent(id)+'.json?v=20261004').then(r=>{if(!r.ok)throw Error();return r.json()}));const d=await cache.get(id);if(token===request)render(d)}catch(_){cache.delete(id);if(token===request)$('annual-status').textContent='Arsip tahunan belum dapat dimuat untuk desa ini. Muat ulang halaman untuk mencoba kembali.'}}
 $('annual-month').addEventListener('change',draw);
 $('annual-download').addEventListener('click',()=>{if(!data)return;const rows=['tanggal_wib,terendah_m_msl,tertinggi_m_msl,rata_rata_m_msl,jam_valid'];data.daily.forEach(d=>rows.push([d.date,d.min??'',d.max??'',d.mean??'',d.hours].join(',')));const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='pasang-surut-'+data.location.id+'-202510-202609.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
 document.addEventListener('coastal-location-selected',e=>load(e.detail.id));
 load(new URLSearchParams(location.search).get('village')||'buruk-bakul');
})();
