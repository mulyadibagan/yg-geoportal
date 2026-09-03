const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function sum(features, property) {
  return features.reduce(
    (total, feature) => total + Number(feature.properties[property] || 0),
    0
  );
}

test("Kelapa Pati Phase III keeps the Plot 1 revision isolated", () => {
  const data = JSON.parse(read("data/area_mangrove.geojson"));
  const plots = data.features
    .filter(feature =>
      feature.properties.Desa === "Kelapa Pati" &&
      feature.properties.Ket === "Phase III"
    )
    .sort((left, right) =>
      left.properties.Object_ID.localeCompare(right.properties.Object_ID)
    );

  assert.equal(plots.length, 3);
  assert.deepEqual(
    plots.map(feature => ({
      id: feature.properties.Object_ID,
      area: feature.properties.Luas_Ha,
      seedlings: feature.properties.Jumlah_Bib
    })),
    [
      {
        id: "MANGROVE-KELAPA-PATI-PHASE-III-2026-001",
        area: 2.935,
        seedlings: 5870
      },
      {
        id: "MANGROVE-KELAPA-PATI-PHASE-III-2026-002",
        area: 0.05,
        seedlings: 100
      },
      {
        id: "MANGROVE-KELAPA-PATI-PHASE-III-2026-003",
        area: 0.15,
        seedlings: 300
      }
    ]
  );
  assert.equal(sum(plots, "Luas_Ha"), 3.135);
  assert.equal(sum(plots, "Jumlah_Bib"), 6270);
  assert.match(plots[0].properties.Riwayat_Penanaman, /tambahan 500 bibit/);
});

test("Phase III and donor totals remain separated", () => {
  const data = JSON.parse(read("data/area_mangrove.geojson"));
  const aramco = data.features.filter(
    feature => feature.properties.Donor !== "MA Earth"
  );
  const phaseThree = aramco.filter(
    feature => feature.properties.Ket === "Phase III"
  );
  const maEarth = data.features.filter(
    feature => feature.properties.Donor === "MA Earth"
  );

  assert.ok(Math.abs(sum(phaseThree, "Luas_Ha") - 9.135) < 1e-9);
  assert.equal(sum(phaseThree, "Jumlah_Bib"), 18270);
  assert.ok(Math.abs(sum(aramco, "Luas_Ha") - 13.235) < 1e-9);
  assert.equal(sum(aramco, "Jumlah_Bib"), 43915);
  assert.equal(sum(maEarth, "Luas_Ha"), 0.4);
  assert.equal(sum(maEarth, "Jumlah_Bib"), 1000);
});

test("latest Kelapa Pati monitoring resolves to permanent Plot 1", () => {
  const mapSource = read("js/map-v4.js");
  const detailSource = read("js/monitoring-detail.js");

  assert.match(
    mapSource,
    /"YG-20260827-154822-115":\s*\[\s*"MANGROVE-KELAPA-PATI-PHASE-III-001"\s*\]/
  );
  assert.match(
    detailSource,
    /'area_mangrove:auto:1674337344':'MANGROVE-KELAPA-PATI-PHASE-III-001'/
  );
  assert.match(
    detailSource,
    /'MANGROVE-KELAPA-PATI-PHASE-III-2025-001':'MANGROVE-KELAPA-PATI-PHASE-III-001'/
  );
  assert.match(mapSource, /props\.Monitoring_Report_IDs = Array\.from\(history\)\.sort\(\)/);
  assert.match(mapSource, /const historyIds = Array\.isArray\(props\.Monitoring_Report_IDs\)/);
  assert.match(detailSource, /var OFFICIAL_MANGROVE='data\/area_mangrove\.geojson/);
  assert.match(detailSource, /applyOfficialObjectProperties\(records,officialData\)/);
  assert.match(detailSource, /var monitoredTotal=alive\+dead/);
  assert.match(detailSource, /Realisasi terkini · populasi dipantau/);
});

test("dashboard preserves explicit mangrove donors", () => {
  const dashboardSource = read("js/dashboard-v3.js");

  assert.match(
    dashboardSource,
    /\(feature\.properties \|\| \{\}\)\.Donor \|\| "Aramco Asia Singapore"/
  );
  assert.match(
    dashboardSource,
    /const aramcoMangrove = layerAssets\(aramcoAssets, \["area_mangrove"\]\)/
  );
});
