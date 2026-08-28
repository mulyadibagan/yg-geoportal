const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const detailsPath = path.join(root, "data", "social-forestry-details.json");
const geoPath = path.join(root, "data", "PERHUTANAN_SOSIAL_RIAU.geojson");
const auditPath = path.join(root, "data", "social-forestry-sk-drive-audit.json");
const details = JSON.parse(fs.readFileSync(detailsPath, "utf8"));
const geo = JSON.parse(fs.readFileSync(geoPath, "utf8"));
const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
const byFolder = new Map(audit.entries.map(entry => [entry.driveFolderId, entry]));
const duplicateIds = new Set(audit.duplicateProfiles.map(item => item.removeFromPublicIndexDriveFolderId));
for (const key of Object.keys(details)) {
  const detail = details[key] || {};
  if (duplicateIds.has(detail.driveFolderId)) { delete details[key]; continue; }
  const source = byFolder.get(detail.driveFolderId);
  if (!source) continue;
  // Folder kabupaten in the audited Drive tree is authoritative for the
  // administrative location.  Preserve richer profile values, but fill the
  // common gaps left by OCR-only profiles.
  if (!detail.regency && source.regency) detail.regency = source.regency;
  if (!detail.province) detail.province = "Riau";
  const existing = Array.isArray(detail.documents) ? detail.documents.filter(Boolean) : [];
  const retained = existing.filter(doc => !/^legalitas$/i.test(String(doc.category || "")));
  detail.documents = retained.concat(source.documents.map(doc => ({label:doc.label,category:doc.category,url:doc.url})));
  detail.skDocumentStatus = "available";
  detail.skDocumentCheckedAt = audit.generatedAt;
}
for (const item of audit.unresolved) {
  const matchKey = Object.keys(details).find(key => {
    const d=details[key]||{};
    return d.driveFolderId===item.driveFolderId || String(d.decree||"").toLowerCase()===item.decree.toLowerCase();
  });
  if (!matchKey) continue;
  const detail=details[matchKey];
  detail.skDocumentStatus="missing";
  detail.skDocumentCheckedAt=audit.generatedAt;
  detail.skReference={decreeNumber:item.decree,status:"Nomor SK terverifikasi; PDF SK belum tersedia"};
  detail.documents=(Array.isArray(detail.documents)?detail.documents:[]).filter(doc=>!/^legalitas$/i.test(String(doc&&doc.category||"")));
}
const regencyByCode={"1401":"Kampar","1402":"Indragiri Hulu","1403":"Bengkalis","1404":"Indragiri Hilir","1405":"Pelalawan","1406":"Rokan Hulu","1407":"Rokan Hilir","1408":"Siak","1409":"Kuantan Singingi","1410":"Kepulauan Meranti"};
for(const feature of geo.features||[]){const p=feature&&feature.properties||{};const code=String(p.KODE_KAB||p.KD_KAB||p.KODEKAB||"").trim();if(regencyByCode[code])p.NAMA_KAB=regencyByCode[code]}
fs.writeFileSync(detailsPath,JSON.stringify(details,null,2)+"\n");
fs.writeFileSync(geoPath,JSON.stringify(geo)+"\n");
