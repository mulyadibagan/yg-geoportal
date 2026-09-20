(function () {
  'use strict';
  var page = document.body.getAttribute('data-dayun-page');
  var proposalMode = true; // Public information only; no local submission routes.
  function alignWithLiveShell() {
    ['css/style.css?v=20260723-revert-layout','css/language-switcher.css?v=20260721-all-pages1','css/navigation-v2.css?v=20260807-mobile-submenu-links1','css/dayun.css?v=20260917-analysis1','css/user-location-control.css?v=20260920-location1'].forEach(function(href){
      if(!document.querySelector('link[href="'+href+'"]')){var link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.appendChild(link);}
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
  function fmtUpdatedAt(value) { if (!value) return 'Belum tersedia'; var date=new Date(value),day=new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(date),time=new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Jakarta'}).format(date).replace('.', ':'); return day+', '+time+' WIB'; }
  function fmtArea(value) { return value == null ? 'Belum dihitung' : Number(value).toLocaleString('id-ID',{minimumFractionDigits:0,maximumFractionDigits:2}) + ' ha'; }
  function fmtInteger(value) { return Math.round(Number(value)||0).toLocaleString('id-ID',{maximumFractionDigits:0}); }
  function cropName(value){return String(value||'').toLowerCase().replace(/(^|\s)\S/g,function(letter){return letter.toUpperCase();});}
  function cropArea(crop){return crop&&crop.operationalAreaKnownCount?fmtArea(crop.operationalAreaHa):'Belum tersedia';}
  function statusBadge(status) { return '<span class="dy-badge ' + String(status || '').toLowerCase() + '">' + esc(status || '-') + '</span>'; }
  function progressLabel(status) { return ({NOT_STARTED:'Belum dimulai',IN_PROGRESS:'Berjalan',COMPLETED:'Selesai',DELAYED:'Tertunda'})[status] || 'Belum dimulai'; }
  function publicObjectName(value) { return String(value || ''); }
  function toast(message) { var old=document.querySelector('.dy-toast'); if(old)old.remove(); var el=document.createElement('div'); el.className='dy-toast'; el.textContent=message; document.body.appendChild(el); setTimeout(function(){el.remove();},3600); }
  function byId(objects,id){return objects.find(function(x){return x.objectId===id;});}
  function safePhoto(input){var f=input&&input.files&&input.files[0];return f?{name:f.name,size:f.size,type:f.type}:null;}
  function serialize(form){var data={}; new FormData(form).forEach(function(v,k){if(v instanceof File)return;data[k]=v;}); return data;}
  function populateObjectSelect(select, objects){objects.filter(function(o){return o.monitoringEnabled!==false;}).forEach(function(o){var opt=document.createElement('option'),shortId=o.shortId||o.objectId,name=String(o.name||'').replace(shortId,'').trim();opt.value=o.objectId;opt.textContent=shortId+' · '+name;select.appendChild(opt);});}
  function pointInRing(point,ring){var inside=false,x=point.lng,y=point.lat;for(var i=0,j=ring.length-1;i<ring.length;j=i++){var xi=Number(ring[i][0]),yi=Number(ring[i][1]),xj=Number(ring[j][0]),yj=Number(ring[j][1]);if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;}return inside;}
  function pointInGeometry(point,geometry){if(!geometry||!geometry.coordinates)return false;var polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];return polygons.some(function(polygon){return polygon.length&&pointInRing(point,polygon[0])&&!polygon.slice(1).some(function(hole){return pointInRing(point,hole);});});}

  function cropGroupHtml(all,names,title,unit){
    var crops=names.map(function(name){return all.cropTotals[name];}).filter(function(crop){return crop&&crop.vegetationCount>0;});
    var plants=crops.reduce(function(sum,crop){return sum+crop.vegetationCount;},0);
    return '<section class="dy-crop-summary-group"><header><div><span>'+esc(title)+'</span><strong>'+fmtInteger(plants)+' '+unit+'</strong></div><small>'+fmtInteger(crops.length)+' jenis komoditas</small></header><div class="dy-crop-summary-list">'+crops.map(function(crop){return '<details class="dy-crop-summary-item"><summary><span><b>'+esc(cropName(crop.crop))+'</b><small>'+fmtInteger(crop.gawanganCount)+' gawangan · '+cropArea(crop)+'</small></span><strong>'+fmtInteger(crop.vegetationCount)+' '+unit+'</strong></summary><div class="dy-crop-summary-detail">'+(crop.plantingPeriods.length?'<p><b>Periode tanam tercatat:</b> '+esc(crop.plantingPeriods.join(', '))+'</p>':'<p>Periode tanam belum tersedia.</p>')+'<div>'+crop.gawanganIds.map(function(id){return '<a href="dayun-gawangan.html?object='+encodeURIComponent(id)+'">'+esc(id.replace('DAYUN-GT-',''))+'</a>';}).join('')+'</div></div></details>';}).join('')+'</div></section>';
  }

  function renderAgroSummary(summary){
    var target=document.getElementById('dayun-agro-summary'),pineappleEntry=document.getElementById('dayun-pineapple-entry'),overview=document.getElementById('dayun-block-overview');
    if(!target||!overview)return;
    var mapLayout=document.querySelector('.dy-map-layout');if(mapLayout&&mapLayout.previousElementSibling!==target)mapLayout.parentNode.insertBefore(target,mapLayout);
    var all=summary.all,dataUpdatedAt=summary.updatedAt;
    target.innerHTML='<div class="dy-summary-head"><div><span>AGROFORESTRI DAYUN</span><h2>Ringkasan Seluruh Blok A–F</h2></div><p>Informasi berasal dari data sumber awal dan kegiatan yang telah dipublikasikan. Status sensus terbaru ditampilkan pada setiap profil gawangan.</p></div><div class="dy-summary-kpis">'+[
      ['Luas seluruh blok',fmtArea(all.blockAreaHa)],['Luas gawangan tanam',fmtArea(all.gawanganAreaHa)],['Luas operasional tercatat',fmtArea(all.operationalAreaHa)],['Gawangan terpetakan',fmtInteger(all.mappedGawangan)],['Hortikultura',fmtInteger(all.horticulturePlants)+' tanaman · '+fmtInteger(all.horticultureTypes)+' jenis'],['Nanas tercatat',fmtInteger(all.pineapplePlants)+' tanaman'],['Buah dipanen',fmtInteger(all.pineappleHarvest)+' buah'],['MPTS',fmtInteger(all.mptsPlants)+' pohon · '+fmtInteger(all.mptsTypes)+' jenis']
    ].map(function(item){return '<article><small>'+item[0]+'</small><strong>'+item[1]+'</strong></article>';}).join('')+'</div><div class="dy-summary-foot"><span>'+fmtInteger(all.gawanganWithData)+' dari '+fmtInteger(all.mappedGawangan)+' gawangan memiliki informasi tanaman.</span><span>Data terakhir diperbarui: <b>'+fmtUpdatedAt(dataUpdatedAt)+'</b></span>'+(all.missingGawangan.length?'<span class="is-warning">'+fmtInteger(all.missingGawangan.length)+' gawangan belum memiliki data tanaman.</span>':'')+'</div><div class="dy-crop-summary-groups">'+cropGroupHtml(all,window.DayunAgroSummary.MPTS,'MPTS','pohon')+cropGroupHtml(all,window.DayunAgroSummary.HORTICULTURE,'Hortikultura','tanaman')+'</div>';
    if(pineappleEntry)pineappleEntry.innerHTML='<div class="dy-pineapple-entry-copy"><span>ANALISIS KOMODITAS</span><h2>Nanas Queen Dayun</h2><p>Buka analisis khusus untuk melihat populasi, luas operasional, pemupukan, ethrel, pembungaan, panen, HPT, serta prioritas pemeriksaan setiap gawangan.</p><div><small>POPULASI TERCATAT</small><strong>'+fmtInteger(all.pineapplePlants)+' tanaman</strong></div><div><small>BUAH DIPANEN</small><strong>'+fmtInteger(all.pineappleHarvest)+' buah</strong></div><div><small>DATA DIPERBARUI</small><strong>'+fmtUpdatedAt(dataUpdatedAt)+'</strong></div></div><a class="dy-pineapple-entry-link" href="dayun-analisis-nanas.html">Buka Analisis Nanas →</a>';
    overview.innerHTML='<div class="dy-section-head"><div><span>RINGKASAN PER BLOK</span><h2>Perbandingan Blok A–F</h2></div><p>Pilih satu blok untuk melihat peta, komposisi tanaman, riwayat panen, dan daftar gawangan penyusunnya.</p></div><div class="dy-block-table-wrap"><table class="dy-block-table"><thead><tr><th>Blok</th><th>Gawangan</th><th>Luas blok</th><th>Luas gawangan</th><th>Hortikultura</th><th>Nanas</th><th>Dipanen</th><th>MPTS</th><th></th></tr></thead><tbody>'+summary.codes.map(function(code){var block=summary.blocks[code];return '<tr><th scope="row">'+block.name+'</th><td>'+fmtInteger(block.gawanganWithData)+' / '+fmtInteger(block.mappedGawangan)+'</td><td>'+fmtArea(block.blockAreaHa)+'</td><td>'+fmtArea(block.gawanganAreaHa)+'</td><td>'+fmtInteger(block.horticulturePlants)+' · '+fmtInteger(block.horticultureTypes)+' jenis</td><td>'+fmtInteger(block.pineapplePlants)+'</td><td>'+fmtInteger(block.pineappleHarvest)+'</td><td>'+fmtInteger(block.mptsPlants)+' · '+fmtInteger(block.mptsTypes)+' jenis</td><td><a href="dayun-blok.html?block='+code+'">Lihat detail →</a></td></tr>';}).join('')+'</tbody></table></div><p class="dy-summary-note">Luas operasional dihitung satu kali per gawangan dari luas operasional komoditas terbesar, sehingga komoditas yang berada pada ruang tanam yang sama tidak dijumlahkan ganda.</p>';
  }

  function loadDayunSpatialData(){
    return Promise.all([
      window.DayunDataSource.fetchJSON('data/dayun-map.geojson?v=20260916-objectid1'),
      window.DayunDataSource.fetchJSON('data/dayun-context.geojson?v=20260908-1'),
      window.DayunDataSource.fetchJSON('data/dayun-gawangan-details.json?v=20260918-data-updated1'),
      window.DayunDataSource.fetchJSON('data/dayun-blocks.geojson?v=20260916-official1')
    ]);
  }

  function initDayunMap(data,spatialDataPromise){
    var mapEl=document.getElementById('dayun-map'),legendEl=document.getElementById('dayun-layers');
    if(!mapEl||!legendEl)return;
    var intro=document.querySelector('.dy-map-page-intro p');if(intro)intro.textContent='Klik polygon untuk melihat luas blok dan gawangan tanam, lalu buka profil lengkapnya pada halaman baru.';
    if(typeof L==='undefined'){mapEl.innerHTML='<div class="dy-map-loading">Pustaka peta tidak dapat dimuat.</div>';return;}
    var loading=mapEl.querySelector('.dy-map-loading');if(loading)loading.remove();
    var satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:20,attribution:'Tiles &copy; Esri'});
    var osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxNativeZoom:19,maxZoom:20,attribution:'&copy; OpenStreetMap contributors'});
    var map=L.map(mapEl,{zoomControl:true,layers:[satellite],preferCanvas:true}).setView([0.5844,102.009],17);
    var locationStatus=document.createElement('p');locationStatus.className='dy-location-status';locationStatus.textContent='Aktifkan lokasi untuk melihat posisi Anda terhadap Kampung Dayun, kawasan HKm, blok, dan gawangan.';legendEl.prepend(locationStatus);
    var locationButton=null,locationControl=L.control({position:'topleft'});
    locationControl.onAdd=function(){locationButton=L.DomUtil.create('button','dy-location-control yg-location-button leaflet-bar');locationButton.type='button';locationButton.setAttribute('aria-label','Tampilkan lokasi saya');locationButton.innerHTML='<span data-location-label>Lokasi saya</span>';L.DomEvent.disableClickPropagation(locationButton);return locationButton;};
    locationControl.addTo(map);
    var expandControl=L.control({position:'topleft'});
    expandControl.onAdd=function(){var button=L.DomUtil.create('button','dy-map-expand leaflet-bar');button.type='button';button.title='Buka peta layar penuh';button.setAttribute('aria-label','Buka peta layar penuh');button.innerHTML='⛶';L.DomEvent.disableClickPropagation(button);L.DomEvent.on(button,'click',function(){var expanded=mapEl.classList.toggle('is-fullscreen');document.body.classList.toggle('dy-map-open',expanded);button.innerHTML=expanded?'×':'⛶';button.title=expanded?'Tutup peta layar penuh':'Buka peta layar penuh';button.setAttribute('aria-label',button.title);setTimeout(function(){map.invalidateSize();},100);});return button;};
    expandControl.addTo(map);document.addEventListener('keydown',function(event){if(event.key==='Escape'&&mapEl.classList.contains('is-fullscreen')){mapEl.classList.remove('is-fullscreen');document.body.classList.remove('dy-map-open');var button=mapEl.querySelector('.dy-map-expand');if(button){button.innerHTML='⛶';button.title='Buka peta layar penuh';button.setAttribute('aria-label',button.title);}setTimeout(function(){map.invalidateSize();},100);}});
    (spatialDataPromise||loadDayunSpatialData()).then(function(results){
      var geojson=results[0],contextGeojson=results[1],gawanganData=results[2],blockGeojson=results[3],agroSummary=window.DayunAgroSummary.build(gawanganData,geojson,blockGeojson),gawanganById={},blockByName={},gawanganAreaByBlock={},countedGawangan={},objectProperties={},groups={},featureLayers={},categoryBounds={},contextLayers={},active=data.layers[0].id;
      function describePosition(latlng){var gawangan=(geojson.features||[]).find(function(feature){return (feature.properties||{}).category==='Gawangan Tanam'&&pointInGeometry(latlng,feature.geometry);});if(gawangan){var gp=gawangan.properties||{};return 'Di '+String(gp.displayId||gp.shortId||gp.name||'gawangan tanam')+(gp.block?' · '+gp.block:'');}var block=(blockGeojson.features||[]).find(function(feature){return pointInGeometry(latlng,feature.geometry);});if(block)return 'Di '+String((block.properties||{}).name||'areal Blok Dayun');var hkm=(contextGeojson.features||[]).find(function(feature){return (feature.properties||{}).contextId==='ps-hkm'&&pointInGeometry(latlng,feature.geometry);});if(hkm)return 'Di dalam kawasan HKm Mandiri Sejahtera';var village=(contextGeojson.features||[]).find(function(feature){return (feature.properties||{}).contextId==='desa-dayun'&&pointInGeometry(latlng,feature.geometry);});return village?'Di dalam Kampung Dayun':'Di luar Kampung Dayun';}
      if(locationButton&&window.YGUserLocation){window.YGUserLocation.create(map,{button:locationButton,startLabel:'Lokasi saya',loadingLabel:'Mencari lokasi…',stopLabel:'Hentikan lokasi',maxZoom:18,describePosition:describePosition,onStatus:function(message,kind){locationStatus.textContent=message;locationStatus.classList.toggle('is-ok',kind==='ok');locationStatus.classList.toggle('is-error',kind==='error');}});}
      renderAgroSummary(agroSummary);
      (gawanganData.objects||[]).forEach(function(item){gawanganById[item.objectId]=item;});
      (geojson.features||[]).forEach(function(feature){var p=feature.properties||{},id=p.objectId||p.featureId;if(p.category!=='Gawangan Tanam'||!p.block||!id||countedGawangan[id])return;countedGawangan[id]=true;gawanganAreaByBlock[p.block]=(gawanganAreaByBlock[p.block]||0)+Number(p.sourceGawanganAreaHa!=null?p.sourceGawanganAreaHa:p.areaHa||0);});
      (blockGeojson.features||[]).forEach(function(feature){var p=feature.properties||{},name=p.name||('Blok '+p.blockCode),summary=agroSummary.blocks[p.blockCode];if(name)blockByName[name]={name:name,code:p.blockCode,areaHa:p.areaHa,gawanganAreaHa:gawanganAreaByBlock[name]||0,summary:summary};});
      data.layers.forEach(function(layer){groups[layer.id]=L.featureGroup();});
      contextGeojson.features.forEach(function(feature){var p=feature.properties||{},isVillage=p.contextId==='desa-dayun';var layer=L.geoJSON(feature,{style:isVillage?{color:'#49a7ff',weight:3,opacity:.95,fillColor:'#49a7ff',fillOpacity:.035,dashArray:'12 8'}:{color:'#ffe14f',weight:3,opacity:1,fillColor:'#ffe14f',fillOpacity:.07,dashArray:'7 5'},onEachFeature:function(f,l){l.bindPopup(isVillage?'<div class="dy-map-popup"><b>Desa Dayun</b><span>Wilayah pelaksanaan Program Dayun</span></div>':'<div class="dy-map-popup"><b>HKm Mandiri Sejahtera</b><span>Wilayah kelola masyarakat seluas '+Number(p.permitAreaHa||0).toLocaleString('id-ID')+' ha</span></div>');}});contextLayers[p.contextId]=layer;layer.addTo(map);});
      map.createPane('blockBoundaryPane');map.getPane('blockBoundaryPane').style.zIndex=390;
      var blockHalo=L.geoJSON(blockGeojson,{pane:'blockBoundaryPane',interactive:false,style:{color:'#ffffff',weight:7,opacity:.9,fill:false,lineCap:'round',lineJoin:'round'}});
      var blockLines=L.geoJSON(blockGeojson,{pane:'blockBoundaryPane',style:function(feature){var p=feature.properties||{};return{color:p.color||'#7c3aed',weight:4,opacity:1,fillColor:p.color||'#7c3aed',fillOpacity:.025,lineCap:'round',lineJoin:'round'};},onEachFeature:function(feature,layer){var p=feature.properties||{},blockName=p.name||'Blok',blockInfo=blockByName[blockName]||{},summary=blockInfo.summary||{};layer.bindTooltip(esc(blockName),{permanent:true,direction:'center',className:'dy-block-label'});layer.bindPopup('<div class="dy-map-popup"><b>'+esc(blockName)+'</b><div class="dy-map-popup-metrics"><span><small>Luas blok</small><strong>'+fmtArea(p.areaHa)+'</strong></span><span><small>Luas gawangan tanam</small><strong>'+fmtArea(blockInfo.gawanganAreaHa)+'</strong></span><span><small>Gawangan memiliki data</small><strong>'+fmtInteger(summary.gawanganWithData)+' / '+fmtInteger(summary.mappedGawangan)+'</strong></span><span><small>Hortikultura</small><strong>'+fmtInteger(summary.horticulturePlants)+' · '+fmtInteger(summary.horticultureTypes)+' jenis</strong></span><span><small>Nanas tercatat</small><strong>'+fmtInteger(summary.pineapplePlants)+'</strong></span><span><small>Buah dipanen</small><strong>'+fmtInteger(summary.pineappleHarvest)+'</strong></span><span><small>MPTS</small><strong>'+fmtInteger(summary.mptsPlants)+' · '+fmtInteger(summary.mptsTypes)+' jenis</strong></span></div><div class="dy-map-popup-actions"><a href="dayun-blok.html?block='+encodeURIComponent(blockInfo.code)+'">Lihat detail blok →</a></div></div>');}});
      var blockLayer=L.layerGroup([blockHalo,blockLines]).addTo(map);contextLayers.blocks=blockLayer;
      L.control.layers({'Satelit':satellite,'OpenStreetMap':osm},{'Batas Desa Dayun':contextLayers['desa-dayun'],'PS HKm Mandiri Sejahtera':contextLayers['ps-hkm'],'Blok A–F':blockLayer},{position:'topright'}).addTo(map);
      function featureStyle(feature){var p=feature.properties||{};return p.line?{color:p.color||'#ef7d00',weight:3,opacity:.92,dashArray:'7 5'}:{color:'#173f32',weight:1.5,opacity:.95,fillColor:p.color||'#6baa91',fillOpacity:.18};}
      L.geoJSON(geojson,{style:featureStyle,onEachFeature:function(feature,layer){
        var p=feature.properties||{},object=byId(data.objects,p.objectId);
        if(p.objectId&&!objectProperties[p.objectId])objectProperties[p.objectId]=p;
        var areaText=p.sourceGawanganId?'Luas gawangan '+fmtArea(p.sourceGawanganAreaHa):(p.areaHa==null?'Bagian dari kebun nanas seluas '+Number(p.parentAreaHa||0).toLocaleString('id-ID')+' ha':'Luas pada peta '+fmtArea(p.areaHa));
        var blockInfo=blockByName[p.block]||null,blockText=p.block||(p.blockCoverage||''),gawanganName=p.displayId||p.shortId||p.displayName||p.name;
        var areaMetrics=p.category==='Gawangan Tanam'?'<div class="dy-map-popup-metrics">'+(blockText?'<span><small>Blok</small><b>'+esc(blockText)+'</b><strong>'+fmtArea(blockInfo&&blockInfo.areaHa)+'</strong></span>':'')+'<span><small>Gawangan tanam</small><b>'+esc(gawanganName)+'</b><strong>'+fmtArea(p.sourceGawanganAreaHa!=null?p.sourceGawanganAreaHa:p.areaHa)+'</strong></span></div>':(blockText?'<span>'+esc(blockText)+'</span>':'')+'<span>'+areaText+'</span>';
        var partLine=Number(p.sourcePartCount)>1?'<span>Bagian '+Number(p.sourcePartIndex)+' dari '+Number(p.sourcePartCount)+' · luas poligon '+fmtArea(p.areaHa)+'</span>':'';
        var profileUrl=p.category==='Gawangan Tanam'&&p.objectId?'dayun-gawangan.html?object='+encodeURIComponent(p.objectId):'',detailLink=profileUrl?'<div class="dy-map-popup-actions"><a href="'+profileUrl+'" target="_blank" rel="noopener">Buka profil gawangan ↗</a></div>':'';
        var gawanganRecord=gawanganById[p.objectId],cropLine=gawanganRecord&&gawanganRecord.crops.length?'<span>'+esc(gawanganRecord.crops.map(function(crop){return crop.crop;}).join(' · '))+'</span>':'<span>Data tanaman belum tersedia</span>';
        layer.bindPopup('<div class="dy-map-popup"><b>'+esc(publicObjectName(p.displayName||p.name))+'</b>'+areaMetrics+partLine+cropLine+(profileUrl?'<small>Buka halaman profil untuk melihat informasi tanaman.</small>':'')+detailLink+'</div>');
        if(p.displayId||p.shortId){
          var isGawangan=p.category==='Gawangan Tanam';
          layer.bindTooltip(esc(p.displayId||p.shortId),isGawangan?{permanent:true,direction:'center',className:'dy-gawangan-label'}:{sticky:true,direction:'top'});
        }
        layer.on('click',function(){document.querySelectorAll('.dy-object-key').forEach(function(x){x.classList.toggle('active',x.getAttribute('data-category')===p.category);});});
        if(groups[p.layerId])groups[p.layerId].addLayer(layer);if(!featureLayers[p.objectId])featureLayers[p.objectId]=[];featureLayers[p.objectId].push(layer);if(!categoryBounds[p.category])categoryBounds[p.category]=L.latLngBounds([]);categoryBounds[p.category].extend(layer.getBounds());
      }});
      function renderLegend(){
        var layer=data.layers.find(function(x){return x.id===active;}),items=layer.items||[];
        var gawanganIds=Object.keys(objectProperties).filter(function(id){return /^DAYUN-GT-[A-F]-\d{2}$/.test(id);}).sort(function(a,b){return a.localeCompare(b,'id',{numeric:true});}),cropTypes={};(gawanganData.objects||[]).forEach(function(item){(item.crops||[]).forEach(function(crop){cropTypes[crop.crop]=true;});});
        legendEl.innerHTML='<div class="dy-context-panel"><b>Lokasi program</b><span><i class="dy-context-line village"></i>Kampung Dayun</span><span><i class="dy-context-line hkm"></i>HKm Mandiri Sejahtera · 980 ha</span><span><i class="dy-context-line block"></i>Pembagian Blok A–F</span><div class="dy-context-actions"><button type="button" data-context="objects">Lihat kebun</button><button type="button" data-context="blocks">Lihat blok</button><button type="button" data-context="hkm">Lihat kawasan HKm</button><button type="button" data-context="village">Lihat Kampung Dayun</button></div></div><div class="dy-gawangan-data-summary"><span><b>'+gawanganIds.length+'</b> polygon gawangan</span><span><b>'+Number(gawanganData.summary&&gawanganData.summary.gawanganWithData||0)+'</b> memiliki data</span><span><b>'+Object.keys(cropTypes).length+'</b> komoditas</span></div><label class="dy-gawangan-picker"><span>Cari gawangan</span><select><option value="">Pilih Blok–Gawangan</option>'+gawanganIds.map(function(id){var record=gawanganById[id],short=id.replace('DAYUN-GT-','');return '<option value="'+esc(id)+'">'+esc(short+(record&&record.crops.length?' · '+record.crops.map(function(crop){return crop.crop;}).join(', '):' · data belum tersedia'))+'</option>';}).join('')+'</select></label><div class="dy-layer-tabs">'+data.layers.map(function(x){return '<button type="button" class="dy-layer-tab '+(x.id===active?'active':'')+'" data-map-layer="'+esc(x.id)+'">'+esc(x.publicName||x.name)+'</button>';}).join('')+'</div><div class="dy-legend-panel"><div class="dy-legend-heading"><div><b>'+esc(layer.publicName||layer.name)+'</b><small>Pembagian areal kebun</small></div><span class="dy-legend-total">'+layer.reportedTotalHa.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})+' ha</span></div><div class="dy-object-list">'+items.map(function(item){return '<button type="button" class="dy-object-key" data-category="'+esc(item.category)+'"><i class="dy-object-swatch" style="background:'+esc(item.color||'#6baa91')+'"></i><span class="dy-object-copy"><b>'+esc(item.name)+'</b><small>'+item.featureCount+' bagian</small></span><span class="dy-object-area">'+fmtArea(item.areaHa)+'</span></button>';}).join('')+'</div></div>';
        legendEl.prepend(locationStatus);
        var picker=legendEl.querySelector('.dy-gawangan-picker select');if(picker)picker.addEventListener('change',function(){var id=picker.value;if(!id)return;window.open('dayun-gawangan.html?object='+encodeURIComponent(id),'_blank','noopener');picker.value='';});
        legendEl.querySelectorAll('[data-map-layer]').forEach(function(btn){btn.addEventListener('click',function(){switchLayer(btn.getAttribute('data-map-layer'));});});
        legendEl.querySelectorAll('[data-category]').forEach(function(btn){btn.addEventListener('click',function(){var bounds=categoryBounds[btn.getAttribute('data-category')];if(!bounds||!bounds.isValid())return;map.fitBounds(bounds,{padding:[36,36],maxZoom:18});document.querySelectorAll('.dy-object-key').forEach(function(x){x.classList.toggle('active',x===btn);});});});
        legendEl.querySelectorAll('[data-context]').forEach(function(btn){btn.addEventListener('click',function(){var target=btn.getAttribute('data-context');if(target==='objects')map.fitBounds(groups[active].getBounds(),{padding:[24,24]});if(target==='blocks')map.fitBounds(contextLayers.blocks.getBounds(),{padding:[28,28]});if(target==='hkm')map.fitBounds(contextLayers['ps-hkm'].getBounds(),{padding:[28,28]});if(target==='village')map.fitBounds(contextLayers['desa-dayun'].getBounds(),{padding:[28,28]});});});
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

  }

  function monthLabel(value){return new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(value+'T12:00:00+07:00'));}
  function rainDate(value,withYear){return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:withYear?'numeric':undefined,timeZone:'Asia/Jakarta'}).format(new Date(value+'T12:00:00+07:00'));}
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
    var first=rows[0].date,last=rows[rows.length-1].date,periodEl=document.getElementById('dayun-rain-chart-period');
    if(periodEl)periodEl.textContent=rainDate(first,true)+'–'+rainDate(last,true);
    var max=Math.max.apply(null,rows.map(function(row){return row.rain;})),chartH=242,base=184,top=18,left=42,chartEl=document.getElementById('dayun-rain-chart'),available=Math.max(0,(chartEl.parentElement&&chartEl.parentElement.clientWidth||0)-24),width=Math.max(760,available),plotWidth=width-left-18,step=plotWidth/Math.max(rows.length,1),barW=Math.max(3,Math.min(12,step*.72)),scale=max?((base-top)/max):1;
    var grid=[0,.25,.5,.75,1].map(function(part){var value=max*part,y=base-value*scale;return '<line x1="'+left+'" y1="'+y+'" x2="'+(width-12)+'" y2="'+y+'" stroke="#dce7e1" stroke-width="1"/><text x="'+(left-7)+'" y="'+(y+3)+'" text-anchor="end" fill="#66776f" font-size="9">'+dayunNum(value,0)+'</text>';}).join('');
    var bars=rows.map(function(row,index){var height=row.rain*scale,x=left+index*step+(step-barW)/2,y=base-height,label=rainDate(row.date,true)+': '+dayunNum(row.rain,1)+' mm';return '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+Math.max(height,row.rain>0?1:0)+'" rx="2" fill="#1687a7" tabindex="0" role="img" aria-label="'+label+'"><title>'+label+'</title></rect>';}).join('');
    var dateTicks=[];rows.forEach(function(row,index){if(index%7!==0&&index!==rows.length-1)return;var x=left+index*step+step/2;dateTicks.push('<line x1="'+x+'" y1="'+base+'" x2="'+x+'" y2="'+(base+4)+'" stroke="#81968c" stroke-width="1"/><text x="'+x+'" y="202" text-anchor="middle" fill="#52675e" font-size="9">'+rainDate(row.date,false)+'</text>');});
    chartEl.innerHTML='<svg viewBox="0 0 '+width+' '+chartH+'" width="'+width+'" height="'+chartH+'" aria-label="Grafik curah hujan harian Dayun, '+rainDate(first,true)+' sampai '+rainDate(last,true)+'">'+grid+'<line x1="'+left+'" y1="'+base+'" x2="'+(width-12)+'" y2="'+base+'" stroke="#9db3a8" stroke-width="1"/>'+bars+dateTicks.join('')+'<text x="'+left+'" y="225" fill="#52675e" font-size="10" font-weight="700">Tanggal pengamatan</text></svg>';
    var total=rows.reduce(function(sum,row){return sum+row.rain;},0);
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
    var months=[
      {number:1,label:'Okt 2026'},{number:2,label:'Nov 2026'},{number:3,label:'Des 2026'},
      {number:4,label:'Jan 2027'},{number:5,label:'Feb 2027'},{number:6,label:'Mar 2027'},
      {number:7,label:'Apr 2027'},{number:8,label:'Mei 2027'},{number:9,label:'Jun 2027'},
      {number:10,label:'Jul 2027'},{number:11,label:'Agu 2027'},{number:12,label:'Sep 2027'}
    ];
    document.getElementById('dayun-timeline').innerHTML='<div class="dy-workplan-scroll" role="region" aria-label="Tahapan 23 kegiatan Oktober 2026 sampai September 2027, dapat digeser" tabindex="0"><table class="dy-workplan"><thead><tr><th scope="col">Kegiatan utama</th>'+months.map(function(month){return '<th scope="col">'+month.label+'</th>';}).join('')+'</tr></thead><tbody>'+data.timeline.map(function(item){return '<tr><th scope="row">'+esc(item.title)+'</th>'+months.map(function(month){var scheduled=item.months.indexOf(month.number)!==-1;return '<td class="'+(scheduled?'scheduled':'')+'">'+(scheduled?'<span aria-label="Direncanakan pada '+month.label+'">●</span>':'')+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div><div class="dy-workplan-note"><span><i></i>Periode kegiatan yang direncanakan</span><small>Jadwal program: Oktober 2026–September 2027; dapat menyesuaikan perkembangan pelaksanaan.</small></div>';
    initDayunMap(data);
    initDayunWeather();
  }
  function initWhenNear(sectionId,callback){
    var section=document.getElementById(sectionId),started=false;
    if(!section)return;
    function start(){if(started)return;started=true;callback();}
    if(!('IntersectionObserver' in window)){setTimeout(start,1200);return;}
    var observer=new IntersectionObserver(function(entries){
      if(entries.some(function(entry){return entry.isIntersecting;})){observer.disconnect();start();}
    },{rootMargin:'500px 0px'});
    observer.observe(section);
  }
  var spatialDataPromise=page==='map'?loadDayunSpatialData():null;
  window.DayunDataSource.fetchJSON('data/dayun-program.json?v=20260917-performance1').then(function(data){
    data.objects=[];
    if(page==='map'){
      initDayunMap(data,spatialDataPromise);
      initWhenNear('cuaca-kebun',initDayunWeather);
      initWhenNear('riwayat-hujan',initDayunRainHistory);
    }else initLanding(data);
  }).catch(function(error){console.error(error);toast(error.message);});
})();
