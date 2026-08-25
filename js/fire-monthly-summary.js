(function(){
  var card=document.getElementById('fire-monthly-card');
  if(!card)return;
  fetch('data/fire-monthly/2026-07.json?v=1').then(function(r){if(!r.ok)throw Error('report');return r.json()}).then(function(data){
    var s=data.summary||{};
    card.querySelector('[data-monthly-hotspots]').textContent=Number(s.hotspots||0).toLocaleString('id-ID');
    card.querySelector('[data-monthly-villages]').textContent=Number(s.villages||0).toLocaleString('id-ID');
    card.querySelector('[data-monthly-companies]').textContent=Number(s.companies||0).toLocaleString('id-ID');
    card.querySelector('[data-monthly-status]').textContent='Data lengkap 1–31 Juli 2026 · NASA FIRMS high confidence';
  }).catch(function(){card.querySelector('[data-monthly-status]').textContent='Snapshot Juli sedang disiapkan';});
}());
