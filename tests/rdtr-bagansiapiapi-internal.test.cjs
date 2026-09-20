const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

test("RDTR Bagansiapiapi analysis is staff-only and absent from public navigation", () => {
  const page = read("staff-rdtr-bagansiapiapi.html");
  const gate = read("js", "staff-rdtr-gate.js");
  const access = read("js", "staff-data-access.js");
  const publicHome = read("index.html");
  const publicNavigation = read("js", "navigation-v2.js");

  assert.match(page, /noindex,nofollow,noarchive/);
  assert.match(page, /style="visibility:hidden"/);
  assert.match(page, /staff-rdtr-gate\.js/);
  assert.match(page, /KHUSUS STAF · TIDAK UNTUK PUBLIKASI/);
  assert.match(gate, /YG_STAFF_DATA\.fetch\("data\/rdtr-bagansiapiapi-analysis\.json"/);
  assert.match(gate, /metadata\?\.access !== "staff_only"/);
  assert.match(access, /'data\/rdtr-bagansiapiapi-analysis\.json': '\/api\/staff\/rdtr-bagansiapiapi-analysis'/);
  assert.doesNotMatch(publicHome, /staff-rdtr-bagansiapiapi\.html/);
  assert.doesNotMatch(publicNavigation, /staff-rdtr-bagansiapiapi\.html/);
});

test("admin dashboard reveals the RDTR entry only after a staff session", () => {
  const html = read("admin-dashboard.html");
  const script = read("js", "admin-dashboard.js");
  assert.match(html, /href="staff-rdtr-bagansiapiapi\.html" data-staff-rdtr-card hidden/);
  assert.match(script, /querySelectorAll\('\[data-staff-rdtr-card\]'\)/);
  assert.match(script, /element\.hidden = !\(ADMIN_SESSION && ADMIN_SESSION\.token\)/);
});

test("internal workspace renders the regulation-based YG plan without claiming official zoning", () => {
  const page = read("staff-rdtr-bagansiapiapi.html");
  const script = read("js", "rdtr-bagansiapiapi.js");

  for (const id of [
    "rdtr-planning-workflow", "rdtr-cross-cutting-gates", "rdtr-yg-objective",
    "rdtr-yg-alternatives", "rdtr-structure-summary", "rdtr-structure-plan", "rdtr-export-structure-geojson",
    "rdtr-export-road-evidence", "rdtr-export-service-evidence", "rdtr-export-service-access", "rdtr-export-readiness", "rdtr-export-programmes", "rdtr-export-consultation", "rdtr-export-consultation-pack", "rdtr-export-consultation-notes", "rdtr-consultation-matrix", "rdtr-consultation-readiness", "rdtr-export-completeness", "rdtr-export-completeness-json", "rdtr-completeness-audit", "rdtr-export-gap-workplan", "rdtr-export-gap-workplan-json", "rdtr-gap-workplan", "rdtr-export-v1-dossier", "rdtr-export-evidence-requests", "rdtr-v1-dossier", "rdtr-export-evidence-reconciliation", "rdtr-evidence-reconciliation", "rdtr-export-evidence-briefing", "rdtr-export-evidence-briefing-csv", "rdtr-evidence-briefing", "rdtr-export-change-control", "rdtr-export-change-control-csv", "rdtr-change-control", "rdtr-network-evidence", "rdtr-service-evidence", "rdtr-service-access", "rdtr-development-readiness", "rdtr-network-gaps", "rdtr-pattern-plan",
    "rdtr-zoning-rules", "rdtr-programs", "rdtr-subzone-codebook", "rdtr-itbx-matrix",
    "rdtr-export-itbx-csv", "rdtr-plan-traceability",
    "rdtr-analysis-programme", "rdtr-analysis-search", "rdtr-analysis-priority",
    "rdtr-analysis-status", "rdtr-export-analysis-csv", "rdtr-analysis-matrix", "rdtr-geometry-registry",
    "rdtr-p0-evidence-summary", "rdtr-p0-evidence-truth", "rdtr-p0-evidence-register", "rdtr-export-evidence-csv",
    "policy-map", "rdtr-yg-zone-header", "rdtr-yg-zone-summary", "rdtr-export-yg-zones",
    "rdtr-policy-map-header", "rdtr-policy-layer-summary", "rdtr-policy-map-rule",
    "rdtr-policy-map-stages", "rdtr-export-policy-map", "rdtr-policy-inspector",
    "rdtr-export-draft-csv", "rdtr-export-draft-geojson", "rdtr-draft-findings"
  ]) assert.match(page, new RegExp(`id="${id}"`));

  assert.match(page, /RANCANGAN ANALITIS · BUKAN DOKUMEN PENETAPAN/);
  assert.match(page, /21 analisis penyusunan RDTR/);
  assert.match(script, /Unit penyaringan YG · bukan SWP\/zona/);
  assert.match(script, /unit-penyaringan-analitis-yg-bukan-zonasi\.geojson/);
  assert.match(script, /Geometri zonasi YG adalah rancangan teknis internal tanpa akibat hukum/);
  assert.match(script, /matriks-21-analisis-rdtr-bagansiapiapi-internal\.csv/);
  assert.match(script, /register-bukti-p0-rdtr-bagansiapiapi-internal\.csv/);
  assert.match(script, /renderP0EvidenceBoard/);
  assert.match(script, /renderPolicyMapFramework/);
  assert.match(script, /renderYgDraftRdtr/);
  assert.match(script, /inspectPolicyLocation/);
  assert.match(script, /booleanPointInPolygon/);
  assert.match(script, /peta-sintesis-kebijakan-rdtr-bagansiapiapi-v0\.geojson/);
  assert.match(script, /Arahan YG · tahan intensifikasi gambut/);
  assert.match(script, /Arahan YG · perlindungan\/pemulihan pesisir/);
  assert.match(script, /Rancangan zonasi RDTR YG v0\.2/);
  assert.match(script, /rancangan-zonasi-rdtr-yg-bagansiapiapi-v0\.2\.geojson/);
  assert.match(script, /matriks-itbx-rdtr-yg-bagansiapiapi-v0\.1-internal\.csv/);
  assert.match(script, /rancangan-struktur-ruang-rdtr-yg-bagansiapiapi-v0\.1-internal\.geojson/);
  assert.match(script, /Sumbu hubungan struktur YG · bukan trase/);
  assert.match(script, /Simpul referensi struktur YG · bukan lokasi fasilitas/);
  assert.match(script, /bukti-jaringan-jalan-osm-rdtr-yg-bagansiapiapi-v0\.1-internal\.geojson/);
  assert.match(script, /Bukti jalan OSM · perlu verifikasi/);
  assert.match(script, /Bukti jaringan jalan OSM · verifikasi/);
  assert.match(script, /bukti-fasilitas-hidrologi-osm-rdtr-yg-bagansiapiapi-v0\.1-internal\.geojson/);
  assert.match(script, /Bukti fasilitas OSM · perlu verifikasi/);
  assert.match(script, /Bukti hidrologi OSM · perlu verifikasi/);
  assert.match(page, /Kamus subzona dan matriks kegiatan ITBX/);
  assert.match(script, /draftPolicyDecision/);
  assert.match(script, /validateDraftCollection/);
  assert.match(script, /20\.000 polygon/);
  assert.match(script, /PM-YG-COAST/);
  assert.match(script, /uji-revisi-geometri-rdtr-yg-internal\.csv/);
  assert.match(script, /uji-revisi-geometri-rdtr-yg-internal\.geojson/);
  assert.match(script, /browser_local_only/);
  assert.match(script, /Pertanyaan konsultasi/);
});

test("the official consultation scope resolves to exactly 11 Bangko villages", () => {
  const data = JSON.parse(read("data", "batas_administrasi_desa_riau.geojson"));
  const normalize = value => String(value || "").toLowerCase()
    .replace(/^(kelurahan|kepenghuluan|desa)\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
  const target = new Set([
    "bagan barat", "bagan hulu", "bagan kota", "bagan punak", "bagan timur",
    "bagan jawa", "bagan jawa pesisir", "bagan punak meranti", "bagan punak pesisir",
    "labuhan tangga besar", "labuhan tangga hilir"
  ]);
  const features = data.features.filter(feature => {
    const props = feature.properties || {};
    return normalize(props.WADMKK) === "rokan hilir" && normalize(props.WADMKC) === "bangko" &&
      target.has(normalize(props.WADMKD || props.NAMOBJ));
  });
  assert.equal(features.length, 11);
  assert.equal(new Set(features.map(feature => normalize(feature.properties.WADMKD || feature.properties.NAMOBJ))).size, 11);
});
