const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

test("August 2026 final report includes the backfilled 1 August detection", () => {
  const report = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "fire-monthly", "2026-08.json"), "utf8")
  );

  assert.equal(report.status, "final");
  assert.deepEqual(report.period, {
    start: "2026-08-01",
    end: "2026-08-31"
  });
  assert.equal(report.summary.hotspots, 312);
  assert.ok(report.hotspots.some((hotspot) => (
    hotspot.date === "2026-08-01" &&
    hotspot.time === "0605" &&
    hotspot.longitude === 102.43073 &&
    hotspot.latitude === -0.03602
  )));
});

test("monthly-report menu lists August as the latest report", () => {
  const index = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "fire-monthly", "index.json"), "utf8")
  );

  assert.equal(index.latest, "2026-08");
  assert.equal(index.reports[0].month, "2026-08");
  assert.equal(index.reports[0].summary.hotspots, 312);
  assert.ok(index.reports.some((report) => report.month === "2026-07"));
});

test("July and August final reports include RSPO intersection results", () => {
  const july = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "fire-monthly", "2026-07.json"), "utf8")
  );
  const august = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "fire-monthly", "2026-08.json"), "utf8")
  );

  assert.equal(july.schemaVersion, 2);
  assert.equal(july.summary.rspoAreas, 0);
  assert.equal(july.summary.rspoHotspots, 0);
  assert.ok(july.hotspots.every((hotspot) => Array.isArray(hotspot.rspoAreas)));

  assert.equal(august.schemaVersion, 2);
  assert.equal(august.summary.rspoAreas, 1);
  assert.equal(august.summary.rspoHotspots, 11);
  assert.equal(august.rspoAreas[0].name, "PT Gandaerah Hendana");
  assert.equal(august.rspoAreas[0].hotspots, 11);
  assert.ok(august.hotspots.every((hotspot) => Array.isArray(hotspot.rspoAreas)));
});

test("public monthly report renders RSPO metrics, table, and map layer", () => {
  const html = fs.readFileSync(path.join(ROOT, "fire-monthly-report.html"), "utf8");
  const controller = fs.readFileSync(path.join(ROOT, "js", "fire-monthly-report.js"), "utf8");

  assert.match(html, /id="fm-rspo-areas"/);
  assert.match(html, /id="fm-rspo-rows"/);
  assert.match(controller, /PERUSAHAAN_SAWIT_RIAU_REFERENSI\.geojson/);
  assert.match(controller, /'Area anggota RSPO':rspoLayer/);
});

test("archive job preserves detections from finalized reports", () => {
  const source = fs.readFileSync(
    path.join(ROOT, "scripts", "archive_hotspot_monthly.mjs"),
    "utf8"
  );

  assert.match(source, /A finalized report is permanent evidence/);
  assert.match(source, /\[ARCHIVE FINAL\]/);
  assert.match(source, /report\.status !== "final"/);
});
