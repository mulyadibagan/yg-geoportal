(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.YG_RESTORATION = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'ecological-need-v1-provisional';
  const INDICATORS = Object.freeze([
    { id: 'degradation', label: 'Degradasi ekosistem', weight: .30 },
    { id: 'fireHistory', label: 'Riwayat kebakaran', weight: .25 },
    { id: 'hydrology', label: 'Gangguan hidrologi', weight: .25 },
    { id: 'vegetationLoss', label: 'Kehilangan vegetasi', weight: .15 },
    { id: 'peatSensitivity', label: 'Sensitivitas gambut', weight: .05 }
  ].map(Object.freeze));
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const text = s => typeof s === 'string' && s.trim().length > 0;
  const PRESSURES = Object.freeze([
    {id:'fire',label:'Kebakaran di lahan gambut'},
    {id:'forestOpening',label:'Bukaan hutan di lahan gambut'},
    {id:'canals',label:'Kanal / drainase di lahan gambut'}
  ].map(Object.freeze));
  function assessPressures(inputs = {}) {
    const indicators=PRESSURES.map(def=>{
      const row=inputs?.[def.id],p=row?.provenance;
      let reason=null;
      if(typeof row?.present!=='boolean')reason='Data belum tersedia';
      else if(row.validated!==true||!text(row.validation?.reference)||!text(row.definition))reason='Bukti tekanan belum tervalidasi';
      else if(!text(p?.source)||!Number.isInteger(p.year)||p.year<1900||p.year>2100||!text(p.version))reason='Metadata sumber/tahun/versi belum lengkap';
      else if(row.present===false&&row.coverageComplete!==true)reason='Cakupan belum cukup untuk menyatakan tidak ditemukan';
      return {...def,present:reason?null:row.present,reason,definition:row?.definition??null,provenance:p?{...p}:null,validation:row?.validation?{...row.validation}:null,coverageComplete:row?.coverageComplete===true};
    });
    const missing=indicators.filter(i=>i.present===null).map(i=>i.id),complete=!missing.length;
    const pressureCount=complete?indicators.filter(i=>i.present).length:null;
    return {modelVersion:'three-pressure-convergence-v1',provisional:true,score:null,complete,pressureCount,indicators,missing,
      category:!complete?'Belum dinilai':pressureCount===3?'Tinggi':pressureCount===2?'Sedang':pressureCount===1?'Rendah':'Tidak terindikasi pada cakupan data',
      implementationReadiness:{status:'Belum dinilai',score:null}};
  }
  function normalize(value, min, max, direction = 'increasing') {
    if (![value, min, max].every(finite) || max <= min || value < min || value > max ||
        !['increasing', 'decreasing'].includes(direction)) return null;
    const score = (value - min) / (max - min) * 100;
    return direction === 'decreasing' ? 100 - score : score;
  }
  function category(score) {
    if (!finite(score) || score < 0 || score > 100) return 'Belum dinilai';
    return score >= 75 ? 'Tinggi' : score >= 50 ? 'Sedang' : 'Rendah';
  }
  // All five indicators are critical until an approved missing-data policy exists.
  // Validation is supplied by a reviewed upstream pipeline, never inferred from a map layer.
  function assess(inputs = {}) {
    inputs = inputs && typeof inputs === 'object' ? inputs : {};
    const indicators = INDICATORS.map(def => {
      const row = inputs[def.id], provenance = row?.provenance;
      let reason = null;
      if (!row || !finite(row.value)) reason = 'Data belum tersedia';
      else if (row.validated !== true || !text(row.validation?.reviewer) || !text(row.validation?.reference)) reason = 'Data belum tervalidasi';
      else if (!text(provenance?.source) || !Number.isInteger(provenance?.year) || provenance.year < 1900 || provenance.year > 2100 || !text(provenance?.version)) reason = 'Metadata sumber/tahun/versi belum lengkap';
      else if (!text(row.normalization?.method)) reason = 'Metode normalisasi belum tersedia';
      const score = reason ? null : normalize(row.value, row.normalization.min, row.normalization.max, row.normalization.direction);
      if (!reason && score === null) reason = 'Nilai atau batas normalisasi tidak valid';
      return { ...def, score, reason, provenance: provenance ? { ...provenance } : null,
        validation: row?.validation ? { ...row.validation } : null,
        normalization: row?.normalization ? { ...row.normalization } : null, value: row?.value ?? null };
    });
    const missing = indicators.filter(row => row.score === null).map(row => row.id);
    const score = missing.length ? null : indicators.reduce((sum, row) => sum + row.weight * row.score, 0);
    return { modelVersion: VERSION, score, category: category(score), indicators, missing,
      implementationReadiness: { status: 'Belum dinilai', score: null } };
  }
  function district(value) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function select(features, regency, khg) {
    return features.filter(f => (!regency || district(f.properties?.KABKOT) === district(regency)) &&
      (!khg || String(f.properties?.khgId || '') === khg));
  }
  function summarize(features, profile) {
    const screening=profile==='pressures';
    const results = features.map(f => screening?assessPressures(f.properties?.restorationPressures):assess(f.properties?.restorationIndicators));
    const areas = features.map(f => f.properties?.Luas_Ha);
    return { count: features.length, assessed: results.filter(r => screening?r.complete:r.score !== null).length,
      priorityCount: results.filter(r => r.category === 'Tinggi').length,
      unassessed: results.filter(r => screening?!r.complete:r.score === null).length,
      // Preserve the source area; no conversion from Shape_Area (degrees squared).
      sourceAreaHa: features.length && areas.every(a => finite(a) && a >= 0) ? areas.reduce((a, b) => a + b, 0) : null };
  }
  // Administrative summaries preserve source areas, without inferring a KHG overlay.
  function regions(features, profile) {
    const groups = new Map();
    features.forEach(feature => {
      const name = String(feature.properties?.KABKOT || '').trim();
      const key = district(name);
      if (!groups.has(key)) groups.set(key, { name: name || 'Kabupaten belum tersedia', features: [] });
      groups.get(key).features.push(feature);
    });
    return Array.from(groups.values(), group => ({ name: group.name, ...summarize(group.features,profile) }))
      .sort((a, b) => b.priorityCount - a.priorityCount || a.name.localeCompare(b.name, 'id'));
  }
  function ringContains(point, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function contains(point, geometry) {
    const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
    return polygons.some(rings => rings.length && ringContains(point, rings[0]) && !rings.slice(1).some(r => ringContains(point, r)));
  }
  return Object.freeze({ VERSION, INDICATORS, PRESSURES, assessPressures, normalize, category, assess, district, select, summarize, regions, contains });
});
