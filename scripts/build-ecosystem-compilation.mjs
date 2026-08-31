import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const read = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));
const sum = (rows, getter) => rows.reduce((total, row) => total + Number(getter(row) || 0), 0);
const normalize = value => String(value == null ? "" : value)
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, " ").trim();
const cleanRegency = value => {
  const cleaned = normalize(value).replace(/^(kabupaten|kota)\s+/, "");
  const aliases = { "kapulauan meranti": "kepulauan meranti" };
  return (aliases[cleaned] || cleaned).replace(/\b\w/g, letter => letter.toUpperCase());
};

const EARTH_RADIUS_M = 6371008.8;
function ringArea(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const lower = ring[i];
    const middle = ring[(i + 1) % ring.length];
    const upper = ring[(i + 2) % ring.length];
    if (!lower || !middle || !upper) continue;
    total += (upper[0] - lower[0]) * Math.PI / 180 * Math.sin(middle[1] * Math.PI / 180);
  }
  return total * EARTH_RADIUS_M * EARTH_RADIUS_M / 2;
}

function geometryAreaHa(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return 0;
  if (geometry.type === "Polygon") {
    if (!geometry.coordinates.length) return 0;
    const outer = Math.abs(ringArea(geometry.coordinates[0]));
    const holes = geometry.coordinates.slice(1).reduce((total, ring) => total + Math.abs(ringArea(ring)), 0);
    return Math.max(0, outer - holes) / 10000;
  }
  if (geometry.type === "MultiPolygon") {
    return sum(geometry.coordinates, coordinates => geometryAreaHa({ type: "Polygon", coordinates }));
  }
  return 0;
}

const mangroveLandscape = read("mangrove-klm-summary.json");
const mangrovePriority = read("mangrove-priority-riau-results.json");
const peat = read("Gambut_BBSDLP_2019.geojson");
const feg = read("feg_riau.geojson");
const forest = read("kawasan_hutan_sk_903.geojson");
const socialSummary = read("social-forestry-summary.json");
const socialGeo = read("PERHUTANAN_SOSIAL_RIAU.geojson");
const forestAnalytics = read("village-forest-analytics.json");
const programmeMangrove = read("area_mangrove.geojson");
const mineralRestoration = read("mineral_land_restoration_area.geojson");

const priorityRows = Array.isArray(mangrovePriority.villages) ? mangrovePriority.villages : [];
const socialProfiles = Array.isArray(socialSummary.profiles) ? socialSummary.profiles : [];
const socialAnalytics = Object.entries(forestAnalytics.socialForestry || {});
const fegTotals = {};
for (const feature of feg.features || []) {
  const key = String(feature.properties?.fungsi_feg || "Belum terklasifikasi");
  fegTotals[key] = (fegTotals[key] || 0) + Number(feature.properties?.luas_ha || 0);
}

const forestAreas = {};
for (const feature of forest.features || []) {
  const key = String(feature.properties?.fungsi || "Belum terklasifikasi");
  forestAreas[key] = (forestAreas[key] || 0) + geometryAreaHa(feature.geometry);
}
const productionForestHa = sum(["HP", "HPK", "HPT"], key => forestAreas[key]);
const protectionForestHa = Number(forestAreas.HL || 0);
const conservationForestHa = sum(["CA", "KSA/KPA", "SA", "SM", "TN", "TWA"], key => forestAreas[key]);
const forestEstateHa = productionForestHa + protectionForestHa + conservationForestHa;

const lookupRegency = new Map();
for (const feature of socialGeo.features || []) {
  const properties = feature.properties || {};
  const regency = cleanRegency(properties.NAMA_KAB);
  const values = [properties.NO_IUPHKM, properties.OBJECTID, Number(properties.OBJECTID).toFixed(1), properties.NAMA_HKM];
  for (const value of values) {
    if (value != null && String(value).trim()) lookupRegency.set(normalize(value), regency);
  }
}
for (const profile of socialProfiles) {
  const regency = cleanRegency(profile.regency);
  for (const value of [profile.key, profile.decree, profile.name]) {
    if (value) lookupRegency.set(normalize(value), regency);
  }
}

const regionMap = new Map();
const region = name => {
  const cleaned = cleanRegency(name);
  if (!regionMap.has(cleaned)) regionMap.set(cleaned, {
    name: cleaned,
    mangroveHa: null,
    mangroveLindungHa: null,
    mangroveBudidayaHa: null,
    mangrovePriorityHa: 0,
    mangrovePriorityVillages: 0,
    socialForestryHa: 0,
    socialForestryProfiles: 0,
    currentForestInSocialForestryHa: 0,
    analysedSocialForestryUnits: 0
  });
  return regionMap.get(cleaned);
};

for (const item of mangroveLandscape.regencies || []) {
  Object.assign(region(item.name), {
    mangroveHa: round(item.mangrove_area_ha),
    mangroveLindungHa: round(item.indicative_lindung_ha),
    mangroveBudidayaHa: round(item.indicative_budidaya_ha)
  });
}
for (const item of priorityRows) {
  const row = region(item.regency);
  row.mangrovePriorityHa += Number(item.priorityAreaHa || 0);
  row.mangrovePriorityVillages += item.status === "analysed" ? 1 : 0;
}
for (const profile of socialProfiles) {
  const row = region(profile.regency);
  row.socialForestryHa += Number(profile.areaHa || 0);
  row.socialForestryProfiles += 1;
}
let unmatchedSocialAnalytics = 0;
for (const [key, item] of socialAnalytics) {
  const regencyName = lookupRegency.get(normalize(key)) || lookupRegency.get(normalize(item.name));
  if (!regencyName) {
    unmatchedSocialAnalytics += 1;
    continue;
  }
  const row = region(regencyName);
  if (item.analysisStatus !== "pending") {
    row.currentForestInSocialForestryHa += Number(item.currentForestHa || 0);
    row.analysedSocialForestryUnits += 1;
  }
}

for (const row of regionMap.values()) {
  for (const key of ["mangrovePriorityHa", "socialForestryHa", "currentForestInSocialForestryHa"]) row[key] = round(row[key]);
}

const analysedSocial = socialAnalytics.map(([, value]) => value).filter(value => value.analysisStatus !== "pending");
const mangroveProgrammeFeatures = programmeMangrove.features || [];
const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: "Provinsi Riau",
  interpretation: {
    areaPolicy: "Luas tiap tema disajikan sesuai unit analisis sumber. Luas antartema tidak dijumlahkan karena dapat bertumpang tindih.",
    restorationPolicy: "Prioritas rehabilitasi adalah indikasi penyaringan spasial, bukan kewajiban hukum atau penetapan lokasi tanam.",
    protectionPolicy: "Luas yang perlu dijaga menggunakan tutupan hutan terkini dalam unit Perhutanan Sosial yang telah dianalisis; bukan seluruh kawasan hutan secara otomatis."
  },
  mangrove: {
    referenceAreaHa: round(mangroveLandscape.statewide.mangrove_area_ha),
    indicativeProtectionHa: round(mangroveLandscape.statewide.indicative_lindung_ha),
    indicativeProtectionPct: round(mangroveLandscape.statewide.indicative_lindung_percent),
    indicativeCultivationHa: round(mangroveLandscape.statewide.indicative_budidaya_ha),
    indicativeCultivationPct: round(mangroveLandscape.statewide.indicative_budidaya_percent),
    indicativeUnclassifiedHa: round(mangroveLandscape.statewide.indicative_unclassified_ha),
    restorationPriorityHa: round(sum(priorityRows, item => item.priorityAreaHa)),
    restorationPriorityPolygons: Math.round(sum(priorityRows, item => item.priorityPolygonCount)),
    analysedVillages: priorityRows.filter(item => item.status === "analysed").length,
    programmePlantingHa: round(sum(mangroveProgrammeFeatures, feature => feature.properties?.Luas_Ha)),
    programmeSeedlings: Math.round(sum(mangroveProgrammeFeatures, feature => feature.properties?.Jumlah_Bib)),
    status: "available_indicative",
    detailPages: ["mangrove-landscape.html", "mangrove-priority.html"]
  },
  peat: {
    mappedPeatHa: round(sum(peat.features || [], feature => geometryAreaHa(feature.geometry))),
    fegProtectionHa: round(fegTotals["Indikatif Fungsi Lindung E.G."]),
    fegCultivationHa: round(fegTotals["Indikatif Fungsi Budidaya E.G."]),
    restorationNeedHa: null,
    restorationStatus: "not_available",
    restorationMessage: "Layer produksi yang menetapkan kandidat kebutuhan restorasi gambut belum tersedia. Peta gambut dan FEG tidak boleh dianggap otomatis sebagai area yang harus direstorasi.",
    scopeNote: "FEG mencakup fungsi dalam Kesatuan Hidrologis Gambut dan tidak sama dengan luas sebaran tanah gambut BBSDLP."
  },
  forestAndSocialForestry: {
    socialForestryProfiles: Number(socialSummary.totals?.profileCount || socialProfiles.length),
    socialForestryAreaHa: round(socialSummary.totals?.totalAreaHa),
    socialForestrySpatialAreaHa: round(socialSummary.totals?.spatialAreaHa),
    analysedSpatialUnits: analysedSocial.length,
    pendingSpatialUnits: socialAnalytics.length - analysedSocial.length,
    currentForestToGuardHa: round(sum(analysedSocial, item => item.currentForestHa)),
    baselineForestHa: round(sum(analysedSocial, item => item.baselineForestHa)),
    recordedForestLossHa: round(sum(analysedSocial, item => item.totalLossHa)),
    socialForestryInsideForestEstateHa: round(sum(analysedSocial, item => item.referenceAreasHa?.forestEstate)),
    socialForestryOnPeatHa: round(sum(analysedSocial, item => item.referenceAreasHa?.peat)),
    forestEstateHa: round(forestEstateHa),
    productionForestHa: round(productionForestHa),
    protectionForestHa: round(protectionForestHa),
    conservationForestHa: round(conservationForestHa),
    unmatchedAnalyticsUnits: unmatchedSocialAnalytics,
    detailPage: "social-forestry-directory.html"
  },
  dataQuality: [
    { theme: "Mangrove referensi dan fungsi", status: "ready", coverage: "7 kabupaten/kota pesisir", source: "Peta Indikatif KLM dan analisis fungsi publik v1" },
    { theme: "Prioritas rehabilitasi mangrove", status: "ready_indicative", coverage: `${priorityRows.length} catatan desa/kelurahan · ${priorityRows.filter(item => item.status === "analysed").length} teranalisis`, source: "Sentinel-2 2016–2025 dan penyaringan kandidat" },
    { theme: "Gambut dan FEG", status: "ready_context", coverage: "Provinsi Riau", source: "BBSDLP 2019 dan referensi FEG" },
    { theme: "Kebutuhan restorasi gambut", status: "missing", coverage: "Belum tersedia pada produksi", source: "Memerlukan model kandidat, verifikasi hidrologi, dan kondisi lapangan" },
    { theme: "Perhutanan Sosial", status: "ready", coverage: `${socialSummary.totals?.profileCount || socialProfiles.length} profil`, source: "Ringkasan satu PS per nomor SK" },
    { theme: "Tutupan hutan dalam PS", status: "partial", coverage: `${analysedSocial.length} unit spasial dianalisis`, source: "Hansen/UMD dan irisan referensi WebGIS" },
    { theme: "Restorasi lahan mineral", status: (mineralRestoration.features || []).length ? "ready" : "empty", coverage: `${(mineralRestoration.features || []).length} objek`, source: "Layer program WebGIS" }
  ],
  regions: [...regionMap.values()].sort((a, b) => a.name.localeCompare(b.name, "id")),
  sources: [
    { id: "mangrove-landscape", file: "data/mangrove-klm-summary.json", generatedAt: mangroveLandscape.generated_at, role: "Luas mangrove serta fungsi lindung/budidaya indikatif" },
    { id: "mangrove-priority", file: "data/mangrove-priority-riau-results.json", methodVersion: mangrovePriority.methodVersion, role: "Kandidat prioritas rehabilitasi mangrove" },
    { id: "peat", file: "data/Gambut_BBSDLP_2019.geojson", role: "Sebaran tanah gambut" },
    { id: "feg", file: "data/feg_riau.geojson", role: "Fungsi Ekosistem Gambut" },
    { id: "social-forestry", file: "data/social-forestry-summary.json", generatedAt: socialSummary.generatedAt, role: "Jumlah dan luas Perhutanan Sosial tanpa hitung ganda SK" },
    { id: "forest-analytics", file: "data/village-forest-analytics.json", generatedAt: forestAnalytics.generatedAt, role: "Tutupan, kehilangan hutan, dan irisan PS" },
    { id: "forest-estate", file: "data/kawasan_hutan_sk_903.geojson", role: "Fungsi kawasan hutan SK 903" }
  ]
};

fs.writeFileSync(path.join(dataDir, "ecosystem-compilation.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({
  generatedAt: output.generatedAt,
  mangrove: output.mangrove,
  peat: output.peat,
  forestAndSocialForestry: output.forestAndSocialForestry,
  regionCount: output.regions.length
}, null, 2));
