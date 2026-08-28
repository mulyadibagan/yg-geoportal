const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const details = JSON.parse(fs.readFileSync(path.join(root, "data", "social-forestry-details.json"), "utf8"));
const geo = JSON.parse(fs.readFileSync(path.join(root, "data", "PERHUTANAN_SOSIAL_RIAU.geojson"), "utf8"));

const text = value => String(value == null ? "" : value).trim();
const norm = value => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const cleanRegency = value => norm(value).replace(/^(kabupaten|kota)\s+/, "").replace(/\b\w/g, char => char.toUpperCase());
const signature = (name, village, regency) => norm([name, village, cleanRegency(regency)].join("|"));
const positive = value => {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  let raw = text(value).replace(/\s*ha\b/ig, "").replace(/[^0-9,.-]/g, "");
  if (!raw) return null;
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  const number = Number(raw);
  return Number.isFinite(number) && number > 0 ? number : null;
};
const ringArea = ring => {
  if (!Array.isArray(ring) || ring.length < 4) return 0;
  const radius = 6378137;
  let total = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const first = ring[index], second = ring[index + 1];
    total += (second[0] - first[0]) * Math.PI / 180 * (2 + Math.sin(first[1] * Math.PI / 180) + Math.sin(second[1] * Math.PI / 180));
  }
  return Math.abs(total * radius * radius / 2);
};
const geometryAreaHa = geometry => {
  if (!geometry || !geometry.coordinates) return 0;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.reduce((sum, polygon) => sum + Math.max(0, ringArea(polygon[0]) - polygon.slice(1).reduce((holes, ring) => holes + ringArea(ring), 0)), 0) / 10000;
};
const classifyScheme = (...values) => {
  const value = norm(values.join(" "));
  if (/hutan adat|\bmha\b|masyarakat hukum adat/.test(value)) return "Hutan Adat";
  if (/tanaman rakyat|\bhtr\b/.test(value)) return "Hutan Tanaman Rakyat";
  if (/kemitraan kehutanan|\bkulin\b|pengakuan perlindungan kemitraan/.test(value)) return "Kemitraan Kehutanan";
  if (/hutan kemasyarakatan|\bhkm\b|gapoktan|koperasi|kelompok tani hutan|\bkth\b/.test(value)) return "Hutan Kemasyarakatan";
  if (/hutan desa|\bhd\b|\blphd\b|lembaga pengelola hutan desa/.test(value)) return "Hutan Desa";
  return "Persetujuan Perhutanan Sosial";
};

const detailKeys = Object.keys(details);
const detailByDecree = new Map();
const detailBySignature = new Map();
detailKeys.forEach(key => {
  const detail = details[key] || {};
  const decree = norm(detail.decree || (detail.skExtraction || {}).decreeNumber);
  const sig = signature(detail.name, detail.village, detail.regency);
  if (decree && !detailByDecree.has(decree)) detailByDecree.set(decree, key);
  if (sig && !detailBySignature.has(sig)) detailBySignature.set(sig, key);
});

const spatialGroups = new Map();
(geo.features || []).forEach((feature, index) => {
  const properties = feature.properties || {};
  const decree = norm(properties.NO_IUPHKM || properties.SK);
  const identity = decree ? `sk:${decree}` : `spatial:${text(properties.OBJECTID || properties.ID || index)}`;
  if (!spatialGroups.has(identity)) spatialGroups.set(identity, []);
  spatialGroups.get(identity).push(feature);
});

const usedDetails = new Set();
const profiles = [];
spatialGroups.forEach((features, identity) => {
  const properties = features[0].properties || {};
  const decree = norm(properties.NO_IUPHKM || properties.SK);
  const sig = signature(properties.NAMA_HKM, properties.NAMA_DESA, properties.NAMA_KAB);
  const detailKey = detailByDecree.get(decree) || detailBySignature.get(sig) || "";
  const detail = detailKey ? details[detailKey] || {} : {};
  if (detailKey) usedDetails.add(detailKey);
  const legal = detail.skExtraction || {};
  const documentArea = positive(legal.approvedAreaHa) || positive(detail.areaHa);
  const documentAreaSource = positive(legal.approvedAreaHa) ? "SK" : documentArea ? "arsip dokumen" : "belum tersedia";
  const geometryArea = features.reduce((sum, feature) => sum + geometryAreaHa(feature.geometry), 0);
  const spatialCandidates = [
    { value: positive(properties.L_IUPHKM), source: "atribut polygon" },
    { value: positive(properties.LUAS_POLI), source: "kalkulasi polygon" },
    { value: positive(geometryArea), source: "kalkulasi geometri" }
  ];
  const spatialArea = spatialCandidates.find(candidate => candidate.value);
  const area = documentArea ? { value: documentArea, source: documentAreaSource } : spatialArea;
  profiles.push({
    key: detailKey || identity,
    decree: text(legal.decreeNumber || detail.decree || properties.NO_IUPHKM || properties.SK),
    decreeNorm: decree,
    signature: sig,
    name: text(detail.name || properties.NAMA_HKM || properties.NAMA_DESA || "Profil PS"),
    regency: cleanRegency(detail.regency || properties.NAMA_KAB),
    scheme: classifyScheme(legal.scheme, detail.scheme, properties.Ket, detail.name, properties.NAMA_HKM),
    spatial: true,
    documentAreaHa: documentArea == null ? null : Number(documentArea.toFixed(4)),
    documentAreaSource,
    spatialAreaHa: spatialArea ? Number(spatialArea.value.toFixed(4)) : null,
    spatialAreaSource: spatialArea ? spatialArea.source : "belum tersedia",
    areaHa: area ? Number(area.value.toFixed(4)) : null,
    areaSource: area ? area.source : "belum tersedia"
  });
});

detailKeys.forEach(key => {
  if (usedDetails.has(key)) return;
  const detail = details[key] || {};
  const legal = detail.skExtraction || {};
  const decree = norm(legal.decreeNumber || detail.decree);
  const sig = signature(detail.name, detail.village, detail.regency);
  if (profiles.some(profile => decree && profile.decreeNorm === decree || !decree && sig && profile.signature === sig)) return;
  const area = positive(legal.approvedAreaHa) || positive(detail.areaHa);
  profiles.push({
    key,
    decree: text(legal.decreeNumber || detail.decree),
    decreeNorm: decree,
    signature: sig,
    name: text(detail.name || detail.decree || "Profil PS"),
    regency: cleanRegency(detail.regency),
    scheme: classifyScheme(legal.scheme, detail.scheme, detail.name),
    spatial: false,
    documentAreaHa: area == null ? null : Number(area.toFixed(4)),
    documentAreaSource: positive(legal.approvedAreaHa) ? "SK" : area ? "arsip dokumen" : "belum tersedia",
    spatialAreaHa: null,
    spatialAreaSource: "belum tersedia",
    areaHa: area == null ? null : Number(area.toFixed(4)),
    areaSource: positive(legal.approvedAreaHa) ? "SK" : area ? "arsip dokumen" : "belum tersedia"
  });
});

const aggregate = rows => {
  const areaRows = rows.filter(row => row.areaHa != null);
  const documentRows = rows.filter(row => row.documentAreaHa != null);
  const spatialRows = rows.filter(row => row.spatialAreaHa != null);
  return {
    profileCount: rows.length,
    areaKnownCount: areaRows.length,
    areaMissingCount: rows.length - areaRows.length,
    totalAreaHa: Number(areaRows.reduce((sum, row) => sum + row.areaHa, 0).toFixed(2)),
    documentAreaKnownCount: documentRows.length,
    documentAreaHa: Number(documentRows.reduce((sum, row) => sum + row.documentAreaHa, 0).toFixed(2)),
    spatialAreaKnownCount: spatialRows.length,
    spatialAreaHa: Number(spatialRows.reduce((sum, row) => sum + row.spatialAreaHa, 0).toFixed(2))
  };
};
const schemes = Object.values(profiles.reduce((groups, profile) => {
  if (!groups[profile.scheme]) groups[profile.scheme] = { scheme: profile.scheme, profiles: [] };
  groups[profile.scheme].profiles.push(profile);
  return groups;
}, {})).map(group => Object.assign({ scheme: group.scheme }, aggregate(group.profiles))).sort((a, b) => b.profileCount - a.profileCount);

const summary = {
  generatedAt: new Date().toISOString(),
  methodology: "Satu PS dihitung sekali berdasarkan nomor SK. Luas SK diprioritaskan; atribut polygon dan kalkulasi geometri digunakan sebagai cadangan.",
  totals: aggregate(profiles),
  schemes,
  profiles
};
fs.writeFileSync(path.join(root, "data", "social-forestry-summary.json"), JSON.stringify(summary, null, 2) + "\n");
