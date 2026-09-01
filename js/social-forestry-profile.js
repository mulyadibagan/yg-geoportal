(function(){
"use strict";
var params=new URLSearchParams(location.search),key=String(params.get("key")||"").trim().toLowerCase(),map=null,monthlyHotspotLayer=null,monthlyHotspotPoints=[];
var keyAliases={"drive-audit:kampar-lphd-kenagarian-pangkalan-kapas":"sk.3072/menlhk-pskl/pkps/psl.0/5/2018","drive-audit:kampar-mha-kenegerian-kampa":"sk.7504/menlhk-pskl/pktha/kum.1/9/2019","drive-audit:bengkalis-gapoktan-rupat-agro-mandiri":"13528 tahun 2024"};
key=keyAliases[key]||key;
function el(id){return document.getElementById(id)}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function number(v){var n=Number(v);return isFinite(n)?n:null}
function format(v,d){var n=number(v);return n==null?"Belum tersedia":n.toLocaleString("id-ID",{maximumFractionDigits:d==null?2:d})}
function ha(v){var n=number(v);return n==null?"Belum tersedia":format(n,2)+" ha"}
function percent(v){var n=number(v);return n==null?"—":format(n,1)+"%"}
function displayDate(v){var value=String(v==null?"":v).trim();return!value||/^0(?:\.0+)?$/.test(value)||/^1899-12-30/.test(value)?"—":value}
function normalized(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function analysisKeyValue(v){if(typeof v==="number"&&Number.isInteger(v))return v.toFixed(1);return String(v==null?"":v)}
function featureKey(f){var p=f&&f.properties||{};return analysisKeyValue(p.PROFILE_KEY||p.OBJECTID||p.ID||p.NO_IUPHKM||p.SK||[p.NAMA_HKM,p.NAMA_DESA,p.NAMA_KAB].filter(Boolean).join("|")).trim().toLowerCase()}
function permitKey(f){var p=f&&f.properties||{};return analysisKeyValue(p.PROFILE_KEY||p.NO_IUPHKM||p.SK||p.OBJECTID||p.ID||[p.NAMA_HKM,p.NAMA_DESA,p.NAMA_KAB].filter(Boolean).join("|")).trim().toLowerCase()}
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
  monthlyHotspotLayer=L.layerGroup().addTo(map);
  L.control.layers(null,{"Batas Perhutanan Sosial":layer,"Hotspot laporan final":monthlyHotspotLayer},{collapsed:true,position:"topright"}).addTo(map);
  drawMonthlyHotspotPoints(monthlyHotspotPoints);
}
function drawMonthlyHotspotPoints(points){
  monthlyHotspotPoints=points||[];if(!monthlyHotspotLayer)return;monthlyHotspotLayer.clearLayers();
  monthlyHotspotPoints.forEach(function(point){L.marker([Number(point.latitude),Number(point.longitude)],{icon:L.divIcon({className:"",html:'<span class="vp-map-marker vp-map-marker--hotspot">!</span>',iconSize:[22,22],iconAnchor:[11,11]})}).bindPopup('<strong>Hotspot high-confidence</strong><br>'+esc(point.date)+' '+esc(String(point.time||"").padStart(4,"0"))+' UTC<br>Satelit: '+esc(point.satellite||"—")+'<br>FRP: '+(point.frp==null?'—':Number(point.frp).toLocaleString("id-ID",{maximumFractionDigits:2})+' MW')).addTo(monthlyHotspotLayer)});
}
function renderLoss(record,method){
  var annual=record.annualLossHa||{},years=Object.keys(annual).sort(),values=years.map(function(y){return number(annual[y])}),available=values.filter(function(v){return v!=null}),max=Math.max.apply(Math,[1].concat(available));
  el("loss-bars").innerHTML=years.map(function(year){var value=number(annual[year]),empty=value==null,width=empty?0:value/max*100;return'<div class="vp-bar'+(empty?' vp-bar--empty':'')+'"><span>'+esc(year)+'</span><div class="vp-bar__track"><div class="vp-bar__fill" style="width:'+width.toFixed(2)+'%"></div></div><strong>'+(empty?'Belum ada':format(value,1)+' ha')+'</strong></div>'}).join("");
  el("loss-chart-title").textContent="Kehilangan tutupan pohon "+(years[0]||"")+"–"+(years[years.length-1]||"");
  el("loss-note").textContent="Data tersedia sampai "+(method.lossDataThroughYear||"tahun terakhir")+". Tahun setelah cakupan sumber ditandai “Belum ada”, bukan nol.";
}
function renderReferences(record,area){
  var r=record.referenceAreasHa||{},rows=[["APL",r.apl],["Hutan produksi",r.productionForest],["Hutan lindung",r.protectionForest],["Kawasan konservasi",r.conservation],["Ekosistem gambut",r.peat],["PBPH aktif (Mei 2026)",r.concession],["Perhutanan sosial",r.socialForestry]];
  el("reference-list").innerHTML=rows.map(function(x){var v=number(x[1]),w=v!=null&&area?Math.min(100,v/area*100):0;return'<div class="vp-reference"><span>'+esc(x[0])+'</span><strong>'+esc(ha(v))+'</strong><div class="vp-reference__track"><div class="vp-reference__fill" style="width:'+w.toFixed(2)+'%"></div></div></div>'}).join("");
}
function renderIdentity(p,area,detail){
  var legal=detail&&detail.skExtraction?detail.skExtraction:{};
  var polygonDecree=String(p.NO_IUPHKM||p.SK||"").trim(),detailDecree=String(detail&&detail.decree||"").trim(),legalDecree=String(legal.decreeNumber||"").trim(),canonicalDecree=detailDecree||polygonDecree||legalDecree,legalVerified=Boolean(legalDecree&&normalized(legalDecree)===normalized(canonicalDecree)),detailScheme=String(detail&&detail.scheme||"").trim(),canonicalScheme=/nonspasial|belum terklasifikasi/i.test(detailScheme)?p.Ket:(detailScheme||p.Ket||"—");
  var approvedArea=legalVerified?number(legal.approvedAreaHa):number(detail&&detail.areaHa);if(approvedArea==null||approvedArea<=0)approvedArea=number(p.L_IUPHKM);if(approvedArea!=null&&approvedArea<=0)approvedArea=null;
  var verifiedVillage=detail&&detail.village?detail.village:(p.NAMA_DESA||"—"),verifiedDistrict=detail&&detail.district?detail.district:(p.NAMA_KEC||"—"),verifiedRegency=detail&&detail.regency?detail.regency:(p.NAMA_KAB||"—"),verifiedProvince=detail&&detail.province?detail.province:(p.NAMA_PROV||"Riau");
  el("identity-list").innerHTML=[
    item("Kelompok/Hutan Desa",detail&&detail.name?detail.name:(p.NAMA_HKM||"—")),item("Skema",legalVerified&&legal.scheme?legal.scheme:canonicalScheme),item("Nomor SK",canonicalDecree||"—"),item("Tanggal SK",displayDate(legalVerified&&legal.decreeDate?legal.decreeDate:(detail&&detail.decreeDate||p.TGL_IUPHKM))),
    item("Luas berdasarkan SK",approvedArea!=null?format(approvedArea,2)+" ha":"—"),item("Luas hasil kalkulasi polygon",ha(area)),item("Desa",verifiedVillage),item("Kecamatan",verifiedDistrict),item("Kabupaten",verifiedRegency),item("Provinsi",verifiedProvince)
  ].join("");
  var badge=document.querySelector(".vp-sf-status");
  if(badge)badge.textContent=legalVerified?"Data spasial & SK terverifikasi":detail&&detail.skDocumentStatus==="available"?"Data spasial & dokumen tersedia":"Layer referensi";
}
function renderSupplemental(detail){
  var section=el("sf-detail");
  if(!detail){section.hidden=true;return}
  var demography=detail.demography||{},legal=detail.skExtraction||{},management=detail.management||legal.management||{},beneficiaries=detail.beneficiaries||legal.beneficiaries||detail.members||{},kups=Array.isArray(detail.kups)?detail.kups:[],documents=Array.isArray(detail.documents)?detail.documents.filter(Boolean):[],bpskl=detail.bpsklProfile||{},governance=detail.governance||{},forest=detail.forestAreaComposition||{},landCover=detail.landCoverHa||{};
  var unavailable="Belum tersedia",kupsNames=kups.map(function(row){return row.name}).filter(Boolean).join(", "),kupsLegal=kups.map(function(row){return row.legalStatus}).filter(Boolean).join(", ");
  var summary=legal.decreeNumber?[
    item("Lembaga pengelola",detail.name||unavailable),item("Masa berlaku",legal.validity||unavailable),
    item("Periode persetujuan",legal.validityPeriod||unavailable),item("Evaluasi",legal.evaluation||unavailable),
    item("Fungsi kawasan hutan",legal.forestFunctions||unavailable),item("KPH/FMU",management.forestManagementUnit||unavailable),
    item("Ekosistem",management.ecosystem||legal.ecosystem||unavailable),item("Penerima manfaat langsung",number(beneficiaries.direct)!=null?format(beneficiaries.direct,0)+" orang":unavailable),
    item("Komposisi penerima langsung",number(beneficiaries.male)!=null&&number(beneficiaries.female)!=null?format(beneficiaries.male,0)+" laki-laki · "+format(beneficiaries.female,0)+" perempuan":unavailable),
    item("Penerima manfaat tidak langsung",number(beneficiaries.indirectHouseholds)!=null?format(beneficiaries.indirectHouseholds,0)+" keluarga":unavailable),
    item("Pengurus inti",[management.chairperson&&"Ketua: "+management.chairperson,management.viceChairperson&&"Wakil: "+management.viceChairperson,management.secretary&&"Sekretaris: "+management.secretary,management.treasurer&&"Bendahara: "+management.treasurer].filter(Boolean).join(" · ")||unavailable)
  ]:[
    item("Lembaga pengelola",detail.name||unavailable),item("KUPS",kupsNames||unavailable),
    item("Status legalitas KUPS",kupsLegal||unavailable),item("Jumlah keluarga/anggota",number(beneficiaries.total)!=null?format(beneficiaries.total,0)+" orang":(number(demography.households)!=null?format(demography.households,0)+" KK":unavailable)),
    item("Komposisi anggota",number(beneficiaries.male)!=null&&number(beneficiaries.female)!=null?format(beneficiaries.male,0)+" laki-laki · "+format(beneficiaries.female,0)+" perempuan":(number(demography.male)!=null&&number(demography.female)!=null?format(demography.male,0)+" laki-laki · "+format(demography.female,0)+" perempuan":unavailable)),
    item("KPH/FMU",management.forestManagementUnit||unavailable),item("Ekosistem",management.ecosystem||unavailable),
    item("Target area restorasi",number(management.restorationTargetHa)!=null?format(management.restorationTargetHa,0)+" ha":unavailable),item("RKPS",management.rkpsStatus||unavailable)
  ];
  var facilitators=management.facilitators&&typeof management.facilitators==="object"?Object.keys(management.facilitators).sort().map(function(year){return year+": "+management.facilitators[year]}).join(" · "):"";
  var forestRows=[["Hutan lindung",forest.protectionForestHa],["Hutan produksi",forest.productionForestHa],["Hutan produksi terbatas",forest.limitedProductionForestHa],["Hutan produksi konversi",forest.convertibleProductionForestHa],["Konservasi",forest.conservationHa],["APL",forest.otherUseAreaHa]].filter(function(row){return number(row[1])!=null}).map(function(row){return row[0]+" "+format(row[1],2)+" ha"}).join(" · ");
  var landCoverRows=Object.keys(landCover).filter(function(key){return number(landCover[key])!=null&&number(landCover[key])>0}).sort(function(a,b){return number(landCover[b])-number(landCover[a])}).slice(0,6).map(function(key){return key.replace(/_/g," ")+" "+format(landCover[key],2)+" ha"}).join(" · ");
  var kupsRows=kups.map(function(row){return [row.name,row.class&&"kelas "+row.class,row.commodity,row.commodityAreaHa!=null&&format(row.commodityAreaHa,2)+" ha",row.annualProduction].filter(Boolean).join(" · ")}).filter(Boolean).join("; ");
  summary=summary.concat([
    item("Status data BPSKL",bpskl.status||detail.legalStatus||unavailable),item("Ketersediaan SK (BPSKL)",bpskl.skDataAvailability||unavailable),item("Ketersediaan peta/SHP (BPSKL)",bpskl.mapDataAvailability||unavailable),
    item("Pendamping PS",facilitators||unavailable),item("Pendamping mandiri",management.independentFacilitator||unavailable),item("Penandaan batas",management.boundaryMarking||unavailable),item("RKPS/RPHD/RKU",management.rkpsStatus||unavailable),
    item("Komposisi fungsi kawasan",forestRows||unavailable),item("Tutupan lahan utama",landCoverRows||unavailable),item("Informasi KUPS",kupsRows||kupsNames||unavailable),
    item("Kerja sama",governance.cooperation||unavailable),item("Konflik/tumpang tindih",[governance.conflict,number(governance.overlapHa)!=null&&format(governance.overlapHa,2)+" ha"].filter(Boolean).join(" · ")||unavailable),item("Pengawasan dan evaluasi",[governance.supervision,governance.evaluation].filter(Boolean).join(" · ")||unavailable),item("Kebutuhan kelompok",governance.needs||unavailable)
  ]);
  el("sf-detail-summary").innerHTML=summary.join("");
  el("sf-document-list").innerHTML=documents.map(function(doc){return '<a href="'+esc(doc.url)+'" target="_blank" rel="noopener noreferrer"><span>'+esc(doc.category||doc.type||"Dokumen pendukung")+'</span><strong>'+esc(doc.label||doc.title||"Buka dokumen")+'</strong><b aria-hidden="true">↗</b></a>'}).join("");
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
  var p=feature.properties||{},method=data.method||{},viirs=data.viirs||{},name=detail&&detail.name||p.NAMA_HKM||record.name||p.NAMA_DESA||"Perhutanan Sosial";
  var area=number(p.LUAS_POLI)||number(p.L_IUPHKM),baseline=number(record.baselineForestHa),current=number(record.currentForestHa),loss=number(record.totalLossHa),gain=number(record.gainHa);
  var share=area&&current!=null?Math.max(0,Math.min(100,current/area*100)):null;
  document.title=name+" · Profil Perhutanan Sosial | Yayasan Gambut";el("area-name").textContent=name;el("area-location").textContent=[detail&&detail.village||p.NAMA_DESA,detail&&detail.district||p.NAMA_KEC,detail&&detail.regency||p.NAMA_KAB].filter(Boolean).join(" · ");
  var analysisAvailable=record.analysisAvailable!==false,updated=viirs.updatedAt||data.generatedAt;el("data-updated").textContent=analysisAvailable?(updated?"Pembaruan analisis "+new Date(updated).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"}):"Tanggal pembaruan belum tersedia"):"Polygon resmi tersedia · analisis tutupan pohon belum dihitung";
  el("kpi-grid").innerHTML=[kpi("⌗","Luas areal",ha(area),"berdasarkan polygon analisis"),kpi("♣","Tutupan pohon baseline",ha(baseline),"baseline "+(method.baselineYear||2000)),kpi("◒","Sisa tutupan pohon",ha(current),share==null?"persentase belum tersedia":percent(share)+" dari luas areal"),kpi("↘","Kehilangan kumulatif",ha(loss),gain!=null?"pertambahan terpetakan "+ha(gain):"akumulasi pixel kehilangan")].join("");
  el("forest-percent").textContent=percent(share);el("current-forest").textContent=ha(current);el("forest-donut").style.setProperty("--value",share==null?0:share);
  el("forest-definition").textContent="Baseline "+(method.baselineYear||2000)+" dikurangi kehilangan"+(gain!=null?" dan ditambah pertambahan terpetakan":"")+". Angka bersifat indikatif.";
  el("baseline-period").textContent=method.baselineYear||"—";el("loss-through").textContent=method.lossDataThroughYear||"—";
  renderIdentity(p,area,detail);renderSupplemental(detail);renderLoss(record,method);renderReferences(record,area);
  if(!analysisAvailable){el("loss-chart-title").textContent="Analisis kehilangan tutupan pohon belum tersedia";el("loss-note").textContent="Polygon resmi telah terhubung. Statistik raster akan ditampilkan setelah proses analisis berikutnya."}
  el("loading-state").hidden=true;el("error-state").hidden=true;el("profile-content").hidden=false;requestAnimationFrame(function(){renderMap(feature,name);if(window.YGFinalMonthlyHotspots){window.YGFinalMonthlyHotspots.init({geometry:feature.geometry,annualType:"socialForestry",annualKeys:[key,permitKey(feature),featureKey(feature)],onPoints:function(points){drawMonthlyHotspotPoints(points)}})}});
}
async function init(){
  if(!key){showError("Tautan areal tidak lengkap. Pilih Perhutanan Sosial melalui WebGIS.");return}
  try{
    var results=await Promise.all([json("data/village-forest-analytics.json?v=20260831-pbph1"),json("data/PERHUTANAN_SOSIAL_RIAU.geojson?v=20260828-sk-sync1"),json("data/social-forestry-details.json?v=20260831-geometry-audit2"),json("data/social-forestry-pkk-samj.geojson?v=20260831-samj-pkk1").catch(function(){return{features:[]}}),json("data/social-forestry-kud-agro-lestari.geojson?v=20260831-agro1").catch(function(){return{features:[]}}),json("data/social-forestry-derived-2025.geojson?v=20260831-derived1").catch(function(){return{features:[]}})]),data=results[0],geo=results[1],details=results[2]||{};
    geo.features=(geo.features||[]).concat(results[3].features||[],results[4].features||[],results[5].features||[]);
    (geo.features||[]).forEach(function(feature){var p=feature&&feature.properties||{};if(String(p.OBJECTID||"")==="2941"){p.NO_IUPHKM="SK.4391/MENLHK-PSKL/PKPS/PSL.0/7/2020";p.TGL_IUPHKM="2020-07-08"}});
    geo.features.sort(function(a,b){return Number(Boolean((b.properties||{}).PROFILE_KEY))-Number(Boolean((a.properties||{}).PROFILE_KEY))});
    var directDetail=details[key]||null,spatialAlias=directDetail&&directDetail.spatialObjectKey?String(directDetail.spatialObjectKey).trim().toLowerCase():"";
    var feature=(geo.features||[]).find(function(f){return permitKey(f)===key||featureKey(f)===key});
    if(!feature&&spatialAlias){var aliasMatches=(geo.features||[]).filter(function(f){return permitKey(f)===spatialAlias||featureKey(f)===spatialAlias});if(aliasMatches.length===1)feature=aliasMatches[0];else if(aliasMatches.length>1&&directDetail){feature=aliasMatches.find(function(f){var p=f.properties||{};return directDetail.decree&&normalized(p.NO_IUPHKM||p.SK)===normalized(directDetail.decree)||directDetail.name&&normalized(p.NAMA_HKM)===normalized(directDetail.name)})}}
    var record=(data.socialForestry||{})[key];
    if(!feature&&record){feature=(geo.features||[]).find(function(f){return normalized((f.properties||{}).NAMA_HKM)===normalized(record.name)})}
    if(!record&&feature){var fk=featureKey(feature),records=data.socialForestry||{};record=records[fk]||Object.keys(records).map(function(recordKey){return records[recordKey]}).find(function(candidate){return normalized(candidate&&candidate.name)===normalized((feature.properties||{}).NAMA_HKM)})}
    if((!feature||!feature.geometry)&&directDetail){renderNonspatial(directDetail);return}
    if(!feature||!feature.geometry)throw new Error("Polygon Perhutanan Sosial tidak ditemukan.");
    var resolvedPermit=permitKey(feature),resolvedFeature=featureKey(feature),spatialParts=(geo.features||[]).filter(function(candidate){return resolvedPermit&&permitKey(candidate)===resolvedPermit||resolvedFeature&&featureKey(candidate)===resolvedFeature});
    if(spatialParts.length>1&&window.YGFinalMonthlyHotspots){var mergedGeometry=window.YGFinalMonthlyHotspots.mergePolygonGeometries(spatialParts);if(mergedGeometry){var mergedProperties=Object.assign({},feature.properties),partAreas=spatialParts.map(function(part){return number((part.properties||{}).LUAS_POLI)}).filter(function(value){return value!=null});if(partAreas.length===spatialParts.length)mergedProperties.LUAS_POLI=partAreas.reduce(function(total,value){return total+value},0);feature={type:"Feature",properties:mergedProperties,geometry:mergedGeometry}}}
    if(!record)record={analysisAvailable:false,name:(feature.properties||{}).NAMA_HKM,annualLossHa:{},hotspotYearly5y:[],referenceAreasHa:{}};
    var detailKey=permitKey(feature),spatialDetail=details[detailKey]||details[featureKey(feature)]||null,detail=directDetail?Object.assign({},spatialDetail||{},directDetail):spatialDetail,approvedDocument=null;
    try{approvedDocument=JSON.parse(localStorage.getItem("ygPsApprovedDocument:"+key)||"null")}catch(ignore){}
    if(approvedDocument){detail=Object.assign({name:(feature.properties||{}).NAMA_HKM||record.name||"Profil PS"},detail||{});detail.documents=Array.isArray(detail.documents)?detail.documents.slice():[];if(!detail.documents.some(function(doc){return doc.url===approvedDocument.url}))detail.documents.push(approvedDocument)}
    render(feature,record,data,detail);
  }catch(e){console.error(e);showError(e.message||"Profil gagal dimuat.")}
}
el("print-profile").addEventListener("click",function(){window.print()});
el("share-profile").addEventListener("click",async function(){try{if(navigator.share){await navigator.share({title:document.title,url:location.href});return}await navigator.clipboard.writeText(location.href);toast("Tautan profil disalin")}catch(e){if(e&&e.name!=="AbortError")toast("Tautan belum dapat disalin")}});
init();
})();
