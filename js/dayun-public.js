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
      header.innerHTML='<div class="header-inner"><a class="brand" href="index.html"><img src="assets/logo-yayasan-gambut.png" alt="Logo Yayasan Gambut"><span><strong>YG GeoPortal</strong><span>WebGIS Yayasan Gambut</span></span></a><button class="yg-nav-toggle" type="button" aria-label="Buka menu" aria-expanded="false" data-yg-nav-toggle="main-navigation">☰</button><nav class="nav yg-nav-v2" id="main-navigation" aria-label="Navigasi utama" data-yg-navigation><a href="index.html">Beranda</a><a href="webgis.html">Peta Interaktif</a><div class="yg-nav-group"><button class="yg-nav-trigger" type="button" aria-expanded="false">Jelajahi</button><div class="yg-nav-menu"><a href="biodiversity.html">Biodiversitas</a><a href="fire-weather.html">Karhutla &amp; Cuaca</a><a href="coastal-monitoring.html">Pesisir &amp; Mangrove</a><a href="social-forestry-directory.html">Direktori Perhutanan Sosial<small>Profil spasial dan dokumen nonspasial</small></a></div></div><div class="yg-nav-group"><button class="yg-nav-trigger" type="button" aria-expanded="false">Program Dayun</button><div class="yg-nav-menu"><a href="dayun.html">Ringkasan Program<small>KUPS Rimba Sejahtera</small></a><a href="dayun.html#peta-dayun">Peta Program<small>Lokasi dan pembagian areal</small></a><a href="dayun.html#arah-program">Tujuan Program<small>Perubahan yang ingin dicapai</small></a><a href="dayun.html#perjalanan-program">Perjalanan Program<small>Rencana kegiatan 12 bulan</small></a></div></div><a href="report.html">Laporkan Temuan</a><a href="staff-login.html">Login Staf</a><span class="yg-public-language-switcher" role="group" aria-label="Pilihan bahasa / Language selection"><button type="button" data-lang="id" aria-pressed="true">ID</button><button type="button" data-lang="en" aria-pressed="false">EN</button></span></nav></div>';
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

  function initLanding(data){
    var eyebrow=document.querySelector('.dy-hero .dy-eyebrow');if(eyebrow)eyebrow.textContent='APRIL Group · Yayasan Gambut · Kampung Dayun';
    document.getElementById('dayun-outcomes').innerHTML=data.outcomes.map(function(x,i){return '<article class="dy-card"><div class="dy-number">0'+(i+1)+'</div><h3>'+esc(x.title)+'</h3><p>'+esc(x.description)+'</p></article>';}).join('');
    var months=Array.from({length:12},function(_,i){return i+1;});
    document.getElementById('dayun-timeline').innerHTML='<div class="dy-workplan-scroll" role="region" aria-label="Tahapan 23 kegiatan, dapat digeser" tabindex="0"><table class="dy-workplan"><thead><tr><th scope="col">Kegiatan utama</th>'+months.map(function(month){return '<th scope="col"><span>Bulan </span>'+month+'</th>';}).join('')+'</tr></thead><tbody>'+data.timeline.map(function(item){return '<tr><th scope="row">'+esc(item.title)+'</th>'+months.map(function(month){var scheduled=item.months.indexOf(month)!==-1;return '<td class="'+(scheduled?'scheduled':'')+'">'+(scheduled?'<span aria-label="Direncanakan pada bulan '+month+'">●</span>':'')+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div><div class="dy-workplan-note"><span><i></i>Periode kegiatan yang direncanakan</span><small>Jadwal mengikuti waktu mulai dan perkembangan pelaksanaan program.</small></div>';
    initDayunMap(data);
  }
  fetch('data/dayun-program.json', {cache:'no-store'}).then(function(response){if(!response.ok)throw new Error('Informasi program belum dapat dimuat.');return response.json();}).then(function(data){data.objects=[];initLanding(data);}).catch(function(error){console.error(error);toast(error.message);});
})();
