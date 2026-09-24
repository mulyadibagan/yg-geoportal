const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");

test("public map exposes five YG social forestry intervention areas in six polygons", () => {
  const collection = JSON.parse(read("data/social-forestry-intervention-yg.geojson"));
  const names = collection.features.map(feature => feature.properties.NAMA_HKM);

  assert.equal(collection.visibility, "public");
  assert.equal(collection.features.length, 6);
  assert.deepEqual(names, [
    "KTH Mandiri Sejahtera",
    "KTH Siarang-Arang Lestari",
    "KTH Makmur Pesisir",
    "MHA Kenegerian Petapahan",
    "Hutan Adat Ghimbo Bonca Lida",
    "Hutan Adat Ghimbo Pomuan"
  ]);
  assert.equal(collection.features[4].properties.PROFILE_KEY,
    collection.features[5].properties.PROFILE_KEY);
  assert.ok(collection.features.slice(4).every(feature =>
    feature.geometry.type === "Polygon" && feature.geometry.coordinates[0].length > 200));
  assert.ok(collection.features.every(feature => feature.geometry));
  assert.ok(collection.features.every(feature => feature.properties.Intervensi_YG));
});

test("interactive map displays PS intervention boundaries by default", () => {
  const map = read("js/map-v4.js");
  const page = read("webgis.html");

  assert.match(map, /label: "Perhutanan Sosial Intervensi YG"/);
  assert.match(map, /file: "data\/social-forestry-intervention-yg\.geojson"/);
  assert.match(map, /type: "social_forestry_intervention"/);
  assert.match(map, /appendReferenceSection\("WILAYAH INTERVENSI YG", interventionLayerIds\)/);
  assert.match(map, /layerId === "social_forestry_intervention_yg" \? ' checked' : ''/);
  assert.match(map, /loadReferenceLayer\("social_forestry_intervention_yg"\)\.then/);
  assert.ok(map.lastIndexOf('loadReferenceLayer("social_forestry_intervention_yg")') <
    map.lastIndexOf("loadDatabase().finally(startPublishedSnapshotWatch)"));
  assert.match(map, /fetch\("data\/desa_intervensi\.geojson"\)/);
  assert.ok(map.lastIndexOf('fetch("data/desa_intervensi.geojson")') <
    map.lastIndexOf("loadDatabase().finally(startPublishedSnapshotWatch)"));
  assert.match(map, /map\.removeLayer\(earlyInterventionVillageLayer\)/);
  assert.match(map, /rows \+= item\("Intervensi YG", props\.Intervensi_YG\)/);
  assert.match(map, /Wilayah program YG · tidak menambah statistik kegiatan/);
  assert.match(page, /map-v4\.js\?v=20260924-ghimbo-clean5/);
});

test("public intervention layer does not expose internal PS documents", () => {
  const collection = JSON.parse(read("data/social-forestry-intervention-yg.geojson"));
  const serialized = JSON.stringify(collection).toLowerCase();

  assert.doesNotMatch(serialized, /drive\.google\.com/);
  assert.doesNotMatch(serialized, /rkps|rpha|rkt/);
  assert.doesNotMatch(serialized, /anggota|nik|alamat/);
});

test("coffee detail hides contextual forest and village overlays and their list", () => {
  const map = read("js/map-v4.js");
  assert.match(map, /const isGhimboCoffeeView = \/\^KOPI-GHIMBO-POMUAN-MA-EARTH-2026-/);
  assert.match(map, /visible: !isGhimboCoffeeView/);
  assert.match(map, /if \(!isGhimboCoffeeView\) fetch\("data\/desa_intervensi\.geojson"\)/);
  assert.match(map, /if \(!isGhimboCoffeeView\) loadReferenceLayer\("social_forestry_intervention_yg"\)/);
  assert.doesNotMatch(map, /L\.control\.layers\(null, overlays/);
  assert.doesNotMatch(map, /Hutan adat dan batas desa<\/strong>/);
});

test("MA Earth coffee planting lies inside public Pomuan and Tanjungbungo polygons", () => {
  const ps = JSON.parse(read("data/social-forestry-intervention-yg.geojson"));
  const villages = JSON.parse(read("data/desa_intervensi.geojson"));
  const coffee = JSON.parse(read("data/area_kopi.geojson")).features.find(feature =>
    feature.properties.Object_ID === "KOPI-GHIMBO-POMUAN-MA-EARTH-2026-001");
  const pomuan = ps.features.find(feature => feature.properties.YG_PS_ID === "YG-PS-GHIMBO-POMUAN");
  const bonca = ps.features.find(feature => feature.properties.YG_PS_ID === "YG-PS-GHIMBO-BONCA-LIDA");
  const village = villages.features.find(feature => feature.properties.WADMKD === "Tanjungbungo");
  const neighboringVillage = villages.features.find(feature =>
    feature.properties.WADMKD === "Koto Perambahan" &&
    feature.properties.WADMKK === "Kampar");
  assert.ok(coffee && pomuan && bonca && village && neighboringVillage);
  const inside = (point, ring) => {
    let result = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[i], [x2, y2] = ring[j], [x, y] = point;
      if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) {
        result = !result;
      }
    }
    return result;
  };
  coffee.geometry.coordinates[0].slice(0, -1).forEach(point => {
    assert.ok(inside(point, pomuan.geometry.coordinates[0]));
    assert.ok(inside(point, village.geometry.coordinates[0]));
    assert.ok(!inside(point, bonca.geometry.coordinates[0]));
  });
});

test("village sync retains both Ghimbo villages in its source manifest", () => {
  const manifest = JSON.parse(read("data/intervention-villages.json"));
  const names = manifest.villages.map(item => item.name);
  assert.ok(names.includes("Tanjungbungo"));
  assert.ok(names.includes("Koto Perambahan"));
  assert.match(read("scripts/sync_intervention_villages.mjs"), /item\.publicProperties/);
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
  assert.match(page, /layer-order-v1\.js\?v=20260920-feg1/);
});
