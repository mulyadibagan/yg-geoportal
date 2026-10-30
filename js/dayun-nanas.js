(function () {
  'use strict';
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function area(value) { return Number(value).toLocaleString('id-ID', {maximumFractionDigits:4}) + ' ha'; }
  window.YGDayunNanas = {
    attach: function (map, legend, control) {
      var polygons = null, visible = true, failed = false, records = [];
      function render() {
        var old = legend.querySelector('.dy-nanas-panel');
        if (old) old.remove();
        var panel = document.createElement('section');
        panel.className = 'dy-legend-panel dy-nanas-panel';
        if (!polygons) panel.textContent = failed ? 'Layer potensi nanas belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.' : 'Memuat potensi penanaman nanas…';
        else {
          var total = records.reduce(function (sum, f) { return sum + f.properties.areaHa; }, 0);
          panel.innerHTML = '<b><span style="color:#f59e0b">■</span> Potensi Penanaman Nanas</b><p>' + records.length + ' bidang · ' + area(total) + '</p><label><input type="checkbox" ' + (visible ? 'checked' : '') + '> Tampilkan potensi nanas</label><p><button type="button" class="dy-btn ghost">Lihat seluruh potensi nanas</button></p><small>Areal potensi penanaman. Luas mengikuti atribut shapefile sumber.</small>';
          panel.querySelector('input').addEventListener('change', function (event) { visible = event.target.checked; if (visible) polygons.addTo(map); else map.removeLayer(polygons); });
          panel.querySelector('button').style.cssText = 'display:block;min-height:44px;padding:10px 14px;border:1px solid #b45309;border-radius:8px;background:#fff7ed;color:#92400e;font-weight:700;cursor:pointer';
          panel.querySelector('button').addEventListener('click', function () { visible = true; polygons.addTo(map); render(); map.fitBounds(polygons.getBounds(), {padding:[30,30], maxZoom:19}); });
        }
        legend.prepend(panel);
      }
      fetch('data/dayun-potensi-nanas.geojson?v=20261030-1').then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); }).then(function (data) {
        records = data.features;
        polygons = L.geoJSON(data, {
          style:{color:'#b45309', weight:2, fillColor:'#f59e0b', fillOpacity:0.5},
          onEachFeature:function (feature, layer) {
            var p = feature.properties;
            layer.bindTooltip(esc(p.id_1 + ' · Potensi nanas'));
            layer.bindPopup('<div class="dy-map-popup"><b>Potensi Penanaman Nanas</b><span>Gawangan: ' + esc(p.id_1) + '</span><span>Blok: ' + esc(p.block) + '</span><span>Luas: ' + area(p.areaHa) + '</span><small>Areal potensi penanaman; luas dari shapefile sumber.</small></div>');
          }
        }).addTo(map);
        if (control) control.addOverlay(polygons, 'Potensi Penanaman Nanas');
        map.on('layeradd layerremove', function (event) { if (event.layer === polygons) { visible = map.hasLayer(polygons); render(); } });
        render();
      }).catch(function (error) { console.error('Potensi nanas:', error); failed = true; render(); });
      return render;
    }
  };
})();