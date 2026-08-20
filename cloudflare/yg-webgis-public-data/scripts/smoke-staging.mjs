const base = process.env.YG_WEBGIS_STAGING_URL ||
  "https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev";

async function request(path, options) {
  const response = await fetch(base + path, options);
  const bytes = Buffer.from(await response.arrayBuffer());
  let data = null;
  try { data = JSON.parse(bytes.toString("utf8")); } catch (error) {}
  return { response, bytes, data };
}

const health = await request("/health");
if (health.response.status !== 200 || !health.data?.ok || health.data.environment !== "staging") {
  throw new Error("Staging health check failed");
}

for (const [name, expectedFeatures] of [["dashboard", 137], ["objects", 137]]) {
  const result = await request(`/snapshots/current/${name}.json`);
  if (result.response.status !== 200) throw new Error(`${name} HTTP ${result.response.status}`);
  if (result.response.headers.get("x-yg-data-source") !== "r2") {
    throw new Error(`${name} did not come from R2`);
  }
  if (!Array.isArray(result.data?.features) || result.data.features.length !== expectedFeatures) {
    throw new Error(`${name} feature count mismatch`);
  }
}

const manifest = await request("/manifests/current.json");
if (manifest.response.status !== 200 || !manifest.data?.version ||
    !manifest.data?.snapshots?.dashboard?.sha256 || !manifest.data?.snapshots?.objects?.sha256) {
  throw new Error("Manifest validation failed");
}

const head = await request("/snapshots/current/dashboard.json", { method: "HEAD" });
if (head.response.status !== 200 || head.bytes.length !== 0) throw new Error("HEAD validation failed");
const options = await request("/health", { method: "OPTIONS" });
if (options.response.status !== 204 || options.response.headers.get("access-control-allow-origin") !== "*") {
  throw new Error("CORS validation failed");
}
const write = await request("/health", { method: "POST" });
if (write.response.status !== 405) throw new Error("Write method protection failed");
const missing = await request("/private");
if (missing.response.status !== 404) throw new Error("Private path protection failed");

console.log(JSON.stringify({ ok: true, base, version: manifest.data.version }, null, 2));
