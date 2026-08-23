(function(){
"use strict";
var params=new URLSearchParams(location.search),key=String(params.get("key")||"").trim().toLowerCase(),map=null;
function el(id){return document.getElementById(id)}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function number(v){var n=Number(v);return isFinite(n)?n:null}
function format(v,d){var n=number(v);return n==null?"Belum tersedia":n.toLocaleString("id-ID",{maximumFractionDigits:d==null?2:d})}
function ha(v){var n=number(v);return n==null?"Belum tersedia":format(n,2)+" ha"}
function percent(v){var n=number(v);return n==null?"—":format(n,1)+"%"}
function normalized(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function analysisKeyValue(v){if(typeof v==="number"&&Number.isInteger(v))return v.toFixed(1);return String(v==null?"":v)}
function featureKey(f){var p=f&&f.properties||{};return analysisKeyValue(p.OBJECTID||p.ID||p.NO_IUPHKM||p.SK||[p.NAMA_HKM,p.NAMA_DESA,p.NAMA_KAB].filter(Boolean).join("|")).trim().toLowerCase()}
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
function renderIdentity(p,area){
  el("identity-list").innerHTML=[
    item("Kelompok/Hutan Desa",p.NAMA_HKM||"—"),item("Skema",p.Ket||"—"),item("Nomor izin",p.NO_IUPHKM||"—"),item("Tanggal izin",p.TGL_IUPHKM||"—"),
    item("Luas izin",number(p.L_IUPHKM)!=null?format(p.L_IUPHKM,2)+" ha":"—"),item("Luas polygon",ha(area)),item("Desa",p.NAMA_DESA||"—"),item("Kecamatan",p.NAMA_KEC||"—"),item("Kabupaten",p.NAMA_KAB||"—"),item("Provinsi",p.NAMA_PROV||"Riau")
  ].join("");
}
function renderSupplemental(detail){
  var section=el("sf-detail");
  if(!detail){section.hidden=true;return}
  var demography=detail.demography||{},management=detail.management||{},kups=Array.isArray(detail.kups)?detail.kups:[],documents=Array.isArray(detail.documents)?detail.documents:[];
  el("sf-detail-summary").innerHTML=[
    item("Lembaga pengelola",detail.name||"—"),
    item("KUPS",kups.length?kups.map(function(row){return row.name}).join(", "):"—"),
    item("Status legalitas KUPS",kups.length?kups.map(function(row){return row.legalStatus}).join(", "):"—"),
    item("Jumlah keluarga",number(demography.households)!=null?format(demography.households,0)+" KK":"—"),
    item("Jumlah penduduk",number(demography.population)!=null?format(demography.population,0)+" jiwa":"—"),
    item("Komposisi penduduk",number(demography.male)!=null&&number(demography.female)!=null?format(demography.male,0)+" laki-laki · "+format(demography.female,0)+" perempuan":"—"),
    item("KPH/FMU",management.forestManagementUnit||"—"),
    item("Ekosistem",management.ecosystem||"—"),
    item("Target area restorasi",number(management.restorationTargetHa)!=null?format(management.restorationTargetHa,0)+" ha":"—"),
    item("RKPS",management.rkpsStatus||"—")
  ].join("");
  el("sf-document-list").innerHTML=documents.map(function(doc){return '<a href="'+esc(doc.url)+'" target="_blank" rel="noopener noreferrer"><span>'+esc(doc.category||"Dokumen")+'</span><strong>'+esc(doc.label||"Buka dokumen")+'</strong><b aria-hidden="true">↗</b></a>'}).join("");
  el("sf-detail-note").textContent="Sumber demografi: "+(demography.source||"dokumen organisasi")+". Angka kegiatan dan capaian lapangan akan ditambahkan setelah tersedia laporan pendukung.";
  section.hidden=false;
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
  renderIdentity(p,area);renderSupplemental(detail);renderLoss(record,method);renderHotspots(record);renderReferences(record,area);
  el("loading-state").hidden=true;el("profile-content").hidden=false;requestAnimationFrame(function(){renderMap(feature,name)});
}
async function init(){
  if(!key){showError("Tautan areal tidak lengkap. Pilih Perhutanan Sosial melalui WebGIS.");return}
  try{
    var results=await Promise.all([json("data/village-forest-analytics.json?v=20260822-social-profile1"),json("data/PERHUTANAN_SOSIAL_RIAU.geojson?v=20260822-social-profile1"),json("data/social-forestry-details.json?v=20260823-sungai-linau-public2")]),data=results[0],geo=results[1],details=results[2]||{};
    var feature=(geo.features||[]).find(function(f){return featureKey(f)===key});
    var record=(data.socialForestry||{})[key];
    if(!feature&&record){feature=(geo.features||[]).find(function(f){return normalized((f.properties||{}).NAMA_HKM)===normalized(record.name)})}
    if(!record&&feature){var fk=featureKey(feature);record=(data.socialForestry||{})[fk]}
    if(!feature||!feature.geometry)throw new Error("Polygon Perhutanan Sosial tidak ditemukan.");
    if(!record)throw new Error("Analisis tutupan pohon untuk areal ini belum tersedia.");
    render(feature,record,data,details[key]||null);
  }catch(e){console.error(e);showError(e.message||"Profil gagal dimuat.")}
}
el("print-profile").addEventListener("click",function(){window.print()});
el("share-profile").addEventListener("click",async function(){try{if(navigator.share){await navigator.share({title:document.title,url:location.href});return}await navigator.clipboard.writeText(location.href);toast("Tautan profil disalin")}catch(e){if(e&&e.name!=="AbortError")toast("Tautan belum dapat disalin")}});
init();
})();
