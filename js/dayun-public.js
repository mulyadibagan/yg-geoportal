(function () {
  'use strict';
  var page = document.body.getAttribute('data-dayun-page');
  var proposalMode = true; // Public information only; no local submission routes.
  function alignWithLiveShell() {
    ['css/style.css?v=20260723-revert-layout','css/language-switcher.css?v=20260721-all-pages1','css/navigation-v2.css?v=20260807-mobile-submenu-links1'].forEach(function(href){
      var link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.appendChild(link);
    });
    var header=document.querySelector('.dy-header');
    if(header){
      header.className='site-header';
      header.innerHTML='<div class="header-inner"><a class="brand" href="index.html"><img src="assets/logo-yayasan-gambut.png" alt="Logo Yayasan Gambut"><span><strong>YG GeoPortal</strong><span>WebGIS Yayasan Gambut</span></span></a><button class="yg-nav-toggle" type="button" aria-label="Buka menu" aria-expanded="false" data-yg-nav-toggle="main-navigation">☰</button><nav class="nav yg-nav-v2" id="main-navigation" aria-label="Navigasi utama" data-yg-navigation><a href="index.html">Beranda</a><a href="webgis.html">Peta Interaktif</a><div class="yg-nav-group"><button class="yg-nav-trigger" type="button" aria-expanded="false">Jelajahi</button><div class="yg-nav-menu"><a href="biodiversity.html">Biodiversitas</a><a href="fire-weather.html">Karhutla &amp; Cuaca</a><a href="coastal-monitoring.html">Pesisir &amp; Mangrove</a><a href="social-forestry-directory.html">Direktori Perhutanan Sosial<small>Profil spasial dan dokumen nonspasial</small></a></div></div><div class="yg-nav-group"><button class="yg-nav-trigger" type="button" aria-expanded="false">Program Dayun</button><div class="yg-nav-menu"><a href="dayun.html">Ringkasan Program<small>KUPS Rimba Sejahtera</small></a><a href="dayun-map.html">Peta Agroforestri<small>Lokasi dan pembagian areal</small></a><a href="dayun.html#arah-program">Tujuan Program<small>Perubahan yang ingin dicapai</small></a><a href="dayun.html#perjalanan-program">Perjalanan Program<small>Rencana kegiatan 12 bulan</small></a></div></div><a href="report.html">Laporkan Temuan</a><a href="staff-login.html">Login Staf</a><span class="yg-public-language-switcher" role="group" aria-label="Pilihan bahasa / Language selection"><button type="button" data-lang="id" aria-pressed="true">ID</button><button type="button" data-lang="en" aria-pressed="false">EN</button></span></nav></div>';
    }
    var font=document.createElement('link');font.rel='stylesheet';font.href='https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap';document.head.appendChild(font);
    var nav=document.createElement('script');nav.src='js/navigation-v2.js?v=20260821-staff-name1';nav.defer=true;document.head.appendChild(nav);
  }
  alignWithLiveShell();
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function fmtDate(value) { if (!value) return 'Belum tersedia'; return new Date(value.length === 10 ? value + 'T00:00:00' : value).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }
  function fmtArea(value) { return value == null ? 'Belum dihitung' : Number(value).toLocaleString('id-ID') + ' ha'; }
  function statusBadge(status) { return '<span class="dy-badge ' + String(status || '').toLowerCase() + '">' + esc(status || '-') + '</span>'; }
  function progressLabel(status) { return ({NOT_STARTED:'Belum dimulai',IN_PROGRESS:'Berjalan',COMPLETED:'Selesai',DELAYED:'Tertunda'})[status] || 'Belum dimulai'; }
  function publicObjectName(value) { return String(value || ''); }
  function toast(message) { var old=document.querySelector('.dy-toast'); if(old)old.remove(); var el=document.createElement('div'); el.className='dy-toast'; el.textContent=message; document.body.appendChild(el); setTimeout(function(){el.remove();},3600); }
  function byId(objects,id){return objects.find(function(x){return x.objectId===id;});}
  function safePhoto(input){var f=input&&input.files&&input.files[0];return f?{name:f.name,size:f.size,type:f.type}:null;}
  function serialize(form){var data={}; new FormData(form).forEach(function(v,k){if(v instanceof File)return;data[k]=v;}); return data;}
  function populateObjectSelect(select, objects){objects.filter(function(o){return o.monitoringEnabled!==false;}).forEach(function(o){var opt=document.createElement('option'),shortId=o.shortId||o.objectId,name=String(o.name||'').replace(shortId,'').trim();opt.value=o.objectId;opt.textContent=shortId+' · '+name;select.appendChild(opt);});}

  function initDayunMap(data){
    var mapEl=document.getElementById('dayun-map'),legendEl=document.getElementById('dayun-layers');
    if(!mapEl||!legendEl)return;
    if(typeof L==='undefined'){mapEl.innerHTML='<div class="dy-map-loading">Pustaka peta tidak dapat dimuat.</div>';return;}
    var satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:20,attribution:'Tiles &copy; Esri'});
    var osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxNativeZoom:19,maxZoom:20,attribution:'&copy; OpenStreetMap contributors'});
    var map=L.map(mapEl,{zoomControl:true,layers:[satellite]}).setView([0.5844,102.009],17);
    var expandControl=L.control({position:'topleft'});
    expandControl.onAdd=function(){var button=L.DomUtil.create('button','dy-map-expand leaflet-bar');button.type='button';button.title='Buka peta layar penuh';button.setAttribute('aria-label','Buka peta layar penuh');button.innerHTML='⛶';L.DomEvent.disableClickPropagation(button);L.DomEvent.on(button,'click',function(){var expanded=mapEl.classList.toggle('is-fullscreen');document.body.classList.toggle('dy-map-open',expanded);button.innerHTML=expanded?'×':'⛶';button.title=expanded?'Tutup peta layar penuh':'Buka peta layar penuh';button.setAttribute('aria-label',button.title);setTimeout(function(){map.invalidateSize();},100);});return button;};
    expandControl.addTo(map);document.addEventListener('keydown',function(event){if(event.key==='Escape'&&mapEl.classList.contains('is-fullscreen')){mapEl.classList.remove('is-fullscreen');document.body.classList.remove('dy-map-open');var button=mapEl.querySelector('.dy-map-expand');if(button){button.innerHTML='⛶';button.title='Buka peta layar penuh';button.setAttribute('aria-label',button.title);}setTimeout(function(){map.invalidateSize();},100);}});
    Promise.all([fetch('data/dayun-map.geojson?v=20260910-3'),fetch('data/dayun-context.geojson?v=20260908-1')]).then(function(responses){if(!responses[0].ok||!responses[1].ok)throw new Error('GeoJSON peta tidak dapat dimuat.');return Promise.all(responses.map(function(response){return response.json();}));}).then(function(results){
      var geojson=results[0],contextGeojson=results[1],groups={},featureLayers={},categoryBounds={},contextLayers={},active=data.layers[0].id;
      data.layers.forEach(function(layer){groups[layer.id]=L.featureGroup();});
      contextGeojson.features.forEach(function(feature){var p=feature.properties||{},isVillage=p.contextId==='desa-dayun';var layer=L.geoJSON(feature,{style:isVillage?{color:'#49a7ff',weight:3,opacity:.95,fillColor:'#49a7ff',fillOpacity:.035,dashArray:'12 8'}:{color:'#ffe14f',weight:3,opacity:1,fillColor:'#ffe14f',fillOpacity:.07,dashArray:'7 5'},onEachFeature:function(f,l){l.bindPopup(isVillage?'<div class="dy-map-popup"><b>Desa Dayun</b><span>Wilayah pelaksanaan Program Dayun</span></div>':'<div class="dy-map-popup"><b>HKm Mandiri Sejahtera</b><span>Wilayah kelola masyarakat seluas '+Number(p.permitAreaHa||0).toLocaleString('id-ID')+' ha</span></div>');}});contextLayers[p.contextId]=layer;layer.addTo(map);});
      L.control.layers({'Satelit':satellite,'OpenStreetMap':osm},{'Batas Desa Dayun':contextLayers['desa-dayun'],'PS HKm Mandiri Sejahtera':contextLayers['ps-hkm']},{position:'topright'}).addTo(map);
      function featureStyle(feature){var p=feature.properties||{};return p.line?{color:p.color||'#ef7d00',weight:3,opacity:.92,dashArray:'7 5'}:{color:'#173f32',weight:1.5,fillColor:p.color||'#6baa91',fillOpacity:.74};}
      L.geoJSON(geojson,{style:featureStyle,onEachFeature:function(feature,layer){
        var p=feature.properties||{},object=byId(data.objects,p.objectId);
        var areaText=p.areaHa==null?'Bagian dari kebun nanas seluas '+Number(p.parentAreaHa||0).toLocaleString('id-ID')+' ha':'Luas pada peta '+fmtArea(p.areaHa);
        var detailLink=!proposalMode&&object&&object.publicDetail!==false?'<div class="dy-map-popup-actions"><a href="dayun-object.html?object='+encodeURIComponent(p.objectId)+'">Lihat perkembangan</a></div>':'';
        layer.bindPopup('<div class="dy-map-popup"><b>'+esc(publicObjectName(p.name))+'</b><span>'+areaText+'</span><small>Bagian dari areal Agro Mandiri Sejahtera</small>'+detailLink+'</div>');
        if(p.shortId)layer.bindTooltip(esc(p.shortId),{sticky:true,direction:'top'});
        layer.on('click',function(){document.querySelectorAll('.dy-object-key').forEach(function(x){x.classList.toggle('active',x.getAttribute('data-category')===p.category);});});
        if(groups[p.layerId])groups[p.layerId].addLayer(layer);featureLayers[p.objectId]=layer;if(!categoryBounds[p.category])categoryBounds[p.category]=L.latLngBounds([]);categoryBounds[p.category].extend(layer.getBounds());
      }});
      function renderLegend(){
        var layer=data.layers.find(function(x){return x.id===active;}),items=layer.items||[];
        legendEl.innerHTML='<div class="dy-context-panel"><b>Lokasi program</b><span><i class="dy-context-line village"></i>Kampung Dayun</span><span><i class="dy-context-line hkm"></i>HKm Mandiri Sejahtera · 980 ha</span><div class="dy-context-actions"><button type="button" data-context="objects">Lihat kebun</button><button type="button" data-context="hkm">Lihat kawasan HKm</button><button type="button" data-context="village">Lihat Kampung Dayun</button></div></div><div class="dy-layer-tabs">'+data.layers.map(function(x){return '<button type="button" class="dy-layer-tab '+(x.id===active?'active':'')+'" data-map-layer="'+esc(x.id)+'">'+esc(x.publicName||x.name)+'</button>';}).join('')+'</div><div class="dy-legend-panel"><div class="dy-legend-heading"><div><b>'+esc(layer.publicName||layer.name)+'</b><small>Pembagian areal kebun</small></div><span class="dy-legend-total">'+layer.reportedTotalHa.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})+' ha</span></div><div class="dy-object-list">'+items.map(function(item){return '<button type="button" class="dy-object-key" data-category="'+esc(item.category)+'"><i class="dy-object-swatch" style="background:'+esc(item.color||'#6baa91')+'"></i><span class="dy-object-copy"><b>'+esc(item.name)+'</b><small>'+item.featureCount+' bagian</small></span><span class="dy-object-area">'+fmtArea(item.areaHa)+'</span></button>';}).join('')+'</div></div><div class="dy-source-note"><b>Gawangan tanam</b> telah diberi nomor GT-001 sampai GT-087. Informasi tanaman akan dilengkapi secara bertahap.</div>';
        legendEl.querySelectorAll('[data-map-layer]').forEach(function(btn){btn.addEventListener('click',function(){switchLayer(btn.getAttribute('data-map-layer'));});});
        legendEl.querySelectorAll('[data-category]').forEach(function(btn){btn.addEventListener('click',function(){var bounds=categoryBounds[btn.getAttribute('data-category')];if(!bounds||!bounds.isValid())return;map.fitBounds(bounds,{padding:[36,36],maxZoom:18});document.querySelectorAll('.dy-object-key').forEach(function(x){x.classList.toggle('active',x===btn);});});});
        legendEl.querySelectorAll('[data-context]').forEach(function(btn){btn.addEventListener('click',function(){var target=btn.getAttribute('data-context');if(target==='objects')map.fitBounds(groups[active].getBounds(),{padding:[24,24]});if(target==='hkm')map.fitBounds(contextLayers['ps-hkm'].getBounds(),{padding:[28,28]});if(target==='village')map.fitBounds(contextLayers['desa-dayun'].getBounds(),{padding:[28,28]});});});
      }
      function switchLayer(id){if(!groups[id]||id===active)return;map.removeLayer(groups[active]);active=id;groups[active].addTo(map);renderLegend();map.fitBounds(groups[active].getBounds(),{padding:[24,24]});}
      groups[active].addTo(map);renderLegend();map.fitBounds(groups[active].getBounds(),{padding:[24,24]});setTimeout(function(){map.invalidateSize();map.fitBounds(groups[active].getBounds(),{padding:[24,24]});},120);
    }).catch(function(error){console.error(error);mapEl.innerHTML='<div class="dy-map-loading">Peta objek belum dapat dimuat.</div>';});
  }

  var DAYUN_LAT=0.5844,DAYUN_LON=102.009;
  function weatherLabel(code){return ({0:'Cerah',1:'Cerah berawan',2:'Berawan',3:'Mendung',45:'Berkabut',48:'Kabut tebal',51:'Gerimis ringan',53:'Gerimis',55:'Gerimis lebat',61:'Hujan ringan',63:'Hujan sedang',65:'Hujan lebat',80:'Hujan setempat',81:'Hujan sedang',82:'Hujan lebat',95:'Hujan petir',96:'Hujan petir',99:'Hujan petir'})[Number(code)]||'Cuaca berubah';}
  function weatherIcon(code){code=Number(code);if(code===0)return '☀';if(code<=3)return '☁';if(code===45||code===48)return '≋';if(code>=95)return '⚡';return '☂';}
  function dayunNum(value,digits){return new Intl.NumberFormat('id-ID',{maximumFractionDigits:digits==null?1:digits}).format(Number(value)||0);}
  function renderDayunWeather(weather){
    var target=document.getElementById('dayun-weather-current');if(!target)return;
    var current=weather.current||{},daily=weather.daily||{},hourly=weather.hourly||{};
    target.innerHTML='<div class="dy-weather-main"><span class="dy-weather-icon">'+weatherIcon(current.weather_code)+'</span><div><small>Saat ini di areal agroforestri</small><strong>'+dayunNum(current.temperature_2m,1)+' °C</strong><span>'+weatherLabel(current.weather_code)+'</span></div></div><div class="dy-weather-facts"><article><small>Kelembapan</small><strong>'+dayunNum(current.relative_humidity_2m,0)+'%</strong></article><article><small>Angin</small><strong>'+dayunNum(current.wind_speed_10m,1)+' km/jam</strong></article><article><small>Hujan saat ini</small><strong>'+dayunNum(current.precipitation,1)+' mm</strong></article></div>';
    var now=Date.now(),hourRows=(hourly.time||[]).map(function(time,index){return {time:time,code:hourly.weather_code[index],temp:hourly.temperature_2m[index],chance:hourly.precipitation_probability[index],rain:hourly.precipitation[index],wind:hourly.wind_speed_10m[index]};}).filter(function(row){return new Date(row.time+':00+07:00').getTime()>=now-3600000;}).filter(function(_,index){return index%3===0;}).slice(0,8);
    var hourlyEl=document.getElementById('dayun-hourly-forecast');if(hourlyEl)hourlyEl.innerHTML=hourRows.map(function(row){var date=new Date(row.time+':00+07:00'),label=new Intl.DateTimeFormat('id-ID',{weekday:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}).format(date);return '<article><time>'+label+' WIB</time><span class="dy-forecast-icon">'+weatherIcon(row.code)+'</span><strong>'+weatherLabel(row.code)+'</strong><span>Peluang hujan '+dayunNum(row.chance,0)+'%</span><span>'+dayunNum(row.rain,1)+' mm · '+dayunNum(row.temp,0)+' °C</span><small>Angin '+dayunNum(row.wind,1)+' km/jam</small></article>';}).join('');
    var rows=(daily.time||[]).slice(0,7).map(function(date,index){return {date:date,code:daily.weather_code[index],min:daily.temperature_2m_min[index],max:daily.temperature_2m_max[index],rain:daily.precipitation_sum[index]};});
    document.getElementById('dayun-weather-forecast').innerHTML=rows.map(function(row){var day=new Intl.DateTimeFormat('id-ID',{weekday:'short',day:'numeric',month:'short',timeZone:'Asia/Jakarta'}).format(new Date(row.date+'T12:00:00+07:00'));return '<article><span class="dy-forecast-icon">'+weatherIcon(row.code)+'</span><small>'+day+'</small><strong>'+weatherLabel(row.code)+'</strong><span>'+dayunNum(row.min,0)+'–'+dayunNum(row.max,0)+' °C</span><span>Hujan '+dayunNum(row.rain,1)+' mm</span></article>';}).join('');
    document.getElementById('dayun-weather-updated').textContent=current.time?'Model cuaca diperbarui '+new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}).format(new Date(current.time+':00+07:00'))+' WIB':'';
  }
  function dayunDateKey(date){return date.toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'}).replaceAll('-','');}
  function renderDayunRain(payload,cached){
    var values=payload&&payload.properties&&payload.properties.parameter&&payload.properties.parameter.PRECTOTCORR||{};
    var rows=Object.entries(values).map(function(entry){return {date:entry[0],rain:Number(entry[1])};}).filter(function(row){return Number.isFinite(row.rain)&&row.rain>=0;}).sort(function(a,b){return a.date.localeCompare(b.date);});
    if(!rows.length)throw new Error('Data hujan belum tersedia');
    var total=function(days){return rows.slice(-days).reduce(function(sum,row){return sum+row.rain;},0);},latest=rows[rows.length-1].date,iso=latest.slice(0,4)+'-'+latest.slice(4,6)+'-'+latest.slice(6,8);
    document.getElementById('dayun-rain-7d').textContent=dayunNum(total(7),1)+' mm';
    document.getElementById('dayun-rain-30d').textContent=dayunNum(total(30),1)+' mm';
    document.getElementById('dayun-rain-note').textContent='Estimasi NASA POWER sampai '+new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(iso+'T12:00:00+07:00'))+(cached?' · data tersimpan':'')+'. Nilai ini mewakili titik kebun, bukan alat ukur lapangan.';
  }
  async function initDayunWeather(){
    if(!document.getElementById('dayun-weather-current'))return;
    var weatherKey='yg-dayun-weather-v2',rainKey='yg-dayun-rain-v1';
    try{
      var stored=JSON.parse(localStorage.getItem(weatherKey)||'null'),weather;
      if(stored&&Date.now()-stored.savedAt<1800000)weather=stored.data;
      else{var response=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+DAYUN_LAT+'&longitude='+DAYUN_LON+'&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7&timezone=Asia%2FJakarta');if(!response.ok)throw new Error('Cuaca tidak tersedia');weather=await response.json();try{localStorage.setItem(weatherKey,JSON.stringify({savedAt:Date.now(),data:weather}));}catch(_){}}
      renderDayunWeather(weather);
    }catch(error){document.getElementById('dayun-weather-current').innerHTML='<div class="dy-weather-loading">Cuaca kebun sementara belum dapat dimuat.</div>';}
    try{
      var saved=JSON.parse(localStorage.getItem(rainKey)||'null'),rain;
      if(saved&&Date.now()-saved.savedAt<21600000){rain=saved.data;renderDayunRain(rain,true);}
      else{var end=new Date(),start=new Date(end);start.setDate(start.getDate()-45);var rainResponse=await fetch('https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG&longitude='+DAYUN_LON+'&latitude='+DAYUN_LAT+'&start='+dayunDateKey(start)+'&end='+dayunDateKey(end)+'&format=JSON');if(!rainResponse.ok)throw new Error('Hujan tidak tersedia');rain=await rainResponse.json();renderDayunRain(rain,false);try{localStorage.setItem(rainKey,JSON.stringify({savedAt:Date.now(),data:rain}));}catch(_){}}
    }catch(error){document.getElementById('dayun-rain-7d').textContent='Belum tersedia';document.getElementById('dayun-rain-30d').textContent='Belum tersedia';document.getElementById('dayun-rain-note').textContent='Estimasi hujan sementara tidak dapat dimuat.';}
  }

  function monthLabel(value){return new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(value+'T12:00:00+07:00'));}
  function renderDayunRainHistory(payload){
    var values=payload&&payload.properties&&payload.properties.parameter&&payload.properties.parameter.PRECTOTCORR||{};
    var rows=Object.entries(values).map(function(entry){var k=entry[0],v=Number(entry[1]);return {key:k,date:k.slice(0,4)+'-'+k.slice(4,6)+'-'+k.slice(6,8),rain:v};}).filter(function(row){return Number.isFinite(row.rain)&&row.rain>=0;}).sort(function(a,b){return a.key.localeCompare(b.key);});
    if(!rows.length)throw new Error('Riwayat hujan belum tersedia');
    var monthly={};rows.forEach(function(row){var key=row.date.slice(0,7);monthly[key]=(monthly[key]||0)+row.rain;});
    var sumLast=function(days){return rows.slice(-days).reduce(function(sum,row){return sum+row.rain;},0);};
    var dryStreak=0;for(var di=rows.length-1;di>=0&&rows[di].rain<1;di--)dryStreak++;
    var peak=rows.reduce(function(best,row){return row.rain>best.rain?row:best;},rows[0]);
    var monthEntries=Object.entries(monthly),currentMonth=monthEntries[monthEntries.length-1],previousMonth=monthEntries[monthEntries.length-2],currentDays=rows.filter(function(r){return r.date.slice(0,7)===currentMonth[0];}).length,previousDays=rows.filter(function(r){return r.date.slice(0,7)===previousMonth[0];}).length,comparison=previousMonth&&previousMonth[1]&&currentDays&&previousDays?(((currentMonth[1]/currentDays)-(previousMonth[1]/previousDays))/(previousMonth[1]/previousDays))*100:null;
    var kpis=[['7 hari',dayunNum(sumLast(7),1)+' mm'],['30 hari',dayunNum(sumLast(30),1)+' mm'],['Sejak 1 Juli',dayunNum(sumLast(rows.length),1)+' mm'],['Hari kering beruntun',dryStreak+' hari'],['Hujan tertinggi',dayunNum(peak.rain,1)+' mm'],['Rerata harian vs bulan lalu',comparison==null?'Belum cukup data':(comparison>=0?'+':'')+dayunNum(comparison,0)+'%']];
    document.getElementById('dayun-rain-kpis').innerHTML=kpis.map(function(item,index){return '<article><small>'+item[0]+'</small><strong>'+item[1]+'</strong>'+(index===4?'<span>'+new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(peak.date+'T12:00:00+07:00'))+'</span>':'')+'</article>';}).join('');
    var recent7=sumLast(7),status=dryStreak>=7?'Periode kering perlu perhatian':recent7>=100?'Kondisi sangat basah':recent7>=50?'Kondisi cukup basah':'Hujan relatif rendah';
    var guidance=dryStreak>=7?['Periksa kelembapan tanah dan kebutuhan penyiraman pada tanaman muda.','Tingkatkan kewaspadaan terhadap bahan bakar kering dan sumber api.']:recent7>=100?['Periksa genangan, drainase, dan akses kebun sebelum kegiatan lapangan.','Tunda pemupukan apabila hujan lebat masih berpeluang terjadi.']:recent7>=50?['Kondisi air umumnya mendukung tanaman; periksa lokasi yang mudah tergenang.','Sesuaikan pemupukan dan penyemprotan dengan prakiraan per jam.']:['Periksa kelembapan tanah sebelum pemupukan dan penanaman.','Gunakan prakiraan per jam untuk menentukan kebutuhan penyiraman.'];
    document.getElementById('dayun-field-guidance').innerHTML='<div><span>RINGKASAN KONDISI</span><h3>'+status+'</h3><p>Berdasarkan estimasi hujan tujuh hari terakhir dan jumlah hari kering berturut-turut.</p></div><ul>'+guidance.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ul>';
    document.getElementById('dayun-rain-months').innerHTML=Object.entries(monthly).map(function(entry){return '<article><small>'+monthLabel(entry[0]+'-01')+'</small><strong>'+dayunNum(entry[1],1)+' mm</strong><span>'+rows.filter(function(r){return r.date.slice(0,7)===entry[0]&&r.rain>=1;}).length+' hari hujan ≥1 mm</span></article>';}).join('');
    var max=Math.max.apply(null,rows.map(function(row){return row.rain;})),chartH=230,base=184,top=18,barW=7,gap=3,left=42,width=Math.max(760,left+rows.length*(barW+gap)+18),scale=max?((base-top)/max):1;
    var grid=[0,.25,.5,.75,1].map(function(part){var value=max*part,y=base-value*scale;return '<line x1="'+left+'" y1="'+y+'" x2="'+(width-12)+'" y2="'+y+'" stroke="#dce7e1" stroke-width="1"/><text x="'+(left-7)+'" y="'+(y+3)+'" text-anchor="end" fill="#66776f" font-size="9">'+dayunNum(value,0)+'</text>';}).join('');
    var bars=rows.map(function(row,index){var height=row.rain*scale,x=left+index*(barW+gap),y=base-height;return '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+Math.max(height,row.rain>0?1:0)+'" rx="2" fill="#1687a7"><title>'+new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(row.date+'T12:00:00+07:00'))+': '+dayunNum(row.rain,1)+' mm</title></rect>';}).join('');
    var monthTicks=[],seen={};rows.forEach(function(row,index){var key=row.date.slice(0,7);if(!seen[key]){seen[key]=true;monthTicks.push('<text x="'+(left+index*(barW+gap))+'" y="211" fill="#52675e" font-size="10" font-weight="700">'+new Intl.DateTimeFormat('id-ID',{month:'short',timeZone:'Asia/Jakarta'}).format(new Date(row.date+'T12:00:00+07:00'))+'</text>');}});
    document.getElementById('dayun-rain-chart').innerHTML='<svg viewBox="0 0 '+width+' '+chartH+'" width="'+width+'" height="'+chartH+'" aria-hidden="true">'+grid+'<line x1="'+left+'" y1="'+base+'" x2="'+(width-12)+'" y2="'+base+'" stroke="#9db3a8" stroke-width="1"/>'+bars+monthTicks.join('')+'</svg>';
    var first=rows[0].date,last=rows[rows.length-1].date,total=rows.reduce(function(sum,row){return sum+row.rain;},0);
    document.getElementById('dayun-rain-history-note').textContent='Estimasi NASA POWER pada titik kebun · '+new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(first+'T12:00:00+07:00'))+'–'+new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(last+'T12:00:00+07:00'))+' · Total periode '+dayunNum(total,1)+' mm. Nilai mewakili estimasi satelit, bukan alat ukur lapangan.';
  }
  async function initDayunRainHistory(){
    if(!document.getElementById('dayun-rain-chart'))return;
    var key='yg-dayun-rain-history-202607-v1',stored=null;try{stored=JSON.parse(localStorage.getItem(key)||'null');}catch(_){}
    try{
      var payload;if(stored&&Date.now()-stored.savedAt<21600000)payload=stored.data;
      else{var end=new Date(),response=await fetch('https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG&longitude='+DAYUN_LON+'&latitude='+DAYUN_LAT+'&start=20260701&end='+dayunDateKey(end)+'&format=JSON');if(!response.ok)throw new Error('Riwayat hujan tidak tersedia');payload=await response.json();try{localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),data:payload}));}catch(_){}}
      renderDayunRainHistory(payload);
    }catch(error){document.getElementById('dayun-rain-months').innerHTML='<div class="dy-weather-loading">Riwayat curah hujan sementara belum dapat dimuat.</div>';document.getElementById('dayun-rain-history-note').textContent='Silakan muat ulang halaman beberapa saat lagi.';}
  }

  function initLanding(data){
    var eyebrow=document.querySelector('.dy-hero .dy-eyebrow');if(eyebrow)eyebrow.textContent='APRIL Group · Yayasan Gambut · Kampung Dayun';
    document.getElementById('dayun-outcomes').innerHTML=data.outcomes.map(function(x,i){return '<article class="dy-card"><div class="dy-number">0'+(i+1)+'</div><h3>'+esc(x.title)+'</h3><p>'+esc(x.description)+'</p></article>';}).join('');
    var months=Array.from({length:12},function(_,i){return i+1;});
    document.getElementById('dayun-timeline').innerHTML='<div class="dy-workplan-scroll" role="region" aria-label="Tahapan 23 kegiatan, dapat digeser" tabindex="0"><table class="dy-workplan"><thead><tr><th scope="col">Kegiatan utama</th>'+months.map(function(month){return '<th scope="col"><span>Bulan </span>'+month+'</th>';}).join('')+'</tr></thead><tbody>'+data.timeline.map(function(item){return '<tr><th scope="row">'+esc(item.title)+'</th>'+months.map(function(month){var scheduled=item.months.indexOf(month)!==-1;return '<td class="'+(scheduled?'scheduled':'')+'">'+(scheduled?'<span aria-label="Direncanakan pada bulan '+month+'">●</span>':'')+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div><div class="dy-workplan-note"><span><i></i>Periode kegiatan yang direncanakan</span><small>Jadwal mengikuti waktu mulai dan perkembangan pelaksanaan program.</small></div>';
    initDayunMap(data);
    initDayunWeather();
  }
  fetch('data/dayun-program.json', {cache:'no-store'}).then(function(response){if(!response.ok)throw new Error('Informasi program belum dapat dimuat.');return response.json();}).then(function(data){data.objects=[];if(page==='map'){initDayunMap(data);initDayunWeather();initDayunRainHistory();}else initLanding(data);}).catch(function(error){console.error(error);toast(error.message);});
})();
