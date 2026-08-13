(function(){
  'use strict';
  var API='https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var params=new URLSearchParams(location.search),form=document.getElementById('data-request-form');
  var datasets={
    'mangrove-priority':{summary:'data/mangrove-priority-ranking.csv'},
    'coastal-change':{summary:'data/coastal-analysis-villages.csv'},
    'peatland-restoration':{},'webgis-programme':{}
  };
  function setValue(id,value){var el=document.getElementById(id);if(el&&value&&Array.from(el.options||[]).some(function(o){return o.value===value;}))el.value=value;}
  setValue('dataset',params.get('dataset'));
  var scope=params.get('scope');if(scope&&scope!=='riau')document.getElementById('scope-name').value=scope.replace(/-/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
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
      var back=document.createElement('a');back.className='secondary';back.href=document.referrer||'index.html';back.textContent='Kembali ke portal';actions.appendChild(back);
      panel.hidden=false;form.hidden=true;panel.scrollIntoView({behavior:'smooth',block:'center'});
    }catch(error){status.textContent='Permintaan belum tersimpan. Periksa koneksi lalu coba kembali.';console.error(error);}
    finally{button.disabled=false;}
  });
})();
