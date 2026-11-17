(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.YG_RESTORATION_FOCUS = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const targets = [
    { id: 'mundam', name: 'Mundam', key: 'kelurahan mundam|medang kampai|kota dumai', shard: 32 },
    { id: 'pelintung', name: 'Pelintung', key: 'kelurahan pelintung|medang kampai|kota dumai', shard: 35 }
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
  function init({ map, regency, setRegency, isActive, L, document, fetchJSON, initialFocus = 'both' }) {
    const el = id => document.getElementById(id);
    const buttons = ['both', 'mundam', 'pelintung'].map(id => el('proposal-' + id));
    let selected = null, layer = null, boundaries = null;
    const format = value => value === null ? 'Belum tersedia' : value.toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' ha';
    function activeButtons() {
      ['both', 'mundam', 'pelintung'].forEach(id => el('proposal-' + id).setAttribute('aria-pressed', String(selected === id)));
    }
    function clear() {
      if (layer) map.removeLayer(layer);
      layer = null; selected = null; activeButtons();
      el('proposal-map-status').textContent = 'Pilih Mundam, Pelintung, atau kedua kelurahan untuk memfokuskan peta.';
    }
    function fit() {
      if (!layer || !isActive()) return false;
      const bounds = layer.getBounds();
      if (!bounds.isValid()) return false;
      if (layer.bringToFront) layer.bringToFront();
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
      return true;
    }
    function apply(id) {
      if (!boundaries || !isActive() || !['both', 'mundam', 'pelintung'].includes(id)) return;
      if (layer) map.removeLayer(layer);
      layer = null;
      selected = id;
      if (setRegency('DUMAI') === false) { clear(); return; }
      const features = boundaries.filter(item => id === 'both' || item.target.id === id).map(item => item.feature);
      layer = L.geoJSON({ type: 'FeatureCollection', features }, {
        style: { color: '#215eb0', weight: 3, fill: false },
        onEachFeature: (feature, item) => {
          const box = document.createElement('div');
          box.textContent = (feature.properties.WADMKD || feature.properties.NAMOBJ) + ' · fokus pengembangan proposal restorasi gambut';
          item.bindPopup(box);
        }
      }).addTo(map);
      if (layer.bringToFront) layer.bringToFront();
      activeButtons(); fit();
      el('proposal-map-status').textContent = (id === 'both' ? 'Mundam dan Pelintung' : targets.find(item => item.id === id).name) +
        ' · garis biru = batas referensi kelurahan. Ringkasan poligon gambut di bawah tetap cakupan Kota Dumai.';
    }
    buttons.forEach((button, index) => button.addEventListener('click', () => apply(['both', 'mundam', 'pelintung'][index])));
    targets.forEach(target => {
      const link = el('proposal-profile-' + target.id);
      link.href = 'village-profile.html?key=' + encodeURIComponent(target.key);
    });
    async function loadMap() {
      try {
        boundaries = selectFeatures(await fetchJSON('data/coastal-villages-riau.geojson'));
        if (!isActive()) return;
        buttons.forEach(button => button.disabled = false);
        if (!regency.value || normal(regency.value).replace(/\s/g, '') === 'dumai') apply(initialFocus);
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
    const ready = Promise.all([loadMap(), loadMetrics()]);
    return {
      ready, fit, clear,
      onRegencyChange(value) { if (selected && normal(value).replace(/\s/g, '') !== 'dumai') clear(); }
    };
  }
  return { targets, selectFeatures, recordSummary, init };
});

