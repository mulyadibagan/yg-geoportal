const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("monitoring detail keeps permanent object identity and renders time-series charts", () => {
  const source = read("js/monitoring-detail.js");

  assert.match(source, /targetProperties\.Object_ID\|\|targetProperties\.OBJECT_ID/);
  assert.match(source, /var objectId=permanentObjectId\|\|spatialObjectId/);
  assert.match(source, /class="dumbbell-chart"/);
  assert.doesNotMatch(source, /Grafik riwayat per indikator/);
  assert.doesNotMatch(source, /function chartSVG\(/);
  assert.match(source, /Foto monitoring sebelumnya/);
  assert.match(source, /class="photo-archive"/);
});

test("legacy monitoring ids resolve to the current official polygon ids everywhere", () => {
  const sources = [
    "js/monitoring-live-sync-v2.js",
    "js/map-v4.js",
    "js/monitoring-detail.js",
    "js/monitoring-compilation.js",
    "js/monitoring.js"
  ].map(read);
  const aliases = [
    ["MANGROVE-BURUK-BAKUL-PHASE-III-2025-001", "MANGROVE-BURUK-BAKUL-2025-001"],
    ["MANGROVE-BURUK-BAKUL-PHASE-III-2025-002", "MANGROVE-BURUK-BAKUL-2025-002"],
    ["MANGROVE-BURUK-BAKUL-PHASE-III-2025-003", "MANGROVE-BURUK-BAKUL-2025-003"],
    ["MANGROVE-SEPAHAT-PHASE-III-2025-001", "MANGROVE-SEPAHAT-2025-001"],
    ["MANGROVE-TANJUNG-KURAS-PHASE-III-2026-001", "MANGROVE-TANJUNG-KURAS-2026-001"]
  ];

  sources.forEach(source => {
    const normalizedSource = source.toLowerCase();
    aliases.forEach(([legacyId, currentId]) => {
      assert.ok(normalizedSource.includes(legacyId.toLowerCase()), `${legacyId} missing`);
      assert.ok(normalizedSource.includes(currentId.toLowerCase()), `${currentId} missing`);
    });
  });

  const detail = sources[2];
  assert.match(detail, /objectKey=OBJECT_ALIASES\[objectKey\]\|\|objectKey/);
});

test("published report photos take priority over historical photo fallback", () => {
  const source = read("js/data-updates.js");
  const detail = read("js/monitoring-detail.js");

  assert.match(source, /function verifiedMonitoringPhotos\(properties\)/);
  assert.match(source, /if \(directPhotos\.length\) return null/);
  assert.match(detail, /var HISTORICAL_PHOTOS_BY_REPORT=/);
  assert.match(detail, /'YG-20260717-210140-375':\[/);
  assert.match(detail, /'YG-20260717-211305-543':\[/);
  assert.match(detail, /if\(!photos\.length&&HISTORICAL_PHOTOS_BY_REPORT\[reportId\]\)/);
  assert.match(detail, /photos=HISTORICAL_PHOTOS_BY_REPORT\[reportId\]\.slice\(\)/);
});

test("live sync keeps the latest report when the official polygon loads later", () => {
  const source = read("js/monitoring-live-sync-v2.js");

  assert.match(source, /props\.Geometry_Source = "monitoring_report_fallback"/);
  assert.match(source, /props\.Target_Object_ID_Current = targetId/);
  assert.doesNotMatch(source, /if \(!target \|\| !target\.geometry\) return null/);
});

test("map reconciliation also groups non-mangrove monitoring by permanent target", () => {
  const source = read("js/map-v4.js");

  assert.match(source, /if \(!resolvedTargetId \|\| \/:auto:\/i\.test\(resolvedTargetId\)\) return \[\]/);
  assert.match(source, /return \[resolvedTargetId\]/);
  assert.doesNotMatch(source, /if \(!canonicalMangroveObjectId\(resolvedTargetId\)\) return \[\]/);
});

test("report form warns before a same-object same-day monitoring submission", () => {
  const source = read("js/report-v6.js");

  assert.match(source, /function findMonitoringDuplicates\(data,activityDate\)/);
  assert.match(source, /reportTarget === targetId && monitoringDateKey\(p\.activityDate\) === dateKey/);
  assert.match(source, /await confirmSameDayMonitoring\(\)/);
  assert.match(source, /monitoringDuplicateCandidates:selectedType === 'Monitoring'/);
});

test("Apps Script makes retries idempotent and flags same-day monitoring duplicates", () => {
  const source = read("apps-script/webgis-backend/Kode.js");
  const admin = read("apps-script/webgis-backend/Admin.html");

  assert.match(source, /claimReportSubmission_\(clientSubmissionId\)/);
  assert.match(source, /LockService\.getScriptLock\(\)/);
  assert.match(source, /findSameDayMonitoringDuplicates_\(sheet, data\)/);
  assert.match(source, /Potensi_Duplikat_Monitoring/);
  assert.match(source, /Monitoring wajib terhubung ke satu objek WebGIS yang dipilih/);
  assert.match(admin, /Potensi laporan monitoring ganda/);
});

test("monitoring reporter chips filter historical reporters and remain keyboard accessible", () => {
  const source = read("js/monitoring-compilation.js");
  const html = read("monitoring-compilation.html");

  assert.match(source, /key:key,name:record\.reporter/);
  assert.match(source, /<button type="button" class="reporter-pill" data-reporter-key=/);
  assert.match(source, /group\.history\|\|\[\]\)\.forEach\(function\(record\)/);
  assert.match(source, /reporters\.addEventListener\('click'/);
  assert.match(source, /cluster\.value='reporter'/);
  assert.match(html, /\.reporter-pill:focus-visible/);
});

test("monitoring pages prefer the fast public snapshot and keep the source API as fallback", () => {
  const detail = read("js/monitoring-detail.js");
  const compilation = read("js/monitoring-compilation.js");

  [detail, compilation].forEach(source => {
    assert.match(source, /snapshots\/current\/dashboard\.json/);
    assert.match(source, /capacitySources&&.*capacitySources\.reports/);
  });
  assert.match(detail, /restoreDataCache\(\)/);
  assert.match(detail, /localStorage\.setItem\(DATA_CACHE_KEY/);
  assert.match(detail, /fetch\(SNAPSHOT_URL,\{cache:'default'\}\)/);
  assert.match(compilation, /loadPublishedJsonp\(type,storageKey\)/);
});
