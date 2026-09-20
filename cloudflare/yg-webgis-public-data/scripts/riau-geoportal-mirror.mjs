import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createGzip } from "node:zlib";

export const MIRROR_SCHEMA_VERSION = 1;
export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024 * 1024;
export const DEFAULT_METADATA_MAX_BYTES = 16 * 1024 * 1024;
export const DEFAULT_DISPLAY_SOURCE_MAX_BYTES = DEFAULT_MAX_BYTES;
export const DEFAULT_DISPLAY_MAX_BYTES = 12 * 1024 * 1024;
export const DEFAULT_DISPLAY_MAX_FEATURES = 25_000;
export const DEFAULT_EXPECTED_DATASETS = 60;
export const DEFAULT_WFS_PAGE_SIZE = 500;
export const WFS_PAGE_MAX_BYTES = 256 * 1024 * 1024;
export const OGR_GEOJSON_MAX_OBJ_SIZE_MB = 512;
export const DEFAULT_SOURCE_COMPRESSION_THRESHOLD_BYTES = 250 * 1024 * 1024;
export const R2_SINGLE_UPLOAD_SAFE_MAX_BYTES = 290 * 1024 * 1024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const R2_PREFIX = "internal/riau-geoportal";
const MAPSHAPER_CLI = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../node_modules/mapshaper/bin/mapshaper"
);

// This record has conflicting public/restricted metadata. It remains visible in
// the staff catalog, but automation must never fetch its geometry without a
// separate human review.
export const FORCED_REVIEW_DATASETS = new Map([
  [
    "4982b10e-05d1-4495-9c84-b144d968163d",
    {
      code: "known_ambiguous_restricted_metadata",
      message:
        "Metadata for this dataset is ambiguous and includes Data Terbatas; geometry is metadata-only pending review."
    }
  ]
]);

// Raw source files are preserved byte-for-byte. Derived display geometry is
// quarantined for these upstream coordinate anomalies so it cannot be mistaken
// for analysis-ready data.
export const KNOWN_GEOMETRY_ANOMALIES = new Map([
  [
    "fed43cd7-01ca-4b03-a467-a8a162a459e4",
    {
      code: "known_coordinate_anomaly",
      title: "SEBARANBANTUANKELOMPOKSARPRAS_PT_2026_250K",
      detail: "Four point longitudes contain 2023/2024 values, consistent with shifted columns."
    }
  ],
  [
    "2ab6a020-e02f-473f-9b76-a810b33ac827",
    {
      code: "known_coordinate_anomaly",
      title: "RUMAHSAKITRIAU_PT_2026_50K",
      detail: "One geometry longitude is 108.49191 while its x attribute is 101.49191."
    }
  ],
  [
    "d32db657-7662-4e67-bd73-e686cd6c015d",
    {
      code: "known_coordinate_anomaly",
      title: "LOKASIPLTSRIAU_PT_2026_250K",
      detail: "One point longitude is 127.23, outside the expected Riau extent."
    }
  ]
]);

// A display derivative is allowed to be more generalized than the immutable
// raw source. These profiles keep unusually detailed official layers usable in
// a browser while preserving the original geometry separately for analysis.
export const DISPLAY_PROFILES = new Map([
  [
    "208e230f-1cc5-4b52-85a4-52fc494af4e2",
    { engine: "mapshaper", retainedPercentage: 5, label: "mapshaper_5_percent" }
  ],
  [
    "65c24420-a091-4dd5-a6e5-3936b0d82ac4",
    { engine: "mapshaper", retainedPercentage: 1, label: "mapshaper_1_percent" }
  ],
  [
    "f71d9e6b-0f04-4de6-a850-3c8f5e92976d",
    {
      engine: "mapshaper",
      retainedPercentage: 5,
      dissolveField: "dn",
      allowFeatureCountReduction: true,
      label: "dissolved_by_flood_class"
    }
  ]
]);

const execFile = promisify(execFileCallback);

function gdalExecOptions() {
  return {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      OGR_GEOJSON_MAX_OBJ_SIZE: String(OGR_GEOJSON_MAX_OBJ_SIZE_MB)
    }
  };
}

function asPositiveInteger(value, label, { allowZero = false } = {}) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < (allowZero ? 0 : 1)) {
    throw new Error(`${label} must be ${allowZero ? "a non-negative" : "a positive"} integer`);
  }
  return parsed;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function sanitizeDiagnosticMessage(value, maxLength = 512) {
  const limit = asPositiveInteger(maxLength, "diagnostic maxLength");
  const redacted = String(value || "diagnostic_unavailable")
    .replace(/\b[a-z][a-z0-9+.-]*:[^\s<>"'`]+/gi, rawValue => {
      const trailing = rawValue.match(/[),.;!?]+$/)?.[0] || "";
      const candidate = trailing ? rawValue.slice(0, -trailing.length) : rawValue;
      try {
        const url = new URL(candidate);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return `${url.protocol}[redacted]${trailing}`;
        }
        url.username = "";
        url.password = "";
        url.search = "";
        url.hash = "";
        return `${url.href}${trailing}`;
      } catch {
        return `[redacted-url]${trailing}`;
      }
    })
    .replace(/\s+/g, " ")
    .trim();
  if (redacted.length <= limit) return redacted || "diagnostic_unavailable";
  if (limit <= 3) return ".".repeat(limit);
  return `${redacted.slice(0, limit - 3)}...`;
}

function normalizeText(value) {
  return String(value || "").trim().toLocaleLowerCase("id-ID");
}

function isOpenLicense(value) {
  const license = normalizeText(value);
  if (!license || license.includes("terbatas") || license.includes("restricted")) return false;
  return license.includes("terbuka") || license.includes("open") || license.includes("cc-");
}

function safeUuid(value, label = "dataset UUID") {
  const uuid = String(value || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(uuid)) throw new Error(`Invalid ${label}: ${value ?? "missing"}`);
  return uuid;
}

function cleanReleaseId(value) {
  const cleaned = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  if (!cleaned) throw new Error("Could not derive a release ID");
  return cleaned;
}

function toR2ObjectPath(outputDir, key) {
  if (!key.startsWith(`${R2_PREFIX}/`) || key.includes("\\")) {
    throw new Error(`Unsafe R2 object key: ${key}`);
  }
  const segments = key.split("/");
  if (segments.some(segment => !segment || segment === "." || segment === "..")) {
    throw new Error(`Unsafe R2 object key: ${key}`);
  }
  const root = path.resolve(outputDir, "objects");
  const destination = path.resolve(root, ...segments);
  if (!destination.startsWith(`${root}${path.sep}`)) {
    throw new Error(`R2 object escaped output root: ${key}`);
  }
  return destination;
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  await fs.rename(temporary, filePath);
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(filePath)) {
    bytes += chunk.length;
    hash.update(chunk);
  }
  return { sha256: hash.digest("hex"), bytes };
}

async function gzipFile(sourcePath, destinationPath) {
  await fs.rm(destinationPath, { force: true });
  await pipeline(
    createReadStream(sourcePath),
    createGzip({ level: 9, mtime: 0 }),
    createWriteStream(destinationPath, { flags: "wx" })
  );
  return hashFile(destinationPath);
}

function expectedDownloadPath(datasetUuid) {
  return `/katalog/${datasetUuid}/download`;
}

export function assertSafeDownloadUrl(candidate, { baseUrl, datasetUuid } = {}) {
  const uuid = safeUuid(datasetUuid);
  const base = new URL(baseUrl);
  const url = new URL(candidate, base);
  if (base.protocol !== "https:" || url.protocol !== "https:") {
    throw new Error(`Only HTTPS Geoportal downloads are allowed: ${url.href}`);
  }
  if (url.origin !== base.origin) {
    throw new Error(`Cross-origin Geoportal download refused: ${url.href}`);
  }
  if (url.username || url.password || url.hash) {
    throw new Error(`Credentials and fragments are not allowed in download URLs: ${url.href}`);
  }
  if (url.pathname.replace(/\/+$/, "") !== expectedDownloadPath(uuid)) {
    throw new Error(`Download path does not match dataset ${uuid}: ${url.pathname}`);
  }
  return url;
}

export function assertSafeMetadataUrl(candidate, { baseUrl, datasetUuid } = {}) {
  const uuid = safeUuid(datasetUuid);
  const base = new URL(baseUrl);
  const url = new URL(candidate, base);
  if (base.protocol !== "https:" || url.protocol !== "https:") {
    throw new Error(`Only HTTPS Geoportal metadata downloads are allowed: ${url.href}`);
  }
  if (url.origin !== base.origin) {
    throw new Error(`Cross-origin Geoportal metadata download refused: ${url.href}`);
  }
  if (url.username || url.password || url.hash) {
    throw new Error(`Credentials and fragments are not allowed in metadata URLs: ${url.href}`);
  }
  const match = url.pathname.match(/^\/metadata\/([0-9a-f-]+)\/(?:download|xml)\/?$/i);
  if (!match) {
    throw new Error(`Metadata path is not allowlisted: ${url.pathname}`);
  }
  const identifier = safeUuid(match[1], "metadata route UUID");
  if (identifier !== uuid) {
    throw new Error(`Metadata path UUID ${identifier} does not match dataset ${uuid}`);
  }
  return url;
}

async function fetchWithSafeRedirects({
  fetchImpl,
  url,
  baseUrl,
  datasetUuid,
  signal,
  maxRedirects = 5,
  urlValidator = candidate => assertSafeDownloadUrl(candidate, { baseUrl, datasetUuid })
}) {
  let current = urlValidator(url);
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const response = await fetchImpl(current.href, {
      method: "GET",
      headers: {
        accept: "application/geo+json,application/json;q=0.9"
      },
      credentials: "omit",
      redirect: "manual",
      signal
    });
    if (!REDIRECT_STATUSES.has(response.status)) return { response, finalUrl: current.href };
    if (redirects === maxRedirects) throw new Error(`Too many redirects for ${datasetUuid}`);
    const location = response.headers?.get?.("location");
    if (!location) throw new Error(`Redirect without Location for ${datasetUuid}`);
    try {
      await response.body?.cancel?.();
    } catch {
      // The redirect body is intentionally discarded.
    }
    current = urlValidator(new URL(location, current));
  }
  throw new Error(`Too many redirects for ${datasetUuid}`);
}

async function streamResponseToFile(response, filePath, { maxBytes, allowXml = false }) {
  if (!response.body) throw new Error("Download response has no body");
  const contentLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`Download Content-Length ${contentLength} exceeds ${maxBytes} bytes`);
  }
  const contentType = String(response.headers?.get?.("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType.includes("html") || (!allowXml && contentType.includes("xml"))) {
    throw new Error(`Download returned disallowed content type ${contentType || "unknown"}`);
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const hash = createHash("sha256");
  let bytes = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        callback(new Error(`Download exceeded ${maxBytes} bytes`));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    }
  });
  await pipeline(response.body, meter, createWriteStream(filePath, { flags: "wx" }));
  if (bytes === 0) throw new Error("Download returned an empty body");
  return { bytes, sha256: hash.digest("hex"), contentType };
}

async function readPrefix(filePath, maxBytes = 8 * 1024 * 1024) {
  const file = await fs.open(filePath, "r");
  try {
    const stat = await file.stat();
    const length = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await file.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead).toString("utf8").replace(/^\uFEFF/, "");
  } finally {
    await file.close();
  }
}

function readJsonString(source, start) {
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) escaped = false;
    else if (character === "\\") escaped = true;
    else if (character === '"') {
      const raw = source.slice(start, index + 1);
      try {
        return { value: JSON.parse(raw), end: index + 1 };
      } catch {
        return null;
      }
    }
  }
  return null;
}

function topLevelStringProperty(source, propertyName) {
  let index = 0;
  while (/\s/.test(source[index] || "")) index += 1;
  if (source[index] !== "{") return null;
  let depth = 1;
  index += 1;
  while (index < source.length && depth > 0) {
    const character = source[index];
    if (character === '"') {
      const token = readJsonString(source, index);
      if (!token) return null;
      if (depth === 1) {
        let next = token.end;
        while (/\s/.test(source[next] || "")) next += 1;
        if (source[next] === ":" && token.value === propertyName) {
          next += 1;
          while (/\s/.test(source[next] || "")) next += 1;
          if (source[next] !== '"') return null;
          return readJsonString(source, next)?.value ?? null;
        }
      }
      index = token.end;
      continue;
    }
    if (character === "{" || character === "[") depth += 1;
    else if (character === "}" || character === "]") depth -= 1;
    index += 1;
  }
  return null;
}

export async function assertGeoJsonEnvelope(filePath) {
  const prefix = await readPrefix(filePath);
  const trimmed = prefix.trimStart().toLowerCase();
  if (trimmed.startsWith("<") || trimmed.includes("<!doctype html") || trimmed.includes("<html")) {
    throw new Error("Download body is HTML, not GeoJSON");
  }
  const type = topLevelStringProperty(prefix, "type");
  if (type !== "FeatureCollection") {
    throw new Error(`GeoJSON root type must be FeatureCollection, received ${type || "unknown"}`);
  }
}

export async function assertMetadataXmlEnvelope(filePath) {
  const prefix = await readPrefix(filePath, 1024 * 1024);
  const trimmed = prefix.trimStart();
  if (/^<!doctype\s+html|^<html\b/i.test(trimmed) || /<html\b/i.test(trimmed.slice(0, 4096))) {
    throw new Error("Metadata download body is HTML, not ISO metadata XML");
  }
  if (!/^<\?xml\b/i.test(trimmed) && !/^<[a-z_][\w.-]*:/i.test(trimmed)) {
    throw new Error("Metadata download is not an XML document");
  }
  if (!/<(?:[a-z_][\w.-]*:)?MD_Metadata\b/i.test(prefix)) {
    throw new Error("Metadata XML does not contain an ISO MD_Metadata root");
  }
}

function parseExtent(value) {
  if (Array.isArray(value) && value.length >= 4) {
    const numbers = value.slice(0, 4).map(Number);
    return numbers.every(Number.isFinite) ? numbers : null;
  }
  if (value && typeof value === "object") {
    const numbers = [value.minX, value.minY, value.maxX, value.maxY].map(Number);
    return numbers.every(Number.isFinite) ? numbers : null;
  }
  return null;
}

function summarizeOgrInfo(result) {
  const layers = Array.isArray(result?.layers) ? result.layers : [];
  const geometryTypes = unique(layers.flatMap(layer => [
    layer.geometryType,
    ...(Array.isArray(layer.geometryFields)
      ? layer.geometryFields.map(field => field?.type || field?.geometryType)
      : [])
  ]).map(value => String(value || "").trim()));
  const featureCounts = layers
    .map(layer => Number(layer.featureCount))
    .filter(Number.isFinite);
  const extents = layers.flatMap(layer => [
    parseExtent(layer.extent),
    ...(Array.isArray(layer.geometryFields)
      ? layer.geometryFields.map(field => parseExtent(field?.extent))
      : [])
  ]).filter(Boolean);
  const bbox = extents.length ? [
    Math.min(...extents.map(extent => extent[0])),
    Math.min(...extents.map(extent => extent[1])),
    Math.max(...extents.map(extent => extent[2])),
    Math.max(...extents.map(extent => extent[3]))
  ] : null;
  return {
    driver: result?.driverShortName || result?.driverLongName || null,
    layerCount: layers.length,
    featureCount: featureCounts.length ? featureCounts.reduce((sum, count) => sum + count, 0) : null,
    geometryTypes,
    bbox
  };
}

export async function inspectGeoJsonWithGdal(filePath, { execFileImpl = execFile } = {}) {
  let stdout;
  try {
    ({ stdout } = await execFileImpl(
      "ogrinfo",
      ["-ro", "-so", "-al", "-json", filePath],
      gdalExecOptions()
    ));
  } catch (error) {
    throw new Error(
      `ogrinfo could not read GeoJSON: ${sanitizeDiagnosticMessage(error.stderr || error.message)}`
    );
  }
  let report;
  try {
    report = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`ogrinfo returned invalid JSON: ${error.message}`);
  }
  const summary = summarizeOgrInfo(report);
  if (!String(summary.driver || "").toLowerCase().includes("geojson")) {
    throw new Error(`OGR opened the source with unexpected driver ${summary.driver || "unknown"}`);
  }
  if (summary.layerCount < 1) throw new Error("OGR found no GeoJSON layers");
  const usableGeometry = summary.geometryTypes.some(type =>
    !/^(none|unknown|wkbnone|wkbunknown)$/i.test(type)
  );
  if (!usableGeometry) throw new Error("OGR found no readable geometry field");
  return summary;
}

function geometryFamily(value) {
  const normalized = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  if (normalized.includes("point")) return "point";
  if (normalized.includes("line")) return "line";
  if (normalized.includes("polygon")) return "polygon";
  return normalized || null;
}

function validationWarnings(validation, planItem) {
  const warnings = [];
  const expectedFamily = geometryFamily(planItem.validation?.expectedGeometryType);
  const observedFamilies = unique(validation.geometryTypes.map(geometryFamily));
  if (expectedFamily && observedFamilies.length && !observedFamilies.includes(expectedFamily)) {
    warnings.push({
      code: "geometry_type_mismatch",
      severity: "warning",
      expected: planItem.validation.expectedGeometryType,
      observed: validation.geometryTypes
    });
  }
  const expected = planItem.validation?.expectedBbox;
  if (expected && validation.bbox) {
    const expectedBbox = [expected.minx, expected.miny, expected.maxx, expected.maxy].map(Number);
    if (expectedBbox.every(Number.isFinite)) {
      const tolerance = 0.01;
      const outside = validation.bbox[0] < expectedBbox[0] - tolerance ||
        validation.bbox[1] < expectedBbox[1] - tolerance ||
        validation.bbox[2] > expectedBbox[2] + tolerance ||
        validation.bbox[3] > expectedBbox[3] + tolerance;
      if (outside) {
        warnings.push({
          code: "observed_extent_outside_catalog_bbox",
          severity: "warning",
          expected: expectedBbox,
          observed: validation.bbox
        });
      }
    }
  }
  return warnings;
}

function geometryQuarantine(validation, planItem) {
  const observed = validation?.bbox;
  if (!Array.isArray(observed) || observed.length !== 4 || !observed.every(Number.isFinite)) {
    return {
      code: "geometry_extent_unavailable",
      message: "OGR could not establish a finite geometry extent."
    };
  }
  if (
    observed[0] < -180 || observed[2] > 180 ||
    observed[1] < -90 || observed[3] > 90 ||
    observed[0] > observed[2] || observed[1] > observed[3]
  ) {
    return {
      code: "gross_invalid_coordinates",
      message: `Observed extent ${JSON.stringify(observed)} is outside valid longitude/latitude bounds.`
    };
  }
  // This collection is explicitly scoped to Riau. The broad guard is wider
  // than the province (including its marine area) and only catches material
  // coordinate-column or CRS failures.
  if (observed[0] < 95 || observed[2] > 110 || observed[1] < -5 || observed[3] > 8) {
    return {
      code: "extent_outside_riau_guardrail",
      message: `Observed extent ${JSON.stringify(observed)} is outside the broad Riau guardrail.`
    };
  }
  const expected = planItem.validation?.expectedBbox;
  if (expected) {
    const expectedBbox = [expected.minx, expected.miny, expected.maxx, expected.maxy].map(Number);
    if (expectedBbox.every(Number.isFinite)) {
      const longitudeMargin = Math.max(0.05, Math.abs(expectedBbox[2] - expectedBbox[0]) * 0.1);
      const latitudeMargin = Math.max(0.05, Math.abs(expectedBbox[3] - expectedBbox[1]) * 0.1);
      const materiallyOutside = observed[0] < expectedBbox[0] - longitudeMargin ||
        observed[1] < expectedBbox[1] - latitudeMargin ||
        observed[2] > expectedBbox[2] + longitudeMargin ||
        observed[3] > expectedBbox[3] + latitudeMargin;
      if (materiallyOutside) {
        return {
          code: "material_bbox_mismatch",
          message:
            `Observed extent ${JSON.stringify(observed)} materially exceeds catalog extent ` +
            `${JSON.stringify(expectedBbox)}.`
        };
      }
    }
  }
  return null;
}

export async function downloadGeoJson({
  datasetUuid,
  url,
  baseUrl,
  destination,
  fetchImpl = globalThis.fetch,
  maxBytes = DEFAULT_MAX_BYTES,
  timeoutMs = 15 * 60 * 1000,
  retries = 3,
  retryDelayMs = 1000,
  sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
}) {
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl must be a function");
  const uuid = safeUuid(datasetUuid);
  const attempts = asPositiveInteger(retries, "retries");
  const byteLimit = asPositiveInteger(maxBytes, "maxBytes");
  const requestTimeout = asPositiveInteger(timeoutMs, "timeoutMs");
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await fs.rm(destination, { force: true });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Geoportal download timed out")), requestTimeout);
    try {
      const { response, finalUrl } = await fetchWithSafeRedirects({
        fetchImpl,
        url,
        baseUrl,
        datasetUuid: uuid,
        signal: controller.signal
      });
      if (!response.ok) {
        const error = new Error(`Geoportal download returned HTTP ${response.status}`);
        error.retryable = RETRYABLE_STATUSES.has(response.status);
        throw error;
      }
      const streamed = await streamResponseToFile(response, destination, { maxBytes: byteLimit });
      await assertGeoJsonEnvelope(destination);
      return { ...streamed, finalUrl, attempts: attempt };
    } catch (error) {
      lastError = error;
      await fs.rm(destination, { force: true });
      const retryable = error.retryable !== false &&
        !/Cross-origin|Download path|disallowed content type|FeatureCollection|exceeded/i.test(error.message);
      if (attempt >= attempts || !retryable) break;
      await sleep(retryDelayMs * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Failed to mirror ${uuid} after ${attempts} attempt(s): ${lastError?.message}`);
}

export async function downloadMetadataXml({
  datasetUuid,
  url,
  baseUrl,
  destination,
  fetchImpl = globalThis.fetch,
  maxBytes = DEFAULT_METADATA_MAX_BYTES,
  timeoutMs = 2 * 60 * 1000,
  retries = 3,
  retryDelayMs = 1000,
  sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
}) {
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl must be a function");
  const uuid = safeUuid(datasetUuid);
  const attempts = asPositiveInteger(retries, "retries");
  const byteLimit = asPositiveInteger(maxBytes, "metadataMaxBytes");
  const requestTimeout = asPositiveInteger(timeoutMs, "timeoutMs");
  let lastError;
  let attempted = 0;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    attempted = attempt;
    await fs.rm(destination, { force: true });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Geoportal metadata download timed out")), requestTimeout);
    try {
      const { response, finalUrl } = await fetchWithSafeRedirects({
        fetchImpl,
        url,
        baseUrl,
        datasetUuid: uuid,
        signal: controller.signal,
        urlValidator: candidate => assertSafeMetadataUrl(candidate, { baseUrl, datasetUuid: uuid })
      });
      if (!response.ok) {
        const error = new Error(`Geoportal metadata download returned HTTP ${response.status}`);
        error.retryable = RETRYABLE_STATUSES.has(response.status);
        throw error;
      }
      const streamed = await streamResponseToFile(response, destination, {
        maxBytes: byteLimit,
        allowXml: true
      });
      await assertMetadataXmlEnvelope(destination);
      return { ...streamed, finalUrl, attempts: attempt };
    } catch (error) {
      lastError = error;
      await fs.rm(destination, { force: true });
      const retryable = error.retryable !== false &&
        !/Cross-origin|not allowlisted|disallowed content type|not ISO metadata|not an XML|exceeded/i.test(error.message);
      if (attempt >= attempts || !retryable) break;
      await sleep(retryDelayMs * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Failed to mirror metadata for ${uuid} after ${attempted} attempt(s): ${lastError?.message}`);
}

function safeWfsLayer(dataset) {
  const mapset = dataset?.publicMapset;
  const workspace = String(mapset?.workspace || "").trim();
  const layerName = String(mapset?.layerName || "").trim();
  const qualifiedName = String(mapset?.qualifiedName || "").trim();
  if (mapset?.present !== true || mapset?.layerNameMatches !== true) {
    throw new Error("WFS fallback requires an exact public mapset UUID/layer match");
  }
  if (!/^[a-z0-9_.-]+$/i.test(workspace) || !/^[a-z0-9_.-]+$/i.test(layerName)) {
    throw new Error("WFS fallback mapset layer contains unsafe characters");
  }
  if (qualifiedName !== `${workspace}:${layerName}`) {
    throw new Error("WFS fallback qualified layer does not match the mapset allowlist");
  }
  return { workspace, layerName, qualifiedName };
}

function assertSafeWfsUrl(candidate, { baseUrl, qualifiedName }) {
  const base = new URL(baseUrl);
  const url = new URL(candidate, base);
  if (base.protocol !== "https:" || url.protocol !== "https:" || url.origin !== base.origin) {
    throw new Error(`Cross-origin or non-HTTPS WFS URL refused: ${url.href}`);
  }
  if (url.pathname.replace(/\/+$/, "") !== "/wfs-proxy") {
    throw new Error(`WFS path is not allowlisted: ${url.pathname}`);
  }
  if (normalizeText(url.searchParams.get("service")) !== "wfs" ||
      normalizeText(url.searchParams.get("request")) !== "getfeature") {
    throw new Error("WFS fallback only allows GetFeature requests");
  }
  if (url.searchParams.get("typeNames") !== qualifiedName) {
    throw new Error("WFS typeNames does not match the exact mapset layer");
  }
  return url;
}

async function readResponseBuffer(response, maxBytes) {
  if (!response.body) throw new Error("WFS response has no body");
  const contentLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`WFS page Content-Length ${contentLength} exceeds remaining limit`);
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maxBytes) throw new Error("WFS response exceeded the remaining byte limit");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, bytes);
}

async function fetchWfsPage({
  fetchImpl,
  requestUrl,
  baseUrl,
  qualifiedName,
  datasetUuid,
  maxBytes,
  timeoutMs,
  retries,
  retryDelayMs,
  sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("WFS page timed out")), timeoutMs);
    try {
      const { response } = await fetchWithSafeRedirects({
        fetchImpl,
        url: requestUrl,
        baseUrl,
        datasetUuid,
        signal: controller.signal,
        urlValidator: candidate => assertSafeWfsUrl(candidate, { baseUrl, qualifiedName })
      });
      if (!response.ok) {
        const error = new Error(`WFS fallback returned HTTP ${response.status}`);
        error.retryable = RETRYABLE_STATUSES.has(response.status);
        throw error;
      }
      const contentType = normalizeText(response.headers?.get?.("content-type"));
      if (contentType.includes("html") || contentType.includes("xml")) {
        throw new Error(`WFS fallback returned disallowed content type ${contentType || "unknown"}`);
      }
      const buffer = await readResponseBuffer(response, maxBytes);
      const prefix = buffer.subarray(0, 4096).toString("utf8").trimStart().toLowerCase();
      if (prefix.startsWith("<") || prefix.includes("<html")) {
        throw new Error("WFS fallback returned markup instead of GeoJSON");
      }
      let payload;
      try {
        payload = JSON.parse(buffer.toString("utf8"));
      } catch (error) {
        throw new Error(`WFS fallback returned invalid JSON: ${error.message}`);
      }
      if (payload?.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
        throw new Error("WFS fallback response is not a GeoJSON FeatureCollection");
      }
      return { payload, bytes: buffer.length };
    } catch (error) {
      lastError = error;
      const retryable = error.retryable !== false &&
        !/Cross-origin|not allowlisted|typeNames|disallowed content type|not a GeoJSON|exceeded/i.test(error.message);
      if (attempt >= retries || !retryable) break;
      await sleep(retryDelayMs * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`WFS page failed: ${lastError?.message}`);
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${stableJson(value[key])}`
  ).join(",")}}`;
}

function stableFeatureId(feature) {
  const direct = String(feature?.id ?? "").trim();
  if (direct) return `id:${direct}`;
  const properties = feature?.properties || {};
  for (const name of ["objectid", "OBJECTID", "objectId", "fid", "FID", "id", "ID"]) {
    const value = String(properties[name] ?? "").trim();
    if (value) return `${name}:${value}`;
  }
  return `sha256:${createHash("sha256").update(stableJson({
    geometry: feature?.geometry ?? null,
    properties
  })).digest("hex")}`;
}

async function writeAll(file, value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesWritten } = await file.write(buffer, offset, buffer.length - offset, null);
    if (bytesWritten < 1) throw new Error("Could not make progress writing WFS fallback output");
    offset += bytesWritten;
  }
  return buffer.length;
}

export async function downloadWfsGeoJson({
  dataset,
  datasetUuid,
  baseUrl,
  destination,
  fetchImpl = globalThis.fetch,
  maxBytes = DEFAULT_MAX_BYTES,
  timeoutMs = 2 * 60 * 1000,
  retries = 3,
  retryDelayMs = 1000,
  pageSize = DEFAULT_WFS_PAGE_SIZE,
  maxPages = 10_000
}) {
  const uuid = safeUuid(datasetUuid);
  const layer = safeWfsLayer(dataset);
  const byteLimit = asPositiveInteger(maxBytes, "maxBytes");
  const count = asPositiveInteger(pageSize, "wfsPageSize");
  const pageLimit = asPositiveInteger(maxPages, "wfsMaxPages");
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rm(destination, { force: true });
  const file = await fs.open(destination, "wx");
  const seen = new Set();
  let outputBytes = 0;
  let responseBytes = 0;
  let featureCount = 0;
  let expectedMatched = null;
  let pages = 0;
  let complete = false;
  try {
    outputBytes += await writeAll(file, '{"type":"FeatureCollection","features":[');
    let startIndex = 0;
    while (pages < pageLimit) {
      const requestUrl = new URL("/wfs-proxy", baseUrl);
      requestUrl.searchParams.set("service", "WFS");
      requestUrl.searchParams.set("version", "2.0.0");
      requestUrl.searchParams.set("request", "GetFeature");
      requestUrl.searchParams.set("typeNames", layer.qualifiedName);
      requestUrl.searchParams.set("outputFormat", "application/json");
      requestUrl.searchParams.set("srsName", "EPSG:4326");
      requestUrl.searchParams.set("count", String(count));
      requestUrl.searchParams.set("startIndex", String(startIndex));
      const remaining = byteLimit - Math.max(outputBytes, responseBytes);
      if (remaining < 1) throw new Error(`WFS fallback exceeded ${byteLimit} bytes`);
      const page = await fetchWfsPage({
        fetchImpl,
        requestUrl,
        baseUrl,
        qualifiedName: layer.qualifiedName,
        datasetUuid: uuid,
        maxBytes: Math.min(remaining, WFS_PAGE_MAX_BYTES),
        timeoutMs,
        retries,
        retryDelayMs
      });
      pages += 1;
      responseBytes += page.bytes;
      const payload = page.payload;
      const reportedMatched = Number(payload.numberMatched ?? payload.totalFeatures);
      if (Number.isSafeInteger(reportedMatched) && reportedMatched >= 0) {
        if (expectedMatched === null) expectedMatched = reportedMatched;
        else if (expectedMatched !== reportedMatched) {
          throw new Error(`WFS numberMatched changed from ${expectedMatched} to ${reportedMatched}`);
        }
      }
      const rawNumberReturned = payload.numberReturned;
      if (rawNumberReturned !== undefined && rawNumberReturned !== null &&
          String(rawNumberReturned).toLowerCase() !== "unknown") {
        const reportedReturned = Number(rawNumberReturned);
        if (!Number.isSafeInteger(reportedReturned) || reportedReturned < 0 ||
            reportedReturned !== payload.features.length) {
          throw new Error(
            `WFS numberReturned ${rawNumberReturned} does not match ${payload.features.length} features`
          );
        }
      }
      const featureCountBeforePage = featureCount;
      for (const feature of payload.features) {
        if (feature?.type !== "Feature" || !("geometry" in feature)) {
          throw new Error("WFS fallback returned an invalid GeoJSON feature");
        }
        const stableId = stableFeatureId(feature);
        if (seen.has(stableId)) continue;
        seen.add(stableId);
        const serialized = JSON.stringify(feature);
        outputBytes += await writeAll(file, `${featureCount ? "," : ""}${serialized}`);
        featureCount += 1;
        if (outputBytes > byteLimit) throw new Error(`WFS fallback exceeded ${byteLimit} bytes`);
      }
      const returned = payload.features.length;
      if (returned === 0) {
        complete = true;
        break;
      }
      if (featureCount === featureCountBeforePage) {
        throw new Error("WFS page made no progress after stable-ID deduplication");
      }
      startIndex += returned;
      if (expectedMatched !== null && startIndex >= expectedMatched) {
        complete = true;
        break;
      }
    }
    if (!complete && pages >= pageLimit) throw new Error(`WFS fallback exceeded ${pageLimit} pages`);
    if (expectedMatched !== null && featureCount !== expectedMatched) {
      throw new Error(
        `WFS fallback produced ${featureCount} unique features; expected ${expectedMatched}`
      );
    }
    outputBytes += await writeAll(file, "]}");
    if (outputBytes > byteLimit) throw new Error(`WFS fallback exceeded ${byteLimit} bytes`);
  } catch (error) {
    await file.close();
    await fs.rm(destination, { force: true });
    throw error;
  }
  await file.close();
  await assertGeoJsonEnvelope(destination);
  const hashed = await hashFile(destination);
  return {
    ...hashed,
    contentType: "application/geo+json",
    finalUrl: new URL("/wfs-proxy", baseUrl).href,
    attempts: null,
    acquisition: "wfs_paged",
    pageCount: pages,
    featureCount
  };
}

export async function buildDisplayGeoJson(sourcePath, destination, {
  execFileImpl = execFile,
  simplifyTolerance = 0.00005,
  dissolveField = null,
  engine = "gdal",
  retainedPercentage = null
} = {}) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rm(destination, { force: true });
  const safeDissolveField = dissolveField === null ? null : String(dissolveField);
  if (safeDissolveField && !/^[a-z][a-z0-9_]{0,62}$/i.test(safeDissolveField)) {
    throw new Error("Invalid display dissolve field");
  }
  if (engine === "mapshaper") {
    const percentage = Number(retainedPercentage);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      throw new Error("Invalid Mapshaper retained percentage");
    }
    const args = [sourcePath];
    if (safeDissolveField) args.push("-dissolve", safeDissolveField);
    args.push(
      "-simplify", `${percentage}%`, "keep-shapes",
      "-o", "format=geojson", "precision=0.000001", destination
    );
    try {
      await execFileImpl(MAPSHAPER_CLI, args, gdalExecOptions());
      return;
    } catch (error) {
      await fs.rm(destination, { force: true });
      throw new Error(
        `Mapshaper display build failed: ${sanitizeDiagnosticMessage(error.stderr || error.message)}`
      );
    }
  }
  if (engine !== "gdal") throw new Error("Unsupported display build engine");
  const temporaryPackage = safeDissolveField ? `${destination}.gpkg` : null;
  try {
    if (safeDissolveField) {
      await fs.rm(temporaryPackage, { force: true });
      await execFileImpl(
        "ogr2ogr",
        [
          "-f", "GPKG",
          "-t_srs", "EPSG:4326",
          "-makevalid",
          "-nln", "source",
          temporaryPackage,
          sourcePath
        ],
        gdalExecOptions()
      );
      await execFileImpl(
        "ogr2ogr",
        [
          "-f", "GeoJSON",
          "-dialect", "SQLite",
          "-sql", `SELECT ST_Union(geom) AS geom, "${safeDissolveField}" FROM source GROUP BY "${safeDissolveField}"`,
          "-simplify", String(simplifyTolerance),
          "-makevalid",
          "-lco", "RFC7946=YES",
          "-lco", "COORDINATE_PRECISION=6",
          destination,
          temporaryPackage
        ],
        gdalExecOptions()
      );
      return;
    }
    await execFileImpl(
      "ogr2ogr",
      [
        "-f", "GeoJSON",
        "-t_srs", "EPSG:4326",
        "-simplify", String(simplifyTolerance),
        "-makevalid",
        "-lco", "RFC7946=YES",
        "-lco", "COORDINATE_PRECISION=6",
        destination,
        sourcePath
      ],
      gdalExecOptions()
    );
  } catch (error) {
    await fs.rm(destination, { force: true });
    throw new Error(
      `ogr2ogr display build failed: ${sanitizeDiagnosticMessage(error.stderr || error.message)}`
    );
  } finally {
    if (temporaryPackage) await fs.rm(temporaryPackage, { force: true });
  }
}

function pointCoordinatePair(geometry) {
  if (geometry?.type === "Point" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates;
  }
  if (
    geometry?.type === "MultiPoint" && Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length === 1 && Array.isArray(geometry.coordinates[0])
  ) {
    return geometry.coordinates[0];
  }
  return null;
}

function insideRiauGuardrail(longitude, latitude) {
  return Number.isFinite(longitude) && Number.isFinite(latitude) &&
    longitude >= 95 && longitude <= 110 && latitude >= -5 && latitude <= 8;
}

export async function repairKnownPointAnomalies(sourcePath, destination) {
  const payload = JSON.parse(await fs.readFile(sourcePath, "utf8"));
  if (payload?.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
    throw new Error("Known-anomaly repair requires a GeoJSON FeatureCollection");
  }
  let repaired = 0;
  let omitted = 0;
  const features = [];
  for (const feature of payload.features) {
    const coordinates = pointCoordinatePair(feature?.geometry);
    if (!coordinates) {
      features.push(feature);
      continue;
    }
    const observedLongitude = Number(coordinates[0]);
    const observedLatitude = Number(coordinates[1]);
    const longitude = Number(feature?.properties?.x);
    const latitude = Number(feature?.properties?.y);
    const validObserved = insideRiauGuardrail(observedLongitude, observedLatitude);
    const validAttributePair = insideRiauGuardrail(longitude, latitude);
    const attributeMismatch = validAttributePair && (
      Math.abs(observedLongitude - longitude) > 0.05 ||
      Math.abs(observedLatitude - latitude) > 0.05
    );
    if (validObserved && !attributeMismatch) {
      features.push(feature);
      continue;
    }
    if (!validAttributePair) {
      omitted += 1;
      continue;
    }
    const geometry = feature.geometry.type === "MultiPoint"
      ? { ...feature.geometry, coordinates: [[longitude, latitude]] }
      : { ...feature.geometry, coordinates: [longitude, latitude] };
    features.push({ ...feature, geometry });
    repaired += 1;
  }
  if (!features.length) throw new Error("Known-anomaly repair removed every feature");
  await fs.writeFile(destination, `${JSON.stringify({ ...payload, features })}\n`, { flag: "wx" });
  return { inputFeatures: payload.features.length, outputFeatures: features.length, repaired, omitted };
}

function validateInputs(manifest, plan, expectedCount) {
  if (!manifest || !Array.isArray(manifest.datasets)) {
    throw new Error("Inventory manifest must contain datasets[]");
  }
  if (!plan || !Array.isArray(plan.items)) throw new Error("Download plan must contain items[]");
  if (expectedCount !== null && manifest.datasets.length !== expectedCount) {
    throw new Error(`Inventory has ${manifest.datasets.length} datasets; expected ${expectedCount}`);
  }
  const datasets = new Map();
  for (const dataset of manifest.datasets) {
    const uuid = safeUuid(dataset.datasetUuid || dataset.id);
    if (datasets.has(uuid)) throw new Error(`Duplicate canonical dataset UUID in inventory: ${uuid}`);
    datasets.set(uuid, dataset);
  }
  const items = new Map();
  for (const item of plan.items) {
    const uuid = safeUuid(item.datasetUuid || item.id, "download-plan dataset UUID");
    if (items.has(uuid)) throw new Error(`Duplicate canonical dataset UUID in download plan: ${uuid}`);
    if (!datasets.has(uuid)) throw new Error(`Download plan contains unknown dataset UUID ${uuid}`);
    if (!new Set(["ready", "review_required"]).has(item.status)) {
      throw new Error(`Unexpected plan status for ${uuid}: ${item.status}`);
    }
    items.set(uuid, item);
  }
  const missing = [...datasets.keys()].filter(uuid => !items.has(uuid));
  if (missing.length) throw new Error(`Download plan is missing ${missing.length} dataset UUID(s)`);
  return { datasets, items };
}

function safePreviousArtifact(uuid, artifact, filename, releaseSha = artifact?.sha256) {
  if (!artifact || !SHA256_PATTERN.test(String(artifact.sha256 || ""))) return null;
  if (!SHA256_PATTERN.test(String(releaseSha || ""))) return null;
  const expectedKey = `${R2_PREFIX}/datasets/${uuid}/releases/${releaseSha}/${filename}`;
  if (artifact.key !== expectedKey) return null;
  const bytes = Number(artifact.bytes);
  if (!Number.isSafeInteger(bytes) || bytes < 1) return null;
  if (
    filename === "display.geojson" &&
    (!Number.isSafeInteger(artifact.featureCount) || artifact.featureCount < 0)
  ) return null;
  return { ...artifact, available: true, bytes, key: expectedKey };
}

function safePreviousSourceArtifact(uuid, artifact) {
  const compression = artifact?.compression ?? "identity";
  if (!new Set(["identity", "gzip"]).has(compression)) return null;
  const filename = compression === "gzip" ? "source.geojson.gz" : "source.geojson";
  const source = safePreviousArtifact(uuid, artifact, filename);
  if (!source) return null;
  if (source.bytes > R2_SINGLE_UPLOAD_SAFE_MAX_BYTES) return null;
  if (compression === "gzip") {
    const originalSha256 = String(artifact.originalSha256 || "");
    const originalBytes = Number(artifact.originalBytes);
    if (!SHA256_PATTERN.test(originalSha256)) return null;
    if (!Number.isSafeInteger(originalBytes) || originalBytes < 1 || originalBytes > DEFAULT_MAX_BYTES) return null;
    if (artifact.contentType !== "application/gzip") return null;
    if (artifact.originalContentType !== "application/geo+json") return null;
    return { ...source, compression, originalSha256, originalBytes };
  }
  if (artifact.contentType && artifact.contentType !== "application/geo+json") return null;
  return { ...source, compression: "identity" };
}

function safePreviousMetadataArtifact(uuid, artifact) {
  if (!artifact || !SHA256_PATTERN.test(String(artifact.sha256 || ""))) return null;
  const expectedKey =
    `${R2_PREFIX}/datasets/${uuid}/metadata/releases/${artifact.sha256}/metadata.xml`;
  const bytes = Number(artifact.bytes);
  if (artifact.key !== expectedKey || !Number.isSafeInteger(bytes) || bytes < 1) return null;
  return { ...artifact, available: true, bytes, key: expectedKey };
}

function reusablePreviousEntry(previousByUuid, dataset) {
  const uuid = dataset.datasetUuid || dataset.id;
  const previous = previousByUuid.get(uuid);
  const updatedAt = dataset.dates?.updatedAt;
  if (!previous || !updatedAt || previous.source?.updatedAt !== updatedAt) return null;
  if (!new Set(["mirrored", "reused"]).has(previous.mirrorStatus)) return null;
  const source = safePreviousSourceArtifact(uuid, previous.artifacts?.source);
  if (!source) return null;
  const display = safePreviousArtifact(
    uuid,
    previous.artifacts?.display,
    "display.geojson"
  );
  return { previous, source, display };
}

function baseCatalogEntry(dataset, planItem) {
  const uuid = safeUuid(dataset.datasetUuid || dataset.id);
  return {
    datasetUuid: uuid,
    title: dataset.title || planItem.title || uuid,
    description: dataset.description || null,
    identifiers: dataset.identifiers || null,
    publisher: dataset.publisher || null,
    theme: dataset.theme || null,
    spatial: dataset.spatial || null,
    publicMapset: dataset.publicMapset || null,
    dates: dataset.dates || null,
    metadata: dataset.metadata || null,
    workflow: dataset.workflow || null,
    access: dataset.access || null,
    source: {
      portalUrl: planItem.source?.url || dataset.access?.downloadUrl || null,
      updatedAt: dataset.dates?.updatedAt || null,
      expectedBytes: planItem.source?.expectedBytes ?? null,
      license: planItem.source?.license || null,
      access: planItem.source?.access || null
    },
    planStatus: planItem.status,
    blockers: [...(planItem.blockers || [])],
    mirrorStatus: null,
    retrievedAt: null,
    artifacts: {
      source: null,
      display: null,
      metadata: null
    },
    validation: null,
    qaWarnings: []
  };
}

function eligibility(entry) {
  const forced = FORCED_REVIEW_DATASETS.get(entry.datasetUuid);
  const blockers = [...entry.blockers];
  if (entry.planStatus !== "ready") blockers.push("plan_review_required");
  if (forced) blockers.push(forced.code);
  if (normalizeText(entry.source.access) !== "public") blockers.push("access_not_public");
  if (!isOpenLicense(entry.source.license)) blockers.push("license_not_open");
  return { ready: blockers.length === 0, blockers: unique(blockers), forced };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const limit = asPositiveInteger(concurrency, "concurrency");
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function registerUpload(uploads, outputDir, key, filePath, contentType, phase, phaseOrder) {
  const relativeFile = path.relative(path.resolve(outputDir), path.resolve(filePath));
  if (relativeFile.startsWith("..") || path.isAbsolute(relativeFile)) {
    throw new Error(`Upload file escaped output directory: ${filePath}`);
  }
  uploads.push({ key, file: relativeFile.split(path.sep).join("/"), contentType, phase, phaseOrder });
}

function metadataOnlyEntry(entry, eligibilityResult, generatedAt) {
  entry.blockers = eligibilityResult.blockers;
  entry.mirrorStatus = "metadata_only_review_required";
  entry.retrievedAt = generatedAt;
  if (eligibilityResult.forced) {
    entry.qaWarnings.push({
      code: eligibilityResult.forced.code,
      severity: "high",
      message: eligibilityResult.forced.message
    });
  }
  return entry;
}

async function mirrorMetadata({
  entry,
  planItem,
  previousByUuid,
  baseUrl,
  outputDir,
  uploads,
  fetchImpl,
  metadataMaxBytes,
  timeoutMs,
  retries,
  retryDelayMs,
  force
}) {
  const metadataUrl = planItem.metadataResource?.url;
  if (!metadataUrl) {
    entry.artifacts.metadata = {
      available: false,
      status: "unavailable",
      reason: "metadata_resource_missing"
    };
    entry.qaWarnings.push({
      code: "metadata_resource_missing",
      severity: "warning",
      message: "The inventory did not advertise a downloadable metadata XML resource."
    });
    return;
  }
  const temporaryDirectory = path.resolve(outputDir, ".tmp");
  await fs.mkdir(temporaryDirectory, { recursive: true });
  const temporaryMetadata = path.join(
    temporaryDirectory,
    `${entry.datasetUuid}-metadata-${Date.now()}-${Math.random().toString(16).slice(2)}.xml`
  );
  const streamed = await downloadMetadataXml({
    datasetUuid: entry.datasetUuid,
    url: metadataUrl,
    baseUrl,
    destination: temporaryMetadata,
    fetchImpl,
    maxBytes: metadataMaxBytes,
    timeoutMs: Math.min(timeoutMs, 5 * 60 * 1000),
    retries,
    retryDelayMs
  });
  const previousArtifact = safePreviousMetadataArtifact(
    entry.datasetUuid,
    previousByUuid.get(entry.datasetUuid)?.artifacts?.metadata
  );
  if (!force && previousArtifact?.sha256 === streamed.sha256) {
    await fs.rm(temporaryMetadata, { force: true });
    entry.artifacts.metadata = previousArtifact;
    return;
  }
  const metadataKey =
    `${R2_PREFIX}/datasets/${entry.datasetUuid}/metadata/releases/${streamed.sha256}/metadata.xml`;
  const metadataPath = toR2ObjectPath(outputDir, metadataKey);
  await fs.mkdir(path.dirname(metadataPath), { recursive: true });
  await fs.rm(metadataPath, { force: true });
  await fs.rename(temporaryMetadata, metadataPath);
  entry.artifacts.metadata = {
    available: true,
    status: "ready",
    key: metadataKey,
    sha256: streamed.sha256,
    bytes: streamed.bytes,
    contentType: "application/xml",
    finalUrl: streamed.finalUrl
  };
  registerUpload(uploads, outputDir, metadataKey, metadataPath, "application/xml", "data", 10);
}

async function mirrorOne({
  dataset,
  planItem,
  previousByUuid,
  baseUrl,
  outputDir,
  uploads,
  generatedAt,
  fetchImpl,
  inspector,
  displayBuilder,
  maxBytes,
  timeoutMs,
  retries,
  retryDelayMs,
  metadataMaxBytes,
  displaySourceMaxBytes,
  displayMaxBytes,
  displayMaxFeatures,
  sourceCompressionThresholdBytes,
  singleUploadMaxBytes,
  force
}) {
  const entry = baseCatalogEntry(dataset, planItem);
  const eligibilityResult = eligibility(entry);
  const reviewedTitleConflict = planItem.reviewedMetadataTitleConflict;
  if (reviewedTitleConflict && typeof reviewedTitleConflict === "object") {
    entry.qaWarnings.push({
      code: "reviewed_metadata_title_conflict",
      severity: "warning",
      datasetTitle: reviewedTitleConflict.datasetTitle ?? entry.title,
      metadataTitle: reviewedTitleConflict.metadataTitle ?? null,
      note: reviewedTitleConflict.note ?? null
    });
  }

  const knownAnomaly = KNOWN_GEOMETRY_ANOMALIES.get(entry.datasetUuid);
  if (knownAnomaly) {
    entry.qaWarnings.push({
      code: knownAnomaly.code,
      severity: "high",
      message: knownAnomaly.detail,
      upstreamTitle: knownAnomaly.title,
      action: "raw_preserved_display_quarantined"
    });
  }

  try {
    await mirrorMetadata({
      entry,
      planItem,
      previousByUuid,
      baseUrl,
      outputDir,
      uploads,
      fetchImpl,
      metadataMaxBytes,
      timeoutMs,
      retries,
      retryDelayMs,
      force
    });
  } catch (error) {
    entry.mirrorStatus = "failed";
    entry.retrievedAt = generatedAt;
    entry.qaWarnings.push({
      code: "metadata_mirror_failed",
      severity: "error",
      message: sanitizeDiagnosticMessage(error.message)
    });
    return entry;
  }

  if (eligibilityResult.ready && !entry.artifacts.metadata?.available) {
    entry.mirrorStatus = "failed";
    entry.retrievedAt = generatedAt;
    entry.qaWarnings.push({
      code: "metadata_required_for_ready_dataset",
      severity: "error",
      message: "A ready dataset must have an immutable ISO metadata XML object."
    });
    return entry;
  }

  if (!eligibilityResult.ready) return metadataOnlyEntry(entry, eligibilityResult, generatedAt);

  let reusable = force ? null : reusablePreviousEntry(previousByUuid, dataset);
  const intentionalMissingDisplay = new Set(["source_too_large", "feature_budget_exceeded"]);
  if (
    reusable && !knownAnomaly && !reusable.display &&
    !intentionalMissingDisplay.has(reusable.previous.artifacts?.display?.reason)
  ) {
    reusable = null;
  }
  if (reusable) {
    entry.mirrorStatus = "reused";
    entry.retrievedAt = reusable.previous.retrievedAt || generatedAt;
    entry.artifacts.source = reusable.source;
    entry.validation = reusable.previous.validation || null;
    entry.qaWarnings.push(...(reusable.previous.qaWarnings || []).filter(warning =>
      warning?.code !== "known_coordinate_anomaly"
    ));
    const reusedQuarantine = knownAnomaly || geometryQuarantine(entry.validation, planItem);
    entry.artifacts.display = reusedQuarantine
      ? { available: false, status: "quarantined", reason: "known_coordinate_anomaly" }
      : reusable.display || { available: false, status: "unavailable", reason: "no_previous_display" };
    if (!knownAnomaly && reusedQuarantine) {
      entry.artifacts.display.reason = reusedQuarantine.code;
      entry.qaWarnings.push({
        code: reusedQuarantine.code,
        severity: "high",
        message: reusedQuarantine.message,
        action: "raw_preserved_display_quarantined"
      });
    }
    return entry;
  }

  const temporaryDirectory = path.resolve(outputDir, ".tmp");
  await fs.mkdir(temporaryDirectory, { recursive: true });
  const temporarySource = path.join(temporaryDirectory, `${entry.datasetUuid}-${Date.now()}-${Math.random().toString(16).slice(2)}.geojson`);
  let temporaryCompressedSource = null;
  let repairedDisplaySource = null;
  try {
    let streamed;
    try {
      streamed = await downloadGeoJson({
        datasetUuid: entry.datasetUuid,
        url: entry.source.portalUrl,
        baseUrl,
        destination: temporarySource,
        fetchImpl,
        maxBytes,
        timeoutMs,
        retries,
        retryDelayMs
      });
      streamed.acquisition = "direct_download";
    } catch (directError) {
      try {
        streamed = await downloadWfsGeoJson({
          dataset,
          datasetUuid: entry.datasetUuid,
          baseUrl,
          destination: temporarySource,
          fetchImpl,
          maxBytes,
          timeoutMs: Math.min(timeoutMs, 5 * 60 * 1000),
          retries,
          retryDelayMs
        });
        entry.qaWarnings.push({
          code: "direct_download_failed_wfs_fallback_used",
          severity: "info",
          message: sanitizeDiagnosticMessage(directError.message),
          pageCount: streamed.pageCount
        });
      } catch (wfsError) {
        throw new Error(
          `Direct download failed (${directError.message}); WFS fallback failed (${wfsError.message})`
        );
      }
    }
    const validation = await inspector(temporarySource);
    entry.validation = validation;
    entry.qaWarnings.push(...validationWarnings(validation, planItem));
    const detectedQuarantine = geometryQuarantine(validation, planItem);
    if (detectedQuarantine && !knownAnomaly) {
      entry.qaWarnings.push({
        code: detectedQuarantine.code,
        severity: "high",
        message: detectedQuarantine.message,
        action: "raw_preserved_display_quarantined"
      });
    }
    let storedSource = streamed;
    let sourceCompression = "identity";
    let sourceFilename = "source.geojson";
    let sourceContentType = "application/geo+json";
    let displaySourcePath = temporarySource;
    if (streamed.bytes > sourceCompressionThresholdBytes) {
      temporaryCompressedSource = `${temporarySource}.gz`;
      storedSource = await gzipFile(temporarySource, temporaryCompressedSource);
      if (storedSource.bytes > singleUploadMaxBytes) {
        throw new Error(
          `Compressed source is ${storedSource.bytes} bytes; safe single-object upload limit is ${singleUploadMaxBytes}`
        );
      }
      sourceCompression = "gzip";
      sourceFilename = "source.geojson.gz";
      sourceContentType = "application/gzip";
    } else if (streamed.bytes > singleUploadMaxBytes) {
      throw new Error(
        `Source is ${streamed.bytes} bytes; safe single-object upload limit is ${singleUploadMaxBytes}`
      );
    }
    const releasePrefix = `${R2_PREFIX}/datasets/${entry.datasetUuid}/releases/${storedSource.sha256}`;
    const sourceKey = `${releasePrefix}/${sourceFilename}`;
    const sourcePath = toR2ObjectPath(outputDir, sourceKey);
    await fs.mkdir(path.dirname(sourcePath), { recursive: true });
    await fs.rm(sourcePath, { force: true });
    if (sourceCompression === "gzip") {
      await fs.rename(temporaryCompressedSource, sourcePath);
      temporaryCompressedSource = null;
    } else {
      await fs.rename(temporarySource, sourcePath);
      displaySourcePath = sourcePath;
    }
    entry.artifacts.source = {
      available: true,
      key: sourceKey,
      sha256: storedSource.sha256,
      bytes: storedSource.bytes,
      contentType: sourceContentType,
      compression: sourceCompression,
      finalUrl: streamed.finalUrl,
      acquisition: streamed.acquisition,
      pageCount: streamed.pageCount ?? null
    };
    if (sourceCompression === "gzip") {
      Object.assign(entry.artifacts.source, {
        originalSha256: streamed.sha256,
        originalBytes: streamed.bytes,
        originalContentType: "application/geo+json"
      });
      entry.qaWarnings.push({
        code: "source_stored_gzip",
        severity: "info",
        originalBytes: streamed.bytes,
        storedBytes: storedSource.bytes
      });
    }
    registerUpload(uploads, outputDir, sourceKey, sourcePath, sourceContentType, "data", 10);

    if (knownAnomaly) {
      repairedDisplaySource = path.join(
        temporaryDirectory,
        `${entry.datasetUuid}-display-repaired-${Date.now()}-${Math.random().toString(16).slice(2)}.geojson`
      );
      const repair = await repairKnownPointAnomalies(displaySourcePath, repairedDisplaySource);
      displaySourcePath = repairedDisplaySource;
      entry.qaWarnings.push({
        code: "known_coordinate_anomaly_repaired_for_display",
        severity: repair.omitted ? "warning" : "info",
        message:
          "Only the derived display was repaired; the immutable source remains unchanged.",
        ...repair
      });
    }

    const displayProfile = DISPLAY_PROFILES.get(entry.datasetUuid) || {};
    if (!knownAnomaly && detectedQuarantine) {
      entry.artifacts.display = {
        available: false,
        status: "quarantined",
        reason: detectedQuarantine.code
      };
    } else if (streamed.bytes > displaySourceMaxBytes) {
      entry.artifacts.display = {
        available: false,
        status: "unavailable",
        reason: "source_too_large"
      };
      entry.qaWarnings.push({
        code: "display_skipped_source_too_large",
        severity: "info",
        sourceBytes: streamed.bytes,
        limitBytes: displaySourceMaxBytes
      });
    } else if (
      !displayProfile.allowFeatureCountReduction &&
      validation.featureCount !== null && validation.featureCount > displayMaxFeatures
    ) {
      entry.artifacts.display = {
        available: false,
        status: "unavailable",
        reason: "feature_budget_exceeded"
      };
      entry.qaWarnings.push({
        code: "display_skipped_feature_budget",
        severity: "info",
        featureCount: validation.featureCount,
        limitFeatures: displayMaxFeatures
      });
    } else {
      const temporaryDisplay = path.join(temporaryDirectory, `${entry.datasetUuid}-display-${Date.now()}.geojson`);
      try {
        await displayBuilder(displaySourcePath, temporaryDisplay, displayProfile);
        await assertGeoJsonEnvelope(temporaryDisplay);
        const displayValidation = await inspector(temporaryDisplay);
        const displayHash = await hashFile(temporaryDisplay);
        if (displayHash.bytes > displayMaxBytes) {
          throw new Error(`Derived display is ${displayHash.bytes} bytes; limit is ${displayMaxBytes}`);
        }
        const allowFeatureCountReduction = Boolean(
          displayProfile.allowFeatureCountReduction || knownAnomaly
        );
        if (
          validation.featureCount !== null && displayValidation.featureCount !== null &&
          (allowFeatureCountReduction
            ? displayValidation.featureCount > validation.featureCount
            : validation.featureCount !== displayValidation.featureCount)
        ) {
          throw new Error(
            `Derived display feature count is invalid: source=${validation.featureCount}, display=${displayValidation.featureCount}`
          );
        }
        if (!Number.isSafeInteger(displayValidation.featureCount) || displayValidation.featureCount < 0) {
          throw new Error("Derived display has no integer feature count");
        }
        if (displayValidation.featureCount > displayMaxFeatures) {
          throw new Error(
            `Derived display has ${displayValidation.featureCount} features; limit is ${displayMaxFeatures}`
          );
        }
        // Derived output is content-addressed independently from the raw source.
        // A GDAL or processing change can alter the display bytes even when the
        // upstream source hash is unchanged; using the display hash prevents a
        // forced rebuild from mutating an object referenced by an older catalog.
        const displayKey =
          `${R2_PREFIX}/datasets/${entry.datasetUuid}/releases/${displayHash.sha256}/display.geojson`;
        const displayPath = toR2ObjectPath(outputDir, displayKey);
        await fs.mkdir(path.dirname(displayPath), { recursive: true });
        await fs.rm(displayPath, { force: true });
        await fs.rename(temporaryDisplay, displayPath);
        entry.artifacts.display = {
          available: true,
          status: "ready",
          key: displayKey,
          sha256: displayHash.sha256,
          bytes: displayHash.bytes,
          featureCount: displayValidation.featureCount,
          contentType: "application/geo+json",
          validation: displayValidation,
          processing: displayProfile.label || (knownAnomaly
            ? "known_point_anomaly_repair_then_ogr2ogr"
            : "ogr2ogr EPSG:4326, simplify 0.00005, makevalid, RFC7946, precision 6")
        };
        registerUpload(uploads, outputDir, displayKey, displayPath, "application/geo+json", "data", 10);
      } catch (error) {
        await fs.rm(temporaryDisplay, { force: true });
        entry.artifacts.display = {
          available: false,
          status: "unavailable",
          reason: "display_build_failed"
        };
        entry.qaWarnings.push({
          code: "display_build_failed",
          severity: "warning",
          message: sanitizeDiagnosticMessage(error.message)
        });
      }
    }
    if (repairedDisplaySource) await fs.rm(repairedDisplaySource, { force: true });
    await fs.rm(temporarySource, { force: true });
    entry.mirrorStatus = "mirrored";
    entry.retrievedAt = generatedAt;
    return entry;
  } catch (error) {
    await fs.rm(temporarySource, { force: true });
    if (temporaryCompressedSource) await fs.rm(temporaryCompressedSource, { force: true });
    if (repairedDisplaySource) await fs.rm(repairedDisplaySource, { force: true });
    entry.mirrorStatus = "failed";
    entry.retrievedAt = generatedAt;
    entry.qaWarnings.push({
      code: "source_mirror_failed",
      severity: "error",
      message: sanitizeDiagnosticMessage(error.message)
    });
    return entry;
  }
}

export async function mirrorRiauGeoportal({
  manifest,
  plan,
  outputDir,
  previous = null,
  expectedCount = DEFAULT_EXPECTED_DATASETS,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  inspector = filePath => inspectGeoJsonWithGdal(filePath),
  displayBuilder = (source, destination, options) => buildDisplayGeoJson(source, destination, options),
  maxBytes = DEFAULT_MAX_BYTES,
  timeoutMs = 15 * 60 * 1000,
  retries = 3,
  retryDelayMs = 1000,
  concurrency = 2,
  displaySourceMaxBytes = DEFAULT_DISPLAY_SOURCE_MAX_BYTES,
  displayMaxBytes = DEFAULT_DISPLAY_MAX_BYTES,
  displayMaxFeatures = DEFAULT_DISPLAY_MAX_FEATURES,
  metadataMaxBytes = DEFAULT_METADATA_MAX_BYTES,
  sourceCompressionThresholdBytes = DEFAULT_SOURCE_COMPRESSION_THRESHOLD_BYTES,
  singleUploadMaxBytes = R2_SINGLE_UPLOAD_SAFE_MAX_BYTES,
  force = false
} = {}) {
  if (!outputDir) throw new Error("outputDir is required");
  const expected = expectedCount === null ? null : asPositiveInteger(expectedCount, "expectedCount");
  const { datasets, items } = validateInputs(manifest, plan, expected);
  const baseUrl = manifest.source?.baseUrl;
  if (!baseUrl) throw new Error("Inventory manifest source.baseUrl is required");
  const base = new URL(baseUrl);
  if (base.protocol !== "https:") throw new Error("Inventory base URL must use HTTPS");
  const generatedAt = now().toISOString();
  const releaseId = cleanReleaseId(
    `${manifest.id || "riau-geoportal"}-${generatedAt.replace(/\D/g, "")}`
  );
  await fs.mkdir(path.resolve(outputDir), { recursive: true });
  const uploads = [];
  const previousByUuid = new Map(
    (Array.isArray(previous?.datasets) ? previous.datasets : []).map(entry => [
      String(entry.datasetUuid || "").toLowerCase(),
      entry
    ])
  );
  const orderedDatasets = [...datasets.entries()].sort(([left], [right]) => left.localeCompare(right));
  const catalogDatasets = await mapWithConcurrency(orderedDatasets, concurrency, ([uuid, dataset]) =>
    mirrorOne({
      dataset,
      planItem: items.get(uuid),
      previousByUuid,
      baseUrl: base.href,
      outputDir,
      uploads,
      generatedAt,
      fetchImpl,
      inspector,
      displayBuilder,
      maxBytes: asPositiveInteger(maxBytes, "maxBytes"),
      timeoutMs: asPositiveInteger(timeoutMs, "timeoutMs"),
      retries: asPositiveInteger(retries, "retries"),
      retryDelayMs: asPositiveInteger(retryDelayMs, "retryDelayMs", { allowZero: true }),
      metadataMaxBytes: asPositiveInteger(metadataMaxBytes, "metadataMaxBytes"),
      displaySourceMaxBytes: asPositiveInteger(displaySourceMaxBytes, "displaySourceMaxBytes"),
      displayMaxBytes: asPositiveInteger(displayMaxBytes, "displayMaxBytes"),
      displayMaxFeatures: asPositiveInteger(displayMaxFeatures, "displayMaxFeatures"),
      sourceCompressionThresholdBytes: asPositiveInteger(
        sourceCompressionThresholdBytes,
        "sourceCompressionThresholdBytes"
      ),
      singleUploadMaxBytes: asPositiveInteger(singleUploadMaxBytes, "singleUploadMaxBytes"),
      force: force === true
    })
  );

  const totals = {
    datasets: catalogDatasets.length,
    ready: catalogDatasets.filter(entry => !entry.blockers.length).length,
    mirrored: catalogDatasets.filter(entry => entry.mirrorStatus === "mirrored").length,
    reused: catalogDatasets.filter(entry => entry.mirrorStatus === "reused").length,
    reviewRequired: catalogDatasets.filter(entry =>
      entry.mirrorStatus === "metadata_only_review_required"
    ).length,
    failed: catalogDatasets.filter(entry => entry.mirrorStatus === "failed").length,
    displayReady: catalogDatasets.filter(entry => entry.artifacts.display?.status === "ready").length,
    displayQuarantined: catalogDatasets.filter(entry =>
      entry.artifacts.display?.status === "quarantined"
    ).length,
    displayUnavailable: catalogDatasets.filter(entry =>
      entry.artifacts.display?.status === "unavailable"
    ).length
  };
  const releaseCatalogKey = `${R2_PREFIX}/catalog/releases/${releaseId}.json`;
  const currentCatalogKey = `${R2_PREFIX}/catalog/current.json`;

  const catalog = {
    schemaVersion: MIRROR_SCHEMA_VERSION,
    id: releaseId,
    generatedAt,
    access: "staff_only",
    canonicalDatasetKey: "datasetUuid",
    source: {
      portal: manifest.source,
      inventoryId: manifest.id || null,
      inventoryGeneratedAt: manifest.generatedAt || null,
      inventoryDatasetCount: manifest.datasets.length,
      downloadPlanGeneratedAt: plan.generatedAt || null
    },
    catalog: {
      releaseKey: releaseCatalogKey,
      currentKey: currentCatalogKey
    },
    totals,
    datasets: catalogDatasets
  };
  const releaseCatalogPath = toR2ObjectPath(outputDir, releaseCatalogKey);
  const currentCatalogPath = toR2ObjectPath(outputDir, currentCatalogKey);
  await writeJson(releaseCatalogPath, catalog);
  await writeJson(currentCatalogPath, catalog);
  registerUpload(
    uploads,
    outputDir,
    releaseCatalogKey,
    releaseCatalogPath,
    "application/json",
    "catalog_release",
    30
  );
  registerUpload(
    uploads,
    outputDir,
    currentCatalogKey,
    currentCatalogPath,
    "application/json",
    "catalog_pointer",
    40
  );

  const uploadPlan = {
    schemaVersion: MIRROR_SCHEMA_VERSION,
    generatedAt,
    releaseId,
    outputRoot: "objects",
    totals: {
      objects: uploads.length,
      dataObjects: uploads.filter(item => item.phaseOrder === 10).length,
      manifestObjects: uploads.filter(item => item.phaseOrder >= 20).length,
      ...totals
    },
    objects: uploads.sort((left, right) =>
      left.phaseOrder - right.phaseOrder || left.key.localeCompare(right.key)
    )
  };
  const uploadPlanPath = path.resolve(outputDir, "upload-plan.json");
  await writeJson(uploadPlanPath, uploadPlan);
  await fs.rm(path.resolve(outputDir, ".tmp"), { recursive: true, force: true });
  return { catalog, uploadPlan, uploadPlanPath };
}

function parseCliArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`Unknown argument: ${argument}`);
    if (argument === "--force") {
      options.force = true;
      continue;
    }
    const [name, inlineValue] = argument.slice(2).split("=", 2);
    const value = inlineValue ?? argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
    options[name] = value;
  }
  return options;
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${label} ${filePath}: ${error.message}`);
  }
}

export function summarizeMirrorFailures(catalog) {
  return (Array.isArray(catalog?.datasets) ? catalog.datasets : [])
    .filter(dataset => dataset?.mirrorStatus === "failed")
    .map(dataset => {
      const errors = (Array.isArray(dataset.qaWarnings) ? dataset.qaWarnings : [])
        .filter(warning => warning?.severity === "error");
      const warning = errors.at(-1) || null;
      return {
        datasetUuid: dataset.datasetUuid || null,
        title: dataset.title || null,
        reason: warning
          ? sanitizeDiagnosticMessage(
              [warning.code, warning.message].filter(Boolean).join(": ")
            )
          : "mirror_failed"
      };
    });
}

async function runCli(argv) {
  const options = parseCliArguments(argv);
  if (!options.manifest || !options.plan || !options["output-dir"]) {
    throw new Error(
      "Usage: node scripts/riau-geoportal-mirror.mjs --manifest <inventory.json> " +
      "--plan <download-plan.json> --output-dir <directory> [--previous <catalog.json>] " +
      "[--expected-count 60] [--max-bytes 5368709120] [--timeout-ms 900000] " +
      "[--retries 3] [--concurrency 2] [--force]"
    );
  }
  const manifest = await readJson(options.manifest, "inventory manifest");
  const plan = await readJson(options.plan, "download plan");
  const previous = options.previous ? await readJson(options.previous, "previous catalog") : null;
  const result = await mirrorRiauGeoportal({
    manifest,
    plan,
    previous,
    outputDir: options["output-dir"],
    expectedCount: options["expected-count"]
      ? Number(options["expected-count"])
      : DEFAULT_EXPECTED_DATASETS,
    maxBytes: options["max-bytes"] ? Number(options["max-bytes"]) : DEFAULT_MAX_BYTES,
    metadataMaxBytes: options["metadata-max-bytes"]
      ? Number(options["metadata-max-bytes"])
      : DEFAULT_METADATA_MAX_BYTES,
    timeoutMs: options["timeout-ms"] ? Number(options["timeout-ms"]) : 15 * 60 * 1000,
    retries: options.retries ? Number(options.retries) : 3,
    retryDelayMs: options["retry-delay-ms"] ? Number(options["retry-delay-ms"]) : 1000,
    concurrency: options.concurrency ? Number(options.concurrency) : 2,
    displaySourceMaxBytes: options["display-source-max-bytes"]
      ? Number(options["display-source-max-bytes"])
      : DEFAULT_DISPLAY_SOURCE_MAX_BYTES,
    displayMaxBytes: options["display-max-bytes"]
      ? Number(options["display-max-bytes"])
      : DEFAULT_DISPLAY_MAX_BYTES,
    displayMaxFeatures: options["display-max-features"]
      ? Number(options["display-max-features"])
      : DEFAULT_DISPLAY_MAX_FEATURES,
    force: options.force === true
  });
  const failures = summarizeMirrorFailures(result.catalog);
  console.log(JSON.stringify({
    ok: result.catalog.totals.failed === 0,
    catalog: result.catalog.catalog,
    totals: result.catalog.totals,
    failures,
    uploadPlan: result.uploadPlanPath
  }, null, 2));
  if (result.catalog.totals.failed > 0) {
    const failedUuids = failures.map(failure => failure.datasetUuid).filter(Boolean).join(", ");
    throw new Error(
      `Mirror incomplete: ${result.catalog.totals.failed} dataset(s) failed` +
      `${failedUuids ? ` (${failedUuids})` : ""}; catalog pointer must not advance`
    );
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  runCli(process.argv.slice(2)).catch(error => {
    console.error(sanitizeDiagnosticMessage(error.message));
    process.exitCode = 1;
  });
}
