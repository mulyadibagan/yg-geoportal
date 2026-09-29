(function () {
  'use strict';
  var analysis;
  var monitoringAvailable = true;
  var forecastMode = null;
  var monitoringSource = '';
  var planBlock = null;
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
  function snapshotReports(url) {
    var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},5000);
    return fetch(url,{cache:'no-cache',signal:controller.signal}).then(function(r){if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(function(data){
      var reports=data.capacitySources&&data.capacitySources.reports;
      if(!reports||!Array.isArray(reports.features))throw Error('Snapshot laporan belum tersedia.');
      monitoringSource='Snapshot publik'+(data.snapshotGeneratedAt||data.generatedAt?' · '+String(data.snapshotGeneratedAt||data.generatedAt):' · tanggal belum tersedia');return reports;
    }).finally(function(){clearTimeout(timer);});
  }
  function loadMonitoring() {
    return jsonp(PUBLIC_REPORTS_API).then(function(data){if(!data||!Array.isArray(data.features))throw Error('Format laporan tidak valid.');monitoringSource='Laporan monitoring langsung';return data;})
      .catch(function(){return snapshotReports('https://yg-webgis-public-data.yg-webgis-public-data-worker.workers.dev/snapshots/current/dashboard.json');})
      .catch(function(){return snapshotReports('data/dashboard-summary-snapshot.json');})
      .catch(function(error){console.warn(error);monitoringAvailable=false;return {features:[]};});
  }
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
    var items=[['Populasi sumber',integer(data.plants)+' tanaman'],['Bunga/buah tercatat',integer(data.flowers)+' tanaman'],['Panen kumulatif',integer(data.harvest)+' buah']];
    $('pa-kpis').innerHTML=items.map(function(item){return '<article><small>'+esc(item[0])+'</small><strong>'+esc(item[1])+'</strong></article>';}).join('');
  }

  function chart(rows) {
    var history={};
    rows.forEach(function(row){
      var source=analysis._detailsById[row.objectId];
      (source&&source.pineappleHarvest||[]).forEach(function(item){if(/^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(String(item.period||''))){var period=String(item.period).slice(0,7)+'-01';history[period]=(history[period]||0)+(Number(item.count)||0);}});
    });
    var periods=Object.keys(history).sort(),max=Math.max.apply(null,periods.map(function(key){return history[key];}).concat([1])),total=periods.reduce(function(sum,key){return sum+history[key];},0);
    $('pa-chart-summary').innerHTML='<small>TOTAL RIWAYAT PANEN</small><strong>'+integer(total)+' buah</strong><span>'+integer(periods.length)+' bulan · hanya catatan dengan bulan panen tersedia'+'</span>';
    $('pa-harvest-chart').innerHTML=periods.length?periods.map(function(period){var height=Math.max(2,Math.round(history[period]/max*165));return '<div class="dy-pa-chart-column"><strong>'+integer(history[period])+'</strong><span style="height:'+height+'px"></span><small>'+esc(month(period))+'</small></div>';}).join(''):'<p class="dy-pa-chart-empty">Belum ada riwayat panen untuk wilayah ini.</p>';
  }

  function monthlyChart(result) {
    var candidates=window.DayunHarvestEstimate.ethrelPriorities(selectedRows(),analysis.asOf).filter(function(i){return i.group==='priority';});
    if(!forecastMode)forecastMode=result.upcoming.some(function(i){return i.pool!==null;})?'upcoming':candidates.length?'planning':result.overdue.some(function(i){return i.pool!==null;})?'recorded':'upcoming';
    $('pa-forecast-period').value=forecastMode;
    var plan=null;
    $('pa-plan-controls').hidden=forecastMode!=='planning';
    if(forecastMode==='planning'){
      var capacity=candidates.reduce(function(sum,i){return sum+Math.floor(i.row.plants);},0);
      if(!$('pa-plan-month').value){var d=new Date(analysis.asOf+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1,1);$('pa-plan-month').value=d.toISOString().slice(0,7);}
      $('pa-plan-month').min=analysis.asOf.slice(0,7);
      if(planBlock!==selected){$('pa-plan-count').value=capacity;planBlock=selected;}
      $('pa-plan-count').max=capacity;
      plan=window.DayunHarvestEstimate.plan(selectedRows(),analysis.asOf,$('pa-plan-month').value,Number($('pa-plan-count').value));
      $('pa-plan-context').textContent='Gawangan kandidat: '+(plan.candidates.join(', ')||'belum tersedia')+'. Batas populasi sumber: '+integer(capacity)+' tanaman (dibulatkan ke bawah per gawangan, belum sensus tanaman layak). Ubah jumlah sesuai pemeriksaan lapangan. Tidak disimpan sebagai kegiatan aktual.';
    }
    var projection=window.DayunHarvestEstimate.monthly(plan?plan.result:result,forecastMode==='planning'?'upcoming':forecastMode), months=projection.months;
    var max=Math.max.apply(null,months.map(function(m){return m.high;}).concat([1]));
    var hasEstimate=months.some(function(m){return m.gawangan>0;});
    $('pa-forecast-note').textContent=(forecastMode==='recorded'?'Grafik mengikuti periode catatan ethrel. Bulan bertanda “Lampau” perlu pembaruan lapangan. ':'Grafik 12 bulan mulai bulan ini. ')+(hasEstimate?'Batang menunjukkan skenario jumlah buah, bukan realisasi panen. ':'Belum ada estimasi yang dapat dihitung untuk periode ini. Lengkapi bulan ethrel, jumlah tanaman, dan realisasi panen per gawangan. ')+projection.unquantified+' gawangan belum memiliki dasar lengkap untuk menghitung jumlah.';
    if(plan)$('pa-forecast-note').textContent=plan.error||'Simulasi: panen '+month(plan.result.items[0].start)+'–'+month(plan.result.items[0].end)+' · '+integer(plan.result.items[0].base)+' buah (skenario 80%, total periode). Belum terverifikasi.';
    $('pa-forecast-chart').innerHTML=months.map(function(m){return '<div class="dy-forecast-month"><strong>'+(m.gawangan?integer(m.base):'—')+'</strong><div class="dy-forecast-bars">'+['low','base','high'].map(function(k){return '<span class="'+k+'" style="height:'+(m.gawangan?Math.max(1,m[k]/max*160):0)+'px" title="'+esc(month(m.period))+' · '+({low:'60%',base:'80%',high:'100%'})[k]+': '+(m.gawangan?integer(m[k])+' buah':'Belum ada estimasi')+'"></span>';}).join('')+'</div><small>'+esc(month(m.period))+'</small><small>'+(m.past?'Lampau':m.gawangan?(plan?'Simulasi':'Estimasi'):'Belum ada estimasi')+'</small></div>';}).join('');
    $('pa-forecast-chart').setAttribute('aria-label','Proyeksi panen bulanan. '+months.map(function(m){return month(m.period)+': '+(m.gawangan?integer(m.base)+' buah pada skenario 80 persen':'belum ada estimasi')+(m.past?', periode lampau':'');}).join('; '));
    $('pa-forecast-months').innerHTML=months.map(function(m){return '<tr><th scope="row">'+esc(month(m.period))+(m.past?' · lampau':'')+'</th>'+['low','base','high'].map(function(k){return '<td>'+(m.gawangan?integer(m[k])+' buah':'Belum ada estimasi')+'</td>';}).join('')+'<td>'+(plan?(m.gawangan?plan.candidates.length:'—'):integer(m.gawangan))+'</td></tr>';}).join('');
  }

  function harvestEstimate(rows) {
    var result=window.DayunHarvestEstimate.build(rows);
    monthlyChart(result);
    $('pa-estimate-summary').textContent=result.upcoming.length+' gawangan dengan periode mendatang/berjalan · '+result.overdue.length+' periode sudah lewat · '+result.missing.length+' perlu data ethrel';
    $('pa-estimate-sync').textContent=monitoringAvailable?monitoringSource+'. Snapshot dapat tertinggal dari laporan terbaru.':'Laporan monitoring terbaru belum dapat dimuat. Estimasi sementara hanya memakai data sumber; muat ulang untuk mencoba kembali.';
    $('pa-estimate-table').innerHTML=result.items.map(function(item){
      var amount=item.pool==null?'Belum dapat dihitung':integer(item.low)+'–'+integer(item.high)+' buah<small>Skenario 80%: '+integer(item.base)+' buah'+(item.status==='overdue'?' · periode lampau':'')+'</small>';
      var label=item.status==='overdue'?'Perlu pembaruan lapangan':item.status==='estimated'?'Estimasi bersyarat':'Data belum cukup';
      return '<tr><th scope="row"><a href="dayun-gawangan.html?object='+encodeURIComponent(item.objectId)+'">'+esc(item.shortId)+'</a></th><td>'+(item.start?esc(month(item.start))+' – '+esc(month(item.end)):'Belum tersedia')+'</td><td>'+amount+'</td><td><strong>'+label+'</strong><small>'+esc(item.notes.join(' '))+'</small></td></tr>';
    }).join('')||'<tr><td colspan="4">Belum ada data nanas pada blok ini.</td></tr>';
  }

  function ethrelPeriod(value) {
    var text=String(value||'');
    if (/^\d{4}$/.test(text)) return text+' · bulan belum tercatat';
    if (/^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(text)) return new Date(text.slice(0,7)+'-01T00:00:00').toLocaleDateString('id-ID',{month:'long',year:'numeric'});
    return text||'Periode belum tercatat';
  }
  function ethrelEntries(row) {
    return (row.ethrelHistory||[]).slice().sort(function(a,b){return String(b.period||'').localeCompare(String(a.period||''));});
  }
  function ethrelLatest(row) {
    var entries=ethrelEntries(row);
    if(!entries.length)return row.ethrel>0?'Periode belum tercatat<small>'+integer(row.ethrel)+' tanaman tercatat</small>':'Belum tercatat';
    var latest=entries[0],count=entries.filter(function(e){return e.period===latest.period;}).reduce(function(sum,e){return sum+(Number(e.count)||0);},0);
    return esc(ethrelPeriod(latest.period))+'<small>'+integer(count)+' tanaman</small>';
  }
  function ethrelChart(rows) {
    var months={},undated={};
    rows.forEach(function(row){
      var entries=ethrelEntries(row);
      if(!entries.length&&row.ethrel>0)entries=[{period:null,count:row.ethrel}];
      entries.forEach(function(entry){
        var period=String(entry.period||''),dated=/^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(period),key=dated?period.slice(0,7):ethrelPeriod(period),groups=dated?months:undated;
        if(!groups[key])groups[key]={count:0,ids:{}};
        groups[key].count+=Math.max(0,Number(entry.count)||0);groups[key].ids[row.objectId]=row.shortId;
      });
    });
    var periods=Object.keys(months).sort(),max=Math.max.apply(null,periods.map(function(p){return months[p].count;}).concat([1]));
    $('pa-ethrel-chart').innerHTML=periods.map(function(p){var item=months[p],ids=Object.keys(item.ids),label=ethrelPeriod(p);return '<div class="dy-ethrel-bar-row"><span>'+esc(label)+'</span><div class="dy-ethrel-bar-track" aria-hidden="true"><span style="width:'+(item.count/max*100)+'%"></span></div><strong>'+integer(item.count)+' tanaman<small>'+ids.length+' gawangan</small></strong></div>';}).join('')||'<p class="dy-empty-message">Belum ada catatan Ethrel dengan bulan yang tersedia.</p>';
    var incomplete=Object.keys(undated).sort().map(function(p){return p+': '+integer(undated[p].count)+' tanaman ('+Object.keys(undated[p].ids).length+' gawangan)';});
    $('pa-ethrel-undated').textContent=(incomplete.length?'Di luar grafik bulanan — '+incomplete.join('; ')+'. ':'')+'Hanya bulan yang memiliki catatan ditampilkan. Jumlah perlakuan bukan jumlah tanaman unik; rincian gawangan tersedia di bawah.';
  }

  function ethrelHistory(rows) {
    ethrelChart(rows);
    var treated=rows.filter(function(row){return row.ethrel>0||(row.ethrelHistory||[]).length;}).sort(function(a,b){return a.shortId.localeCompare(b.shortId,'id',{numeric:true});});
    $('pa-ethrel-history-summary').textContent='Riwayat Ethrel · '+treated.length+' gawangan';
    $('pa-ethrel-history-table').innerHTML=treated.map(function(row){var entries=ethrelEntries(row);if(!entries.length)entries=[{period:null,count:row.ethrel}];return entries.map(function(entry){return '<tr><th scope="row"><a href="dayun-gawangan.html?object='+encodeURIComponent(row.objectId)+'">'+esc(row.shortId)+'</a></th><td>'+esc(ethrelPeriod(entry.period))+'</td><td>'+integer(entry.count)+' tanaman</td></tr>';}).join('');}).join('')||'<tr><td colspan="3">Belum ada riwayat Ethrel pada wilayah ini.</td></tr>';
  }

  var showAllWork=false;
  function workPriorities(rows) {
    var order={priority:0,partial:1,followup:2,maintenance:3,verify:4};
    var items=window.DayunHarvestEstimate.ethrelPriorities(rows,analysis.asOf).sort(function(a,b){return order[a.group]-order[b.group]||a.row.shortId.localeCompare(b.row.shortId,'id',{numeric:true});});
    var actions={priority:['Periksa kesiapan ethrel','Belum ada ethrel, bunga, atau panen tercatat; umur kalender memenuhi saringan awal.'],partial:['Pisahkan tanaman belum berbunga','Sudah ada bunga/panen tetapi ethrel belum tercatat. Periksa kelompok tanaman.'],followup:['Evaluasi hasil ethrel','Ethrel sudah tercatat; cocokkan bunga dan realisasi panen sebelum tindakan berikutnya.'],maintenance:['Periksa pertumbuhan','Belum masuk saringan umur awal. Periksa kondisi, nutrisi, dan pertumbuhan.'],verify:['Lengkapi umur dan kondisi','Bulan tanam belum cukup jelas untuk menentukan tindak lanjut.']};
    $('pa-work-table').innerHTML=items.map(function(item,index){var action=actions[item.group];return '<tr'+(index>=7&&!showAllWork?' hidden':'')+'><th scope="row"><a href="dayun-gawangan.html?object='+encodeURIComponent(item.row.objectId)+'">'+esc(item.row.shortId)+'</a></th><td>'+ethrelLatest(item.row)+'</td><td>'+action[0]+'</td><td>'+action[1]+'</td></tr>';}).join('')||'<tr><td colspan="4">Belum ada populasi nanas tercatat untuk blok ini.</td></tr>';
    $('pa-work-more').hidden=items.length<=7;
    $('pa-work-more').textContent=showAllWork?'Ringkas daftar':'Lihat semua '+items.length+' gawangan';
    $('pa-work-more').setAttribute('aria-expanded',String(showAllWork));
  }
  function nextHarvest(rows) {
    var result=window.DayunHarvestEstimate.build(rows),next=result.upcoming;
    if(!next.length){$('pa-next-harvest').innerHTML='<p class="dy-empty-message">Belum ada periode panen mendatang yang didukung catatan ethrel. '+result.overdue.length+' gawangan memiliki periode lama dan '+result.missing.length+' belum memiliki bulan ethrel yang memadai. Perbarui catatan ethrel, perkembangan buah, dan panen.</p>';return;}
    $('pa-next-harvest').innerHTML='<div class="dy-block-table-wrap"><table class="dy-block-table"><thead><tr><th>Gawangan</th><th>Perkiraan periode</th><th>Tindak lanjut</th></tr></thead><tbody>'+next.map(function(i){return '<tr><td><a href="dayun-gawangan.html?object='+encodeURIComponent(i.objectId)+'">'+esc(i.shortId)+'</a></td><td>'+esc(month(i.start))+'–'+esc(month(i.end))+'</td><td>Periksa perkembangan buah dan jumlah yang dapat dipanen.</td></tr>';}).join('')+'</tbody></table></div>';
  }
  function render() {
    var rows=selectedRows(),data=aggregate(rows);
    $('pa-block').value=selected;
    $('pa-data-date').innerHTML='Wilayah: <strong>'+(selected==='ALL'?'Seluruh Blok A–F':'Blok '+esc(selected))+'</strong> · Aktivitas terakhir: <strong>'+date(data.latestActivityDate)+'</strong>';
    kpis(data);workPriorities(rows);ethrelHistory(rows);chart(rows);nextHarvest(rows);harvestEstimate(rows);$('pa-condition-source').textContent=$('pa-estimate-sync').textContent;
  }

  Promise.all([window.DayunDataSource.fetchJSON('data/dayun-gawangan-details.json?v=20260917-performance1'),loadMonitoring()]).then(function(results){
    var details=window.DayunPineappleAnalysis.applyPublishedMonitoring(results[0],results[1]);
    analysis=window.DayunPineappleAnalysis.build(details);
    analysis._detailsById={};
    (details.objects||[]).forEach(function(object){analysis._detailsById[object.objectId]=(object.crops||[]).find(function(crop){return String(crop.crop||'').toUpperCase()==='NANAS';})||null;});
    if(analysis.blockCodes.indexOf(selected)<0&&selected!=='ALL')selected='ALL';
    $('pa-status').hidden=true;$('pa-content').hidden=false;render();if(location.hash)revealTarget(location.hash);
  }).catch(function(error){$('pa-status').textContent='Analisis belum dapat dimuat: '+error.message;});

  function revealTarget(hash) {
    var id;try{id=decodeURIComponent((hash||'').slice(1));}catch(_){return;}
    var target=document.getElementById(id);if(!target)return;
    var parent=target.parentElement;
    while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}
    target.scrollIntoView({block:'start'});
  }
  document.addEventListener('click',function(event){var link=event.target.closest('a[href^="#"]');if(link)revealTarget(link.getAttribute('href'));});
  window.addEventListener('hashchange',function(){revealTarget(location.hash);});
  $('pa-work-more').addEventListener('click',function(){showAllWork=!showAllWork;if(analysis)workPriorities(selectedRows());});
  $('pa-plan-calculate').addEventListener('click',function(){if(analysis)harvestEstimate(selectedRows());});
  $('pa-forecast-period').addEventListener('change',function(){forecastMode=this.value;if(analysis)harvestEstimate(selectedRows());});
  $('pa-block').addEventListener('change',function(){selected=this.value;showAllWork=false;var url=new URL(location.href);if(selected==='ALL')url.searchParams.delete('block');else url.searchParams.set('block',selected);history.replaceState(null,'',url);render();});
})();
