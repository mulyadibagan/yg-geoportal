import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_RIAU_GEOPORTAL_URL = "https://geoportal.riau.go.id";
export const RIAU_GEOPORTAL_SCHEMA_VERSION = 1;

// These two live records have been manually reconciled across the catalog,
// exact UUID-bound detail/download routes, metadata identifier, mapset layer,
// geometry type, and bbox.  Their only content conflict is the year embedded
// in one title.  Keep the exception deliberately narrow: any upstream drift
// sends the record back to metadata-only review.
export const REVIEWED_METADATA_TITLE_CONFLICTS = new Map([
  [
    "cf774e6f-a3e0-4268-b604-4e5a168f4467",
    {
      datasetTitle: "KECAMATANPRIORITASRAWANPANGAN_AR_2026_10K",
      metadataTitle: "KECAMATANPRIORITASRAWANPANGAN_AR_2025_10K",
      datasetIdentifier: "KECAMATANRAWANPANGAN10KRIAU2025",
      layerName: "zlayer_9czqali2vu9zjipq",
      dataYear: 2025,
      temporalStatus: "catalog_title_year_alias",
      note: "Treat 2025 as the data vintage; preserve the 2026 catalog title as upstream provenance."
    }
  ],
  [
    "e8ba8cd3-4d3f-4f47-8fc7-319b45022995",
    {
      datasetTitle: "CUACAEKSTRIMPUTINGBELIUNGRIAU_PT_2025_250K",
      metadataTitle: "CUACAEKSTRIMPUTINGBELIUNG250KRIAU2026",
      datasetIdentifier: "LOKASICUACAEKSTRIM250KRIAU2025",
      layerName: "zlayer_tjgkk3z8nmwrxmth",
      dataYear: 2025,
      temporalStatus: "year_conflict_unresolved",
      note: "Exclude from year-sensitive analysis until the 2025/2026 title conflict is reconciled."
    }
  ]
]);
const REQUEST_TIMEOUT_MS = 60000;
const MAX_INVENTORY_RESPONSE_BYTES = 5_000_000;
const MAX_INVENTORY_REDIRECTS = 5;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVENTORY_PATHS = [
  /^\/katalog\/?$/,
  /^\/metadata\/?$/,
  /^\/mapset\/layers\/?$/,
  /^\/katalog\/datatable\/?$/,
  /^\/metadata\/datatable\/?$/,
  /^\/katalog\/view\/[0-9a-f-]+\/?$/i,
  /^\/metadata\/view\/[0-9a-f-]+\/?$/i,
  /^\/metadata\/[0-9a-f-]+\/xml\/?$/i
];

function textOrNull(value) {
  if (value === undefined || value === null) return null;
  const valueText = String(value).trim();
  return valueText && valueText !== "-" ? valueText : null;
}

function integerOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null) ?? null;
}

export function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLocaleLowerCase("id-ID");
}

export function decodeHtmlEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"'
  };
  return String(value || "")
    .replace(/&#(x[0-9a-f]+|\d+);?/gi, (match, code) => {
      const radix = code[0].toLowerCase() === "x" ? 16 : 10;
      const parsed = Number.parseInt(radix === 16 ? code.slice(1) : code, radix);
      try {
        return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : match;
      } catch {
        return match;
      }
    })
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function cleanHtml(value) {
  return decodeHtmlEntities(
    String(value || "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(source) {
  const result = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of String(source || "").matchAll(pattern)) {
    result[match[1].toLowerCase()] = decodeHtmlEntities(
      firstDefined(match[2], match[3], match[4], "")
    );
  }
  return result;
}

function anchorsFromHtml(html, baseUrl) {
  const anchors = [];
  const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of String(html || "").matchAll(pattern)) {
    const attributes = parseAttributes(match[1]);
    if (!attributes.href || attributes.href === "#") continue;
    let url;
    try {
      url = new URL(attributes.href, baseUrl).href;
    } catch {
      continue;
    }
    anchors.push({ url, text: cleanHtml(match[2]), attributes });
  }
  return anchors;
}

function firstAnchor(anchors, predicate) {
  return anchors.find(predicate)?.url || null;
}

function uuidFromPath(url, marker) {
  if (!url) return null;
  let pathname;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const pattern = new RegExp(`/${marker}/([0-9a-f-]+)(?:/|$)`, "i");
  const identifier = pathname.match(pattern)?.[1] || null;
  return identifier && UUID_PATTERN.test(identifier) ? identifier.toLowerCase() : null;
}

function extractHeading(html, tag, className = null) {
  const classPart = className
    ? `(?=[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'])`
    : "";
  const pattern = new RegExp(`<${tag}\\b${classPart}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  return textOrNull(cleanHtml(String(html || "").match(pattern)?.[1] || ""));
}

function parseLabelValuePairs(html) {
  const pairs = new Map();
  const patterns = [
    /<span\b[^>]*>((?:(?!<\/span>)[\s\S])*)<\/span>\s*<strong\b[^>]*>((?:(?!<\/strong>)[\s\S])*)<\/strong>/gi,
    /<strong\b[^>]*>((?:(?!<\/strong>)[\s\S])*)<\/strong>\s*<p\b[^>]*>((?:(?!<\/p>)[\s\S])*)<\/p>/gi,
    /<strong\b[^>]*>((?:(?!<\/strong>)[\s\S])*)<\/strong>\s*<br\s*\/?>\s*<span\b[^>]*>((?:(?!<\/span>)[\s\S])*)<\/span>/gi
  ];
  for (const pattern of patterns) {
    for (const match of String(html || "").matchAll(pattern)) {
      const label = cleanHtml(match[1]).replace(/:\s*$/, "").trim();
      const value = textOrNull(cleanHtml(match[2]));
      if (label && value && !pairs.has(label.toLocaleLowerCase("id-ID"))) {
        pairs.set(label.toLocaleLowerCase("id-ID"), value);
      }
    }
  }
  return pairs;
}

function sectionAfterHeading(html, tag, heading) {
  const sourceHtml = String(html || "");
  const tagPattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const startMatch = [...sourceHtml.matchAll(tagPattern)].find(match =>
    cleanHtml(match[1]).toLocaleLowerCase("id-ID") === heading.toLocaleLowerCase("id-ID")
  );
  if (!startMatch) return "";
  const source = sourceHtml.slice(startMatch.index + startMatch[0].length);
  const nextHeading = source.search(new RegExp(`<${tag}\\b`, "i"));
  const nextBox = source.search(/<div\b(?=[^>]*class=["'][^"']*meta-side-box[^"']*["'])/i);
  const candidates = [nextHeading, nextBox].filter(index => index >= 0);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return source.slice(0, end);
}

function pairValue(pairs, ...labels) {
  for (const label of labels) {
    const value = pairs.get(label.toLocaleLowerCase("id-ID"));
    if (value !== undefined) return value;
  }
  return null;
}

function extractJavascriptString(html, variable) {
  const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:var|let|const)\\s+${escaped}\\s*=\\s*["']([^"']*)["']`, "i");
  return textOrNull(decodeHtmlEntities(String(html || "").match(pattern)?.[1] || ""));
}

function extractJavascriptArray(html, variable) {
  const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(html || "").match(
    new RegExp(`(?:var|let|const)\\s+${escaped}\\s*=\\s*(\\[[^;]*\\])`, "i")
  );
  if (!match) return null;
  try {
    const values = JSON.parse(match[1]);
    return Array.isArray(values) ? values.map(numberOrNull) : null;
  } catch {
    return match[1]
      .slice(1, -1)
      .split(",")
      .map(value => numberOrNull(value.replace(/["']/g, "").trim()));
  }
}

function normalizeBbox(value) {
  if (!value) return null;
  const source = Array.isArray(value)
    ? value
    : [value.minx, value.miny, value.maxx, value.maxy];
  const bbox = source.map(numberOrNull);
  if (bbox.length !== 4 || bbox.some(coordinate => coordinate === null)) return null;
  const [minx, miny, maxx, maxy] = bbox;
  if (minx > maxx || miny > maxy) return null;
  return { minx, miny, maxx, maxy };
}

function urlFromActionHtml(action, baseUrl, pathPattern) {
  const anchors = anchorsFromHtml(action, baseUrl);
  return firstAnchor(anchors, anchor => pathPattern.test(new URL(anchor.url).pathname));
}

function assertPortalInventoryUrl(candidate, baseUrl) {
  const url = new URL(candidate, baseUrl);
  const allowedOrigin = new URL(baseUrl).origin;
  if (url.origin !== allowedOrigin) {
    throw new Error(`Refusing cross-origin Geoportal inventory URL: ${url.href}`);
  }
  if (!INVENTORY_PATHS.some(pattern => pattern.test(url.pathname))) {
    throw new Error(`Refusing non-inventory Geoportal URL: ${url.href}`);
  }
  return url.href;
}

async function boundedResponseText(response, safeUrl) {
  const contentLength = Number(response?.headers?.get?.("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_INVENTORY_RESPONSE_BYTES) {
    throw new Error(`Response from ${safeUrl} exceeds ${MAX_INVENTORY_RESPONSE_BYTES} bytes`);
  }
  if (response?.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_INVENTORY_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error(`Response from ${safeUrl} exceeds ${MAX_INVENTORY_RESPONSE_BYTES} bytes`);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(body);
  }
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > MAX_INVENTORY_RESPONSE_BYTES) {
    throw new Error(`Response from ${safeUrl} exceeds ${MAX_INVENTORY_RESPONSE_BYTES} bytes`);
  }
  return body;
}

async function fetchInventoryText(fetchImpl, url, baseUrl, accept) {
  let safeUrl = assertPortalInventoryUrl(url, baseUrl);
  for (let redirects = 0; redirects <= MAX_INVENTORY_REDIRECTS; redirects += 1) {
    const response = await fetchImpl(safeUrl, {
      headers: { accept },
      redirect: "manual",
      signal: typeof globalThis.AbortSignal?.timeout === "function"
        ? globalThis.AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        : undefined
    });
    if (response?.status >= 300 && response.status < 400) {
      if (redirects === MAX_INVENTORY_REDIRECTS) {
        throw new Error(`Too many redirects for ${safeUrl}`);
      }
      const location = response.headers?.get?.("location");
      if (!location) throw new Error(`Redirect from ${safeUrl} has no Location header`);
      safeUrl = assertPortalInventoryUrl(location, baseUrl);
      continue;
    }
    if (!response?.ok) {
      throw new Error(`HTTP ${response?.status ?? "?"} for ${safeUrl}`);
    }
    if (response.url) assertPortalInventoryUrl(response.url, baseUrl);
    return boundedResponseText(response, safeUrl);
  }
  throw new Error(`Too many redirects for ${safeUrl}`);
}

async function fetchText(fetchImpl, url, baseUrl) {
  return fetchInventoryText(fetchImpl, url, baseUrl, "text/html,application/xhtml+xml");
}

async function fetchJson(fetchImpl, url, baseUrl) {
  const body = await fetchInventoryText(fetchImpl, url, baseUrl, "application/json");
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(`Invalid JSON from ${assertPortalInventoryUrl(url, baseUrl)}: ${error.message}`);
  }
}

export function discoverDataTableEndpoint(html, { baseUrl, tableId = null } = {}) {
  if (!baseUrl) throw new Error("baseUrl is required to discover a DataTables endpoint");
  let source = String(html || "");
  if (tableId) {
    const escapedId = tableId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tableStart = source.search(new RegExp(`['\"]#${escapedId}['\"]\\)\\.DataTable\\s*\\(`, "i"));
    if (tableStart >= 0) source = source.slice(tableStart, tableStart + 8000);
  }
  const patterns = [
    /ajax\s*:\s*\{[\s\S]{0,1200}?url\s*:\s*["']([^"']+)["']/i,
    /ajax\s*:\s*["']([^"']+)["']/i,
    /["']([^"']+\/(?:katalog|metadata)\/datatable(?:\?[^"']*)?)["']/i
  ];
  for (const pattern of patterns) {
    const candidate = source.match(pattern)?.[1];
    if (!candidate) continue;
    return assertPortalInventoryUrl(candidate, baseUrl);
  }
  throw new Error(`Could not discover DataTables endpoint${tableId ? ` for #${tableId}` : ""}`);
}

export async function fetchDataTableAll({
  endpoint,
  baseUrl,
  fetchImpl = globalThis.fetch,
  pageSize = 250,
  maxPages = 100,
  maxRecords = 10000
}) {
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl must be a function");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
    throw new Error("pageSize must be an integer from 1 to 1000");
  }
  const rows = [];
  let expectedTotal = null;
  let page = 0;
  while (page < maxPages) {
    const requestUrl = new URL(assertPortalInventoryUrl(endpoint, baseUrl));
    requestUrl.searchParams.set("draw", String(page + 1));
    requestUrl.searchParams.set("start", String(rows.length));
    requestUrl.searchParams.set("length", String(pageSize));
    const payload = await fetchJson(fetchImpl, requestUrl.href, baseUrl);
    if (!payload || !Array.isArray(payload.data)) {
      throw new Error(`DataTables payload from ${endpoint} is missing data[]`);
    }
    const reportedTotal = integerOrNull(
      firstDefined(payload.recordsFiltered, payload.recordsTotal, payload.data.length)
    );
    if (reportedTotal === null || reportedTotal < 0 || reportedTotal > maxRecords) {
      throw new Error(`DataTables total is invalid or exceeds ${maxRecords}`);
    }
    if (expectedTotal === null) expectedTotal = reportedTotal;
    else if (expectedTotal !== reportedTotal) {
      throw new Error(`DataTables total changed during pagination (${expectedTotal} to ${reportedTotal})`);
    }
    if (rows.length + payload.data.length > maxRecords) {
      throw new Error(`DataTables result exceeds ${maxRecords} records`);
    }
    rows.push(...payload.data);
    if (rows.length >= expectedTotal) break;
    if (payload.data.length === 0) {
      throw new Error(`DataTables pagination stopped at ${rows.length} of ${expectedTotal}`);
    }
    page += 1;
  }
  if (expectedTotal !== null && rows.length < expectedTotal) {
    throw new Error(`DataTables pagination exceeded ${maxPages} pages`);
  }
  return {
    endpoint: assertPortalInventoryUrl(endpoint, baseUrl),
    recordsTotal: expectedTotal ?? rows.length,
    rows: rows.slice(0, expectedTotal ?? rows.length)
  };
}

export function parseDatasetDetailHtml(html, { detailUrl, baseUrl } = {}) {
  const resolvedBase = baseUrl || detailUrl || DEFAULT_RIAU_GEOPORTAL_URL;
  const anchors = anchorsFromHtml(html, resolvedBase);
  const pairs = parseLabelValuePairs(html);
  const jsBbox = extractJavascriptArray(html, "dbBbox");
  const fieldNames = [];
  const fieldPattern = /<i\b[^>]*class=["'][^"']*fa-columns[^"']*["'][^>]*><\/i>\s*([^<]+)/gi;
  for (const match of String(html || "").matchAll(fieldPattern)) {
    const fieldName = textOrNull(cleanHtml(match[1]));
    if (fieldName && !fieldNames.includes(fieldName)) fieldNames.push(fieldName);
  }
  const attributeCountMatch = String(html || "").match(/\(([\d.,]+)\s+record\)/i);
  const metadataDetailUrl = firstAnchor(
    anchors,
    anchor => /^\/metadata\/view\/[0-9a-f-]+\/?$/i.test(new URL(anchor.url).pathname)
  );
  const downloadUrl = firstAnchor(
    anchors,
    anchor => /^\/katalog\/[0-9a-f-]+\/download\/?$/i.test(new URL(anchor.url).pathname)
  );
  const description = textOrNull(cleanHtml(
    String(html || "").match(
      /<p\b(?=[^>]*style=["'][^"']*line-height\s*:\s*1\.8)[^>]*>([\s\S]*?)<\/p>/i
    )?.[1] || ""
  ));
  const tagsSection = String(html || "").match(
    /<strong\b[^>]*>[\s\S]*?Tags\s*:\s*<\/strong>[\s\S]*?<div\b[^>]*>([\s\S]*?)<\/div>/i
  )?.[1] || "";
  return {
    title: extractHeading(html, "h2"),
    description,
    datasetIdentifier: pairValue(pairs, "Dataset Identifier"),
    datasetUuid: textOrNull(pairValue(pairs, "UUID Dataset"))?.toLowerCase() || null,
    dataYear: integerOrNull(pairValue(pairs, "Tahun Data")),
    updateFrequency: pairValue(pairs, "Frekuensi Pembaruan"),
    publisher: pairValue(pairs, "Produsen Data"),
    theme: pairValue(pairs, "Tema KUGI"),
    spatialFormat: pairValue(pairs, "Format Spasial"),
    geometryType: pairValue(pairs, "Tipe Geometri"),
    srs: pairValue(pairs, "Sistem Koordinat"),
    serviceTypes: (pairValue(pairs, "Tipe Layanan (OGC)") || "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean),
    bbox: normalizeBbox(jsBbox),
    workspace: extractJavascriptString(html, "workspace"),
    layerName: extractJavascriptString(html, "layerName"),
    downloadUrl,
    embeddedMetadataDetailUrl: metadataDetailUrl,
    embeddedMetadataIdentifier: uuidFromPath(metadataDetailUrl, "metadata/view"),
    tags: [...tagsSection.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
      .map(match => cleanHtml(match[1])).filter(Boolean),
    attributeSummary: {
      recordCount: integerOrNull(attributeCountMatch?.[1]?.replace(/[.,]/g, "")),
      fields: fieldNames
    }
  };
}

export function parseMetadataDetailHtml(html, { detailUrl, baseUrl } = {}) {
  const resolvedBase = baseUrl || detailUrl || DEFAULT_RIAU_GEOPORTAL_URL;
  const anchors = anchorsFromHtml(html, resolvedBase);
  const pairs = parseLabelValuePairs(html);
  const standardPairs = parseLabelValuePairs(sectionAfterHeading(html, "h3", "Standar Metadata"));
  const distributionPairs = parseLabelValuePairs(sectionAfterHeading(html, "h3", "Distribusi & Lisensi"));
  const contactPairs = parseLabelValuePairs(sectionAfterHeading(html, "h3", "Kontak"));
  const header = String(html || "").match(
    /<div\b(?=[^>]*class=["'][^"']*meta-header[^"']*["'])[^>]*>([\s\S]*?)<\/div>\s*<h4/i
  )?.[1] || "";
  const bbox = normalizeBbox([
    pairValue(pairs, "Barat"),
    pairValue(pairs, "Selatan"),
    pairValue(pairs, "Timur"),
    pairValue(pairs, "Utara")
  ]);
  const completeness = integerOrNull(
    String(header).match(/<strong\b[^>]*>\s*(\d{1,3})%\s*<\/strong>/i)?.[1]
  );
  const keywords = [...String(html || "").matchAll(
    /<span\b(?=[^>]*class=["'][^"']*keyword-chip[^"']*["'])[^>]*>([\s\S]*?)<\/span>/gi
  )].map(match => cleanHtml(match[1])).filter(Boolean);
  const constraints = [
    pairValue(distributionPairs, "Batasan", "Constraints"),
    pairValue(distributionPairs, "Batasan Akses", "Kendala Akses", "Access Constraints"),
    pairValue(distributionPairs, "Batasan Penggunaan", "Use Constraints"),
    pairValue(distributionPairs, "Limitasi", "Limitation"),
    pairValue(distributionPairs, "Penggunaan", "Usage")
  ].filter(Boolean);
  return {
    title: extractHeading(header, "h1") || extractHeading(html, "h1"),
    abstract: textOrNull(cleanHtml(String(header).match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "")),
    datasetIdentifier: pairValue(pairs, "Dataset Identifier"),
    metadataIdentifier: textOrNull(pairValue(pairs, "Metadata Identifier"))?.toLowerCase() || null,
    purpose: pairValue(pairs, "Tujuan"),
    status: pairValue(pairs, "Status"),
    topicCategory: pairValue(pairs, "Kategori Topik"),
    representationType: pairValue(pairs, "Representasi Spasial"),
    presentationForm: pairValue(pairs, "Presentation Form"),
    scale: pairValue(pairs, "Skala"),
    keywords,
    srs: pairValue(pairs, "Sistem Referensi"),
    referenceSystemVersion: pairValue(pairs, "Versi Referensi"),
    bbox,
    temporalStart: pairValue(pairs, "Awal Temporal"),
    temporalEnd: pairValue(pairs, "Akhir Temporal"),
    updateFrequency: pairValue(pairs, "Frekuensi Pembaruan"),
    maintenanceScope: pairValue(pairs, "Ruang Lingkup"),
    completeness,
    standard: {
      name: pairValue(standardPairs, "Nama"),
      version: pairValue(standardPairs, "Versi"),
      language: pairValue(standardPairs, "Bahasa"),
      characterSet: pairValue(standardPairs, "Character Set"),
      hierarchy: pairValue(standardPairs, "Hierarchy"),
      date: pairValue(standardPairs, "Tanggal Metadata")
    },
    distribution: {
      format: pairValue(distributionPairs, "Format"),
      license: pairValue(distributionPairs, "Lisensi"),
      access: pairValue(distributionPairs, "Akses"),
      constraints
    },
    contact: {
      organization: pairValue(contactPairs, "Organisasi"),
      name: pairValue(contactPairs, "Nama"),
      email: pairValue(contactPairs, "Email"),
      phone: pairValue(contactPairs, "Telepon"),
      role: pairValue(contactPairs, "Peran")
    },
    datasetDetailUrl: firstAnchor(
      anchors,
      anchor => /^\/katalog\/view\/[0-9a-f-]+\/?$/i.test(new URL(anchor.url).pathname)
    ),
    datasetDownloadUrl: firstAnchor(
      anchors,
      anchor => /^\/katalog\/[0-9a-f-]+\/download\/?$/i.test(new URL(anchor.url).pathname)
    ),
    xmlViewUrl: firstAnchor(
      anchors,
      anchor => /^\/metadata\/[0-9a-f-]+\/xml\/?$/i.test(new URL(anchor.url).pathname)
    ),
    xmlDownloadUrl: firstAnchor(
      anchors,
      anchor => /^\/metadata\/[0-9a-f-]+\/download\/?$/i.test(new URL(anchor.url).pathname)
    ),
    wmsCapabilitiesUrl: firstAnchor(
      anchors,
      anchor => /\/wms-proxy\/?$/i.test(new URL(anchor.url).pathname)
    ),
    wfsCapabilitiesUrl: firstAnchor(
      anchors,
      anchor => /\/wfs-proxy\/?$/i.test(new URL(anchor.url).pathname)
    )
  };
}

function xmlElementValues(xml, localName) {
  const escaped = localName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<(?:[\\w.-]+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escaped}>`,
    "gi"
  );
  const values = [];
  for (const match of String(xml || "").matchAll(pattern)) {
    const value = textOrNull(cleanHtml(
      match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    ));
    if (value && !values.includes(value)) values.push(value);
  }
  return values;
}

function xmlRestrictionCodes(xml, localName) {
  const escaped = localName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sections = new RegExp(
    `<(?:[\\w.-]+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escaped}>`,
    "gi"
  );
  const values = [];
  for (const section of String(xml || "").matchAll(sections)) {
    for (const code of section[1].matchAll(/codeListValue\s*=\s*["']([^"']+)["']/gi)) {
      const value = textOrNull(decodeHtmlEntities(code[1]));
      if (value && !values.includes(value)) values.push(value);
    }
    const textValue = textOrNull(cleanHtml(section[1]));
    if (textValue && !values.includes(textValue)) values.push(textValue);
  }
  return values;
}

export function parseIso19139MetadataXml(xml) {
  const source = String(xml || "");
  if (!/<(?:[\w.-]+:)?MD_Metadata\b/i.test(source)) {
    throw new Error("ISO metadata XML is missing MD_Metadata");
  }
  const useLimitations = xmlElementValues(source, "useLimitation");
  const otherConstraints = xmlElementValues(source, "otherConstraints");
  const accessConstraints = xmlRestrictionCodes(source, "accessConstraints");
  const useConstraints = xmlRestrictionCodes(source, "useConstraints");
  const all = [...new Set([
    ...useLimitations,
    ...otherConstraints,
    ...accessConstraints,
    ...useConstraints
  ])];
  return {
    constraints: {
      useLimitations,
      otherConstraints,
      accessConstraints,
      useConstraints,
      all
    }
  };
}

function normalizeCatalogRow(row, baseUrl) {
  const uuid = textOrNull(row?.uuid)?.toLowerCase() || null;
  if (!uuid || !UUID_PATTERN.test(uuid)) {
    throw new Error(`Catalog row has invalid dataset UUID: ${row?.uuid ?? "missing"}`);
  }
  const currentMetadata = row.current_metadata || {};
  const detailFromAction = urlFromActionHtml(
    row.action,
    baseUrl,
    /^\/katalog\/view\/[0-9a-f-]+\/?$/i
  );
  const detailUrl = detailFromAction || new URL(`/katalog/view/${uuid}`, baseUrl).href;
  return {
    canonicalId: uuid,
    sourceRecordId: integerOrNull(row.id),
    title: textOrNull(row.title) || uuid,
    normalizedTitle: normalizeTitle(row.title),
    description: textOrNull(decodeHtmlEntities(row.description)),
    datasetIdentifier: textOrNull(row.dataset_identifier),
    sourceUuid: textOrNull(row.source_uuid)?.toLowerCase() || null,
    publisher: textOrNull(row.publisher) || textOrNull(row.opd?.nama_opd),
    opd: row.opd ? {
      id: integerOrNull(row.opd.id),
      name: textOrNull(row.opd.nama_opd),
      active: row.opd.is_active === true
    } : null,
    theme: {
      id: integerOrNull(row.kugi_tema_id),
      code: textOrNull(row.kugi_tema?.kode),
      name: textOrNull(row.kugi_tema?.nama),
      subthemeId: integerOrNull(row.kugi_subtema_id),
      featureId: integerOrNull(row.kugi_unsur_id)
    },
    spatial: {
      type: textOrNull(row.type),
      format: textOrNull(row.spatial_format),
      fileSizeBytes: integerOrNull(row.file_size),
      geometryType: textOrNull(row.geom_type),
      srs: textOrNull(row.srs) || textOrNull(row.epsg_code),
      bbox: normalizeBbox(row.bbox),
      workspace: textOrNull(row.workspace),
      datastore: textOrNull(row.datastore),
      layerName: textOrNull(row.layer_name),
      storagePath: textOrNull(row.storage_path)
    },
    workflow: {
      status: textOrNull(row.workflow_status),
      verification: textOrNull(row.verification_status),
      validation: textOrNull(row.validation_status),
      publication: textOrNull(row.publish_status),
      publishError: textOrNull(row.publish_error)
    },
    dates: {
      dataYear: integerOrNull(row.data_year),
      dataDate: textOrNull(row.data_date),
      publishedAt: textOrNull(row.published_at),
      createdAt: textOrNull(row.created_at),
      updatedAt: textOrNull(row.updated_at)
    },
    updateFrequency: textOrNull(row.update_frequency),
    detailUrl: assertPortalInventoryUrl(detailUrl, baseUrl),
    catalogMetadata: {
      recordUuid: textOrNull(currentMetadata.uuid)?.toLowerCase() || null,
      fileIdentifier: textOrNull(currentMetadata.file_identifier)?.toLowerCase() || null,
      completeness: integerOrNull(currentMetadata.completeness),
      standardName: textOrNull(currentMetadata.metadata_standard_name),
      standardVersion: textOrNull(currentMetadata.metadata_standard_version),
      metadataDate: textOrNull(currentMetadata.metadata_date)
    }
  };
}

function normalizeMetadataRow(row, baseUrl) {
  const datasetUuid = textOrNull(row?.uuid)?.toLowerCase() || null;
  if (!datasetUuid || !UUID_PATTERN.test(datasetUuid)) {
    throw new Error(`Metadata catalog row has invalid dataset UUID: ${row?.uuid ?? "missing"}`);
  }
  const metadata = row.current_metadata || {};
  const detailUrl = urlFromActionHtml(
    row.action,
    baseUrl,
    /^\/metadata\/view\/[0-9a-f-]+\/?$/i
  );
  const publicIdentifier = uuidFromPath(detailUrl, "metadata/view") ||
    textOrNull(metadata.file_identifier)?.toLowerCase() || null;
  return {
    datasetUuid,
    sourceRecordId: integerOrNull(row.id),
    title: textOrNull(row.title) || textOrNull(metadata.identification?.title),
    normalizedTitle: normalizeTitle(row.title || metadata.identification?.title),
    description: textOrNull(decodeHtmlEntities(row.description)),
    datasetIdentifier: textOrNull(row.dataset_identifier),
    organization: textOrNull(row.organization) || textOrNull(row.publisher) ||
      textOrNull(row.opd?.nama_opd),
    completeness: integerOrNull(firstDefined(row.completeness, metadata.completeness)),
    publishedAt: textOrNull(row.published_at),
    recordUuid: textOrNull(metadata.uuid)?.toLowerCase() || null,
    fileIdentifier: textOrNull(metadata.file_identifier)?.toLowerCase() || null,
    publicIdentifier,
    detailUrl: detailUrl ? assertPortalInventoryUrl(detailUrl, baseUrl) : null,
    identification: metadata.identification ? {
      title: textOrNull(metadata.identification.title),
      abstract: textOrNull(metadata.identification.abstract),
      purpose: textOrNull(metadata.identification.purpose),
      topicCategory: textOrNull(metadata.identification.topic_category),
      keywords: metadata.identification.keywords ?? null,
      scale: firstDefined(metadata.identification.scale, null),
      status: textOrNull(metadata.identification.status),
      representationType: textOrNull(metadata.identification.spatial_representation_type),
      constraints: [
        textOrNull(metadata.identification.usage),
        textOrNull(metadata.identification.limitation)
      ].filter(Boolean)
    } : null
  };
}

function normalizeMapsetLayer(row, baseUrl) {
  const datasetUuid = textOrNull(firstDefined(row?.id, row?.uuid))?.toLowerCase() || null;
  if (!datasetUuid || !UUID_PATTERN.test(datasetUuid)) {
    throw new Error(`Mapset layer has invalid dataset UUID: ${row?.id ?? row?.uuid ?? "missing"}`);
  }
  const title = textOrNull(row.title);
  if (!title) throw new Error(`Mapset layer ${datasetUuid} is missing title`);
  const workspace = textOrNull(row.workspace);
  if (workspace !== "geoportal") {
    throw new Error(`Mapset layer ${datasetUuid} has unexpected workspace`);
  }
  const layerName = textOrNull(row.layer_name);
  if (!layerName || !/^zlayer_[a-z0-9]+$/.test(layerName)) {
    throw new Error(`Mapset layer ${datasetUuid} has invalid layer_name`);
  }
  const qualifiedName = textOrNull(row.qualified_name);
  if (qualifiedName !== `${workspace}:${layerName}`) {
    throw new Error(`Mapset layer ${datasetUuid} has inconsistent qualified_name`);
  }
  const geometryType = textOrNull(row.geom_type)?.toLowerCase() || null;
  if (!new Set(["multipoint", "multilinestring", "multipolygon"]).has(geometryType)) {
    throw new Error(`Mapset layer ${datasetUuid} has unexpected geom_type`);
  }
  const format = textOrNull(row.format);
  if (format !== "SHP") throw new Error(`Mapset layer ${datasetUuid} has unexpected format`);
  const publisher = textOrNull(
    typeof row.opd === "object" ? firstDefined(row.opd?.nama_opd, row.opd?.name) :
      firstDefined(row.opd, row.publisher)
  );
  const theme = textOrNull(
    typeof row.tema === "object" ? firstDefined(row.tema?.nama, row.tema?.name) :
      firstDefined(row.tema, row.theme)
  );
  if (!publisher || !theme) throw new Error(`Mapset layer ${datasetUuid} is missing publisher or theme`);
  const bbox = normalizeBbox(row.bbox);
  if (!bbox) throw new Error(`Mapset layer ${datasetUuid} has invalid bbox`);
  const wfsUrl = textOrNull(row.wfs_url);
  if (wfsUrl !== new URL("/wfs-proxy", baseUrl).href) {
    throw new Error(`Mapset layer ${datasetUuid} has unexpected wfs_url`);
  }
  return {
    datasetUuid,
    title,
    description: textOrNull(row.description),
    workspace,
    layerName,
    qualifiedName,
    geometryType,
    format,
    publisher,
    theme,
    bbox,
    wfsUrl
  };
}

export function normalizeMapsetPayload(payload, baseUrl) {
  if (!payload || "object" !== typeof payload || Array.isArray(payload) || !Array.isArray(payload.layers)) {
    throw new Error("Mapset payload is missing layers[]");
  }
  // The live portal currently reports `status: "ok"`; older fixtures and
  // deployments used the boolean `true`. Accept only those two explicit
  // success values so an absent, false, or otherwise malformed status still
  // fails closed before any geometry is fetched.
  if (payload.status !== true && payload.status !== "ok") {
    throw new Error("Mapset payload did not report an accepted success status");
  }
  const reportedTotal = integerOrNull(firstDefined(payload.total, payload.layers.length));
  if (reportedTotal === null || reportedTotal < 0 || reportedTotal !== payload.layers.length) {
    throw new Error(
      `Mapset total ${payload.total ?? "missing"} does not match ${payload.layers.length} layers`
    );
  }
  const layers = payload.layers.map(row => normalizeMapsetLayer(row, baseUrl));
  const seen = new Set(), seenQualifiedNames = new Set();
  for (const layer of layers) {
    if (seen.has(layer.datasetUuid)) {
      throw new Error(`Mapset contains duplicate dataset UUID ${layer.datasetUuid}`);
    }
    seen.add(layer.datasetUuid);
    if (seenQualifiedNames.has(layer.qualifiedName)) {
      throw new Error(`Mapset contains duplicate qualified_name ${layer.qualifiedName}`);
    }
    seenQualifiedNames.add(layer.qualifiedName);
  }
  return { reportedTotal, layers };
}

function groupBy(items, keyFunction) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFunction(item);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function reconcileMetadata(catalogRows, metadataRows) {
  const indexes = {
    datasetUuid: groupBy(metadataRows, item => item.datasetUuid),
    datasetIdentifier: groupBy(metadataRows, item => item.datasetIdentifier),
    title: groupBy(metadataRows, item => item.title),
    normalizedTitle: groupBy(metadataRows, item => item.normalizedTitle)
  };
  const matches = new Map();
  const selectedIdentifiers = new Set();
  for (const dataset of catalogRows) {
    const tiers = [
      ["dataset_uuid", indexes.datasetUuid.get(dataset.canonicalId) || []],
      ["dataset_identifier", indexes.datasetIdentifier.get(dataset.datasetIdentifier) || []],
      ["exact_title", indexes.title.get(dataset.title) || []],
      ["normalized_title", indexes.normalizedTitle.get(dataset.normalizedTitle) || []]
    ];
    const [matchedBy, candidates] = tiers.find(([, rows]) => rows.length > 0) || [null, []];
    const selected = candidates.length === 1 ? candidates[0] : null;
    if (selected) selectedIdentifiers.add(selected.publicIdentifier || selected.recordUuid || selected.datasetUuid);
    matches.set(dataset.canonicalId, {
      matchedBy,
      selected,
      candidates,
      conflicts: candidates.length > 1 ? [{
        type: "ambiguous_metadata_match",
        matchedBy,
        candidates: candidates.map(candidate => ({
          datasetUuid: candidate.datasetUuid,
          recordUuid: candidate.recordUuid,
          fileIdentifier: candidate.fileIdentifier,
          publicIdentifier: candidate.publicIdentifier,
          title: candidate.title
        }))
      }] : []
    });
  }
  const unmatched = metadataRows.filter(row =>
    !selectedIdentifiers.has(row.publicIdentifier || row.recordUuid || row.datasetUuid)
  );
  return { matches, unmatched };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 20) {
    throw new Error("concurrency must be an integer from 1 to 20");
  }
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function mergeDatasetEntry(
  dataset,
  metadataMatch,
  detailResult,
  metadataDetailResult,
  metadataXmlResult,
  mapsetLayer
) {
  const detail = detailResult?.value || null;
  const metadataDetail = metadataDetailResult?.value || null;
  const metadataXml = metadataXmlResult?.value || null;
  const selectedMetadata = metadataMatch.selected;
  const canonicalTitle = detail?.title || dataset.title;
  const canonicalDatasetIdentifier = detail?.datasetIdentifier || dataset.datasetIdentifier;
  const metadataTitle = metadataDetail?.title || selectedMetadata?.title || null;
  const metadataDatasetIdentifier = metadataDetail?.datasetIdentifier ||
    selectedMetadata?.datasetIdentifier || null;
  const metadataIdentifiers = {
    catalogRecordUuid: dataset.catalogMetadata.recordUuid,
    catalogFileIdentifier: dataset.catalogMetadata.fileIdentifier,
    datasetDetailIdentifier: detail?.embeddedMetadataIdentifier || null,
    directoryRecordUuid: selectedMetadata?.recordUuid || null,
    directoryFileIdentifier: selectedMetadata?.fileIdentifier || null,
    directoryPublicIdentifier: selectedMetadata?.publicIdentifier || null,
    metadataDetailIdentifier: metadataDetail?.metadataIdentifier || null
  };
  const publicRouteIdentifiers = [
    metadataIdentifiers.directoryPublicIdentifier,
    metadataIdentifiers.metadataDetailIdentifier
  ].filter(Boolean);
  const embeddedRouteIdentifier = metadataIdentifiers.datasetDetailIdentifier;
  const routeConflict = embeddedRouteIdentifier && publicRouteIdentifiers.length > 0 &&
    !publicRouteIdentifiers.includes(embeddedRouteIdentifier)
    ? {
        type: "metadata_route_identifier_mismatch",
        datasetDetailIdentifier: embeddedRouteIdentifier,
        verifiedPublicIdentifiers: [...new Set(publicRouteIdentifiers)],
        note: "The dataset detail may link a metadata record UUID while the metadata directory uses the current file identifier."
      }
    : null;
  const conflicts = [...metadataMatch.conflicts];
  if (routeConflict) conflicts.push(routeConflict);
  if (metadataTitle && normalizeTitle(metadataTitle) !== normalizeTitle(canonicalTitle)) {
    conflicts.push({
      type: "metadata_title_mismatch",
      datasetTitle: canonicalTitle,
      metadataTitle
    });
  }
  if (
    metadataDatasetIdentifier && canonicalDatasetIdentifier &&
    metadataDatasetIdentifier !== canonicalDatasetIdentifier
  ) {
    conflicts.push({
      type: "metadata_dataset_identifier_mismatch",
      datasetIdentifier: canonicalDatasetIdentifier,
      metadataDatasetIdentifier
    });
  }

  const bbox = detail?.bbox || metadataDetail?.bbox || dataset.spatial.bbox;
  const detailDownloadUrl = detail?.downloadUrl || metadataDetail?.datasetDownloadUrl || null;
  const inferredDownloadUrl = new URL(
    `/katalog/${dataset.canonicalId}/download`,
    new URL(dataset.detailUrl).origin
  ).href;
  const metadataDistribution = metadataDetail?.distribution || {
    format: null,
    license: null,
    access: null,
    constraints: selectedMetadata?.identification?.constraints || []
  };
  metadataDistribution.constraints = [...new Set([
    ...(metadataDistribution.constraints || []),
    ...(selectedMetadata?.identification?.constraints || []),
    ...(metadataXml?.constraints?.all || [])
  ])];
  const mapsetLayerNameMatches = Boolean(
    mapsetLayer && mapsetLayer.layerName === (detail?.layerName || dataset.spatial.layerName)
  );
  return {
    id: dataset.canonicalId,
    datasetUuid: dataset.canonicalId,
    sourceRecordId: dataset.sourceRecordId,
    title: canonicalTitle,
    normalizedTitle: dataset.normalizedTitle,
    description: detail?.description || selectedMetadata?.identification?.abstract || dataset.description,
    identifiers: {
      datasetIdentifier: canonicalDatasetIdentifier,
      sourceUuid: dataset.sourceUuid
    },
    publisher: detail?.publisher || metadataDetail?.contact?.organization || dataset.publisher,
    opd: dataset.opd,
    theme: {
      ...dataset.theme,
      name: detail?.theme || dataset.theme.name,
      topicCategory: metadataDetail?.topicCategory || selectedMetadata?.identification?.topicCategory || null,
      keywords: metadataDetail?.keywords || []
    },
    spatial: {
      ...dataset.spatial,
      format: detail?.spatialFormat || dataset.spatial.format,
      geometryType: detail?.geometryType || dataset.spatial.geometryType,
      srs: detail?.srs || metadataDetail?.srs || dataset.spatial.srs,
      bbox,
      workspace: detail?.workspace || dataset.spatial.workspace,
      layerName: detail?.layerName || dataset.spatial.layerName,
      serviceTypes: detail?.serviceTypes || [],
      attributeSummary: detail?.attributeSummary || { recordCount: null, fields: [] }
    },
    dates: {
      ...dataset.dates,
      dataYear: detail?.dataYear || dataset.dates.dataYear
    },
    updateFrequency: detail?.updateFrequency || metadataDetail?.updateFrequency || dataset.updateFrequency,
    workflow: dataset.workflow,
    publicMapset: mapsetLayer ? {
      present: true,
      layerNameMatches: mapsetLayerNameMatches,
      workspace: mapsetLayer.workspace,
      layerName: mapsetLayer.layerName,
      qualifiedName: mapsetLayer.qualifiedName,
      geometryType: mapsetLayer.geometryType,
      bbox: mapsetLayer.bbox
    } : {
      present: false,
      layerNameMatches: false,
      workspace: null,
      layerName: null,
      qualifiedName: null,
      geometryType: null,
      bbox: null
    },
    metadata: {
      matchedBy: metadataMatch.matchedBy,
      identifiers: metadataIdentifiers,
      completeness: metadataDetail?.completeness ?? selectedMetadata?.completeness ??
        dataset.catalogMetadata.completeness,
      datasetIdentifier: metadataDatasetIdentifier,
      detailUrl: selectedMetadata?.detailUrl || null,
      title: metadataTitle,
      abstract: metadataDetail?.abstract || selectedMetadata?.identification?.abstract || null,
      purpose: metadataDetail?.purpose || selectedMetadata?.identification?.purpose || null,
      standard: metadataDetail?.standard || {
        name: dataset.catalogMetadata.standardName,
        version: dataset.catalogMetadata.standardVersion,
        date: dataset.catalogMetadata.metadataDate
      },
      distribution: metadataDistribution,
      iso19139: metadataXml,
      contact: metadataDetail?.contact || null,
      xmlViewUrl: metadataDetail?.xmlViewUrl || null,
      xmlDownloadUrl: metadataDetail?.xmlDownloadUrl || null,
      conflicts
    },
    access: {
      detailUrl: dataset.detailUrl,
      downloadUrl: detailDownloadUrl || inferredDownloadUrl,
      downloadUrlSource: detailDownloadUrl ? "detail_page" : "catalog_route_pattern",
      wmsCapabilitiesUrl: metadataDetail?.wmsCapabilitiesUrl || null,
      wfsCapabilitiesUrl: metadataDetail?.wfsCapabilitiesUrl || null
    },
    extraction: {
      datasetDetail: detailResult?.error ? { status: "error", error: detailResult.error } : { status: "ok" },
      metadataDetail: !selectedMetadata
        ? { status: "unmatched" }
        : metadataDetailResult?.error
          ? { status: "error", error: metadataDetailResult.error }
          : { status: "ok" },
      metadataXml: !selectedMetadata
        ? { status: "unmatched" }
        : metadataXmlResult?.error
          ? { status: "error", error: metadataXmlResult.error }
          : { status: "ok" }
    }
  };
}

function safeSlug(value) {
  const slug = String(value || "dataset")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "dataset";
}

export function reviewedMetadataTitleConflict(dataset) {
  const expected = REVIEWED_METADATA_TITLE_CONFLICTS.get(dataset?.datasetUuid);
  if (!expected) return null;
  const conflicts = Array.isArray(dataset?.metadata?.conflicts)
    ? dataset.metadata.conflicts
    : [];
  const allowedConflictTypes = new Set([
    "metadata_route_identifier_mismatch",
    "metadata_title_mismatch"
  ]);
  const titleConflicts = conflicts.filter(conflict =>
    conflict?.type === "metadata_title_mismatch"
  );
  const exactTitleConflict = titleConflicts.length === 1 &&
    titleConflicts[0].datasetTitle === expected.datasetTitle &&
    titleConflicts[0].metadataTitle === expected.metadataTitle;
  const extractionOk = ["datasetDetail", "metadataDetail", "metadataXml"].every(name =>
    dataset?.extraction?.[name]?.status === "ok"
  );
  const exactIdentity =
    dataset.title === expected.datasetTitle &&
    dataset.metadata?.title === expected.metadataTitle &&
    dataset.identifiers?.datasetIdentifier === expected.datasetIdentifier &&
    dataset.metadata?.datasetIdentifier === expected.datasetIdentifier &&
    dataset.metadata?.matchedBy === "dataset_uuid" &&
    dataset.spatial?.layerName === expected.layerName &&
    dataset.publicMapset?.present === true &&
    dataset.publicMapset?.layerNameMatches === true &&
    dataset.publicMapset?.layerName === expected.layerName &&
    dataset.publicMapset?.qualifiedName === `geoportal:${expected.layerName}` &&
    Number(dataset.dates?.dataYear) === expected.dataYear;
  const exactAccess =
    String(dataset.metadata?.distribution?.license || "").trim().toLowerCase() === "open data" &&
    String(dataset.metadata?.distribution?.access || "").trim().toLowerCase() === "public" &&
    String(dataset.workflow?.status || "").trim().toLowerCase() === "published" &&
    String(dataset.workflow?.publication || "").trim().toLowerCase() === "success";
  if (
    !exactTitleConflict || !exactIdentity || !exactAccess || !extractionOk ||
    conflicts.some(conflict => !allowedConflictTypes.has(conflict?.type))
  ) {
    return null;
  }
  return {
    code: "reviewed_metadata_title_conflict",
    datasetTitle: expected.datasetTitle,
    metadataTitle: expected.metadataTitle,
    datasetIdentifier: expected.datasetIdentifier,
    layerName: expected.layerName,
    dataYear: expected.dataYear,
    temporalStatus: expected.temporalStatus,
    note: expected.note
  };
}

export function buildDownloadPlan(manifest) {
  const items = manifest.datasets.map(dataset => {
    const license = dataset.metadata.distribution?.license || null;
    const access = dataset.metadata.distribution?.access || null;
    const constraints = dataset.metadata.distribution?.constraints || [];
    const detailOk = dataset.extraction.datasetDetail.status === "ok";
    const metadataOk = dataset.extraction.metadataDetail.status === "ok";
    const metadataXmlOk = dataset.extraction.metadataXml.status === "ok";
    const blockers = [];
    if (!dataset.access.downloadUrl) blockers.push("missing_download_url");
    if (!detailOk) blockers.push("dataset_detail_not_verified");
    if (!metadataOk) blockers.push("metadata_detail_not_verified");
    if (!metadataXmlOk) blockers.push("metadata_constraints_not_verified");
    if (!dataset.publicMapset.present) blockers.push("not_in_public_mapset");
    else if (!dataset.publicMapset.layerNameMatches) blockers.push("mapset_layer_name_mismatch");
    if (String(dataset.workflow.status || "").toLowerCase() !== "published") {
      blockers.push("catalog_workflow_not_published");
    }
    if (String(dataset.workflow.publication || "").toLowerCase() !== "success") {
      blockers.push("catalog_publish_not_success");
    }
    if (access && access.toLowerCase() !== "public") blockers.push("access_not_public");
    if (!license) blockers.push("license_not_verified");
    const restrictionText = [license, ...constraints].filter(Boolean).join(" ");
    if (/\b(?:data\s+terbatas|terbatas|restricted|confidential|rahasia)\b/i.test(restrictionText)) {
      blockers.push("restricted_license_or_constraints");
    }
    const reviewedTitleConflict = reviewedMetadataTitleConflict(dataset);
    if (dataset.metadata.conflicts.some(conflict => [
      "ambiguous_metadata_match",
      "metadata_title_mismatch",
      "metadata_dataset_identifier_mismatch"
    ].includes(conflict.type)) && !reviewedTitleConflict) {
      blockers.push("metadata_identity_conflict");
    }
    const baseKey = `internal/riau-geoportal/source/${dataset.datasetUuid}`;
    return {
      id: dataset.datasetUuid,
      datasetUuid: dataset.datasetUuid,
      title: dataset.title,
      status: blockers.length === 0 ? "ready" : "review_required",
      blockers,
      reviewedMetadataTitleConflict: reviewedTitleConflict,
      source: {
        url: dataset.access.downloadUrl,
        method: "GET",
        expectedFormat: "GeoJSON",
        catalogSpatialFormat: dataset.spatial.format,
        catalogReportedFileSizeBytes: dataset.spatial.fileSizeBytes,
        expectedBytes: null,
        license,
        access,
        constraints,
        note: "The public download route returns a generated GeoJSON attachment even when the catalog spatial format is SHP."
      },
      destination: {
        r2Key: `${baseKey}/${safeSlug(dataset.title)}.geojson`,
        metadataR2Key: `${baseKey}/metadata.xml`
      },
      metadataResource: dataset.metadata.xmlDownloadUrl ? {
        url: dataset.metadata.xmlDownloadUrl,
        method: "GET",
        expectedFormat: "ISO 19139 XML"
      } : null,
      validation: {
        expectedDatasetUuid: dataset.datasetUuid,
        expectedSrs: dataset.spatial.srs,
        expectedGeometryType: dataset.spatial.geometryType,
        expectedBbox: dataset.spatial.bbox,
        checks: [
          "same-origin redirect chain",
          "download size limit",
          "valid JSON and GeoJSON FeatureCollection",
          "feature inventory and geometry readable",
          "CRS and bounds",
          "SHA-256 after download"
        ]
      }
    };
  });
  return {
    schemaVersion: RIAU_GEOPORTAL_SCHEMA_VERSION,
    generatedAt: manifest.generatedAt,
    sourceManifest: manifest.id,
    mode: "plan_only_no_download",
    notice: "This plan does not fetch dataset or metadata download URLs.",
    totals: {
      datasets: items.length,
      ready: items.filter(item => item.status === "ready").length,
      reviewRequired: items.filter(item => item.status === "review_required").length,
      expectedBytes: null,
      catalogReportedBytes: items.reduce(
        (total, item) => total + (item.source.catalogReportedFileSizeBytes || 0),
        0
      )
    },
    items
  };
}

export async function inventoryRiauGeoportal({
  baseUrl = DEFAULT_RIAU_GEOPORTAL_URL,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  pageSize = 250,
  concurrency = 2,
  fetchDetails = true,
  runMode = "inventory"
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl must be a function");
  const portalBase = new URL(baseUrl);
  portalBase.pathname = "/";
  portalBase.search = "";
  portalBase.hash = "";
  const normalizedBaseUrl = portalBase.href.replace(/\/$/, "");
  const catalogLandingUrl = new URL("/katalog", normalizedBaseUrl).href;
  const metadataLandingUrl = new URL("/metadata", normalizedBaseUrl).href;
  const mapsetEndpoint = new URL("/mapset/layers", normalizedBaseUrl).href;
  const [catalogHtml, metadataHtml] = await Promise.all([
    fetchText(fetchImpl, catalogLandingUrl, normalizedBaseUrl),
    fetchText(fetchImpl, metadataLandingUrl, normalizedBaseUrl)
  ]);
  const catalogEndpoint = discoverDataTableEndpoint(catalogHtml, {
    baseUrl: normalizedBaseUrl,
    tableId: "katalog-table"
  });
  const metadataEndpoint = discoverDataTableEndpoint(metadataHtml, {
    baseUrl: normalizedBaseUrl,
    tableId: "metaTable"
  });
  const [catalogTable, metadataTable, mapsetPayload] = await Promise.all([
    fetchDataTableAll({
      endpoint: catalogEndpoint,
      baseUrl: normalizedBaseUrl,
      fetchImpl,
      pageSize
    }),
    fetchDataTableAll({
      endpoint: metadataEndpoint,
      baseUrl: normalizedBaseUrl,
      fetchImpl,
      pageSize
    }),
    fetchJson(fetchImpl, mapsetEndpoint, normalizedBaseUrl)
  ]);
  const mapset = normalizeMapsetPayload(mapsetPayload, normalizedBaseUrl);
  const mapsetByDatasetUuid = new Map(
    mapset.layers.map(layer => [layer.datasetUuid, layer])
  );
  const warnings = [];
  const catalogRows = [];
  const seenDatasetUuids = new Map();
  for (const row of catalogTable.rows) {
    const normalized = normalizeCatalogRow(row, normalizedBaseUrl);
    const earlier = seenDatasetUuids.get(normalized.canonicalId);
    if (earlier) {
      warnings.push({
        type: "duplicate_dataset_uuid",
        datasetUuid: normalized.canonicalId,
        sourceRecordIds: [earlier.sourceRecordId, normalized.sourceRecordId]
      });
      continue;
    }
    seenDatasetUuids.set(normalized.canonicalId, normalized);
    catalogRows.push(normalized);
  }
  const catalogRowUuidSet = new Set(catalogRows.map(dataset => dataset.canonicalId));
  const mapsetUuidSet = new Set(mapset.layers.map(layer => layer.datasetUuid));
  const missingFromMapset = [...catalogRowUuidSet].filter(uuid => !mapsetUuidSet.has(uuid));
  const extraInMapset = [...mapsetUuidSet].filter(uuid => !catalogRowUuidSet.has(uuid));
  if (missingFromMapset.length || extraInMapset.length) {
    throw new Error(
      `Mapset UUID set differs from catalog (missing=${missingFromMapset.length}, extra=${extraInMapset.length})`
    );
  }
  const metadataRows = metadataTable.rows.map(row => normalizeMetadataRow(row, normalizedBaseUrl));
  const reconciliation = reconcileMetadata(catalogRows, metadataRows);
  const detailResults = new Map();
  const metadataDetailResults = new Map();
  const metadataXmlResults = new Map();
  if (fetchDetails) {
    const jobs = [];
    for (const dataset of catalogRows) {
      jobs.push({ kind: "dataset", datasetUuid: dataset.canonicalId, url: dataset.detailUrl });
      const match = reconciliation.matches.get(dataset.canonicalId);
      if (match?.selected?.detailUrl) {
        jobs.push({
          kind: "metadata",
          datasetUuid: dataset.canonicalId,
          url: match.selected.detailUrl
        });
        jobs.push({
          kind: "metadata_xml",
          datasetUuid: dataset.canonicalId,
          url: new URL(`/metadata/${dataset.canonicalId}/xml`, normalizedBaseUrl).href
        });
      }
    }
    const results = await mapWithConcurrency(jobs, concurrency, async job => {
      try {
        const html = await fetchText(fetchImpl, job.url, normalizedBaseUrl);
        const value = job.kind === "dataset"
          ? parseDatasetDetailHtml(html, { detailUrl: job.url, baseUrl: normalizedBaseUrl })
          : job.kind === "metadata"
            ? parseMetadataDetailHtml(html, { detailUrl: job.url, baseUrl: normalizedBaseUrl })
            : parseIso19139MetadataXml(html);
        return { ...job, value };
      } catch (error) {
        return { ...job, error: error.message };
      }
    });
    for (const result of results) {
      if (result.kind === "dataset") detailResults.set(result.datasetUuid, result);
      else if (result.kind === "metadata") metadataDetailResults.set(result.datasetUuid, result);
      else metadataXmlResults.set(result.datasetUuid, result);
      if (result.error) {
        warnings.push({
          type: `${result.kind}_detail_fetch_failed`,
          datasetUuid: result.datasetUuid,
          url: result.url,
          error: result.error
        });
      }
    }
  }
  const datasets = catalogRows
    .map(dataset => mergeDatasetEntry(
      dataset,
      reconciliation.matches.get(dataset.canonicalId),
      detailResults.get(dataset.canonicalId) || {
        error: fetchDetails ? "Dataset detail was not fetched" : "Detail fetching disabled"
      },
      metadataDetailResults.get(dataset.canonicalId) || {
        error: fetchDetails ? "Metadata detail was not fetched" : "Detail fetching disabled"
      },
      metadataXmlResults.get(dataset.canonicalId) || {
        error: fetchDetails ? "Metadata XML was not fetched" : "Detail fetching disabled"
      },
      mapsetByDatasetUuid.get(dataset.canonicalId) || null
    ))
    .sort((left, right) => left.datasetUuid.localeCompare(right.datasetUuid));
  const catalogUuidSet = new Set(datasets.map(dataset => dataset.datasetUuid));
  const unmatchedMapset = mapset.layers.filter(layer => !catalogUuidSet.has(layer.datasetUuid));
  const generatedAt = now().toISOString();
  const manifest = {
    schemaVersion: RIAU_GEOPORTAL_SCHEMA_VERSION,
    id: `riau-geoportal-${generatedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}`,
    generatedAt,
    mode: runMode,
    scope: "All datasets exposed by the public Geoportal Riau catalog at inventory time",
    source: {
      name: "Geoportal Provinsi Riau",
      baseUrl: normalizedBaseUrl,
      catalogPage: catalogLandingUrl,
      catalogEndpoint,
      metadataPage: metadataLandingUrl,
      metadataEndpoint,
      mapsetEndpoint
    },
    safety: {
      downloadedDatasetFiles: false,
      fetchedResources: [
        "catalog HTML",
        "metadata HTML",
        "DataTables JSON",
        "public mapset JSON",
        "public detail HTML",
        "ISO 19139 XML view"
      ],
      canonicalDatasetKey: "datasetUuid",
      geometryAllowlist: "Exact dataset UUID and layer_name match in /mapset/layers"
    },
    totals: {
      catalogRecordsReported: catalogTable.recordsTotal,
      catalogRowsReceived: catalogTable.rows.length,
      uniqueDatasets: datasets.length,
      metadataRecordsReported: metadataTable.recordsTotal,
      metadataRowsReceived: metadataRows.length,
      mapsetLayersReported: mapset.reportedTotal,
      mapsetLayersReceived: mapset.layers.length,
      mapsetMatchedDatasets: datasets.filter(dataset =>
        dataset.publicMapset.present && dataset.publicMapset.layerNameMatches
      ).length,
      catalogMissingFromMapset: datasets.filter(dataset => !dataset.publicMapset.present).length,
      mapsetLayerNameMismatches: datasets.filter(dataset =>
        dataset.publicMapset.present && !dataset.publicMapset.layerNameMatches
      ).length,
      mapsetWithoutCatalog: unmatchedMapset.length,
      duplicateDatasetUuidRows: warnings.filter(warning => warning.type === "duplicate_dataset_uuid").length,
      datasetDetailsOk: datasets.filter(dataset => dataset.extraction.datasetDetail.status === "ok").length,
      metadataDetailsOk: datasets.filter(dataset => dataset.extraction.metadataDetail.status === "ok").length,
      metadataXmlOk: datasets.filter(dataset => dataset.extraction.metadataXml.status === "ok").length,
      metadataRouteConflicts: datasets.filter(dataset =>
        dataset.metadata.conflicts.some(conflict => conflict.type === "metadata_route_identifier_mismatch")
      ).length,
      metadataContentConflicts: datasets.filter(dataset =>
        dataset.metadata.conflicts.some(conflict => [
          "metadata_title_mismatch",
          "metadata_dataset_identifier_mismatch"
        ].includes(conflict.type))
      ).length,
      unmatchedMetadataRecords: reconciliation.unmatched.length
    },
    warnings,
    unmatchedMetadata: reconciliation.unmatched.map(row => ({
      datasetUuid: row.datasetUuid,
      datasetIdentifier: row.datasetIdentifier,
      recordUuid: row.recordUuid,
      fileIdentifier: row.fileIdentifier,
      publicIdentifier: row.publicIdentifier,
      title: row.title,
      detailUrl: row.detailUrl
    })),
    unmatchedMapset: unmatchedMapset.map(layer => ({
      datasetUuid: layer.datasetUuid,
      title: layer.title,
      workspace: layer.workspace,
      layerName: layer.layerName,
      qualifiedName: layer.qualifiedName
    })),
    datasets
  };
  return { manifest, downloadPlan: buildDownloadPlan(manifest) };
}

async function readFixtureJson(fixturesDir, filename) {
  const filePath = path.join(fixturesDir, filename);
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function fixtureResponse(body, { status = 200, contentType = "text/plain" } = {}) {
  if (typeof Response === "function") {
    return new Response(body, { status, headers: { "content-type": contentType } });
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return String(body); },
    async json() { return JSON.parse(String(body)); }
  };
}

export function createFixtureFetch(fixturesDir, { baseUrl = DEFAULT_RIAU_GEOPORTAL_URL } = {}) {
  const root = path.resolve(fixturesDir);
  const origin = new URL(baseUrl).origin;
  return async function fixtureFetch(input) {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.origin !== origin) {
      return fixtureResponse("Cross-origin fixture request refused", { status: 403 });
    }
    try {
      if (url.pathname === "/katalog") {
        return fixtureResponse(await fs.readFile(path.join(root, "katalog.html"), "utf8"), {
          contentType: "text/html"
        });
      }
      if (url.pathname === "/metadata") {
        return fixtureResponse(await fs.readFile(path.join(root, "metadata.html"), "utf8"), {
          contentType: "text/html"
        });
      }
      if (url.pathname === "/mapset/layers") {
        return fixtureResponse(
          JSON.stringify(await readFixtureJson(root, "mapset.json")),
          { contentType: "application/json" }
        );
      }
      if (url.pathname === "/katalog/datatable" || url.pathname === "/metadata/datatable") {
        const filename = url.pathname.startsWith("/katalog") ? "catalog.json" : "metadata.json";
        const payload = await readFixtureJson(root, filename);
        const allRows = Array.isArray(payload) ? payload : payload.data;
        if (!Array.isArray(allRows)) throw new Error(`${filename} must contain data[] or an array`);
        const start = Math.max(0, integerOrNull(url.searchParams.get("start")) || 0);
        const length = Math.max(1, integerOrNull(url.searchParams.get("length")) || allRows.length || 1);
        const responsePayload = {
          ...(Array.isArray(payload) ? {} : payload),
          draw: integerOrNull(url.searchParams.get("draw")) || 1,
          recordsTotal: payload.recordsTotal ?? allRows.length,
          recordsFiltered: payload.recordsFiltered ?? payload.recordsTotal ?? allRows.length,
          data: allRows.slice(start, start + length)
        };
        return fixtureResponse(JSON.stringify(responsePayload), { contentType: "application/json" });
      }
      let match = url.pathname.match(/^\/katalog\/view\/([0-9a-f-]+)\/?$/i);
      if (match) {
        return fixtureResponse(
          await fs.readFile(path.join(root, "catalog-details", `${match[1].toLowerCase()}.html`), "utf8"),
          { contentType: "text/html" }
        );
      }
      match = url.pathname.match(/^\/metadata\/view\/([0-9a-f-]+)\/?$/i);
      if (match) {
        return fixtureResponse(
          await fs.readFile(path.join(root, "metadata-details", `${match[1].toLowerCase()}.html`), "utf8"),
          { contentType: "text/html" }
        );
      }
      match = url.pathname.match(/^\/metadata\/([0-9a-f-]+)\/xml\/?$/i);
      if (match) {
        return fixtureResponse(
          await fs.readFile(path.join(root, "metadata-xml", `${match[1].toLowerCase()}.xml`), "utf8"),
          { contentType: "application/xml" }
        );
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      return fixtureResponse(`Missing fixture for ${url.pathname}`, { status: 404 });
    }
    return fixtureResponse(`No fixture route for ${url.pathname}`, { status: 404 });
  };
}

function parseCliArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--no-details") options.fetchDetails = false;
    else if (argument.startsWith("--")) {
      const [name, inlineValue] = argument.slice(2).split("=", 2);
      const value = inlineValue ?? argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
      options[name] = value;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

async function runCli(argv) {
  const options = parseCliArguments(argv);
  if (!options.output || !options.plan) {
    throw new Error(
      "Usage: node scripts/riau-geoportal-ingest.mjs --output <catalog.json> " +
      "--plan <download-plan.json> [--fixtures <dir>] [--dry-run] " +
      "[--base-url <url>] [--page-size <n>] [--concurrency <n>] [--no-details]"
    );
  }
  const baseUrl = options["base-url"] || DEFAULT_RIAU_GEOPORTAL_URL;
  const fetchImpl = options.fixtures
    ? createFixtureFetch(options.fixtures, { baseUrl })
    : globalThis.fetch;
  const result = await inventoryRiauGeoportal({
    baseUrl,
    fetchImpl,
    pageSize: options["page-size"] ? Number(options["page-size"]) : 250,
    concurrency: options.concurrency ? Number(options.concurrency) : 2,
    fetchDetails: options.fetchDetails !== false,
    runMode: options.fixtures ? "fixture_dry_run" : options.dryRun ? "remote_dry_run" : "inventory"
  });
  await fs.mkdir(path.dirname(path.resolve(options.output)), { recursive: true });
  await fs.mkdir(path.dirname(path.resolve(options.plan)), { recursive: true });
  await fs.writeFile(options.output, JSON.stringify(result.manifest, null, 2) + "\n");
  await fs.writeFile(options.plan, JSON.stringify(result.downloadPlan, null, 2) + "\n");
  console.log(JSON.stringify({
    ok: true,
    manifest: path.resolve(options.output),
    plan: path.resolve(options.plan),
    totals: result.manifest.totals,
    downloadPlan: result.downloadPlan.totals
  }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  runCli(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
