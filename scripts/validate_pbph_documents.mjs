import fs from "node:fs";

const registry=JSON.parse(fs.readFileSync("data/pbph-documents.json","utf8"));
const geo=JSON.parse(fs.readFileSync("data/PBPH_RIAU_052026.geojson","utf8"));
const ids=new Set((geo.features||[]).map(feature=>String(feature.properties?.PBPH_ID||"").trim()));
const allowedSvlk=new Set(["not-researched","audit-announcement-found","certificate-not-found","certificate-verified","certificate-expired","certificate-suspended","certificate-revoked"]);

for(const[id,profile]of Object.entries(registry.profiles||{})){
  if(!ids.has(id))throw new Error(`${id}: PBPH_ID tidak ditemukan pada snapshot.`);
  for(const document of profile.documents||[]){
    if(!/^https:\/\//.test(document.url||""))throw new Error(`${id}: dokumen PBPH wajib memakai URL HTTPS publik.`);
    if(!document.category||!document.label)throw new Error(`${id}: kategori dan label dokumen PBPH wajib diisi.`);
  }
  const svlk=profile.svlk;
  if(!svlk)continue;
  if(!allowedSvlk.has(svlk.status))throw new Error(`${id}: status SVLK tidak dikenal.`);
  if(svlk.status==="certificate-verified"&&(!svlk.certificateNumber||!svlk.validUntil||!svlk.lpvi||(svlk.documents||[]).length===0))throw new Error(`${id}: sertifikat terverifikasi memerlukan nomor, masa berlaku, LPVI, dan dokumen sumber.`);
  for(const document of svlk.documents||[]){if(!/^https:\/\//.test(document.url||""))throw new Error(`${id}: dokumen SVLK wajib memakai URL HTTPS publik.`)}
}
console.log(`PBPH document registry valid: ${Object.keys(registry.profiles||{}).length} profile(s).`);
