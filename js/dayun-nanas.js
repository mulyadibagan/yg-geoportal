(function () {
  'use strict';
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function area(value) { return Number(value).toLocaleString('id-ID', {maximumFractionDigits:4}) + ' ha'; }
  function summarize(features) {
    var blocks = {}, gawangan = {}, total = 0;
    features.forEach(function (feature) {
      var p = feature.properties, value = Number(p.areaHa), block = String(p.block), id = String(p.id_1);
      if (!Number.isFinite(value) || value < 0) throw new Error('Luas potensi nanas tidak valid.');
      if (!blocks[block]) blocks[block] = {id:block, count:0, areaHa:0, gawangan:{}};
      if (!gawangan[id]) gawangan[id] = {id:id, block:block, count:0, areaHa:0};
      blocks[block].count++; blocks[block].areaHa += value; blocks[block].gawangan[id] = true;
      gawangan[id].count++; gawangan[id].areaHa += value; total += value;
    });
    return {blocks:Object.values(blocks).sort(function(a,b){return a.id.localeCompare(b.id);}), gawangan:Object.values(gawangan).sort(function(a,b){return a.id.localeCompare(b.id, 'id', {numeric:true});}), total:total, count:features.length};
  }
  function renderRecap(features) {
    var host = document.getElementById('dayun-potensi-nanas-recap');
    if (!host) return;
    var summary = summarize(features);
    function table(label, headers, rows, footer) {
      return '<div class="dy-table-wrap" role="region" aria-label="' + label + '" tabindex="0" style="overflow-x:auto"><table class="dy-table" style="width:100%;min-width:360px"><caption style="text-align:left;font-weight:700;padding:12px 0">' + label + '</caption><thead><tr>' + headers.map(function(h){return '<th scope="col">' + h + '</th>';}).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody><tfoot>' + footer + '</tfoot></table></div>';
    }
    host.innerHTML = '<div class="dy-section-head"><div><span>Potensi pengembangan kebun</span><h2>Rekap luas Potensi Penanaman Nanas</h2></div><p>' + summary.count + ' bidang pada ' + summary.gawangan.length + ' gawangan di ' + summary.blocks.length + ' blok · Total <strong>' + area(summary.total) + '</strong></p></div>' +
      table('Luas per blok', ['Blok','Gawangan','Bidang','Luas (ha)'], summary.blocks.map(function(b){return '<tr><th scope="row">Blok ' + esc(b.id) + '</th><td>' + Object.keys(b.gawangan).length + '</td><td>' + b.count + '</td><td>' + area(b.areaHa).replace(' ha','') + '</td></tr>';}), '<tr><th scope="row">Total</th><td>' + summary.gawangan.length + '</td><td>' + summary.count + '</td><td><strong>' + area(summary.total).replace(' ha','') + '</strong></td></tr>') +
      table('Luas per gawangan', ['Gawangan','Blok','Bidang','Luas (ha)'], summary.gawangan.map(function(g){return '<tr><th scope="row">' + esc(g.id) + '</th><td>' + esc(g.block) + '</td><td>' + g.count + '</td><td>' + area(g.areaHa).replace(' ha','') + '</td></tr>';}), '<tr><th scope="row">Total</th><td>—</td><td>' + summary.count + '</td><td><strong>' + area(summary.total).replace(' ha','') + '</strong></td></tr>') +
      '<p><small>Luas dijumlahkan dari atribut shapefile Potensi Penanaman Nanas, lalu dibulatkan hingga empat desimal. Beberapa bidang dalam gawangan yang sama digabungkan dalam satu baris. Rekap mencakup blok dan gawangan yang terdapat pada layer potensi, serta tetap tersedia saat layer disembunyikan.</small></p>';
  }
  window.YGDayunNanas = {
    summarize: summarize,
    attach: function (map, legend, control) {
      var polygons = null, visible = false, failed = false, records = [];
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
        renderRecap(records);
        polygons = L.geoJSON(data, {
          style:{color:'#b45309', weight:2, fillColor:'#f59e0b', fillOpacity:0.5},
          onEachFeature:function (feature, layer) {
            var p = feature.properties;
            layer.bindTooltip(esc(p.id_1 + ' · Potensi nanas'));
            layer.bindPopup('<div class="dy-map-popup"><b>Potensi Penanaman Nanas</b><span>Gawangan: ' + esc(p.id_1) + '</span><span>Blok: ' + esc(p.block) + '</span><span>Luas: ' + area(p.areaHa) + '</span><small>Areal potensi penanaman; luas dari shapefile sumber.</small></div>');
          }
        });
        if (control) control.addOverlay(polygons, 'Potensi Penanaman Nanas');
        map.on('layeradd layerremove', function (event) { if (event.layer === polygons) { visible = map.hasLayer(polygons); render(); } });
        render();
      }).catch(function (error) { console.error('Potensi nanas:', error); failed = true; render(); var host = document.getElementById('dayun-potensi-nanas-recap'); if (host) host.textContent = 'Rekap potensi nanas belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.'; });
      return render;
    }
  };
})();