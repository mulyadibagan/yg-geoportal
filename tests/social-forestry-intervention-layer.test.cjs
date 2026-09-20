const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");

test("public map exposes exactly four verified YG social forestry interventions", () => {
  const collection = JSON.parse(read("data/social-forestry-intervention-yg.geojson"));
  const names = collection.features.map(feature => feature.properties.NAMA_HKM);

  assert.equal(collection.visibility, "public");
  assert.equal(collection.features.length, 4);
  assert.deepEqual(names, [
    "KTH Mandiri Sejahtera",
    "KTH Siarang-Arang Lestari",
    "KTH Makmur Pesisir",
    "MHA Kenegerian Petapahan"
  ]);
  assert.ok(collection.features.every(feature => feature.geometry));
  assert.ok(collection.features.every(feature => feature.properties.Intervensi_YG));
});

test("interactive map keeps PS intervention boundaries separate and off by default", () => {
  const map = read("js/map-v4.js");
  const page = read("webgis.html");

  assert.match(map, /label: "Perhutanan Sosial Intervensi YG"/);
  assert.match(map, /file: "data\/social-forestry-intervention-yg\.geojson"/);
  assert.match(map, /type: "social_forestry_intervention"/);
  assert.match(map, /appendReferenceSection\("WILAYAH INTERVENSI YG", interventionLayerIds\)/);
  assert.doesNotMatch(map, /data-reference-layer-id[^\n]+checked/);
  assert.match(map, /rows \+= item\("Intervensi YG", props\.Intervensi_YG\)/);
  assert.match(map, /Wilayah program YG · tidak menambah statistik kegiatan/);
  assert.match(page, /map-v4\.js\?v=20260920-rtrw-ksp-big1/);
});

test("public intervention layer does not expose internal PS documents", () => {
  const collection = JSON.parse(read("data/social-forestry-intervention-yg.geojson"));
  const serialized = JSON.stringify(collection).toLowerCase();

  assert.doesNotMatch(serialized, /drive\.google\.com/);
  assert.doesNotMatch(serialized, /rkps|rpha|rkt/);
  assert.doesNotMatch(serialized, /anggota|nik|alamat/);
});


test("layer ordering keeps intervention village boundaries in the YG intervention group", () => {
  const order = read("js/layer-order-v1.js");
  const page = read("webgis.html");

  const interventionStart = order.indexOf(
    'makeTitle("WILAYAH INTERVENSI YG", "yg-intervention-title")'
  );
  const villagePlacement = order.indexOf(
    "if (villageBoundary) list.appendChild(villageBoundary);"
  );
  const administrationStart = order.indexOf(
    'makeTitle("BATAS ADMINISTRASI", "yg-boundary-title")'
  );

  assert.ok(interventionStart >= 0);
  assert.ok(villagePlacement > interventionStart);
  assert.ok(administrationStart > villagePlacement);
  assert.match(order, /yg-intervention-boundary-row/);
  assert.doesNotMatch(order, /yg-bottom-boundary-row/);
  assert.match(page, /layer-order-v1\.js\?v=20260920-intervention-group2/);
});
