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
      return Promise.all(['data/dayun-trees-20261030.geojson?v=20261030-1','data/dayun-gawangan-details.json'].map(function(url){return fetch(url,{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('load');return r.json();});})).then(function(values){var extra=values[0],details=values[1];
        var all=data.features.concat(extra.features.filter(function(f){return f.properties.layerKind==='MPTS';})),inv=DayunMptsSummary.inventory(all),mpts=inv.byGawangan[objectId],sorean=DayunMptsSummary.inventory(extra.features.filter(function(f){return f.properties.layerKind==='Sorean';})).byGawangan[objectId];
        var section=document.createElement('section'),title=document.createElement('h2'),text=document.createElement('p'),note=document.createElement('small');title.textContent='Inventaris titik pohon';text.textContent=(mpts?mpts.total:0)+' titik MPTS'+(mpts?' · '+Object.keys(mpts.species).map(function(k){return k+': '+mpts.species[k];}).join(' · '):'')+' · Sorean: '+(sorean?sorean.total:0)+' titik';note.textContent='Termasuk tambahan titik 30 Oktober 2026. Bulan tanam mengikuti data gawangan; kondisi tambahan belum dikonfirmasi.';section.append(title,text,note);if(mpts){var dates=document.createElement('p');dates.textContent=Object.keys(mpts.species).map(function(species){var periods=DayunMptsSummary.plantingPeriods({properties:{species:species,spatialMatches:[objectId]}},details);return species+': '+(periods.length?periods.map(function(r){return r.period;}).join(' · '):'bulan tanam belum tercatat');}).join(' · ');section.append(dates);}panel.prepend(section);
      }).catch(function(){var message=document.createElement('p');message.textContent='Inventaris tambahan belum dapat dimuat.';panel.appendChild(message);});
    }).catch(function () { panel.textContent = 'Rekap MPTS mati belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.'; });
})();
