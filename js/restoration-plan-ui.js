(function () {
  'use strict';
  window.YG_RESTORATION_PLAN_UI = { init };
  function init(context) {
    const $ = id => document.getElementById('plan-' + id);
    const state = { source: null, sourceVersion: null, plan: null, version: null, imported: null, dirty: false, busy: false, layer: null };
    let M;
    const labels = { newBlocks: 'Sekat baru', repairBlocks: 'Perbaikan sekat', fdrs: 'FDRS', tmat: 'Titik TMAT' };
    const status = message => { $('status').textContent = message; };
    const active = () => { if (!context.isActive()) throw Error('Sesi staf berakhir. Login ulang diperlukan.'); };
    function node(tag, text, attrs = {}) {
      const el = document.createElement(tag); if (text !== undefined) el.textContent = text;
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); return el;
    }
    function markDirty() { state.dirty = true; $('save').disabled = state.busy; $('save-state').textContent = 'Perubahan belum disimpan'; updateReport(); }
    async function api(resource, method = 'GET', value, version) {
      active();
      const session = context.getSession();
      const options = { method, headers: { authorization: 'Bearer ' + session.token }, cache: 'no-store', signal: AbortSignal.timeout(45000) };
      if (method === 'PUT') { options.headers['content-type'] = 'application/json'; options.body = JSON.stringify({ expectedVersion: version, value }); }
      const response = await fetch('https://webgis-api.yayasangambut.org/api/staff/restoration/' + resource, options);
      active();
      const result = await response.json();
      if (response.status === 404 && method === 'GET') return null;
      if (!response.ok || !result.ok) {
        if (response.status === 401 || response.status === 403) document.getElementById('workspace').hidden = true;
        throw Error(response.status === 409 ? 'Versi tersimpan telah berubah. Muat ulang rencana sebelum menyimpan; perubahan lokal tetap tersedia untuk diunduh.' : 'Layanan rencana: ' + (result.error || response.status));
      }
      return result;
    }
    function updateReport() {
      if (!state.plan) return;
      const plan = M.validatePlan(state.plan, state.source), sum = M.summary(plan);
      $('summary').textContent = sum.locations + ' lokasi dipilih · ' + sum.uniqueUnits + ' unit referensi unik · ' +
        (sum.newBlocks.unknownLocations === sum.locations ? 'Sekat baru belum dihitung' : sum.newBlocks.known + ' sekat baru dalam usulan; ' + sum.newBlocks.unknownLocations + ' lokasi belum dihitung');
      $('report').textContent = M.report(plan, state.source);
    }
    function draw(entry) {
      active();
      const data = M.referenceGeoJSON({ ...state.plan, entries: [entry] }, state.source, context.peatFeatures, context.peatHash);
      if (state.layer) context.map.removeLayer(state.layer);
      context.clearOtherFocus();
      state.layer = context.L.geoJSON(data, { style: { color: '#7043a4', weight: 3, fillOpacity: .12 }, onEachFeature: (feature, layer) => {
        layer.bindPopup(() => node('p', feature.properties.unit_id + ' · ' + feature.properties.kelas_verifikasi + ' · Unit referensi utuh, bukan tapak intervensi.'));
      } }).addTo(context.map);
      if (data.features.length) context.map.fitBounds(state.layer.getBounds(), { padding: [24, 24], maxZoom: 12 });
      $('map-status').textContent = data.features.length + ' unit referensi untuk ' + entry.key.split('|').at(-1) + '. Poligon ungu bukan batas kegiatan atau luas restorasi.';
      document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function renderEntries() {
      const list = $('entries'); list.replaceChildren();
      for (const entry of state.plan.entries) {
        const row = state.source.villages.find(row => row.key === entry.key);
        const card = node('article', undefined, { class: 'plan-entry' });
        const header = node('div', undefined, { class: 'plan-entry-head' });
        const title = node('div'); title.append(node('h3', row.desa), node('p', row.kabupaten + ' · ' + row.kecamatan + ' · ' + row.prioritas_kluster + ' · ' + row.sel_bukti_setempat + ' sel bukti setempat'));
        const map = node('button', 'Lihat unit referensi', { type: 'button' }); map.addEventListener('click', () => run(() => draw(entry)));
        header.append(title, map); card.append(header, node('p', M.guidance(row), { class: 'muted' }));
        const fields = node('div', undefined, { class: 'plan-fields' });
        for (const field of M.QUANTITIES) {
          const label = node('label', labels[field]);
          const input = node('input', undefined, { type: 'number', min: '0', max: '1000', step: '1', inputmode: 'numeric', placeholder: 'Belum dihitung', 'aria-label': labels[field] + ' ' + row.desa });
          input.value = entry[field] ?? '';
          input.addEventListener('change', () => { try { entry[field] = M.quantity(input.value); input.setCustomValidity(''); markDirty(); } catch (error) { input.setCustomValidity(error.message); input.reportValidity(); input.value = entry[field] ?? ''; } });
          label.append(input); fields.append(label);
        }
        card.append(fields);
        const details = node('details'); details.append(node('summary', 'Tahap, dasar jumlah dan catatan'));
        const phaseLabel = node('label', 'Tahap berikutnya'), select = node('select', undefined, { 'aria-label': 'Tahap ' + row.desa });
        M.STAGES.forEach(stage => { const option = node('option', stage, { value: stage }); select.append(option); }); select.value = entry.stage;
        select.addEventListener('change', () => { entry.stage = select.value; markDirty(); }); phaseLabel.append(select); details.append(phaseLabel);
        for (const [field, caption, max] of [['months', 'Bulan pelaksanaan (relatif sejak proyek mulai)', 80], ['quantityBasis', 'Dasar jumlah unit', 500], ['note', 'Catatan tapak dan tindak lanjut', 2000]]) {
          const label = node('label', caption), input = node(field === 'note' ? 'textarea' : 'input', undefined, { maxlength: String(max), 'aria-label': caption + ' ' + row.desa });
          input.value = entry[field]; input.addEventListener('input', () => { entry[field] = input.value; markDirty(); }); label.append(input); details.append(label);
        }
        card.append(details); list.append(card);
      }
      updateReport();
    }
    function renderCatalog() {
      const region = $('region').value, search = $('search').value.toLocaleLowerCase('id'), scope = $('scope').value;
      const rows = state.source.villages.filter(row => (!region || row.kabupaten === region) &&
        (scope === 'all' || ['P1', 'P2', 'P3'].includes(row.prioritas_kluster)) &&
        [row.desa, row.kecamatan].join(' ').toLocaleLowerCase('id').includes(search))
        .sort((a, b) => a.prioritas_kluster.localeCompare(b.prioritas_kluster) || a.desa.localeCompare(b.desa));
      $('catalog-count').textContent = rows.length + ' lokasi sesuai filter. Pilihan desa untuk proposal terpisah dari kelas bukti.';
      const body = $('villages'); body.replaceChildren();
      rows.forEach(row => {
        const tr = node('tr'), td = node('td');
        const input = node('input', undefined, { type: 'checkbox', 'aria-label': 'Pilih ' + row.desa + ' ' + row.kabupaten });
        input.checked = state.plan.entries.some(entry => entry.key === row.key);
        input.addEventListener('change', () => run(() => {
          active();
          if (!input.checked && state.plan.entries.length === 1) { input.checked = true; throw Error('Sisakan minimal satu lokasi dalam draf.'); }
          if (input.checked) state.plan.entries.push(M.entryFor(state.source, row.key));
          else state.plan.entries = state.plan.entries.filter(entry => entry.key !== row.key);
          markDirty(); renderEntries();
        }));
        td.append(input); tr.append(td, node('td', row.desa), node('td', row.kabupaten + ' / ' + row.kecamatan), node('td', row.prioritas_kluster), node('td', String(row.sel_bukti_setempat)), node('td', String(M.unitsFor(state.source, row.key).length))); body.append(tr);
      });
    }
    async function load() {
      const savedSource = await api('source');
      if (!savedSource) { status('Sumber analisis belum tersimpan. Impor paket analisis staf untuk memulai.'); $('import').open = true; return; }
      state.source = M.normalizeSource(savedSource.value); state.sourceVersion = savedSource.version;
      const savedPlan = await api('plan');
      if (savedPlan && savedPlan.value.sourceVersion !== state.sourceVersion) throw Error('Sumber analisis telah berubah. Draf tersimpan perlu ditinjau terhadap sumber baru; jangan menimpanya.');
      state.plan = savedPlan ? M.validatePlan(savedPlan.value, state.source) : M.draftPlan(state.source, state.sourceVersion);
      state.version = savedPlan?.version ?? null; state.dirty = !savedPlan;
      $('editor').hidden = false; $('save').disabled = !state.dirty;
      $('save-state').textContent = savedPlan ? 'Draf tersimpan dimuat' : 'Draf awal belum disimpan';
      status('Sumber ' + state.source.provenance.date + ' · ' + state.source.villages.length + ' desa/kelurahan · ' + state.source.villages.filter(row => ['P1', 'P2', 'P3'].includes(row.prioritas_kluster)).length + ' kandidat P1–P3.');
      $('source-info').textContent = state.source.provenance.label + ' · SHA-256 ' + state.source.provenance.fileSha256;
      $('import').open = false; renderCatalog(); renderEntries();
    }
    async function run(action) { try { await action(); } catch (error) { status(error.message); } }
    function download(name, data, type) {
      active();
      const blob = new Blob([data], { type }), url = URL.createObjectURL(blob), a = node('a', undefined, { href: url, download: name });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    async function start() {
      M = await import('./restoration-plan-model.mjs?v=20261117-plan1'); active();
      $('file').disabled = false;
      $('file').addEventListener('change', () => run(async () => {
        const file = $('file').files[0]; if (!file || file.size > 6 * 1024 * 1024) throw Error('Pilih paket JSON maksimal 6 MiB.');
        state.imported = M.normalizeSource(JSON.parse(await file.text()));
        if (state.imported.provenance.peatSha256 !== context.peatHash) throw Error('Checksum geometri gambut berbeda dari sumber analisis.');
        $('import-status').textContent = state.imported.villages.length + ' desa/kelurahan siap disimpan; tanggal ' + state.imported.provenance.date + '.';
        $('save-source').disabled = false;
      }));
      $('save-source').addEventListener('click', () => run(async () => {
        $('save-source').disabled = true;
        try { await api('source', 'PUT', state.imported, state.sourceVersion); state.imported = null; await load(); }
        finally { $('save-source').disabled = !state.imported; }
      }));
      ['region', 'scope'].forEach(id => $(id).addEventListener('change', () => run(renderCatalog)));
      $('search').addEventListener('input', () => run(renderCatalog));
      $('scenario').addEventListener('click', () => run(() => { active(); state.plan = M.applyDumaiScenario(state.plan, state.source); markDirty(); renderCatalog(); renderEntries(); status('Skenario 8 sekat Dumai diterapkan: 4 Pelintung + 4 Guntung. Ini target anggaran awal; kebutuhan teknis masih menunggu survei.'); }));
      $('save').addEventListener('click', () => run(async () => {
        state.busy = true; $('save').disabled = true; $('editor').inert = true;
        try { const saved = await api('plan', 'PUT', M.validatePlan(state.plan, state.source), state.version); state.plan = saved.value; state.version = saved.version; state.dirty = false; $('save-state').textContent = 'Draf berhasil disimpan ke server'; status('Rencana tersimpan. Draf ini dapat dilanjutkan oleh staf setelah memuat ulang halaman.'); }
        finally { state.busy = false; $('editor').inert = false; $('save').disabled = !state.dirty; }
      }));
      $('reload').addEventListener('click', () => run(async () => { if (state.dirty) throw Error('Unduh perubahan lokal atau simpan dahulu sebelum memuat ulang.'); await load(); }));
      $('md').addEventListener('click', () => run(() => download('Draf_Restorasi_Bengkalis_Dumai.md', M.report(M.validatePlan(state.plan, state.source), state.source), 'text/markdown;charset=utf-8')));
      $('csv').addEventListener('click', () => run(() => download('Rencana_Restorasi_Bengkalis_Dumai.csv', M.csv(M.validatePlan(state.plan, state.source), state.source), 'text/csv;charset=utf-8')));
      $('geojson').addEventListener('click', () => run(() => download('Unit_Referensi_Restorasi_Bengkalis_Dumai.geojson', JSON.stringify(M.referenceGeoJSON(state.plan, state.source, context.peatFeatures, context.peatHash)), 'application/geo+json')));
      $('json').addEventListener('click', () => run(() => download('Draf_Restorasi_Bengkalis_Dumai.json', JSON.stringify(M.validatePlan(state.plan, state.source), null, 2), 'application/json')));
      window.addEventListener('beforeunload', event => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
      window.addEventListener('storage', () => { if (!context.isActive()) { state.source = null; state.plan = null; document.getElementById('workspace').hidden = true; if (state.layer) context.map.removeLayer(state.layer); } });
      await load();
    }
    run(start);
    return { clear: () => { if (state.layer) context.map.removeLayer(state.layer); state.layer = null; } };
  }
})();
