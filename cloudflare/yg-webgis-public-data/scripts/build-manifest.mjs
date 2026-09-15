import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const version = process.argv[2];
if (!version) throw new Error("Snapshot version is required");
const files = {
  dashboard: "../../../data/dashboard-summary-snapshot.json",
  objects: "../../../data/master-database-snapshot.json"
};
const snapshots = {};
for (const [name, path] of Object.entries(files)) {
  const bytes = await readFile(new URL(path, import.meta.url));
  const parsed = JSON.parse(bytes.toString("utf8"));
  snapshots[name] = {
    path: `/snapshots/${version}/${name}.json`,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    featureCount: Array.isArray(parsed.features) ? parsed.features.length : null,
    generatedAt: parsed.generatedAt || null
  };
}
const manifest = {
  schemaVersion: 1,
  service: "yg-webgis-public-data",
  version,
  publishedAt: new Date().toISOString(),
  snapshots
};
await mkdir(new URL("../tmp/", import.meta.url), { recursive: true });
await writeFile(new URL("../tmp/current-manifest.json", import.meta.url), JSON.stringify(manifest));
console.log(JSON.stringify(manifest, null, 2));
