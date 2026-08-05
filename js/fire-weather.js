(function(){
  'use strict';
  var indonesiaBounds=L.latLngBounds([[-11.2,94.5],[6.2,141.5]]);
  var map=L.map('fire-map',{preferCanvas:true,minZoom:3}).fitBounds(indonesiaBounds,{padding:[8,8]});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap'}).addTo(map);
  map.createPane('satellitePane');map.getPane('satellitePane').style.zIndex=205;
  map.createPane('hotspotPane');map.getPane('hotspotPane').style.zIndex=420;

  function gibs(id,matrix,options){
    return L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/'+id+'/default/default/'+matrix+'/{z}/{y}/{x}.png',Object.assign({maxNativeZoom:Number(matrix.match(/\d+$/)[0]),maxZoom:18,noWrap:true,attribution:'NASA GIBS'},options||{}));
  }
  var dateInput=document.getElementById('observation-date');
  function jakartaDate(){
    var parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    var values={};parts.forEach(function(p){values[p.type]=p.value});return values.year+'-'+values.month+'-'+values.day
  }
  var currentDate=jakartaDate(),observationDate=currentDate;dateInput.value=observationDate;dateInput.max=currentDate;
  var satelliteLayer=L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',{layers:'MODIS_Terra_CorrectedReflectance_TrueColor',format:'image/jpeg',transparent:false,pane:'satellitePane',opacity:.72,time:observationDate,attribution:'NASA GIBS / MODIS Terra'});
  var groups={
    hotspots:L.layerGroup().addTo(map),satellite:L.layerGroup([satelliteLayer]),
    villages:L.layerGroup().addTo(map),rain:L.layerGroup(),wind:L.layerGroup().addTo(map),
    fdrs:L.layerGroup().addTo(map),canals:L.layerGroup().addTo(map)
  };
  var villageGeo=null,analytics=null,hotspotGeo=null,ygBounds=null,period=30,rainLayer=null;
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function nameOf(p){return p.Desa||p.WADMKD||p.Nama_Desa||p.NAMOBJ||'Desa intervensi'}
  function pointTime(f){var p=f.properties||{},t=String(p.acq_time||'0000').padStart(4,'0');return new Date(p.acq_date+'T'+t.slice(0,2)+':'+t.slice(2,4)+':00Z')}
  function periodLabel(){return period==='latest'?'terbaru':period===1?'24 jam':period+' hari'}
  function filteredHotspots(){var end=new Date(observationDate+'T23:59:59+07:00'),items=(hotspotGeo&&hotspotGeo.features||[]).filter(function(f){var t=pointTime(f);return !isNaN(t)&&t<=end});if(period==='latest'){var newest=items.reduce(function(m,f){return Math.max(m,pointTime(f).getTime())},0),day=newest?new Date(newest).toISOString().slice(0,10):'';return items.filter(function(f){return pointTime(f).toISOString().slice(0,10)===day})}var cutoff=end.getTime()-Number(period)*86400000;return items.filter(function(f){return pointTime(f).getTime()>cutoff})}
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
  function renderHotspots(){groups.hotspots.clearLayers();var items=filteredHotspots();items.forEach(function(f){var p=f.properties||{},t=pointTime(f),c=f.geometry.coordinates,when=isNaN(t)?'Waktu tidak tersedia':t.toLocaleString('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'})+' WIB',html='<strong>Hotspot confidence tinggi</strong><br>'+when+'<br>Satelit: '+esc(p.satellite||'—')+'<br>Koordinat: '+Number(c[1]).toFixed(5)+', '+Number(c[0]).toFixed(5);if(p.brightness!=null)html+='<br>Suhu kecerahan: '+Number(p.brightness).toFixed(1)+' K';if(p.frp!=null)html+='<br>FRP: '+Number(p.frp).toFixed(1)+' MW';html+='<br><small>NASA FIRMS · klik titik lain untuk melihat datanya</small>';L.circleMarker([c[1],c[0]],{pane:'hotspotPane',radius:6,color:'#7f1d1d',weight:1,fillColor:'#ef2b2d',fillOpacity:.9}).bindPopup(html).addTo(groups.hotspots)});document.getElementById('period-note').textContent=items.length+' titik high confidence · '+periodLabel()}
  function refreshHotspots(){renderHotspots();renderVillages()}
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
  function toggleRain(on){if(!on){groups.rain.clearLayers();rainLayer=null;return}var msg=document.getElementById('map-message');msg.hidden=false;msg.textContent='Memuat radar hujan…';fetch('https://api.rainviewer.com/public/weather-maps.json').then(function(r){return r.json()}).then(function(d){var frames=d.radar&&d.radar.past||[],f=frames[frames.length-1];if(!f)throw Error('no frame');groups.rain.clearLayers();rainLayer=L.tileLayer('https://tilecache.rainviewer.com'+f.path+'/256/{z}/{x}/{y}/2/1_1.png',{opacity:.55,maxNativeZoom:7,maxZoom:18,attribution:'RainViewer'}).addTo(groups.rain);msg.hidden=true}).catch(function(){msg.hidden=false;msg.textContent='Radar hujan sedang tidak tersedia';setTimeout(function(){msg.hidden=true},4000)})}
  function setLayerChecked(id,on){var c=document.querySelector('[data-layer="'+id+'"]');if(c)c.checked=on;if(id==='rain'){toggleRain(on);if(on&&!map.hasLayer(groups.rain))groups.rain.addTo(map);return}if(on){if(!map.hasLayer(groups[id]))groups[id].addTo(map)}else if(map.hasLayer(groups[id]))map.removeLayer(groups[id])}
  function selectProduct(id){document.querySelectorAll('[data-product]').forEach(function(b){b.classList.toggle('active',b.dataset.product===id)});if(id==='hotspots'){setLayerChecked('hotspots',true)}if(id==='wind'){setLayerChecked('wind',true)}if(id==='rain'){setLayerChecked('rain',true)}if(id==='satellite'){setLayerChecked('satellite',true);setLayerChecked('hotspots',true);setLayerChecked('wind',true)}}
  function updateObservationDate(value){
    observationDate=value;satelliteLayer.setParams({time:value});
    var isToday=value===currentDate,label=new Date(value+'T12:00:00+07:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'});
    document.getElementById('condition-title').textContent='Pengamatan satelit '+label+(isToday?' · sementara':'');
    document.getElementById('condition-copy').textContent=isToday?'Data hari ini diperbarui bertahap mengikuti lintasan satelit; area kosong belum tentu berarti tidak ada asap atau hotspot.':'Arsip pengamatan pada tanggal yang dipilih. Hanya hotspot berkeyakinan tinggi yang dipakai untuk prioritas.';
    document.getElementById('data-status').textContent=isToday?'Hari ini · data parsial':'Arsip harian';
  }
  function addMapBadge(){var badge=L.control({position:'bottomleft'});badge.onAdd=function(){var div=L.DomUtil.create('div','fw-layer-badge');div.innerHTML='<strong>HOTSPOT INTERAKTIF: RIAU</strong><span>High confidence · rekap desa khusus wilayah YG</span>';return div};badge.addTo(map)}
  addMapBadge();
  Promise.all([fetch('data/desa_intervensi.geojson').then(function(r){return r.json()}),fetch('data/village-forest-analytics.json').then(function(r){return r.json()}),fetch('data/hotspot-high-confidence.geojson').then(function(r){if(!r.ok)throw Error('hotspot');return r.json()}),pointLayer('data/fdrs.geojson',groups.fdrs,'fdrs','FDRS'),pointLayer('data/sekat_kanal.geojson',groups.canals,'canal','Sekat kanal'),loadWeather()]).then(function(v){villageGeo=v[0];analytics=v[1];hotspotGeo=v[2];document.getElementById('kpi-fdrs').textContent=v[3];document.getElementById('kpi-canals').textContent=v[4];var u=hotspotGeo.generatedAt||(analytics.viirs&&analytics.viirs.updatedAt);document.getElementById('updated-at').textContent=u?'FIRMS: '+new Date(u).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB':'FIRMS belum diperbarui';document.getElementById('data-status').textContent=observationDate===currentDate?'Hari ini · data parsial':'Arsip harian aktif';refreshHotspots()}).catch(function(){document.getElementById('data-status').textContent='Data hotspot gagal dimuat'});
  document.getElementById('period-control').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;period=b.dataset.period==='latest'?'latest':Number(b.dataset.period);this.querySelectorAll('button').forEach(function(x){x.classList.toggle('active',x===b)});document.getElementById('kpi-period').textContent=b.textContent;refreshHotspots()});
  document.querySelectorAll('[data-layer]').forEach(function(c){c.addEventListener('change',function(){var id=c.dataset.layer;if(id==='rain'){toggleRain(c.checked);return}if(c.checked)groups[id].addTo(map);else map.removeLayer(groups[id])})});
  document.querySelectorAll('[data-product]').forEach(function(b){b.addEventListener('click',function(){selectProduct(b.dataset.product)})});
  dateInput.addEventListener('change',function(){if(dateInput.value){if(dateInput.value>currentDate)dateInput.value=currentDate;updateObservationDate(dateInput.value);refreshHotspots()}});updateObservationDate(observationDate);
  document.getElementById('zoom-id').onclick=function(){map.fitBounds(indonesiaBounds,{padding:[8,8]})};
  document.getElementById('zoom-yg').onclick=function(){if(ygBounds&&ygBounds.isValid())map.fitBounds(ygBounds.pad(.08))};
  document.getElementById('wind-level').onchange=function(e){var note=document.getElementById('map-message');if(e.target.value==='800'){note.hidden=false;note.textContent='Data angin 2.500 kaki belum tersedia; peta tetap menampilkan angin permukaan agar tidak memberi visual yang keliru.';e.target.value='10';setTimeout(function(){note.hidden=true},5000)}};
})();
