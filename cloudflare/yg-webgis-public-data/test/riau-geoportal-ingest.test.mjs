import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createFixtureFetch,
  discoverDataTableEndpoint,
  fetchDataTableAll,
  inventoryRiauGeoportal,
  parseDatasetDetailHtml,
  parseIso19139MetadataXml,
  parseMetadataDetailHtml
} from "../scripts/riau-geoportal-ingest.mjs";

const BASE_URL = "https://geoportal.example.test";
const DATASET_A = "11111111-1111-4111-8111-111111111111";
const DATASET_B = "22222222-2222-4222-8222-222222222222";
const RECORD_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FILE_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RECORD_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FILE_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ORPHAN_DATASET = "33333333-3333-4333-8333-333333333333";

const CATALOG_LANDING = `
  <table id="katalog-table"></table>
  <script>
    $('#katalog-table').DataTable({
      serverSide: true,
      ajax: { url: "${BASE_URL}/katalog/datatable" }
    });
  </script>`;

const METADATA_LANDING = `
  <table id="metaTable"></table>
  <script>
    $('#metaTable').DataTable({ ajax: "${BASE_URL}/metadata/datatable" });
  </script>`;

function catalogRow({
  id,
  uuid,
  datasetIdentifier,
  recordUuid,
  fileIdentifier,
  layerName,
  title = "JUDUL DATA SAMA"
}) {
  return {
    id,
    uuid,
    title,
    description: "Data &amp; deskripsi",
    type: "vector",
    spatial_format: "shp",
    file_size: id * 1000,
    geom_type: "MULTIPOLYGON",
    srs: "EPSG:4326",
    bbox: { minx: "100", miny: "0", maxx: "103", maxy: "2" },
    kugi_tema_id: 3,
    kugi_subtema_id: 7,
    kugi_unsur_id: 4,
    workspace: "geoportal",
    datastore: "geoportal_postgis",
    layer_name: layerName,
    storage_path: `spasial/${uuid}`,
    dataset_identifier: datasetIdentifier,
    data_year: 2026,
    update_frequency: "as_needed",
    workflow_status: "published",
    verification_status: "verified",
    validation_status: "validated",
    publish_status: "success",
    publisher: "Dinas Contoh",
    opd: { id: 4, nama_opd: "Dinas Contoh", is_active: true },
    kugi_tema: { id: 3, nama: "Hidrografi", kode: "HYD" },
    current_metadata: {
      uuid: recordUuid,
      file_identifier: fileIdentifier,
      completeness: 100,
      metadata_standard_name: "ISO 19139",
      metadata_standard_version: "2007"
    },
    action: `<a href="${BASE_URL}/katalog/view/${uuid}">Lihat Dataset</a>`
  };
}

function metadataRow({
  id,
  uuid,
  datasetIdentifier,
  recordUuid,
  fileIdentifier,
  title = "JUDUL DATA SAMA"
}) {
  return {
    id,
    uuid,
    title,
    description: "Deskripsi metadata",
    dataset_identifier: datasetIdentifier,
    publisher: "Dinas Contoh",
    completeness: 100,
    current_metadata: {
      uuid: recordUuid,
      file_identifier: fileIdentifier,
      completeness: 100,
      identification: {
        title,
        abstract: "Abstrak terstruktur",
        purpose: "Analisis internal",
        topic_category: "environment",
        spatial_representation_type: "vector"
      }
    },
    action: `<a href="${BASE_URL}/metadata/view/${fileIdentifier}">Detail Metadata</a>`
  };
}

function mapsetLayer({ uuid, layerName, title = "DATA PESISIR" }) {
  return {
    id: uuid,
    title,
    description: "Layer publik",
    workspace: "geoportal",
    layer_name: layerName,
    qualified_name: `geoportal:${layerName}`,
    geom_type: "MULTIPOLYGON",
    format: "vector",
    opd: "Dinas Contoh",
    tema: "Hidrografi",
    bbox: { minx: 100, miny: 0, maxx: 103, maxy: 2 },
    wfs_url: `${BASE_URL}/wfs-proxy?typeNames=geoportal:${layerName}`
  };
}

function datasetDetail({ uuid, datasetIdentifier, embeddedMetadata, layerName }) {
  return `<!doctype html><html><body>
    <h2>DATA &amp; PESISIR</h2>
    <div><strong>Dataset Identifier</strong><p>${datasetIdentifier}</p></div>
    <div><strong>UUID Dataset</strong><p>${uuid}</p></div>
    <div><strong>Tahun Data</strong><p>2026</p></div>
    <div><strong>Frekuensi Pembaruan</strong><p>as_needed</p></div>
    <div><strong>Produsen Data</strong><p>Dinas Contoh</p></div>
    <div><strong>Tema KUGI</strong><p>Hidrografi</p></div>
    <p style="line-height: 1.8">Cakupan pesisir &amp; pulau.</p>
    <strong><i class="fal fa-file-code"></i> Format Spasial:</strong><br><span>SHP</span>
    <strong><i></i> Tipe Geometri:</strong><br><span>MULTIPOLYGON</span>
    <strong><i></i> Sistem Koordinat:</strong><br><span>EPSG:4326</span>
    <strong><i></i> Tipe Layanan (OGC):</strong><br><span>WMS, WFS</span>
    <strong>Tags:</strong><div><span>pesisir</span><span>riau</span></div>
    <h4>Atribut Data Shapefile <span>(12 record)</span></h4>
    <i class="fal fa-columns"></i>objectid
    <i class="fal fa-columns"></i>namobj
    <a href="${BASE_URL}/katalog/${uuid}/download">Download Dataset</a>
    <a href="${BASE_URL}/metadata/view/${embeddedMetadata}">Lihat Metadata</a>
    <script>
      var workspace = "geoportal";
      var layerName = "${layerName}";
      var dbBbox = ["100", "0", "103", "2"];
    </script>
  </body></html>`;
}

function metadataDetail({
  uuid,
  datasetIdentifier,
  fileIdentifier,
  title = "DATA &amp; PESISIR",
  license = "Data Terbuka",
  access = "public"
}) {
  return `<!doctype html><html><body>
    <div class="meta-header"><div>
      <h1>${title}</h1><p>Abstrak &amp; tujuan analisis.</p>
    </div><div class="meta-score"><strong>100%</strong><span>Kelengkapan</span></div></div>
    <h4>Identifikasi Dataset</h4><div class="meta-grid">
      <div><span>Dataset Identifier</span><strong>${datasetIdentifier}</strong></div>
      <div><span>Metadata Identifier</span><strong>${fileIdentifier}</strong></div>
      <div><span>Tujuan</span><strong>Analisis internal</strong></div>
      <div><span>Status</span><strong>completed</strong></div>
      <div><span>Kategori Topik</span><strong>environment</strong></div>
      <div><span>Representasi Spasial</span><strong>vector</strong></div>
    </div>
    <h4>Kata Kunci</h4><span class="keyword-chip">pesisir</span>
    <h4>Referensi Spasial &amp; Cakupan</h4><div class="meta-grid">
      <div><span>Sistem Referensi</span><strong>EPSG:4326</strong></div>
      <div><span>Barat</span><strong>100</strong></div>
      <div><span>Timur</span><strong>103</strong></div>
      <div><span>Selatan</span><strong>0</strong></div>
      <div><span>Utara</span><strong>2</strong></div>
    </div>
    <h3>Standar Metadata</h3><ul>
      <li><span>Nama</span><strong>ISO 19139</strong></li>
      <li><span>Versi</span><strong>2007</strong></li>
    </ul>
    <div class="meta-side-box"><h3>Distribusi &amp; Lisensi</h3><ul>
      <li><span>Format</span><strong>Shapefile</strong></li>
      <li><span>Lisensi</span><strong>${license}</strong></li>
      <li><span>Akses</span><strong>${access}</strong></li>
    </ul>
      <a href="${BASE_URL}/wms-proxy?service=WMS&amp;request=GetCapabilities">OGC WMS</a>
      <a href="${BASE_URL}/wfs-proxy?service=WFS&amp;request=GetCapabilities">OGC WFS</a>
      <a href="${BASE_URL}/katalog/${uuid}/download">Download Dataset</a>
    </div>
    <div class="meta-side-box"><h3>Kontak</h3><ul>
      <li><span>Organisasi</span><strong>Dinas Contoh</strong></li>
      <li><span>Nama</span><strong>Bidang Data</strong></li>
    </ul></div>
    <a href="${BASE_URL}/katalog/view/${uuid}">Buka Dataset</a>
    <a href="${BASE_URL}/metadata/${uuid}/xml">Lihat XML</a>
    <a href="${BASE_URL}/metadata/${uuid}/download">Download XML</a>
  </body></html>`;
}

function metadataXml({ constraint = "Data Terbuka" } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd"
      xmlns:gco="http://www.isotc211.org/2005/gco">
      <gmd:resourceConstraints><gmd:MD_LegalConstraints>
        <gmd:useLimitation><gco:CharacterString>Untuk analisis internal</gco:CharacterString></gmd:useLimitation>
        <gmd:accessConstraints>
          <gmd:MD_RestrictionCode codeListValue="otherRestrictions">otherRestrictions</gmd:MD_RestrictionCode>
        </gmd:accessConstraints>
        <gmd:otherConstraints><gco:CharacterString>${constraint}</gco:CharacterString></gmd:otherConstraints>
      </gmd:MD_LegalConstraints></gmd:resourceConstraints>
    </gmd:MD_Metadata>`;
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    async text() { return typeof body === "string" ? body : JSON.stringify(body); },
    async json() { return typeof body === "string" ? JSON.parse(body) : body; }
  };
}

function tablePayload(rows, url) {
  const start = Number(url.searchParams.get("start") || 0);
  const length = Number(url.searchParams.get("length") || rows.length);
  return {
    draw: Number(url.searchParams.get("draw") || 1),
    recordsTotal: rows.length,
    recordsFiltered: rows.length,
    data: rows.slice(start, start + length)
  };
}

function buildFetchRouter() {
  const catalogRows = [
    catalogRow({
      id: 1,
      uuid: DATASET_A,
      datasetIdentifier: "DATASET-A-2026",
      recordUuid: RECORD_A,
      fileIdentifier: FILE_A,
      layerName: "layer_a"
    }),
    catalogRow({
      id: 2,
      uuid: DATASET_B,
      datasetIdentifier: "DATASET-B-2026",
      recordUuid: RECORD_B,
      fileIdentifier: FILE_B,
      layerName: "layer_b"
    })
  ];
  // Intentionally reverse metadata rows: a duplicate title must never drive the join.
  const metadataRows = [
    metadataRow({
      id: 2,
      uuid: DATASET_B,
      datasetIdentifier: "DATASET-B-2026",
      recordUuid: RECORD_B,
      fileIdentifier: FILE_B
    }),
    metadataRow({
      id: 1,
      uuid: DATASET_A,
      datasetIdentifier: "DATASET-A-2026",
      recordUuid: RECORD_A,
      fileIdentifier: FILE_A
    })
  ];
  const mapset = {
    status: true,
    total: 2,
    layers: [
      mapsetLayer({ uuid: DATASET_A, layerName: "layer_a" }),
      mapsetLayer({ uuid: DATASET_B, layerName: "layer_b" })
    ]
  };
  const calls = [];
  const fetchImpl = async input => {
    const url = new URL(input);
    calls.push(url.href);
    if (/\/download\/?$/.test(url.pathname)) {
      throw new Error(`A download URL was fetched: ${url.href}`);
    }
    if (url.pathname === "/katalog") return response(CATALOG_LANDING);
    if (url.pathname === "/metadata") return response(METADATA_LANDING);
    if (url.pathname === "/katalog/datatable") return response(tablePayload(catalogRows, url));
    if (url.pathname === "/metadata/datatable") return response(tablePayload(metadataRows, url));
    if (url.pathname === "/mapset/layers") return response(mapset);
    if (url.pathname === `/katalog/view/${DATASET_A}`) {
      return response(datasetDetail({
        uuid: DATASET_A,
        datasetIdentifier: "DATASET-A-2026",
        embeddedMetadata: RECORD_A,
        layerName: "layer_a"
      }));
    }
    if (url.pathname === `/katalog/view/${DATASET_B}`) {
      return response(datasetDetail({
        uuid: DATASET_B,
        datasetIdentifier: "DATASET-B-2026",
        embeddedMetadata: FILE_B,
        layerName: "layer_b"
      }));
    }
    if (url.pathname === `/metadata/view/${FILE_A}`) {
      return response(metadataDetail({
        uuid: DATASET_A,
        datasetIdentifier: "DATASET-A-2026",
        fileIdentifier: FILE_A
      }));
    }
    if (url.pathname === `/metadata/view/${FILE_B}`) {
      return response(metadataDetail({
        uuid: DATASET_B,
        datasetIdentifier: "DATASET-B-2026",
        fileIdentifier: FILE_B
      }));
    }
    if (url.pathname === `/metadata/${DATASET_A}/xml` ||
        url.pathname === `/metadata/${DATASET_B}/xml`) {
      return response(metadataXml());
    }
    return response("Not found", 404);
  };
  return { fetchImpl, calls, catalogRows, metadataRows, mapset };
}

test("discovers both DataTables endpoint syntaxes and paginates all rows", async () => {
  assert.equal(
    discoverDataTableEndpoint(CATALOG_LANDING, { baseUrl: BASE_URL, tableId: "katalog-table" }),
    `${BASE_URL}/katalog/datatable`
  );
  assert.equal(
    discoverDataTableEndpoint(METADATA_LANDING, { baseUrl: BASE_URL, tableId: "metaTable" }),
    `${BASE_URL}/metadata/datatable`
  );

  const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const starts = [];
  const fetchImpl = async input => {
    const url = new URL(input);
    starts.push(Number(url.searchParams.get("start")));
    return response(tablePayload(rows, url));
  };
  const result = await fetchDataTableAll({
    endpoint: `${BASE_URL}/katalog/datatable`,
    baseUrl: BASE_URL,
    fetchImpl,
    pageSize: 1
  });
  assert.deepEqual(starts, [0, 1, 2]);
  assert.deepEqual(result.rows, rows);
  assert.equal(result.recordsTotal, 3);
});

test("inventory requests reject cross-origin redirects and oversized responses", async () => {
  const endpoint = `${BASE_URL}/katalog/datatable`;
  await assert.rejects(
    fetchDataTableAll({
      endpoint,
      baseUrl: BASE_URL,
      fetchImpl: async () => ({
        ok: false,
        status: 302,
        headers: new Headers({ location: "https://attacker.example/katalog/datatable" })
      })
    }),
    /cross-origin/
  );

  await assert.rejects(
    fetchDataTableAll({
      endpoint,
      baseUrl: BASE_URL,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        url: "https://attacker.example/katalog/datatable",
        headers: new Headers(),
        async text() { return '{"data":[]}'; }
      })
    }),
    /cross-origin/
  );

  await assert.rejects(
    fetchDataTableAll({
      endpoint,
      baseUrl: BASE_URL,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "5000001" }),
        async text() { return '{"data":[]}'; }
      })
    }),
    /exceeds 5000000 bytes/
  );
});

test("parses dataset and ISO metadata details without trusting presentation markup", () => {
  const dataset = parseDatasetDetailHtml(datasetDetail({
    uuid: DATASET_A,
    datasetIdentifier: "DATASET-A-2026",
    embeddedMetadata: RECORD_A,
    layerName: "layer_a"
  }), { baseUrl: BASE_URL });
  assert.equal(dataset.title, "DATA & PESISIR");
  assert.equal(dataset.datasetUuid, DATASET_A);
  assert.equal(dataset.layerName, "layer_a");
  assert.equal(dataset.spatialFormat, "SHP");
  assert.deepEqual(dataset.bbox, { minx: 100, miny: 0, maxx: 103, maxy: 2 });
  assert.deepEqual(dataset.tags, ["pesisir", "riau"]);
  assert.deepEqual(dataset.attributeSummary.fields, ["objectid", "namobj"]);
  assert.equal(dataset.embeddedMetadataIdentifier, RECORD_A);

  const metadata = parseMetadataDetailHtml(metadataDetail({
    uuid: DATASET_A,
    datasetIdentifier: "DATASET-A-2026",
    fileIdentifier: FILE_A
  }), { baseUrl: BASE_URL });
  assert.equal(metadata.metadataIdentifier, FILE_A);
  assert.equal(metadata.datasetIdentifier, "DATASET-A-2026");
  assert.equal(metadata.distribution.license, "Data Terbuka");
  assert.equal(metadata.distribution.access, "public");
  assert.equal(metadata.contact.name, "Bidang Data");
  assert.equal(metadata.xmlDownloadUrl, `${BASE_URL}/metadata/${DATASET_A}/download`);

  const iso = parseIso19139MetadataXml(metadataXml({ constraint: "Data Terbatas" }));
  assert.deepEqual(iso.constraints.useLimitations, ["Untuk analisis internal"]);
  assert.deepEqual(iso.constraints.otherConstraints, ["Data Terbatas"]);
  assert.ok(iso.constraints.accessConstraints.includes("otherRestrictions"));
});

test("builds a canonical manifest and plan while preserving stale metadata-link conflicts", async () => {
  const router = buildFetchRouter();
  const { manifest, downloadPlan } = await inventoryRiauGeoportal({
    baseUrl: BASE_URL,
    fetchImpl: router.fetchImpl,
    pageSize: 1,
    concurrency: 2,
    now: () => new Date("2026-09-20T08:00:00.000Z"),
    runMode: "fixture_dry_run"
  });

  assert.equal(manifest.totals.uniqueDatasets, 2);
  assert.equal(manifest.totals.datasetDetailsOk, 2);
  assert.equal(manifest.totals.metadataDetailsOk, 2);
  assert.equal(manifest.totals.metadataXmlOk, 2);
  assert.equal(manifest.totals.mapsetLayersReported, 2);
  assert.equal(manifest.totals.mapsetMatchedDatasets, 2);
  assert.equal(manifest.safety.downloadedDatasetFiles, false);
  assert.equal(manifest.datasets.filter(item => item.title === "DATA & PESISIR").length, 2);

  const datasetA = manifest.datasets.find(item => item.datasetUuid === DATASET_A);
  const datasetB = manifest.datasets.find(item => item.datasetUuid === DATASET_B);
  assert.equal(datasetA.metadata.matchedBy, "dataset_uuid");
  assert.equal(datasetA.metadata.identifiers.catalogRecordUuid, RECORD_A);
  assert.equal(datasetA.metadata.identifiers.catalogFileIdentifier, FILE_A);
  assert.equal(datasetA.metadata.identifiers.datasetDetailIdentifier, RECORD_A);
  assert.equal(datasetA.metadata.identifiers.directoryPublicIdentifier, FILE_A);
  assert.equal(datasetA.metadata.identifiers.metadataDetailIdentifier, FILE_A);
  assert.equal(
    datasetA.metadata.conflicts[0].type,
    "metadata_route_identifier_mismatch"
  );
  assert.equal(datasetB.metadata.conflicts.length, 0);
  assert.equal(datasetB.spatial.layerName, "layer_b");
  assert.equal(datasetB.publicMapset.layerNameMatches, true);

  assert.equal(downloadPlan.mode, "plan_only_no_download");
  assert.equal(downloadPlan.totals.datasets, 2);
  assert.equal(downloadPlan.totals.ready, 2);
  assert.match(downloadPlan.items[0].destination.r2Key, /^internal\/riau-geoportal\/source\//);
  assert.match(downloadPlan.items[0].destination.r2Key, /\.geojson$/);
  assert.equal(downloadPlan.items[0].source.expectedFormat, "GeoJSON");
  assert.equal(downloadPlan.items[0].source.catalogSpatialFormat, "SHP");
  assert.equal(downloadPlan.items[0].source.expectedBytes, null);
  assert.equal(
    downloadPlan.items[0].validation.checks.includes("required shapefile components"),
    false
  );
  assert.equal(router.calls.some(url => /\/download(?:\?|$)/.test(url)), false);
  assert.deepEqual(
    router.calls.filter(url => url.includes("/katalog/datatable")).map(url => new URL(url).searchParams.get("start")),
    ["0", "1"]
  );
});

test("marks a download for review when current metadata identifies different content", async () => {
  const router = buildFetchRouter();
  const fetchImpl = async input => {
    const url = new URL(input);
    if (url.pathname === `/metadata/${DATASET_A}/xml`) {
      router.calls.push(url.href);
      return response(metadataXml({ constraint: "Data Terbatas" }));
    }
    if (url.pathname === `/metadata/view/${FILE_B}`) {
      router.calls.push(url.href);
      return response(metadataDetail({
        uuid: DATASET_B,
        datasetIdentifier: "DIFFERENT-DATASET-2025",
        fileIdentifier: FILE_B,
        title: "DATA PESISIR 2025"
      }));
    }
    return router.fetchImpl(input);
  };
  const { manifest, downloadPlan } = await inventoryRiauGeoportal({
    baseUrl: BASE_URL,
    fetchImpl,
    pageSize: 2,
    now: () => new Date("2026-09-20T08:00:00.000Z")
  });
  const dataset = manifest.datasets.find(item => item.datasetUuid === DATASET_B);
  assert.deepEqual(
    dataset.metadata.conflicts.map(conflict => conflict.type),
    ["metadata_title_mismatch", "metadata_dataset_identifier_mismatch"]
  );
  assert.equal(manifest.totals.metadataContentConflicts, 1);
  const planItem = downloadPlan.items.find(item => item.datasetUuid === DATASET_B);
  assert.equal(planItem.status, "review_required");
  assert.deepEqual(planItem.blockers, ["metadata_identity_conflict"]);
  const restrictedPlanItem = downloadPlan.items.find(item => item.datasetUuid === DATASET_A);
  assert.equal(restrictedPlanItem.status, "review_required");
  assert.deepEqual(restrictedPlanItem.blockers, ["restricted_license_or_constraints"]);
});

test("requires the exact public mapset UUID and layer_name allowlist", async () => {
  const router = buildFetchRouter();
  const fetchImpl = async input => {
    const url = new URL(input);
    if (url.pathname === "/mapset/layers") {
      router.calls.push(url.href);
      return response({
        status: true,
        total: 2,
        layers: [
          mapsetLayer({ uuid: DATASET_A, layerName: "layer_a" }),
          mapsetLayer({ uuid: ORPHAN_DATASET, layerName: "orphan_layer" })
        ]
      });
    }
    return router.fetchImpl(input);
  };
  const { manifest, downloadPlan } = await inventoryRiauGeoportal({
    baseUrl: BASE_URL,
    fetchImpl,
    pageSize: 2,
    now: () => new Date("2026-09-20T08:00:00.000Z")
  });
  assert.equal(manifest.totals.mapsetLayersReported, 2);
  assert.equal(manifest.totals.mapsetMatchedDatasets, 1);
  assert.equal(manifest.totals.catalogMissingFromMapset, 1);
  assert.equal(manifest.totals.mapsetWithoutCatalog, 1);
  assert.equal(manifest.unmatchedMapset[0].datasetUuid, ORPHAN_DATASET);
  const item = downloadPlan.items.find(planItem => planItem.datasetUuid === DATASET_B);
  assert.equal(item.status, "review_required");
  assert.ok(item.blockers.includes("not_in_public_mapset"));
  assert.equal(router.calls.some(url => url.includes("/wfs-proxy")), false);
});

test("fixture fetch and CLI dry-run generate inventory files without network access", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "riau-geoportal-fixtures-"));
  const catalogDetails = path.join(directory, "catalog-details");
  const metadataDetails = path.join(directory, "metadata-details");
  const metadataXmlDirectory = path.join(directory, "metadata-xml");
  fs.mkdirSync(catalogDetails);
  fs.mkdirSync(metadataDetails);
  fs.mkdirSync(metadataXmlDirectory);
  fs.writeFileSync(path.join(directory, "katalog.html"), CATALOG_LANDING);
  fs.writeFileSync(path.join(directory, "metadata.html"), METADATA_LANDING);
  fs.writeFileSync(path.join(directory, "catalog.json"), JSON.stringify([
    catalogRow({
      id: 1,
      uuid: DATASET_A,
      datasetIdentifier: "DATASET-A-2026",
      recordUuid: RECORD_A,
      fileIdentifier: FILE_A,
      layerName: "layer_a"
    })
  ]));
  fs.writeFileSync(path.join(directory, "metadata.json"), JSON.stringify([
    metadataRow({
      id: 1,
      uuid: DATASET_A,
      datasetIdentifier: "DATASET-A-2026",
      recordUuid: RECORD_A,
      fileIdentifier: FILE_A
    })
  ]));
  fs.writeFileSync(path.join(directory, "mapset.json"), JSON.stringify({
    status: true,
    total: 1,
    layers: [mapsetLayer({ uuid: DATASET_A, layerName: "layer_a" })]
  }));
  fs.writeFileSync(
    path.join(catalogDetails, `${DATASET_A}.html`),
    datasetDetail({
      uuid: DATASET_A,
      datasetIdentifier: "DATASET-A-2026",
      embeddedMetadata: RECORD_A,
      layerName: "layer_a"
    })
  );
  fs.writeFileSync(
    path.join(metadataDetails, `${FILE_A}.html`),
    metadataDetail({
      uuid: DATASET_A,
      datasetIdentifier: "DATASET-A-2026",
      fileIdentifier: FILE_A
    })
  );
  fs.writeFileSync(
    path.join(metadataXmlDirectory, `${DATASET_A}.xml`),
    metadataXml()
  );

  assert.equal(typeof createFixtureFetch(directory, { baseUrl: BASE_URL }), "function");
  const output = path.join(directory, "out", "manifest.json");
  const plan = path.join(directory, "out", "plan.json");
  execFileSync(process.execPath, [
    "scripts/riau-geoportal-ingest.mjs",
    "--fixtures", directory,
    "--base-url", BASE_URL,
    "--output", output,
    "--plan", plan,
    "--dry-run",
    "--page-size", "1"
  ], {
    cwd: path.resolve(import.meta.dirname, ".."),
    encoding: "utf8"
  });
  const manifest = JSON.parse(fs.readFileSync(output, "utf8"));
  const downloadPlan = JSON.parse(fs.readFileSync(plan, "utf8"));
  assert.equal(manifest.mode, "fixture_dry_run");
  assert.equal(manifest.totals.uniqueDatasets, 1);
  assert.equal(downloadPlan.totals.datasets, 1);
  assert.equal(downloadPlan.notice, "This plan does not fetch dataset or metadata download URLs.");
});
