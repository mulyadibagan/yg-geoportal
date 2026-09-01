(function(){
"use strict";
var params=new URLSearchParams(location.search),id=String(params.get("id")||"").trim(),map=null,REPORT_START="2026-07";
function el(id){return document.getElementById(id)}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function norm(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function number(v){var n=Number(v);return isFinite(n)?n:null}
function format(v,d){var n=number(v);return n==null?"—":n.toLocaleString("id-ID",{maximumFractionDigits:d==null?2:d})}
function item(label,value){return'<div><span>'+esc(label)+'</span><strong>'+esc(value==null||value===""?"—":value)+'</strong></div>'}
function kpi(icon,label,value,note){return'<article class="vp-kpi"><div class="vp-kpi__icon">'+esc(icon)+'</div><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(note||"")+'</small></article>'}
function toast(message){var n=el("toast");n.textContent=message;n.classList.add("is-visible");setTimeout(function(){n.classList.remove("is-visible")},2200)}
function showError(message){el("loading-state").hidden=true;el("error-message").textContent=message;el("error-state").hidden=false}
async function json(url){var r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}
function dateValue(value){if(value==null||value==="")return"—";var d=typeof value==="number"?new Date(value):new Date(String(value));return isNaN(d.getTime())?String(value):d.toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})}
function monthLabel(value){var parts=String(value).split("-"),d=new Date(Number(parts[0]),Number(parts[1])-1,1);return d.toLocaleDateString("id-ID",{month:"long",year:"numeric"})}
function profileId(feature){var p=feature&&feature.properties||{};return String(p.PBPH_ID||[p.NAMOBJ,p.NO_SK].filter(Boolean).join("|")).trim()}
function samePermit(a,b){var pa=a||{},pb=b||{};return norm(pa.name||pa.NAMOBJ)===norm(pb.name||pb.NAMOBJ)&&(norm(pa.sk||pa.NO_SK)===norm(pb.sk||pb.NO_SK)||!pa.sk||!pb.sk)}
function renderMap(features,name){
  map=L.map("village-map",{zoomControl:true,scrollWheelZoom:false});
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxNativeZoom:17,maxZoom:20,attribution:"Tiles © Esri"}).addTo(map);
  var layer=L.geoJSON({type:"FeatureCollection",features:features},{style:{color:"#c2410c",weight:3,opacity:1,fillColor:"#f97316",fillOpacity:.18}}).addTo(map),bounds=layer.getBounds();
  if(bounds.isValid())map.fitBounds(bounds,{padding:[24,24],maxZoom:13});layer.bindTooltip(name,{direction:"center"});
}
function renderDocuments(registry,profile){
  var entry=registry.profiles&&registry.profiles[id]||{},docs=Array.isArray(entry.documents)?entry.documents:[];
  el("pbph-document-list").innerHTML=docs.map(function(doc){return'<a href="'+esc(doc.url)+'" target="_blank" rel="noopener noreferrer"><span>'+esc(doc.category||"Dokumen pendukung")+'</span><strong>'+esc(doc.label||"Buka dokumen")+'</strong><b aria-hidden="true">↗</b></a>'}).join("");
  el("document-count").textContent=docs.length+" dokumen";el("document-empty").hidden=docs.length>0;
  el("document-note").textContent=docs.length?"Dokumen ditampilkan dari register publik yang telah diperiksa.":"Dokumen SK/lampiran untuk "+profile.NAMOBJ+" belum ditemukan atau belum memiliki tautan publik terverifikasi. Dokumen terkait yang bukan keputusan PBPH tidak ditampilkan sebagai SK.";
  renderSvlk(entry.svlk||null);
}
function renderSvlk(svlk){
  var status=el("svlk-status"),details=el("svlk-details"),docs=svlk&&Array.isArray(svlk.documents)?svlk.documents:[];
  if(!svlk){status.textContent="Belum ditelusuri";status.className="pbph-svlk-status";details.innerHTML=[item("Status sertifikat","Belum terverifikasi"),item("LPVI","Belum tersedia"),item("Pemeriksaan terakhir","Belum tersedia")].join("");el("svlk-note").textContent="Integrasi SVLK disiapkan. Status sertifikat tidak akan disimpulkan tanpa nomor, masa berlaku, LPVI, dan sumber resmi."}
  else{var verified=svlk.status==="certificate-verified";status.textContent=svlk.statusLabel||"Status tersedia";status.className="pbph-svlk-status "+(verified?"is-verified":"is-found");details.innerHTML=[item("Status sertifikat",svlk.certificateStatus||"Belum terverifikasi"),item("Ruang lingkup",svlk.scope||"—"),item("Jenis audit",svlk.auditType||"—"),item("Periode audit",svlk.auditPeriod||"—"),item("LPVI",svlk.lpvi||"—"),item("Nomor / berlaku",[svlk.certificateNumber,svlk.validUntil].filter(Boolean).join(" · ")||"Belum terverifikasi")].join("");el("svlk-note").textContent=(svlk.note||"")+(svlk.checkedAt?" Pemeriksaan sumber: "+dateValue(svlk.checkedAt)+".":"")}
  el("svlk-document-list").innerHTML=docs.map(function(doc){return'<a href="'+esc(doc.url)+'" target="_blank" rel="noopener noreferrer"><span>'+esc(doc.category||"Dokumen SVLK")+'</span><strong>'+esc(doc.label||"Buka dokumen")+'</strong><b aria-hidden="true">↗</b></a>'}).join("");
}
function reportPermit(report,profile){return(report.companies||[]).find(function(row){return samePermit(row,{name:profile.NAMOBJ,sk:profile.NO_SK})})||null}
function reportDetections(report,profile){return(report.hotspots||[]).filter(function(point){return(point.permits||[]).some(function(row){return samePermit(row,{name:profile.NAMOBJ,sk:profile.NO_SK})})})}
function renderAnnualReports(reports,profile){
  var grouped={};reports.forEach(function(report){var year=String(report.month||"").slice(0,4),permit=reportPermit(report,profile),points=reportDetections(report,profile);if(!grouped[year])grouped[year]={hotspots:0,dates:new Set(),months:[]};grouped[year].hotspots+=permit?Number(permit.hotspots)||0:0;points.forEach(function(point){if(point.date)grouped[year].dates.add(point.date)});grouped[year].months.push(report.month)});
  var years=Object.keys(grouped).sort().reverse();el("annual-hotspots").innerHTML=years.map(function(year){var row=grouped[year],months=row.months.sort(),coverage=months.length?monthLabel(months[0])+(months.length>1?" – "+monthLabel(months[months.length-1]):""):"Belum ada bulan final";return'<div class="vp-annual-row"><strong>'+esc(year)+'</strong><span>'+format(row.hotspots,0)+' hotspot</span><span>'+format(row.dates.size,0)+' hari deteksi</span><small>'+esc(coverage)+' · '+months.length+' laporan bulanan final</small></div>'}).join("")||'<div class="pbph-empty">Rekap tahunan belum tersedia.</div>';
  el("annual-hotspot-note").textContent="Rekap dihitung sejak Juli 2026. Tahun 2026 bukan periode Januari–Desember penuh.";
}
function renderReports(reports,profile){
  renderAnnualReports(reports,profile);
  var total=0,detections=[];el("monthly-hotspots").innerHTML=reports.map(function(report){var permit=reportPermit(report,profile),count=permit?Number(permit.hotspots)||0:0;total+=count;reportDetections(report,profile).forEach(function(point){detections.push({point:point,month:report.month})});return'<a class="pbph-month" href="fire-monthly-report.html?month='+encodeURIComponent(report.month)+'"><span>'+esc(monthLabel(report.month))+'</span><strong>'+format(count,0)+'</strong><b>hotspot dalam PBPH</b><small>'+esc(report.status==="final"?"Laporan final":"Laporan sementara")+' · buka laporan →</small></a>'}).join("");
  if(!reports.length)el("monthly-hotspots").innerHTML='<div class="pbph-empty">Laporan bulanan mulai Juli 2026 belum tersedia.</div>';
  el("hotspot-note").textContent="Total "+format(total,0)+" hotspot dari "+reports.length+" laporan bulanan yang tersedia sejak Juli 2026. Bulan final tanpa irisan ditampilkan sebagai nol.";
  detections.sort(function(a,b){return String(b.point.date).localeCompare(String(a.point.date))});el("hotspot-list").innerHTML=detections.map(function(row){var p=row.point;return'<tr><td>'+esc(p.date||"—")+'</td><td>'+esc(p.village||"—")+'</td><td>'+esc(p.regency||"—")+'</td><td>'+esc(p.satellite||"—")+'</td><td>'+esc(number(p.frp)==null?"—":format(p.frp,1)+" MW")+'</td><td><a href="fire-monthly-report.html?month='+encodeURIComponent(row.month)+'">'+esc(monthLabel(row.month))+'</a></td></tr>'}).join("");
  el("hotspot-empty").hidden=detections.length>0;el("hotspot-list").parentElement.parentElement.hidden=detections.length===0;
  return total;
}
function render(features,reports,registry){
  var p=features[0].properties||{},area=number(p.LSSK),total=renderReports(reports,p),latest=reports[reports.length-1];
  document.title=(p.NAMOBJ||"PBPH")+" · Profil PBPH | Yayasan Gambut";el("area-name").textContent=p.NAMOBJ||"Profil PBPH";el("area-location").textContent=[p.JENIS,p.KEGIATAN].filter(Boolean).join(" · ");el("data-updated").textContent=latest?"Laporan terakhir "+monthLabel(latest.month):"Laporan bulanan belum tersedia";
  el("kpi-grid").innerHTML=[kpi("⌗","Luas SK akhir",area==null?"—":format(area,2)+" ha","atribut sumber PBPH"),kpi("◫","Bagian polygon",format(features.length,0),"digabung dalam profil"),kpi("▤","Laporan tersedia",format(reports.length,0),"mulai Juli 2026"),kpi("◉","Hotspot dalam laporan",format(total,0),"akumulasi laporan bulanan")].join("");
  el("identity-list").innerHTML=[item("Pemegang PBPH",p.NAMOBJ),item("PBPH ID",p.PBPH_ID),item("Nomor SK",p.NO_SK),item("Tanggal SK",dateValue(p.TGL_SK)),item("Luas SK akhir",area==null?"—":format(area,2)+" ha"),item("Jenis PBPH",p.JENIS),item("Kegiatan",p.KEGIATAN)].join("");
  renderDocuments(registry,p);el("loading-state").hidden=true;el("profile-content").hidden=false;requestAnimationFrame(function(){renderMap(features,p.NAMOBJ||"PBPH")});
}
async function init(){
  if(!id){showError("Tautan PBPH tidak lengkap. Pilih areal melalui WebGIS.");return}
  try{
    var base=await Promise.all([json("data/PBPH_RIAU_052026.geojson?v=20260831-profile1"),json("data/fire-monthly/index.json?v=20260831-profile1"),json("data/pbph-documents.json?v=20260831-profile1")]),geo=base[0],index=base[1],registry=base[2],features=(geo.features||[]).filter(function(feature){return profileId(feature)===id});
    if(!features.length)throw new Error("Areal PBPH tidak ditemukan pada snapshot Mei 2026.");
    var entries=(index.reports||[]).filter(function(row){return row.month>=REPORT_START&&row.status==="final"}).sort(function(a,b){return a.month.localeCompare(b.month)}),reports=await Promise.all(entries.map(function(row){return json(row.data+"?v="+encodeURIComponent(row.generatedAt||"1"))}));render(features,reports,registry);
  }catch(e){console.error(e);showError(e.message||"Profil PBPH gagal dimuat.")}
}
el("print-profile").addEventListener("click",function(){window.print()});el("share-profile").addEventListener("click",async function(){try{if(navigator.share){await navigator.share({title:document.title,url:location.href});return}await navigator.clipboard.writeText(location.href);toast("Tautan profil disalin")}catch(e){if(e&&e.name!=="AbortError")toast("Tautan belum dapat disalin")}});init();
})();
