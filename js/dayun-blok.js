(function () {
  'use strict';
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function integer(value){return Math.round(Number(value)||0).toLocaleString('id-ID',{maximumFractionDigits:0});}
  function area(value){return Number(value||0).toLocaleString('id-ID',{minimumFractionDigits:0,maximumFractionDigits:2})+' ha';}
  function date(value){if(!value)return'Belum tersedia';return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(value+'T12:00:00+07:00'));}
  function month(value){return new Intl.DateTimeFormat('id-ID',{month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(value+'T12:00:00+07:00'));}
  function cropLabel(value){return String(value||'').toLowerCase().replace(/(^|\s)\S/g,function(letter){return letter.toUpperCase();});}
  function cropArea(crop){return crop.operationalAreaKnownCount?area(crop.operationalAreaHa):'Belum tersedia';}

  function cropGroup(block,names,title,unit){
    var crops=names.map(function(name){return block.cropTotals[name];}).filter(function(crop){return crop&&crop.vegetationCount>0;}),plants=crops.reduce(function(sum,crop){return sum+crop.vegetationCount;},0);
    return '<section class="dy-crop-group-panel"><header class="dy-crop-group-head"><div><span>'+esc(title.toUpperCase())+'</span><h3>'+esc(title)+'</h3></div><p><strong>'+integer(plants)+' '+unit+'</strong><small>'+integer(crops.length)+' jenis dalam blok ini</small></p></header><div class="dy-block-crops-grid">'+(crops.length?crops.map(function(crop){var isPineapple=crop.crop==='NANAS',isRambutan=crop.crop==='RAMBUTAN';return'<article><header><h3>'+esc(cropLabel(crop.crop))+'</h3><span>'+integer(crop.gawanganCount)+' gawangan</span></header><dl><div><dt>Jumlah tercatat</dt><dd>'+integer(crop.vegetationCount)+' '+unit+'</dd></div><div><dt>Luas operasional</dt><dd>'+cropArea(crop)+'</dd></div><div><dt>Periode tanam</dt><dd>'+(crop.plantingPeriods.length?esc(crop.plantingPeriods.join(', ')):'Belum tersedia')+'</dd></div>'+(isPineapple?'<div><dt>Buah dipanen</dt><dd>'+integer(crop.harvestCount)+'</dd></div><div><dt>Aplikasi ethrel</dt><dd>'+integer(crop.ethrelCount)+' tanaman</dd></div><div><dt>Tanaman berbunga</dt><dd>'+integer(crop.flowerCount)+'</dd></div><div><dt>Bibit tersedia</dt><dd>'+integer(crop.seedlingCount)+'</dd></div>':'')+'</dl><details class="dy-crop-gawangan"><summary>Lihat '+integer(crop.gawanganIds.length)+' gawangan</summary><div>'+crop.gawanganIds.map(function(id){return'<a href="dayun-gawangan.html?object='+encodeURIComponent(id)+'">'+esc(id.replace('DAYUN-GT-',''))+'</a>';}).join('')+'</div></details>'+(isRambutan?'<a class="dy-crop-sop-link" href="dayun-sop-rambutan.html">Buka SOP rambutan →</a>':'')+(isPineapple?'<a class="dy-crop-sop-link" href="dayun-sop-nanas.html">Buka SOP nanas →</a>':'')+'</article>';}).join(''):'<div class="dy-crop-group-empty">Belum ada jumlah tanaman yang tercatat untuk kelompok ini.</div>')+'</div></section>';
  }

  function initMap(code,mapData,blockData){
    var satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:20,attribution:'Tiles &copy; Esri'}),osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxNativeZoom:19,maxZoom:20,attribution:'&copy; OpenStreetMap contributors'}),map=L.map('db-map',{layers:[satellite]});
    var selectedBlock=(blockData.features||[]).filter(function(feature){return feature.properties&&feature.properties.blockCode===code;});
    var boundary=L.geoJSON({type:'FeatureCollection',features:selectedBlock},{style:function(feature){var p=feature.properties||{};return{color:p.color||'#7c3aed',weight:5,opacity:1,fillColor:p.color||'#7c3aed',fillOpacity:.07};}}).addTo(map);
    var gawanganFeatures=(mapData.features||[]).filter(function(feature){var p=feature.properties||{};return p.category==='Gawangan Tanam'&&String(p.block||'').replace(/^Blok\s+/i,'')===code;});
    var gawangan=L.geoJSON({type:'FeatureCollection',features:gawanganFeatures},{style:{color:'#143f31',weight:1.5,opacity:1,fillColor:'#39a774',fillOpacity:.28},onEachFeature:function(feature,layer){var p=feature.properties||{},id=p.objectId,short=String(id||'').replace('DAYUN-GT-','');layer.bindTooltip(esc(short),{sticky:true,direction:'top'});layer.bindPopup('<div class="dy-map-popup"><b>Gawangan '+esc(short)+'</b><span>Luas poligon '+area(p.sourceGawanganAreaHa!=null?p.sourceGawanganAreaHa:p.areaHa)+'</span><div class="dy-map-popup-actions"><a href="dayun-gawangan.html?object='+encodeURIComponent(id)+'">Buka profil gawangan →</a></div></div>');}}).addTo(map);
    var overlays={};overlays['Batas Blok '+code]=boundary;overlays['Gawangan tanam']=gawangan;L.control.layers({'Satelit':satellite,'OpenStreetMap':osm},overlays,{position:'topright'}).addTo(map);
    var bounds=boundary.getBounds();if(bounds.isValid())map.fitBounds(bounds,{padding:[28,28],maxZoom:18});
  }

  function renderHarvest(block){
    var section=document.getElementById('db-harvest-section'),target=document.getElementById('db-harvest'),pineapple=block.cropTotals.NANAS,history=pineapple&&pineapple.harvestHistory||{},rows=Object.keys(history).sort().map(function(period){return{period:period,count:history[period]};});
    if(!rows.length){section.hidden=true;return;}
    var max=Math.max.apply(null,rows.map(function(row){return row.count;}));
    target.innerHTML='<div class="dy-block-harvest-total"><small>Total panen tercatat</small><strong>'+integer(block.pineappleHarvest)+' buah</strong><span>'+rows.length+' periode panen</span></div><div class="dy-block-harvest-chart" role="img" aria-label="Grafik riwayat panen nanas Blok '+esc(block.code)+'">'+rows.map(function(row){var height=max?Math.max(8,Math.round(row.count/max*150)):8;return '<div class="dy-block-harvest-column"><strong>'+integer(row.count)+'</strong><span style="height:'+height+'px"></span><small>'+month(row.period)+'</small></div>';}).join('')+'</div>';
  }

  function render(code,summary,mapData,blockData){
    var block=summary.blocks[code];
    document.title='Blok '+code+' Agroforestri Dayun | YG GeoPortal';
    document.getElementById('db-breadcrumb').textContent='Blok '+code;
    document.getElementById('db-title').textContent='Blok '+code;
    document.getElementById('db-meta').textContent=integer(block.gawanganWithData)+' dari '+integer(block.mappedGawangan)+' gawangan memiliki informasi tanaman · catatan terakhir '+date(block.latestRecordDate);
    document.getElementById('db-map-title').textContent='Sebaran gawangan Blok '+code;
    var select=document.getElementById('db-block-select');select.innerHTML=summary.codes.map(function(item){return'<option value="'+item+'"'+(item===code?' selected':'')+'>Blok '+item+'</option>';}).join('');select.addEventListener('change',function(){location.href='dayun-blok.html?block='+encodeURIComponent(select.value);});
    var kpis=[['Luas blok',area(block.blockAreaHa)],['Luas gawangan tanam',area(block.gawanganAreaHa)],['Luas operasional tercatat',area(block.operationalAreaHa)],['Gawangan',integer(block.mappedGawangan)],['Hortikultura',integer(block.horticulturePlants)+' tanaman · '+integer(block.horticultureTypes)+' jenis'],['Nanas tercatat',integer(block.pineapplePlants)+' tanaman'],['Buah dipanen',integer(block.pineappleHarvest)+' buah'],['Belum tercatat panen',integer(block.pineappleUnharvested)+' tanaman'],['MPTS',integer(block.mptsPlants)+' pohon · '+integer(block.mptsTypes)+' jenis']];
    document.getElementById('db-kpis').innerHTML=kpis.map(function(item){return'<article><small>'+item[0]+'</small><strong>'+item[1]+'</strong></article>';}).join('');
    document.getElementById('db-data-status').innerHTML='<strong>'+integer(block.gawanganWithData)+' / '+integer(block.mappedGawangan)+'</strong><span>gawangan memiliki data</span>'+(block.missingGawangan.length?'<small>Belum lengkap: '+block.missingGawangan.map(function(id){return id.replace('DAYUN-GT-','');}).join(', ')+'</small>':'<small>Seluruh gawangan memiliki informasi tanaman.</small>');
    document.getElementById('db-crops').innerHTML=cropGroup(block,window.DayunAgroSummary.MPTS,'MPTS','pohon')+cropGroup(block,window.DayunAgroSummary.HORTICULTURE,'Hortikultura','tanaman');
    renderHarvest(block);
    document.getElementById('db-gawangan').innerHTML=block.gawangan.map(function(item){return'<tr'+(!item.hasData?' class="is-incomplete"':'')+'><th scope="row">'+esc(item.shortId)+'</th><td>'+area(item.areaHa)+'</td><td>'+(item.hasData?area(item.operationalAreaHa):'Data belum lengkap')+'</td><td>'+(item.crops.length?item.crops.map(cropLabel).join(', '):'Data belum lengkap')+'</td><td>'+(item.hasData?integer(item.horticulturePlants):'—')+'</td><td>'+(item.hasData?integer(item.pineappleHarvest):'—')+'</td><td>'+(item.hasData?integer(item.mptsPlants):'—')+'</td><td><a href="dayun-gawangan.html?object='+encodeURIComponent(item.objectId)+'">Lihat profil →</a></td></tr>';}).join('');
    document.getElementById('db-note').textContent='Ringkasan Blok '+code+' dihitung langsung dari detail '+integer(block.mappedGawangan)+' gawangan. Luas operasional tidak dijumlahkan antar-komoditas yang memakai ruang tanam yang sama. Gawangan tanpa informasi tanaman ditandai “Data belum lengkap” dan tidak dianggap bernilai nol.';
    document.getElementById('db-status').hidden=true;document.getElementById('db-content').hidden=false;initMap(code,mapData,blockData);
  }

  var code=String(new URLSearchParams(location.search).get('block')||'A').toUpperCase();
  if(!/^[A-F]$/.test(code)){document.getElementById('db-status').textContent='Kode blok tidak valid. Pilih Blok A sampai Blok F dari peta agroforestri.';return;}
  Promise.all([
    fetch('data/dayun-gawangan-details.json?v=20260917-block-summary1',{cache:'no-store'}).then(function(response){if(!response.ok)throw Error('detail');return response.json();}),
    fetch('data/dayun-map.geojson?v=20260916-objectid1').then(function(response){if(!response.ok)throw Error('map');return response.json();}),
    fetch('data/dayun-blocks.geojson?v=20260916-official1').then(function(response){if(!response.ok)throw Error('block');return response.json();})
  ]).then(function(results){render(code,window.DayunAgroSummary.build(results[0],results[1],results[2]),results[1],results[2]);}).catch(function(error){console.error(error);document.getElementById('db-status').textContent='Informasi blok belum dapat dimuat. Silakan kembali ke peta dan coba lagi.';});
})();
