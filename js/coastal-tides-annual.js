(function(){
 'use strict';
 const $=id=>document.getElementById(id),cache=new Map();let data=null,chart=null,monthlyChart=null,request=0,currentId=new URLSearchParams(location.search).get('village')||'buruk-bakul';
 const fmt=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('id-ID',{maximumFractionDigits:d}):'—';
 const date=t=>t?new Date(t+'+07:00').toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+' WIB':'—';
 const month=t=>new Date(t+'-01T00:00:00+07:00').toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'Asia/Jakarta'});
 function drawMonthly(){
  const months=data.monthly,complete=m=>m.calendarComplete!==false&&m.hours===m.expectedHours;
  if(monthlyChart)monthlyChart.destroy();
  monthlyChart=new Chart($('annual-monthly-chart'),{type:'bar',data:{labels:months.map(m=>month(m.month)),datasets:[{label:'Muka laut tertinggi (m)',data:months.map(m=>m.max),backgroundColor:months.map(m=>m.hours<m.expectedHours?'#cb862b':complete(m)?'#087d75':'#87969d'),borderRadius:5,maxBarThickness:48}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{autoSkip:false,maxRotation:45,minRotation:0,callback:function(v){const m=months[v].month;return new Date(m+'-01T00:00:00+07:00').toLocaleDateString('id-ID',{month:'short',timeZone:'Asia/Jakarta'})+' '+m.slice(2,4)}}},y:{beginAtZero:true,title:{display:true,text:'Meter terhadap acuan muka laut (MSL)'}}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmt(c.raw)+' m terhadap MSL',afterLabel:c=>{const m=months[c.dataIndex];return [date(m.maxTime),'Data: '+fmt(m.hours/m.expectedHours*100,1)+'% dari periode tersedia',m.calendarComplete===false?'Sebagian bulan; bukan satu bulan penuh':m.hours<m.expectedHours?'Ada data kosong; puncak lain mungkin tidak tercatat':'Bulan penuh, data lengkap']}}}}}});
 }
 function draw(){
  if(!data||!$('annual-detail').open)return;const selected=$('annual-month').value;let labels,sets;
  if(!selected){labels=data.daily.map(d=>d.date);sets=[{label:'Tertinggi harian',data:data.daily.map(d=>d.max),borderColor:'#087d75'},{label:'Terendah harian',data:data.daily.map(d=>d.min),borderColor:'#3182bd'}]}
  else{const start=new Date(data.hourly.start+'+07:00').getTime();labels=[];const values=[];data.hourly.values.forEach((v,i)=>{const t=new Date(start+i*3600000+7*3600000).toISOString().slice(0,16);if(t.startsWith(selected)){labels.push(t.replace('T',' '));values.push(v)}});sets=[{label:'Muka laut per jam',data:values,borderColor:'#087d75'}]}
  if(chart)chart.destroy();chart=new Chart($('annual-tide-chart'),{type:'line',data:{labels,datasets:sets.map(s=>({...s,pointRadius:0,borderWidth:1.5,tension:0,spanGaps:false}))},options:{responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},scales:{x:{ticks:{maxTicksLimit:8,maxRotation:0}},y:{title:{display:true,text:'Meter terhadap MSL model'}}},plugins:{legend:{position:'bottom'}}}});
  $('annual-chart-caption').textContent=selected?'Detail per jam · '+month(selected)+' · WIB':'Tertinggi dan terendah setiap hari · '+data.startDate+'–'+data.endDate+'. Hari dengan data kurang dari 24 jam ditampilkan sebagai celah.';
 }
 function render(d){
  data=d;const s=d.summary;$('annual-detail').open=false;$('annual-title').textContent='Pasang surut tahunan · '+d.location.name;
  $('annual-source').textContent=(d.regionalFallback?'REFERENSI LAUT REGIONAL — titik desa tidak memiliki data. ':'')+d.dataKind+'. Periode '+d.startDate+'–'+d.endDate+' (WIB). Sumber: '+d.source+'. Data diambil '+d.retrievedAt.slice(0,10)+'.';
  $('annual-grid').textContent='Titik desa '+d.location.lat.toFixed(6)+', '+d.location.lon.toFixed(6)+' · grid laut '+d.grid.lat.toFixed(4)+', '+d.grid.lon.toFixed(4)+' · jarak '+fmt(d.grid.distanceKm,1)+' km. Desa berdekatan dapat menggunakan grid yang sama. Datum: MSL global.';
  $('annual-coverage').textContent=fmt(s.validHours,0)+' / '+fmt(s.expectedHours,0)+' jam ('+fmt(s.validHours/s.expectedHours*100,1)+'%)';
  $('annual-high').textContent=fmt(s.max)+' m';$('annual-high-date').textContent=date(s.maxTime);
  $('annual-low').textContent=fmt(s.min)+' m';$('annual-low-date').textContent=date(s.minTime);
  $('annual-high-month').textContent=s.maxTime?month(s.maxTime.slice(0,7)):'Belum tersedia';$('annual-low-month').textContent=s.minTime?month(s.minTime.slice(0,7)):'Belum tersedia';
  $('annual-meaning').textContent='Arti angka: '+fmt(s.max)+' m berarti posisi muka laut terhadap acuan rata-rata laut model (MSL), bukan kedalaman genangan di lokasi mangrove. Nilai minus berarti berada di bawah acuan tersebut.';
  $('annual-period-note').textContent=(d.regionalFallback?'Referensi laut regional untuk desa ini. ':'')+'Periode '+d.startDate+'–'+d.endDate+' · arsip model, bukan pengukuran lapangan.';
  $('annual-days').textContent=fmt(s.completeDays,0)+' / '+d.daily.length+' hari lengkap';
  $('annual-month').innerHTML='<option value="">Setahun · rentang harian</option>'+d.monthly.map(m=>'<option value="'+m.month+'">'+month(m.month)+'</option>').join('');
  $('annual-table').innerHTML=d.monthly.map(m=>'<tr><th scope="row">'+month(m.month)+'</th><td>'+fmt(m.max)+'<small>'+date(m.maxTime)+'</small></td><td>'+fmt(m.min)+'<small>'+date(m.minTime)+'</small></td><td>'+fmt(m.mean)+'</td><td>'+fmt(m.meanDailyRange)+'</td><td>'+fmt(m.hours/m.expectedHours*100,1)+'%</td></tr>').join('');
  const complete=d.monthly.filter(m=>m.calendarComplete!==false&&m.hours===m.expectedHours&&m.max!==null);let text='';$('annual-range-month').textContent='Belum tersedia';$('annual-range-value').textContent='Belum ada bulan penuh dengan data lengkap.';
  if(complete.length){const top=complete.reduce((a,b)=>a.max>b.max?a:b),range=complete.reduce((a,b)=>a.meanDailyRange>b.meanDailyRange?a:b);$('annual-range-month').textContent=month(range.month);$('annual-range-value').textContent=fmt(range.meanDailyRange)+' m rata-rata selisih harian';text='Di antara bulan dengan data lengkap, muka laut tertinggi terjadi pada '+month(top.month)+' ('+fmt(top.max)+' m terhadap MSL). Rata-rata selisih tertinggi–terendah harian terbesar terjadi pada '+month(range.month)+' ('+fmt(range.meanDailyRange)+' m). '}
  text+=s.validHours===s.expectedHours?'Data per jam lengkap untuk periode yang tersedia.':fmt(s.expectedHours-s.validHours,0)+' jam tidak tersedia dari sumber; bagian kosong tidak diisi atau diperkirakan. Ringkasan hanya menggambarkan jam yang tersedia.';
  if($('annual-period').value!=='rolling'&&!d.endDate.endsWith('-12-31'))text+=' Tahun masih berjalan; tanggal setelah '+d.endDate+' belum termasuk arsip ini.'; $('annual-analysis').textContent=text;$('annual-content').hidden=false;$('annual-status').hidden=true;drawMonthly();
 }
 async function load(id){currentId=id;const period=$('annual-period').value,key=period+'/'+id;const token=++request;data=null;if(monthlyChart){monthlyChart.destroy();monthlyChart=null}if(chart){chart.destroy();chart=null}$('annual-content').hidden=true;$('annual-status').hidden=false;$('annual-status').textContent='Memuat arsip tahunan…';try{if(!cache.has(key))cache.set(key,fetch('data/coastal-tides/'+(period==='rolling'?'':period+'/')+encodeURIComponent(id)+'.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json()}));const d=await cache.get(key);if(token===request)render(d)}catch(_){cache.delete(key);if(token===request)$('annual-status').textContent='Arsip tahunan belum dapat dimuat untuk desa ini. Muat ulang halaman untuk mencoba kembali.'}}
 $('annual-month').addEventListener('change',draw);
 $('annual-detail').addEventListener('toggle',()=>{if($('annual-detail').open)draw()});
 $('annual-download').addEventListener('click',()=>{if(!data)return;const rows=['tanggal_wib,terendah_m_msl,tertinggi_m_msl,rata_rata_m_msl,jam_valid'];data.daily.forEach(d=>rows.push([d.date,d.min??'',d.max??'',d.mean??'',d.hours].join(',')));const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='pasang-surut-'+data.location.id+'-'+data.startDate+'-'+data.endDate+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
 document.addEventListener('coastal-location-selected',e=>load(e.detail.id));
 $('annual-period').addEventListener('change',()=>load(currentId));
 fetch('data/coastal-tides/index.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(m=>{const selected=$('annual-period').value;$('annual-period').innerHTML='<option value="rolling">12 bulan terakhir</option>'+m.years.slice().reverse().map(y=>'<option value="'+y+'">'+y+'</option>').join('');$('annual-period').value=selected;$('annual-update').textContent='Pembaruan otomatis harian dijadwalkan pukul 07.25 WIB. Pembaruan berhasil terakhir: '+new Date(m.updatedAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB. Jika sumber gagal, arsip terakhir tetap tersedia.'}).catch(()=>{});
 load(currentId);
})();
