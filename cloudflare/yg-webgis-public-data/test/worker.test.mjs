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
