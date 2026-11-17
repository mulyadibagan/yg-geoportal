(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.YG_RESTORATION_FOCUS = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const targets = [
    { id: 'pelintung', name: 'Pelintung', key: 'kelurahan pelintung|medang kampai|kota dumai' },
    { id: 'guntung', name: 'Guntung', key: 'kelurahan guntung|medang kampai|kota dumai' }
  ];
  const normal = value => String(value || '').toLowerCase().replace(/^(kelurahan|desa|kota)\s+/, '').replace(/\s+/g, ' ').trim();
  const numeric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  function selectFeatures(data) {
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw Error('Batas kelurahan belum tersedia');
    return targets.map(target => {
      const matches = data.features.filter(f => normal(f.properties?.WADMKD || f.properties?.NAMOBJ) === target.id &&
        normal(f.properties?.WADMKC) === 'medang kampai' && normal(f.properties?.WADMKK) === 'dumai');
      if (matches.length !== 1 || !['Polygon', 'MultiPolygon'].includes(matches[0].geometry?.type)) throw Error('Batas ' + target.name + ' perlu diperiksa');
      return { target, feature: matches[0] };
    });
  }
  function recordSummary(record) {
    if (!record || typeof record !== 'object') throw Error('Ringkasan kelurahan belum tersedia');
    const annual = [2023, 2024, 2025].map(year => numeric(record.annualLossHa?.[year]));
    return {
      peat: numeric(record.referenceAreasHa?.peat),
      loss2025: annual[2],
      loss2023to2025: annual.every(value => value !== null) ? Math.round(annual.reduce((sum, value) => sum + value, 0) * 100) / 100 : null
    };
  }

  function sharedBoundary(features) {
    if (!Array.isArray(features) || features.length !== 2) return [];
    const segments = feature => {
      const geometry = feature.geometry;
      const rings = geometry?.type === 'Polygon' ? geometry.coordinates : geometry?.type === 'MultiPolygon' ? geometry.coordinates.flat() : [];
      const result = new Map();
      rings.forEach(ring => ring.slice(1).forEach((point, index) => {
        const a = ring[index].slice(0, 2), b = point.slice(0, 2);
        if (![...a, ...b].every(Number.isFinite) || JSON.stringify(a) === JSON.stringify(b)) return;
        const key = [JSON.stringify(a), JSON.stringify(b)].sort().join('|');
        result.set(key, [a, b]);
      }));
      return result;
    };
    const a = segments(features[0]), b = segments(features[1]);
    return [...a].filter(([key]) => b.has(key)).map(([, segment]) => segment);
  }
  function validateHistory(data) {
    if (data?.datasetId !== 'dumai-pelintung-guntung-burned-history' || data.unit !== 'ha' || data.scope !== 'kelurahan' ||
        data.spatialFootprintsAvailable !== false || !Array.isArray(data.rows) || !data.rows.length ||
        JSON.stringify(data.targets) !== JSON.stringify(targets.map(target => target.key))) throw Error('Identitas histori tidak cocok');
    const years = new Set();
    data.rows.forEach(row => {
      if (!Number.isInteger(row.year) || row.year < 1900 || row.year > 2100 || years.has(row.year)) throw Error('Tahun histori perlu diperiksa');
      years.add(row.year);
      if (!Array.isArray(row.sourceRefs) || !row.sourceRefs.length || row.sourceRefs.some(id => !data.sources?.[id]?.url)) throw Error('Rujukan histori belum lengkap');
      targets.forEach(target => {
        const cell = row[target.id];
        if (!cell || (cell.status === 'reported' ? numeric(cell.areaHa) === null :
            cell.status !== 'source_dash' || cell.areaHa !== null || cell.raw !== '-')) throw Error('Nilai luas historis tidak sah');
      });
    });
    return data;
  }
  function historyTotal(data, id) {
    if (!targets.some(target => target.id === id)) throw Error('Kelurahan tidak dikenal');
    const values = data.rows.map(row => row[id]).filter(cell => cell.status === 'reported').map(cell => numeric(cell.areaHa));
    return values.length && values.every(value => value !== null) ? Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100 : null;
  }
  function init({ map, regency, setRegency, isActive, L, document, fetchJSON, initialFocus = 'both' }) {
    const el = id => document.getElementById(id);
    const buttons = ['both', ...targets.map(target => target.id)].map(id => el('proposal-' + id));
    let selected = null, layer = null, borderLayer = null, boundaries = null;
    const format = value => value === null ? 'Belum tersedia' : value.toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' ha';
    function activeButtons() {
      ['both', ...targets.map(target => target.id)].forEach(id => el('proposal-' + id).setAttribute('aria-pressed', String(selected === id)));
    }
    function clear() {
      if (layer) map.removeLayer(layer);
      if (borderLayer) map.removeLayer(borderLayer);
      layer = null; borderLayer = null; selected = null; activeButtons();
      el('proposal-map-status').textContent = 'Pilih Pelintung, Guntung, atau kedua kelurahan untuk memfokuskan peta.';
    }
    function fit() {
      if (!layer || !isActive()) return false;
      const bounds = layer.getBounds();
      if (!bounds.isValid()) return false;
      if (layer.bringToFront) layer.bringToFront();
      if (borderLayer?.bringToFront) borderLayer.bringToFront();
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
      return true;
    }
    function apply(id) {
      if (!boundaries || !isActive() || !['both', ...targets.map(target => target.id)].includes(id)) return;
      if (layer) map.removeLayer(layer);
      if (borderLayer) map.removeLayer(borderLayer);
      borderLayer = null;
      layer = null;
      selected = id;
      if (setRegency('DUMAI') === false) { clear(); return; }
      const features = boundaries.filter(item => id === 'both' || item.target.id === id).map(item => item.feature);
      layer = L.geoJSON({ type: 'FeatureCollection', features }, {
        style: { color: '#215eb0', weight: 3, fill: false },
        onEachFeature: (feature, item) => {
          const box = document.createElement('div');
          box.textContent = (feature.properties.WADMKD || feature.properties.NAMOBJ) + ' · batas referensi untuk telaah historis gambut';
          item.bindPopup(box);
        }
      }).addTo(map);
      if (layer.bringToFront) layer.bringToFront();
      const border = id === 'both' ? sharedBoundary(features) : [];
      if (border.length) borderLayer = L.geoJSON({
        type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: border }
      }, { style: { color: '#b87508', weight: 5, dashArray: '7 5' }, interactive: false }).addTo(map);
      activeButtons(); fit();
      el('proposal-map-status').textContent = (id === 'both' ? 'Pelintung dan Guntung' : targets.find(item => item.id === id).name) +
        ' · biru = batas referensi kelurahan' + (border.length ? '; jingga putus-putus = perbatasan bersama' : '') + '. Ringkasan poligon gambut di bawah tetap cakupan Kota Dumai.';
    }
    buttons.forEach((button, index) => button.addEventListener('click', () => apply(['both', ...targets.map(target => target.id)][index])));
    targets.forEach(target => {
      const link = el('proposal-profile-' + target.id);
      link.href = 'village-profile.html?key=' + encodeURIComponent(target.key);
    });
    async function loadMap() {
      try {
        boundaries = selectFeatures(await fetchJSON('data/coastal-villages-riau.geojson'));
        if (!isActive()) return;
        const shared = sharedBoundary(boundaries.map(item => item.feature));
        el('proposal-adjacency-status').textContent = shared.length
          ? 'Pelintung dan Guntung berbatasan langsung pada batas referensi. Konektivitas hidrologi perlu diperiksa di lapangan.'
          : 'Perbatasan bersama belum dapat dikenali dari geometri referensi ini.';
        buttons.forEach(button => button.disabled = false);
        if (initialFocus !== 'none' && (!regency.value || normal(regency.value).replace(/\s/g, '') === 'dumai')) apply(initialFocus);
        else clear();
      } catch (error) {
        el('proposal-map-status').textContent = 'Batas fokus belum dapat dimuat: ' + error.message;
      }
    }
    async function loadMetrics() {
      try {
        const manifest = await fetchJSON('data/administrative-village-analytics/manifest.json');
        const date = /^\d{4}-\d{2}-\d{2}/.test(manifest.generatedAt || '') ? manifest.generatedAt.slice(0, 10) : 'belum tersedia';
        const results = await Promise.allSettled(targets.map(async target => {
          const shard = manifest.index?.[target.key];
          if (!Number.isInteger(shard) || shard < 0 || shard >= manifest.shards) throw Error('Indeks kelurahan belum tersedia');
          const data = await fetchJSON('data/administrative-village-analytics/' + shard + '.json');
          return recordSummary(data[target.key]);
        }));
        if (!isActive()) return;
        results.forEach((result, index) => {
          const target = targets[index];
          if (result.status !== 'fulfilled') {
            el('proposal-data-' + target.id).textContent = 'Ringkasan belum dapat dimuat. Buka profil kelurahan untuk menelusuri data.';
            return;
          }
          const row = result.value;
          el('proposal-peat-' + target.id).textContent = format(row.peat);
          el('proposal-loss-' + target.id).textContent = format(row.loss2025);
          el('proposal-loss3-' + target.id).textContent = format(row.loss2023to2025);
          el('proposal-data-' + target.id).textContent = 'Snapshot analitik: ' + date + '.';
        });
      } catch (error) {
        targets.forEach(target => el('proposal-data-' + target.id).textContent = 'Ringkasan belum dapat dimuat: ' + error.message);
      }
    }

    async function loadEvidence() {
      try {
        const data = validateHistory(await fetchJSON('data/restoration-dumai-evidence.json'));
        if (!isActive()) return;
        const body = el('proposal-burned-rows'); body.replaceChildren();
        const sourceLink = id => {
          const source = data.sources[id], link = document.createElement('a');
          const parsed = new URL(source.url);
          if (parsed.protocol !== 'https:' || !['bappeda.dumaikota.go.id', 'diskominfotiksan.dumaikota.go.id', 'dumaikota.go.id', 'pkgppkl.menlhk.go.id'].includes(parsed.hostname)) throw Error('Rujukan sumber perlu diperiksa');
          link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
          link.textContent = source.title; link.title = source.locator || source.title; return link;
        };
        data.rows.slice().sort((a, b) => a.year - b.year).forEach(row => {
          const tr = document.createElement('tr');
          const year = document.createElement('th'); year.scope = 'row'; year.textContent = String(row.year); tr.appendChild(year);
          targets.forEach(target => {
            const td = document.createElement('td'), cell = row[target.id];
            td.textContent = cell.areaHa === null ? '—' : format(cell.areaHa);
            td.title = cell.areaHa === null ? "Sumber mencatat '-'; tidak diubah menjadi nol" : 'Luas tercatat untuk seluruh kelurahan';
            tr.appendChild(td);
          });
          const refs = document.createElement('td');
          row.sourceRefs.forEach((id, index) => { if (index) refs.appendChild(document.createTextNode(' · ')); refs.appendChild(sourceLink(id)); });
          tr.appendChild(refs); body.appendChild(tr);
        });
        targets.forEach(target => {
          const cell2023 = data.rows.find(row => row.year === 2023)?.[target.id];
          el('proposal-burned-' + target.id).textContent = format(cell2023?.areaHa ?? null);
          el('proposal-burned-total-' + target.id).textContent = format(historyTotal(data, target.id));
        });
        el('proposal-history-status').textContent = 'Catatan Pemkot Dumai 2018–2023 · ditelaah ' + data.reviewedAt + '.';
        el('proposal-history-notes').replaceChildren();
        data.interpretation.forEach(note => { const p = document.createElement('p'); p.textContent = note; el('proposal-history-notes').appendChild(p); });
        el('proposal-recommendations').replaceChildren();
        data.recommendations.forEach(recommendation => {
          const article = document.createElement('article'), title = document.createElement('h3'), basis = document.createElement('p'), list = document.createElement('ol');
          title.textContent = recommendation.title; basis.textContent = recommendation.basis;
          recommendation.actions.forEach(action => { const li = document.createElement('li'); li.textContent = action; list.appendChild(li); });
          article.append(title, basis, list); el('proposal-recommendations').appendChild(article);
        });
        el('proposal-joint-action').textContent = data.jointAction;
        el('proposal-recommendation-status').textContent = data.recommendationStatus;
        el('proposal-technical-source').replaceChildren(sourceLink('teknis'));
      } catch (error) {
        el('proposal-history-status').textContent = 'Histori belum dapat dimuat: ' + error.message;
        targets.forEach(target => el('proposal-burned-' + target.id).textContent = 'Belum tersedia');
      }
    }
    const ready = Promise.all([loadMap(), loadMetrics(), loadEvidence()]);
    return {
      ready, fit, clear,
      onRegencyChange(value) { if (selected && normal(value).replace(/\s/g, '') !== 'dumai') clear(); }
    };
  }
  return { targets, selectFeatures, recordSummary, sharedBoundary, validateHistory, historyTotal, init };
});

