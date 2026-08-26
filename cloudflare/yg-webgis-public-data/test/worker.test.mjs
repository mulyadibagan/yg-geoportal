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

test("serves the Riau KPH reference layer from R2", async () => {
  const response = await worker.fetch(
    new Request("https://data.test/references/kph_2019_riau.geojson"),
    envWith({ type: "FeatureCollection", features: [{ id: "KPH2019-RIAU-0001" }] })
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-yg-data-source"), "r2");
  assert.equal((await response.json()).features.length, 1);
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

test("serves a no-store redacted prepost session list for webgisyg.id", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.match(String(url), /page=prepost-live-summary/);
    return new Response(JSON.stringify({ ok: true, sessions: [{ sessionId: "SESS-1", title: "Training", createdByEmail: "staff@example.org" }] }), { headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(new Request("https://data.test/api/prepost/sessions"), envWith(null));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://webgisyg.id");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(data.sessions[0].createdByEmail, undefined);
    assert.equal(data.sessions[0].sessionId, "SESS-1");
  } finally { globalThis.fetch = originalFetch; }
});

test("serves redacted prepost session detail and validates the session id", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.match(String(url), /page=prepost-session-detail/);
    return new Response(JSON.stringify({ ok: true, session: { sessionId: "SESS-1", createdByEmail: "staff@example.org" }, questions: [{ questionId: "Q-1", createdByEmail: "staff@example.org" }] }), { headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(new Request("https://data.test/api/prepost/session-detail?sessionId=SESS-1"), envWith(null));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.session.createdByEmail, undefined);
    assert.equal(data.questions[0].createdByEmail, undefined);
    const invalid = await worker.fetch(new Request("https://data.test/api/prepost/session-detail?sessionId=%2Fbad"), envWith(null));
    assert.equal(invalid.status, 400);
  } finally { globalThis.fetch = originalFetch; }
});

test("proxies a validated staff authentication result without caching", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.match(String(url), /page=editor-auth-result/);
    assert.match(String(url), /requestId=yg-auth-test-123/);
    return new Response(JSON.stringify({ pending: true }), { headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(new Request("https://data.test/api/staff/auth-result?requestId=yg-auth-test-123"), envWith(null));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("access-control-allow-origin"), "https://webgisyg.id");
    assert.deepEqual(await response.json(), { pending: true });
    const invalid = await worker.fetch(new Request("https://data.test/api/staff/auth-result?requestId=../bad"), envWith(null));
    assert.equal(invalid.status, 400);
  } finally { globalThis.fetch = originalFetch; }
});

test("proxies donor programmes without relying on cross-site JSONP", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.match(String(url), /page=donor-programmes/);
    assert.doesNotMatch(String(url), /sessionToken=/);
    return new Response(JSON.stringify({ assignments: [{ indicatorId: "ACT-GEC-01", evidenceUrl: "" }], authorized: false }), { headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(new Request("https://data.test/api/donor/programmes"), envWith(null));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://webgisyg.id");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(data.assignments[0].indicatorId, "ACT-GEC-01");
    assert.equal(data.authorized, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("forwards a staff bearer session to request private donor evidence", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.match(String(url), /page=donor-programmes/);
    assert.match(String(url), /sessionToken=staff-session-1/);
    return new Response(JSON.stringify({ assignments: [{ evidenceUrl: "https://drive.example/audit" }], authorized: true }), { headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(new Request("https://data.test/api/donor/programmes", { headers: { authorization: "Bearer staff-session-1" } }), envWith(null));
    const data = await response.json();
    assert.equal(data.authorized, true);
    assert.equal(data.assignments[0].evidenceUrl, "https://drive.example/audit");
  } finally { globalThis.fetch = originalFetch; }
});

test("securely proxies donor administration results for Edge", async () => {
  const invalid = await worker.fetch(new Request("https://data.test/api/donor/admin-result?requestId=../bad"), envWith(null));
  assert.equal(invalid.status, 400);
  const denied = await worker.fetch(new Request("https://data.test/api/donor/admin-result?requestId=yg-donor-test-123"), envWith(null));
  assert.equal(denied.status, 401);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.match(String(url), /page=donor-admin-result/);
    assert.match(String(url), /requestId=yg-donor-test-123/);
    assert.match(String(url), /sessionToken=staff-session-1/);
    return new Response(JSON.stringify({ pending: true }), { headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(new Request("https://data.test/api/donor/admin-result?requestId=yg-donor-test-123", { headers: { authorization: "Bearer staff-session-1" } }), envWith(null));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { pending: true });
  } finally { globalThis.fetch = originalFetch; }
});

test("publication refresh requires its secret and atomically publishes a manifest", async () => {
  const env = writableEnv();
  const denied = await worker.fetch(new Request("https://data.test/internal/refresh", { method: "POST", body: "{}" }), env);
  assert.equal(denied.status, 401);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const value = String(url).includes("public-updates")
      ? { type: "FeatureCollection", features: [{ properties: { reportId: "P-1", photos: ["https://drive.google.com/file/d/photo/view"], targetFeatureProperties: { Object_ID: "OBJECT-1" } } }] }
      : String(url).includes("public-reports")
      ? { type: "FeatureCollection", features: [{ properties: { reportId: "R-1", reporterName: "Pelapor" } }] }
      : String(url).includes("prepost-live-summary") ? { sessions: [] }
      : { type: "FeatureCollection", generatedAt: "2026-08-20T00:00:00Z", features: [{ type: "Feature", properties: { Object_ID: "OBJECT-1", Source_Report_ID: "R-1" } }] };
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
    const currentAgain = await worker.fetch(new Request("https://data.test/snapshots/current/objects.json"), env);
    assert.equal((await currentAgain.json()).features[0].properties._ygPhotos.length, 1);
  } finally { globalThis.fetch = originalFetch; }
});
