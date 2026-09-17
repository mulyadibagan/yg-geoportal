(function () {
  'use strict';
  var analysis;
  var selected = new URLSearchParams(location.search).get('block') || 'ALL';
  var $ = function (id) { return document.getElementById(id); };

  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function integer(value) { return Math.round(Number(value) || 0).toLocaleString('id-ID'); }
  function area(value) { return Number(value || 0).toLocaleString('id-ID',{maximumFractionDigits:2}) + ' ha'; }
  function date(value) { return value ? new Date(value + 'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}) : 'Belum tersedia'; }
  function month(value) { return new Date(value + 'T00:00:00').toLocaleDateString('id-ID',{month:'short',year:'2-digit'}); }
  function selectedRows() { return selected === 'ALL' ? analysis.rows.slice() : analysis.rows.filter(function (row) { return row.block === selected; }); }
  function aggregate(rows) {
    return rows.reduce(function (a,row) {
      a.rows += 1;if(row.plants>0)a.activeGawangan += 1;
      ['plants','areaHa','fertilized','harvest','ethrel','flowers'].forEach(function(key){a[key]+=row[key];});
      if(row.latestActivityDate && (!a.latestActivityDate || row.latestActivityDate>a.latestActivityDate))a.latestActivityDate=row.latestActivityDate;
      a.estimatedNotHarvested=Math.max(0,a.plants-a.harvest);
      a.recommendationCounts[row.recommendation.code]=(a.recommendationCounts[row.recommendation.code]||0)+1;
      return a;
    },{rows:0,activeGawangan:0,plants:0,areaHa:0,fertilized:0,harvest:0,ethrel:0,flowers:0,estimatedNotHarvested:0,latestActivityDate:null,recommendationCounts:{}});
  }

  function kpis(data) {
    var items=[['Varietas','Queen'],['Gawangan aktif',integer(data.activeGawangan)+' gawangan'],['Populasi tercatat',integer(data.plants)+' tanaman'],['Luas operasional',area(data.areaHa)],['Tercatat dipupuk',integer(data.fertilized)+' tanaman'],['Tercatat ethrel',integer(data.ethrel)+' tanaman'],['Bunga/buah tercatat',integer(data.flowers)+' tanaman'],['Buah dipanen',integer(data.harvest)+' buah'],['Belum tercatat panen',integer(data.estimatedNotHarvested)+' tanaman']];
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
    kpis(data);recommendations(data);chart(rows);blockTable();gawanganTable(rows);
  }

  fetch('data/dayun-gawangan-details.json?v=20260917-performance1').then(function(response){if(!response.ok)throw new Error('Data tidak dapat dimuat.');return response.json();}).then(function(details){
    analysis=window.DayunPineappleAnalysis.build(details);
    analysis._detailsById={};
    (details.objects||[]).forEach(function(object){analysis._detailsById[object.objectId]=(object.crops||[]).find(function(crop){return String(crop.crop||'').toUpperCase()==='NANAS';})||null;});
    if(analysis.blockCodes.indexOf(selected)<0&&selected!=='ALL')selected='ALL';
    $('pa-status').hidden=true;$('pa-content').hidden=false;render();
  }).catch(function(error){$('pa-status').textContent='Analisis belum dapat dimuat: '+error.message;});

  $('pa-block').addEventListener('change',function(){selected=this.value;var url=new URL(location.href);if(selected==='ALL')url.searchParams.delete('block');else url.searchParams.set('block',selected);history.replaceState(null,'',url);render();});
})();
