import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { companyBoundaries } from "./rspo-companies.mjs";

const endpoint = "https://services3.arcgis.com/mKcWKyEU5Tl36xeT/arcgis/rest/services/RSPO_Concessions_Master_Data_v1_view/FeatureServer/0/query";
const tmp = path.resolve("tmp");
const rawPath = path.join(tmp, "rspo-riau-raw.geojson");
const outputPath = path.join(tmp, "rspo-riau-groups.geojson");
await fs.mkdir(tmp, { recursive: true });

const features = [];
const companySource = [];
for (let offset = 0; ; offset += 2000) {
  const query = new URLSearchParams({
    where: "Province='Riau'", outFields: "FID,MemberNum,Parent,MemberCat,MemberYear,Subsidiary,ManageUnit,SupplyBase",
    returnGeometry: "true", outSR: "4326", orderByFields: "FID",
    geometryPrecision: "6", resultOffset: String(offset), resultRecordCount: "2000", f: "geojson"
  });
  const response = await fetch(`${endpoint}?${query}`, { headers: { accept: "application/geo+json" } });
  if (!response.ok) throw new Error(`GeoRSPO HTTP ${response.status}`);
  const batch = await response.json();
  if (batch.error) throw new Error(batch.error.message || "GeoRSPO query failed");
  for (const feature of batch.features || []) {
    if (!feature.geometry || !feature.properties?.Parent) continue;
    companySource.push({ ...feature, properties: { ...feature.properties } });
    feature.properties = { Parent: feature.properties.Parent, MemberNum: feature.properties.MemberNum || "", MemberCat: feature.properties.MemberCat || "", parcel_count: 1 };
    features.push(feature);
  }
  if ((batch.features || []).length < 2000) break;
}
await fs.writeFile(rawPath, JSON.stringify({ type: "FeatureCollection", features }));
const companies = companyBoundaries(companySource);
if (!companies.companyCount || companies.features.length !== companySource.length) throw new Error('Incomplete company boundaries');
const companyRawPath = path.join(tmp, 'rspo-riau-companies-raw.geojson');
const companyPath = path.join(tmp, 'rspo-riau-companies.geojson');
await fs.writeFile(companyRawPath, JSON.stringify(companies));
// Dissolve once during publication, not on every staff device. Preserve full
// geometry precision; unlike the overview, company boundaries are not simplified.
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['node_modules/mapshaper/bin/mapshaper', companyRawPath,
    '-clean', '-dissolve', 'COMPANY_ID', '-o', companyPath, 'format=geojson', 'precision=0.000001'], { stdio: 'inherit' });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Company dissolve exited ${code}`)));
});
const metadata = new Map(companies.features.map(f => [f.properties.COMPANY_ID, f.properties]));
const dissolved = JSON.parse(await fs.readFile(companyPath, 'utf8'));
if (!dissolved.features?.length) throw new Error('No dissolved company boundaries');
for (const f of dissolved.features) {
  const props = metadata.get(f.properties.COMPANY_ID);
  if (!props) throw new Error('Company identity missing after dissolve');
  f.properties = { ...props }; delete f.properties.SOURCE_FID;
}
Object.assign(dissolved, { visibility:'internal', generatedAt:companies.generatedAt,
  source:companies.source, companyCount:dissolved.features.length, sourceFeatureCount:companies.features.length,
  processing:'Cleaned and dissolved by company; no geometric simplification' });
await fs.writeFile(companyPath, JSON.stringify(dissolved));
console.log(JSON.stringify({companyFeatures:dissolved.features.length, sourceFeatures:companies.features.length}));

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["node_modules/mapshaper/bin/mapshaper", rawPath,
    "-clean", "-dissolve", "Parent", "calc=sum(parcel_count)", "-simplify", "weighted", "8%", "keep-shapes",
    "-o", outputPath, "format=geojson", "precision=0.00001"], { stdio: "inherit" });
  child.on("exit", code => code === 0 ? resolve() : reject(new Error(`mapshaper exited ${code}`)));
});
const result = JSON.parse(await fs.readFile(outputPath, "utf8"));
result.generatedAt = new Date().toISOString();
result.source = "GeoRSPO concessions filtered to Riau; dissolved and simplified by Parent";
if (!Array.isArray(result.features) || result.features.length !== 23) throw new Error(`Expected 23 groups, received ${result.features?.length}`);
await fs.writeFile(outputPath, JSON.stringify(result));
console.log(JSON.stringify({ sourceFeatures: features.length, groups: result.features.length, bytes: (await fs.stat(outputPath)).size }));
