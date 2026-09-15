import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(ROOT, "data/intervention-villages.json"), "utf8"));
const administrative = JSON.parse(await readFile(path.join(ROOT, "data/batas_administrasi_desa_riau.geojson"), "utf8"));
const normalize = (value) => String(value || "").trim().toLocaleLowerCase("id-ID");

const features = manifest.villages.map((item) => {
  const source = administrative.features.find((feature) => {
    const properties = feature.properties || {};
    return normalize(properties.WADMKD || properties.Desa || properties.NAMOBJ) === normalize(item.sourceName || item.name) &&
      normalize(properties.WADMKC || properties.Kecamatan) === normalize(item.district) &&
      normalize(properties.WADMKK || properties.Kabupaten) === normalize(item.regency);
  });
  if (!source) throw new Error(`Batas administrasi tidak ditemukan: ${item.name}|${item.district}|${item.regency}`);
  const feature = structuredClone(source);
  Object.assign(feature.properties, {
    WADMKD: item.name,
    NAMOBJ: item.name,
    WADMKC: item.district,
    WADMKK: item.regency,
    Intervention_Source_Name: item.sourceName || item.name,
    Intervention_Aliases: item.aliases || []
  });
  return feature;
});

await writeFile(path.join(ROOT, "data/desa_intervensi.geojson"), `${JSON.stringify({
  type: "FeatureCollection",
  name: "desa_intervensi",
  features
})}\n`, "utf8");

const analyticsPath = path.join(ROOT, "data/village-forest-analytics.json");
const administrativeAnalyticsPath = path.join(ROOT, "data/administrative-village-analytics.json");
const analytics = JSON.parse(await readFile(analyticsPath, "utf8"));
const administrativeAnalytics = JSON.parse(await readFile(administrativeAnalyticsPath, "utf8"));
for (const item of manifest.villages) {
  const targetKey = [item.name, item.district, item.regency].map(normalize).join("|");
  if (analytics.villages[targetKey]) continue;
  const sourceKey = [item.sourceName || item.name, item.district, item.regency].map(normalize).join("|");
  const sourceRecord = administrativeAnalytics.villages[sourceKey];
  if (!sourceRecord) throw new Error(`Analitik administrasi tidak ditemukan: ${sourceKey}`);
  analytics.villages[targetKey] = { ...structuredClone(sourceRecord), name: item.name };
}
await writeFile(analyticsPath, `${JSON.stringify(analytics, null, 2)}\n`, "utf8");
console.log(`Synced ${features.length} intervention-village boundaries.`);
