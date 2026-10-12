(function () {
  'use strict';
  var panel = document.getElementById('dg-mpts-mortality');
  if (!panel) return;
  var objectId = new URLSearchParams(window.location.search).get('object') || '';
  panel.textContent = 'Memuat rekap MPTS mati…';
  fetch('data/dayun-mpts-monitoring.geojson?v=20261012-recap1', {cache:'no-store'})
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      var row = DayunMptsSummary.summarize(data.features).byGawangan[objectId];
      panel.innerHTML = '<h2 style="margin:0 0 12px;font-size:20px">Rekap MPTS mati</h2>' + (row
        ? '<div style="display:flex;flex-wrap:wrap;gap:24px"><strong style="color:#dc2626">● Petai mati: ' + row.Petai + ' pohon</strong><strong style="color:#ea580c">● Jengkol mati: ' + row.Jengkol + ' pohon</strong><strong>Total: ' + (row.Petai + row.Jengkol) + ' pohon</strong></div><p style="margin-bottom:0">Dari ' + row.observed + ' titik MPTS yang tercatat pada gawangan ini. Data diperbarui 8 Oktober 2026.</p>'
        : '<p>Gawangan ini belum tercakup dalam data titik monitoring MPTS. Jumlah tanaman mati belum tersedia.</p>');
    }).catch(function () { panel.textContent = 'Rekap MPTS mati belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.'; });
})();
