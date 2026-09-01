const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

test("village and social-forestry profiles show final monthly reports only", () => {
  const village = read("village-profile.html");
  const social = read("social-forestry-profile.html");

  for (const source of [village, social]) {
    assert.match(source, /<h2>Laporan bulanan final<\/h2>/);
    assert.match(source, /id="hotspot-month-select"/);
    assert.match(source, /id="hotspot-annual-list"/);
    assert.match(source, /Rekap per tahun/);
    assert.match(source, /js\/final-monthly-hotspots\.js/);
    assert.doesNotMatch(source, /7 hari terakhir|30 hari terakhir|Jumlah hotspot per tahun/);
  }
});

test("monthly hotspot loader fetches only the selected final report", () => {
  const source = read("js", "final-monthly-hotspots.js");

  assert.match(source, /data\/fire-monthly\/index\.json/);
  assert.match(source, /report\.status==="final"/);
  assert.match(source, /json\(meta\.data/);
  assert.match(source, /profile-annual\.json/);
  assert.doesNotMatch(source, /hotspot-high-confidence\.geojson|village-forest-analytics/);
});

test("annual profile summary starts in July 2026 and uses final monthly reports", () => {
  const annual = JSON.parse(read("data", "fire-monthly", "profile-annual.json"));
  const workflow = read(".github", "workflows", "generate-july-fire-report.yml");
  const cenaku = annual.socialForestry.find((profile) => profile.name === "KTH CENAKU JAYA");

  assert.equal(annual.earliestMonth, "2026-07");
  assert.deepEqual(annual.years[0].months, ["2026-07", "2026-08"]);
  assert.equal(cenaku.yearly["2026"].hotspots, 1);
  assert.match(workflow, /build_fire_profile_annual\.mjs/);
  assert.match(workflow, /profile-annual\.json/);
});

test("monthly hotspot spatial filter handles polygon holes", () => {
  const sandbox = { window: {}, document: { getElementById() { return null; } }, fetch() {} };
  vm.runInNewContext(read("js", "final-monthly-hotspots.js"), sandbox);
  const inside = sandbox.window.YGFinalMonthlyHotspots.pointInGeometry;
  const geometry = {
    type: "Polygon",
    coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]
    ]
  };

  assert.equal(inside([2, 2], geometry), true);
  assert.equal(inside([5, 5], geometry), false);
  assert.equal(inside([12, 2], geometry), false);
});

test("social-forestry multipart permits are merged before monthly filtering", () => {
  const sandbox = { window: {}, document: { getElementById() { return null; } }, fetch() {} };
  vm.runInNewContext(read("js", "final-monthly-hotspots.js"), sandbox);
  const merge = sandbox.window.YGFinalMonthlyHotspots.mergePolygonGeometries;
  const geometry = merge([
    { geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } },
    { geometry: { type: "MultiPolygon", coordinates: [[[[2, 2], [3, 2], [3, 3], [2, 2]]]] } }
  ]);

  assert.equal(geometry.type, "MultiPolygon");
  assert.equal(geometry.coordinates.length, 2);
  assert.match(read("js", "social-forestry-profile.js"), /spatialParts\.length>1/);
});

test("Sepahat profile map can render its FDRS and canal-block objects", () => {
  const snapshot = JSON.parse(read("data", "master-database-snapshot.json"));
  const features = snapshot.features.filter((feature) => {
    const props = feature.properties || {};
    return String(props.Desa || "").toLowerCase() === "sepahat";
  });
  const fdrs = features.filter((feature) => feature.properties.Layer_ID === "fdrs");
  const canals = features.filter((feature) => feature.properties.Layer_ID === "sekat_kanal");
  const profileSource = read("js", "village-profile.js");

  assert.equal(fdrs.length, 1);
  assert.equal(canals.length, 2);
  assert.match(profileSource, /programmeLayer\("fdrs","FDRS \/ TMA"/);
  assert.match(profileSource, /programmeLayer\("sekat_kanal","Sekat kanal"/);
  assert.match(profileSource, /Hotspot laporan final/);
});
