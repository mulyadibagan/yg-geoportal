(function(){
  'use strict';
  const publicFetch=window.fetch.bind(window);
  const staffFetch=window.YG_STAFF_DATA.fetch;
  const staffSession=window.YG_STAFF_DATA.session();
  const emptyGeo=()=>({type:'FeatureCollection',features:[]});
  var month=new URLSearchParams(location.search).get('month');
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))month=null;
  var requestedMonth=month;
  var map=L.map('monthly-fire-map',{preferCanvas:true}).fitBounds([[-1.3,100],[2.9,104.9]]);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'}).addTo(map);

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function table(id,rows,company,profileIds){var el=document.getElementById(id);if(!rows.length){el.innerHTML='<tr><td colspan="4">Tidak ada deteksi.</td></tr>';return}el.innerHTML=rows.map(function(x){var profileId=company&&profileIds&&profileIds[String(x.name||'').toLowerCase()],name=profileId?'<a href="pbph-profile.html?id='+encodeURIComponent(profileId)+'" target="_blank" rel="noopener noreferrer"><strong>'+esc(x.name)+'</strong></a>':'<strong>'+esc(x.name)+'</strong>';return company?'<tr><td>'+name+'<br><small>'+esc(x.sk||'SK tidak tersedia')+(profileId?' · buka profil PHL &amp; SVLK →':'')+'</small></td><td>'+x.hotspots+'</td><td>'+x.detectionDays+'</td><td>'+esc((x.villages||[]).join(', ')||'—')+'</td></tr>':'<tr><td><strong>'+esc(x.village)+'</strong><br><small>'+esc(x.district+', '+x.regency)+'</small></td><td>'+x.hotspots+'</td><td>'+x.detectionDays+'</td><td>'+esc(x.lastDetection)+'</td></tr>'}).join('')}
  function rspoTable(rows){var el=document.getElementById('fm-rspo-rows');if(!rows.length){el.innerHTML='<tr><td colspan="4">Tidak ada hotspot yang beririsan.</td></tr>';return}el.innerHTML=rows.map(function(x){return '<tr><td><strong>'+esc(x.name)+'</strong><br><small>'+esc(x.supplyBase||x.regency||'Area anggota RSPO')+'</small></td><td>'+x.hotspots+'</td><td>'+x.detectionDays+'</td><td>'+esc(x.group||'—')+'</td></tr>'}).join('')}
  function monthLabel(value){return new Date(value+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'UTC'})}
  function json(fetcher,url,message){return fetcher(url,{cache:'no-store'}).then(function(r){if(!r.ok)throw Error(message+(r.status?' ('+r.status+')':''));return r.json()})}
  function timed(promise,label){return Promise.race([promise,new Promise(function(_,reject){setTimeout(function(){reject(Error(label+' terlalu lama dimuat'))},15000)})])}
  function safePrivate(promise,label){return timed(promise,label).then(function(geo){return {geo:geo,error:null}}).catch(function(error){return {geo:emptyGeo(),error:error}})}
  function showInternalFailure(errors){
    var panel=document.getElementById('fm-internal-burned');
    if(!panel){panel=document.createElement('section');panel.id='fm-internal-burned';panel.className='fm-panel';panel.style.marginBottom='24px';document.querySelector('.fm-tables').before(panel)}
    var expired=!window.YG_STAFF_DATA.session();
    panel.innerHTML='<h2>Analisis internal belum dapat dimuat</h2><p>'+esc(expired?'Sesi staf telah berakhir. Silakan login kembali, lalu buka ulang laporan ini.':errors.map(function(x){return x.message}).join(' · '))+'</p>'+(expired?'<p><a class="fm-internal-login" href="staff-login.html?next='+encodeURIComponent(location.pathname+location.search)+'">Login staf kembali →</a></p>':'<p>Muat ulang halaman untuk mencoba kembali.</p>');
    document.getElementById('fm-ps-hotspots').textContent=expired?'Sesi staf berakhir':'Data internal belum tersedia';
  }

  var privatePromise=staffSession?Promise.all([
    safePrivate(window.YG_STAFF_DATA.pbph(),'Batas PBPH'),
    safePrivate(json(staffFetch,'data/rspo-company-boundaries.geojson','Batas perusahaan belum dapat dimuat'),'Batas RSPO'),
    safePrivate(json(staffFetch,'data/PERHUTANAN_SOSIAL_RIAU.geojson','Batas Perhutanan Sosial belum dapat dimuat'),'Batas Perhutanan Sosial')
  ]):Promise.resolve([]);

  Promise.all([
    json(publicFetch,'data/fire-monthly/index.json?v=5','indeks laporan belum tersedia'),
    json(publicFetch,'data/burned-area-monthly/index.json','archive').catch(function(){return {reports:[]}}),
    json(publicFetch,'data/batas_administrasi_desa_riau.geojson','batas desa belum tersedia'),
    requestedMonth?json(publicFetch,'data/fire-monthly/'+requestedMonth+'.json?v=direct1','snapshot belum tersedia').catch(function(){return null}):Promise.resolve(null)
  ]).then(function(indexes){
    var index=indexes[0];
    (indexes[1].reports||[]).forEach(function(r){if(!index.reports.some(function(x){return x.month===r.month}))index.reports.push({month:r.month,status:'partial'})});
    index.reports.sort(function(a,b){return b.month.localeCompare(a.month)});
    return {index:index,villageGeo:indexes[2],preloaded:indexes[3]};
  }).then(function(bundle){
    var index=bundle.index;
    var reports=index.reports||[],selected=reports.find(function(x){return x.month===month})||reports[0];
    if(!selected)throw Error('belum ada laporan');
    month=selected.month;
    var picker=document.getElementById('fm-month-select');
    picker.innerHTML=reports.map(function(x){return '<option value="'+esc(x.month)+'"'+(x.month===month?' selected':'')+'>'+esc(monthLabel(x.month))+' · '+esc(x.status==='final'?'Final':'Sementara')+'</option>'}).join('');
    picker.onchange=function(){location.search='?month='+encodeURIComponent(picker.value)};
    history.replaceState(null,'','?month='+encodeURIComponent(month));
    var fallback={month:month,status:'partial',unavailable:true,period:{start:month+'-01',end:new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10)},summary:{},daily:[],villages:[],companies:[],rspoAreas:[],hotspots:[]};
    var reportPromise=bundle.preloaded&&requestedMonth===selected.month?Promise.resolve(bundle.preloaded):(selected.data?json(publicFetch,selected.data+'?v='+encodeURIComponent(selected.generatedAt||'1'),'snapshot belum tersedia'):Promise.resolve(fallback));
    return Promise.all([reportPromise,Promise.resolve(bundle.villageGeo)]);
  }).then(function(result){
    if(staffSession){
      document.getElementById('fm-companies').closest('article').hidden=false;
      document.getElementById('fm-companies').closest('article').removeAttribute('aria-hidden');
      document.getElementById('fm-company-rows').closest('article').hidden=false;
      ['fm-rspo-kpi','fm-rspo-panel','fm-ps-kpi'].forEach(function(id){var el=document.getElementById(id);if(el){el.hidden=false;el.removeAttribute('aria-hidden')}});
      document.getElementById('fm-ps-hotspots').textContent='Menyiapkan analisis internal…';
    }
    var d=result[0],villageGeo=result[1],permitGeo=emptyGeo(),rspoGeo=emptyGeo();
    document.getElementById('fm-title').textContent=monthLabel(d.month);
    document.getElementById('fm-description').textContent='Deteksi hotspot high confidence NASA FIRMS periode '+d.period.start+'–'+d.period.end+', dipadankan dengan batas administrasi desa di Provinsi Riau.'+(staffSession?' Analisis PBPH, perkebunan anggota RSPO, dan Perhutanan Sosial dimuat terpisah untuk sesi staf.':'');
    var s=d.summary||{};
    document.getElementById('fm-hotspots').textContent=Number(s.hotspots||0).toLocaleString('id-ID');
    document.getElementById('fm-villages').textContent=Number(s.villages||0).toLocaleString('id-ID');
    document.getElementById('fm-regencies').textContent=Number(s.regencies||0).toLocaleString('id-ID');
    document.getElementById('fm-companies').textContent=Number(s.companies||0).toLocaleString('id-ID');
    if(staffSession){document.getElementById('fm-rspo-areas').textContent=Number(s.rspoAreas||0).toLocaleString('id-ID');document.getElementById('fm-rspo-hotspots').textContent=Number(s.rspoHotspots||0).toLocaleString('id-ID')+' hotspot'}
    document.getElementById('fm-status').textContent=(d.status==='final'?'Laporan final':'Data sementara')+' · '+d.period.start+' sampai '+d.period.end+' · diperbarui '+new Date(d.generatedAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB';
    var max=Math.max.apply(null,d.daily.map(function(x){return x.hotspots}).concat([1]));
    document.getElementById('fm-daily').innerHTML=d.daily.map(function(x,i){return '<div class="fm-bar-slot '+(x.hotspots?'has-value':'')+'"><div class="fm-bar" style="height:'+Math.max(3,x.hotspots/max*150)+'px">'+(x.hotspots?'<span>'+x.hotspots+'</span>':'')+'</div><small>'+String(i+1).padStart(2,'0')+'</small></div>'}).join('');
    table('fm-village-rows',d.villages||[],false);
    table('fm-company-rows',d.companies||[],true,{});
    if(staffSession)rspoTable(d.rspoAreas||[]);
    var villageNames=new Set((d.villages||[]).map(function(x){return String(x.village||'').toLowerCase()}));
    var companyNames=new Set((d.companies||[]).map(function(x){return String(x.name||'').toLowerCase()}));
    var rspoIds=new Set((d.rspoAreas||[]).map(function(x){return String(x.id||'')}));
    var rspoNames=new Set((d.rspoAreas||[]).map(function(x){return String(x.name||'').toLowerCase().replace(/^pt\.\s*/, 'pt ')}));
    var villageLayer=L.geoJSON(villageGeo,{filter:function(f){return villageNames.has(String((f.properties||{}).WADMKD||'').toLowerCase())},style:{color:'#40d9e8',weight:2,fillColor:'#20b7c7',fillOpacity:.13},onEachFeature:function(f,l){var p=f.properties||{};l.bindTooltip('<strong>Desa '+esc(p.WADMKD||'')+'</strong><br>'+esc([p.WADMKC,p.WADMKK].filter(Boolean).join(', ')))}}).addTo(map);
    var permitLayer=L.geoJSON(permitGeo,{filter:function(f){return companyNames.has(String((f.properties||{}).NAMOBJ||'').toLowerCase())},style:{color:'#ffc247',weight:2.2,dashArray:'7 5',fillColor:'#ef9f24',fillOpacity:.12},onEachFeature:function(f,l){var p=f.properties||{},profileId=String(p.PBPH_ID||[p.NAMOBJ,p.NO_SK].filter(Boolean).join('|')).trim();l.bindPopup('<strong>'+esc(p.NAMOBJ||'Pemegang PBPH')+'</strong><br>'+esc(p.NO_SK||'')+'<br><a href="pbph-profile.html?id='+encodeURIComponent(profileId)+'" target="_blank" rel="noopener noreferrer">Buka profil PHL &amp; SVLK →</a>')}});
    var rspoLayer=L.geoJSON(rspoGeo,{filter:function(f){return rspoIds.has(String((f.properties||{}).COMPANY_ID||''))||rspoNames.has(String((f.properties||{}).PO_COMPANY||'').toLowerCase().replace(/^pt\.\s*/, 'pt '))},style:{color:'#8fd14f',weight:2.4,fillColor:'#3c9f57',fillOpacity:.2},onEachFeature:function(f,l){var p=f.properties||{};l.bindTooltip('<strong>'+esc(p.PO_COMPANY||'Area anggota RSPO')+'</strong><br>'+esc(p.RSPO_GROUP||'')+(p.SUPPLY_BASE?'<br><small>'+esc(p.SUPPLY_BASE)+'</small>':'') )}});
    var points=L.featureGroup();
    (d.hotspots||[]).forEach(function(x){var popup='<strong>Hotspot high confidence</strong><br>'+esc(x.date)+' '+esc(x.time)+'<br>'+esc([x.village,x.district,x.regency].filter(Boolean).join(', ')||'Lokasi administrasi tidak teridentifikasi');L.circleMarker([x.latitude,x.longitude],{radius:5,color:'#fff',weight:1.5,fillColor:'#ef382f',fillOpacity:.95}).bindPopup(popup).addTo(points)});
    points.addTo(map);
    var layerControl=L.control.layers(null,{'Hotspot':points,'Desa terdeteksi':villageLayer},{collapsed:false,position:'bottomright'}).addTo(map);
    var bounds=L.featureGroup([villageLayer,points]).getBounds();if(bounds.isValid())map.fitBounds(bounds.pad(.08));
    if(d.unavailable){['fm-hotspots','fm-villages','fm-regencies','fm-companies','fm-rspo-areas','fm-rspo-hotspots'].forEach(function(id){document.getElementById(id).textContent='—'});document.getElementById('fm-status').textContent='Arsip hotspot bulan ini belum tersedia. Estimasi luas ditampilkan terpisah di laporan ini.';document.getElementById('fm-daily').textContent='Data hotspot bulanan belum tersedia';['fm-village-rows','fm-company-rows','fm-rspo-rows'].forEach(function(id){document.getElementById(id).innerHTML='<tr><td colspan="4">Data hotspot belum tersedia.</td></tr>'})}
    else document.getElementById('fm-status').textContent=document.getElementById('fm-status').textContent.replace('Laporan final','Hotspot: final');

    var burnedPromise=window.loadMonthlyBurned(map,month,d,layerControl);
    if(!staffSession)return burnedPromise;
    return Promise.all([burnedPromise,privatePromise]).then(function(all){
      var geo=all[0],privateRows=all[1],errors=privateRows.map(function(x){return x.error}).filter(Boolean);
      permitGeo=privateRows[0].geo;rspoGeo=privateRows[1].geo;var psGeo=privateRows[2].geo;
      if(permitGeo.features.length){permitLayer.addData(permitGeo).addTo(map);layerControl.addOverlay(permitLayer,'PBPH Mei 2026');var profileIds={};permitGeo.features.forEach(function(f){var p=f.properties||{},key=String(p.NAMOBJ||'').toLowerCase();if(key&&!profileIds[key])profileIds[key]=String(p.PBPH_ID||[p.NAMOBJ,p.NO_SK].filter(Boolean).join('|')).trim()});table('fm-company-rows',d.companies||[],true,profileIds)}
      if(rspoGeo.features.length){rspoLayer.addData(rspoGeo).addTo(map);layerControl.addOverlay(rspoLayer,'Area anggota RSPO')}
      if(errors.length){showInternalFailure(errors);return}
      return window.renderMonthlyInternal(map,month,d,geo,permitGeo,rspoGeo,psGeo,layerControl);
    });
  }).catch(function(e){document.getElementById('fm-status').textContent='Laporan belum tersedia: '+e.message;document.getElementById('fm-status').style.color='#a33'});
}());
