(function(){
  'use strict';
  var list=document.getElementById('location-list'),total=document.getElementById('total-area'),count=document.getElementById('event-count'),updated=document.getElementById('last-updated'),allButton=document.getElementById('all-areas'),regency=document.getElementById('regency-filter'),period=document.getElementById('period-filter'),heading=document.getElementById('locations-heading'),hint=document.getElementById('map-hint');
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function hectares(n){return Number(n||0).toLocaleString('id-ID',{maximumFractionDigits:2})+' ha'}
  function date(value){var d=new Date(value);return value&&!isNaN(d)?d.toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',year:'numeric'}):'—'}
  function villageDetails(p){return (p.villageAreas||[]).map(function(a){return '<br>'+esc(a.village)+' · '+esc(a.district)+' · '+esc(a.regency)+': <strong>'+hectares(a.areaHa)+'</strong>'}).join('')+(p.unassignedAreaHa>0?'<br>Desa belum teridentifikasi: '+hectares(p.unassignedAreaHa):'')}
  function details(e){var p=e.p,part=selected?'<br>Bagian '+esc(selected)+': <strong>'+hectares(e.allocations[selected])+'</strong>':'';return '<strong>'+esc((p.villages||[]).join(', ')||'Lokasi belum teridentifikasi')+'</strong><br>'+esc((p.regencies||[]).join(', '))+part+'<br><strong>'+hectares(p.estimatedAreaHa)+'</strong> · estimasi seluruh kejadian<br>Deteksi: '+date(p.firstDetection)+' – '+date(p.lastDetection)+'<br>'+Number(p.hotspotCount||0)+' hotspot · '+Number(p.detectionDays||0)+' hari deteksi<br>Citra pascakejadian: '+esc((p.postSceneDates||[]).map(date).join(', ')||'—')+villageDetails(p)+'<br><small>Estimasi citra satelit, bukan verifikasi lapangan.</small>'}
  var map=null,polygons=null,clusters=null,model=null,selected='',requestVersion=0,reports=Object.create(null),overviewMarkers=[],leaderLines=null;
  if(typeof L!=='undefined'){
    map=L.map('area-map',{preferCanvas:true}).fitBounds([[-1.3,100],[2.9,104.95]]);
    var street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap contributors'});
    var satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:17,maxZoom:18,attribution:'Tiles &copy; Esri'}).addTo(map);
    L.control.layers({'Citra satelit':satellite,'Peta jalan':street}).addTo(map);
  }else document.getElementById('area-map').textContent='Peta belum dapat dimuat. Informasi lokasi tetap tersedia di daftar.';
  function json(url){return fetch(url+'?v='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(30000)}).then(function(r){if(!r.ok)throw Error('data');return r.json()})}
  function button(html,action){var b=document.createElement('button');b.type='button';b.className='location';b.innerHTML=html;b.addEventListener('click',action);list.appendChild(b);return b}
  function showGroup(name){selected=name;regency.value=name;render();}
  function positionLabels(){
    if(!map||selected||!overviewMarkers.length)return;
    if(leaderLines)map.removeLayer(leaderLines);leaderLines=L.featureGroup().addTo(map);
    var placed=[],size=map.getSize();
    overviewMarkers.forEach(function(item){
      var point=map.latLngToContainerPoint(item.center),chosen=null;
      for(var ring=0;ring<8&&!chosen;ring++){
        var offsets=ring===0?[[0,0]]:[[0,-90*ring],[0,90*ring],[-170*ring,0],[170*ring,0],[-170*ring,-90*ring],[170*ring,90*ring]];
        offsets.some(function(offset){var x=Math.max(82,Math.min(size.x-82,point.x+offset[0])),y=Math.max(42,Math.min(size.y-42,point.y+offset[1]));if(placed.some(function(p){return Math.abs(p.x-x)<166&&Math.abs(p.y-y)<82}))return false;chosen={x:x,y:y};return true});
      }
      chosen=chosen||point;placed.push(chosen);
      item.marker.setIcon(L.divIcon({className:'regency-marker',html:item.html,iconSize:[160,76],iconAnchor:[80+point.x-chosen.x,38+point.y-chosen.y]}));
      if(Math.abs(chosen.x-point.x)+Math.abs(chosen.y-point.y)>10)L.polyline([item.center,map.containerPointToLatLng([chosen.x,chosen.y])],{color:'#ad402b',weight:1,opacity:.65,interactive:false}).addTo(leaderLines);
    });
  }
  if(map)map.on('zoomend moveend',positionLabels);
  function render(){
    if(!model)return;
    var group=model.groups.find(function(g){return g.name===selected}),entries=group?group.events:model.events;
    if(!group)selected='';
    total.textContent=model.events.length?hectares(group?group.areaHa:model.areaHa):'Belum tersedia';
    count.textContent=entries.length+' kejadian terindikasi · '+(group?group.name:model.groups.length+' kabupaten/kota');
    heading.textContent=group?group.name:'Ringkasan kabupaten/kota';
    hint.textContent=group?'Klik polygon untuk detail kejadian. Kejadian lintas kabupaten ditampilkan utuh; luas ringkasan mengikuti irisan administrasi.':'Klik kluster kabupaten/kota untuk membuka polygon dan detail kejadian.';
    list.replaceChildren();
    overviewMarkers=[];
    if(map){map.closePopup();if(polygons)map.removeLayer(polygons);if(clusters)map.removeLayer(clusters);if(leaderLines)map.removeLayer(leaderLines);clusters=L.featureGroup();}
    if(!entries.length)list.textContent='Belum ada estimasi dengan citra pascakejadian yang layak pada periode ini.';
    if(group){
      var visible=[];entries.forEach(function(e){e.features.forEach(function(f){visible.push(f)})});
      if(map){
        var lookup=Object.create(null);entries.forEach(function(e){lookup[e.id]=e;e.bounds=L.latLngBounds([])});
        polygons=L.geoJSON({type:'FeatureCollection',features:visible},{style:{color:'#a73322',weight:2,fillColor:'#e04b31',fillOpacity:.34},onEachFeature:function(f,layer){var p=f.properties||{},e=lookup[p.archiveEventId||p.eventId];e.bounds.extend(layer.getBounds());layer.bindPopup(function(){return details(e)})}}).addTo(map);
        if(polygons.getBounds().isValid())map.fitBounds(polygons.getBounds(),{padding:[32,32],maxZoom:13});
      }
      entries.forEach(function(e){var p=e.p,b=button('<strong>'+esc((p.villages||[]).join(', ')||'Lokasi belum teridentifikasi')+'</strong><span class="area">'+hectares(e.allocations[selected])+' di '+esc(selected)+'</span><span class="muted">'+date(p.firstDetection)+' – '+date(p.lastDetection)+'</span>',function(){list.querySelectorAll('button').forEach(function(el){el.setAttribute('aria-pressed','false')});b.setAttribute('aria-pressed','true');map.invalidateSize();map.fitBounds(e.bounds,{padding:[32,32],maxZoom:15});L.popup().setLatLng(e.bounds.getCenter()).setContent(details(e)).openOn(map)});b.setAttribute('aria-pressed','false');b.disabled=!map||!e.bounds.isValid()});
    }else{
      model.groups.forEach(function(g){
        button('<strong>'+esc(g.name)+'</strong><span class="area">'+hectares(g.areaHa)+' estimasi</span><span class="muted">'+g.events.length+' kejadian · buka wilayah →</span>',function(){showGroup(g.name)});
        if(map){
          var features=[];g.events.forEach(function(e){e.features.forEach(function(f){features.push(f)})});
          var bounds=L.geoJSON({type:'FeatureCollection',features:features}).getBounds();
          if(bounds.isValid()){
            var icon=L.divIcon({className:'regency-marker',html:'<span class="regency-badge"><strong>'+esc(g.name)+'</strong><span>'+hectares(g.areaHa)+'</span><small>'+g.events.length+' kejadian</small></span>',iconSize:[160,76],iconAnchor:[80,38]});
            var marker=L.marker(bounds.getCenter(),{icon:icon,title:g.name+': '+hectares(g.areaHa)+' estimasi, '+g.events.length+' kejadian',alt:'Buka kejadian di '+g.name,keyboard:true}).on('click',function(){showGroup(g.name)}).addTo(clusters);
            overviewMarkers.push({marker:marker,center:bounds.getCenter(),html:icon.options.html});
          }
        }
      });
      if(map){clusters.addTo(map);if(clusters.getBounds().isValid())map.fitBounds(clusters.getBounds(),{padding:[80,90],maxZoom:8});else map.fitBounds([[-1.3,100],[2.9,104.95]]);positionLabels();}
    }
    allButton.disabled=!selected;
  }
  function loadPeriod(){
    var version=++requestVersion,report=reports[period.value],url=report?report.data:'data/burned-area-estimates.geojson';
    regency.disabled=true;allButton.disabled=true;list.textContent='Memuat lokasi…';
    overviewMarkers=[];if(map){if(polygons)map.removeLayer(polygons);if(clusters)map.removeLayer(clusters);if(leaderLines)map.removeLayer(leaderLines)}
    total.textContent='—';count.textContent='Memuat estimasi…';hint.textContent='Memuat peta untuk periode terpilih…';
    json(url).then(function(geo){
      if(version!==requestVersion)return;
      if(!Array.isArray(geo.features))throw Error('format');
      model=YG_BURNED_GROUPS.groupEvents(geo);
      regency.replaceChildren();var all=document.createElement('option');all.value='';all.textContent='Semua kabupaten/kota';regency.appendChild(all);
      model.groups.forEach(function(g){var option=document.createElement('option');option.value=g.name;option.textContent=g.name;regency.appendChild(option)});
      if(!model.groups.some(function(g){return g.name===selected}))selected='';regency.value=selected;regency.disabled=false;
      updated.textContent='Pembaruan terakhir: '+date(geo.generatedAt)+(report?' · Arsip bulanan '+(report.status==='partial'?'(data parsial)':''):'');
      render();
    }).catch(function(){if(version!==requestVersion)return;model=null;if(map){if(polygons)map.removeLayer(polygons);if(clusters)map.removeLayer(clusters)}total.textContent='Tidak tersedia';count.textContent='Estimasi belum dapat dimuat';list.textContent='Data lokasi belum dapat dimuat. Pilih periode lain atau muat ulang halaman.';updated.textContent='Waktu pembaruan belum tersedia';hint.textContent='Data peta belum tersedia untuk periode ini.'});
  }
  regency.addEventListener('change',function(){showGroup(regency.value)});
  period.addEventListener('change',loadPeriod);
  allButton.addEventListener('click',function(){showGroup('')});
  loadPeriod();
  json('data/burned-area-monthly/index.json').then(function(index){(index.reports||[]).forEach(function(r){if(!/^\d{4}-\d{2}$/.test(r.month)||r.data!=='data/burned-area-monthly/'+r.month+'.geojson')return;reports[r.month]=r;var option=document.createElement('option');option.value=r.month;option.textContent=new Date(r.month+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'Asia/Jakarta'})+(r.status==='partial'?' · parsial':'');period.appendChild(option)})}).catch(function(){document.getElementById('period-status').textContent='Arsip bulanan belum dapat dimuat. Periode terbaru tetap tersedia.'});
})();
