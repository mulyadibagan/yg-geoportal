(function(){
  var card=document.getElementById('fire-monthly-card');
  if(!card)return;
  function monthLabel(value){var d=new Date(value+'-01T00:00:00Z');return d.toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'UTC'})}
  fetch('data/fire-monthly/index.json?v=2',{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('index');return r.json()}).then(function(index){var latest=(index.reports||[])[0];if(!latest)throw Error('empty index');card.href=latest.href;return fetch(latest.data+'?v='+encodeURIComponent(latest.generatedAt||'1'),{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('report');return r.json()})}).then(function(data){
    var s=data.summary||{};
    if(!Number(s.hotspots))throw Error('empty report');
    card.querySelector('[data-monthly-hotspots]').textContent=Number(s.hotspots||0).toLocaleString('id-ID');
    card.querySelector('[data-monthly-villages]').textContent=Number(s.villages||0).toLocaleString('id-ID');
    card.querySelector('[data-monthly-companies]').textContent=Number(s.companies||0).toLocaleString('id-ID');
    card.querySelector('h2').textContent=monthLabel(data.month)+' · Provinsi Riau';
    card.querySelector('[data-monthly-status]').textContent=(data.status==='final'?'Laporan final':'Data sementara')+' '+data.period.start+'–'+data.period.end+' · NASA FIRMS high confidence';
  }).catch(function(){card.querySelector('[data-monthly-status]').textContent='Snapshot Juli sedang disiapkan';});
}());
