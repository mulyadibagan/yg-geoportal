(function(){
  'use strict';
  var API='https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var params=new URLSearchParams(location.search),form=document.getElementById('data-request-form');
  var datasets={
    'mangrove-priority':{summary:'data/mangrove-priority-ranking.csv'},
    'coastal-change':{summary:'data/coastal-analysis-villages.csv'},
    'monitoring-results':{dynamicSummary:true},
    'smoke-validation':{},
    'peatland-restoration':{},'webgis-programme':{}
  };
  var datasetSelect=document.getElementById('dataset'),monitoringOption=document.createElement('option');
  monitoringOption.value='monitoring-results';monitoringOption.textContent='Hasil monitoring terverifikasi';
  datasetSelect.insertBefore(monitoringOption,datasetSelect.querySelector('[value="peatland-restoration"]'));
  var smokeOption=document.createElement('option');smokeOption.value='smoke-validation';smokeOption.textContent='Validasi plume/asap historis';
  datasetSelect.insertBefore(smokeOption,datasetSelect.querySelector('[value="peatland-restoration"]'));
  var scopeRow=document.getElementById('scope-level').closest('.two'),periodLabel=document.createElement('label');
  periodLabel.innerHTML='Periode/tahun yang dibutuhkan <input name="period" id="request-period" maxlength="60" placeholder="Contoh: 2026 atau semua tahun">';
  scopeRow.insertAdjacentElement('afterend',periodLabel);
  function setValue(id,value){var el=document.getElementById(id);if(el&&value&&Array.from(el.options||[]).some(function(o){return o.value===value;}))el.value=value;}
  setValue('dataset',params.get('dataset'));
  var scope=params.get('scope');if(scope==='all')document.getElementById('scope-name').value='Semua wilayah';else if(scope&&scope!=='riau')document.getElementById('scope-name').value=scope.replace(/-/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
  var period=params.get('period');if(period)document.getElementById('request-period').value=period;
  function updateAccessLabels(){
    var access=document.getElementById('access-type'),monitoring=datasetSelect.value==='monitoring-results',smoke=datasetSelect.value==='smoke-validation';
    access.options[0].disabled=smoke;
    if(smoke){access.options[0].textContent='Ringkasan publik tidak tersedia';access.options[1].textContent='GeoJSON anotasi plume draft \u2014 peninjauan YG';access.options[2].textContent='Katalog + GeoJSON draft \u2014 peninjauan YG';if(access.value==='summary')access.value='polygon';return;}
    access.options[0].textContent=monitoring?'Ringkasan monitoring (CSV) \u2014 otomatis':'Ringkasan tabel (CSV) \u2014 otomatis';
    access.options[1].textContent=monitoring?'Data monitoring rinci + foto \u2014 peninjauan YG':'Polygon rinci (GeoJSON) \u2014 peninjauan YG';
    access.options[2].textContent=monitoring?'Ringkasan + data rinci \u2014 peninjauan YG':'Ringkasan + polygon \u2014 peninjauan YG';
  }
  datasetSelect.addEventListener('change',updateAccessLabels);updateAccessLabels();
  function csvCell(value){var text=String(value==null?'':value);return /[",\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;}
  function downloadMonitoringSummary(periodValue){
    return new Promise(function(resolve,reject){
      var callback='ygMonitoringRequest'+Date.now(),script=document.createElement('script');
      var timer=setTimeout(function(){cleanup();reject(new Error('Waktu pemuatan data habis.'));},20000);
      function cleanup(){clearTimeout(timer);delete window[callback];if(script.parentNode)script.parentNode.removeChild(script);}
      window[callback]=function(data){
        try{
          var rows=(data&&Array.isArray(data.features)?data.features:[]).filter(function(feature){return String(feature.properties&&feature.properties.reportType||'').toLowerCase().indexOf('monitor')!==-1;}).map(function(feature){
            var p=feature.properties||{},m={};try{m=JSON.parse(p.proposedInformation||'{}');}catch(error){m={};}
            return [p.reportId||'',p.activityDate||p.receivedAt||'',m.monitoringType||'',p.targetObjectName||p.title||'',p.village||'',p.district||'',p.regency||'',m.condition||'',m.survivalPercent||'',m.monitoredAreaHa||'',m.followUp||''];
          }).filter(function(row){return !periodValue||String(row[1]).slice(0,4)===String(periodValue);});
          var headers=['ID laporan','Tanggal','Jenis monitoring','Objek','Desa/kelurahan','Kecamatan','Kabupaten/kota','Kondisi','Survival (%)','Luas terpantau (ha)','Tindak lanjut'];
          var csv=[headers].concat(rows).map(function(row){return row.map(csvCell).join(',');}).join('\r\n');
          var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),link=document.createElement('a');
          link.href=URL.createObjectURL(blob);link.download='ringkasan-monitoring-'+(periodValue||'semua-tahun')+'.csv';link.click();
          setTimeout(function(){URL.revokeObjectURL(link.href);},1000);cleanup();resolve();
        }catch(error){cleanup();reject(error);}
      };
      script.onerror=function(){cleanup();reject(new Error('Data monitoring tidak dapat dimuat.'));};
      script.src=API+'?page=public-reports&callback='+encodeURIComponent(callback)+'&_='+Date.now();document.head.appendChild(script);
    });
  }
  form.addEventListener('submit',async function(event){
    event.preventDefault();
    var button=form.querySelector('button[type=submit]'),status=document.getElementById('form-status');
    button.disabled=true;status.textContent='Mencatat permintaan…';
    try{
      var values=Object.fromEntries(new FormData(form).entries());
      values.sourcePage=document.referrer||location.href;
      var body=new URLSearchParams({action:'data-request',payload:JSON.stringify(values)});
      var response=await fetch(API,{method:'POST',body:body});
      if(!response.ok)throw new Error('HTTP '+response.status);
      var result=await response.json();
      if(!result.ok)throw new Error(result.message||'Permintaan belum dapat disimpan.');
      var panel=document.getElementById('request-result'),actions=document.getElementById('result-actions');
      document.getElementById('result-title').textContent='Nomor permintaan: '+result.requestId;
      document.getElementById('result-message').textContent=result.accessStatus==='automatic'?'Permintaan berhasil dicatat. Ringkasan dapat diunduh di bawah ini.':'Permintaan berhasil dicatat dan akan ditinjau oleh YG. Pemberitahuan akan dikirim melalui email yang Anda berikan.';
      actions.innerHTML='';
      var config=datasets[values.dataset]||{};
      if(result.accessStatus==='automatic'&&config.summary){var link=document.createElement('a');link.href=config.summary;link.download='';link.textContent='Unduh ringkasan CSV';actions.appendChild(link);}
      if(result.accessStatus==='automatic'&&config.dynamicSummary){var dynamic=document.createElement('a');dynamic.href='#';dynamic.textContent='Unduh ringkasan CSV';dynamic.addEventListener('click',function(event){event.preventDefault();dynamic.textContent='Menyiapkan ringkasan...';downloadMonitoringSummary(values.period).then(function(){dynamic.textContent='Unduh kembali ringkasan CSV';}).catch(function(){dynamic.textContent='Coba unduh kembali';});});actions.appendChild(dynamic);}
      var back=document.createElement('a');back.className='secondary';back.href=document.referrer||'index.html';back.textContent='Kembali ke portal';actions.appendChild(back);
      panel.hidden=false;form.hidden=true;panel.scrollIntoView({behavior:'smooth',block:'center'});
    }catch(error){status.textContent='Permintaan belum tersimpan. Periksa koneksi lalu coba kembali.';console.error(error);}
    finally{button.disabled=false;}
  });
})();
