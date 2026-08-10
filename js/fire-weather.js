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
  var readingGuide=document.querySelector('.fw-disclaimer p');if(readingGuide)readingGuide.textContent='Kontur terbentuk dari kepadatan lintasan partikel selama 24 jam menggunakan angin 925 hPa. Kontur yang bersentuhan digabungkan. Zona ini bukan batas asap teramati dan bukan pengganti pengukuran kualitas udara.';
  var satelliteLayer=L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',{layers:'MODIS_Terra_CorrectedReflectance_TrueColor',format:'image/jpeg',transparent:false,pane:'satellitePane',opacity:.72,time:observationDate,attribution:'NASA GIBS / MODIS Terra'});
  var groups={
    hotspots:L.layerGroup().addTo(map),satellite:L.layerGroup([satelliteLayer]),smoke:L.layerGroup(),
    villages:L.layerGroup().addTo(map),rain:L.layerGroup(),wind:L.layerGroup().addTo(map),
    fdrs:L.layerGroup().addTo(map),canals:L.layerGroup().addTo(map)
  };
  var villageGeo=null,analytics=null,hotspotGeo=null,ygBounds=null,period=30,rainLayer=null,mapDateBadge=null,hotspotStatusText='Memuat…',weatherReadings=[],weatherReady=false,aerosolReadings=[],aerosolReady=false,aerosolTime='',transportReadings=[],transportReady=false,transportTime='';
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
  function nearestAerosol(lat,lon){return aerosolReadings.reduce(function(best,row){var d=distanceKm([lat,lon],[row.lat,row.lon]);return !best||d<best.distance?Object.assign({distance:d},row):best},null)}
  function destination(lat,lon,bearing,km){var r=6371,br=bearing*Math.PI/180,p1=lat*Math.PI/180,l1=lon*Math.PI/180,d=km/r,p2=Math.asin(Math.sin(p1)*Math.cos(d)+Math.cos(p1)*Math.sin(d)*Math.cos(br)),l2=l1+Math.atan2(Math.sin(br)*Math.sin(d)*Math.cos(p1),Math.cos(d)-Math.sin(p1)*Math.sin(p2));return [p2*180/Math.PI,l2*180/Math.PI]}
  function smokeClass(score){return score>=75?'very-high':score>=50?'high':score>=25?'watch':'low'}
  function smokeEnglish(){return !!(window.YG_I18N&&window.YG_I18N.language==='en')}
  function smokeLabel(score){return smokeEnglish()?(score>=75?'Very high':score>=50?'High':score>=25?'Watch':'Low'):(score>=75?'Sangat tinggi':score>=50?'Tinggi':score>=25?'Waspada':'Rendah')}
  function smokeColor(score){return score>=75?'#d6402b':score>=50?'#ef8f27':score>=25?'#f2ca52':'#54a96b'}
  function smokeHotspots(){var end=periodEnd(),hours=period==='latest'?6:24,cutoff=end.getTime()-hours*3600000;return (hotspotGeo&&hotspotGeo.features||[]).filter(function(f){var t=pointTime(f);return !isNaN(t)&&t<=end&&t.getTime()>cutoff})}
  function repeatedSourceGroups(){var end=periodEnd(),cutoff=end.getTime()-7*86400000,buckets={};(hotspotGeo&&hotspotGeo.features||[]).forEach(function(f){var t=pointTime(f);if(isNaN(t)||t>end||t.getTime()<=cutoff)return;var c=f.geometry.coordinates,key=Math.round(c[1]*2)+'|'+Math.round(c[0]*2),p=f.properties||{};if(!buckets[key])buckets[key]={lat:0,lon:0,count:0,frp:0,days:{}};var b=buckets[key];b.lat+=c[1];b.lon+=c[0];b.count++;b.frp+=Math.max(0,Number(p.frp)||0);b.days[t.toISOString().slice(0,10)]=true});return Object.keys(buckets).map(function(key){var b=buckets[key];b.lat/=b.count;b.lon/=b.count;b.dayCount=Object.keys(b.days).length;return b}).filter(function(b){return b.dayCount>=2})}
  function renderRepeatedSources(summary,en){var sources=repeatedSourceGroups();if(!sources.length){summary.className='fw-smoke-summary';summary.innerHTML=en?'<strong>Repeated fire sources · 7 days</strong><p>No location has high-confidence detections on two different days.</p>':'<strong>Sumber api berulang · 7 hari</strong><p>Tidak ada lokasi dengan deteksi confidence tinggi pada dua hari berbeda.</p>';return}var buffers=sources.map(function(s){return turf.buffer(turf.point([s.lon,s.lat]),Math.min(30,8+s.count*1.5),{units:'kilometers'})}),merged;try{merged=turf.union(turf.featureCollection(buffers))}catch(error){merged=turf.featureCollection(buffers)}var collection=merged.type==='FeatureCollection'?merged:turf.featureCollection([merged]),zones=[];turf.flattenEach(collection,function(part){zones.push(part)});zones.forEach(function(zone){var html=en?'<strong>Repeated fire-source zone · 7 days</strong><br>Detected on at least two different days.<br><small>This is not a smoke plume.</small>':'<strong>Zona sumber api berulang · 7 hari</strong><br>Terdeteksi pada sedikitnya dua hari berbeda.<br><small>Ini bukan plume asap.</small>';L.geoJSON(zone,{pane:'smokePane',style:{color:'#a86116',weight:2,dashArray:'6 4',fillColor:'#f2ca52',fillOpacity:.24}}).bindPopup(html).addTo(groups.smoke)});summary.className='fw-smoke-summary high';summary.innerHTML=en?'<strong>Repeated fire sources · 7 days</strong><p>'+sources.length+' repeated source clusters form '+zones.length+' connected zones. No smoke trajectory is shown.</p>':'<strong>Sumber api berulang · 7 hari</strong><p>'+sources.length+' kelompok sumber berulang membentuk '+zones.length+' zona terkoneksi. Lintasan asap tidak ditampilkan.</p>'}
  function updateSmokeProductLabel(){var en=smokeEnglish(),title=document.getElementById('smoke-product-title'),note=document.getElementById('smoke-product-note');if(period===7){title.textContent=en?'Repeated Fire Sources':'Sumber Api Berulang';note.textContent=en?'At least 2 days within 7 days':'Minimal 2 hari dalam 7 hari'}else if(period===30){title.textContent=en?'Polygon Disabled':'Poligon Dinonaktifkan';note.textContent=en?'Historical markers only':'Hanya marker historis'}else{title.textContent=en?'Smoke Dispersion Potential':'Potensi Sebaran Asap';note.textContent=period==='latest'?(en?'Current · 6-hour sources':'Sekarang · sumber 6 jam'):(en?'Rolling 24-hour sources':'Sumber 24 jam bergulir')}}
  function aerosolPoints(aod){return aod>=.5?25:aod>=.3?Math.round(15+(aod-.3)*50):aod>=.1?Math.round(4+(aod-.1)*55):Math.round(Math.max(0,aod)*40)}
  function nearestTransport(lat,lon,timeMs){var row=transportReadings.reduce(function(best,item){var d=distanceKm([lat,lon],[item.lat,item.lon]);return !best||d<best.distance?Object.assign({distance:d},item):best},null);if(!row)return null;var index=0,bestTime=Infinity;row.times.forEach(function(t,i){var delta=Math.abs(t-timeMs);if(delta<bestTime){bestTime=delta;index=i}});return {speed:Number(row.speeds[index])||0,direction:Number(row.directions[index])||0,rain:Number(row.rain[index])||0,time:row.times[index]}}
  function smokeField(items){
    var step=.25,cells={},end=periodEnd().getTime(),maxTravel=0;
    function deposit(lat,lon,value){var yi=Math.round((lat+12)/step),xi=Math.round((lon-94)/step);for(var y=-2;y<=2;y++)for(var x=-2;x<=2;x++){var factor=Math.exp(-(x*x+y*y)/2.2),key=(yi+y)+'|'+(xi+x);cells[key]=(cells[key]||0)+value*factor}}
    items.forEach(function(feature){var c=feature.geometry.coordinates,p=feature.properties||{},lat=c[1],lon=c[0],origin=[lat,lon],time=Math.max(pointTime(feature).getTime(),end-86400000),weight=1+Math.sqrt(Math.max(0,Number(p.frp)||0))/4;for(var hour=0;hour<24&&time<=end;hour++){var wind=nearestTransport(lat,lon,time);if(!wind)break;deposit(lat,lon,weight);var travel=(wind.direction+180)%360,next=destination(lat,lon,travel,wind.speed),rainLoss=wind.rain>=2?.42:wind.rain>=.5?.65:.9;weight*=rainLoss;if(weight<.08)break;lat=next[0];lon=next[1];time+=3600000;maxTravel=Math.max(maxTravel,distanceKm(origin,[lat,lon]))}});
    return {cells:cells,step:step,maxTravel:maxTravel};
  }
  function smokeContours(field){
    if(!window.turf)throw Error('Turf unavailable');
    var keys=Object.keys(field.cells);if(!keys.length)return [];
    var parsed=keys.map(function(key){return key.split('|').map(Number)}),ys=parsed.map(function(p){return p[0]}),xs=parsed.map(function(p){return p[1]}),minY=Math.min.apply(null,ys)-2,maxY=Math.max.apply(null,ys)+2,minX=Math.min.apply(null,xs)-2,maxX=Math.max.apply(null,xs)+2,points=[];
    for(var yi=minY;yi<=maxY;yi++)for(var xi=minX;xi<=maxX;xi++){var lat=yi*field.step-12,lon=xi*field.step+94,density=field.cells[yi+'|'+xi]||0,aerosol=nearestAerosol(lat,lon),trajectoryScore=density<.08?0:Math.min(75,Math.round(18*Math.log1p(density))),score=trajectoryScore===0?0:Math.min(100,trajectoryScore+aerosolPoints(aerosol&&aerosol.aod||0));points.push(turf.point([lon,lat],{score:score}))}
    var breaks=[10,25,50,75,101],bands=turf.isobands(turf.featureCollection(points),breaks,{zProperty:'score'}),result=[];
    (bands.features||[]).forEach(function(feature,index){var representative=[17,37,62,88][index]||17;turf.flattenEach(feature,function(part){if(!part.geometry||!part.geometry.coordinates||!part.geometry.coordinates.length)return;var smoothed=turf.polygonSmooth(part,{iterations:2});(smoothed.features||[]).forEach(function(shape){if(turf.area(shape)>1000000)result.push({feature:shape,score:representative})})})});
    return result;
  }
  function renderSmoke(){
    groups.smoke.clearLayers();
    var summary=document.getElementById('smoke-summary'),en=smokeEnglish();
    updateSmokeProductLabel();
    if(period===30){summary.className='fw-smoke-summary';summary.innerHTML=en?'<strong>30-day hotspot history</strong><p>Smoke-potential polygons are disabled. This period is used only for historical hotspot markers and statistics.</p>':'<strong>Riwayat hotspot 30 hari</strong><p>Poligon potensi asap dinonaktifkan. Periode ini hanya untuk marker dan statistik historis hotspot.</p>';return}
    if(period===7){if(!hotspotGeo||!window.turf){summary.className='fw-smoke-summary';summary.innerHTML=en?'<strong>Repeated fire sources · 7 days</strong><p>Source data are incomplete.</p>':'<strong>Sumber api berulang · 7 hari</strong><p>Data sumber belum lengkap.</p>';return}renderRepeatedSources(summary,en);return}
    if(!hotspotGeo||!transportReady||!aerosolReady||!window.turf){
      summary.className='fw-smoke-summary';
      summary.innerHTML=en?'<strong>Smoke dispersion potential</strong><p>Cannot be assessed: hotspot, 925 hPa wind, aerosol, or contour data are incomplete.</p>':'<strong>Potensi sebaran asap</strong><p>Belum dapat dinilai: data hotspot, angin 925 hPa, aerosol, atau kontur belum lengkap.</p>';
      return;
    }
    if(observationDate!==currentDate){summary.className='fw-smoke-summary';summary.innerHTML=en?'<strong>Smoke dispersion potential</strong><p>The trajectory model is available only for the current date because historical 925 hPa wind is not loaded.</p>':'<strong>Potensi sebaran asap</strong><p>Model lintasan hanya tersedia untuk tanggal hari ini karena angin historis 925 hPa belum dimuat.</p>';return}
    var items=smokeHotspots(),modelHours=period==='latest'?6:24;
    if(!items.length){
      summary.className='fw-smoke-summary';
      summary.innerHTML=en?'<strong>Smoke dispersion potential: low</strong><p>No high-confidence hotspot was found in the '+modelHours+'-hour model. This does not guarantee smoke-free air.</p>':'<strong>Potensi sebaran asap: rendah</strong><p>Tidak ada hotspot confidence tinggi dalam model '+modelHours+' jam. Ini bukan jaminan udara bebas asap.</p>';
      return;
    }
    var field=smokeField(items),results=smokeContours(field);
    results.forEach(function(result){var html=en?'<strong>Connected smoke-potential contour — '+smokeLabel(result.score)+'</strong><br>Score band: '+result.score+'/100<br>Source window: '+modelHours+' hours<br>Maximum simulated displacement: '+Math.round(field.maxTravel)+' km<br><hr><small>Hourly particle advection using GFS 925 hPa wind, rain attenuation, FIRMS FRP, and CAMS AOD. Absolute-density calibration v2; indicative model, not observed smoke.</small>':'<strong>Kontur terkoneksi potensi asap — '+smokeLabel(result.score)+'</strong><br>Kelas skor: '+result.score+'/100<br>Jendela sumber: '+modelHours+' jam<br>Perpindahan simulasi maksimum: '+Math.round(field.maxTravel)+' km<br><hr><small>Adveksi partikel per jam menggunakan angin GFS 925 hPa, reduksi hujan, FRP FIRMS, dan AOD CAMS. Kalibrasi kepadatan absolut v2; model indikatif, bukan asap teramati.</small>';L.geoJSON(result.feature,{pane:'smokePane',style:{color:smokeColor(result.score),weight:2,fillColor:smokeColor(result.score),fillOpacity:.3}}).bindPopup(html,{maxWidth:330}).addTo(groups.smoke)});
    if(!results.length){summary.className='fw-smoke-summary';summary.innerHTML=en?'<strong>Smoke dispersion potential</strong><p>No connected contour passed the minimum model threshold.</p>':'<strong>Potensi sebaran asap</strong><p>Tidak ada kontur terkoneksi yang melewati ambang minimum model.</p>';return}
    var top=results.sort(function(a,b){return b.score-a.score})[0];
    summary.className='fw-smoke-summary '+smokeClass(top.score);
    summary.innerHTML=en?'<strong>'+modelHours+'-hour smoke potential: '+smokeLabel(top.score)+' ('+top.score+'/100)</strong><p>'+results.length+' connected contours from '+items.length+' hotspots. GFS 925 hPa: '+esc(transportTime||'latest')+' WIB · CAMS AOD: '+esc(aerosolTime||'latest')+' WIB.</p>':'<strong>Potensi asap '+modelHours+' jam: '+smokeLabel(top.score)+' ('+top.score+'/100)</strong><p>'+results.length+' kontur terkoneksi dari '+items.length+' hotspot. GFS 925 hPa: '+esc(transportTime||'terbaru')+' WIB · AOD CAMS: '+esc(aerosolTime||'terbaru')+' WIB.</p>';
  }
  function loadAerosol(){
    var grid=[];
    for(var lat=-10;lat<=5;lat+=3)for(var lon=96;lon<=140;lon+=4)grid.push([lat,lon]);
    var lats=grid.map(function(p){return p[0]}).join(','),lons=grid.map(function(p){return p[1]}).join(',');
    var url='https://air-quality-api.open-meteo.com/v1/air-quality?latitude='+lats+'&longitude='+lons+'&current=aerosol_optical_depth,pm2_5&domains=cams_global&timezone=Asia%2FJakarta';
    return fetch(url).then(function(r){if(!r.ok)throw Error('aerosol');return r.json()}).then(function(data){
      var rows=Array.isArray(data)?data:[data];
      aerosolReadings=rows.map(function(row,i){var c=row.current||{},point=grid[i]||grid[0];return {lat:Number(row.latitude)||point[0],lon:Number(row.longitude)||point[1],aod:Math.max(0,Number(c.aerosol_optical_depth)||0),pm25:Math.max(0,Number(c.pm2_5)||0),time:c.time||''}});
      aerosolReady=aerosolReadings.length>0;
      aerosolTime=aerosolReadings[0]&&aerosolReadings[0].time||'';
    }).catch(function(){aerosolReady=false;aerosolReadings=[]})
  }
  function loadTransportWeather(){
    var grid=[];
    for(var lat=-10;lat<=5;lat+=3)for(var lon=96;lon<=140;lon+=4)grid.push([lat,lon]);
    var lats=grid.map(function(p){return p[0]}).join(','),lons=grid.map(function(p){return p[1]}).join(',');
    var url='https://api.open-meteo.com/v1/gfs?latitude='+lats+'&longitude='+lons+'&hourly=wind_speed_925hPa,wind_direction_925hPa,precipitation&past_days=1&forecast_days=1&timezone=Asia%2FJakarta';
    return fetch(url).then(function(r){if(!r.ok)throw Error('925 hPa wind');return r.json()}).then(function(data){
      var rows=Array.isArray(data)?data:[data];
      transportReadings=rows.map(function(row,i){var h=row.hourly||{},point=grid[i]||grid[0];return {lat:Number(row.latitude)||point[0],lon:Number(row.longitude)||point[1],times:(h.time||[]).map(function(t){return new Date(t+'+07:00').getTime()}),speeds:h.wind_speed_925hPa||[],directions:h.wind_direction_925hPa||[],rain:h.precipitation||[]}});
      transportReady=transportReadings.length>0;
      groups.wind.clearLayers();
      var now=periodEnd().getTime();
      weatherSites.forEach(function(site){var wind=nearestTransport(site[1],site[2],now);if(!wind)return;var travel=(wind.direction+180)%360;transportTime=new Date(wind.time).toLocaleString('sv-SE',{timeZone:'Asia/Jakarta'}).replace(' ','T');var icon=L.divIcon({className:'wind-icon',html:'<span style="display:block;transform:rotate('+travel+'deg)">↑</span>',iconSize:[30,30],iconAnchor:[15,15]});L.marker([site[1],site[2]],{icon:icon}).bindPopup('<strong>Angin GFS 925 hPa '+esc(site[0])+'</strong><br>Bergerak ke '+Math.round(travel)+'° · '+Math.round(wind.speed)+' km/j<br><small>'+esc(transportTime)+' WIB · pembaruan otomatis</small>').addTo(groups.wind)})
    }).catch(function(){transportReady=false;transportReadings=[]})
  }
  function loadWeather(){
    var sites=weatherSites,lat=sites.map(function(s){return s[1]}).join(','),lon=sites.map(function(s){return s[2]}).join(',');
    var url='https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m&timezone=Asia%2FJakarta';
    return fetch(url).then(function(r){if(!r.ok)throw Error('weather');return r.json()}).then(function(d){var rows=Array.isArray(d)?d:[d];weatherReadings=[];rows.forEach(function(row,i){var c=row.current||{},site=sites[i]||sites[0];weatherReadings.push({name:site[0],lat:site[1],lon:site[2],speed:Number(c.wind_speed_10m)||0,direction:Number(c.wind_direction_10m)||0,rain:Number(c.precipitation)||0,time:c.time||''})});weatherReady=weatherReadings.length>0;var riau=rows[1]&&rows[1].current||{};document.getElementById('kpi-weather').textContent=riau.temperature_2m==null?'—':Math.round(riau.temperature_2m)+'°C';document.getElementById('weather-detail').textContent='Riau · '+(riau.precipitation||0)+' mm · angin permukaan '+Math.round(riau.wind_speed_10m||0)+' km/j'}).catch(function(){weatherReady=false;document.getElementById('kpi-weather').textContent='Tidak tersedia';document.getElementById('weather-detail').textContent='Layanan cuaca gagal dimuat'})
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
  Promise.all([fetch('data/desa_intervensi.geojson').then(function(r){return r.json()}),fetch('data/village-forest-analytics.json').then(function(r){return r.json()}),fetch('data/hotspot-high-confidence.geojson?v='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('hotspot');return r.json()}),fetch('data/indonesia-boundary.geojson').then(function(r){if(!r.ok)throw Error('batas daratan');return r.json()}),pointLayer('data/fdrs.geojson',groups.fdrs,'fdrs','FDRS'),pointLayer('data/sekat_kanal.geojson',groups.canals,'canal','Sekat kanal'),loadWeather(),loadAerosol(),loadTransportWeather()]).then(function(v){villageGeo=v[0];analytics=v[1];hotspotGeo=v[2];var landFeature=v[3]&&v[3].features&&v[3].features[0],before=(hotspotGeo.features||[]).length;if(landFeature&&landFeature.geometry){hotspotGeo.features=(hotspotGeo.features||[]).filter(function(f){return f.geometry&&pointInGeometry(f.geometry.coordinates,landFeature.geometry)});hotspotGeo.offshoreFiltered=before-hotspotGeo.features.length}document.getElementById('kpi-fdrs').textContent=v[4];document.getElementById('kpi-canals').textContent=v[5];updateHotspotFreshness();refreshHotspots();renderSmoke()}).catch(function(){hotspotStatusText='Data hotspot gagal dimuat';document.getElementById('data-status').textContent=hotspotStatusText;document.getElementById('updated-at').textContent='Periksa koneksi atau pembaruan FIRMS';renderSmoke()});
  document.getElementById('period-control').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;period=b.dataset.period==='latest'?'latest':Number(b.dataset.period);this.querySelectorAll('button').forEach(function(x){x.classList.toggle('active',x===b)});document.getElementById('kpi-period').textContent=b.textContent;refreshHotspots();renderSmoke()});
  document.querySelectorAll('[data-layer]').forEach(function(c){c.addEventListener('change',function(){setLayerChecked(c.dataset.layer,c.checked)})});
  document.querySelectorAll('[data-product]').forEach(function(b){b.addEventListener('click',function(){selectProduct(b.dataset.product)})});
  dateInput.addEventListener('change',function(){if(dateInput.value){if(dateInput.value>currentDate)dateInput.value=currentDate;updateObservationDate(dateInput.value);refreshHotspots();renderSmoke()}});updateObservationDate(observationDate);
  document.getElementById('zoom-id').onclick=function(){map.fitBounds(indonesiaBounds,{padding:[8,8]})};
  document.getElementById('zoom-yg').onclick=function(){if(ygBounds&&ygBounds.isValid())map.fitBounds(ygBounds.pad(.08))};
  window.addEventListener('yg:languagechange',function(){renderSmoke()});
  var windLevel=document.getElementById('wind-level');if(windLevel)windLevel.onchange=function(e){var note=document.getElementById('map-message');if(e.target.value==='800'){note.hidden=false;note.textContent='Data angin 2.500 kaki belum tersedia; peta tetap menampilkan angin permukaan agar tidak memberi visual yang keliru.';e.target.value='10';setTimeout(function(){note.hidden=true},5000)}};
})();
