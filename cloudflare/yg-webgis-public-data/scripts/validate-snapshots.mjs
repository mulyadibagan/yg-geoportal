import { readFile } from "node:fs/promises";

const minimumFeatures = Number(process.env.MIN_PUBLIC_FEATURES || 100);
const targets = {
  dashboard: "../../../data/dashboard-summary-snapshot.json",
  objects: "../../../data/master-database-snapshot.json"
};

const summary = {};
for (const [name, path] of Object.entries(targets)) {
  const bytes = await readFile(new URL(path, import.meta.url));
  const data = JSON.parse(bytes.toString("utf8"));
  if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error(`${name} is not a FeatureCollection`);
  }
  if (data.features.length < minimumFeatures) {
    throw new Error(`${name} feature count ${data.features.length} is below ${minimumFeatures}`);
  }
  if (Number(data.featureCount) !== data.features.length) {
    throw new Error(`${name} featureCount does not match features.length`);
  }
  if (!data.generatedAt || !data.snapshotGeneratedAt) {
    throw new Error(`${name} generation timestamps are missing`);
  }
  summary[name] = { bytes: bytes.length, features: data.features.length };
}

if (summary.dashboard.features !== summary.objects.features) {
  throw new Error("Dashboard and object snapshots have different feature counts");
}

console.log(JSON.stringify({ ok: true, minimumFeatures, snapshots: summary }, null, 2));
