import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

function authenticatedStaffPayload() {
  return {
    reports: [],
    stats: {},
    viewer: { username: "test-staff", role: "editor" }
  };
}

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

test("one-time FEG ingest rejects every payload except the validated artifact", async () => {
  const env = writableEnv();
  const missingChecksum = await worker.fetch(new Request("https://data.test/internal/ingest/feg-sk130-riau", {
    method: "PUT",
    body: "{}"
  }), env);
  assert.equal(missingChecksum.status, 403);
  assert.equal(env.store.size, 0);

  const wrongBody = await worker.fetch(new Request("https://data.test/internal/ingest/feg-sk130-riau", {
    method: "PUT",
    headers: { "x-content-sha256": "bf15bfabfc650070c542809b7647ef366f33897ce0116902b4d2dcbcc923a970" },
    body: "{}"
  }), env);
  assert.equal(wrongBody.status, 400);
  assert.equal(env.store.size, 0);
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

test("serves the Liberica research dataset from R2", async () => {
  const response = await worker.fetch(
    new Request("https://data.test/research/liberica-morphology-2026.json"),
    envWith({ dataset_status: "Research Dataset — Morphological Characterization, 2026", observations: new Array(60).fill({}) })
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-yg-data-source"), "r2");
  assert.equal((await response.json()).observations.length, 60);
});

test("serves public Dayun datasets from R2 with edge cache headers", async () => {
  const cases = [
    ["/dayun/program.json", { layers: [] }],
    ["/dayun/map.geojson", { type: "FeatureCollection", features: new Array(89).fill({}) }],
    ["/dayun/context.geojson", { type: "FeatureCollection", features: new Array(2).fill({}) }],
    ["/dayun/gawangan-details.json", { objects: new Array(59).fill({}) }],
    ["/dayun/blocks.geojson", { type: "FeatureCollection", features: new Array(6).fill({}) }]
  ];
  for (const [path, payload] of cases) {
    const response = await worker.fetch(new Request("https://data.test" + path), envWith(payload));
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("x-yg-data-source"), "r2", path);
    assert.match(response.headers.get("cache-control"), /s-maxage=3600/, path);
    assert.deepEqual(await response.json(), payload, path);
  }
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

test("protects and serves the RSPO group overview from R2", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.match(String(url), /page=staff-reports/);
    assert.match(String(url), /sessionToken=valid-session/);
    return new Response(JSON.stringify(authenticatedStaffPayload()), { headers: { "content-type": "application/json" } });
  };
  try {
    const env = envWith({ type: "FeatureCollection", features: new Array(23).fill({ type: "Feature" }) });
    const denied = await worker.fetch(new Request("https://data.test/api/staff/rspo-groups"), env);
    assert.equal(denied.status, 401);
    const response = await worker.fetch(new Request("https://data.test/api/staff/rspo-groups", { headers: { authorization: "Bearer valid-session" } }), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://webgisyg.id");
    assert.equal(response.headers.get("x-yg-data-source"), "r2-private-route");
    assert.match(response.headers.get("cache-control"), /private/);
    assert.equal((await response.json()).features.length, 23);
  } finally { globalThis.fetch = originalFetch; }
});

test("PBPH reference and reports require a valid staff session", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.match(String(url), /page=staff-reports/);
    assert.match(String(url), /sessionToken=valid-session/);
    return new Response(JSON.stringify(authenticatedStaffPayload()), { headers: { "content-type": "application/json" } });
  };
  try {
    const env = envWith({ type: "FeatureCollection", features: [{ properties: { NAMOBJ: "internal" } }] });
    for (const path of ["/api/staff/rtrw-riau-2018-2038", "/api/staff/rdtr-bagansiapiapi-analysis", "/api/staff/rspo-companies", "/api/staff/pbph-riau", "/api/staff/pbph-tree-cover-monitoring", "/api/staff/pbph-documents", "/api/staff/fire-monthly-index", "/api/staff/fire-monthly-report?month=2026-08", "/api/staff/phl-svlk-monthly-index", "/api/staff/phl-svlk-monthly-report?month=2026-08"]) {
      const denied = await worker.fetch(new Request("https://data.test" + path), env);
      assert.equal(denied.status, 401, path);
      const allowed = await worker.fetch(new Request("https://data.test" + path, { headers: { authorization: "Bearer valid-session" } }), env);
      assert.equal(allowed.status, 200, path);
      assert.equal(allowed.headers.get("cache-control"), "private, max-age=300");
      assert.equal(allowed.headers.get("vary"), "Authorization");
      assert.equal(allowed.headers.get("access-control-allow-origin"), "https://webgisyg.id");
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("Riau Geoportal catalog and dataset objects remain staff-only", async () => {
  const originalFetch = globalThis.fetch;
  const uuid = "1465e69b-4107-4862-bc66-d532e0fd5a21";
  const release = "a".repeat(64);
  const displayRelease = "b".repeat(64);
  const prefix = `internal/riau-geoportal/datasets/${uuid}`;
  const sourceKey = `${prefix}/releases/${release}/source.geojson`;
  const displayKey = `${prefix}/releases/${displayRelease}/display.geojson`;
  const sourceBody = JSON.stringify({ type: "FeatureCollection", features: [{ id: "source" }] });
  const displayBody = JSON.stringify({ type: "FeatureCollection", features: [{ id: "display" }] });
  const catalog = {
    schemaVersion: 1,
    id: "release-test",
    generatedAt: "2026-09-20T00:00:00.000Z",
    access: "staff_only",
    canonicalDatasetKey: "datasetUuid",
    datasetCount: 60,
    catalog: { releaseKey: "internal/riau-geoportal/catalog/releases/release-test.json" },
    datasets: [{
      datasetUuid: uuid,
      title: "Contoh",
      artifacts: {
        source: { available: true, key: sourceKey, bytes: Buffer.byteLength(sourceBody), sha256: release },
        display: { available: true, status: "ready", key: displayKey, bytes: Buffer.byteLength(displayBody), sha256: displayRelease, featureCount: 1 }
      }
    }]
  };
  const objects = new Map([
    ["internal/riau-geoportal/catalog/current.json", JSON.stringify(catalog)],
    [sourceKey, sourceBody],
    [displayKey, displayBody]
  ]);
  const seen = [];
  const env = {
    ...envWith(null),
    PUBLIC_SNAPSHOTS: {
      async get(key) {
        seen.push(key);
        const value = objects.get(key);
        if (value == null) return null;
        return {
          body: value,
          async text() { return value; },
          size: Buffer.byteLength(value),
          httpEtag: '"riau-test"',
          writeHttpMetadata(headers) { headers.set("content-type", "application/json"); }
        };
      }
    }
  };
  globalThis.fetch = async url => {
    assert.match(String(url), /page=staff-reports/);
    assert.match(String(url), /sessionToken=riau-geoportal-session/);
    return new Response(JSON.stringify(authenticatedStaffPayload()), { headers: { "content-type": "application/json" } });
  };
  try {
    const denied = await worker.fetch(new Request("https://data.test/api/staff/riau-geoportal/catalog"), env);
    assert.equal(denied.status, 401);

    const headers = { authorization: "Bearer riau-geoportal-session" };
    const catalogResponse = await worker.fetch(new Request("https://data.test/api/staff/riau-geoportal/catalog", { headers }), env);
    assert.equal(catalogResponse.status, 200);
    assert.equal((await catalogResponse.json()).datasetCount, 60);
    assert.equal(catalogResponse.headers.get("access-control-allow-origin"), "https://webgisyg.id");
    assert.equal(catalogResponse.headers.get("vary"), "Authorization");

    const manifestResponse = await worker.fetch(new Request(`https://data.test/api/staff/riau-geoportal/datasets/${uuid}/manifest`, { headers }), env);
    assert.equal(manifestResponse.status, 200);
    assert.equal((await manifestResponse.json()).dataset.datasetUuid, uuid);

    const displayResponse = await worker.fetch(new Request(`https://data.test/api/staff/riau-geoportal/datasets/${uuid}/display`, { headers }), env);
    assert.equal(displayResponse.status, 200);
    assert.equal((await displayResponse.json()).features[0].id, "display");

    const sourceResponse = await worker.fetch(new Request(`https://data.test/api/staff/riau-geoportal/datasets/${uuid}/source`, { headers }), env);
    assert.equal(sourceResponse.status, 200);
    assert.match(sourceResponse.headers.get("content-disposition"), new RegExp(uuid));
    assert.equal((await sourceResponse.json()).features[0].id, "source");
    assert.ok(seen.includes(sourceKey));
    assert.ok(seen.includes(displayKey));
    assert.ok(!seen.includes(`${prefix}/current.json`));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("serves validated gzip source objects as explicit staff-only downloads", async () => {
  const originalFetch = globalThis.fetch;
  const uuid = "1465e69b-4107-4862-bc66-d532e0fd5a21";
  const storedSha = "c".repeat(64);
  const originalSha = "d".repeat(64);
  const key = `internal/riau-geoportal/datasets/${uuid}/releases/${storedSha}/source.geojson.gz`;
  const body = new Uint8Array([31, 139, 8, 0, 0, 0, 0, 0, 2, 3]);
  const catalog = {
    schemaVersion: 1,
    access: "staff_only",
    canonicalDatasetKey: "datasetUuid",
    datasets: [{
      datasetUuid: uuid,
      artifacts: {
        source: {
          available: true,
          key,
          sha256: storedSha,
          bytes: body.byteLength,
          contentType: "application/gzip",
          compression: "gzip",
          originalSha256: originalSha,
          originalBytes: 632 * 1024 * 1024,
          originalContentType: "application/geo+json"
        }
      }
    }]
  };
  const env = {
    ...envWith(null),
    PUBLIC_SNAPSHOTS: {
      async get(requestedKey) {
        if (requestedKey === "internal/riau-geoportal/catalog/current.json") {
          const value = JSON.stringify(catalog);
          return { body: value, async text() { return value; }, size: value.length, httpEtag: '"catalog"', writeHttpMetadata() {} };
        }
        if (requestedKey === key) {
          return { body, size: body.byteLength, httpEtag: '"gzip"', writeHttpMetadata() {} };
        }
        return null;
      }
    }
  };
  globalThis.fetch = async () => new Response(JSON.stringify(authenticatedStaffPayload()), {
    headers: { "content-type": "application/json" }
  });
  try {
    const headers = { authorization: "Bearer riau-gzip-source-session" };
    const denied = await worker.fetch(new Request(`https://data.test/api/staff/riau-geoportal/datasets/${uuid}/source`), env);
    assert.equal(denied.status, 401);
    const response = await worker.fetch(new Request(`https://data.test/api/staff/riau-geoportal/datasets/${uuid}/source`, { headers }), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/gzip");
    assert.equal(response.headers.get("content-encoding"), null);
    assert.match(response.headers.get("content-disposition"), /\.geojson\.gz"$/);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), body);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects malformed or oversized compressed source manifests", async () => {
  const originalFetch = globalThis.fetch;
  const uuid = "1465e69b-4107-4862-bc66-d532e0fd5a21";
  const storedSha = "e".repeat(64);
  const baseKey = `internal/riau-geoportal/datasets/${uuid}/releases/${storedSha}/source.geojson.gz`;
  const baseSource = {
    available: true,
    key: baseKey,
    sha256: storedSha,
    bytes: 100,
    contentType: "application/gzip",
    compression: "gzip",
    originalSha256: "f".repeat(64),
    originalBytes: 1000,
    originalContentType: "application/geo+json"
  };
  function envFor(source) {
    const catalog = JSON.stringify({
      schemaVersion: 1,
      access: "staff_only",
      canonicalDatasetKey: "datasetUuid",
      datasets: [{ datasetUuid: uuid, artifacts: { source } }]
    });
    return {
      ...envWith(null),
      PUBLIC_SNAPSHOTS: {
        async get(key) {
          if (key.endsWith("/catalog/current.json")) {
            return { body: catalog, async text() { return catalog; }, size: catalog.length, httpEtag: '"catalog"', writeHttpMetadata() {} };
          }
          return { body: "x", size: 1, httpEtag: '"source"', writeHttpMetadata() {} };
        }
      }
    };
  }
  globalThis.fetch = async () => new Response(JSON.stringify(authenticatedStaffPayload()), {
    headers: { "content-type": "application/json" }
  });
  try {
    const headers = { authorization: "Bearer riau-invalid-gzip-session" };
    const cases = [
      { ...baseSource, compression: "br" },
      { ...baseSource, compression: "" },
      { ...baseSource, compression: false },
      { ...baseSource, originalSha256: undefined },
      { ...baseSource, originalBytes: 5 * 1024 * 1024 * 1024 + 1 },
      { ...baseSource, bytes: 290 * 1024 * 1024 + 1 },
      { ...baseSource, key: baseKey.replace(/\.gz$/, "") },
      { ...baseSource, contentType: "application/geo+json" }
    ];
    for (const source of cases) {
      const response = await worker.fetch(new Request(
        `https://data.test/api/staff/riau-geoportal/datasets/${uuid}/source`,
        { headers }
      ), envFor(source));
      assert.equal(response.status, 503);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Riau Geoportal dataset paths reject traversal and unadvertised objects", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(authenticatedStaffPayload()), { headers: { "content-type": "application/json" } });
  try {
    const env = envWith(null);
    const headers = { authorization: "Bearer riau-path-test-session" };
    const invalid = await worker.fetch(new Request("https://data.test/api/staff/riau-geoportal/datasets/not-a-uuid/display", { headers }), env);
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error, "invalid_dataset_path");
    const raw = await worker.fetch(new Request("https://data.test/api/staff/riau-geoportal/datasets/1465e69b-4107-4862-bc66-d532e0fd5a21/raw", { headers }), env);
    assert.equal(raw.status, 404);
    const unknown = await worker.fetch(new Request("https://data.test/api/staff/riau-geoportal/private-object", { headers }), env);
    assert.equal(unknown.status, 404);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("staff token validation rejects malformed and error-shaped upstream payloads", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [token, payload] of [
      ["malformed-staff-session", {}],
      ["error-staff-session", { error: "Sesi staf tidak valid." }],
      ["missing-viewer-staff-session", { reports: [], stats: {} }],
      ["empty-viewer-staff-session", { reports: [], stats: {}, viewer: { username: "", role: "" } }]
    ]) {
      globalThis.fetch = async url => {
        assert.match(String(url), new RegExp(`sessionToken=${token}`));
        return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
      };
      const response = await worker.fetch(new Request("https://data.test/api/staff/riau-geoportal/catalog", {
        headers: { authorization: `Bearer ${token}` }
      }), envWith({ datasets: [] }));
      assert.equal(response.status, 401, token);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Riau Geoportal catalog cannot redirect reads or understate display size", async () => {
  const originalFetch = globalThis.fetch;
  const uuid = "1465e69b-4107-4862-bc66-d532e0fd5a21";
  const release = "c".repeat(64);
  const validKey = `internal/riau-geoportal/datasets/${uuid}/releases/${release}/display.geojson`;
  const headers = { authorization: "Bearer riau-manifest-hardening-session" };
  globalThis.fetch = async () => new Response(JSON.stringify(authenticatedStaffPayload()), { headers: { "content-type": "application/json" } });

  function maliciousEnv(catalog, { objectSize = 2, objectKey = validKey, includeObjectSize = true } = {}) {
    return {
      ...envWith(null),
      PUBLIC_SNAPSHOTS: {
        async get(key) {
          if (key.endsWith("/current.json")) {
            const value = JSON.stringify(catalog);
            return { body: value, async text() { return value; }, size: value.length, httpEtag: '"catalog"', writeHttpMetadata() {} };
          }
          if (key === objectKey) {
            const object = { body: "{}", httpEtag: '"display"', writeHttpMetadata() {} };
            if (includeObjectSize) object.size = objectSize;
            return object;
          }
          return null;
        }
      }
    };
  }

  const baseDataset = {
    datasetUuid: uuid,
    artifacts: {
      display: { available: true, status: "ready", kind: "display", key: validKey, sha256: release, bytes: 2, featureCount: 1 }
    }
  };
  const base = {
    schemaVersion: 1,
    access: "staff_only",
    canonicalDatasetKey: "datasetUuid",
    datasets: [baseDataset]
  };
  try {
    const cases = [
      [{ ...base, datasets: [{ ...baseDataset, datasetUuid: "797ba768-2e6b-4cc8-ada9-6b4134baf518" }] }, {}, 503],
      [{ ...base, datasets: [{ ...baseDataset, artifacts: { display: { ...baseDataset.artifacts.display, key: `internal/riau-geoportal/datasets/${uuid}/releases/${release}/../source.geojson` } } }] }, {}, 503],
      [{ ...base, datasets: [{ ...baseDataset, artifacts: { display: { ...baseDataset.artifacts.display, kind: "source" } } }] }, {}, 503],
      [{ ...base, datasets: [{ ...baseDataset, artifacts: { display: { ...baseDataset.artifacts.display, compression: "gzip" } } }] }, {}, 503],
      [{ ...base, datasets: [{ ...baseDataset, artifacts: { display: { ...baseDataset.artifacts.display, bytes: -1 } } }] }, {}, 503],
      [{ ...base, datasets: [baseDataset, structuredClone(baseDataset)] }, {}, 503],
      [base, { objectSize: 3 }, 503],
      [base, { includeObjectSize: false }, 503],
      [{ ...base, datasets: [{ ...baseDataset, artifacts: { display: { ...baseDataset.artifacts.display, featureCount: 25_001 } } }] }, {}, 503],
      [{ ...base, datasets: [{ ...baseDataset, artifacts: { display: { ...baseDataset.artifacts.display, bytes: 13 * 1024 * 1024 } } }] }, { objectSize: 13 * 1024 * 1024 }, 413]
    ];
    for (const [catalog, options, expectedStatus] of cases) {
      const response = await worker.fetch(new Request(`https://data.test/api/staff/riau-geoportal/datasets/${uuid}/display`, { headers }), maliciousEnv(catalog, options));
      assert.equal(response.status, expectedStatus);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("parallel staff geometry requests share one Apps Script token check", async () => {
  const originalFetch = globalThis.fetch;
  let checks = 0;
  globalThis.fetch = async url => {
    checks += 1;
    assert.match(String(url), /page=staff-reports/);
    await new Promise(resolve => setTimeout(resolve, 10));
    return new Response(JSON.stringify(authenticatedStaffPayload()), { headers: { "content-type": "application/json" } });
  };
  try {
    const env = envWith({ type: "FeatureCollection", features: [] });
    const headers = { authorization: "Bearer parallel-session" };
    const [pbph, rspo] = await Promise.all([
      worker.fetch(new Request("https://data.test/api/staff/pbph-riau", { headers }), env),
      worker.fetch(new Request("https://data.test/api/staff/rspo-groups", { headers }), env)
    ]);
    assert.equal(pbph.status, 200);
    assert.equal(rspo.status, 200);
    assert.equal(checks, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("serves the aggregated RSPO group overview publicly", async () => {
  const env = envWith({ type: "FeatureCollection", features: new Array(23).fill({ type: "Feature" }) });
  const response = await worker.fetch(new Request("https://data.test/references/rspo-riau-groups.geojson"), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal((await response.json()).features.length, 23);
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
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
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
    assert.equal(response.headers.get("access-control-allow-origin"), "https://webgisyg.id");
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
