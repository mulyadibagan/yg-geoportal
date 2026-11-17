(function () {
  'use strict';
  window.YG_RESTORATION_ANALYSIS_UI = { init };
  function init(context) {
    const $ = id => document.getElementById('analysis-' + id);
    let model, result, layer, selected = null, source = null, syncing = false, searchTimer;
    const status = message => { $('status').textContent = message; };
    const active = () => { if (!context.isActive()) throw Error('Sesi staf berakhir. Login ulang diperlukan.'); };
    function el(tag, text, attrs = {}) { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; Object.entries(attrs).forEach(([key, value]) => item.setAttribute(key, value)); return item; }
    async function run(action) { try { active(); await action(); } catch (error) { status(error.message); } }
    function clear() { if (layer) context.map.removeLayer(layer); layer = null; }
    function draw(rows = result.rows, scroll = false) {
      active(); clear(); context.clearOtherFocus();
      const data = model.analysisGeoJSON(result, context.peatFeatures, context.peatHash, rows);
      layer = context.L.geoJSON(data, {
        style: feature => ({ color: model.COLORS[feature.properties.kelas_verifikasi], weight: 2, fillOpacity: .18 }),
        onEachFeature: (feature, item) => item.bindPopup(() => {
          const p = feature.properties, box = el('div');
          box.append(el('strong', p.unit_id + ' · kelas unit ' + p.kelas_verifikasi),
            el('p', 'Api 2015–2017: ' + p.api_2015_17), el('p', 'Kanal arsip: ' + p.kanal_arsip),
            el('p', 'Kehilangan tutupan 2018–2025: ' + p.loss_18_25), el('p', 'Sel bukti dalam seluruh unit: ' + p.sel_bukti_dalam_unit),
            el('p', p.lingkup)); return box;
        })
      }).addTo(context.map);
      if (data.features.length) context.map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 12 });
      $('map-status').textContent = rows.length + ' lokasi · ' + data.features.length + ' unit referensi unik pada peta. Warna mengikuti kelas unit historis, bukan seluruh desa atau batas intervensi.';
      if (scroll) document.getElementById('map').scrollIntoView({ block: 'center' });
    }
    function detail(row) {
      active(); selected = row.key; $('detail').hidden = false;
      $('detail-title').textContent = row.desa + ' — ' + row.prioritas_kluster;
      $('detail-location').textContent = row.kecamatan + ' · ' + row.kabupaten;
      $('detail-basis').textContent = row.priorityBasis + '. ' + row.evidenceScope + '. ' + row.sel_bukti_setempat + ' sel tercatat; nol sel bukan bukti tidak ada kerusakan. Status batas sumber: ' + row.status_batas + '.';
      $('detail-next').textContent = row.recommendation.next;
      $('detail-water').textContent = row.recommendation.water;
      $('detail-vegetation').textContent = row.recommendation.vegetation;
      $('detail-gap').textContent = row.recommendation.gap;
      const body = $('units'); body.replaceChildren();
      row.unitIds.forEach(id => {
        const unit = result.source.units.find(unit => unit.unit_id === id), tr = el('tr');
        [unit.unit_id, unit.prioritas, unit.api_2015_17, unit.kanal_arsip, unit.loss_18_25, String(unit.sel_bukti)].forEach(value => tr.append(el('td', value))); body.append(tr);
      });
      if (!row.unitIds.length) { const tr = el('tr'); tr.append(el('td', 'Tidak ada unit bergeometri valid yang terhubung dalam paket ini.', { colspan: '6' })); body.append(tr); }
      document.getElementById('analysis-detail').scrollIntoView({ block: 'start' });
    }
    function render() {
      active();
      result = model.analyze(source, { region: $('region').value, class: $('class').value, search: $('search').value });
      $('summary').textContent = result.candidateLocations + ' kandidat P1–P3 dari ' + result.allRows.length + ' desa/kelurahan dalam sumber · ' + result.counts.D + ' data belum cukup · ' + result.counts.N + ' cakupan belum memadai';
      const regions = $('regions'); regions.replaceChildren();
      result.regions.forEach(region => {
        const card = el('article'); card.append(el('h3', region.name), el('strong', region.candidates + ' kandidat P1–P3'),
          el('p', 'P1: ' + region.counts.P1 + ' · P2: ' + region.counts.P2 + ' · P3: ' + region.counts.P3),
          el('p', region.uniqueUnits + ' unit referensi unik yang beririsan wilayah sumber', { class: 'muted' }),
          el('p', region.counts.P1 ? 'Mulai dari lokasi dengan bukti setempat P1, kemudian lokalisasi kandidat P2 dan P3.' : 'Belum ada lokasi P1 dalam paket ini. Kandidat P2 perlu dilokalisasi; ini tidak menyimpulkan wilayah bebas kerusakan.', { class: 'muted' })); regions.append(card);
      });
      $('count').textContent = result.rows.length + ' lokasi sesuai filter · ' + result.uniqueUnits + ' unit referensi unik. Urutan kelas P1 → P2 → P3 → D/N/X; nama alfabetis dalam kelas, bukan peringkat tingkat kerusakan.';
      const body = $('rows'); body.replaceChildren();
      result.rows.forEach(row => {
        const tr = el('tr'), td = el('td'), button = el('button', 'Telaah ' + row.desa, { type: 'button' });
        button.addEventListener('click', () => run(() => detail(row))); td.append(button);
        tr.append(el('td', row.prioritas_kluster, { class: 'analysis-class class-' + row.prioritas_kluster }), td,
          el('td', row.kabupaten + ' / ' + row.kecamatan), el('td', String(row.sel_bukti_setempat)),
          el('td', row.unitCounts.P1 + ' / ' + row.unitCounts.P2 + ' / ' + row.unitCounts.P3), el('td', row.recommendation.next)); body.append(tr);
      });
      if (!result.rows.length) { const tr = el('tr'); tr.append(el('td', 'Tidak ada lokasi sesuai filter.', { colspan: '6' })); body.append(tr); }
      const current = result.rows.find(row => row.key === selected); if (current) {
        // Rebuild detail without moving the viewport during filtering.
        $('detail').hidden = false;
      } else { selected = null; $('detail').hidden = true; }
      $('report').textContent = model.analysisReport(result);
      syncing = true; try { context.setRegion?.($('region').value); } finally { syncing = false; }
      draw();
    }
    function download(name, data, type) {
      active(); const url = URL.createObjectURL(new Blob([data], { type })), link = el('a', undefined, { href: url, download: name });
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    async function load() {
      active(); clear(); $('content').hidden = true; $('controls').disabled = true; $('reload').disabled = true; status('Memuat sumber analisis staf.');
      try {
        const session = context.getSession(), response = await fetch('https://webgis-api.yayasangambut.org/api/staff/restoration/source', {
          headers: { authorization: 'Bearer ' + session.token }, cache: 'no-store', signal: AbortSignal.timeout(45000)
        }); active();
        if (response.status === 401 || response.status === 403) { document.getElementById('workspace').hidden = true; throw Error('Akses staf ditolak. Login ulang diperlukan.'); }
        if (!response.ok) throw Error('Sumber analisis belum dapat dimuat (HTTP ' + response.status + ').');
        const data = await response.json(); if (!data.ok) throw Error('Respons sumber analisis tidak valid.');
        source = data.value; selected = null; result = model.analyze(source);
        if (result.source.provenance.peatSha256 !== context.peatHash) throw Error('Geometri gambut berbeda dari sumber analisis; peta dan hasil belum diaktifkan.');
        $('source').textContent = 'Kompilasi ' + result.source.provenance.date + ' · ' + result.source.provenance.label + ' · SHA-256 sumber ' + result.source.provenance.fileSha256;
        $('content').hidden = false; $('controls').disabled = false; render();
        status('Hasil berasal dari seluruh sumber Bengkalis–Dumai sesuai kelas bukti. Kebutuhan jumlah sekat dan luas intervensi belum dapat dihitung dari data ini.');
      } finally { $('reload').disabled = false; }
    }
    async function start() {
      model = await import('./restoration-analysis.mjs?v=20261117-analysis1'); active();
      ['region', 'class'].forEach(id => $(id).addEventListener('change', () => run(render)));
      $('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => run(render), 200); });
      $('reload').addEventListener('click', () => run(load));
      $('map-all').addEventListener('click', () => run(() => draw(result.rows, true)));
      $('map-detail').addEventListener('click', () => run(() => { const row = result.rows.find(row => row.key === selected); if (row) draw([row], true); }));
      $('md').addEventListener('click', () => run(() => download('Analisis_Restorasi_Bengkalis_Dumai.md', model.analysisReport(result), 'text/markdown;charset=utf-8')));
      $('csv').addEventListener('click', () => run(() => download('Analisis_Restorasi_Bengkalis_Dumai.csv', model.analysisCSV(result), 'text/csv;charset=utf-8')));
      $('geojson').addEventListener('click', () => run(() => download('Unit_Analisis_Restorasi_Bengkalis_Dumai.geojson', JSON.stringify(model.analysisGeoJSON(result, context.peatFeatures, context.peatHash)), 'application/geo+json')));
      window.addEventListener('storage', () => { if (!context.isActive()) { source = null; result = null; clear(); document.getElementById('workspace').hidden = true; } });
      await load();
    }
    run(start);
    return { clear, onRegencyChange(value) {
      if (syncing || !result) return;
      const region = value.toUpperCase().replace(/\s/g, '');
      if (!region || ['BENGKALIS', 'DUMAI', 'KOTADUMAI'].includes(region)) {
        $('region').value = !region ? '' : region === 'BENGKALIS' ? 'Bengkalis' : 'Kota Dumai'; run(render);
      } else { clear(); $('map-status').textContent = 'Peta referensi sedang di luar Bengkalis–Dumai. Gunakan tombol peta hasil untuk kembali ke cakupan analisis.'; }
    } };
  }
})();
