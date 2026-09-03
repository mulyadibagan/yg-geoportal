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
