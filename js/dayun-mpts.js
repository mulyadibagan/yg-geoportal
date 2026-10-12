(function () {
  'use strict';
  function esc(value) { return String(value || '').replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  window.YGDayunMpts = {
    attach: function (map, legend) {
      var points = null, records = [], error = false, visible = true, markerById = {};
      map.createPane('dayunMpts');
      map.getPane('dayunMpts').style.zIndex = 450;
      // SVG only captures clicks on the marker paths. A canvas in this upper
      // pane captures empty space too and blocks the existing polygon canvas.
      var pointRenderer = L.svg({pane:'dayunMpts'});
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
          var deadRecords = records.filter(function (feature) { return feature.properties.condition === 'Mati'; });
          var details = document.createElement('details');
          details.innerHTML = '<summary style="cursor:pointer;font-weight:700;padding:10px 0">Detail ' + deadRecords.length + ' titik MPTS mati</summary><p>Petai: 55 titik · Jengkol: 13 titik</p><div style="max-height:260px;overflow:auto">' + deadRecords.map(function (feature) {
            var p = feature.properties;
            return '<button type="button" data-mpts-point="' + esc(p.pointId) + '" style="display:block;width:100%;padding:8px;margin-bottom:5px;border:1px solid #e5d1d1;border-radius:8px;background:#fff7f7;color:#862626;text-align:left;cursor:pointer">' + esc(p.pointId + ' · ' + p.species) + '<br><small>' + esc(p.spatialMatches.join(', ')) + '</small></button>';
          }).join('') + '</div>';
          details.querySelectorAll('[data-mpts-point]').forEach(function (button) {
            button.addEventListener('click', function () {
              visible = true; points.addTo(map); panel.querySelector('input').checked = true;
              var marker = markerById[button.getAttribute('data-mpts-point')];
              map.setView(marker.getLatLng(), 19, {animate:false}); marker.openPopup();
            });
          });
          panel.appendChild(details);
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
              return L.circleMarker(latlng, {pane:'dayunMpts', renderer:pointRenderer, radius:5, color:'#ffffff', weight:1.3, fillOpacity:1,
                fillColor:p.condition === 'Mati' ? '#dc2626' : p.species === 'Petai' ? '#16a34a' : '#7c3aed'});
            },
            onEachFeature: function (feature, layer) {
              var p = feature.properties;
              markerById[p.pointId] = layer;
              layer.bindTooltip(esc(p.pointId + ' · ' + p.sourceLabel));
              var gawangan = p.spatialMatches.filter(function (id) { return /^DAYUN-GT-[A-F]-\d{2}$/.test(id); });
              layer.bindPopup('<div class="dy-map-popup"><b>' + esc(p.species) + ' · ' + esc(p.pointId) + '</b><span>Kondisi tercatat: ' + esc(p.condition) + '</span><span>Gawangan: ' + esc(p.spatialMatches.join(', ')) + '</span><span>Tinggi: belum tersedia</span><small>Data diperbarui 8 Oktober 2026.</small><small>Foto dan penyebab kematian belum tersedia.</small>' + gawangan.map(function (id) { return '<a href="dayun-gawangan.html?object=' + encodeURIComponent(id) + '">Buka profil ' + esc(id.replace('DAYUN-', '')) + '</a>'; }).join('<br>') + '</div>');
            }
          }).addTo(map);
          render();
        }).catch(function (failure) { console.error('Monitoring MPTS:', failure); error = true; render(); });
      return render;
    }
  };
})();
