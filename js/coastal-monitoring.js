(function(){
  'use strict';
  const LOCATIONS=[
    {id:'buruk-bakul',name:'Buruk Bakul',regency:'Bengkalis',lat:1.419895,lon:102.057985},
    {id:'sepahat',name:'Sepahat',regency:'Bengkalis',lat:1.560556,lon:101.875580},
    {id:'kelapa-pati',name:'Kelapa Pati',regency:'Bengkalis',lat:1.487850,lon:102.082154},
    {id:'tanjung-kuras',name:'Tanjung Kuras',regency:'Siak',lat:1.228433,lon:102.176332}
  ];
  const state={selected:LOCATIONS[0],data:new Map(),markers:new Map(),chart:null,areas:null};
  const $=id=>document.getElementById(id);
  const fmt=(v,d=1)=>Number.isFinite(v)?v.toFixed(d):'—';
  const dir=d=>Number.isFinite(d)?['U','TL','T','TG','S','BD','B','BL'][Math.round(d/45)%8]:'—';
  const map=L.map('coastal-map',{zoomControl:true}).setView([1.31,102.14],9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(map);

  function riskOf(h){
    const wave=h.wave_height, current=h.ocean_current_velocity;
    if(wave>=1.5||current>=2.5)return {level:'high',label:'Risiko tinggi',copy:'Gelombang atau arus kuat. Tunda penanaman dan kegiatan menggunakan perahu kecil.'};
    if(wave>=.8||current>=1.5)return {level:'watch',label:'Perlu perhatian',copy:'Periksa kondisi lokal dan batasi kegiatan pada tepi pantai yang terbuka.'};
    return {level:'safe',label:'Relatif aman',copy:'Kondisi model relatif tenang. Tetap cek cuaca dan pasang setempat sebelum berangkat.'};
  }
  function currentHour(data){
    const now=Date.now(), times=data.hourly.time.map(t=>new Date(t).getTime());
    let idx=0,best=Infinity;times.forEach((t,i)=>{const x=Math.abs(t-now);if(x<best){best=x;idx=i}});
    const h={time:data.hourly.time[idx]};Object.keys(data.hourly).forEach(k=>{if(k!=='time')h[k]=data.hourly[k][idx]});return {idx,h};
  }
  async function fetchMarine(loc){
    const variables='wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature,sea_level_height_msl';
    const url=`https://marine-api.open-meteo.com/v1/marine?latitude=${loc.lat}&longitude=${loc.lon}&hourly=${variables}&timezone=Asia%2FJakarta&forecast_days=8&cell_selection=sea`;
    const response=await fetch(url);if(!response.ok)throw new Error('Marine API '+response.status);return response.json();
  }
  function renderTabs(){ $('location-tabs').innerHTML=LOCATIONS.map(l=>`<button type="button" data-id="${l.id}" class="${l.id===state.selected.id?'active':''}"><strong>${l.name}</strong><span>${l.regency}</span></button>`).join(''); }
  function setSelected(loc){state.selected=loc;renderTabs();const data=state.data.get(loc.id);$('location-name').textContent=loc.name;$('location-meta').textContent=`Kabupaten ${loc.regency} · titik model laut terdekat`;if(data)renderLocation(data);map.setView([loc.lat,loc.lon],11);}
  function renderLocation(data){
    const {h}=currentHour(data),risk=riskOf(h);$('kpi-tide').textContent=fmt(h.sea_level_height_msl,2)+' m';$('kpi-wave').textContent=fmt(h.wave_height,1)+' m';$('wave-detail').textContent=`${dir(h.wave_direction)} · periode ${fmt(h.wave_period,0)} dtk`;$('kpi-current').textContent=fmt(h.ocean_current_velocity,1)+' km/j';$('current-detail').textContent=`menuju ${dir(h.ocean_current_direction)}`;$('kpi-sst').textContent=fmt(h.sea_surface_temperature,1)+' °C';$('kpi-risk').textContent=risk.label;$('risk-detail').textContent='berdasarkan gelombang dan arus';document.querySelector('.risk-card').className='risk-card '+risk.level;$('advice-title').textContent=risk.label;$('advice-copy').textContent=risk.copy;
    const good=data.hourly.time.map((t,i)=>({t,w:data.hourly.wave_height[i],c:data.hourly.ocean_current_velocity[i],s:data.hourly.sea_level_height_msl[i]})).find(x=>new Date(x.t)>new Date()&&x.w<.8&&x.c<1.5&&Math.abs(x.s)<.5);$('next-window').textContent=good?new Intl.DateTimeFormat('id-ID',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(good.t)):'Belum ditemukan dalam prakiraan';renderChart(data);
  }
  function renderChart(data){
    const metric=$('chart-metric').value, units={sea_level_height_msl:'m terhadap MSL',wave_height:'m',ocean_current_velocity:'km/j',sea_surface_temperature:'°C'},names={sea_level_height_msl:'Pasang surut',wave_height:'Tinggi gelombang',ocean_current_velocity:'Kecepatan arus',sea_surface_temperature:'Suhu permukaan laut'};const labels=data.hourly.time.slice(0,72).map(t=>new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',hour:'2-digit'}).format(new Date(t))),values=data.hourly[metric].slice(0,72);$('chart-title').textContent=`${names[metric]} · ${state.selected.name}`;if(state.chart)state.chart.destroy();state.chart=new Chart($('forecast-chart'),{type:'line',data:{labels,datasets:[{label:units[metric],data:values,borderColor:'#087d75',backgroundColor:'#087d7522',fill:true,tension:.25,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},scales:{x:{ticks:{maxTicksLimit:9}},y:{title:{display:true,text:units[metric]}}},plugins:{legend:{display:false}}}});
  }
  function renderMarkers(){LOCATIONS.forEach(loc=>{const data=state.data.get(loc.id),risk=data?riskOf(currentHour(data).h):{level:'watch'};if(state.markers.has(loc.id))state.markers.get(loc.id).remove();const icon=L.divIcon({className:'',html:`<div class="coast-marker ${risk.level}" style="width:22px;height:22px"></div>`,iconSize:[22,22],iconAnchor:[11,11]});const marker=L.marker([loc.lat,loc.lon],{icon}).addTo(map).bindTooltip(loc.name,{permanent:false});marker.on('click',()=>setSelected(loc));state.markers.set(loc.id,marker)});}
  async function loadAreas(){try{const r=await fetch('data/area_mangrove.geojson');const j=await r.json();state.areas=L.geoJSON(j,{style:{color:'#0d8678',weight:2,fillColor:'#28a899',fillOpacity:.16},filter:f=>LOCATIONS.some(l=>String(f.properties&&f.properties.Desa||'').toLowerCase()===l.name.toLowerCase())}).addTo(map)}catch(e){console.warn(e)}}
  async function init(){renderTabs();$('location-name').textContent=state.selected.name;$('location-meta').textContent='Memuat titik model laut terdekat…';await loadAreas();try{const results=await Promise.allSettled(LOCATIONS.map(fetchMarine));results.forEach((r,i)=>{if(r.status==='fulfilled')state.data.set(LOCATIONS[i].id,r.value)});if(!state.data.size)throw new Error('Data tidak tersedia');$('data-status').textContent=`Aktif · ${state.data.size}/4 lokasi`;$('updated-at').textContent='Prakiraan model diperbarui otomatis';renderMarkers();setSelected(state.selected)}catch(e){$('data-status').textContent='Sumber tidak tersedia';$('updated-at').textContent='Coba muat ulang beberapa saat lagi';$('map-message').hidden=false;$('map-message').textContent='Data oseanografi belum dapat dimuat. Peta lokasi YG tetap tersedia.';renderMarkers()}}
  $('location-tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-id]');if(b)setSelected(LOCATIONS.find(l=>l.id===b.dataset.id))});$('chart-metric').addEventListener('change',()=>{const d=state.data.get(state.selected.id);if(d)renderChart(d)});$('zoom-all').addEventListener('click',()=>map.fitBounds(L.latLngBounds(LOCATIONS.map(l=>[l.lat,l.lon])).pad(.25)));document.querySelectorAll('input[name=product]').forEach(r=>r.addEventListener('change',()=>{$('chart-metric').value={wave:'wave_height',current:'ocean_current_velocity',tide:'sea_level_height_msl',sst:'sea_surface_temperature'}[r.value];$('chart-metric').dispatchEvent(new Event('change'))}));init();
})();
