(function(){
  'use strict';
  var indonesiaBounds=L.latLngBounds([[-11.2,94.5],[6.2,141.5]]);
  var map=L.map('fire-map',{preferCanvas:true,minZoom:3}).fitBounds(indonesiaBounds,{padding:[8,8]});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap'}).addTo(map);
  map.createPane('satellitePane');map.getPane('satellitePane').style.zIndex=205;
  map.createPane('smokePane');map.getPane('smokePane').style.zIndex=360;
  map.createPane('hotspotPane');map.getPane('hotspotPane').style.zIndex=420;
  map.createPane('infrastructurePane');map.getPane('infrastructurePane').style.zIndex=650;

  function gibs(id,matrix,options){
    return L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/'+id+'/default/default/'+matrix+'/{z}/{y}/{x}.png',Object.assign({maxNativeZoom:Number(matrix.match(/\d+$/)[0]),maxZoom:18,noWrap:true,attribution:'NASA GIBS'},options||{}));
  }
  var dateInput=document.getElementById('observation-date');
  function jakartaDate(){
    var parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    var values={};parts.forEach(function(p){values[p.type]=p.value});return values.year+'-'+values.month+'-'+values.day
  }
  var currentDate=jakartaDate(),observationDate=currentDate;dateInput.value=observationDate;dateInput.max=currentDate;
  var readingGuide=document.querySelector('.fw-disclaimer p');if(readingGuide)readingGuide.textContent='Polygon menunjukkan koridor kumulatif potensi transport udara sejak deteksi hotspot pada tiga lapisan GFS. Zona utama dan batas ketidakpastian bukan plume asap teramati, bukan konsentrasi PM2.5, dan bukan prakiraan kesehatan.';
  var satelliteLayer=L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',{layers:'MODIS_Terra_CorrectedReflectance_TrueColor',format:'image/jpeg',transparent:false,pane:'satellitePane',opacity:.72,time:observationDate,attribution:'NASA GIBS / MODIS Terra'});
  var groups={
    hotspots:L.layerGroup().addTo(map),satellite:L.layerGroup([satelliteLayer]),smoke:L.layerGroup(),
    villages:L.layerGroup().addTo(map),rain:L.layerGroup(),wind:L.layerGroup().addTo(map),
    fdrs:L.layerGroup().addTo(map),canals:L.layerGroup().addTo(map)
  };
  var villageGeo=null,analytics=null,hotspotGeo=null,ygBounds=null,period=30,rainLayer=null,mapDateBadge=null,hotspotStatusText='Memuat…',weatherReadings=[],weatherReady=false,transportReadings=[],transportReady=false,transportLoading=false,transportPromise=null,transportTime='',transportCoverage=0,windIndex=null,smokeModel=window.YG_SMOKE_TRANSPORT||null;
  var weatherSites=[['Aceh',5.55,95.32],['Riau',1.45,102.1],['Sumatera Selatan',-3.0,104.8],['Jakarta',-6.2,106.8],['Kalimantan Barat',-.1,109.3],['Kalimantan Tengah',-2.2,113.9],['Kalimantan Timur',.5,117.1],['Sulawesi',-2.0,121.0],['Bali',-8.4,115.2],['Maluku',-3.2,129.0],['Papua Selatan',-7.5,139.5],['Papua Utara',-2.5,140.7]];
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function nameOf(p){return p.Desa||p.WADMKD||p.Nama_Desa||p.NAMOBJ||'Desa intervensi'}
  function pointTime(f){var p=f.properties||{},t=String(p.acq_time||'0000').padStart(4,'0');return new Date(p.acq_date+'T'+t.slice(0,2)+':'+t.slice(2,4)+':00Z')}
  function periodLabel(){return period==='latest'?'6 jam terakhir':period===1?(observationDate===currentDate?'24 jam bergulir':'24 jam sampai akhir tanggal'):period===7?'7 hari · sumber berulang':period+' hari'}
  function periodEnd(){return observationDate===currentDate?new Date():new Date(observationDate+'T23:59:59+07:00')}
  function filteredHotspots(){var end=periodEnd(),items=(hotspotGeo&&hotspotGeo.features||[]).filter(function(f){var t=pointTime(f);return !isNaN(t)&&t<=end}),days=period==='latest'?0.25:Number(period);var cutoff=end.getTime()-days*86400000;return items.filter(function(f){return pointTime(f).getTime()>cutoff})}
  function pointInRing(p,r){var inside=false,x=p[0],y=p[1];for(var i=0,j=r.length-1;i<r.length;j=i++){var xi=r[i][0],yi=r[i][1],xj=r[j][0],yj=r[j][1];if((yi>y)!==(yj>y)&&x<((xj-xi)*(y-yi))/((yj-yi)||1e-12)+xi)inside=!inside}return inside}
  function pointInGeometry(p,g){var polygons=!g?[]:g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];return polygons.some(function(r){return r.length&&pointInRing(p,r[0])&&!r.slice(1).some(function(h){return pointInRing(p,h)})})}
  function risk(c){return c>5?'high':c>2?'medium':c>0?'low':'zero'}
  function color(c){return {zero:'#72bd86',low:'#f2ca52',medium:'#ef8f27',high:'#d6402b'}[risk(c)]}
  function renderVillages(){
    groups.villages.clearLayers();if(!villageGeo||!hotspotGeo)return;var points=filteredHotspots();
    var alerts=[],total=0;
    var layer=L.geoJSON(villageGeo,{style:function(f){var c=points.filter(function(x){return pointInGeometry(x.geometry.coordinates,f.geometry)}).length;return {color:'#31584b',weight:1,fillColor:color(c),fillOpacity:.48}},onEachFeature:function(f,l){var p=f.properties||{},c=points.filter(function(x){return pointInGeometry(x.geometry.coordinates,f.geometry)}).length;total+=c;if(c)alerts.push({name:nameOf(p),count:c,layer:l,risk:risk(c)});l.bindPopup('<strong>'+esc(nameOf(p))+'</strong><br>'+c+' hotspot · '+periodLabel()+'<br><small>NASA FIRMS/VIIRS · confidence tinggi</small>')}}).addTo(groups.villages);
    ygBounds=layer.getBounds();document.getElementById('kpi-hotspots').textContent=total;document.getElementById('kpi-alerts').textContent=alerts.length;renderAlerts(alerts)
  }
  function renderHotspots(){groups.hotspots.clearLayers();var items=filteredHotspots();items.forEach(function(f){var p=f.properties||{},t=pointTime(f),c=f.geometry.coordinates,when=isNaN(t)?'Waktu tidak tersedia':t.toLocaleString('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'})+' WIB',html='<strong>Hotspot confidence tinggi</strong><br>'+when+'<br>Satelit: '+esc(p.satellite||'—')+'<br>Koordinat: '+Number(c[1]).toFixed(5)+', '+Number(c[0]).toFixed(5);if(p.brightness!=null)html+='<br>Suhu kecerahan: '+Number(p.brightness).toFixed(1)+' K';if(p.frp!=null)html+='<br>FRP: '+Number(p.frp).toFixed(1)+' MW';html+='<br><small>NASA FIRMS · klik titik lain untuk melihat datanya</small>';L.circleMarker([c[1],c[0]],{pane:'hotspotPane',radius:6,color:'#7f1d1d',weight:1,fillColor:'#ef2b2d',fillOpacity:.9}).bindPopup(html).addTo(groups.hotspots)});var partial=hotspotGeo&&hotspotGeo.sourceStatus==='partial'?' · PERINGATAN: sumber parsial':'';document.getElementById('period-note').textContent=items.length+' titik daratan high confidence · '+periodLabel()+partial}
  function refreshHotspots(){renderHotspots();renderVillages()}
  function renderAlerts(items){
    items.sort(function(a,b){return b.count-a.count});var box=document.getElementById('alert-list');document.getElementById('alert-count').textContent=items.length;
    if(!items.length){box.innerHTML='<p class="empty">Tidak ada hotspot tercatat pada periode ini di desa intervensi.</p>';return}
    box.innerHTML=items.map(function(x,i){return '<article class="fw-alert-card '+x.risk+'"><button type="button" data-alert="'+i+'"><strong>'+esc(x.name)+'</strong><span>'+x.count+' hotspot · klik untuk melihat peta</span></button></article>'}).join('');
    box.querySelectorAll('[data-alert]').forEach(function(b){b.onclick=function(){var x=items[Number(b.dataset.alert)];map.fitBounds(x.layer.getBounds(),{maxZoom:13});x.layer.openPopup()}})
  }
  function pointLayer(url,group,kind,label){return fetch(url).then(function(r){if(!r.ok)throw Error(label);return r.json()}).then(function(g){var letter=kind==='fdrs'?'F':'S';L.geoJSON(g,{pane:'infrastructurePane',pointToLayer:function(f,ll){return L.marker(ll,{pane:'infrastructurePane',riseOnHover:true,zIndexOffset:1000,icon:L.divIcon({className:'fw-infrastructure-icon',html:'<div class="fw-point '+kind+'" role="img" aria-label="'+esc(label)+'">'+letter+'</div>',iconSize:[24,24],iconAnchor:[12,12],popupAnchor:[0,-13]})})},onEachFeature:function(f,l){var p=f.properties||{},c=f.geometry&&f.geometry.coordinates||[];l.bindPopup('<strong>'+esc(p.Nama_Objek||label)+'</strong><br>'+esc(p.Desa||'')+' · '+esc(p.Tahun||'')+(c.length>1?'<br><small>Koordinat: '+Number(c[1]).toFixed(6)+', '+Number(c[0]).toFixed(6)+'</small>':''))}}).addTo(group);return (g.features||[]).length})}
  function distanceKm(a,b){var dy=(a[0]-b[0])*111,dx=(a[1]-b[1])*111*Math.cos((a[0]+b[0])*Math.PI/360);return Math.sqrt(dx*dx+dy*dy)}
  function nearestWeather(lat,lon){return weatherReadings.reduce(function(best,row){var d=distanceKm([lat,lon],[row.lat,row.lon]);return !best||d<best.distance?Object.assign({distance:d},row):best},null)}
  function smokeEnglish(){return !!(window.YG_I18N&&window.YG_I18N.language==='en')}
  function smokeDetections(){var end=periodEnd(),hours=period==='latest'?6:24,cutoff=end.getTime()-hours*3600000;return (hotspotGeo&&hotspotGeo.features||[]).filter(function(f){var t=pointTime(f);return !isNaN(t)&&t<=end&&t.getTime()>cutoff&&(!smokeModel||smokeModel.isVegetationOrUnclassified(f))})}
  function repeatedSourceGroups(){var end=periodEnd(),cutoff=end.getTime()-7*86400000,buckets={};(hotspotGeo&&hotspotGeo.features||[]).forEach(function(f){var t=pointTime(f);if(isNaN(t)||t>end||t.getTime()<=cutoff||(smokeModel&&!smokeModel.isVegetationOrUnclassified(f)))return;var c=f.geometry.coordinates,key=Math.round(c[1]*50)+'|'+Math.round(c[0]*50);if(!buckets[key])buckets[key]={lat:0,lon:0,count:0,days:{}};var b=buckets[key];b.lat+=c[1];b.lon+=c[0];b.count++;b.days[t.toISOString().slice(0,10)]=true});return Object.keys(buckets).map(function(key){var b=buckets[key];b.lat/=b.count;b.lon/=b.count;b.dayCount=Object.keys(b.days).length;return b}).filter(function(b){return b.dayCount>=2})}
  function renderRepeatedSources(summary,en){var sources=repeatedSourceGroups();if(!sources.length){summary.className='fw-smoke-summary';summary.innerHTML=en?'<strong>Repeated fire sources · 7 days</strong><p>No location has high-confidence detections on two different days.</p>':'<strong>Sumber api berulang · 7 hari</strong><p>Tidak ada lokasi dengan deteksi confidence tinggi pada dua hari berbeda.</p>';return}var buffers=sources.map(function(s){return turf.buffer(turf.point([s.lon,s.lat]),Math.min(10,3+s.dayCount*1.5),{units:'kilometers'})}),merged;try{merged=turf.union(turf.featureCollection(buffers))}catch(error){merged=turf.featureCollection(buffers)}var collection=merged.type==='FeatureCollection'?merged:turf.featureCollection([merged]),zones=[];turf.flattenEach(collection,function(part){zones.push(part)});zones.forEach(function(zone){var html=en?'<strong>Repeated fire-source zone · 7 days</strong><br>Detected on at least two different days.<br><small>This is a source recurrence zone, not a smoke plume.</small>':'<strong>Zona sumber api berulang · 7 hari</strong><br>Terdeteksi pada sedikitnya dua hari berbeda.<br><small>Ini zona perulangan sumber, bukan plume asap.</small>';L.geoJSON(zone,{pane:'smokePane',style:{color:'#a86116',weight:2,dashArray:'6 4',fillColor:'#f2ca52',fillOpacity:.2}}).bindPopup(html).addTo(groups.smoke)});summary.className='fw-smoke-summary';summary.innerHTML=en?'<strong>Repeated fire sources · 7 days</strong><p>'+sources.length+' source clusters form '+zones.length+' connected recurrence zones. No smoke trajectory is shown.</p>':'<strong>Sumber api berulang · 7 hari</strong><p>'+sources.length+' kelompok sumber membentuk '+zones.length+' zona perulangan terkoneksi. Lintasan asap tidak ditampilkan.</p>'}
  function updateSmokeProductLabel(){var en=smokeEnglish(),title=document.getElementById('smoke-product-title'),note=document.getElementById('smoke-product-note');if(period===7){title.textContent=en?'Repeated Fire Sources':'Sumber Api Berulang';note.textContent=en?'At least 2 days within 7 days':'Minimal 2 hari dalam 7 hari'}else if(period===30){title.textContent=en?'Polygon Disabled':'Polygon Dinonaktifkan';note.textContent=en?'Historical detections only':'Hanya deteksi historis'}else{title.textContent=en?'Experimental Smoke-Transport Polygons':'Polygon Transport Asap Eksperimental';note.textContent=period==='latest'?(en?'Model envelope · 6-hour sources':'Selubung model · sumber 6 jam'):(en?'Model envelope · 24-hour sources':'Selubung model · sumber 24 jam')}}
  function levelName(level,en){return level.pressure+' hPa · '+(en?'about ':'sekitar ')+level.altitude.toLocaleString(en?'en-US':'id-ID')+(en?' m ASL':' m dpl')}
  function mergeEnvelopeFeatures(features){
    var valid=(features||[]).filter(Boolean);if(!valid.length)return null;
    try{return turf.union(turf.featureCollection(valid))}catch(error){return turf.featureCollection(valid)}
  }
  function envelopePopup(source,trajectories,en){
    var properties=source.properties||{},sourceCount=Number(properties.source_count)||1,satellites=(properties.satellites||[]).join(', ')||properties.satellite||'—',start=Math.min.apply(null,trajectories.map(function(t){return t.startTime})),detected=new Date(start).toLocaleString(en?'en-US':'id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'})+' WIB',duration=Math.max.apply(null,trajectories.map(function(t){return t.durationHours})),travel=Math.max.apply(null,trajectories.map(function(t){return t.travelKm})),levels=trajectories.map(function(t){return levelName(t.level,en)}).join('; '),outerKm=smokeModel.horizontalSpreadKm(duration,{radiusFactor:smokeModel.DEFAULT_ENVELOPE.outerRadiusFactor});
    return en?'<strong>Experimental smoke-transport polygon</strong><br>Source observation cluster: '+sourceCount+' detection(s)<br>Satellite(s): '+esc(satellites)+'<br>Model starts: '+esc(detected)+'<br>Sensitivity levels: '+esc(levels)+'<br>Simulated duration: '+duration.toFixed(1)+' hours<br>Maximum centerline displacement: '+Math.round(travel)+' km<br>Outer radius at model end: about '+Math.round(outerKm)+' km<br><hr><small>The polygon combines three height-sensitive advection paths with an explicit horizontal puff-growth assumption (σh 1.853 km/hour; outer boundary 1.54σh). It is a cumulative potential-transport corridor, not an observed plume, concentration estimate, probability, or health forecast.</small>':'<strong>Polygon transport asap eksperimental</strong><br>Kelompok observasi sumber: '+sourceCount+' deteksi<br>Satelit: '+esc(satellites)+'<br>Model dimulai: '+esc(detected)+'<br>Lapisan sensitivitas: '+esc(levels)+'<br>Durasi simulasi: '+duration.toFixed(1)+' jam<br>Perpindahan maksimum garis tengah: '+Math.round(travel)+' km<br>Radius luar pada akhir model: sekitar '+Math.round(outerKm)+' km<br><hr><small>Polygon menggabungkan adveksi sensitif-ketinggian pada tiga lapisan dengan asumsi pertumbuhan puff horizontal yang dinyatakan terbuka (σh 1,853 km/jam; batas luar 1,54σh). Ini koridor kumulatif potensi transport, bukan plume teramati, perkiraan konsentrasi, probabilitas, atau prakiraan kesehatan.</small>';
  }
  function renderSourceEnvelope(source,trajectories,en){
    var factor=smokeModel.DEFAULT_ENVELOPE.outerRadiusFactor,core=mergeEnvelopeFeatures(trajectories.map(function(trajectory){return smokeModel.buildEnvelopePolygon(trajectory,{band:'core',radiusFactor:1})})),outer=mergeEnvelopeFeatures(trajectories.map(function(trajectory){return smokeModel.buildEnvelopePolygon(trajectory,{band:'outer',radiusFactor:factor})})),html=envelopePopup(source,trajectories,en);
    if(outer)L.geoJSON(outer,{pane:'smokePane',style:{color:'#766b63',weight:2,dashArray:'7 5',fillColor:'#a69b92',fillOpacity:.15}}).bindPopup(html,{maxWidth:380}).bindTooltip(en?'Model uncertainty boundary':'Batas ketidakpastian model').addTo(groups.smoke);
    if(core)L.geoJSON(core,{pane:'smokePane',style:{color:'#4f4742',weight:1.5,fillColor:'#6f655e',fillOpacity:.28}}).bindPopup(html,{maxWidth:380}).bindTooltip(en?'Primary model zone':'Zona utama model').addTo(groups.smoke);
    var coordinates=source.geometry&&source.geometry.coordinates||[];if(coordinates.length>1)L.circleMarker([coordinates[1],coordinates[0]],{pane:'smokePane',radius:5,color:'#5a2811',weight:2,fillColor:'#fff',fillOpacity:1}).bindPopup(html,{maxWidth:380}).addTo(groups.smoke);
    return !!(core||outer);
  }
  function renderSmoke(){
    groups.smoke.clearLayers();
    var summary=document.getElementById('smoke-summary'),en=smokeEnglish();
    updateSmokeProductLabel();
    if(period===30){summary.className='fw-smoke-summary';summary.innerHTML=en?'<strong>30-day hotspot history</strong><p>Transport polygons are disabled. This period is used only for historical hotspot detections and statistics.</p>':'<strong>Riwayat hotspot 30 hari</strong><p>Polygon transport dinonaktifkan. Periode ini hanya untuk deteksi dan statistik hotspot historis.</p>';return}
    if(period===7){if(!hotspotGeo||!window.turf){summary.className='fw-smoke-summary';summary.innerHTML=en?'<strong>Repeated fire sources · 7 days</strong><p>Source data are incomplete.</p>':'<strong>Sumber api berulang · 7 hari</strong><p>Data sumber belum lengkap.</p>';return}renderRepeatedSources(summary,en);return}
    if(transportLoading){summary.className='fw-smoke-summary';summary.innerHTML=en?'<strong>Loading multi-level GFS wind…</strong><p>The national grid is downloaded only when this layer is used, to keep the initial page light.</p>':'<strong>Memuat angin GFS multi-lapisan…</strong><p>Grid nasional baru diunduh saat layer ini digunakan agar pemuatan awal halaman tetap ringan.</p>';return}
    if(!hotspotGeo||!transportReady||!smokeModel||!windIndex||!window.turf){
      summary.className='fw-smoke-summary';
      summary.innerHTML=en?'<strong>Experimental smoke-transport polygons</strong><p>Cannot be reconstructed: hotspot, geometry, or multi-level GFS wind data are incomplete.</p>':'<strong>Polygon transport asap eksperimental</strong><p>Belum dapat direkonstruksi: data hotspot, geometri, atau angin GFS multi-lapisan belum lengkap.</p>';
      return;
    }
    if(observationDate!==currentDate){summary.className='fw-smoke-summary';summary.innerHTML=en?'<strong>Experimental smoke-transport polygons</strong><p>The reconstruction is available only for the current date because historical multi-level wind has not been loaded.</p>':'<strong>Polygon transport asap eksperimental</strong><p>Rekonstruksi hanya tersedia untuk tanggal hari ini karena angin historis multi-lapisan belum dimuat.</p>';return}
    var detections=smokeDetections(),modelHours=period==='latest'?6:24;
    if(!detections.length){
      summary.className='fw-smoke-summary';
      summary.innerHTML=en?'<strong>No transport source in the '+modelHours+'-hour window</strong><p>No high-confidence vegetation-fire detection was found. This does not mean the air is smoke-free.</p>':'<strong>Tidak ada sumber transport dalam jendela '+modelHours+' jam</strong><p>Tidak ditemukan deteksi kebakaran vegetasi berkeyakinan tinggi. Ini tidak berarti udara bebas asap.</p>';
      return;
    }
    var sources=smokeModel.clusterSources(detections,{spatialKm:1.5,temporalMinutes:90}),trajectories=smokeModel.buildTrajectories(sources,windIndex,periodEnd().getTime(),{maxHours:modelHours}),rendered=0;
    sources.forEach(function(source,sourceIndex){var members=trajectories.filter(function(trajectory){return trajectory.sourceIndex===sourceIndex});if(members.length&&renderSourceEnvelope(source,members,en))rendered+=1});
    if(!trajectories.length||!rendered){summary.className='fw-smoke-summary';summary.innerHTML=en?'<strong>Experimental smoke-transport polygons</strong><p>No polygon could be reconstructed within the available GFS grid and time window.</p>':'<strong>Polygon transport asap eksperimental</strong><p>Tidak ada polygon yang dapat direkonstruksi dalam cakupan grid dan waktu GFS yang tersedia.</p>';return}
    summary.className='fw-smoke-summary';
    summary.innerHTML=en?'<strong>Experimental polygons · '+modelHours+'-hour source window</strong><p>'+rendered+' cumulative transport polygons from '+sources.length+' observation clusters ('+detections.length+' raw detections), using '+trajectories.length+' height-sensitive paths. Solid fill is the primary model zone; the dashed outer fill is the uncertainty boundary. GFS grid sampled every 1.5° and interpolated in space and time; data coverage '+transportCoverage+'%. Model time: '+esc(transportTime||'latest')+' WIB.</p>':'<strong>Polygon eksperimental · jendela sumber '+modelHours+' jam</strong><p>'+rendered+' polygon koridor kumulatif dari '+sources.length+' kelompok observasi ('+detections.length+' deteksi mentah), menggunakan '+trajectories.length+' lintasan sensitif-ketinggian. Isian pekat adalah zona utama model; isian luar bergaris putus adalah batas ketidakpastian. Grid GFS disampel setiap 1,5° dan diinterpolasi ruang–waktu; cakupan data '+transportCoverage+'%. Waktu model: '+esc(transportTime||'terbaru')+' WIB.</p>';
  }
  function fetchTransportChunk(points){
    var lats=points.map(function(p){return p[0]}).join(','),lons=points.map(function(p){return p[1]}).join(','),variables='wind_speed_950hPa,wind_direction_950hPa,wind_speed_925hPa,wind_direction_925hPa,wind_speed_850hPa,wind_direction_850hPa';
    var url='https://api.open-meteo.com/v1/gfs?latitude='+lats+'&longitude='+lons+'&hourly='+variables+'&past_days=1&forecast_days=1&timezone=Asia%2FJakarta';
    return fetch(url).then(function(r){if(!r.ok)throw Error('multi-level GFS wind');return r.json()}).then(function(data){var rows=Array.isArray(data)?data:[data];return rows.map(function(row,i){var h=row.hourly||{},point=points[i]||points[0];return {gridLat:point[0],gridLon:point[1],times:(h.time||[]).map(function(t){return new Date(t+'+07:00').getTime()}),levels:{'950':{speeds:h.wind_speed_950hPa||[],directions:h.wind_direction_950hPa||[]},'925':{speeds:h.wind_speed_925hPa||[],directions:h.wind_direction_925hPa||[]},'850':{speeds:h.wind_speed_850hPa||[],directions:h.wind_direction_850hPa||[]}}}})})
  }
  function loadReferenceWind(){
    var lats=weatherSites.map(function(site){return site[1]}).join(','),lons=weatherSites.map(function(site){return site[2]}).join(',');
    var url='https://api.open-meteo.com/v1/gfs?latitude='+lats+'&longitude='+lons+'&current=wind_speed_925hPa,wind_direction_925hPa&timezone=Asia%2FJakarta';
    return fetch(url).then(function(r){if(!r.ok)throw Error('reference GFS wind');return r.json()}).then(function(data){var rows=Array.isArray(data)?data:[data];groups.wind.clearLayers();rows.forEach(function(row,i){var current=row.current||{},site=weatherSites[i]||weatherSites[0],speed=Number(current.wind_speed_925hPa),direction=Number(current.wind_direction_925hPa);if(!Number.isFinite(speed)||!Number.isFinite(direction))return;var travel=(direction+180)%360;transportTime=current.time||transportTime;var icon=L.divIcon({className:'wind-icon',html:'<span style="display:block;transform:rotate('+travel+'deg)">↑</span>',iconSize:[30,30],iconAnchor:[15,15]});L.marker([site[1],site[2]],{icon:icon}).bindPopup('<strong>Angin referensi GFS 925 hPa '+esc(site[0])+'</strong><br>Bergerak ke '+Math.round(travel)+'° · '+Math.round(speed)+' km/j<br><small>'+esc(current.time||'waktu model terbaru')+' WIB · titik referensi, bukan grid lintasan</small>').addTo(groups.wind)})}).catch(function(){groups.wind.clearLayers()})
  }
  function loadTransportWeather(){
    if(!smokeModel)return Promise.reject(Error('smoke transport model unavailable'));
    var grid=smokeModel.buildGrid({minLat:-11.2,maxLat:6.2,minLon:94.5,maxLon:141.5},1.5),chunks=[];for(var i=0;i<grid.length;i+=55)chunks.push(grid.slice(i,i+55));
    var collected=[];
    function loadBatch(index){if(index>=chunks.length)return Promise.resolve();var batch=chunks.slice(index,index+3).map(function(points){return fetchTransportChunk(points).catch(function(){return []})});return Promise.all(batch).then(function(rows){rows.forEach(function(items){collected=collected.concat(items)});return loadBatch(index+3)})}
    return loadBatch(0).then(function(){
      transportReadings=collected;transportCoverage=Math.round(100*transportReadings.length/grid.length);windIndex=smokeModel.buildWindIndex(transportReadings,1.5);transportReady=transportReadings.length>0&&transportCoverage>=60;
      var now=periodEnd().getTime();
      var firstTimes=transportReadings[0]&&transportReadings[0].times||[],nearestTime=firstTimes.reduce(function(best,t){return best==null||Math.abs(t-now)<Math.abs(best-now)?t:best},null);transportTime=nearestTime?new Date(nearestTime).toLocaleString('sv-SE',{timeZone:'Asia/Jakarta'}).replace(' ','T'):'';
      if(!transportReady)throw Error('insufficient GFS grid coverage')
    }).catch(function(error){transportReady=false;transportReadings=[];windIndex=null;transportCoverage=0;throw error})
  }
  function ensureTransportWeather(){
    if(transportReady)return Promise.resolve();
    if(transportPromise)return transportPromise;
    transportLoading=true;renderSmoke();
    transportPromise=loadTransportWeather().then(function(){transportLoading=false;transportPromise=null;renderSmoke()}).catch(function(){transportLoading=false;transportPromise=null;renderSmoke()});
    return transportPromise;
  }
  function requestTransportIfNeeded(){
    if((period==='latest'||period===1)&&observationDate===currentDate&&map.hasLayer(groups.smoke)&&!transportReady)ensureTransportWeather();
  }
  function loadWeather(){
    var sites=weatherSites,lat=sites.map(function(s){return s[1]}).join(','),lon=sites.map(function(s){return s[2]}).join(',');
    var url='https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m&timezone=Asia%2FJakarta';
    return fetch(url).then(function(r){if(!r.ok)throw Error('weather');return r.json()}).then(function(d){var rows=Array.isArray(d)?d:[d];weatherReadings=[];rows.forEach(function(row,i){var c=row.current||{},site=sites[i]||sites[0];weatherReadings.push({name:site[0],lat:site[1],lon:site[2],speed:Number(c.wind_speed_10m)||0,direction:Number(c.wind_direction_10m)||0,rain:Number(c.precipitation)||0,time:c.time||''})});weatherReady=weatherReadings.length>0;var riau=rows[1]&&rows[1].current||{};document.getElementById('kpi-weather').textContent=riau.temperature_2m==null?'—':Math.round(riau.temperature_2m)+'°C';document.getElementById('weather-detail').textContent='Riau · '+(riau.precipitation||0)+' mm · angin permukaan '+Math.round(riau.wind_speed_10m||0)+' km/j'}).catch(function(){weatherReady=false;document.getElementById('kpi-weather').textContent='Tidak tersedia';document.getElementById('weather-detail').textContent='Layanan cuaca gagal dimuat'})
  }
  function toggleRain(on){var status=document.getElementById('rain-status');if(!on){groups.rain.clearLayers();rainLayer=null;if(status)status.textContent='Aktifkan layer untuk melihat citra radar hujan terbaru.';return}var msg=document.getElementById('map-message');msg.hidden=false;msg.textContent='Memuat kondisi hujan saat ini…';if(status)status.textContent='Memuat waktu citra radar terbaru…';fetch('https://api.rainviewer.com/public/weather-maps.json').then(function(r){if(!r.ok)throw Error('rain radar');return r.json()}).then(function(d){var frames=d.radar&&d.radar.past||[],f=frames[frames.length-1];if(!f)throw Error('no frame');groups.rain.clearLayers();rainLayer=L.tileLayer('https://tilecache.rainviewer.com'+f.path+'/256/{z}/{x}/{y}/2/1_1.png',{opacity:.55,maxNativeZoom:7,maxZoom:18,attribution:'RainViewer · citra radar terbaru'}).addTo(groups.rain);var observed=new Date(Number(f.time)*1000),timeText=!isNaN(observed)?observed.toLocaleString('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'})+' WIB':'waktu terbaru tersedia';if(status)status.textContent='Citra radar: '+timeText+'. Menunjukkan kondisi sekitar waktu tersebut, bukan akumulasi hujan.';msg.hidden=true}).catch(function(){if(status)status.textContent='Radar hujan saat ini belum tersedia. Jangan gunakan layer ini untuk menyimpulkan kondisi hujan.';msg.hidden=false;msg.textContent='Radar hujan saat ini sedang tidak tersedia';setTimeout(function(){msg.hidden=true},4000)})}
  function setLayerChecked(id,on){var c=document.querySelector('[data-layer="'+id+'"]');if(c)c.checked=on;if(id==='rain'){toggleRain(on);if(on&&!map.hasLayer(groups.rain))groups.rain.addTo(map);return}if(on){if(!map.hasLayer(groups[id]))groups[id].addTo(map)}else if(map.hasLayer(groups[id]))map.removeLayer(groups[id]);if(id==='smoke'&&on){renderSmoke();requestTransportIfNeeded()}}
  function selectProduct(id){document.querySelectorAll('[data-product]').forEach(function(b){b.classList.toggle('active',b.dataset.product===id)});if(id==='hotspots'){setLayerChecked('hotspots',true)}if(id==='wind'){setLayerChecked('wind',true)}if(id==='rain'){setLayerChecked('rain',true)}if(id==='smoke'){setLayerChecked('smoke',true);setLayerChecked('hotspots',false);setLayerChecked('wind',true)}}
  function observationLabel(value){
    return new Date(value+'T12:00:00+07:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'});
  }
  function updateHotspotFreshness(){
    var generated=hotspotGeo&&hotspotGeo.generatedAt?new Date(hotspotGeo.generatedAt):null;
    var age=generated&&!isNaN(generated)?Math.max(0,Date.now()-generated.getTime()):Infinity;
    var hours=age/3600000;
    if(hotspotGeo&&hotspotGeo.sourceStatus==='partial')hotspotStatusText='Peringatan · data FIRMS parsial';
    else if(hours>6)hotspotStatusText='Peringatan · data FIRMS terlambat';
    else hotspotStatusText='Near real-time · high confidence';
    document.getElementById('data-status').textContent=observationDate===currentDate?hotspotStatusText:'Arsip harian';
    document.getElementById('updated-at').textContent=generated&&!isNaN(generated)?'FIRMS: '+generated.toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB · pembaruan tiap jam':'FIRMS belum diperbarui';
  }
  function updateMapDateBadge(){
    if(!mapDateBadge)return;
    var isToday=observationDate===currentDate;
    mapDateBadge.querySelector('strong').textContent=observationLabel(observationDate);
    mapDateBadge.querySelector('small').textContent=isToday?'Mosaik harian · data hari ini mungkin masih parsial':'Mosaik harian · arsip tanggal terpilih';
  }
  function updateObservationDate(value){
    observationDate=value;satelliteLayer.setParams({time:value});
    var isToday=value===currentDate,label=observationLabel(value);
    document.getElementById('condition-title').textContent='Pengamatan satelit '+label+(isToday?' · sementara':'');
    document.getElementById('condition-copy').textContent=isToday?'Data hari ini diperbarui bertahap mengikuti lintasan satelit; area kosong belum tentu berarti tidak ada asap atau hotspot.':'Arsip pengamatan pada tanggal yang dipilih. Hanya hotspot berkeyakinan tinggi yang dipakai untuk prioritas.';
    document.getElementById('data-status').textContent=isToday?hotspotStatusText:'Arsip harian';
    updateMapDateBadge();
  }
  function addMapBadge(){var badge=L.control({position:'bottomleft'});badge.onAdd=function(){var div=L.DomUtil.create('div','fw-layer-badge');div.innerHTML='<strong>HOTSPOT INTERAKTIF: INDONESIA</strong><span>High confidence · rekap desa khusus wilayah YG</span>';return div};badge.addTo(map)}
  function addMapDateBadge(){var badge=L.control({position:'topright'});badge.onAdd=function(){var div=L.DomUtil.create('div','fw-map-date-badge');div.setAttribute('aria-label','Tanggal citra satelit MODIS');div.innerHTML='<span>CITRA MODIS TERRA</span><strong>—</strong><small>Mosaik harian</small>';mapDateBadge=div;updateMapDateBadge();return div};badge.addTo(map)}
  addMapBadge();
  addMapDateBadge();
  Promise.all([fetch('data/desa_intervensi.geojson').then(function(r){return r.json()}),fetch('data/village-forest-analytics.json').then(function(r){return r.json()}),fetch('data/hotspot-high-confidence.geojson?v='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('hotspot');return r.json()}),fetch('data/indonesia-boundary.geojson').then(function(r){if(!r.ok)throw Error('batas daratan');return r.json()}),pointLayer('data/fdrs.geojson',groups.fdrs,'fdrs','FDRS'),pointLayer('data/sekat_kanal.geojson',groups.canals,'canal','Sekat kanal'),loadWeather(),loadReferenceWind()]).then(function(v){villageGeo=v[0];analytics=v[1];hotspotGeo=v[2];var landFeature=v[3]&&v[3].features&&v[3].features[0],before=(hotspotGeo.features||[]).length;hotspotGeo.features=(hotspotGeo.features||[]).filter(function(f){return !smokeModel||smokeModel.isVegetationOrUnclassified(f)});if(landFeature&&landFeature.geometry){hotspotGeo.features=(hotspotGeo.features||[]).filter(function(f){return f.geometry&&pointInGeometry(f.geometry.coordinates,landFeature.geometry)});hotspotGeo.offshoreFiltered=before-hotspotGeo.features.length}document.getElementById('kpi-fdrs').textContent=v[4];document.getElementById('kpi-canals').textContent=v[5];updateHotspotFreshness();refreshHotspots();renderSmoke()}).catch(function(){hotspotStatusText='Data hotspot gagal dimuat';document.getElementById('data-status').textContent=hotspotStatusText;document.getElementById('updated-at').textContent='Periksa koneksi atau pembaruan FIRMS';renderSmoke()});
  document.getElementById('period-control').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;period=b.dataset.period==='latest'?'latest':Number(b.dataset.period);this.querySelectorAll('button').forEach(function(x){x.classList.toggle('active',x===b)});document.getElementById('kpi-period').textContent=b.textContent;refreshHotspots();renderSmoke();requestTransportIfNeeded()});
  document.querySelectorAll('[data-layer]').forEach(function(c){c.addEventListener('change',function(){setLayerChecked(c.dataset.layer,c.checked)})});
  document.querySelectorAll('[data-product]').forEach(function(b){b.addEventListener('click',function(){selectProduct(b.dataset.product)})});
  dateInput.addEventListener('change',function(){if(dateInput.value){if(dateInput.value>currentDate)dateInput.value=currentDate;updateObservationDate(dateInput.value);refreshHotspots();renderSmoke();requestTransportIfNeeded()}});updateObservationDate(observationDate);
  document.getElementById('zoom-id').onclick=function(){map.fitBounds(indonesiaBounds,{padding:[8,8]})};
  document.getElementById('zoom-yg').onclick=function(){if(ygBounds&&ygBounds.isValid())map.fitBounds(ygBounds.pad(.08))};
  window.addEventListener('yg:languagechange',function(){renderSmoke()});
})();
