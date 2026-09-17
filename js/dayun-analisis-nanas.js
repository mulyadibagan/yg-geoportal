(function () {
  'use strict';
  var analysis;
  var PUBLIC_REPORTS_API='https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=public-reports';
  var selected = new URLSearchParams(location.search).get('block') || 'ALL';
  var $ = function (id) { return document.getElementById(id); };

  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function integer(value) { return Math.round(Number(value) || 0).toLocaleString('id-ID'); }
  function decimal(value) { return Number(value || 0).toLocaleString('id-ID',{maximumFractionDigits:2}); }
  function area(value) { return Number(value || 0).toLocaleString('id-ID',{maximumFractionDigits:2}) + ' ha'; }
  function date(value) { return value ? new Date(value + 'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}) : 'Belum tersedia'; }
  function month(value) { if(/^\d{4}$/.test(String(value||'')))return String(value);return new Date(value + 'T00:00:00').toLocaleDateString('id-ID',{month:'short',year:'2-digit'}); }
  function jsonp(url){return new Promise(function(resolve,reject){var callback='ygDayunAnalysis_'+Date.now()+'_'+Math.floor(Math.random()*100000),script=document.createElement('script'),timer=setTimeout(function(){cleanup();reject(Error('Data monitoring belum dapat dimuat.'));},9000);function cleanup(){clearTimeout(timer);script.remove();try{delete window[callback];}catch(_){}}window[callback]=function(data){cleanup();resolve(data);};script.onerror=function(){cleanup();reject(Error('Data monitoring belum dapat dimuat.'));};script.src=url+'&callback='+encodeURIComponent(callback)+'&t='+Date.now();document.head.appendChild(script);});}
  function selectedRows() { return selected === 'ALL' ? analysis.rows.slice() : analysis.rows.filter(function (row) { return row.block === selected; }); }
  function aggregate(rows) {
    return rows.reduce(function (a,row) {
      a.rows += 1;if(row.plants>0)a.activeGawangan += 1;
      ['plants','areaHa','fertilized','harvest','plantCropHarvest','ratoonHarvest','remainingPlantCrop','ratoonShoots','ethrel','flowers'].forEach(function(key){a[key]+=row[key];});
      if(row.latestActivityDate && (!a.latestActivityDate || row.latestActivityDate>a.latestActivityDate))a.latestActivityDate=row.latestActivityDate;
      a.estimatedNotHarvested=a.remainingPlantCrop;
      a.recommendationCounts[row.recommendation.code]=(a.recommendationCounts[row.recommendation.code]||0)+1;
      return a;
    },{rows:0,activeGawangan:0,plants:0,areaHa:0,fertilized:0,harvest:0,plantCropHarvest:0,ratoonHarvest:0,remainingPlantCrop:0,ratoonShoots:0,ethrel:0,flowers:0,estimatedNotHarvested:0,latestActivityDate:null,recommendationCounts:{}});
  }

  function kpis(data) {
    var items=[['Varietas','Queen'],['Gawangan aktif',integer(data.activeGawangan)+' gawangan'],['Populasi tercatat',integer(data.plants)+' tanaman'],['Luas operasional',area(data.areaHa)],['Tercatat dipupuk',integer(data.fertilized)+' tanaman'],['Tercatat ethrel',integer(data.ethrel)+' tanaman'],['Bunga/buah tercatat',integer(data.flowers)+' tanaman'],['Panen utama',integer(data.plantCropHarvest)+' buah'],['Belum panen utama',integer(data.remainingPlantCrop)+' tanaman'],['Panen ratoon',integer(data.ratoonHarvest)+' buah']];
    $('pa-kpis').innerHTML=items.map(function(item){return '<article><small>'+esc(item[0])+'</small><strong>'+esc(item[1])+'</strong></article>';}).join('');
  }

  function recommendations(data) {
    var ethrelChecks=(data.recommendationCounts['ethrel-check']||0), harvestChecks=(data.recommendationCounts.harvest||0), hptChecks=data.activeGawangan;
    $('pa-recommendations').innerHTML=[
      ['PEMUPUKAN','Verifikasi riwayat pupuk','Belum tersedia','Data saat ini hanya memuat jumlah tanaman yang pernah dipupuk; tanggal, bahan, dosis, pH, dan kondisi tanaman belum lengkap.','dayun-sop-nanas.html#program-pupuk','Buka SOP dan kalkulator →'],
      ['ETHREL','Periksa kelayakan induksi',integer(ethrelChecks)+' gawangan','Ini daftar pemeriksaan, bukan perintah aplikasi. Pastikan tanaman sehat dan seragam, >30 daun, tajuk membuka, cuaca sesuai, serta riwayat kelompok tanam jelas.','dayun-sop-nanas.html#induksi-bunga','Buka SOP ethrel →'],
      ['PANEN','Pantau kematangan',integer(harvestChecks)+' gawangan','Periksa warna kulit, bentuk mata, aroma, kondisi buah, dan tujuan pasar. Sistem tidak menetapkan tanggal panen hanya dari umur atau ethrel.','#pa-gawangan-table','Lihat gawangan prioritas ↓'],
      ['HPT','Monitoring rutin',integer(hptChecks)+' gawangan aktif','Data agregat HPT belum tersedia. Lakukan observasi gejala, hitung tanaman terdampak, dokumentasikan foto, lalu verifikasi diagnosis sebelum tindakan.','dayun-hpt-nanas.html','Buka panduan HPT →']
    ].map(function(item){return '<article class="dy-pa-action"><span>'+item[0]+'</span><h3>'+item[1]+'</h3><strong>'+item[2]+'</strong><p>'+item[3]+'</p><a href="'+item[4]+'">'+item[5]+'</a></article>';}).join('');
  }

  function confidence(id,label) {
    var target=$(id),key=String(label||'').toLowerCase();
    target.textContent='Keyakinan '+(label||'—');
    target.className='dy-pa-confidence '+(key==='tinggi'?'high':key==='sedang'?'medium':'low');
  }

  function projectionColumn(item,value,max,label,detail) {
    var height=value>0?Math.max(4,Math.round(value/max*150)):2;
    return '<div class="dy-pa-projection-month"><strong>'+esc(detail)+'</strong><div class="dy-pa-projection-bar'+(value?'':' is-empty')+'" style="height:'+height+'px"><span>'+esc(value?integer(value):'')+'</span></div><small>'+esc(month(item.period))+'<br>'+esc(label)+'</small></div>';
  }

  function renderProjection(rows) {
    var projection=window.DayunPineappleAnalysis.buildProjection(rows,{horizonMonths:12}),months=projection.months,a=projection.assumptions;
    var harvestTotals=months.reduce(function(result,item){result.low+=item.harvest.low;result.base+=item.harvest.base;result.high+=item.harvest.high;return result;},{low:0,base:0,high:0});
    var componentTotals=months.reduce(function(result,item){['confirmed','mainCropPotential','ratoon','ratoonCandidate','ratoonVerified'].forEach(function(component){['low','base','high'].forEach(function(key){result[component][key]+=item.harvest[component][key];});});return result;},{confirmed:{low:0,base:0,high:0},mainCropPotential:{low:0,base:0,high:0},ratoon:{low:0,base:0,high:0},ratoonCandidate:{low:0,base:0,high:0},ratoonVerified:{low:0,base:0,high:0}});
    var mainCropTotals={low:componentTotals.confirmed.low+componentTotals.mainCropPotential.low,base:componentTotals.confirmed.base+componentTotals.mainCropPotential.base,high:componentTotals.confirmed.high+componentTotals.mainCropPotential.high};
    var harvestMax=Math.max.apply(null,months.map(function(item){return item.harvest.high;}).concat([1]));
    confidence('pa-harvest-confidence',a.harvestConfidence);
    $('pa-harvest-projection-summary').innerHTML='<span>Belum panen utama: <b>'+integer(a.remainingPlantCrop)+' tanaman</b></span><span>Skenario panen utama 12 bulan: <b>'+integer(mainCropTotals.low)+'–'+integer(mainCropTotals.high)+' buah</b></span><span>Calon ratoon dari panen pertama: <b>'+integer(a.ratoonCandidatePool)+' tanaman</b></span><span>Proyeksi ratoon 12 bulan: <b>'+integer(componentTotals.ratoon.low)+'–'+integer(componentTotals.ratoon.high)+' buah</b></span><span>Data kegiatan terakhir: <b>'+date(a.lastActivityDate)+'</b></span>';
    $('pa-harvest-components').innerHTML='<article class="confirmed"><small>TERKONFIRMASI BUNGA/BUAH</small><strong>'+integer(componentTotals.confirmed.low)+'–'+integer(componentTotals.confirmed.high)+' buah</strong><span>'+integer(a.flowerCount)+' tanaman menjadi dasar panen terdekat.</span></article><article class="potential"><small>POTENSI PANEN UTAMA</small><strong>'+integer(componentTotals.mainCropPotential.low)+'–'+integer(componentTotals.mainCropPotential.high)+' buah</strong><span>'+integer(a.inducedPending)+' pasca-ethrel · '+integer(a.vegetativePending)+' belum masuk fase bunga.</span></article><article class="ratoon"><small>CALON &amp; PROYEKSI RATOON</small><strong>'+integer(a.ratoonCandidatePool)+' calon tanaman</strong><span>'+integer(a.unverifiedRatoonCandidates)+' belum diverifikasi · '+integer(a.verifiedRatoonShoots)+' tunas produktif terverifikasi · '+integer(a.excludedRatoonCandidates)+' tidak dipertahankan. Skenario produksi: '+integer(componentTotals.ratoon.low)+'–'+integer(componentTotals.ratoon.high)+' buah.</span></article>';
    $('pa-harvest-projection').innerHTML=months.map(function(item){
      var highHeight=item.harvest.high?Math.max(4,Math.round(item.harvest.high/harvestMax*150)):2,baseHeight=item.harvest.base?Math.max(3,Math.round(item.harvest.base/harvestMax*150)):0,lowHeight=item.harvest.low?Math.max(2,Math.round(item.harvest.low/harvestMax*150)):0;
      return '<div class="dy-pa-projection-month"><strong>'+integer(item.harvest.low)+'–'+integer(item.harvest.high)+'</strong><div class="dy-pa-projection-bar'+(item.harvest.high?'':' is-empty')+'" style="height:'+highHeight+'px">'+(item.harvest.high?'<i style="height:'+baseHeight+'px"></i><b style="bottom:'+lowHeight+'px"></b>':'')+'</div><small>'+esc(month(item.period))+'<br>'+integer(item.harvest.base)+' dasar</small></div>';
    }).join('');

    var ethrelTotal=months.reduce(function(result,item){result.gawangan+=item.ethrel.gawangan;result.plants+=item.ethrel.plants;return result;},{gawangan:0,plants:0});
    var ethrelMax=Math.max.apply(null,months.map(function(item){return item.ethrel.plants;}).concat([1]));
    confidence('pa-ethrel-confidence',a.ethrelConfidence);
    $('pa-ethrel-projection-summary').innerHTML='<span>Perlu pemeriksaan: <b>'+integer(ethrelTotal.gawangan)+' gawangan</b></span><span>Maksimum tanaman diperiksa: <b>'+integer(ethrelTotal.plants)+'</b></span><span>Ethrel bertanggal lengkap: <b>'+integer(a.datedEthrel)+'</b></span><span>Periode belum rinci: <b>'+integer(a.undatedEthrel)+'</b></span>';
    $('pa-ethrel-projection').innerHTML=months.map(function(item){return projectionColumn(item,item.ethrel.plants,ethrelMax,item.ethrel.gawangan+' gawangan',integer(item.ethrel.plants)+' diperiksa');}).join('');

    var fertTotal=months.reduce(function(result,item){result.gawangan+=item.fertilizer.gawangan;result.verification+=item.fertilizer.phases.verification;result.phase2+=item.fertilizer.phases.phase2;result.phase3+=item.fertilizer.phases.phase3;['urea','npk'].forEach(function(material){result[material].low+=item.fertilizer.materials[material].lowKg;result[material].high+=item.fertilizer.materials[material].highKg;});return result;},{gawangan:0,verification:0,phase2:0,phase3:0,urea:{low:0,high:0},npk:{low:0,high:0}});
    var fertMax=Math.max.apply(null,months.map(function(item){return item.fertilizer.gawangan;}).concat([1]));
    confidence('pa-fertilizer-confidence',a.fertilizerConfidence);
    $('pa-fertilizer-projection-summary').innerHTML='<span>Perlu verifikasi riwayat: <b>'+integer(fertTotal.verification)+' gawangan</b></span><span>Fase II indikatif: <b>'+integer(fertTotal.phase2)+' gawangan</b></span><span>Fase III indikatif: <b>'+integer(fertTotal.phase3)+' gawangan</b></span>';
    $('pa-fertilizer-projection').innerHTML=months.map(function(item){var phases=[];if(item.fertilizer.phases.verification)phases.push('verifikasi '+item.fertilizer.phases.verification);if(item.fertilizer.phases.phase2)phases.push('fase II '+item.fertilizer.phases.phase2);if(item.fertilizer.phases.phase3)phases.push('fase III '+item.fertilizer.phases.phase3);return projectionColumn(item,item.fertilizer.gawangan,fertMax,phases.join(' · ')||'belum ada',item.fertilizer.gawangan+' gawangan');}).join('');
    $('pa-fertilizer-materials').innerHTML='<article><small>UREA · RENTANG INDIKATIF</small><strong>'+decimal(fertTotal.urea.low)+(fertTotal.urea.low===fertTotal.urea.high?'':'–'+decimal(fertTotal.urea.high))+' kg</strong><span>Hanya dari fase II yang masuk horizon proyeksi.</span></article><article><small>NPK 15-15-15 · RENTANG INDIKATIF</small><strong>'+decimal(fertTotal.npk.low)+(fertTotal.npk.low===fertTotal.npk.high?'':'–'+decimal(fertTotal.npk.high))+' kg</strong><span>Gabungan fase II dan III yang masuk horizon proyeksi.</span></article>';
  }

  function loadProjectionWeather() {
    var target=$('pa-projection-weather');
    fetch('https://api.open-meteo.com/v1/forecast?latitude=0.5844&longitude=102.009&current=precipitation,weather_code&hourly=precipitation_probability,precipitation&forecast_days=2&timezone=Asia%2FJakarta',{cache:'no-store'}).then(function(response){if(!response.ok)throw new Error('Cuaca tidak tersedia');return response.json();}).then(function(weather){
      var current=weather.current||{},hourly=weather.hourly||{},times=hourly.time||[],start=times.findIndex(function(time){return !current.time||time>=current.time;});if(start<0)start=0;
      var rain=Number(current.precipitation)||0,chance=0;
      times.slice(start,start+6).forEach(function(_,offset){var index=start+offset;rain+=Number((hourly.precipitation||[])[index])||0;chance=Math.max(chance,Number((hourly.precipitation_probability||[])[index])||0);});
      var blocked=rain>0;target.classList.add(blocked?'is-rain':'is-clear');
      target.innerHTML='<strong>'+(blocked?'Tunda aplikasi · hujan terukur':'Periksa lapangan · tidak ada hujan terukur')+'</strong><span>'+(blocked?'Hujan saat ini atau enam jam ke depan terukur '+decimal(rain)+' mm. Periksa ulang prakiraan sebelum aplikasi.':'Prakiraan enam jam tidak menunjukkan hujan terukur; peluang maksimum '+integer(chance)+'%. Pastikan tajuk dan titik tumbuh kering.')+'</span>';
    }).catch(function(){target.innerHTML='<strong>Cuaca belum tersedia</strong><span>Periksa prakiraan per jam dan kondisi aktual sebelum aplikasi ethrel atau pupuk.</span>';});
  }

  function chart(rows) {
    var history={};
    rows.forEach(function(row){
      var source=analysis._detailsById[row.objectId];
      (source&&source.pineappleHarvest||[]).forEach(function(item){if(item.period)history[item.period]=(history[item.period]||0)+(Number(item.count)||0);});
    });
    var periods=Object.keys(history).sort(),max=Math.max.apply(null,periods.map(function(key){return history[key];}).concat([1])),total=periods.reduce(function(sum,key){return sum+history[key];},0);
    $('pa-chart-summary').innerHTML='<small>TOTAL RIWAYAT PANEN</small><strong>'+integer(total)+' buah</strong><span>'+integer(periods.length)+' periode tercatat · aktivitas terakhir '+date(periods[periods.length-1])+'</span>';
    $('pa-harvest-chart').innerHTML=periods.length?periods.map(function(period){var height=Math.max(2,Math.round(history[period]/max*165));return '<div class="dy-pa-chart-column"><strong>'+integer(history[period])+'</strong><span style="height:'+height+'px"></span><small>'+esc(month(period))+'</small></div>';}).join(''):'<p class="dy-pa-chart-empty">Belum ada riwayat panen untuk wilayah ini.</p>';
  }

  function blockTable() {
    $('pa-block-table').innerHTML=analysis.blockCodes.map(function(code){var b=analysis.blocks[code],empty=b.plants<=0;return '<tr'+(empty?' class="is-incomplete"':'')+'><th scope="row"><a href="?block='+code+'">Blok '+code+'</a></th><td>'+integer(b.activeGawangan)+'</td><td>'+(empty?'Data belum lengkap':integer(b.plants))+'</td><td>'+(empty?'—':area(b.areaHa))+'</td><td>'+integer(b.ethrel)+'</td><td>'+integer(b.flowers)+'</td><td>'+integer(b.harvest)+'</td><td>'+date(b.latestActivityDate)+'</td></tr>';}).join('');
  }

  function gawanganTable(rows) {
    var order={harvest:0,'ethrel-followup':1,'ethrel-check':2,data:3,maintenance:4};
    rows.sort(function(a,b){return order[a.recommendation.code]-order[b.recommendation.code]||b.flowers-a.flowers||b.ethrel-a.ethrel||a.objectId.localeCompare(b.objectId,'id',{numeric:true});});
    $('pa-gawangan-table').innerHTML=rows.map(function(row){return '<tr><th scope="row">'+esc(row.shortId)+'</th><td>'+(row.ageMonths==null?'Belum tersedia':integer(row.ageMonths)+' bulan')+'</td><td>'+integer(row.plants)+'</td><td>'+integer(row.ethrel)+'</td><td>'+integer(row.flowers)+'</td><td>'+integer(row.harvest)+'</td><td><span class="dy-pa-status '+esc(row.recommendation.code)+'">'+esc(row.recommendation.label)+'</span><small>'+esc(row.recommendation.detail)+'</small></td><td><a href="dayun-gawangan.html?object='+encodeURIComponent(row.objectId)+'">Detail →</a></td></tr>';}).join('');
  }

  function render() {
    var rows=selectedRows(),data=aggregate(rows);
    $('pa-block').value=selected;
    $('pa-data-date').innerHTML='Wilayah: <strong>'+(selected==='ALL'?'Seluruh Blok A–F':'Blok '+esc(selected))+'</strong> · Aktivitas terakhir: <strong>'+date(data.latestActivityDate)+'</strong>';
    kpis(data);recommendations(data);renderProjection(rows);chart(rows);blockTable();gawanganTable(rows);
  }

  Promise.all([fetch('data/dayun-gawangan-details.json?v=20260917-performance1').then(function(response){if(!response.ok)throw new Error('Data tidak dapat dimuat.');return response.json();}),jsonp(PUBLIC_REPORTS_API).catch(function(error){console.warn(error);return{features:[]};})]).then(function(results){
    var details=window.DayunPineappleAnalysis.applyPublishedMonitoring(results[0],results[1]);
    analysis=window.DayunPineappleAnalysis.build(details);
    analysis._detailsById={};
    (details.objects||[]).forEach(function(object){analysis._detailsById[object.objectId]=(object.crops||[]).find(function(crop){return String(crop.crop||'').toUpperCase()==='NANAS';})||null;});
    if(analysis.blockCodes.indexOf(selected)<0&&selected!=='ALL')selected='ALL';
    $('pa-status').hidden=true;$('pa-content').hidden=false;render();loadProjectionWeather();
  }).catch(function(error){$('pa-status').textContent='Analisis belum dapat dimuat: '+error.message;});

  $('pa-block').addEventListener('change',function(){selected=this.value;var url=new URL(location.href);if(selected==='ALL')url.searchParams.delete('block');else url.searchParams.set('block',selected);history.replaceState(null,'',url);render();});
})();
