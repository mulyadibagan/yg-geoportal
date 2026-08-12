(function(){
  'use strict';
  const LOCATIONS=[
    {id:'buruk-bakul',name:'Buruk Bakul',regency:'Bengkalis',lat:1.419895,lon:102.057985},
    {id:'sepahat',name:'Sepahat',regency:'Bengkalis',lat:1.560556,lon:101.875580},
    {id:'kelapa-pati',name:'Kelapa Pati',regency:'Bengkalis',lat:1.487850,lon:102.082154},
    {id:'pematang-duku',name:'Pematang Duku',regency:'Bengkalis',lat:1.453219,lon:102.316952},
    {id:'penampi',name:'Penampi',regency:'Bengkalis',lat:1.458691,lon:102.181837},
    {id:'simpang-ayam',name:'Simpang Ayam',regency:'Bengkalis',lat:1.590707,lon:102.040209},
    {id:'tanjung-kuras',name:'Tanjung Kuras',regency:'Siak',lat:1.228433,lon:102.176332,marineFallback:{lat:1.36,lon:102.18,distanceKm:35}}
  ];
  const state={selected:LOCATIONS[0],product:'wave',data:new Map(),markers:new Map(),chart:null,areas:null,waveArrow:null,currentArrow:null,changeLayer:null,changeSummary:new Map(),preliminaryLayer:null,preliminarySummary:[]};
  const $=id=>document.getElementById(id);
  const fmt=(v,d=1)=>Number.isFinite(v)?v.toFixed(d):'—';
  const dir=d=>Number.isFinite(d)?['U','TL','T','TG','S','BD','B','BL'][Math.round(d/45)%8]:'—';
  const dirLong=d=>Number.isFinite(d)?['Utara','Timur Laut','Timur','Tenggara','Selatan','Barat Daya','Barat','Barat Laut'][Math.round(d/45)%8]:'tidak tersedia';
  const toMillis=time=>typeof time==='number'?time*1000:new Date(time).getTime();
  const toDate=time=>new Date(toMillis(time));
  const map=L.map('coastal-map',{zoomControl:true}).setView([1.31,102.14],9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(map);

  function riskOf(h){
    const wave=h.wave_height, current=h.ocean_current_velocity;
    if(wave>=1.5||current>=2.5)return {level:'high',label:'Risiko tinggi',copy:'Gelombang atau arus kuat. Tunda penanaman dan kegiatan menggunakan perahu kecil.'};
    if(wave>=.8||current>=1.5)return {level:'watch',label:'Perlu perhatian',copy:'Periksa kondisi lokal dan batasi kegiatan pada tepi pantai yang terbuka.'};
    return {level:'safe',label:'Relatif aman',copy:'Kondisi model relatif tenang. Tetap cek cuaca dan pasang setempat sebelum berangkat.'};
  }
  function currentHour(data){
    const now=Date.now(), times=data.hourly.time.map(toMillis);
    let idx=0,best=Infinity;times.forEach((t,i)=>{const x=Math.abs(t-now);if(x<best){best=x;idx=i}});
    const h={time:data.hourly.time[idx]};Object.keys(data.hourly).forEach(k=>{if(k!=='time')h[k]=data.hourly[k][idx]});return {idx,h};
  }
  function tideEvents(data,startIdx){
    const values=data.hourly.sea_level_height_msl||[],times=data.hourly.time||[],events=[];
    const end=Math.min(values.length-1,startIdx+48);
    for(let i=Math.max(1,startIdx);i<end;i++){
      const prev=values[i-1],value=values[i],next=values[i+1];
      if(![prev,value,next].every(Number.isFinite))continue;
      if(value>prev&&value>=next)events.push({type:'high',time:times[i],level:value});
      if(value<prev&&value<=next)events.push({type:'low',time:times[i],level:value});
    }
    return events;
  }
  function formatTideTime(time){
    return new Intl.DateTimeFormat('id-ID',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Jakarta'}).format(toDate(time)).replace('.',':')+' WIB';
  }
  function formatShortTime(time){
    return new Intl.DateTimeFormat('id-ID',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Jakarta'}).format(toDate(time)).replace('.',':');
  }
  function fieldWindow(data,startIdx){
    const times=data.hourly.time||[],waves=data.hourly.wave_height||[],currents=data.hourly.ocean_current_velocity||[],levels=data.hourly.sea_level_height_msl||[];
    let start=-1,end=-1;
    for(let i=startIdx+1;i<Math.min(times.length,startIdx+72);i++){
      const safe=waves[i]<.8&&currents[i]<1.5&&Math.abs(levels[i])<.5;
      if(safe&&start<0)start=i;
      if(start>=0){if(safe)end=i;if(!safe||end-start>=5)break;}
    }
    if(start<0)return null;
    const endTime=new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Jakarta'}).format(toDate(times[end])).replace('.',':');
    return `${formatShortTime(times[start])}–${endTime} WIB`;
  }
  function renderTideSchedule(data,index){
    const values=data.hourly.sea_level_height_msl||[],current=values[index],next=values[index+1];
    $('tide-state').textContent=Number.isFinite(current)&&Number.isFinite(next)?(next>current?'Menuju pasang ↑':next<current?'Menuju surut ↓':'Relatif tetap'):'—';
    const events=tideEvents(data,index),high=events.find(e=>e.type==='high'),low=events.find(e=>e.type==='low');
    $('next-high-tide').textContent=high?formatTideTime(high.time):'Belum terdeteksi';
    $('next-high-level').textContent=high?`${fmt(high.level,2)} m terhadap MSL`:'dalam 48 jam';
    $('next-low-tide').textContent=low?formatTideTime(low.time):'Belum terdeteksi';
    $('next-low-level').textContent=low?`${fmt(low.level,2)} m terhadap MSL`:'dalam 48 jam';
  }
  async function fetchMarine(loc){
    const variables='wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature,sea_level_height_msl';
    const url=`https://marine-api.open-meteo.com/v1/marine?latitude=${loc.lat}&longitude=${loc.lon}&hourly=${variables}&timezone=GMT&timeformat=unixtime&forecast_days=8&cell_selection=sea`;
    const response=await fetch(url);if(!response.ok)throw new Error('Marine API '+response.status);const data=await response.json();
    if(loc.marineFallback){
      const groups=[
        {key:'wave',fields:['wave_height','wave_direction','wave_period']},
        {key:'current',fields:['ocean_current_velocity','ocean_current_direction']},
        {key:'tide',fields:['sea_level_height_msl']},
        {key:'sst',fields:['sea_surface_temperature']}
      ];
      const missing=groups.filter(group=>group.fields.some(field=>!(data.hourly[field]||[]).some(Number.isFinite)));
      if(missing.length){
        const fallback=loc.marineFallback;
        const fallbackFields=[...new Set(missing.flatMap(group=>group.fields))];
        const fallbackUrl=`https://marine-api.open-meteo.com/v1/marine?latitude=${fallback.lat}&longitude=${fallback.lon}&hourly=${fallbackFields.join(',')}&timezone=GMT&timeformat=unixtime&forecast_days=8&cell_selection=sea`;
        const fallbackResponse=await fetch(fallbackUrl);
        if(fallbackResponse.ok){
          const fallbackData=await fallbackResponse.json();
          missing.forEach(group=>{
            if(group.fields.every(field=>(fallbackData.hourly[field]||[]).some(Number.isFinite))){
              group.fields.forEach(field=>{data.hourly[field]=fallbackData.hourly[field]});
              data[`${group.key}FallbackKm`]=fallback.distanceKm;
            }
          });
        }
      }
    }
    return data;
  }
  function renderTabs(){ $('location-tabs').innerHTML=LOCATIONS.map(l=>`<button type="button" data-id="${l.id}" class="${l.id===state.selected.id?'active':''}"><strong>${l.name}</strong><span>${l.regency}</span></button>`).join(''); }
  function renderCoastalChange(){const row=state.changeSummary.get(state.selected.name.toLowerCase()),box=$('shoreline-change');if(!row){box.className='shoreline-change low';box.innerHTML='<strong>Indikasi perubahan pantai 2016–2025</strong><p>Belum tersedia hasil yang lolos pemrosesan untuk desa ini.</p>';return}const extreme=Math.max(row.indicativeRetreatRateMPerYear||0,row.indicativeAdvanceRateMPerYear||0)>5;box.className='shoreline-change '+(extreme?'low':row.confidence==='tinggi'?'high':'low');box.innerHTML=`<strong>Indikasi perubahan pantai 2016–2025</strong><p><b>${fmt(row.erosionAreaHa,2)} ha</b> indikasi kehilangan daratan · <b>${fmt(row.accretionAreaHa,2)} ha</b> indikasi pertambahan.</p><p>Laju kemunduran indikatif ${fmt(row.indicativeRetreatRateMPerYear,2)} m/tahun · keyakinan <b>${row.confidence}</b>.</p>${extreme?'<p><b>Perlu pemeriksaan tambahan:</b> perubahan ekstrem dapat dipengaruhi muara, pasang, atau dataran lumpur.</p>':''}<small>Ketidakpastian posisi ±${fmt(row.positionalUncertaintyM,1)} m. Bukan penetapan abrasi; verifikasi lapangan diperlukan.</small>`}
  function setSelected(loc){state.selected=loc;renderTabs();const data=state.data.get(loc.id);$('location-name').textContent=loc.name;$('location-meta').textContent=`Kabupaten ${loc.regency} · titik model laut terdekat`;renderCoastalChange();if(data)renderLocation(data);map.setView([loc.lat,loc.lon],11);}
  function renderLocation(data){
    const {idx,h}=currentHour(data),risk=riskOf(h);$('kpi-tide').textContent=fmt(h.sea_level_height_msl,2)+' m';$('tide-detail').textContent=`terhadap MSL model${data.tideFallbackKm?` · regional ±${data.tideFallbackKm} km`:''}`;$('kpi-wave').textContent=fmt(h.wave_height,1)+' m';$('wave-detail').textContent=`dari ${dir(h.wave_direction)} · periode ${fmt(h.wave_period,0)} dtk${data.waveFallbackKm?` · regional ±${data.waveFallbackKm} km`:''}`;$('kpi-current').textContent=fmt(h.ocean_current_velocity,1)+' km/j';$('current-detail').textContent=`menuju ${dir(h.ocean_current_direction)}${data.currentFallbackKm?` · regional ±${data.currentFallbackKm} km`:''}`;$('kpi-sst').textContent=fmt(h.sea_surface_temperature,1)+' °C';$('sst-detail').textContent=`prakiraan model${data.sstFallbackKm?` · regional ±${data.sstFallbackKm} km`:''}`;$('kpi-risk').textContent=risk.label;$('risk-detail').textContent='berdasarkan gelombang dan arus';document.querySelector('.risk-card').className='risk-card '+risk.level;$('advice-title').textContent=risk.label;$('advice-copy').textContent=risk.copy;renderTideSchedule(data,idx);
    $('next-window').textContent=fieldWindow(data,idx)||'Belum ditemukan dalam prakiraan';renderDirectionArrows(data,h);renderChart(data);
  }
  function renderDirectionArrows(data,h){
    if(state.waveArrow){state.waveArrow.remove();state.waveArrow=null;}
    if(state.currentArrow){state.currentArrow.remove();state.currentArrow=null;}
    const coastLat=state.selected.lat,coastLon=state.selected.lon;
    if(state.product==='wave'&&Number.isFinite(h.wave_direction)){
      const travelDirection=(h.wave_direction+180)%360;
      const regional=data.waveFallbackKm?` · referensi regional ±${data.waveFallbackKm} km`:'';
      const label=`Gelombang datang dari ${dirLong(h.wave_direction)} · bergerak ke ${dirLong(travelDirection)} · ${fmt(h.wave_height,1)} m${regional}`;
      const icon=L.divIcon({className:'marine-direction-container',html:`<div class="marine-direction-marker wave" style="--direction-rotation:${travelDirection}deg" aria-label="${label}"><span class="marine-arrow" aria-hidden="true">↑</span><span class="marine-label">Gelombang · ${fmt(h.wave_height,1)} m</span></div>`,iconSize:[146,66],iconAnchor:[73,33]});
      state.waveArrow=L.marker([coastLat,coastLon],{icon,zIndexOffset:720,interactive:true}).addTo(map).bindTooltip(`${label}<br><small>Pantai ${state.selected.name} · titik sel model laut terdekat</small>`,{direction:'top',offset:[0,-24]}).openTooltip();
    }
    if(state.product==='current'&&Number.isFinite(h.ocean_current_direction)){
      const currentDirection=(h.ocean_current_direction+360)%360;
      const regional=data.currentFallbackKm?` · referensi regional ±${data.currentFallbackKm} km`:'';
      const label=`Arus bergerak menuju ${dirLong(currentDirection)} · ${fmt(h.ocean_current_velocity,1)} km/j${regional}`;
      const icon=L.divIcon({className:'marine-direction-container',html:`<div class="marine-direction-marker current" style="--direction-rotation:${currentDirection}deg" aria-label="${label}"><span class="marine-arrow" aria-hidden="true">↑</span><span class="marine-label">Arus · ${fmt(h.ocean_current_velocity,1)} km/j</span></div>`,iconSize:[146,66],iconAnchor:[73,33]});
      state.currentArrow=L.marker([coastLat,coastLon],{icon,zIndexOffset:720,interactive:true}).addTo(map).bindTooltip(`${label}<br><small>Pantai ${state.selected.name} · titik sel model laut terdekat</small>`,{direction:'top',offset:[0,-24]}).openTooltip();
    }
  }
  function renderChart(data){
    const metric=$('chart-metric').value,times=data.hourly.time.slice(0,72),units={sea_level_height_msl:'m terhadap MSL',wave_height:'m',ocean_current_velocity:'km/j',sea_surface_temperature:'°C'},names={sea_level_height_msl:'Pasang surut',wave_height:'Tinggi gelombang',ocean_current_velocity:'Kecepatan arus',sea_surface_temperature:'Suhu permukaan laut'};
    const labels=times.map(t=>new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',hour:'2-digit',hourCycle:'h23',timeZone:'Asia/Jakarta'}).format(toDate(t)).replace('.',':')),values=data.hourly[metric].slice(0,72),events=metric==='sea_level_height_msl'?tideEvents(data,0).filter(e=>times.includes(e.time)):[];
    const guidePlugin={id:'coastalGuides',afterDatasetsDraw(chart){const {ctx,chartArea,scales}=chart,now=Date.now(),stamps=times.map(toMillis);ctx.save();if(now>=stamps[0]&&now<=stamps[stamps.length-1]){let ni=stamps.findIndex(t=>t>=now);ni=Math.max(0,ni);const previous=Math.max(0,ni-1),span=stamps[ni]-stamps[previous]||1,fraction=ni===0?0:(now-stamps[previous])/span,x=scales.x.getPixelForValue(previous)+(scales.x.getPixelForValue(ni)-scales.x.getPixelForValue(previous))*fraction;ctx.setLineDash([4,4]);ctx.strokeStyle='#dc554d';ctx.beginPath();ctx.moveTo(x,chartArea.top);ctx.lineTo(x,chartArea.bottom);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#b73c36';ctx.font='600 10px Inter, sans-serif';ctx.fillText('Sekarang (WIB)',Math.min(x+4,chartArea.right-76),chartArea.top+11);}events.forEach(e=>{const i=times.indexOf(e.time),x=scales.x.getPixelForValue(i),y=scales.y.getPixelForValue(e.level),clock=new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Jakarta'}).format(toDate(e.time)).replace('.',':'),label=`${e.type==='high'?'Pasang':'Surut'} ${clock} WIB`;ctx.fillStyle=e.type==='high'?'#0a91c7':'#087d75';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();ctx.font='600 10px Inter, sans-serif';ctx.textAlign=i>times.length-10?'right':'left';ctx.fillText(label,i>times.length-10?x-6:x+6,Math.max(chartArea.top+12,y-8));});ctx.restore();}};
    $('chart-title').textContent=`${names[metric]} · ${state.selected.name}`;if(state.chart)state.chart.destroy();state.chart=new Chart($('forecast-chart'),{type:'line',plugins:[guidePlugin],data:{labels,datasets:[{label:units[metric],data:values,borderColor:'#087d75',backgroundColor:'#087d7522',fill:true,tension:.25,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},scales:{x:{ticks:{maxTicksLimit:7,maxRotation:0,font:{size:10}}},y:{title:{display:true,text:units[metric]}}},plugins:{legend:{display:false},tooltip:{padding:7,titleFont:{size:11},bodyFont:{size:11},displayColors:false}}}});
  }
  function renderMarkers(){LOCATIONS.forEach(loc=>{const data=state.data.get(loc.id),risk=data?riskOf(currentHour(data).h):{level:'watch'};if(state.markers.has(loc.id))state.markers.get(loc.id).remove();const icon=L.divIcon({className:'',html:`<div class="coast-marker ${risk.level}" style="width:22px;height:22px"></div>`,iconSize:[22,22],iconAnchor:[11,11]});const marker=L.marker([loc.lat,loc.lon],{icon}).addTo(map).bindTooltip(loc.name,{permanent:false});marker.on('click',()=>setSelected(loc));state.markers.set(loc.id,marker)});}
  async function loadAreas(){try{const r=await fetch('data/area_mangrove.geojson');const j=await r.json();state.areas=L.geoJSON(j,{style:{color:'#0d8678',weight:2,fillColor:'#28a899',fillOpacity:.16},filter:f=>LOCATIONS.some(l=>String(f.properties&&f.properties.Desa||'').toLowerCase()===l.name.toLowerCase())}).addTo(map)}catch(e){console.warn(e)}}
  async function loadCoastalChange(){try{const [summaryResponse,geoResponse]=await Promise.all([fetch('data/coastal-change-annual.json?v=20260812-seven'),fetch('data/coastal-change-annual.geojson?v=20260812-seven')]);if(!summaryResponse.ok||!geoResponse.ok)throw new Error('Data perubahan pantai tidak tersedia');const summary=await summaryResponse.json(),geo=await geoResponse.json();summary.villages.forEach(row=>state.changeSummary.set(row.village.toLowerCase(),row));state.changeLayer=L.geoJSON(geo,{style:f=>{const erosion=f.properties.change==='erosion',low=f.properties.confidence!=='tinggi';return {color:erosion?'#a8201a':'#18794e',weight:low?1:1.5,dashArray:low?'4 4':null,fillColor:erosion?'#d6402b':'#2fa86f',fillOpacity:low?.28:.48}},onEachFeature:(f,layer)=>layer.bindPopup(`<strong>${f.properties.change==='erosion'?'Indikasi kehilangan daratan':'Indikasi pertambahan daratan'}</strong><br>${f.properties.village} · 2016–2025<br>Keyakinan: ${f.properties.confidence}<br><small>Bukan hasil survei garis pantai.</small>`)}).addTo(map);renderCoastalChange()}catch(e){console.warn(e);renderCoastalChange()}}
  async function loadPreliminaryCoastalChange(){try{const [summaryResponse,geoResponse]=await Promise.all([fetch('data/coastal-change-non-intervention-annual.json?v=20260812-siak-preview1'),fetch('data/coastal-change-non-intervention-annual.geojson?v=20260812-siak-preview1')]);if(!summaryResponse.ok||!geoResponse.ok)throw new Error('Data analisis awal tidak tersedia');const summary=await summaryResponse.json(),geo=await geoResponse.json();state.preliminarySummary=summary.villages||[];state.preliminaryLayer=L.geoJSON(geo,{style:f=>{const erosion=f.properties.change==='erosion';return {color:erosion?'#c56b17':'#276fbf',weight:2,dashArray:'6 5',fillColor:erosion?'#f0a24a':'#68a8dc',fillOpacity:.24}},onEachFeature:(f,layer)=>layer.bindPopup(`<strong>Analisis awal: ${f.properties.change==='erosion'?'indikasi kehilangan':'indikasi pertambahan'} daratan</strong><br>${f.properties.village} · Kabupaten ${f.properties.regency}<br>2016–2025 · keyakinan ${f.properties.confidence}<br><small>Hasil awal desa non-intervensi. Belum terverifikasi lapangan dan bukan penetapan abrasi.</small>`)}).addTo(map);const analysed=state.preliminarySummary.filter(row=>row.status==='analysed').length;$('preliminary-status').innerHTML=`<strong>${analysed} desa Siak tampil</strong><span>Garis putus-putus · keyakinan rendah</span>`}catch(e){console.warn(e);$('preliminary-status').textContent='Analisis awal Siak belum dapat dimuat'}}
  async function init(){renderTabs();$('location-name').textContent=state.selected.name;$('location-meta').textContent='Memuat titik model laut terdekat…';await Promise.all([loadAreas(),loadCoastalChange(),loadPreliminaryCoastalChange()]);try{const results=await Promise.allSettled(LOCATIONS.map(fetchMarine));results.forEach((r,i)=>{if(r.status==='fulfilled')state.data.set(LOCATIONS[i].id,r.value)});if(!state.data.size)throw new Error('Data tidak tersedia');$('data-status').textContent=`Aktif · ${state.changeSummary.size} desa intervensi + ${state.preliminarySummary.length} analisis awal`;$('updated-at').textContent='Abrasi diperbarui tahunan · cuaca diperbarui otomatis';renderMarkers();setSelected(state.selected)}catch(e){$('data-status').textContent='Data abrasi tersedia · cuaca terganggu';$('updated-at').textContent='Baseline perubahan pantai 2016';$('map-message').hidden=false;$('map-message').textContent='Data oseanografi belum dapat dimuat. Indikasi perubahan pantai tetap tersedia.';renderMarkers();setSelected(state.selected)}}
  $('location-tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-id]');if(b)setSelected(LOCATIONS.find(l=>l.id===b.dataset.id))});$('toggle-coastal-change').addEventListener('change',e=>{if(!state.changeLayer)return;if(e.target.checked)state.changeLayer.addTo(map);else state.changeLayer.remove()});$('toggle-preliminary-change').addEventListener('change',e=>{if(!state.preliminaryLayer)return;if(e.target.checked)state.preliminaryLayer.addTo(map);else state.preliminaryLayer.remove()});$('chart-metric').addEventListener('change',()=>{const d=state.data.get(state.selected.id);if(d)renderChart(d)});$('zoom-all').addEventListener('click',()=>map.fitBounds(L.latLngBounds(LOCATIONS.map(l=>[l.lat,l.lon])).pad(.25)));$('zoom-preliminary').addEventListener('click',()=>{if(state.preliminaryLayer&&state.preliminaryLayer.getBounds().isValid())map.fitBounds(state.preliminaryLayer.getBounds().pad(.2))});document.querySelectorAll('input[name=product]').forEach(r=>r.addEventListener('change',()=>{state.product=r.value;$('chart-metric').value={wave:'wave_height',current:'ocean_current_velocity',tide:'sea_level_height_msl',sst:'sea_surface_temperature'}[r.value];const d=state.data.get(state.selected.id);if(d){renderDirectionArrows(d,currentHour(d).h);renderChart(d)}}));init();
})();
