import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_WFS_PAGE_SIZE,
  WFS_PAGE_MAX_BYTES,
  assertGeoJsonEnvelope,
  assertSafeMetadataUrl,
  assertSafeDownloadUrl,
  downloadGeoJson,
  downloadWfsGeoJson,
  mirrorRiauGeoportal,
  summarizeMirrorFailures
} from "../scripts/riau-geoportal-mirror.mjs";

const BASE_URL = "https://geoportal.riau.example";
const DATASET_NEW = "11111111-1111-4111-8111-111111111111";
const DATASET_REUSED = "22222222-2222-4222-8222-222222222222";
const DATASET_RESTRICTED = "4982b10e-05d1-4495-9c84-b144d968163d";
const DATASET_ANOMALY = "fed43cd7-01ca-4b03-a467-a8a162a459e4";
const METADATA_XML =
  '<?xml version="1.0"?><gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd"></gmd:MD_Metadata>';

function featureCollection(name = "fixture") {
  return {
    type: "FeatureCollection",
    name,
    features: [{
      type: "Feature",
      properties: { name },
      geometry: { type: "Point", coordinates: [101.4, 0.5] }
    }]
  };
}

function dataset(uuid, updatedAt, title = "DUPLICATE TITLE") {
  return {
    id: uuid,
    datasetUuid: uuid,
    title,
    publisher: "Dinas Contoh",
    theme: { name: "Contoh" },
    spatial: {
      geometryType: "POINT",
      srs: "EPSG:4326",
      bbox: { minx: 100, miny: 0, maxx: 103, maxy: 2 }
    },
    dates: { updatedAt },
    metadata: { distribution: { license: "Data Terbuka", access: "public" } },
    workflow: { status: "published" },
    access: { downloadUrl: `${BASE_URL}/katalog/${uuid}/download` }
  };
}

function planItem(uuid, status = "ready", { license = "Data Terbuka", access = "public" } = {}) {
  return {
    id: uuid,
    datasetUuid: uuid,
    title: "DUPLICATE TITLE",
    status,
    blockers: status === "ready" ? [] : ["metadata_identity_conflict"],
    source: {
      url: `${BASE_URL}/katalog/${uuid}/download`,
      expectedBytes: 123,
      license,
      access
    },
    metadataResource: {
      url: `${BASE_URL}/metadata/${uuid}/download`,
      method: "GET",
      expectedFormat: "ISO 19139 XML"
    },
    validation: {
      expectedDatasetUuid: uuid,
      expectedGeometryType: "POINT",
      expectedBbox: { minx: 100, miny: 0, maxx: 103, maxy: 2 }
    }
  };
}

function validInspection() {
  return {
    driver: "GeoJSON",
    layerCount: 1,
    featureCount: 1,
    geometryTypes: ["Point"],
    bbox: [101.4, 0.5, 101.4, 0.5]
  };
}

test("safe download URL is same-origin and UUID-bound", () => {
  assert.equal(
    assertSafeDownloadUrl(`${BASE_URL}/katalog/${DATASET_NEW}/download`, {
      baseUrl: BASE_URL,
      datasetUuid: DATASET_NEW
    }).origin,
    BASE_URL
  );
  assert.throws(
    () => assertSafeDownloadUrl(`https://attacker.example/katalog/${DATASET_NEW}/download`, {
      baseUrl: BASE_URL,
      datasetUuid: DATASET_NEW
    }),
    /Cross-origin/
  );
  assert.throws(
    () => assertSafeDownloadUrl(`${BASE_URL}/katalog/${DATASET_REUSED}/download`, {
      baseUrl: BASE_URL,
      datasetUuid: DATASET_NEW
    }),
    /does not match dataset/
  );
});

test("metadata URL is same-origin and bound to the canonical dataset UUID", () => {
  assert.equal(
    assertSafeMetadataUrl(`${BASE_URL}/metadata/${DATASET_NEW}/download`, {
      baseUrl: BASE_URL,
      datasetUuid: DATASET_NEW
    }).pathname,
    `/metadata/${DATASET_NEW}/download`
  );
  assert.throws(
    () => assertSafeMetadataUrl(`${BASE_URL}/metadata/${DATASET_REUSED}/download`, {
      baseUrl: BASE_URL,
      datasetUuid: DATASET_NEW
    }),
    /does not match dataset/
  );
});

test("streaming download rejects cross-origin redirects and non-FeatureCollection JSON", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "riau-download-test-"));
  const destination = path.join(directory, "source.geojson");
  const redirectFetch = async () => new Response(null, {
    status: 302,
    headers: { location: `https://attacker.example/katalog/${DATASET_NEW}/download` }
  });
  await assert.rejects(
    downloadGeoJson({
      datasetUuid: DATASET_NEW,
      url: `${BASE_URL}/katalog/${DATASET_NEW}/download`,
      baseUrl: BASE_URL,
      destination,
      fetchImpl: redirectFetch,
      retries: 1,
      timeoutMs: 1000
    }),
    /Cross-origin/
  );

  const featureFetch = async () => new Response(JSON.stringify({
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: [101, 1] }
  }), { headers: { "content-type": "application/json" } });
  await assert.rejects(
    downloadGeoJson({
      datasetUuid: DATASET_NEW,
      url: `${BASE_URL}/katalog/${DATASET_NEW}/download`,
      baseUrl: BASE_URL,
      destination,
      fetchImpl: featureFetch,
      retries: 1,
      timeoutMs: 1000
    }),
    /FeatureCollection/
  );
});

test("GeoJSON envelope rejects HTML even when saved with a geojson extension", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "riau-envelope-test-"));
  const filePath = path.join(directory, "fake.geojson");
  await fs.writeFile(filePath, "<!doctype html><html><body>login</body></html>");
  await assert.rejects(assertGeoJsonEnvelope(filePath), /HTML/);
});

test("mirrors ready UUIDs, reuses unchanged releases, and keeps review data metadata-only", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "riau-mirror-test-"));
  const manifest = {
    id: "fixture-inventory",
    generatedAt: "2026-09-20T00:00:00.000Z",
    source: { baseUrl: BASE_URL },
    datasets: [
      dataset(DATASET_NEW, "2026-09-19T10:00:00Z"),
      dataset(DATASET_REUSED, "2026-09-18T10:00:00Z"),
      dataset(DATASET_RESTRICTED, "2026-09-17T10:00:00Z", "ADMINISTRASIKABKOTARIAU_LN_2026_250K"),
      dataset(DATASET_ANOMALY, "2026-09-16T10:00:00Z", "SEBARANBANTUANKELOMPOKSARPRAS_PT_2026_250K")
    ]
  };
  const plan = {
    generatedAt: manifest.generatedAt,
    items: [
      planItem(DATASET_NEW),
      planItem(DATASET_REUSED),
      // A review-required item must never be fetched, regardless of its URL.
      planItem(DATASET_RESTRICTED, "review_required", {
        license: "Data Terbatas",
        access: "public"
      }),
      planItem(DATASET_ANOMALY)
    ]
  };
  const previousSha = "a".repeat(64);
  const previousDisplaySha = "b".repeat(64);
  const previousMetadataSha = createHash("sha256").update(METADATA_XML).digest("hex");
  const previous = {
    datasets: [{
      datasetUuid: DATASET_REUSED,
      mirrorStatus: "mirrored",
      retrievedAt: "2026-09-18T11:00:00.000Z",
      source: { updatedAt: "2026-09-18T10:00:00Z" },
      artifacts: {
        source: {
          key: `internal/riau-geoportal/datasets/${DATASET_REUSED}/releases/${previousSha}/source.geojson`,
          sha256: previousSha,
          bytes: 100,
          contentType: "application/geo+json"
        },
        display: {
          available: true,
          status: "ready",
          key: `internal/riau-geoportal/datasets/${DATASET_REUSED}/releases/${previousDisplaySha}/display.geojson`,
          sha256: previousDisplaySha,
          bytes: 90,
          featureCount: 1,
          contentType: "application/geo+json"
        },
        metadata: {
          key: `internal/riau-geoportal/datasets/${DATASET_REUSED}/metadata/releases/${previousMetadataSha}/metadata.xml`,
          sha256: previousMetadataSha,
          bytes: Buffer.byteLength(METADATA_XML),
          contentType: "application/xml"
        }
      },
      validation: validInspection(),
      qaWarnings: []
    }]
  };
  const fetched = [];
  const fetchImpl = async input => {
    const url = new URL(input);
    fetched.push(url.pathname);
    if (
      url.pathname.startsWith("/katalog/") &&
      (url.pathname.includes(DATASET_RESTRICTED) || url.pathname.includes(DATASET_REUSED))
    ) {
      throw new Error(`Forbidden fetch for ${url.pathname}`);
    }
    if (url.pathname.startsWith("/metadata/")) {
      return new Response(METADATA_XML, {
        status: 200,
        headers: { "content-type": "application/xml" }
      });
    }
    return new Response(JSON.stringify(featureCollection(url.pathname)), {
      status: 200,
      headers: { "content-type": "application/geo+json" }
    });
  };
  let displayBuilds = 0;
  const displayBuilder = async (source, destination) => {
    displayBuilds += 1;
    await fs.copyFile(source, destination);
    await fs.appendFile(destination, "\n");
  };

  const { catalog, uploadPlan } = await mirrorRiauGeoportal({
    manifest,
    plan,
    previous,
    outputDir,
    expectedCount: 4,
    fetchImpl,
    inspector: async () => validInspection(),
    displayBuilder,
    now: () => new Date("2026-09-20T12:34:56.789Z"),
    retries: 1,
    retryDelayMs: 0,
    concurrency: 2
  });

  assert.deepEqual(catalog.totals, {
    datasets: 4,
    ready: 3,
    mirrored: 2,
    reused: 1,
    reviewRequired: 1,
    failed: 0,
    displayReady: 2,
    displayQuarantined: 1,
    displayUnavailable: 0
  });
  assert.equal(fetched.length, 6);
  assert.equal(displayBuilds, 1);

  const byUuid = new Map(catalog.datasets.map(entry => [entry.datasetUuid, entry]));
  assert.equal(byUuid.get(DATASET_RESTRICTED).mirrorStatus, "metadata_only_review_required");
  assert.equal(byUuid.get(DATASET_RESTRICTED).artifacts.source, null);
  assert.ok(byUuid.get(DATASET_RESTRICTED).blockers.includes("known_ambiguous_restricted_metadata"));
  assert.equal(byUuid.get(DATASET_REUSED).mirrorStatus, "reused");
  assert.equal(byUuid.get(DATASET_REUSED).artifacts.source.sha256, previousSha);
  assert.equal(byUuid.get(DATASET_ANOMALY).artifacts.display.status, "quarantined");
  assert.ok(byUuid.get(DATASET_ANOMALY).qaWarnings.some(warning =>
    warning.code === "known_coordinate_anomaly"
  ));
  assert.match(
    byUuid.get(DATASET_NEW).artifacts.source.key,
    new RegExp(`datasets/${DATASET_NEW}/releases/[0-9a-f]{64}/source\\.geojson$`)
  );
  assert.equal(byUuid.get(DATASET_NEW).artifacts.display.featureCount, 1);
  assert.notEqual(
    byUuid.get(DATASET_NEW).artifacts.display.sha256,
    byUuid.get(DATASET_NEW).artifacts.source.sha256
  );
  assert.equal(
    byUuid.get(DATASET_NEW).artifacts.display.key,
    `internal/riau-geoportal/datasets/${DATASET_NEW}/releases/${byUuid.get(DATASET_NEW).artifacts.display.sha256}/display.geojson`
  );
  assert.equal(uploadPlan.totals.dataObjects, 6);
  assert.equal(uploadPlan.totals.manifestObjects, 2);
  assert.ok(uploadPlan.objects.every(object => !/\/datasets\/[^/]+\/current\.json$/.test(object.key)));

  const pointerPath = path.join(
    outputDir,
    "objects/internal/riau-geoportal/catalog/current.json"
  );
  const pointer = JSON.parse(await fs.readFile(pointerPath, "utf8"));
  assert.equal(pointer.datasets.length, 4);
  assert.equal(pointer.canonicalDatasetKey, "datasetUuid");
  assert.equal(
    pointer.datasets.find(entry => entry.datasetUuid === DATASET_NEW).artifacts.display.featureCount,
    1
  );
  assert.match(
    pointer.datasets.find(entry => entry.datasetUuid === DATASET_NEW).artifacts.metadata.key,
    /metadata\/releases\/[0-9a-f]{64}\/metadata\.xml$/
  );
  assert.equal(byUuid.get(DATASET_NEW).description, null);
  assert.equal(byUuid.get(DATASET_NEW).access.downloadUrl, `${BASE_URL}/katalog/${DATASET_NEW}/download`);

  const sourceBody = await fs.readFile(path.join(
    outputDir,
    "objects",
    byUuid.get(DATASET_NEW).artifacts.source.key
  ));
  assert.equal(
    createHash("sha256").update(sourceBody).digest("hex"),
    byUuid.get(DATASET_NEW).artifacts.source.sha256
  );
});

test("falls back to the exact public-mapset WFS layer when inferred download route fails", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "riau-wfs-fallback-test-"));
  const sourceDataset = dataset(DATASET_NEW, "2026-09-20T00:00:00Z", "WFS FALLBACK");
  sourceDataset.description = "Preserved description";
  sourceDataset.identifiers = { datasetIdentifier: "WFS-FALLBACK" };
  sourceDataset.publicMapset = {
    present: true,
    layerNameMatches: true,
    workspace: "geoportal",
    layerName: "layer_allowlisted",
    qualifiedName: "geoportal:layer_allowlisted",
    geometryType: "POINT"
  };
  const calls = [];
  const fetchImpl = async input => {
    const url = new URL(input);
    calls.push(url);
    if (url.pathname.startsWith("/metadata/")) {
      return new Response(METADATA_XML, { headers: { "content-type": "application/xml" } });
    }
    if (url.pathname.startsWith("/katalog/")) {
      return new Response("missing", { status: 404, headers: { "content-type": "text/plain" } });
    }
    if (url.pathname === "/wfs-proxy") {
      assert.equal(url.searchParams.get("typeNames"), "geoportal:layer_allowlisted");
      assert.equal(url.searchParams.get("request"), "GetFeature");
      return new Response(JSON.stringify({
        type: "FeatureCollection",
        numberMatched: 2,
        numberReturned: 2,
        features: [
          { type: "Feature", id: "layer.1", properties: { id: 1 }, geometry: { type: "Point", coordinates: [101, 1] } },
          { type: "Feature", id: "layer.2", properties: { id: 2 }, geometry: { type: "Point", coordinates: [102, 1] } }
        ]
      }), { headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected URL ${url.href}`);
  };
  const inspection = {
    driver: "GeoJSON",
    layerCount: 1,
    featureCount: 2,
    geometryTypes: ["Point"],
    bbox: [101, 1, 102, 1]
  };
  const fallbackPlanItem = planItem(DATASET_NEW);
  fallbackPlanItem.reviewedMetadataTitleConflict = {
    datasetTitle: "WFS FALLBACK",
    metadataTitle: "WFS FALLBACK 2025",
    note: "Reviewed as the same maintained layer."
  };
  const { catalog } = await mirrorRiauGeoportal({
    manifest: {
      id: "wfs-fixture",
      source: { baseUrl: BASE_URL },
      datasets: [sourceDataset]
    },
    plan: { items: [fallbackPlanItem] },
    outputDir,
    expectedCount: 1,
    fetchImpl,
    inspector: async () => inspection,
    displayBuilder: async (source, destination) => fs.copyFile(source, destination),
    retries: 1,
    retryDelayMs: 0,
    now: () => new Date("2026-09-20T00:00:00.000Z")
  });
  const entry = catalog.datasets[0];
  assert.equal(entry.mirrorStatus, "mirrored");
  assert.equal(entry.artifacts.source.acquisition, "wfs_paged");
  assert.equal(entry.artifacts.source.pageCount, 1);
  assert.equal(entry.description, "Preserved description");
  assert.deepEqual(entry.identifiers, { datasetIdentifier: "WFS-FALLBACK" });
  assert.ok(entry.qaWarnings.some(warning =>
    warning.code === "direct_download_failed_wfs_fallback_used"
  ));
  assert.deepEqual(
    entry.qaWarnings.find(warning => warning.code === "reviewed_metadata_title_conflict"),
    {
      code: "reviewed_metadata_title_conflict",
      severity: "warning",
      datasetTitle: "WFS FALLBACK",
      metadataTitle: "WFS FALLBACK 2025",
      note: "Reviewed as the same maintained layer."
    }
  );
  assert.ok(calls.some(url => url.pathname.startsWith("/katalog/")));
  assert.ok(calls.some(url => url.pathname === "/wfs-proxy"));
});

test("default WFS paging safely fetches 13,063 features with stable cross-page dedupe", async () => {
  assert.equal(DEFAULT_WFS_PAGE_SIZE, 500);
  assert.equal(WFS_PAGE_MAX_BYTES, 256 * 1024 * 1024);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "riau-wfs-13063-test-"));
  const destination = path.join(directory, "contours.geojson");
  const sourceDataset = dataset(DATASET_NEW, "2026-09-20T00:00:00Z", "CONTOURS");
  sourceDataset.publicMapset = {
    present: true,
    layerNameMatches: true,
    workspace: "geoportal",
    layerName: "contour_layer",
    qualifiedName: "geoportal:contour_layer",
    geometryType: "MULTILINESTRING"
  };
  const starts = [];
  const fetchImpl = async input => {
    const url = new URL(input);
    const start = Number(url.searchParams.get("startIndex"));
    const count = Number(url.searchParams.get("count"));
    starts.push(start);
    assert.equal(count, 500);
    let ids;
    if (start === 0) {
      ids = Array.from({ length: 500 }, (_, index) => index);
    } else if (start === 500) {
      ids = [499, ...Array.from({ length: 499 }, (_, index) => 500 + index)];
    } else {
      const firstUnique = start - 1;
      const remaining = 13_063 - firstUnique;
      ids = Array.from({ length: Math.min(500, remaining) }, (_, index) => firstUnique + index);
    }
    const features = ids.map(id => ({
      type: "Feature",
      id: `contour_layer.${id}`,
      properties: { objectid: id },
      geometry: {
        type: "MultiLineString",
        coordinates: [[
          [101 + (id % 10) * 0.001, 0.5],
          [101.001 + (id % 10) * 0.001, 0.501]
        ]]
      }
    }));
    return new Response(JSON.stringify({
      type: "FeatureCollection",
      numberMatched: 13_063,
      numberReturned: features.length,
      features
    }), { headers: { "content-type": "application/json" } });
  };

  const result = await downloadWfsGeoJson({
    dataset: sourceDataset,
    datasetUuid: DATASET_NEW,
    baseUrl: BASE_URL,
    destination,
    fetchImpl,
    maxBytes: 64 * 1024 * 1024,
    timeoutMs: 1000,
    retries: 1,
    retryDelayMs: 0
  });
  const output = JSON.parse(await fs.readFile(destination, "utf8"));
  const ids = output.features.map(feature => feature.id);
  assert.equal(result.pageCount, 27);
  assert.equal(result.featureCount, 13_063);
  assert.equal(output.features.length, 13_063);
  assert.equal(new Set(ids).size, 13_063);
  assert.equal(ids[0], "contour_layer.0");
  assert.equal(ids.at(-1), "contour_layer.13062");
  assert.deepEqual(starts, Array.from({ length: 27 }, (_, index) => index * 500));
});

test("failure summaries expose canonical UUID, title, and terminal error", () => {
  assert.deepEqual(summarizeMirrorFailures({
    datasets: [{
      datasetUuid: "65c24420-a091-4dd5-a6e5-3936b0d82ac4",
      title: "PETADASARKONTURRIAU_AR_2026_250K",
      mirrorStatus: "failed",
      qaWarnings: [{
        code: "source_mirror_failed",
        severity: "error",
        message: "Direct download returned HTTP 504; WFS page exceeded limit"
      }]
    }]
  }), [{
    datasetUuid: "65c24420-a091-4dd5-a6e5-3936b0d82ac4",
    title: "PETADASARKONTURRIAU_AR_2026_250K",
    reason:
      "source_mirror_failed: Direct download returned HTTP 504; WFS page exceeded limit"
  }]);
});

test("material coordinate anomalies preserve raw but quarantine derived display", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "riau-bbox-quarantine-test-"));
  let displayBuilds = 0;
  const fetchImpl = async input => {
    const url = new URL(input);
    if (url.pathname.startsWith("/metadata/")) {
      return new Response(METADATA_XML, { headers: { "content-type": "application/xml" } });
    }
    return new Response(JSON.stringify(featureCollection("outlier")), {
      headers: { "content-type": "application/geo+json" }
    });
  };
  const { catalog } = await mirrorRiauGeoportal({
    manifest: {
      id: "bbox-fixture",
      source: { baseUrl: BASE_URL },
      datasets: [dataset(DATASET_NEW, "2026-09-20T00:00:00Z")]
    },
    plan: { items: [planItem(DATASET_NEW)] },
    outputDir,
    expectedCount: 1,
    fetchImpl,
    inspector: async () => ({
      ...validInspection(),
      bbox: [101, 0.5, 127.23, 0.5]
    }),
    displayBuilder: async () => { displayBuilds += 1; },
    retries: 1,
    retryDelayMs: 0,
    now: () => new Date("2026-09-20T00:00:00.000Z")
  });
  const entry = catalog.datasets[0];
  assert.equal(entry.mirrorStatus, "mirrored");
  assert.equal(entry.artifacts.source.available, true);
  assert.equal(entry.artifacts.display.status, "quarantined");
  assert.equal(displayBuilds, 0);
  assert.ok(entry.qaWarnings.some(warning =>
    warning.code === "extent_outside_riau_guardrail"
  ));
});

test("force refresh bypasses unchanged source reuse", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "riau-force-test-"));
  const sourceSha = "c".repeat(64);
  const displaySha = "d".repeat(64);
  let sourceFetches = 0;
  const fetchImpl = async input => {
    const url = new URL(input);
    if (url.pathname.startsWith("/metadata/")) {
      return new Response(METADATA_XML, { headers: { "content-type": "application/xml" } });
    }
    sourceFetches += 1;
    return new Response(JSON.stringify(featureCollection("forced")), {
      headers: { "content-type": "application/geo+json" }
    });
  };
  const previous = {
    datasets: [{
      datasetUuid: DATASET_NEW,
      mirrorStatus: "mirrored",
      source: { updatedAt: "2026-09-20T00:00:00Z" },
      artifacts: {
        source: {
          key: `internal/riau-geoportal/datasets/${DATASET_NEW}/releases/${sourceSha}/source.geojson`,
          sha256: sourceSha,
          bytes: 10
        },
        display: {
          key: `internal/riau-geoportal/datasets/${DATASET_NEW}/releases/${displaySha}/display.geojson`,
          sha256: displaySha,
          bytes: 10,
          featureCount: 1
        }
      },
      validation: validInspection()
    }]
  };
  const { catalog } = await mirrorRiauGeoportal({
    manifest: {
      id: "force-fixture",
      source: { baseUrl: BASE_URL },
      datasets: [dataset(DATASET_NEW, "2026-09-20T00:00:00Z")]
    },
    plan: { items: [planItem(DATASET_NEW)] },
    previous,
    outputDir,
    expectedCount: 1,
    fetchImpl,
    inspector: async () => validInspection(),
    displayBuilder: async (source, destination) => fs.copyFile(source, destination),
    force: true,
    retries: 1,
    retryDelayMs: 0,
    now: () => new Date("2026-09-20T00:00:00.000Z")
  });
  assert.equal(sourceFetches, 1);
  assert.equal(catalog.datasets[0].mirrorStatus, "mirrored");
  assert.notEqual(catalog.datasets[0].artifacts.source.sha256, sourceSha);
});

test("a ready plan item with explicit restricted licensing fetches metadata only", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "riau-restricted-test-"));
  const fetched = [];
  const manifest = {
    id: "restricted-fixture",
    source: { baseUrl: BASE_URL },
    datasets: [dataset(DATASET_NEW, "2026-09-20T00:00:00Z")]
  };
  const plan = {
    items: [planItem(DATASET_NEW, "ready", { license: "Data Terbatas", access: "public" })]
  };
  const { catalog } = await mirrorRiauGeoportal({
    manifest,
    plan,
    outputDir,
    expectedCount: 1,
    fetchImpl: async input => {
      const url = new URL(input);
      fetched.push(url.pathname);
      if (!url.pathname.startsWith("/metadata/")) throw new Error("must not fetch source");
      return new Response(METADATA_XML, {
        headers: { "content-type": "application/xml" }
      });
    },
    now: () => new Date("2026-09-20T00:00:00.000Z")
  });
  assert.deepEqual(fetched, [`/metadata/${DATASET_NEW}/download`]);
  assert.equal(catalog.datasets[0].mirrorStatus, "metadata_only_review_required");
  assert.ok(catalog.datasets[0].blockers.includes("license_not_open"));
  assert.equal(catalog.datasets[0].artifacts.metadata.available, true);
});
