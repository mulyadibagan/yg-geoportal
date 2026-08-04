(function(){
  'use strict';
  var indonesiaBounds=L.latLngBounds([[-11.2,94.5],[6.2,141.5]]);
  var map=L.map('fire-map',{preferCanvas:true,minZoom:3}).fitBounds(indonesiaBounds,{padding:[8,8]});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap'}).addTo(map);
  map.createPane('hazePane');map.getPane('hazePane').style.zIndex=310;
  map.createPane('hotspotPane');map.getPane('hotspotPane').style.zIndex=420;

  function gibs(id,matrix,options){
    return L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/'+id+'/default/default/'+matrix+'/{z}/{y}/{x}.png',Object.assign({maxNativeZoom:Number(matrix.match(/\d+$/)[0]),maxZoom:18,noWrap:true,attribution:'NASA GIBS'},options||{}));
  }
  var nationalHotspots=L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',{
    layers:'VIIRS_NOAA20_Thermal_Anomalies_375m_All',format:'image/png',transparent:true,
    pane:'hotspotPane',opacity:.9,attribution:'NASA GIBS / VIIRS'
  });
  var hazeLayer=gibs('MODIS_Combined_MAIAC_L2G_AerosolOpticalDepth','GoogleMapsCompatible_Level7',{pane:'hazePane',opacity:.58});
  var groups={
    haze:L.layerGroup([hazeLayer]).addTo(map),
    hotspots:L.layerGroup([nationalHotspots]).addTo(map),
    villages:L.layerGroup().addTo(map),rain:L.layerGroup(),wind:L.layerGroup().addTo(map),
    fdrs:L.layerGroup().addTo(map),canals:L.layerGroup().addTo(map)
  };
  var villageGeo=null,analytics=null,ygBounds=null,period=30,rainLayer=null;
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
  function nameOf(p){return p.Desa||p.WADMKD||p.Nama_Desa||p.NAMOBJ||'Desa intervensi'}
  function recordFor(p){var n=norm(nameOf(p)),all=analytics&&analytics.villages||{};return Object.keys(all).map(function(k){return all[k]}).find(function(r){return norm(r.name||r.village)===n})||null}
  function countFor(r){if(!r)return 0;if(period===30)return Number(r.hotspot30d)||0;if(period===7)return Number(r.hotspot7d)||0;return 0}
  function risk(c){return c>5?'high':c>2?'medium':c>0?'low':'zero'}
  function color(c){return {zero:'#72bd86',low:'#f2ca52',medium:'#ef8f27',high:'#d6402b'}[risk(c)]}
  function renderVillages(){
    groups.villages.clearLayers();if(!villageGeo||!analytics)return;
    var alerts=[],total=0;
    var layer=L.geoJSON(villageGeo,{style:function(f){var c=countFor(recordFor(f.properties||{}));return {color:'#31584b',weight:1,fillColor:color(c),fillOpacity:.48}},onEachFeature:function(f,l){var p=f.properties||{},r=recordFor(p),c=countFor(r);total+=c;if(c)alerts.push({name:nameOf(p),count:c,layer:l,risk:risk(c)});l.bindPopup('<strong>'+esc(nameOf(p))+'</strong><br>'+c+' hotspot · '+(period===30?'30 hari':period===7?'7 hari':period===1?'24 jam':'terbaru')+'<br><small>Analitik desa YG · NASA FIRMS/VIIRS</small>')}}).addTo(groups.villages);
    ygBounds=layer.getBounds();document.getElementById('kpi-hotspots').textContent=total;document.getElementById('kpi-alerts').textContent=alerts.length;renderAlerts(alerts)
  }
  function renderAlerts(items){
    items.sort(function(a,b){return b.count-a.count});var box=document.getElementById('alert-list');document.getElementById('alert-count').textContent=items.length;
    if(!items.length){box.innerHTML='<p class="empty">Tidak ada hotspot tercatat pada periode ini di desa intervensi.</p>';return}
    box.innerHTML=items.map(function(x,i){return '<article class="fw-alert-card '+x.risk+'"><button type="button" data-alert="'+i+'"><strong>'+esc(x.name)+'</strong><span>'+x.count+' hotspot · klik untuk melihat peta</span></button></article>'}).join('');
    box.querySelectorAll('[data-alert]').forEach(function(b){b.onclick=function(){var x=items[Number(b.dataset.alert)];map.fitBounds(x.layer.getBounds(),{maxZoom:13});x.layer.openPopup()}})
  }
  function pointLayer(url,group,kind,label){return fetch(url).then(function(r){return r.json()}).then(function(g){L.geoJSON(g,{pointToLayer:function(f,ll){return L.marker(ll,{icon:L.divIcon({className:'',html:'<div class="fw-point '+kind+'"></div>',iconSize:[14,14],iconAnchor:[7,7]})})},onEachFeature:function(f,l){var p=f.properties||{};l.bindPopup('<strong>'+esc(p.Nama_Objek||label)+'</strong><br>'+esc(p.Desa||'')+' · '+esc(p.Tahun||''))}}).addTo(group);return (g.features||[]).length})}
  function loadWeather(){
    var sites=[['Aceh',5.55,95.32],['Riau',1.45,102.1],['Sumatera Selatan',-3.0,104.8],['Jakarta',-6.2,106.8],['Kalimantan Barat',-.1,109.3],['Kalimantan Tengah',-2.2,113.9],['Kalimantan Timur',.5,117.1],['Sulawesi',-2.0,121.0],['Bali',-8.4,115.2],['Maluku',-3.2,129.0],['Papua Selatan',-7.5,139.5],['Papua Utara',-2.5,140.7]];
    var lat=sites.map(function(s){return s[1]}).join(','),lon=sites.map(function(s){return s[2]}).join(',');
    var url='https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m&timezone=Asia%2FJakarta';
    return fetch(url).then(function(r){if(!r.ok)throw Error('weather');return r.json()}).then(function(d){var rows=Array.isArray(d)?d:[d];groups.wind.clearLayers();rows.forEach(function(row,i){var c=row.current||{},site=sites[i]||sites[0],dir=Number(c.wind_direction_10m)||0;var icon=L.divIcon({className:'wind-icon',html:'<span style="display:block;transform:rotate('+dir+'deg)">↑</span>',iconSize:[30,30],iconAnchor:[15,15]});L.marker([site[1],site[2]],{icon:icon}).bindPopup('<strong>Angin '+esc(site[0])+'</strong><br>'+Math.round(c.wind_speed_10m||0)+' km/j · '+Math.round(dir)+'°<br>Hujan '+(c.precipitation||0)+' mm<br><small>'+esc(c.time||'')+' WIB · Open-Meteo</small>').addTo(groups.wind)});var riau=rows[1]&&rows[1].current||{};document.getElementById('kpi-weather').textContent=riau.temperature_2m==null?'—':Math.round(riau.temperature_2m)+'°C';document.getElementById('weather-detail').textContent='Riau · '+(riau.precipitation||0)+' mm · angin '+Math.round(riau.wind_speed_10m||0)+' km/j'}).catch(function(){document.getElementById('kpi-weather').textContent='Tidak tersedia';document.getElementById('weather-detail').textContent='Layanan cuaca gagal dimuat'})
  }
  function toggleRain(on){if(!on){groups.rain.clearLayers();rainLayer=null;return}var msg=document.getElementById('map-message');msg.hidden=false;msg.textContent='Memuat radar hujan…';fetch('https://api.rainviewer.com/public/weather-maps.json').then(function(r){return r.json()}).then(function(d){var frames=d.radar&&d.radar.past||[],f=frames[frames.length-1];if(!f)throw Error('no frame');groups.rain.clearLayers();rainLayer=L.tileLayer('https://tilecache.rainviewer.com'+f.path+'/256/{z}/{x}/{y}/2/1_1.png',{opacity:.55,attribution:'RainViewer'}).addTo(groups.rain);msg.hidden=true}).catch(function(){msg.hidden=false;msg.textContent='Radar hujan sedang tidak tersedia';setTimeout(function(){msg.hidden=true},4000)})}
  function addMapBadge(){var badge=L.control({position:'bottomleft'});badge.onAdd=function(){var div=L.DomUtil.create('div','fw-layer-badge');div.innerHTML='<strong>CAKUPAN INDONESIA</strong><span>Hotspot VIIRS + indikasi haze MODIS AOD</span>';return div};badge.addTo(map)}
  nationalHotspots.on('tileerror',function(){document.getElementById('data-status').textContent='Sebagian tersedia'});hazeLayer.on('tileerror',function(){document.getElementById('data-status').textContent='Sebagian tersedia'});addMapBadge();
  Promise.all([fetch('data/desa_intervensi.geojson').then(function(r){return r.json()}),fetch('data/village-forest-analytics.json').then(function(r){return r.json()}),pointLayer('data/fdrs.geojson',groups.fdrs,'fdrs','FDRS'),pointLayer('data/sekat_kanal.geojson',groups.canals,'canal','Sekat kanal'),loadWeather()]).then(function(v){villageGeo=v[0];analytics=v[1];document.getElementById('kpi-fdrs').textContent=v[2];document.getElementById('kpi-canals').textContent=v[3];var u=analytics.viirs&&analytics.viirs.updatedAt;document.getElementById('updated-at').textContent=u?'Analitik YG: '+new Date(u).toLocaleString('id-ID'):'Layer nasional: terbaru tersedia';document.getElementById('data-status').textContent=analytics.viirs&&analytics.viirs.status==='partial'?'Nasional aktif · YG sebagian':'Data nasional aktif';renderVillages()}).catch(function(){document.getElementById('data-status').textContent='Sebagian gagal dimuat'});
  document.getElementById('period-control').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;period=b.dataset.period==='latest'?'latest':Number(b.dataset.period);this.querySelectorAll('button').forEach(function(x){x.classList.toggle('active',x===b)});document.getElementById('kpi-period').textContent=b.textContent;var approximate=period===1||period==='latest';document.getElementById('period-note').textContent=approximate?'Analitik desa YG belum memisahkan periode ini. Layer nasional tetap menampilkan observasi harian terbaru.':'Periode mengubah analitik desa YG; layer nasional menampilkan observasi harian terbaru.';renderVillages()});
  document.querySelectorAll('[data-layer]').forEach(function(c){c.addEventListener('change',function(){var id=c.dataset.layer;if(id==='rain'){toggleRain(c.checked);return}if(c.checked)groups[id].addTo(map);else map.removeLayer(groups[id])})});
  document.getElementById('zoom-id').onclick=function(){map.fitBounds(indonesiaBounds,{padding:[8,8]})};
  document.getElementById('zoom-yg').onclick=function(){if(ygBounds&&ygBounds.isValid())map.fitBounds(ygBounds.pad(.08))};
  document.getElementById('wind-level').onchange=function(e){var note=document.getElementById('map-message');if(e.target.value==='800'){note.hidden=false;note.textContent='Angin ±2.500 kaki memerlukan layer model tekanan; sementara ditampilkan angin permukaan.';setTimeout(function(){note.hidden=true},5000)}};
})();
