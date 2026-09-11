(function(){
  'use strict';
  var list=document.getElementById('location-list'),total=document.getElementById('total-area'),count=document.getElementById('event-count'),updated=document.getElementById('last-updated'),allButton=document.getElementById('all-areas');
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function hectares(n){return Number(n||0).toLocaleString('id-ID',{maximumFractionDigits:2})+' ha'}
  function date(value){var d=new Date(value);return value&&!isNaN(d)?d.toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',year:'numeric'}):'—'}
  var map=null,geoLayer=null;
  if(typeof L!=='undefined'){
    map=L.map('area-map',{preferCanvas:true}).fitBounds([[-1.3,100],[2.9,104.95]]);
    var street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap contributors'});
    var satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:17,maxZoom:18,attribution:'Tiles &copy; Esri'}).addTo(map);
    L.control.layers({'Citra satelit':satellite,'Peta jalan':street}).addTo(map);
  }else document.getElementById('area-map').textContent='Peta belum dapat dimuat. Informasi lokasi tetap tersedia di daftar.';
  fetch('data/burned-area-estimates.geojson?v='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(30000)}).then(function(r){if(!r.ok)throw Error('data');return r.json()}).then(function(geo){
    if(!Array.isArray(geo.features))throw Error('format');
    var events=Object.create(null),area=0;
    geo.features.forEach(function(f){var p=f.properties||{};if(!p.eventId)return;if(!events[p.eventId]){events[p.eventId]={p:p,layers:[],bounds:map?L.latLngBounds([]):null};area+=Number(p.estimatedAreaHa)||0}});
    var entries=Object.keys(events).map(function(id){return events[id]}).sort(function(a,b){return Number(b.p.estimatedAreaHa)-Number(a.p.estimatedAreaHa)});
    total.textContent=entries.length?hectares(area):'Belum tersedia';count.textContent=entries.length+' kejadian terindikasi';
    var generated=new Date(geo.generatedAt);updated.textContent=geo.generatedAt&&!isNaN(generated)?'Pembaruan terakhir: '+generated.toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB':'Waktu pembaruan belum tersedia';
    function details(p){return '<strong>'+esc((p.villages||[]).join(', ')||'Lokasi belum teridentifikasi')+'</strong><br>'+esc((p.regencies||[]).join(', '))+'<br><strong>'+hectares(p.estimatedAreaHa)+'</strong> · estimasi per kejadian<br>Deteksi: '+date(p.firstDetection)+' – '+date(p.lastDetection)+'<br>'+Number(p.hotspotCount||0)+' hotspot · '+Number(p.detectionDays||0)+' hari deteksi<br>Citra pascakejadian: '+esc((p.postSceneDates||[]).map(date).join(', ')||'—')+'<br><small>Estimasi citra satelit, bukan verifikasi lapangan.</small>'}
    if(map){geoLayer=L.geoJSON(geo,{style:{color:'#a73322',weight:2,fillColor:'#e04b31',fillOpacity:.34},onEachFeature:function(f,layer){var e=events[(f.properties||{}).eventId];if(!e)return;e.layers.push(layer);e.bounds.extend(layer.getBounds());layer.bindPopup(details(e.p))}}).addTo(map);if(geoLayer.getBounds().isValid()){map.fitBounds(geoLayer.getBounds(),{padding:[24,24]});allButton.disabled=false}}
    list.replaceChildren();if(!entries.length)list.textContent='Belum ada estimasi dengan citra pascakejadian yang layak.';
    entries.forEach(function(e){var p=e.p,button=document.createElement('button');button.type='button';button.className='location';button.setAttribute('aria-pressed','false');button.innerHTML='<strong>'+esc((p.villages||[]).join(', ')||'Lokasi belum teridentifikasi')+'</strong><span class="muted">'+esc((p.regencies||[]).join(', '))+'</span><span class="area">'+hectares(p.estimatedAreaHa)+'</span><span class="muted">'+date(p.firstDetection)+' – '+date(p.lastDetection)+'</span>';button.disabled=!map||!e.bounds.isValid();button.addEventListener('click',function(){list.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed','false')});button.setAttribute('aria-pressed','true');document.getElementById('area-map').scrollIntoView({block:'center'});map.invalidateSize();map.fitBounds(e.bounds,{padding:[32,32],maxZoom:15,animate:false});L.popup().setLatLng(e.bounds.getCenter()).setContent(details(p)).openOn(map)});list.appendChild(button)});
    allButton.addEventListener('click',function(){map.closePopup();map.fitBounds(geoLayer.getBounds(),{padding:[24,24]});list.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed','false')})});
  }).catch(function(){total.textContent='Tidak tersedia';count.textContent='Estimasi belum dapat dimuat';list.textContent='Data lokasi belum dapat dimuat. Silakan muat ulang halaman.';updated.textContent='Waktu pembaruan belum tersedia'});
})();
