(function () {
  'use strict';
  function esc(value) { return String(value || '').replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  window.YGDayunMpts = {
    attach: function (map, legend) {
      var points = null, records = [], error = false, visible = true;
      map.createPane('dayunMpts');
      map.getPane('dayunMpts').style.zIndex = 450;
      function render() {
        var old = legend.querySelector('.dy-mpts-panel');
        if (old) old.remove();
        var panel = document.createElement('section');
        panel.className = 'dy-legend-panel dy-mpts-panel';
        if (!points) {
          panel.textContent = error ? 'Titik MPTS belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.' : 'Memuat titik monitoring MPTS…';
        } else {
          panel.innerHTML = '<b>Monitoring MPTS · ' + records.length + ' titik</b><p>Petai: 152 titik · Jengkol: 63 titik</p><label><input type="checkbox" ' + (visible ? 'checked' : '') + '> Tampilkan titik MPTS</label><p><span style="color:#16a34a">●</span> Petai tanpa label mati<br><span style="color:#7c3aed">●</span> Jengkol tanpa label mati<br><span style="color:#dc2626">●</span> Berlabel mati: 68 titik</p><button type="button" class="dy-btn ghost">Lihat seluruh titik MPTS</button><p><small>Data diperbarui 8 Oktober 2026.</small></p>';
          panel.querySelector('input').addEventListener('change', function (event) {
            visible = event.target.checked;
            if (visible) points.addTo(map); else map.removeLayer(points);
          });
          panel.querySelector('button').addEventListener('click', function () {
            visible = true; points.addTo(map); render();
            map.fitBounds(points.getBounds(), {padding:[30,30], maxZoom:19});
          });
          panel.querySelector('button').style.cssText = 'display:block;margin-top:12px;padding:10px;border:1px solid #087653;border-radius:8px;background:#edf8f3;color:#087653;font-weight:700;cursor:pointer';
        }
        legend.prepend(panel);
      }
      fetch('data/dayun-mpts-monitoring.geojson?v=20261012-1', {cache:'no-store'})
        .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
        .then(function (data) {
          records = data.features;
          var displayData = Object.assign({}, data, {features:records.map(function (feature) {
            return Object.assign({}, feature, {geometry:{type:'Point', coordinates:feature.properties.displayCoordinates || feature.geometry.coordinates}});
          })});
          points = L.geoJSON(displayData, {
            pane: 'dayunMpts',
            pointToLayer: function (feature, latlng) {
              var p = feature.properties;
              return L.circleMarker(latlng, {pane:'dayunMpts', radius:5, color:'#ffffff', weight:1.3, fillOpacity:1,
                fillColor:p.condition === 'Mati' ? '#dc2626' : p.species === 'Petai' ? '#16a34a' : '#7c3aed'});
            },
            onEachFeature: function (feature, layer) {
              var p = feature.properties;
              layer.bindTooltip(esc(p.pointId + ' · ' + p.sourceLabel));
              layer.bindPopup('<div class="dy-map-popup"><b>' + esc(p.species) + ' · ' + esc(p.pointId) + '</b><span>Kondisi: ' + esc(p.condition) + '</span><span>Barisan tampilan: ' + esc(p.displayRow) + '</span><small>Posisi tampilan dirapikan ' + p.displayShiftMeters + ' m dari GPS asli. Penomoran barisan belum merupakan blok C8/C10.</small><span>Irisan peta GPS asli: ' + esc(p.spatialMatches.join(', ')) + '</span><span>Tinggi: belum tersedia</span><small>Tanggal pada nama foto: 9 Oktober 2026. Tanggal pengamatan belum dikonfirmasi.</small><small>Foto belum tersedia untuk ditampilkan.</small></div>');
            }
          }).addTo(map);
          render();
        }).catch(function (failure) { console.error('Monitoring MPTS:', failure); error = true; render(); });
      return render;
    }
  };
})();
