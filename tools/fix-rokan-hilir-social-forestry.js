const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const geoPath = path.join(root, "data", "PERHUTANAN_SOSIAL_RIAU.geojson");
const detailsPath = path.join(root, "data", "social-forestry-details.json");
const processPath = path.join(root, "data", "social-forestry-process-2025.json");
const write = process.argv.includes("--write");

const geo = JSON.parse(fs.readFileSync(geoPath, "utf8"));
let details = JSON.parse(fs.readFileSync(detailsPath, "utf8"));
const processData = JSON.parse(fs.readFileSync(processPath, "utf8"));
const norm = value => String(value == null ? "" : value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const requireEntry = (object, key) => {
  if (!object[key]) throw new Error(`Missing required detail entry: ${key}`);
  return object[key];
};

const changes = [];
const set = (object, key, value, label) => {
  if (object[key] === value) return;
  changes.push({ label, from: object[key], to: value });
  object[key] = value;
};

// Correct the two 2023 permits from the decree documents. Their geometry is
// preserved byte-for-byte at the coordinate level; only attributes change.
for (const feature of geo.features || []) {
  const properties = feature.properties || {};
  const name = norm(properties.NAMA_HKM);
  if (name === "kth makmur jaya bersama") {
    set(properties, "NO_IUPHKM", "SK.9864/Menlhk-PSKL/PKPS/PSL.0/9/2023", "Makmur Jaya decree");
    set(properties, "L_IUPHKM", 184, "Makmur Jaya approved area");
  }
  if (name === "kth makmur pesisir") {
    set(properties, "NO_IUPHKM", "SK.9863/Menlhk-PSKL/PKPS/PSL.0/9/2023", "Makmur Pesisir decree");
    set(properties, "L_IUPHKM", 143, "Makmur Pesisir approved area");
  }
  if (name === "kth siarang arang") {
    set(properties, "NAMA_HKM", "KTH SIARANG-ARANG LESTARI", "Siarang-Arang legal name");
  }
  if (name === "kth batang kumu lestari sejahtera") {
    set(properties, "NAMA_DESA", "Pujud Selatan", "Batang Kumu legal village");
  }
}

// The stored objects were under each other's decree keys. Swap the objects so
// the canonical profile URL, decree, documents, and polygon all share one key.
const decree9863 = "sk.9863/menlhk-pskl/pkps/psl.0/9/2023";
const decree9864 = "sk.9864/menlhk-pskl/pkps/psl.0/9/2023";
const current9863 = requireEntry(details, decree9863);
const current9864 = requireEntry(details, decree9864);
if (norm(current9863.name) === "kth makmur jaya bersama" && norm(current9864.name) === "kth makmur pesisir") {
  details[decree9863] = current9864;
  details[decree9864] = current9863;
  changes.push({ label: "Swap Makmur detail keys", from: "crossed", to: "canonical" });
}
set(details[decree9863], "decree", "SK.9863/MENLHK-PSKL/PKPS/PSL.0/9/2023", "Makmur Pesisir detail decree");
set(details[decree9863], "areaHa", 143, "Makmur Pesisir detail area");
set(details[decree9864], "decree", "SK.9864/MENLHK-PSKL/PKPS/PSL.0/9/2023", "Makmur Jaya detail decree");
set(details[decree9864], "areaHa", 184, "Makmur Jaya detail area");
const correctExtraction = (key, decreeNumber, approvedAreaHa, scheme = "Persetujuan Pengelolaan Hutan Kemasyarakatan") => {
  const detail = requireEntry(details, key);
  detail.skExtraction = Object.assign({}, detail.skExtraction || {}, { decreeNumber, approvedAreaHa, scheme });
};
correctExtraction(decree9863, "SK.9863/MENLHK-PSKL/PKPS/PSL.0/9/2023", 143);
correctExtraction(decree9864, "SK.9864/MENLHK-PSKL/PKPS/PSL.0/9/2023", 184);
correctExtraction("10767 tahun 2024", "10767 TAHUN 2024", 650);

const mergeProfiles = ({ spatialKey, auditKey, canonicalKey, canonical }) => {
  const spatial = details[canonicalKey] || requireEntry(details, spatialKey);
  const audit = details[auditKey] || {};
  const merged = Object.assign({}, spatial, audit, canonical, {
    documents: [...(spatial.documents || []), ...(audit.documents || [])].filter((document, index, list) =>
      document && document.url && list.findIndex(other => other && other.url === document.url) === index
    ),
    spatialObjectKey: spatialKey,
    management: Object.assign({}, spatial.management || {}, audit.management || {}),
    beneficiaries: Object.assign({}, spatial.beneficiaries || {}, audit.beneficiaries || {}),
    bpsklProfile: Object.assign({}, spatial.bpsklProfile || {}, audit.bpsklProfile || {}),
    bpsklVerification: Object.assign({}, spatial.bpsklVerification || {}, audit.bpsklVerification || {})
  });
  const rebuilt = {};
  for (const [key, value] of Object.entries(details)) {
    if (key === spatialKey || key === auditKey || key === canonicalKey) {
      if (!Object.prototype.hasOwnProperty.call(rebuilt, canonicalKey)) rebuilt[canonicalKey] = merged;
      continue;
    }
    rebuilt[key] = value;
  }
  details = rebuilt;
  changes.push({ label: `Merge ${canonical.name}`, from: [spatialKey, auditKey], to: canonicalKey });
};

mergeProfiles({
  spatialKey: "3585.0",
  auditKey: "drive-audit:1oqeertrlpjieggsqiqoxcf-5u8piw2pc-kth-pahundan-tunas-buana-kepenghuluan-siarang-arang",
  canonicalKey: "8657 tahun 2025",
  canonical: {
    name: "KTH Pahundan Tunas Buana",
    village: "Siarang-Arang",
    district: "Pujud",
    regency: "Rokan Hilir",
    scheme: "Hutan Kemasyarakatan",
    decree: "8657 TAHUN 2025",
    areaHa: 1061,
    legalStatus: "SK terbit",
    skDocumentStatus: "available"
  }
});

mergeProfiles({
  spatialKey: "3587.0",
  auditKey: "drive-audit:1oqeertrlpjieggsqiqoxcf-5u8piw2pc-kth-pusaka-negeri-barokah-kepenghuluan-bangko-pusaka",
  canonicalKey: "8641 tahun 2025",
  canonical: {
    name: "KTH Pusaka Negeri Barokah",
    village: "Bangko Pusaka",
    district: "Bangko Pusaka",
    regency: "Rokan Hilir",
    scheme: "Hutan Kemasyarakatan",
    decree: "8641 TAHUN 2025",
    areaHa: 995.13,
    legalStatus: "SK terbit",
    skDocumentStatus: "available"
  }
});

mergeProfiles({
  spatialKey: "3458.0",
  auditKey: "sk.8469 tahun 2024",
  canonicalKey: "sk.8469 tahun 2024",
  canonical: {
    name: "Koperasi Petuah Negeri Hilir",
    village: "Kepenghuluan Serusa dan Parit Aman; Kepenghuluan Raja Bejamu, Sungai Nyamuk, Sungai Bakau, dan Sinaboi",
    district: "Bangko dan Sinaboi",
    regency: "Rokan Hilir",
    scheme: "Hutan Kemasyarakatan",
    decree: "SK.8469 TAHUN 2024",
    areaHa: 861,
    legalStatus: "SK terbit",
    skDocumentStatus: "available"
  }
});

const oldSamjKey = "drive-audit:rokan-hilir-gapoktan-sumber-alam-makmur-jaya";
const samjKey = "drive-audit:dumai-gapoktan-sumber-alam-makmur-jaya";
const samj = details[samjKey] || requireEntry(details, oldSamjKey);
Object.assign(samj, {
  village: "Batu Teritip",
  district: "Sungai Sembilan",
  regency: "Dumai",
  scheme: "Kemitraan Kehutanan"
});
samj.skExtraction = Object.assign({}, samj.skExtraction || {}, { scheme: "Kemitraan Kehutanan" });
if (samj.bpsklProfile) samj.bpsklProfile.sourceSheet = "Dumai";
if (samj.bpsklVerification) samj.bpsklVerification.sourceSheet = "Dumai";
if (!details[samjKey]) {
  const rebuilt = {};
  for (const [key, value] of Object.entries(details)) rebuilt[key === oldSamjKey ? samjKey : key] = key === oldSamjKey ? samj : value;
  details = rebuilt;
  changes.push({ label: "Move SAMJ administration", from: "Rokan Hilir", to: "Dumai" });
}

const siarangKey = "sk.7398/menlhk-pskl/pkps/psl.0/7/2023";
Object.assign(requireEntry(details, siarangKey), {
  name: "KTH Siarang-Arang Lestari",
  village: "Siarang-Arang",
  district: "Pujud",
  regency: "Rokan Hilir",
  decree: "SK.7398/MENLHK-PSKL/PKPS/PSL.0/7/2023"
});
Object.assign(requireEntry(details, "sk.684/menlhk-pskl/pkps/psl.0/2/2017"), {
  village: "Pujud Selatan",
  district: "Pujud",
  regency: "Rokan Hilir"
});
Object.assign(requireEntry(details, "sk.8469 tahun 2024"), {
  village: "Kepenghuluan Serusa dan Parit Aman; Kepenghuluan Raja Bejamu, Sungai Nyamuk, Sungai Bakau, dan Sinaboi",
  district: "Bangko dan Sinaboi",
  regency: "Rokan Hilir",
  directoryVillage: "Serusa, Parit Aman, Raja Bejamu, Sungai Nyamuk, Sungai Bakau, dan Sinaboi",
  directoryDistrict: "Bangko dan Sinaboi"
});

const staleProcessNames = new Set([
  "kth karya bersama",
  "kth pahundan tunas bersama",
  "kth pusaka negeri barokah"
]);
const beforeProcess = (processData.profiles || []).length;
processData.profiles = (processData.profiles || []).filter(profile =>
  !(norm(profile.regency) === "rokan hilir" && staleProcessNames.has(norm(profile.name)))
);
changes.push({ label: "Remove superseded Rokan Hilir process rows", from: beforeProcess, to: processData.profiles.length });

const rohilSpatial = (geo.features || []).filter(feature => norm((feature.properties || {}).NAMA_KAB) === "rokan hilir");
const uniqueRohilDecrees = new Set(rohilSpatial.map(feature => norm((feature.properties || {}).NO_IUPHKM)));
if (uniqueRohilDecrees.size !== 10) throw new Error(`Expected 10 unique Rokan Hilir decrees, found ${uniqueRohilDecrees.size}`);
if (norm(details[decree9863].name) !== "kth makmur pesisir") throw new Error("Makmur Pesisir detail key is not canonical");
if (norm(details[decree9864].name) !== "kth makmur jaya bersama") throw new Error("Makmur Jaya detail key is not canonical");
if (Object.values(details).some(detail => norm(detail.regency) === "rokan hilir" && norm(detail.name) === "gapoktan sumber alam makmur jaya")) throw new Error("SAMJ still classified as Rokan Hilir");

if (write) {
  fs.writeFileSync(geoPath, JSON.stringify(geo));
  fs.writeFileSync(detailsPath, `${JSON.stringify(details, null, 2)}\n`);
  const processRows = processData.profiles.map(profile => `    ${JSON.stringify(profile)}`).join(",\n");
  const compactProcess = `{
  "generatedAt": ${JSON.stringify(processData.generatedAt)},
  "source": ${JSON.stringify(processData.source)},
  "status": ${JSON.stringify(processData.status)},
  "profiles": [
${processRows}
  ]
}\n`;
  fs.writeFileSync(processPath, compactProcess);
}

console.log(JSON.stringify({ write, changeCount: changes.length, uniqueRohilDecrees: uniqueRohilDecrees.size, processRowsRemoved: beforeProcess - processData.profiles.length, changes }, null, 2));
