const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('coastal analysis keeps filters above a clickable village-boundary map', () => {
  const html = read('coastal-analysis.html');
  const css = read('css/coastal-analysis.css');
  const controller = read('js/coastal-analysis.js');
  const summary = JSON.parse(read('data/coastal-analysis-regional.json'));
  const boundaries = JSON.parse(read('data/coastal-villages-riau.geojson'));
  const administrative = JSON.parse(read('data/batas_administrasi_desa_riau.geojson'));
  const clippedSummary = JSON.parse(read('data/basilam-geniot-village-coastal-overrides.json'));
  const clippedGeo = JSON.parse(read('data/basilam-geniot-village-coastal-overrides.geojson'));
  const profileController = read('js/village-profile.js');

  assert.ok(html.indexOf('class="filters"') < html.indexOf('class="analysis-grid"'));
  assert.match(html, /Batas desa pesisir/);
  assert.match(css, /\.analysis-grid\{display:grid;grid-template-columns:minmax\(0,1fr\) 340px\}/);
  assert.match(controller, /coastal-villages-riau\.geojson/);
  assert.match(controller, /layer\.on\(\{click:\(\)=>selectVillage\(id\)/);
  assert.match(controller, /changeVillageLayers/);
  assert.doesNotMatch(html + controller, /Unduh polygon|Unduh cakupan/);
  assert.equal(summary.villages.length, 232);
  assert.equal(boundaries.features.length, 239);
  const dumaiUpdates = boundaries.features
    .filter(feature => ['14.72.04.1004', '14.72.04.1006'].includes(feature.properties.KODE_DESA))
    .sort((a, b) => a.properties.KODE_DESA.localeCompare(b.properties.KODE_DESA));
  assert.deepEqual(dumaiUpdates.map(feature => feature.properties.WADMKD), [
    'Kelurahan Basilam Baru',
    'Kelurahan Sungai Geniot',
  ]);
  assert.deepEqual(dumaiUpdates.map(feature => feature.properties.Boundary_Source), [
    'Perwali Kota Dumai Nomor 39 Tahun 2025',
    'Perwali Kota Dumai Nomor 40 Tahun 2025',
  ]);
  const administrativeUpdates = administrative.features
    .filter(feature => ['14.72.04.1004', '14.72.04.1006'].includes(feature.properties.KODE_DESA))
    .sort((a, b) => a.properties.KODE_DESA.localeCompare(b.properties.KODE_DESA));
  assert.deepEqual(dumaiUpdates.map(feature => feature.geometry), administrativeUpdates.map(feature => feature.geometry));
  assert.match(controller, /status:'boundary-only'/);
  assert.match(controller, /Nilai abrasi–akresi belum dihitung untuk kelurahan ini/);
  assert.match(controller, /basilam-geniot-village-coastal-overrides\.json/);
  assert.match(controller, /basilam-geniot-village-coastal-overrides\.geojson/);
  assert.match(controller, /function applyVillageOverrides/);
  assert.match(profileController, /basilam-geniot-village-coastal-overrides\.json/);
  assert.deepEqual(clippedSummary.villages.map(row => ({
    code: row.administrativeCode,
    erosion: row.erosionAreaHa,
    accretion: row.accretionAreaHa,
    coastline: row.coastlineLengthKm,
    retreat: row.indicativeMeanRetreatM,
    rate: row.indicativeRetreatRateMPerYear,
  })), [
    { code: '14.72.04.1004', erosion: 3.5, accretion: 3.41, coastline: 11.94, retreat: 2.9, rate: 0.33 },
    { code: '14.72.04.1006', erosion: 10.43, accretion: 16.12, coastline: 13.14, retreat: 7.9, rate: 0.88 },
  ]);
  assert.equal(clippedGeo.features.length, 177);
  assert.ok(clippedGeo.features.every(feature => feature.properties.imageDerivedBeforeBoundaryClip === true));
  assert.ok(clippedGeo.features.every(feature => feature.properties.administrativeBoundaryUsedForAttribution === true));
  assert.ok(clippedGeo.features.every(feature => feature.properties.administrativeSeawardBoundaryUsedForClipping === false));
  assert.ok(clippedGeo.features.every(feature => feature.properties.lockedInterVillageBoundary === true));
  assert.equal(clippedSummary.metadata.boundaryOverlapAreaM2, 0);
  assert.equal(clippedSummary.metadata.administrativeSeawardBoundaryUsedForClipping, false);
  assert.equal(clippedSummary.metadata.lockedInterVillageBoundary, true);
  assert.equal(clippedSummary.metadata.attributionZoneOverlapAreaM2, 0);
  assert.deepEqual(clippedSummary.metadata.sourceAreaHa, { erosion: 13.93, accretion: 19.53 });
  assert.deepEqual(clippedSummary.metadata.assignedAreaHa, { erosion: 13.93, accretion: 19.53 });
  assert.deepEqual(clippedSummary.metadata.outsideTargetBoundariesHa, { erosion: 0, accretion: 0 });
  assert.equal(clippedSummary.villages.reduce((total, row) => total + row.coastlineLengthKm, 0), 25.08);
  assert.equal(clippedSummary.metadata.sourceCoastlineLengthKm, 25.08);
  assert.equal(clippedSummary.metadata.coastlineProxyTotalKm, 21.055888);
  assert.equal(clippedSummary.metadata.coastlineCalibrationFactor, 1.191116);
});
