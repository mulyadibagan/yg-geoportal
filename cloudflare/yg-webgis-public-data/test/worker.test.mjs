import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

function envWith(value) {
  return {
    ENVIRONMENT: "test",
    GITHUB_ORIGIN: "https://origin.invalid",
    APPS_SCRIPT_BASE: "https://apps.invalid/exec",
    PUBLIC_SNAPSHOTS: {
      async get(key) {
        if (!value) return null;
        return {
          body: JSON.stringify(value),
          httpEtag: '"test"',
          writeHttpMetadata(headers) { headers.set("content-type", "application/json"); }
        };
      }
    }
  };
}

function writableEnv() {
  const store = new Map();
  return {
    ...envWith(null), REFRESH_TOKEN: "test-refresh-secret",
    PUBLIC_SNAPSHOTS: {
      async get(key) {
        const value = store.get(key); if (!value) return null;
        return { body: value, async text() { return value; }, httpEtag: '"test"', writeHttpMetadata(headers) { headers.set("content-type", "application/json"); } };
      },
      async put(key, value) { store.set(key, value); }
    }, store
  };
}

test("health is isolated and reports environment", async () => {
  const response = await worker.fetch(new Request("https://data.test/health"), envWith(null));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "yg-webgis-public-data", environment: "test" });
});

test("serves dashboard snapshot from R2 with public cache headers", async () => {
  const response = await worker.fetch(
    new Request("https://data.test/snapshots/current/dashboard.json"),
    envWith({ type: "FeatureCollection", features: [] })
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-yg-data-source"), "r2");
  assert.match(response.headers.get("cache-control"), /stale-while-revalidate/);
  assert.equal((await response.json()).type, "FeatureCollection");
});

test("falls back to GitHub Pages when an R2 object is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(String(url), "https://origin.invalid/data/dashboard-summary-snapshot.json");
    return new Response(JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature" }] }), {
      headers: { "content-type": "application/json" }
    });
  };
  try {
    const response = await worker.fetch(
      new Request("https://data.test/snapshots/current/dashboard.json"),
      envWith(null)
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-yg-data-source"), "github-pages");
    assert.equal((await response.json()).features.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects write methods and unknown paths", async () => {
  const method = await worker.fetch(new Request("https://data.test/health", { method: "POST" }), envWith(null));
  assert.equal(method.status, 405);
  const missing = await worker.fetch(new Request("https://data.test/private"), envWith(null));
  assert.equal(missing.status, 404);
});

test("publication refresh requires its secret and atomically publishes a manifest", async () => {
  const env = writableEnv();
  const denied = await worker.fetch(new Request("https://data.test/internal/refresh", { method: "POST", body: "{}" }), env);
  assert.equal(denied.status, 401);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const value = String(url).includes("public-reports")
      ? { type: "FeatureCollection", features: [{ properties: { reportId: "R-1", reporterName: "Pelapor" } }] }
      : String(url).includes("prepost-live-summary") ? { sessions: [] }
      : { type: "FeatureCollection", generatedAt: "2026-08-20T00:00:00Z", features: [{ type: "Feature", properties: { Source_Report_ID: "R-1" } }] };
    return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(new Request("https://data.test/internal/refresh", { method: "POST",
      headers: { authorization: "Bearer test-refresh-secret", "content-type": "application/json" },
      body: JSON.stringify({ event: "report_published", reportId: "R-1" }) }), env);
    assert.equal(response.status, 200);
    const result = await response.json();
    const manifest = JSON.parse(env.store.get("manifests/current.json"));
    assert.equal(manifest.version, result.version);
    assert.ok(env.store.has(manifest.snapshots.dashboard.path.slice(1)));
    assert.ok(env.store.has(manifest.snapshots.objects.path.slice(1)));
    const current = await worker.fetch(new Request("https://data.test/snapshots/current/objects.json"), env);
    assert.equal((await current.json()).features[0].properties.reporterName, "Pelapor");
  } finally { globalThis.fetch = originalFetch; }
});
