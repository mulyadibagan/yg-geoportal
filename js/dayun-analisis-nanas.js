(function () {
  'use strict';
  var analysis;
  var monitoringAvailable = true;
  var forecastMode = null;
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
    var items=[['Varietas','Queen'],['Gawangan aktif',integer(data.activeGawangan)+' gawangan'],['Populasi tercatat',integer(data.plants)+' tanaman'],['Luas operasional',area(data.areaHa)],['Tercatat dipupuk',integer(data.fertilized)+' tanaman'],['Tercatat ethrel',integer(data.ethrel)+' tanaman'],['Bunga/buah tercatat',integer(data.flowers)+' tanaman'],['Panen utama',integer(data.plantCropHarvest)+' buah'],['Panen ratoon',integer(data.ratoonHarvest)+' buah']];
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

  function monthlyChart(result) {
    if(!forecastMode)forecastMode=result.upcoming.some(function(i){return i.pool!==null;})?'upcoming':result.overdue.some(function(i){return i.pool!==null;})?'recorded':'upcoming';
    $('pa-forecast-period').value=forecastMode;
    var projection=window.DayunHarvestEstimate.monthly(result,forecastMode), months=projection.months;
    var max=Math.max.apply(null,months.map(function(m){return m.high;}).concat([1]));
    var hasEstimate=months.some(function(m){return m.gawangan>0;});
    $('pa-forecast-note').textContent=(forecastMode==='recorded'?'Grafik mengikuti periode catatan ethrel. Bulan bertanda “Lampau” perlu pembaruan lapangan. ':'Grafik 12 bulan mulai bulan ini. ')+(hasEstimate?'Batang menunjukkan skenario jumlah buah, bukan realisasi panen. ':'Belum ada estimasi yang dapat dihitung untuk periode ini. Lengkapi bulan ethrel, jumlah tanaman, dan realisasi panen per gawangan. ')+projection.unquantified+' gawangan belum memiliki dasar lengkap untuk menghitung jumlah.';
    $('pa-forecast-chart').innerHTML=months.map(function(m){return '<div class="dy-forecast-month"><strong>'+(m.gawangan?integer(m.base):'—')+'</strong><div class="dy-forecast-bars">'+['low','base','high'].map(function(k){return '<span class="'+k+'" style="height:'+(m.gawangan?Math.max(1,m[k]/max*160):0)+'px" title="'+esc(month(m.period))+' · '+({low:'60%',base:'80%',high:'100%'})[k]+': '+(m.gawangan?integer(m[k])+' buah':'Belum ada estimasi')+'"></span>';}).join('')+'</div><small>'+esc(month(m.period))+'</small><small>'+(m.past?'Lampau':m.gawangan?'Estimasi':'Belum ada estimasi')+'</small></div>';}).join('');
    $('pa-forecast-chart').setAttribute('aria-label','Proyeksi panen bulanan. '+months.map(function(m){return month(m.period)+': '+(m.gawangan?integer(m.base)+' buah pada skenario 80 persen':'belum ada estimasi')+(m.past?', periode lampau':'');}).join('; '));
    $('pa-forecast-months').innerHTML=months.map(function(m){return '<tr><th scope="row">'+esc(month(m.period))+(m.past?' · lampau':'')+'</th>'+['low','base','high'].map(function(k){return '<td>'+(m.gawangan?integer(m[k])+' buah':'Belum ada estimasi')+'</td>';}).join('')+'<td>'+integer(m.gawangan)+'</td></tr>';}).join('');
  }

  function harvestEstimate(rows) {
    var result=window.DayunHarvestEstimate.build(rows);
    monthlyChart(result);
    $('pa-estimate-summary').textContent=result.upcoming.length+' gawangan dengan periode mendatang/berjalan · '+result.overdue.length+' periode sudah lewat · '+result.missing.length+' perlu data ethrel';
    $('pa-estimate-sync').textContent=monitoringAvailable?'Estimasi mengikuti data sumber dan laporan monitoring yang berhasil dimuat. Angka merupakan skenario; periksa tanggal aktivitas terakhir.':'Laporan monitoring terbaru belum dapat dimuat. Estimasi sementara hanya memakai data sumber; muat ulang untuk mencoba kembali.';
    $('pa-estimate-table').innerHTML=result.items.map(function(item){
      var amount=item.pool==null?'Belum dapat dihitung':integer(item.low)+'–'+integer(item.high)+' buah<small>Skenario 80%: '+integer(item.base)+' buah'+(item.status==='overdue'?' · periode lampau':'')+'</small>';
      var label=item.status==='overdue'?'Perlu pembaruan lapangan':item.status==='estimated'?'Estimasi bersyarat':'Data belum cukup';
      return '<tr><th scope="row"><a href="dayun-gawangan.html?object='+encodeURIComponent(item.objectId)+'">'+esc(item.shortId)+'</a></th><td>'+(item.start?esc(month(item.start))+' – '+esc(month(item.end)):'Belum tersedia')+'</td><td>'+amount+'</td><td><strong>'+label+'</strong><small>'+esc(item.notes.join(' '))+'</small></td></tr>';
    }).join('')||'<tr><td colspan="4">Belum ada data nanas pada blok ini.</td></tr>';
  }

  function render() {
    var rows=selectedRows(),data=aggregate(rows);
    $('pa-block').value=selected;
    $('pa-data-date').innerHTML='Wilayah: <strong>'+(selected==='ALL'?'Seluruh Blok A–F':'Blok '+esc(selected))+'</strong> · Aktivitas terakhir: <strong>'+date(data.latestActivityDate)+'</strong>';
    kpis(data);recommendations(data);harvestEstimate(rows);chart(rows);blockTable();gawanganTable(rows);
  }

  Promise.all([window.DayunDataSource.fetchJSON('data/dayun-gawangan-details.json?v=20260917-performance1'),jsonp(PUBLIC_REPORTS_API).catch(function(error){console.warn(error);monitoringAvailable=false;return{features:[]};})]).then(function(results){
    var details=window.DayunPineappleAnalysis.applyPublishedMonitoring(results[0],results[1]);
    analysis=window.DayunPineappleAnalysis.build(details);
    analysis._detailsById={};
    (details.objects||[]).forEach(function(object){analysis._detailsById[object.objectId]=(object.crops||[]).find(function(crop){return String(crop.crop||'').toUpperCase()==='NANAS';})||null;});
    if(analysis.blockCodes.indexOf(selected)<0&&selected!=='ALL')selected='ALL';
    $('pa-status').hidden=true;$('pa-content').hidden=false;render();
  }).catch(function(error){$('pa-status').textContent='Analisis belum dapat dimuat: '+error.message;});

  $('pa-forecast-period').addEventListener('change',function(){forecastMode=this.value;if(analysis)harvestEstimate(selectedRows());});
  $('pa-block').addEventListener('change',function(){selected=this.value;var url=new URL(location.href);if(selected==='ALL')url.searchParams.delete('block');else url.searchParams.set('block',selected);history.replaceState(null,'',url);render();});
})();
