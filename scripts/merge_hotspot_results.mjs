import { readFile, writeFile } from "node:fs/promises";

const [sourcePath, targetPath] = process.argv.slice(2);
if (!sourcePath || !targetPath) {
  throw new Error("Usage: node merge_hotspot_results.mjs <hotspot-source.json> <target.json>");
}

const source = JSON.parse(await readFile(sourcePath, "utf-8"));
const target = JSON.parse(await readFile(targetPath, "utf-8"));
const fields = [
  "hotspot7d",
  "hotspot30d",
  "hotspot90d",
  "hotspotYearly5y"
];

let updated = 0;
for (const collection of ["villages", "socialForestry"]) {
  for (const [key, sourceRecord] of Object.entries(source?.[collection] || {})) {
    const targetRecord = target?.[collection]?.[key];
    if (!targetRecord) {
      continue;
    }
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(sourceRecord, field)) {
        targetRecord[field] = sourceRecord[field];
      }
    }
    updated += 1;
  }
}

target.viirs = source.viirs;
await writeFile(targetPath, `${JSON.stringify(target, null, 2)}\n`, "utf-8");
console.log(`Merged hotspot metrics into ${updated} existing analytics records.`);
