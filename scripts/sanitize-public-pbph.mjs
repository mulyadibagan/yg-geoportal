import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "_site");

function edit(file, mutate) {
  if (!fs.existsSync(file)) return;
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  mutate(value);
  fs.writeFileSync(file, JSON.stringify(value));
}

const fireDir = path.join(root, "data", "fire-monthly");
if (fs.existsSync(fireDir)) {
  for (const name of fs.readdirSync(fireDir).filter(name => name.endsWith(".json"))) {
    edit(path.join(fireDir, name), data => {
      delete data.companies;
      if (data.summary) delete data.summary.companies;
      for (const point of data.hotspots || []) delete point.permits;
      if (typeof data.methodology === "string") data.methodology = data.methodology.replace(/,?\s*PBPH(?:[^,.]*)?/gi, "");
      if (typeof data.disclaimer === "string") data.disclaimer = data.disclaimer.replace(/,?\s*PBPH(?:[^,.]*)?/gi, "");
      for (const row of data.reports || []) if (row.summary) delete row.summary.companies;
    });
  }
}

const analyticsFiles = [
  path.join(root, "data", "administrative-village-analytics.json"),
  path.join(root, "data", "village-forest-analytics.json"),
  path.join(root, "data", "hotspot-high-confidence.geojson")
];
const shardDir = path.join(root, "data", "administrative-village-analytics");
if (fs.existsSync(shardDir)) {
  for (const name of fs.readdirSync(shardDir).filter(name => name.endsWith(".json"))) analyticsFiles.push(path.join(shardDir, name));
}
function scrub(value) {
  if (Array.isArray(value)) return value.forEach(scrub);
  if (!value || typeof value !== "object") return;
  delete value.concession;
  delete value.pbph052026;
  delete value.permits;
  for (const child of Object.values(value)) scrub(child);
}
for (const file of analyticsFiles) edit(file, scrub);
