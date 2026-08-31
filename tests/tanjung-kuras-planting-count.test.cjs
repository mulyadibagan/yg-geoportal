const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

test("Tanjung Kuras polygon keeps the verified 200-seedling count", () => {
  const databaseSource = fs.readFileSync(
    path.join(ROOT, "apps-script", "webgis-backend", "DatabaseEngine.js"),
    "utf8"
  );
  const backendSource = fs.readFileSync(
    path.join(ROOT, "apps-script", "webgis-backend", "Kode.js"),
    "utf8"
  );

  assert.match(
    databaseSource,
    /reportId\) === 'YG-20260829-144847-315'[\s\S]*?Jumlah_Tanam = 200;[\s\S]*?Jumlah_Bib = 200;/
  );
  assert.match(
    backendSource,
    /sourcePlantingReportId: 'YG-20260725-135142-186'/
  );
});

test("community-object popup displays the planting count", () => {
  const mapSource = fs.readFileSync(path.join(ROOT, "js", "map-v4.js"), "utf8");

  assert.match(
    mapSource,
    /else if \(isCommunity\)[\s\S]*?"Jumlah bibit",\s*valueOf\(\["Jumlah_Bib", "Jumlah_Bibit", "Jumlah_Tanam"\]\)/
  );
});
