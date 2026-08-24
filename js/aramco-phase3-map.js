(function(){
  'use strict';
  var allowed=['Buruk Bakul','Kelapa Pati','Sepahat','Tanjung Kuras'];
  var requested=new URLSearchParams(location.search).get('village')||'';
  var village=allowed.find(function(name){return name.toLowerCase()===requested.trim().toLowerCase();})||'Buruk Bakul';
  var report='https://drive.google.com/file/d/1DFxyFC3X1VsLqCjhi_IqkhPE9CiEh4sD/view?usp=drivesdk';
  var map=L.map('phase1-map',{zoomControl:true});
  var satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'}).addTo(map);
  var street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'});
  L.control.layers({'Citra satelit':satellite,'Peta jalan':street},null,{collapsed:false}).addTo(map);
  function num(value){return Number(value)||0;}
  function fmt(value,digits){return new Intl.NumberFormat('id-ID',{minimumFractionDigits:digits||0,maximumFractionDigits:digits||0}).format(value);}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  document.title='Polygon '+village+' · Aramco Fase 3 | YG GeoPortal';
  document.getElementById('phase-map-title').textContent='Area rehabilitasi '+village;
  document.getElementById('phase-map-location').textContent=village+(village==='Tanjung Kuras'?', Kabupaten Siak':', Kabupaten Bengkalis')+' · Juli 2025–Desember 2026';
  document.getElementById('phase-map-village').textContent=village;
  document.getElementById('phase-map-heading').textContent='Polygon rehabilitasi Fase 3 · '+village;
  document.getElementById('phase-map-legend-label').textContent='Area rehabilitasi Aramco Fase 3 · '+village;
  fetch('data/area_mangrove.geojson?v=20260825-phase3-village-maps1',{cache:'no-store'}).then(function(response){if(!response.ok)throw new Error('HTTP '+response.status);return response.json();}).then(function(data){
    var features=(data.features||[]).filter(function(feature){var p=feature.properties||{};return /^phase\s*iii$/i.test(String(p.Ket||'').trim())&&String(p.Desa||'').trim().toLowerCase()===village.toLowerCase();});
    var colors={'Buruk Bakul':'#55d49b','Kelapa Pati':'#00b8de','Sepahat':'#ffbf3f','Tanjung Kuras':'#a97be8'},color=colors[village];
    var layer=L.geoJSON({type:'FeatureCollection',features:features},{style:{color:color,weight:3,fillColor:color,fillOpacity:.3},onEachFeature:function(feature,polygon){var p=feature.properties||{};polygon.bindPopup('<div class="phase-map-popup"><h3>'+esc(p.Nama_Objek||('Polygon '+village))+'</h3><dl><dt>Desa</dt><dd>'+esc(p.Desa||village)+'</dd><dt>Fase</dt><dd>'+esc(p.Ket||'Phase III')+'</dd><dt>Tahun</dt><dd>'+esc(p.Tahun||'—')+'</dd><dt>Luas</dt><dd>'+fmt(num(p.Luas_Ha),3)+' ha</dd><dt>Penanaman</dt><dd>'+fmt(num(p.Jumlah_Bib))+' mangrove</dd><dt>ID objek</dt><dd>'+esc(p.Object_ID||'—')+'</dd></dl><a href="'+report+'" target="_blank" rel="noopener noreferrer">Buka evidence laporan ↗</a></div>',{maxWidth:340});}}).addTo(map);
    var area=features.reduce(function(sum,f){return sum+num((f.properties||{}).Luas_Ha);},0),trees=features.reduce(function(sum,f){return sum+num((f.properties||{}).Jumlah_Bib);},0);
    document.getElementById('phase-map-polygons').textContent=fmt(features.length);
    document.getElementById('phase-map-area').textContent=fmt(area,3)+' ha';
    document.getElementById('phase-map-seedlings').textContent=fmt(trees);
    document.getElementById('phase-map-status').textContent=features.length+' polygon '+village+' ditampilkan · desa dan fase lain disembunyikan';
    if(layer.getBounds().isValid())map.fitBounds(layer.getBounds(),{padding:[35,35],maxZoom:16});else map.setView([1.45,102.07],11);
  }).catch(function(error){map.setView([1.45,102.07],11);document.getElementById('phase-map-status').textContent='Polygon belum dapat dimuat';console.error(error);});
})();
