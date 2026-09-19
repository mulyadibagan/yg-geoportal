const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

function ringContains(point, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const a = ring[index];
    const b = ring[previous];
    if (
      (a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]
    ) inside = !inside;
  }
  return inside;
}

test("Teluk Piyai Pesisir is published as the fifteenth intervention village", () => {
  const villages = JSON.parse(read("data/desa_intervensi.geojson"));
  const feature = villages.features.find(item => item.properties.NAMOBJ === "Teluk Piyai Pesisir");

  assert.equal(villages.features.length, 15);
  assert.ok(feature);
  assert.equal(feature.properties.Intervention_Source_Name, "Telukpiyai Pesisir");
  assert.equal(feature.properties.WADMKC, "Kubu");
  assert.equal(feature.properties.WADMKK, "Rokan Hilir");
  assert.equal(feature.geometry.type, "Polygon");

  const mangrove = JSON.parse(read("data/area_mangrove.geojson"));
  const planting = mangrove.features.find(item =>
    item.properties.Object_ID === "MANGROVE-TELUK-PIYAI-PESISIR-MA-EARTH-2026-001"
  );
  assert.ok(planting);
  const ring = planting.geometry.coordinates[0];
  const centroid = ring.slice(0, -1).reduce(
    (sum, coordinate) => [sum[0] + coordinate[0], sum[1] + coordinate[1]],
    [0, 0]
  ).map(value => value / (ring.length - 1));
  assert.ok(ringContains(centroid, feature.geometry.coordinates[0]));

  const html = read("index.html");
  const dashboard = read("js/dashboard-v3.js");
  assert.match(html, /15 Desa Cakupan/);
  assert.match(html, /id="village-total-count">15</);
  assert.match(dashboard, /20260919-15desa-teluk-piyai/);
});
