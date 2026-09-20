import { createHash } from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const SOURCE_URL =
  "https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/PERENCANAAN_RUANG/MapServer/14";
const EXPECTED_FEATURES = 33;
const EXPECTED_CLASSES = 23;

function sha256(path) {
  return createHash("sha256").update(fs.readFileSync(path)).digest("hex");
}
function readCollection(path, label) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  if (data?.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error(`${label} must be a GeoJSON FeatureCollection`);
  }
  return data;
}

function className(feature) {
  const properties = feature?.properties || {};
  return String(properties.rtrsys || properties.rtrppr || "").trim();
}

function objectId(feature) {
  return String(feature?.properties?.objectid ?? "").trim();
}

function assertOfficialRiauCollection(data, label) {
  if (data.features.length !== EXPECTED_FEATURES) {
    throw new Error(
      `${label} has ${data.features.length} features; expected ${EXPECTED_FEATURES}`
    );
  }

  const classes = new Set();
  const objectIds = new Set();
  for (const feature of data.features) {
    if (!["Polygon", "MultiPolygon"].includes(feature?.geometry?.type)) {
      throw new Error(`${label} contains a non-polygon geometry`);
    }
    const properties = feature.properties || {};
    if (String(properties.wadmpr || "").trim().toUpperCase() !== "RIAU") {
      throw new Error(`${label} contains a feature outside Riau`);
    }
    if (!/Perda\s+No\.\s*10\s+Tahun\s+2018/i.test(
      String(properties.nothpd || "")
    )) {
      throw new Error(`${label} contains an unexpected legal-basis attribute`);
    }
    const spatialClass = className(feature);
    if (!spatialClass) throw new Error(`${label} contains an unclassified feature`);
    classes.add(spatialClass);
    const id = objectId(feature);
    if (!id || objectIds.has(id)) {
      throw new Error(`${label} contains a missing or duplicate objectid`);
    }
    objectIds.add(id);
  }

  if (classes.size !== EXPECTED_CLASSES) {
    throw new Error(
      `${label} has ${classes.size} classes; expected ${EXPECTED_CLASSES}`
    );
  }
  return { classes, objectIds };
}

export function prepareRtrwRiau(
  rawPath,
  simplifiedPath,
  outputPath,
  manifestPath
) {
  const raw = readCollection(rawPath, "Raw RTRW source");
  const simplified = readCollection(simplifiedPath, "Simplified RTRW source");
  const rawInventory = assertOfficialRiauCollection(raw, "Raw RTRW source");
  const simplifiedInventory = assertOfficialRiauCollection(
    simplified,
    "Simplified RTRW source"
  );

  const rawIds = [...rawInventory.objectIds].sort();
  const simplifiedIds = [...simplifiedInventory.objectIds].sort();
  if (JSON.stringify(rawIds) !== JSON.stringify(simplifiedIds)) {
    throw new Error("Simplification changed the RTRW object inventory");
  }

  const retrievedAt = new Date().toISOString();
  const sourceChecksum = sha256(rawPath);
  const simplifiedChecksum = sha256(simplifiedPath);
  const classInventory = [...rawInventory.classes].sort((a, b) =>
    a.localeCompare(b, "id")
  );

  const output = {
    type: "FeatureCollection",
    metadata: {
      status: "working_internal",
      legalBasis: "Perda Provinsi Riau No. 10 Tahun 2018",
      legalStatusNote:
        "Baca bersama Putusan Mahkamah Agung No. 63 P/HUM/2019.",
      sourceOrganisation:
        "Badan Informasi Geospasial — Sekretariat Kebijakan Satu Peta",
      sourceDataset:
        "Kebijakan Satu Peta / PUBLIK/PERENCANAAN_RUANG / RTRWP (Layer 14)",
      sourceUrl: SOURCE_URL,
      sourceServiceDescription: "PERENCANAAN RUANG 02-07-2024",
      sourceQuery: "UPPER(wadmpr)='RIAU'",
      retrievedAt,
      crs: "EPSG:4326",
      sourceFeatureCount: raw.features.length,
      classCount: classInventory.length,
      sourceChecksumSha256: sourceChecksum,
      simplifiedSourceChecksumSha256: simplifiedChecksum,
      processing:
        "Mapshaper weighted simplification 5%, keep-shapes, clean, precision 0.000001.",
      notes:
        "Layer visualisasi internal dari layanan resmi Kebijakan Satu Peta BIG; bukan penetapan batas hukum atau pengganti lampiran Perda."
    },
    features: simplified.features.map(feature => {
      const properties = feature.properties || {};
      return {
        ...feature,
        properties: {
          ...properties,
          Layer_ID: "rtrw_riau_2018_2038",
          Source_Layer: "rtrw_riau_2018_2038",
          Nama_Objek: properties.rtrppr || properties.rtrsys,
          RENCANA: properties.rtrsys,
          POLA_RUANG: properties.rtrppr,
          PROVINSI: properties.wadmpr,
          DASAR_HUKUM: properties.nothpd,
          Source_Object_ID: properties.objectid
        }
      };
    })
  };

  fs.writeFileSync(outputPath, JSON.stringify(output));
  const manifest = {
    dataset: "RTRW Provinsi Riau 2018–2038",
    status: "working_internal",
    sourceUrl: SOURCE_URL,
    retrievedAt,
    crs: "EPSG:4326",
    sourceFeatureCount: raw.features.length,
    displayFeatureCount: output.features.length,
    classCount: classInventory.length,
    classes: classInventory,
    objectIds: rawIds.map(Number),
    sourceBytes: fs.statSync(rawPath).size,
    displayBytes: fs.statSync(outputPath).size,
    sourceChecksumSha256: sourceChecksum,
    displayChecksumSha256: sha256(outputPath),
    processing: output.metadata.processing,
    legalBasis: output.metadata.legalBasis,
    legalStatusNote: output.metadata.legalStatusNote
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  const [rawPath, simplifiedPath, outputPath, manifestPath] = process.argv.slice(2);
  if (!rawPath || !simplifiedPath || !outputPath || !manifestPath) {
    console.error(
      "Usage: node scripts/prepare-rtrw-riau.mjs <raw.geojson> " +
      "<simplified.geojson> <output.geojson> <manifest.json>"
    );
    process.exit(2);
  }
  console.log(JSON.stringify(
    prepareRtrwRiau(rawPath, simplifiedPath, outputPath, manifestPath),
    null,
    2
  ));
}
