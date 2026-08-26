(function(){
"use strict";
var params=new URLSearchParams(location.search),key=String(params.get("key")||"").trim().toLowerCase(),map=null;
var keyAliases={"drive-audit:kampar-lphd-kenagarian-pangkalan-kapas":"sk.3072/menlhk-pskl/pkps/psl.0/5/2018"};
key=keyAliases[key]||key;
function el(id){return document.getElementById(id)}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function number(v){var n=Number(v);return isFinite(n)?n:null}
function format(v,d){var n=number(v);return n==null?"Belum tersedia":n.toLocaleString("id-ID",{maximumFractionDigits:d==null?2:d})}
function ha(v){var n=number(v);return n==null?"Belum tersedia":format(n,2)+" ha"}
function percent(v){var n=number(v);return n==null?"—":format(n,1)+"%"}
function normalized(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function analysisKeyValue(v){if(typeof v==="number"&&Number.isInteger(v))return v.toFixed(1);return String(v==null?"":v)}
function featureKey(f){var p=f&&f.properties||{};return analysisKeyValue(p.OBJECTID||p.ID||p.NO_IUPHKM||p.SK||[p.NAMA_HKM,p.NAMA_DESA,p.NAMA_KAB].filter(Boolean).join("|")).trim().toLowerCase()}
function permitKey(f){var p=f&&f.properties||{};return analysisKeyValue(p.NO_IUPHKM||p.SK||p.OBJECTID||p.ID||[p.NAMA_HKM,p.NAMA_DESA,p.NAMA_KAB].filter(Boolean).join("|")).trim().toLowerCase()}
function kpi(icon,label,value,note){return'<article class="vp-kpi"><div class="vp-kpi__icon">'+esc(icon)+'</div><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(note||"")+'</small></article>'}
function item(label,value){return'<div><span>'+esc(label)+'</span><strong>'+esc(value==null||value===""?"—":value)+'</strong></div>'}
function showError(message){el("loading-state").hidden=true;el("error-message").textContent=message;el("error-state").hidden=false}
function toast(message){var n=el("toast");n.textContent=message;n.classList.add("is-visible");setTimeout(function(){n.classList.remove("is-visible")},2200)}
async function json(url){var r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}
function renderMap(feature,name){
  map=L.map("village-map",{zoomControl:true,scrollWheelZoom:false});
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxNativeZoom:17,maxZoom:20,attribution:"Tiles © Esri"}).addTo(map);
  var layer=L.geoJSON(feature,{style:{color:"#00b89c",weight:4,opacity:1,fillColor:"#087f78",fillOpacity:.16}}).addTo(map);
  var b=layer.getBounds();if(b.isValid())map.fitBounds(b,{padding:[24,24],maxZoom:14});
  layer.bindTooltip(name,{direction:"center"});
}
function renderLoss(record,method){
  var annual=record.annualLossHa||{},years=Object.keys(annual).sort(),values=years.map(function(y){return number(annual[y])}),available=values.filter(function(v){return v!=null}),max=Math.max.apply(Math,[1].concat(available));
  el("loss-bars").innerHTML=years.map(function(year){var value=number(annual[year]),empty=value==null,width=empty?0:value/max*100;return'<div class="vp-bar'+(empty?' vp-bar--empty':'')+'"><span>'+esc(year)+'</span><div class="vp-bar__track"><div class="vp-bar__fill" style="width:'+width.toFixed(2)+'%"></div></div><strong>'+(empty?'Belum ada':format(value,1)+' ha')+'</strong></div>'}).join("");
  el("loss-chart-title").textContent="Kehilangan tutupan pohon "+(years[0]||"")+"–"+(years[years.length-1]||"");
  el("loss-note").textContent="Data tersedia sampai "+(method.lossDataThroughYear||"tahun terakhir")+". Tahun setelah cakupan sumber ditandai “Belum ada”, bukan nol.";
}
function renderHotspots(record){
  el("hotspot-summary").innerHTML='<div class="vp-hotspot-box"><span>7 hari terakhir</span><strong>'+format(record.hotspot7d,0)+'</strong></div><div class="vp-hotspot-box"><span>30 hari terakhir</span><strong>'+format(record.hotspot30d,0)+'</strong></div>';
  var rows=Array.isArray(record.hotspotYearly5y)?record.hotspotYearly5y:[],max=Math.max.apply(Math,[1].concat(rows.map(function(x){return number(x.count)||0})));
  el("hotspot-years").innerHTML=rows.map(function(x){var v=number(x.count)||0,h=Math.max(3,v/max*88);return'<div class="vp-mini"><strong>'+format(v,0)+'</strong><div class="vp-mini__bar" style="height:'+h.toFixed(1)+'px"></div><span>'+esc(x.year)+'</span></div>'}).join("");
}
function renderReferences(record,area){
  var r=record.referenceAreasHa||{},rows=[["APL",r.apl],["Hutan produksi",r.productionForest],["Hutan lindung",r.protectionForest],["Kawasan konservasi",r.conservation],["Ekosistem gambut",r.peat],["Konsesi",r.concession],["Perhutanan sosial",r.socialForestry]];
  el("reference-list").innerHTML=rows.map(function(x){var v=number(x[1]),w=v!=null&&area?Math.min(100,v/area*100):0;return'<div class="vp-reference"><span>'+esc(x[0])+'</span><strong>'+esc(ha(v))+'</strong><div class="vp-reference__track"><div class="vp-reference__fill" style="width:'+w.toFixed(2)+'%"></div></div></div>'}).join("");
}
function renderIdentity(p,area,detail){
  var legal=detail&&detail.skExtraction?detail.skExtraction:{};
  el("identity-list").innerHTML=[
    item("Kelompok/Hutan Desa",detail&&detail.name?detail.name:(p.NAMA_HKM||"—")),item("Skema",legal.scheme||p.Ket||"—"),item("Nomor SK",legal.decreeNumber||p.NO_IUPHKM||"—"),item("Tanggal SK",legal.decreeDate||p.TGL_IUPHKM||"—"),
    item("Luas berdasarkan SK",number(legal.approvedAreaHa)!=null?format(legal.approvedAreaHa,0)+" ha":(number(p.L_IUPHKM)!=null?format(p.L_IUPHKM,2)+" ha":"—")),item("Luas hasil kalkulasi polygon",ha(area)),item("Desa",p.NAMA_DESA||"—"),item("Kecamatan",p.NAMA_KEC||"—"),item("Kabupaten",p.NAMA_KAB||"—"),item("Provinsi",p.NAMA_PROV||"Riau")
  ].join("");
  var badge=document.querySelector(".vp-sf-status");
  if(badge)badge.textContent=legal.decreeNumber?"Data spasial & SK terverifikasi":"Layer referensi";
}
function renderSupplemental(detail){
  var section=el("sf-detail");
  if(!detail){section.hidden=true;return}
  var demography=detail.demography||{},management=detail.management||{},legal=detail.skExtraction||{},beneficiaries=detail.beneficiaries||{},kups=Array.isArray(detail.kups)?detail.kups:[],documents=Array.isArray(detail.documents)?detail.documents:[];
  var unavailable="Belum tersedia",kupsNames=kups.map(function(row){return row.name}).filter(Boolean).join(", "),kupsLegal=kups.map(function(row){return row.legalStatus}).filter(Boolean).join(", ");
  var summary=legal.decreeNumber?[
    item("Lembaga pengelola",detail.name||unavailable),item("Masa berlaku",legal.validity||unavailable),
    item("Periode persetujuan",legal.validityPeriod||unavailable),item("Evaluasi",legal.evaluation||unavailable),
    item("Fungsi kawasan hutan",legal.forestFunctions||unavailable),item("KPH/FMU",management.forestManagementUnit||unavailable),
    item("Ekosistem",management.ecosystem||unavailable),item("Penerima manfaat langsung",number(beneficiaries.direct)!=null?format(beneficiaries.direct,0)+" orang":unavailable),
    item("Komposisi penerima langsung",number(beneficiaries.male)!=null&&number(beneficiaries.female)!=null?format(beneficiaries.male,0)+" laki-laki · "+format(beneficiaries.female,0)+" perempuan":unavailable),
    item("Penerima manfaat tidak langsung",number(beneficiaries.indirectHouseholds)!=null?format(beneficiaries.indirectHouseholds,0)+" keluarga":unavailable),
    item("Pengurus inti",[management.chairperson&&"Ketua: "+management.chairperson,management.viceChairperson&&"Wakil: "+management.viceChairperson,management.secretary&&"Sekretaris: "+management.secretary,management.treasurer&&"Bendahara: "+management.treasurer].filter(Boolean).join(" · ")||unavailable)
  ]:[
    item("Lembaga pengelola",detail.name||unavailable),item("KUPS",kupsNames||unavailable),
    item("Status legalitas KUPS",kupsLegal||unavailable),item("Jumlah keluarga",number(demography.households)!=null?format(demography.households,0)+" KK":unavailable),
    item("Jumlah penduduk",number(demography.population)!=null?format(demography.population,0)+" jiwa":unavailable),item("Komposisi penduduk",number(demography.male)!=null&&number(demography.female)!=null?format(demography.male,0)+" laki-laki · "+format(demography.female,0)+" perempuan":unavailable),
    item("KPH/FMU",management.forestManagementUnit||unavailable),item("Ekosistem",management.ecosystem||unavailable),
    item("Target area restorasi",number(management.restorationTargetHa)!=null?format(management.restorationTargetHa,0)+" ha":unavailable),item("RKPS",management.rkpsStatus||unavailable)
  ];
  el("sf-detail-summary").innerHTML=summary.join("");
  el("sf-document-list").innerHTML=documents.map(function(doc){return '<a href="'+esc(doc.url)+'" target="_blank" rel="noopener noreferrer"><span>'+esc(doc.category||"Dokumen")+'</span><strong>'+esc(doc.label||"Buka dokumen")+'</strong><b aria-hidden="true">↗</b></a>'}).join("");
  el("sf-detail-note").textContent=legal.decreeNumber?"Sumber: "+(legal.source||"dokumen SK")+" beserta lampirannya.":demography.source?"Sumber demografi: "+demography.source+". Kolom tanpa data ditandai Belum tersedia.":"Dokumen berasal dari arsip organisasi. Kolom tanpa data ditandai Belum tersedia.";
  section.hidden=false;
}
function renderNonspatial(detail){
  var documents=Array.isArray(detail.documents)?detail.documents:[],name=detail.name||"Profil Perhutanan Sosial",location=[detail.village,detail.district,detail.regency].filter(Boolean).join(" · ");
  document.title=name+" · Profil Perhutanan Sosial | Yayasan Gambut";el("area-name").textContent=name;el("area-location").textContent=location||"Lokasi administratif belum tersedia";
  document.querySelector(".vp-status").innerHTML="<i></i> Profil dokumen nonspasial";el("data-updated").textContent="Sumber: audit Drive Yayasan Gambut";
  el("profile-summary").innerHTML="<span>STATUS PROFIL</span><strong>Polygon belum tersedia</strong><p>Dokumen ditampilkan tanpa mengarang batas, luas, atau analisis spasial.</p>";
  el("kpi-grid").innerHTML=[kpi("▤","Dokumen terpublikasi",format(documents.length,0),"hasil audit Drive"),kpi("⌖","Kabupaten",detail.regency||"Belum tersedia","lokasi administratif"),kpi("◎","Status spasial","Nonspasial","polygon belum tersedia")].join("");
  document.querySelectorAll("[data-spatial-only]").forEach(function(node){node.hidden=true});
  document.querySelector(".vp-layout").classList.add("vp-layout--single");
  el("identity-list").innerHTML=[item("Kelompok/Hutan Desa",name),item("Skema",detail.scheme||"Profil dokumen nonspasial"),item("Nomor izin",detail.decree||"Belum tersedia"),item("Tanggal izin","Belum tersedia"),item("Luas izin",detail.areaHa?format(detail.areaHa,2)+" ha":"Belum tersedia"),item("Luas polygon","Belum tersedia"),item("Desa",detail.village||"Belum tersedia"),item("Kecamatan",detail.district||"Belum tersedia"),item("Kabupaten",detail.regency||"Belum tersedia"),item("Provinsi","Riau")].join("");
  renderSupplemental(detail);el("loading-state").hidden=true;el("error-state").hidden=true;el("profile-content").hidden=false;
}
function render(feature,record,data,detail){
  var p=feature.properties||{},method=data.method||{},viirs=data.viirs||{},name=p.NAMA_HKM||record.name||p.NAMA_DESA||"Perhutanan Sosial";
  var area=number(p.LUAS_POLI)||number(p.L_IUPHKM),baseline=number(record.baselineForestHa),current=number(record.currentForestHa),loss=number(record.totalLossHa),gain=number(record.gainHa);
  var share=area&&current!=null?Math.max(0,Math.min(100,current/area*100)):null;
  document.title=name+" · Profil Perhutanan Sosial | Yayasan Gambut";el("area-name").textContent=name;el("area-location").textContent=[p.NAMA_DESA,p.NAMA_KEC,p.NAMA_KAB].filter(Boolean).join(" · ");
  var updated=viirs.updatedAt||data.generatedAt;el("data-updated").textContent=updated?"Pembaruan analisis "+new Date(updated).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"}):"Tanggal pembaruan belum tersedia";
  el("kpi-grid").innerHTML=[kpi("⌗","Luas areal",ha(area),"berdasarkan polygon analisis"),kpi("♣","Tutupan pohon baseline",ha(baseline),"baseline "+(method.baselineYear||2000)),kpi("◒","Sisa tutupan pohon",ha(current),share==null?"persentase belum tersedia":percent(share)+" dari luas areal"),kpi("↘","Kehilangan kumulatif",ha(loss),gain!=null?"pertambahan terpetakan "+ha(gain):"akumulasi pixel kehilangan")].join("");
  el("forest-percent").textContent=percent(share);el("current-forest").textContent=ha(current);el("forest-donut").style.setProperty("--value",share==null?0:share);
  el("forest-definition").textContent="Baseline "+(method.baselineYear||2000)+" dikurangi kehilangan"+(gain!=null?" dan ditambah pertambahan terpetakan":"")+". Angka bersifat indikatif.";
  el("baseline-period").textContent=method.baselineYear||"—";el("loss-through").textContent=method.lossDataThroughYear||"—";
  renderIdentity(p,area,detail);renderSupplemental(detail);renderLoss(record,method);renderHotspots(record);renderReferences(record,area);
  el("loading-state").hidden=true;el("error-state").hidden=true;el("profile-content").hidden=false;requestAnimationFrame(function(){renderMap(feature,name)});
}
async function init(){
  if(!key){showError("Tautan areal tidak lengkap. Pilih Perhutanan Sosial melalui WebGIS.");return}
  try{
    var results=await Promise.all([json("data/village-forest-analytics.json?v=20260822-social-profile1"),json("data/PERHUTANAN_SOSIAL_RIAU.geojson?v=20260824-kth-alam-hijau-pelalawan1"),json("data/social-forestry-details.json?v=20260824-ps-publish-profile1")]),data=results[0],geo=results[1],details=results[2]||{};
    var feature=(geo.features||[]).find(function(f){return permitKey(f)===key||featureKey(f)===key});
    var record=(data.socialForestry||{})[key];
    if(!feature&&record){feature=(geo.features||[]).find(function(f){return normalized((f.properties||{}).NAMA_HKM)===normalized(record.name)})}
    if(!record&&feature){var fk=featureKey(feature);record=(data.socialForestry||{})[fk]}
    var directDetail=details[key]||null;
    if((!feature||!feature.geometry)&&directDetail){renderNonspatial(directDetail);return}
    if(!feature||!feature.geometry)throw new Error("Polygon Perhutanan Sosial tidak ditemukan.");
    if(!record)throw new Error("Analisis tutupan pohon untuk areal ini belum tersedia.");
    var detailKey=permitKey(feature),detail=details[detailKey]||details[featureKey(feature)]||null,approvedDocument=null;
    try{approvedDocument=JSON.parse(localStorage.getItem("ygPsApprovedDocument:"+key)||"null")}catch(ignore){}
    if(approvedDocument){detail=Object.assign({name:(feature.properties||{}).NAMA_HKM||record.name||"Profil PS"},detail||{});detail.documents=Array.isArray(detail.documents)?detail.documents.slice():[];if(!detail.documents.some(function(doc){return doc.url===approvedDocument.url}))detail.documents.push(approvedDocument)}
    render(feature,record,data,detail);
  }catch(e){console.error(e);showError(e.message||"Profil gagal dimuat.")}
}
el("print-profile").addEventListener("click",function(){window.print()});
el("share-profile").addEventListener("click",async function(){try{if(navigator.share){await navigator.share({title:document.title,url:location.href});return}await navigator.clipboard.writeText(location.href);toast("Tautan profil disalin")}catch(e){if(e&&e.name!=="AbortError")toast("Tautan belum dapat disalin")}});
init();
})();
