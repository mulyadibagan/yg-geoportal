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
  assert.match(html, /500 bibit terealisasi/);
  assert.match(html, /aria-valuemax="2000" aria-valuenow="500"/);
  assert.match(html, /500\/2\.000 mangrove · 0\/1\.000 kopi/);
  assert.match(dashboard, /if \(name === "MA Earth"\)/);
  assert.match(dashboard, /data-open-ma-earth/);
  assert.match(dashboard, /data-close-ma-earth/);
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
  assert.equal(maEarth.indicators[0].progress, 25);
  assert.equal(maEarth.indicators[1].progress, 0);
  assert.deepEqual(
    maEarth.indicators.map(indicator => [indicator.label, indicator.value]),
    [
      ["Bibit mangrove tertanam", "500 / 2.000"],
      ["Bibit kopi agroforestri tertanam", "0 / 1.000"]
    ]
  );
  assert.equal(maEarth.verifiedEvidence.length, 1);
  assert.equal(maEarth.verifiedEvidence[0].evidenceId, "MANGROVE-SEPAHAT-MA-EARTH-2026-001");

  const statusSource = read("js/donor-program-status.js");
  assert.match(statusSource, /'ma-earth': '\[data-open-ma-earth\]'/);
});

test("mapped MA Earth realization remains separate from programme output", () => {
  const mangrove = JSON.parse(read("data/area_mangrove.geojson"));
  const mapped = mangrove.features.filter(
    feature => feature.properties.Donor === "MA Earth"
  );

  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].properties.Jumlah_Bib, 500);
  assert.equal(mapped[0].properties.Luas_Ha, 0.2);
});
