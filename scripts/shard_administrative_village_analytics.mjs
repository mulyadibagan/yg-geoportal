import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(ROOT, process.env.ADMIN_ANALYTICS_SOURCE || "data/administrative-village-analytics.json");
const outputDir = path.join(
  ROOT,
  process.env.ADMIN_ANALYTICS_OUTPUT_DIR || "data/administrative-village-analytics"
);
const shardCount = Number(process.env.ADMIN_ANALYTICS_SHARDS || 64);

function shardFor(key) {
  return parseInt(createHash("sha256").update(key).digest("hex").slice(0, 8), 16) % shardCount;
}

const analytics = JSON.parse(await readFile(sourcePath, "utf8"));
const shards = Array.from({ length: shardCount }, () => ({}));
const index = {};
for (const [key, record] of Object.entries(analytics.villages || {})) {
  const shard = shardFor(key);
  shards[shard][key] = record;
  index[key] = shard;
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
for (let shard = 0; shard < shardCount; shard += 1) {
  if (!Object.keys(shards[shard]).length) continue;
  await writeFile(path.join(outputDir, `${shard}.json`), JSON.stringify(shards[shard]));
}
await writeFile(
  path.join(outputDir, "manifest.json"),
  JSON.stringify({
    schemaVersion: 1,
    generatedAt: analytics.generatedAt,
    method: analytics.method,
    viirs: analytics.viirs,
    referenceLayers: analytics.referenceLayers,
    count: Object.keys(index).length,
    shards: shardCount,
    index
  })
);
console.log(`Wrote ${Object.keys(index).length} village records into ${shardCount} shards.`);
