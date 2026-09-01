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

test("archive job preserves detections from finalized reports", () => {
  const source = fs.readFileSync(
    path.join(ROOT, "scripts", "archive_hotspot_monthly.mjs"),
    "utf8"
  );

  assert.match(source, /A finalized report is permanent evidence/);
  assert.match(source, /\[ARCHIVE FINAL\]/);
  assert.match(source, /report\.status !== "final"/);
});
