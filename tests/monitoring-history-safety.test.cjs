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
  assert.match(source, /return chartSVG\(history,definition\)/);
  assert.match(source, /Grafik riwayat per indikator/);
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

  assert.match(source, /function verifiedMonitoringPhotos\(properties\)/);
  assert.match(source, /if \(directPhotos\.length\) return null/);
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
