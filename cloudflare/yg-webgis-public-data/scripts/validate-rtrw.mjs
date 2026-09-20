import fs from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npm run validate:rtrw -- <geojson>");
  process.exit(2);
}
const raw = fs.readFileSync(path, "utf8");
let data;
try { data = JSON.parse(raw); } catch { throw new Error("RTRW file is not valid JSON"); }
if (data?.type !== "FeatureCollection" || !Array.isArray(data.features) || !data.features.length) {
  throw new Error("RTRW must be a non-empty GeoJSON FeatureCollection");
}
const allowed = new Set(["Polygon", "MultiPolygon"]);
let invalid = 0, outOfRange = 0;
function walk(v) {
  if (!Array.isArray(v)) return;
  if (typeof v[0] === "number" && typeof v[1] === "number") {
    if (v[0] < 95 || v[0] > 110 || v[1] < -5 || v[1] > 5) outOfRange++;
    return;
  }
  v.forEach(walk);
}
for (const feature of data.features) {
  if (feature?.type !== "Feature" || !feature.geometry || !allowed.has(feature.geometry.type)) { invalid++; continue; }
  walk(feature.geometry.coordinates);
}
if (invalid) throw new Error(`RTRW contains ${invalid} invalid feature(s)`);
if (outOfRange) throw new Error(`RTRW contains ${outOfRange} coordinate(s) outside broad Riau/WGS84 bounds; check CRS before ingest`);
const metadata = data.metadata || {};
const classes = new Set();
const objectIds = new Set();
let wrongProvince = 0;
let wrongLegalBasis = 0;
for (const feature of data.features) {
  const p = feature.properties || {};
  const label = p.RENCANA || p.POLA_RUANG || p.rtrsys || p.rtrppr ||
    p.KETERANGAN || p.KETERANG || p.NAMOBJ || p.FUNGSI ||
    p.PERUNTUKAN || p.KAWASAN;
  if (label) classes.add(String(label).trim());
  const id = String(p.Source_Object_ID ?? p.objectid ?? "").trim();
  if (id) objectIds.add(id);
  if (String(p.PROVINSI || p.wadmpr || "").trim().toUpperCase() !== "RIAU") {
    wrongProvince++;
  }
  if (!/Perda\s+No\.\s*10\s+Tahun\s+2018/i.test(
    String(p.DASAR_HUKUM || p.nothpd || "")
  )) {
    wrongLegalBasis++;
  }
}
if (!/10\s*Tahun\s*2018/i.test(String(metadata.legalBasis || ""))) {
  throw new Error("metadata.legalBasis must identify Perda Provinsi Riau No. 10 Tahun 2018");
}
if (!/Badan Informasi Geospasial/i.test(String(metadata.sourceOrganisation || ""))) {
  throw new Error("metadata.sourceOrganisation must identify Badan Informasi Geospasial");
}
if (!/^https:\/\/kspservices\.big\.go\.id\//i.test(String(metadata.sourceUrl || ""))) {
  throw new Error("metadata.sourceUrl must identify the official KSP BIG service");
}
if (data.features.length !== 33) {
  throw new Error(`RTRW contains ${data.features.length} features; expected 33`);
}
if (classes.size !== 23) {
  throw new Error(`RTRW contains ${classes.size} classes; expected 23`);
}
if (objectIds.size !== 33) {
  throw new Error(`RTRW contains ${objectIds.size} unique object IDs; expected 33`);
}
if (wrongProvince) throw new Error(`RTRW contains ${wrongProvince} feature(s) outside Riau`);
if (wrongLegalBasis) {
  throw new Error(`RTRW contains ${wrongLegalBasis} feature(s) with an unexpected legal basis`);
}
console.log(JSON.stringify({
  ok: true,
  features: data.features.length,
  classes: classes.size,
  classSample: Array.from(classes).slice(0, 40),
  status: metadata.status || "working_internal",
  legalBasis: metadata.legalBasis,
  sourceOrganisation: metadata.sourceOrganisation,
  sourceUrl: metadata.sourceUrl
}, null, 2));
