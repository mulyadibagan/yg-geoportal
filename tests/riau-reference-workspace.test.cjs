const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");

test("Riau reference workspace is staff-only and additive", () => {
  const home = read("index.html");
  const page = read("webgis.html");
  const workspace = read("js/riau-reference-workspace.js");

  assert.match(home, /Peta Referensi Riau/);
  assert.match(home, /webgis\.html\?workspace=riau-reference/);
  assert.match(home, /data-staff-only-module hidden/);
  assert.match(page, /riau-reference-workspace\.js\?v=20260920-internal1/);
  assert.match(workspace, /if \(!session\(\)/);
  assert.match(workspace, /Layer program YG tidak diubah/);
  assert.match(workspace, /waitUntilSettled/);
  assert.match(workspace, /for \(const layerId of preset\.layers\)/);
  assert.doesNotMatch(workspace, /\.click\(\)/);
});

test("Riau reference presets only name existing verified map layers", () => {
  const map = read("js/map-v4.js");
  const workspace = read("js/riau-reference-workspace.js");
  for (const id of [
    "batas_administrasi_desa_riau",
    "rtrw_riau_2018_2038",
    "kawasan_hutan_sk_903",
    "gambut_bbsdlp_2019",
    "pbph_riau_052026",
    "perusahaan_sawit_riau",
    "perhutanan_sosial_riau",
    "kph_2019_riau",
    "social_forestry_intervention_yg"
  ]) {
    assert.match(map, new RegExp(id));
    assert.match(workspace, new RegExp(id));
  }
});

test("unverified sectoral themes stay catalogue-only", () => {
  const workspace = read("js/riau-reference-workspace.js");
  assert.match(workspace, /Pesisir, kelautan & perikanan/);
  assert.match(workspace, /VERIFIKASI SUMBER\/GEOMETRI/);
  assert.doesNotMatch(workspace, /geoportal\.riau\.go\.id/);
});

test("reference layer sections survive the final ordering pass", () => {
  const map = read("js/map-v4.js");
  const order = read("js/layer-order-v1.js");
  assert.match(map, /data-reference-section/);
  assert.match(order, /TATA RUANG · INTERNAL STAF/);
  assert.match(order, /KEHUTANAN & KELOLA LAHAN/);
  assert.match(order, /GAMBUT & LINGKUNGAN/);
  assert.match(order, /PERKEBUNAN · INTERNAL STAF/);
});
