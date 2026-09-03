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
    /reportId\) === 'YG-20260829-144847-315'[\s\S]*?Jumlah_Tanam = 200;[\s\S]*?Jumlah_Bib = 200;[\s\S]*?Kategori = 'Penanaman Mangrove';[\s\S]*?Source_Layer = 'area_mangrove';[\s\S]*?Luas_Indikatif_Ha[\s\S]*?properties\.Luas_Ha = indicativeAreaHa;/
  );
  assert.match(
    databaseSource,
    /function publishedCommunityCategory_\(layerId, reportType\)[\s\S]*?layerId\) === 'area_mangrove'[\s\S]*?return 'Penanaman Mangrove';/
  );
  assert.match(
    databaseSource,
    /function masterObjectToFeature_\(object\)[\s\S]*?correctedAreaHa[\s\S]*?Luas_Ha: numberOrBlank_\(object\.areaHa\) === ''[\s\S]*?correctedAreaHa/
  );
  assert.match(
    databaseSource,
    /function masterObjectToFeature_\(object\)[\s\S]*?Kategori: clean_\(object\.layerId\) === 'area_mangrove'[\s\S]*?publishedCommunityCategory_\(object\.layerId, object\.category\)/
  );
  assert.match(
    backendSource,
    /sourcePlantingReportId: 'YG-20260725-135142-186'/
  );
  assert.match(backendSource, /areaHa: 0\.088/);
});

test("community-object popup displays the planting count", () => {
  const mapSource = fs.readFileSync(path.join(ROOT, "js", "map-v4.js"), "utf8");

  assert.match(
    mapSource,
    /else if \(isCommunity\)[\s\S]*?"Jumlah bibit",\s*valueOf\(\["Jumlah_Bib", "Jumlah_Bibit", "Jumlah_Tanam"\]\)/
  );
});

test("monitoring form accepts the verified indicative area for Tanjung Kuras", () => {
  const reportSource = fs.readFileSync(path.join(ROOT, "js", "report-v6.js"), "utf8");
  const reportHtml = fs.readFileSync(path.join(ROOT, "report.html"), "utf8");

  assert.match(
    reportSource,
    /function selectedPlantingAreaHa\(\)[\s\S]*?'Luas_Indikatif_Ha','luas_indikatif_ha'/
  );
  assert.match(
    reportSource,
    /function selectedPlantingAreaHa\(\)[\s\S]*?String\(properties\[keys\[i\]\]\)\.trim\(\) !== ''/
  );
  assert.match(reportHtml, /report-v6\.js\?v=20260903-monitoring-duplicate-guard1/);
});
