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
  var readingGuide=document.querySelector('.fw-disclaimer p');if(readingGuide)readingGuide.textContent='Poligon berwarna menunjukkan arah potensi sebaran dari hotspot mengikuti angin. Zona ini bukan batas asap teramati dan bukan pengganti pengukuran kualitas udara.';
  var satelliteLayer=L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',{layers:'MODIS_Terra_CorrectedReflectance_TrueColor',format:'image/jpeg',transparent:false,pane:'satellitePane',opacity:.72,time:observationDate,attribution:'NASA GIBS / MODIS Terra'});
  var groups={
    hotspots:L.layerGroup().addTo(map),satellite:L.layerGroup([satelliteLayer]),smoke:L.layerGroup(),
    villages:L.layerGroup().addTo(map),rain:L.layerGroup(),wind:L.layerGroup().addTo(map),
    fdrs:L.layerGroup().addTo(map),canals:L.layerGroup().addTo(map)
  };
  var villageGeo=null,analytics=null,hotspotGeo=null,ygBounds=null,period=30,rainLayer=null,mapDateBadge=null,hotspotStatusText='Memuat…',weatherReadings=[],weatherReady=false;
  var weatherSites=[['Aceh',5.55,95.32],['Riau',1.45,102.1],['Sumatera Selatan',-3.0,104.8],['Jakarta',-6.2,106.8],['Kalimantan Barat',-.1,109.3],['Kalimantan Tengah',-2.2,113.9],['Kalimantan Timur',.5,117.1],['Sulawesi',-2.0,121.0],['Bali',-8.4,115.2],['Maluku',-3.2,129.0],['Papua Selatan',-7.5,139.5],['Papua Utara',-2.5,140.7]];
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function nameOf(p){return p.Desa||p.WADMKD||p.Nama_Desa||p.NAMOBJ||'Desa intervensi'}
  function pointTime(f){var p=f.properties||{},t=String(p.acq_time||'0000').padStart(4,'0');return new Date(p.acq_date+'T'+t.slice(0,2)+':'+t.slice(2,4)+':00Z')}
  function periodLabel(){return period==='latest'?'tanggal data terbaru':period===1?(observationDate===currentDate?'24 jam bergulir':'24 jam sampai akhir tanggal'):period+' hari'}
  function periodEnd(){return observationDate===currentDate?new Date():new Date(observationDate+'T23:59:59+07:00')}
  function filteredHotspots(){var end=periodEnd(),items=(hotspotGeo&&hotspotGeo.features||[]).filter(function(f){var t=pointTime(f);return !isNaN(t)&&t<=end});if(period==='latest'){var newest=items.reduce(function(m,f){return Math.max(m,pointTime(f).getTime())},0),day=newest?new Date(newest).toISOString().slice(0,10):'';return items.filter(function(f){return pointTime(f).toISOString().slice(0,10)===day})}var cutoff=end.getTime()-Number(period)*86400000;return items.filter(function(f){return pointTime(f).getTime()>cutoff})}
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
  function destination(lat,lon,bearing,km){var r=6371,br=bearing*Math.PI/180,p1=lat*Math.PI/180,l1=lon*Math.PI/180,d=km/r,p2=Math.asin(Math.sin(p1)*Math.cos(d)+Math.cos(p1)*Math.sin(d)*Math.cos(br)),l2=l1+Math.atan2(Math.sin(br)*Math.sin(d)*Math.cos(p1),Math.cos(d)-Math.sin(p1)*Math.sin(p2));return [p2*180/Math.PI,l2*180/Math.PI]}
  function smokeClass(score){return score>=75?'very-high':score>=50?'high':score>=25?'watch':'low'}
  function smokeEnglish(){return !!(window.YG_I18N&&window.YG_I18N.language==='en')}
  function smokeLabel(score){return smokeEnglish()?(score>=75?'Very high':score>=50?'High':score>=25?'Watch':'Low'):(score>=75?'Sangat tinggi':score>=50?'Tinggi':score>=25?'Waspada':'Rendah')}
  function smokeColor(score){return score>=75?'#d6402b':score>=50?'#ef8f27':score>=25?'#f2ca52':'#54a96b'}
  function smokeHotspots(){var end=periodEnd(),cutoff=end.getTime()-86400000;return (hotspotGeo&&hotspotGeo.features||[]).filter(function(f){var t=pointTime(f);return !isNaN(t)&&t<=end&&t.getTime()>cutoff})}
  function smokeClusters(items){var buckets={};items.forEach(function(f){var c=f.geometry.coordinates,key=Math.floor((c[1]+12)/.75)+'|'+Math.floor((c[0]-94)/.75),p=f.properties||{};if(!buckets[key])buckets[key]={lat:0,lon:0,count:0,frp:0,times:[]};var b=buckets[key];b.lat+=c[1];b.lon+=c[0];b.count++;b.frp+=Math.max(0,Number(p.frp)||0);b.times.push(pointTime(f).getTime())});return Object.keys(buckets).map(function(key){var b=buckets[key];b.lat/=b.count;b.lon/=b.count;return b})}
  function smokePolygon(cluster,weather){var travel=(Number(weather.direction)||0)+180,speed=Math.max(0,Number(weather.speed)||0),rain=Math.max(0,Number(weather.rain)||0),fire=Math.min(45,Math.round(cluster.count*7+Math.log1p(cluster.frp)*6)),transport=Math.min(30,Math.round(5+speed*1.25)),rainScore=rain===0?15:rain<.5?10:rain<2?4:0,spread=Math.max.apply(null,cluster.times)-Math.min.apply(null,cluster.times),persistence=cluster.count>1&&spread>21600000?10:cluster.count>1?6:2,score=Math.min(100,fire+transport+rainScore+persistence),length=Math.max(35,Math.min(180,25+speed*5+Math.sqrt(cluster.frp)*3)),origin=[cluster.lat,cluster.lon],shape=[origin,destination(cluster.lat,cluster.lon,travel-30,length*.28),destination(cluster.lat,cluster.lon,travel-18,length),destination(cluster.lat,cluster.lon,travel,length*1.08),destination(cluster.lat,cluster.lon,travel+18,length),destination(cluster.lat,cluster.lon,travel+30,length*.28)];return {shape:shape,score:score,label:smokeLabel(score),className:smokeClass(score),color:smokeColor(score),direction:travel%360,length:length,fire:fire,transport:transport,rainScore:rainScore,persistence:persistence,weather:weather,cluster:cluster}}
  function renderSmoke(){
    groups.smoke.clearLayers();
    var summary=document.getElementById('smoke-summary'),en=smokeEnglish();
    if(!hotspotGeo||!weatherReady){
      summary.className='fw-smoke-summary';
      summary.innerHTML=en?'<strong>Smoke dispersion potential</strong><p>Cannot be assessed: hotspot or weather data are incomplete.</p>':'<strong>Potensi sebaran asap</strong><p>Belum dapat dinilai: data hotspot atau cuaca belum lengkap.</p>';
      return;
    }
    var items=smokeHotspots();
    if(!items.length){
      summary.className='fw-smoke-summary';
      summary.innerHTML=en?'<strong>Smoke dispersion potential: low</strong><p>No high-confidence hotspot was found in the 24-hour model. This does not guarantee smoke-free air.</p>':'<strong>Potensi sebaran asap: rendah</strong><p>Tidak ada hotspot confidence tinggi dalam 24 jam model. Ini bukan jaminan udara bebas asap.</p>';
      return;
    }
    var results=smokeClusters(items).map(function(cluster){return smokePolygon(cluster,nearestWeather(cluster.lat,cluster.lon))});
    results.forEach(function(result){
      var w=result.weather,c=result.cluster;
      var html=en?'<strong>Smoke dispersion potential — '+result.label+' ('+result.score+'/100)</strong><br>Indicative zone: ±'+Math.round(result.length)+' km toward '+Math.round(result.direction)+'°<br>Source: '+c.count+' hotspots · total FRP '+c.frp.toFixed(1)+' MW<br>Wind: '+Math.round(w.speed)+' km/h · rain '+w.rain+' mm<br><hr><small>Heat-source score '+result.fire+'/45 · wind '+result.transport+'/30 · rain '+result.rainScore+'/15 · persistence '+result.persistence+'/10.<br>Not an observed smoke boundary; satellite aerosol is not yet included.</small>':'<strong>Potensi sebaran asap — '+result.label+' ('+result.score+'/100)</strong><br>Zona indikatif: ±'+Math.round(result.length)+' km ke '+Math.round(result.direction)+'°<br>Sumber: '+c.count+' hotspot · total FRP '+c.frp.toFixed(1)+' MW<br>Angin: '+Math.round(w.speed)+' km/j · hujan '+w.rain+' mm<br><hr><small>Skor sumber panas '+result.fire+'/45 · angin '+result.transport+'/30 · hujan '+result.rainScore+'/15 · persistensi '+result.persistence+'/10.<br>Bukan batas asap teramati; aerosol satelit belum termasuk.</small>';
      L.polygon(result.shape,{pane:'smokePane',color:result.color,weight:2,fillColor:result.color,fillOpacity:.3,interactive:true}).bindPopup(html,{maxWidth:310}).addTo(groups.smoke);
    });
    var top=results.sort(function(a,b){return b.score-a.score})[0];
    summary.className='fw-smoke-summary '+top.className;
    summary.innerHTML=en?'<strong>Highest potential: '+top.label+' ('+top.score+'/100)</strong><p>'+results.length+' indicative zones from '+items.length+' hotspots in 24 hours. Click a polygon for the score breakdown.</p>':'<strong>Potensi tertinggi: '+top.label+' ('+top.score+'/100)</strong><p>'+results.length+' zona indikatif dari '+items.length+' hotspot dalam 24 jam. Klik poligon untuk rincian skor.</p>';
  }
  function loadWeather(){
    var sites=weatherSites,lat=sites.map(function(s){return s[1]}).join(','),lon=sites.map(function(s){return s[2]}).join(',');
    var url='https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m&timezone=Asia%2FJakarta';
    return fetch(url).then(function(r){if(!r.ok)throw Error('weather');return r.json()}).then(function(d){var rows=Array.isArray(d)?d:[d];groups.wind.clearLayers();weatherReadings=[];rows.forEach(function(row,i){var c=row.current||{},site=sites[i]||sites[0],dir=Number(c.wind_direction_10m)||0;weatherReadings.push({name:site[0],lat:site[1],lon:site[2],speed:Number(c.wind_speed_10m)||0,direction:dir,rain:Number(c.precipitation)||0,time:c.time||''});var icon=L.divIcon({className:'wind-icon',html:'<span style="display:block;transform:rotate('+dir+'deg)">↑</span>',iconSize:[30,30],iconAnchor:[15,15]});L.marker([site[1],site[2]],{icon:icon}).bindPopup('<strong>Angin '+esc(site[0])+'</strong><br>'+Math.round(c.wind_speed_10m||0)+' km/j · '+Math.round(dir)+'°<br>Hujan '+(c.precipitation||0)+' mm<br><small>'+esc(c.time||'')+' WIB · Open-Meteo</small>').addTo(groups.wind)});weatherReady=weatherReadings.length>0;var riau=rows[1]&&rows[1].current||{};document.getElementById('kpi-weather').textContent=riau.temperature_2m==null?'—':Math.round(riau.temperature_2m)+'°C';document.getElementById('weather-detail').textContent='Riau · '+(riau.precipitation||0)+' mm · angin '+Math.round(riau.wind_speed_10m||0)+' km/j'}).catch(function(){weatherReady=false;document.getElementById('kpi-weather').textContent='Tidak tersedia';document.getElementById('weather-detail').textContent='Layanan cuaca gagal dimuat'})
  }
  function toggleRain(on){var status=document.getElementById('rain-status');if(!on){groups.rain.clearLayers();rainLayer=null;if(status)status.textContent='Aktifkan layer untuk melihat citra radar hujan terbaru.';return}var msg=document.getElementById('map-message');msg.hidden=false;msg.textContent='Memuat kondisi hujan saat ini…';if(status)status.textContent='Memuat waktu citra radar terbaru…';fetch('https://api.rainviewer.com/public/weather-maps.json').then(function(r){if(!r.ok)throw Error('rain radar');return r.json()}).then(function(d){var frames=d.radar&&d.radar.past||[],f=frames[frames.length-1];if(!f)throw Error('no frame');groups.rain.clearLayers();rainLayer=L.tileLayer('https://tilecache.rainviewer.com'+f.path+'/256/{z}/{x}/{y}/2/1_1.png',{opacity:.55,maxNativeZoom:7,maxZoom:18,attribution:'RainViewer · citra radar terbaru'}).addTo(groups.rain);var observed=new Date(Number(f.time)*1000),timeText=!isNaN(observed)?observed.toLocaleString('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'})+' WIB':'waktu terbaru tersedia';if(status)status.textContent='Citra radar: '+timeText+'. Menunjukkan kondisi sekitar waktu tersebut, bukan akumulasi hujan.';msg.hidden=true}).catch(function(){if(status)status.textContent='Radar hujan saat ini belum tersedia. Jangan gunakan layer ini untuk menyimpulkan kondisi hujan.';msg.hidden=false;msg.textContent='Radar hujan saat ini sedang tidak tersedia';setTimeout(function(){msg.hidden=true},4000)})}
  function setLayerChecked(id,on){var c=document.querySelector('[data-layer="'+id+'"]');if(c)c.checked=on;if(id==='rain'){toggleRain(on);if(on&&!map.hasLayer(groups.rain))groups.rain.addTo(map);return}if(id==='smoke'&&on)renderSmoke();if(on){if(!map.hasLayer(groups[id]))groups[id].addTo(map)}else if(map.hasLayer(groups[id]))map.removeLayer(groups[id])}
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
  Promise.all([fetch('data/desa_intervensi.geojson').then(function(r){return r.json()}),fetch('data/village-forest-analytics.json').then(function(r){return r.json()}),fetch('data/hotspot-high-confidence.geojson?v='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('hotspot');return r.json()}),fetch('data/indonesia-boundary.geojson').then(function(r){if(!r.ok)throw Error('batas daratan');return r.json()}),pointLayer('data/fdrs.geojson',groups.fdrs,'fdrs','FDRS'),pointLayer('data/sekat_kanal.geojson',groups.canals,'canal','Sekat kanal'),loadWeather()]).then(function(v){villageGeo=v[0];analytics=v[1];hotspotGeo=v[2];var landFeature=v[3]&&v[3].features&&v[3].features[0],before=(hotspotGeo.features||[]).length;if(landFeature&&landFeature.geometry){hotspotGeo.features=(hotspotGeo.features||[]).filter(function(f){return f.geometry&&pointInGeometry(f.geometry.coordinates,landFeature.geometry)});hotspotGeo.offshoreFiltered=before-hotspotGeo.features.length}document.getElementById('kpi-fdrs').textContent=v[4];document.getElementById('kpi-canals').textContent=v[5];updateHotspotFreshness();refreshHotspots();renderSmoke()}).catch(function(){hotspotStatusText='Data hotspot gagal dimuat';document.getElementById('data-status').textContent=hotspotStatusText;document.getElementById('updated-at').textContent='Periksa koneksi atau pembaruan FIRMS';renderSmoke()});
  document.getElementById('period-control').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;period=b.dataset.period==='latest'?'latest':Number(b.dataset.period);this.querySelectorAll('button').forEach(function(x){x.classList.toggle('active',x===b)});document.getElementById('kpi-period').textContent=b.textContent;refreshHotspots()});
  document.querySelectorAll('[data-layer]').forEach(function(c){c.addEventListener('change',function(){setLayerChecked(c.dataset.layer,c.checked)})});
  document.querySelectorAll('[data-product]').forEach(function(b){b.addEventListener('click',function(){selectProduct(b.dataset.product)})});
  dateInput.addEventListener('change',function(){if(dateInput.value){if(dateInput.value>currentDate)dateInput.value=currentDate;updateObservationDate(dateInput.value);refreshHotspots();renderSmoke()}});updateObservationDate(observationDate);
  document.getElementById('zoom-id').onclick=function(){map.fitBounds(indonesiaBounds,{padding:[8,8]})};
  document.getElementById('zoom-yg').onclick=function(){if(ygBounds&&ygBounds.isValid())map.fitBounds(ygBounds.pad(.08))};
  window.addEventListener('yg:languagechange',function(){renderSmoke()});
  var windLevel=document.getElementById('wind-level');if(windLevel)windLevel.onchange=function(e){var note=document.getElementById('map-message');if(e.target.value==='800'){note.hidden=false;note.textContent='Data angin 2.500 kaki belum tersedia; peta tetap menampilkan angin permukaan agar tidak memberi visual yang keliru.';e.target.value='10';setTimeout(function(){note.hidden=true},5000)}};
})();
