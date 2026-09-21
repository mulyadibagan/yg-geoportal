const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

test("monitoring layer distinguishes unique locations from report history", () => {
  const map = read("js/map-v4.js");
  const sync = read("js/monitoring-live-sync-v2.js");
  const html = read("webgis.html");

  assert.match(map, /function addLiveFeatures\(layerId, features, options\)/);
  assert.match(map, /countElement\.textContent = countLabel \|\| formatNumber\(uniqueFeatureIds\.size\)/);
  assert.match(sync, /verifiedMonitoringFeatures\.length \+ " laporan"/);
  assert.match(sync, /latestFeatures\.length \+ " lokasi · "/);
  assert.match(sync, /addLiveFeatures\("monitoring_reports", latestFeatures, \{/);
  assert.match(html, /monitoring-live-sync-v2\.js\?v=20260921-count-clarity1/);
});
