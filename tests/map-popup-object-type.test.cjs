const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

test("community popup shows the published object type instead of the form workflow", () => {
  const mapSource = fs.readFileSync(path.join(ROOT, "js", "map-v4.js"), "utf8");
  const i18nSource = fs.readFileSync(path.join(ROOT, "js", "i18n.js"), "utf8");

  assert.match(mapSource, /function communityObjectType\(\)/);
  assert.match(
    mapSource,
    /"Jenis_Titik",\s*"Layer_Label",\s*"targetLayerLabel",\s*"Kategori",\s*"reportType"/
  );
  assert.match(mapSource, /"Jenis objek",\s*communityObjectType\(\)/);
  assert.match(i18nSource, /"Jenis objek": "Object type"/);
  assert.match(i18nSource, /"FDRS \/ Tinggi Muka Air": "FDRS \/ Water Table"/);
});
