import fs from "node:fs";
import path from "node:path";

const argIndex=process.argv.indexOf("--month");
const month=argIndex>=0?process.argv[argIndex+1]:null;
if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||""))throw new Error("Gunakan --month YYYY-MM.");
const currentMonth=new Date().toISOString().slice(0,7);
if(month>=currentMonth)throw new Error("Bulan berjalan belum boleh diarsipkan.");

const registry=JSON.parse(fs.readFileSync("data/pbph-documents.json","utf8"));
const geo=JSON.parse(fs.readFileSync("data/PBPH_RIAU_052026.geojson","utf8"));
const grouped=new Map();
for(const feature of geo.features||[]){
  const p=feature.properties||{};
  const id=String(p.PBPH_ID||[p.NAMOBJ,p.NO_SK].filter(Boolean).join("|")).trim();
  if(!grouped.has(id))grouped.set(id,{id,name:p.NAMOBJ||"PBPH",sk:p.NO_SK||null,areaHa:Number(p.LSSK)||null,parts:0});
  grouped.get(id).parts++;
}

const counts={verified:0,followup:0,expired:0,suspended:0,revoked:0};
const profiles={};
for(const [id,base] of [...grouped.entries()].sort((a,b)=>a[1].name.localeCompare(b[1].name))){
  const source=registry.profiles?.[id]||{};
  const svlk=source.svlk||{status:"not-researched",statusLabel:"Belum ditelusuri"};
  if(svlk.status==="certificate-verified")counts.verified++;
  else if(svlk.status==="certificate-expired")counts.expired++;
  else if(svlk.status==="certificate-suspended")counts.suspended++;
  else if(svlk.status==="certificate-revoked")counts.revoked++;
  else counts.followup++;
  profiles[id]={...base,svlk,documentCount:(source.documents||[]).length,svlkDocumentCount:(svlk.documents||[]).length};
}

const snapshot={schemaVersion:1,month,status:"final",sourceUpdatedAt:registry.updatedAt,generatedAt:new Date().toISOString(),scope:"PBPH aktif dalam referensi batas Provinsi Riau pembaruan Mei 2026",summary:{pbph:grouped.size,...counts},methodology:"Snapshot bulanan dari register dokumen publik yang telah ditelusuri YG. Status hanya dicatat bila nomor, masa berlaku, LPVI, dan sumber pendukung tersedia.",disclaimer:"Belum ditemukan atau perlu penelusuran tidak berarti pemegang PBPH tidak memiliki sertifikat.",profiles};
const dir="data/phl-svlk-monthly";
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,`${month}.json`),JSON.stringify(snapshot,null,2)+"\n");
const indexPath=path.join(dir,"index.json");
const index=fs.existsSync(indexPath)?JSON.parse(fs.readFileSync(indexPath,"utf8")):{schemaVersion:1,reports:[]};
const entry={month,status:"final",generatedAt:snapshot.generatedAt,sourceUpdatedAt:snapshot.sourceUpdatedAt,summary:snapshot.summary,data:`data/phl-svlk-monthly/${month}.json`,href:`phl-svlk-monthly-report.html?month=${month}`};
index.reports=(index.reports||[]).filter(row=>row.month!==month).concat(entry).sort((a,b)=>b.month.localeCompare(a.month));
index.updatedAt=snapshot.generatedAt;
fs.writeFileSync(indexPath,JSON.stringify(index,null,2)+"\n");
console.log(`Arsip PHL/SVLK ${month}: ${snapshot.summary.pbph} PBPH, ${snapshot.summary.verified} terverifikasi.`);
