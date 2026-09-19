const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("MA Earth donor card exposes the approved programme outputs", () => {
  const html = read("index.html");
  const dashboard = read("js/dashboard-v3.js");

  assert.match(html, /data-open-ma-earth/);
  assert.match(html, /id="ma-earth-dashboard"/);
  assert.match(html, /Agustus–Desember 2026/);
  assert.match(html, /<strong>2\.000<\/strong><span>Bibit Mangrove Tertanam<\/span>/);
  assert.match(html, /<strong>1\.000<\/strong><span>Bibit Kopi Agroforestri Tertanam<\/span>/);
  assert.match(html, /2\.000 bibit terealisasi/);
  assert.match(html, /aria-valuemax="2000" aria-valuenow="2000"/);
  assert.match(html, /2\.000\/2\.000 mangrove · 0\/1\.000 kopi/);
  assert.match(dashboard, /if \(name === "MA Earth"\)/);
  assert.match(dashboard, /data-open-ma-earth/);
  assert.match(dashboard, /data-close-ma-earth/);
  assert.match(html, /dashboard-v3\.js\?v=20260919-ma-earth-teluk-piyai1/);
  assert.doesNotMatch(html, /yg-home-fast-snapshot/);
  assert.match(dashboard, /fetch\(source\.url, \{ cache: "no-store" \}\)/);
  assert.ok(fs.existsSync(path.join(ROOT, "assets/funding-ma-earth.svg")));
  assert.match(html, /assets\/funding-ma-earth\.svg\?v=20260902-official1/);
  assert.match(dashboard, /assets\/funding-ma-earth\.svg\?v=20260902-official1/);
  const fundingCss = read("css/funding-modern.css");
  assert.match(fundingCss, /min-height:88px!important/);
  assert.match(fundingCss, /justify-content:center!important/);
  assert.match(fundingCss, /object-position:center center!important/);
  assert.match(fundingCss, /funding-card\.category-card\.funding-card-ma-earth \.category-icon img/);
});

test("MA Earth programme status is sourced from donors.json", () => {
  const donors = JSON.parse(read("data/donors.json"));
  const maEarth = donors.find(donor => donor.slug === "ma-earth");

  assert.ok(maEarth);
  assert.equal(maEarth.name, "MA Earth");
  assert.equal(maEarth.period, "Agustus–Desember 2026");
  assert.equal(maEarth.programs.length, 1);
  assert.equal(maEarth.programs[0].status, "Aktif");
  assert.equal(maEarth.indicators[0].progress, 100);
  assert.equal(maEarth.indicators[1].progress, 0);
  assert.deepEqual(
    maEarth.indicators.map(indicator => [indicator.label, indicator.value]),
    [
      ["Bibit mangrove tertanam", "2.000 / 2.000"],
      ["Bibit kopi agroforestri tertanam", "0 / 1.000"]
    ]
  );
  assert.equal(maEarth.verifiedEvidence.length, 2);
  assert.equal(maEarth.verifiedEvidence[0].evidenceId, "MANGROVE-SEPAHAT-MA-EARTH-2026-001");
  assert.equal(maEarth.verifiedEvidence[1].evidenceId, "MANGROVE-TELUK-PIYAI-PESISIR-MA-EARTH-2026-001");
  assert.equal(maEarth.verifiedEvidence[1].activityDate, undefined);

  const statusSource = read("js/donor-program-status.js");
  assert.match(statusSource, /'ma-earth': '\[data-open-ma-earth\]'/);
});

test("mapped MA Earth realization remains separate from programme output", () => {
  const mangrove = JSON.parse(read("data/area_mangrove.geojson"));
  const mapped = mangrove.features.filter(
    feature => feature.properties.Donor === "MA Earth"
  );

  assert.equal(mapped.length, 2);
  assert.equal(mapped.reduce((sum, feature) => sum + feature.properties.Jumlah_Bib, 0), 2000);
  assert.ok(Math.abs(mapped.reduce((sum, feature) => sum + feature.properties.Luas_Ha, 0) - 0.906211) < 1e-9);

  const sepahat = mapped.find(feature => feature.properties.Object_ID === "MANGROVE-SEPAHAT-MA-EARTH-2026-001");
  const telukPiyai = mapped.find(feature => feature.properties.Object_ID === "MANGROVE-TELUK-PIYAI-PESISIR-MA-EARTH-2026-001");
  assert.ok(sepahat);
  assert.ok(telukPiyai);
  assert.equal(sepahat.properties.photos.length, 4);
  assert.equal(sepahat.properties.Attribute_Updated, "2026-09-03");
  assert.equal(telukPiyai.properties.Jumlah_Bib, 1000);
  assert.equal(telukPiyai.properties.Luas_Ha, 0.506211);
  assert.equal(telukPiyai.properties.Jenis_Tanaman, "Rhizophora sp.");
  assert.equal(telukPiyai.properties.Kelompok, "KTH Makmur Pesisir");
  assert.equal(telukPiyai.properties.Attribute_Updated, "2026-09-19");
  assert.match(telukPiyai.properties.Catatan_Data, /Tanggal penanaman belum tercatat/);
  assert.deepEqual(telukPiyai.properties.photos, [
    "assets/program-photos/ma-earth-teluk-piyai-pesisir-2026-tanaman.jpg",
    "assets/program-photos/ma-earth-teluk-piyai-pesisir-2026-tim.jpg"
  ]);
  telukPiyai.properties.photos.forEach(photo => {
    assert.ok(fs.existsSync(path.join(ROOT, photo)));
  });

  const ring = telukPiyai.geometry.coordinates[0];
  const latitude = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
  const metresPerDegreeX = 111320 * Math.cos(latitude * Math.PI / 180);
  const metresPerDegreeY = 110574;
  const origin = ring[0];
  const points = ring.map(point => [
    (point[0] - origin[0]) * metresPerDegreeX,
    (point[1] - origin[1]) * metresPerDegreeY
  ]);
  const areaSquareMetres = Math.abs(points.slice(0, -1).reduce((sum, point, index) => {
    const next = points[(index + 1) % (points.length - 1)];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0)) / 2;

  assert.ok(areaSquareMetres > 5000 && areaSquareMetres < 5200);
});

test("MA Earth map link opens both mangrove polygons", () => {
  const html = read("index.html");
  const mapHtml = read("webgis.html");
  const mapSource = read("js/map-v4.js");

  assert.match(
    html,
    /webgis\.html\?donor=MA\+Earth&amp;layer=area_mangrove/
  );
  assert.match(mapHtml, /map-v4\.js\?v=20260918-rspo-profile1/);
  assert.match(mapSource, /params\.get\("object"\)/);
  assert.match(mapSource, /normalizedMatchValue\(item\.objectId\) === normalizedObjectId/);
  assert.match(mapSource, /match && focusSearchItem\(match\)/);
  assert.match(mapSource, /item\.layer\.openPopup\(\)/);
});

test("WebGIS programme popups keep a stable compact size", () => {
  const mapHtml = read("webgis.html");
  const mapCss = read("css/webgis-v3.css");

  assert.match(mapHtml, /webgis-v3\.css\?v=20260903-popup-size-contract1/);
  assert.match(mapCss, /body\.webgis-page \.leaflet-popup-content/);
  assert.match(mapCss, /width:min\(300px,calc\(100vw - 54px\)\)!important/);
  assert.match(mapCss, /max-height:min\(52vh,430px\)/);
  assert.match(mapCss, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(mapCss, /aspect-ratio:16\/9/);
});
