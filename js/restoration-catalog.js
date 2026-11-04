(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.YG_RESTORATION_CATALOG = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_BYTES = 12 * 1024 * 1024;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function candidates(catalog, kind = 'khg') {
    const pattern = kind === 'khg' ? /(\bkhg\b|kesatuan\s+hidrolog(?:is|i)\s+gambut)/i : kind === 'fire' ? /^KEBAKARANHUTLARIAU_PT_\d{4}_250K$/i : null;
    if (!pattern) return [];
    if (catalog?.access !== 'staff_only' || !Array.isArray(catalog.datasets)) return [];
    const seen = new Set();
    // Duplicate UUIDs are ambiguous and must not be selectable.
    const counts = new Map();
    catalog.datasets.forEach(r => { if (!r || typeof r !== 'object') return; const id = String(r.datasetUuid || r.uuid || '').toLowerCase(); counts.set(id, (counts.get(id) || 0) + 1); });
    return catalog.datasets.flatMap(row => {
      if (!row || typeof row !== 'object') return [];
      const uuid = String(row.datasetUuid || row.uuid || '').toLowerCase();
      const title = String(row.title || row.name || '');
      const display = row.artifacts?.display;
      if (!UUID.test(uuid) || counts.get(uuid) !== 1 || seen.has(uuid) ||
          !pattern.test(title) ||
          (kind === 'fire' && !/Badan Penanggulangan Bencana Daerah/i.test(String(row.publisher || ''))) ||
          display?.available !== true || display.status !== 'ready' ||
          !Number.isSafeInteger(display.bytes) || display.bytes < 1 || display.bytes > MAX_BYTES ||
          !/^[a-f0-9]{64}$/i.test(display.sha256 || '') ||
          !Number.isSafeInteger(display.featureCount) || display.featureCount < 1 || display.featureCount > 25000) return [];
      seen.add(uuid);
      return [{ uuid, title, bytes: display.bytes, sha256: display.sha256.toLowerCase(), featureCount: display.featureCount,
        source: row.source?.detailUrl || row.detailUrl || 'https://geoportal.riau.go.id/katalog/view/' + uuid,
        publisher: typeof row.publisher === 'string' ? row.publisher : 'Belum diketahui',
        year: row.dataYear ?? row.dates?.dataYear ?? null,
        metadataConflictCount: (Array.isArray(row.conflicts) ? row.conflicts : Array.isArray(row.metadata?.conflicts) ? row.metadata.conflicts : []).length }];
    });
  }
  function validate(data) {
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length || data.features.length > 25000) throw Error('Jumlah/format fitur KHG tidak valid');
    const crs = data.crs?.properties?.name;
    if (data.crs && (typeof crs !== 'string' || !/^(?:urn:ogc:def:crs:OGC:1\.3:CRS84|urn:ogc:def:crs:EPSG::4326|EPSG:4326)$/i.test(crs))) throw Error('CRS KHG harus WGS84 longitude/latitude; reproyeksi diperlukan');
    let vertices = 0;
    for (const f of data.features) {
      const g = f?.geometry;
      const polygons = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : null;
      if (f?.type !== 'Feature' || !Array.isArray(polygons) || !polygons.length) throw Error('KHG harus bergeometri Polygon/MultiPolygon');
      for (const rings of polygons) {
        if (!Array.isArray(rings) || !rings.length) throw Error('Poligon KHG kosong');
        for (const ring of rings) {
          if (!Array.isArray(ring) || ring.length < 4) throw Error('Ring KHG tidak lengkap');
          vertices += ring.length;
          if (vertices > 500000) throw Error('Geometri terlalu besar untuk preview lokal');
          for (const p of ring) if (!Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) throw Error('Koordinat KHG tidak valid');
          const a = ring[0], b = ring[ring.length - 1];
          if (a[0] !== b[0] || a[1] !== b[1]) throw Error('Ring KHG belum tertutup');
        }
      }
    }
    // Structural validation only: not a topology, legal-boundary, or scoring approval.
    return data;
  }
  function validatePoints(data) {
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length || data.features.length > 25000) throw Error('Koleksi titik kejadian tidak valid');
    const crs = data.crs?.properties?.name;
    if (data.crs && !['EPSG:4326','urn:ogc:def:crs:EPSG::4326','urn:ogc:def:crs:OGC:1.3:CRS84'].includes(crs)) throw Error('CRS titik kejadian harus WGS84');
    let total = 0;
    for (const feature of data.features) {
      const geometry = feature?.geometry;
      const points = geometry?.type === 'Point' ? [geometry.coordinates] : geometry?.type === 'MultiPoint' ? geometry.coordinates : null;
      if (feature?.type !== 'Feature' || !Array.isArray(points) || !points.length) throw Error('Geometri kejadian harus Point/MultiPoint');
      total += points.length; if (total > 500000) throw Error('Titik kejadian melampaui batas');
      for (const p of points) if (!Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) throw Error('Koordinat kejadian tidak valid');
    }
    return data;
  }
  function scopePoints(features, peat, contains) {
    const inside = point => peat.some(f => { const b = f._restorationBounds; return (!b || point[0] >= b[0] && point[0] <= b[2] && point[1] >= b[1] && point[1] <= b[3]) && contains(point, f.geometry); });
    return features.flatMap(feature => {
      if (feature.geometry.type === 'Point') return inside(feature.geometry.coordinates) ? [feature] : [];
      const coordinates = feature.geometry.coordinates.filter(inside);
      if (!coordinates.length) return [];
      // Keep only original point coordinates; never interpolate or infer burned polygons.
      return [{ type:'Feature', ...(feature.id !== undefined ? {id:feature.id} : {}), properties:feature.properties, geometry:{type:'MultiPoint',coordinates} }];
    });
  }
  async function readDisplay(response, item, cryptoAPI, validator = validate) {
    if (!response.ok) throw Error('Dataset belum tersedia (HTTP ' + response.status + ')');
    const reader = response.body?.getReader();
    if (!reader) throw Error('Streaming respons dataset tidak didukung');
    const chunks = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES || size > item.bytes) throw Error('Ukuran respons dataset melampaui metadata/batas preview');
        chunks.push(value);
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    finally { reader.releaseLock(); }
    if (size !== item.bytes) throw Error('Ukuran dataset tidak sesuai metadata');
    const bytes = new Uint8Array(size); let offset = 0;
    chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength; });
    const digest = Array.from(new Uint8Array(await cryptoAPI.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (digest !== item.sha256) throw Error('Checksum dataset tidak sesuai katalog; muat ulang katalog');
    const data = validator(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
    if (data.features.length !== item.featureCount) throw Error('Jumlah fitur dataset tidak sesuai katalog');
    return data;
  }
  function label(f, index) {
    const p = f.properties || {};
    const value = p.NAMA_KHG ?? p.NAMOBJ ?? p.nama_khg ?? p.KHG ?? p.NAMA;
    return typeof value === 'string' && value.trim() ? value : 'Poligon KHG ' + (index + 1);
  }
  function groupFEG(data) {
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length > 25000) throw Error('Koleksi FEG tidak valid atau terlalu besar');
    const groups = new Map();
    let missingCode = 0, invalidGeometry = 0, missingName = 0;
    const sourceText = value => typeof value === 'string' && !/^(?:no data|n\/a|null|none|-|0)$/i.test(value.trim()) ? value.trim() : '';
    for (const feature of data.features) {
      // Only source identifiers are grouped. Do not infer membership spatially,
      // dissolve geometry, sum area, or create an ecological indicator.
      const code = sourceText(feature?.properties?.kode_khg);
      if (!code) { missingCode++; continue; }
      try { validate({ type: 'FeatureCollection', ...(data.crs ? { crs: data.crs } : {}), features: [feature] }); }
      catch (_) { invalidGeometry++; continue; }
      const name = sourceText(feature.properties?.nama_khg);
      if (!name) missingName++;
      if (!groups.has(code)) groups.set(code, { code, names: new Set(), features: [] });
      const group = groups.get(code);
      if (name) group.names.add(name);
      group.features.push(feature);
    }
    return {
      groups: [...groups.values()].sort((a,b) => a.code.localeCompare(b.code)).map(group => ({
        code: group.code, names: [...group.names].sort(), features: group.features,
        nameConflict: group.names.size > 1,
        label: group.code + (group.names.size === 1 ? ' · ' + [...group.names][0] : group.names.size > 1 ? ' · nama sumber berbeda' : ' · nama belum tersedia') + ' · ' + group.features.length + ' bagian FEG'
      })),
      missingCode, invalidGeometry, missingName,
      scope: 'source-attribute-groups-only', standaloneBoundary: false, scoringValidated: false
    };
  }
  return Object.freeze({ candidates, validate, validatePoints, scopePoints, readDisplay, label, groupFEG, MAX_BYTES });
});
