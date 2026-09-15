const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pkkPath = path.join(root, "tmp", "ps-audit-pkk.geojson");
const hkmPath = path.join(root, "tmp", "ps-audit-kulit-bakau.geojson");
const outputPath = path.join(root, "data", "social-forestry-official-2026.geojson");
const detailsPath = path.join(root, "data", "social-forestry-details.json");

const pkkSource = "https://geoportal.planologi.kehutanan.go.id/server/rest/services/Peta_Interaktif_2026/PKK_AR_50K/MapServer/0";
const hkmSource = "https://geoportal.planologi.kehutanan.go.id/server/rest/services/Peta_Interaktif_2026/PPHKm_AR_50K/MapServer/0";
const importedAt = "2026-09-01";

const targets = {
  456: { key: "drive-audit:1urhekp2qlyly-o2q5c5agy1edtmqd870-kth-kasih-alam-siambul", area: 684, source: pkkSource },
  457: { key: "drive-audit:indragiri-hulu-kth-batu-kucing", area: 329, source: pkkSource },
  458: { key: "drive-audit:indragiri-hulu-kth-bomban-berduri", area: 348, source: pkkSource },
  459: { key: "drive-audit:indragiri-hulu-kth-batu-berdiri", area: 351, source: pkkSource },
  475: { key: "drive-audit:siak-gapoktanhut-kampung-dosan", area: 1132, source: pkkSource },
  // OBJECTID 1654 is already present in the consolidated base layer. It is
  // retained here only to validate and repair its duplicate document profile.
  1654: { key: "drive-audit:kepulauan-meranti-pecinta-mangrove-kulit-bakau", area: 14, source: hkmSource, alreadyInBase: true }
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isoDate(epoch) {
  return new Date(Number(epoch)).toISOString().slice(0, 10);
}

function normalizeFeature(feature) {
  const source = feature.properties || {};
  const target = targets[source.OBJECTID];
  if (!target) throw new Error(`Unexpected official OBJECTID ${source.OBJECTID}`);
  const isPkk = Boolean(source.NO_SK_PKK);
  const decree = String(source.NO_SK_PKK || source.NO_SK_PPHKM || "").replace(/^SK\.\s+/, "SK.");
  const name = source.NAMA_KELOMPOK;
  return {
    type: "Feature",
    properties: {
      OBJECTID: `PS-OFFICIAL-${source.OBJECTID}`,
      OFFICIAL_OBJECTID: source.OBJECTID,
      NAMA_PROV: "Riau",
      NAMA_KAB: source.KODE_KAB === 1410 ? "Kepulauan Meranti" : (source.KODE_KAB === 1408 ? "Siak" : "Indragiri Hulu"),
      NAMA_KEC: source.NAMA_KEC,
      NAMA_DESA: source.NAMA_DESA,
      NAMA_HKM: name,
      NO_IUPHKM: decree,
      TGL_IUPHKM: isoDate(source.TGL_SK_PKK || source.TGL_SK_PPHKM),
      L_IUPHKM: target.area,
      LUAS_POLI: null,
      Ket: isPkk ? "Kemitraan Kehutanan" : "Hutan Kemasyarakatan",
      PROFILE_KEY: target.key,
      NAMA_PEMEGANG: source.NAMA_PEMEGANG || null,
      AREAL_KERJA: source.AREAL_KERJA || null,
      SUMBER: "Peta Interaktif 2026 Kementerian Kehutanan",
      STATUS_SPASIAL: "Geometri resmi terverifikasi",
      GEOMETRY_SOURCE: target.source,
      ACCURACY_NOTE: "Dicocokkan dengan nama kelompok, nomor SK, luas persetujuan, dan lokasi administratif.",
      IMPORTED_AT: importedAt
    },
    geometry: feature.geometry
  };
}

const inputs = [...(readJson(pkkPath).features || []), ...(readJson(hkmPath).features || [])];
if (inputs.length !== Object.keys(targets).length) throw new Error(`Expected 6 official features, received ${inputs.length}`);
const normalizedInputs = inputs.map(normalizeFeature);
const features = normalizedInputs.filter(feature => !targets[feature.properties.OFFICIAL_OBJECTID].alreadyInBase).sort((a, b) => a.properties.OFFICIAL_OBJECTID - b.properties.OFFICIAL_OBJECTID);
fs.writeFileSync(outputPath, JSON.stringify({
  type: "FeatureCollection",
  name: "PERHUTANAN_SOSIAL_RIAU_OFFICIAL_2026",
  source: "Peta Interaktif 2026 Kementerian Kehutanan",
  importedAt,
  features
}) + "\n");

const details = readJson(detailsPath);
const verified = {
  "drive-audit:siak-gapoktanhut-kampung-dosan": {
    name: "GAPOKTANHUT KAMPUNG DOSAN", decree: "SK.3153/MENLHK-PSKL/PKPS/PSL.0/3/2023", decreeDate: "2023-03-27", areaHa: 1132, scheme: "Persetujuan Kemitraan Kehutanan"
  },
  "drive-audit:indragiri-hulu-kth-bomban-berduri": {
    name: "KTH BOMBAN BERDURI", decree: "SK.6463/MENLHK-PSKL/PKPS/PSL.0/8/2022", decreeDate: "2022-08-12", areaHa: 348, scheme: "Persetujuan Kemitraan Konservasi"
  },
  "drive-audit:indragiri-hulu-kth-batu-berdiri": {
    name: "KTH BATU BERDIRI", decree: "SK.6466/MENLHK-PSKL/PKPS/PSL.0/8/2022", decreeDate: "2022-08-12", areaHa: 351, scheme: "Persetujuan Kemitraan Konservasi"
  },
  "drive-audit:indragiri-hulu-kth-batu-kucing": {
    name: "KTH BATU KUCING", decree: "SK.6465/MENLHK-PSKL/PKPS/PSL.0/8/2022", decreeDate: "2022-08-12", areaHa: 329, scheme: "Persetujuan Kemitraan Konservasi"
  },
  "drive-audit:kepulauan-meranti-pecinta-mangrove-kulit-bakau": {
    name: "KTH PECINTA MANGROVE KULIT BAKAU", decree: "SK.5133/MENLHK-PSKL/PKPS/PSL.0/6/2022", decreeDate: "2022-06-13", areaHa: 14, scheme: "Hutan Kemasyarakatan", district: "Rangsang Barat"
  },
  "drive-audit:1urhekp2qlyly-o2q5c5agy1edtmqd870-kth-kasih-alam-siambul": {
    name: "KTH KASIH ALAM", decree: "SK.6464/MENLHK-PSKL/PKPS/PSL.0/8/2022", decreeDate: "2022-08-12", areaHa: 684, scheme: "Persetujuan Kemitraan Konservasi"
  }
};

for (const [key, correction] of Object.entries(verified)) {
  const detail = details[key];
  if (!detail) throw new Error(`Missing profile detail ${key}`);
  const officialFeature = normalizedInputs.find(item => item.properties.PROFILE_KEY === key);
  const officialTarget = targets[officialFeature.properties.OFFICIAL_OBJECTID];
  Object.assign(detail, correction, {
    spatialStatus: "official-geometry",
    spatialObjectKey: officialTarget.alreadyInBase ? "1654.0" : key,
    spatialSource: officialTarget.source,
    spatialVerifiedAt: importedAt
  });
  detail.skExtraction = Object.assign({}, detail.skExtraction, {
    decreeNumber: correction.decree,
    decreeDate: correction.decreeDate,
    scheme: correction.scheme,
    approvedAreaHa: correction.areaHa,
    source: "Dokumen SK"
  });
  detail.documents = (detail.documents || []).filter(document => {
    const url = String(document.url || "");
    return url.indexOf("194AzaJhWoIjPAJAK6p32rSgNJPr_SpXa") === -1 && url.indexOf("15rXAp-l60w0m9tR3yeJWtbY65B9ZDfZ4") === -1;
  });
}

const kulitBakau = details["drive-audit:kepulauan-meranti-pecinta-mangrove-kulit-bakau"];
const kulitBakauSpatial = details["1654.0"] || {};
["bpsklVerification", "bpsklProfile", "forestAreaComposition"].forEach(field => {
  if (kulitBakauSpatial[field]) kulitBakau[field] = kulitBakauSpatial[field];
});
kulitBakau.management = Object.assign({}, kulitBakauSpatial.management || {}, kulitBakau.management || {});

fs.writeFileSync(detailsPath, JSON.stringify(details, null, 2) + "\n");
console.log(`Imported ${features.length} new official geometries and updated ${Object.keys(verified).length} profiles.`);
