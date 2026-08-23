import { createHash } from "node:crypto";

const appsScript = process.env.APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec";
const githubOrigin = process.env.GITHUB_PAGES_ORIGIN || "https://webgisyg.id";
const cloudflareOrigin = process.env.CLOUDFLARE_STAGING_ORIGIN ||
  "https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev";
const minimumFeatures = Number(process.env.MIN_PUBLIC_FEATURES || 100);

async function getJson(url) {
  const started = Date.now();
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "YG-GeoPortal-Stack-Monitor/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(90000)
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return { data: JSON.parse(bytes.toString("utf8")), bytes, durationMs: Date.now() - started };
}

function assertSnapshot(name, result) {
  if (result.data?.type !== "FeatureCollection" || !Array.isArray(result.data.features)) {
    throw new Error(`${name} is not a FeatureCollection`);
  }
  if (result.data.features.length < minimumFeatures) {
    throw new Error(`${name} has only ${result.data.features.length} features`);
  }
}

const health = await getJson(`${appsScript}?page=health`);
if (
  !health.data?.ok ||
  health.data?.dependencies?.spreadsheet === false ||
  health.data?.dependencies?.drive === false
) {
  throw new Error("Apps Script, Spreadsheet, or Drive health check failed");
}

const [appsObjects, githubObjects, cloudflareObjects, manifest] = await Promise.all([
  getJson(`${appsScript}?page=objects`),
  getJson(`${githubOrigin}/data/master-database-snapshot.json`),
  getJson(`${cloudflareOrigin}/snapshots/current/objects.json`),
  getJson(`${cloudflareOrigin}/manifests/current.json`)
]);

assertSnapshot("apps-script", appsObjects);
assertSnapshot("github-pages", githubObjects);
assertSnapshot("cloudflare", cloudflareObjects);
const expected = manifest.data?.snapshots?.objects;
if (!expected?.sha256 || expected.featureCount !== cloudflareObjects.data.features.length) {
  throw new Error("Cloudflare manifest metadata mismatch");
}
const cloudflareHash = createHash("sha256").update(cloudflareObjects.bytes).digest("hex");
if (cloudflareHash !== expected.sha256) throw new Error("Cloudflare snapshot hash mismatch");

console.log(JSON.stringify({
  ok: true,
  featureCounts: {
    appsScript: appsObjects.data.features.length,
    githubPages: githubObjects.data.features.length,
    cloudflare: cloudflareObjects.data.features.length
  },
  durationMs: {
    appsScriptHealth: health.durationMs,
    appsScriptObjects: appsObjects.durationMs,
    githubPages: githubObjects.durationMs,
    cloudflare: cloudflareObjects.durationMs
  },
  cloudflareVersion: manifest.data.version
}, null, 2));
