(function(){
  "use strict";
  var formatHa=function(value){return value==null?"—":Number(value).toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2})+" ha"};
  var formatNumber=function(value){return Number(value||0).toLocaleString("id-ID")};
  var escapeHtml=function(value){return String(value==null?"":value).replace(/[&<>"']/g,function(character){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]})};
  var metric=function(label,value,note,className){return'<div class="ecd-metric '+(className||"")+'"><span>'+escapeHtml(label)+'</span><strong>'+value+'</strong><small>'+escapeHtml(note)+'</small></div>'};
  var dateLabel=function(value){var date=new Date(value);return isNaN(date)?"—":new Intl.DateTimeFormat("id-ID",{dateStyle:"long",timeStyle:"short",timeZone:"Asia/Jakarta"}).format(date)+" WIB"};

  function render(data){
    var m=data.mangrove,p=data.peat,f=data.forestAndSocialForestry;
    document.getElementById("compilation-status").textContent="Kompilasi aktif · "+data.sources.length+" sumber";
    document.getElementById("compilation-updated").textContent="Dibangun "+dateLabel(data.generatedAt);
    document.getElementById("area-policy").textContent=data.interpretation.areaPolicy;
    document.getElementById("theme-groups").innerHTML=
      '<article class="ecd-theme"><header><div><h3>Mangrove</h3><p>Luas referensi, pembagian fungsi, kandidat rehabilitasi, dan capaian penanaman program dibedakan agar tidak dibaca sebagai angka yang sama.</p></div><a href="mangrove-landscape.html">Buka analisis mangrove →</a></header><div class="ecd-metrics">'+
      metric("Mangrove referensi",formatHa(m.referenceAreaHa),"Cakupan PMN pada analisis lanskap Riau")+
      metric("Fungsi lindung indikatif",formatHa(m.indicativeProtectionHa),m.indicativeProtectionPct.toLocaleString("id-ID")+"% · TRUE + skenario REVIEW")+
      metric("Fungsi budidaya indikatif",formatHa(m.indicativeCultivationHa),m.indicativeCultivationPct.toLocaleString("id-ID")+"% · sisa skenario indikatif")+
      metric("Prioritas rehabilitasi",formatHa(m.restorationPriorityHa),formatNumber(m.restorationPriorityPolygons)+" poligon · "+formatNumber(m.analysedVillages)+" desa teranalisis","is-action")+
      metric("Penanaman program YG",formatHa(m.programmePlantingHa),formatNumber(m.programmeSeedlings)+" bibit tercatat")+
      metric("Belum terklasifikasi",formatHa(m.indicativeUnclassifiedHa),"Bagian dari sisa skenario budidaya; belum dipaksa ke fungsi lain")+
      '</div></article>'+
      '<article class="ecd-theme"><header><div><h3>Gambut &amp; FEG</h3><p>Sebaran tanah gambut BBSDLP dan Fungsi Ekosistem Gambut adalah dua cakupan berbeda. Keduanya tidak boleh langsung dibaca sebagai kebutuhan restorasi.</p></div><a href="webgis.html?layers=Gambut_BBSDLP_2019,feg_riau">Buka layer gambut →</a></header><div class="ecd-metrics">'+
      metric("Sebaran gambut",formatHa(p.mappedPeatHa),"Luas geodesik layer BBSDLP 2019")+
      metric("FEG lindung",formatHa(p.fegProtectionHa),"Fungsi dalam cakupan KHG; bukan luas tanah gambut")+
      metric("FEG budidaya",formatHa(p.fegCultivationHa),"Fungsi dalam cakupan KHG; bukan area restorasi")+
      metric("Kebutuhan restorasi gambut","Belum tersedia",p.restorationMessage,"is-warning")+
      '</div></article>'+
      '<article class="ecd-theme"><header><div><h3>Hutan &amp; Perhutanan Sosial</h3><p>Total persetujuan PS dihubungkan dengan tutupan hutan terkini, kehilangan hutan, gambut, dan kawasan hutan pada unit yang memiliki analitik spasial.</p></div><a href="social-forestry-directory.html">Buka direktori PS →</a></header><div class="ecd-metrics">'+
      metric("Perhutanan Sosial",formatHa(f.socialForestryAreaHa),formatNumber(f.socialForestryProfiles)+" profil · satu PS dihitung sekali")+
      metric("Hutan terkini untuk dijaga",formatHa(f.currentForestToGuardHa),formatNumber(f.analysedSpatialUnits)+" unit PS spasial teranalisis","is-action")+
      metric("PS di kawasan hutan",formatHa(f.socialForestryInsideForestEstateHa),"Irisan pada unit PS teranalisis")+
      metric("PS di gambut",formatHa(f.socialForestryOnPeatHa),"Irisan pada unit PS teranalisis")+
      metric("Kawasan hutan",formatHa(f.forestEstateHa),"Produksi + lindung + konservasi; luas geodesik")+
      metric("Hutan lindung",formatHa(f.protectionForestHa),"Fungsi HL pada SK 903")+
      metric("Kawasan konservasi",formatHa(f.conservationForestHa),"CA, KSA/KPA, SA, SM, TN, dan TWA")+
      metric("Kehilangan hutan tercatat",formatHa(f.recordedForestLossHa),"Akumulasi pada unit PS teranalisis; bukan sisa hutan")+
      '</div></article>';

    document.getElementById("region-body").innerHTML=data.regions.map(function(row){
      var priority=row.mangrovePriorityHa?formatHa(row.mangrovePriorityHa)+'<span class="ecd-table-meta">'+formatNumber(row.mangrovePriorityVillages)+' desa teranalisis</span>':"—";
      var social=row.socialForestryHa?formatHa(row.socialForestryHa)+'<span class="ecd-table-meta">'+formatNumber(row.socialForestryProfiles)+' profil</span>':"—";
      var current=row.currentForestInSocialForestryHa?formatHa(row.currentForestInSocialForestryHa)+'<span class="ecd-table-meta">'+formatNumber(row.analysedSocialForestryUnits)+' unit dianalisis</span>':"—";
      return"<tr><td>"+escapeHtml(row.name)+"</td><td>"+formatHa(row.mangroveHa)+"</td><td>"+formatHa(row.mangroveLindungHa)+"</td><td>"+formatHa(row.mangroveBudidayaHa)+"</td><td>"+priority+"</td><td>"+social+"</td><td>"+current+"</td></tr>";
    }).join("");

    var labels={ready:"Siap",ready_indicative:"Siap · indikatif",ready_context:"Siap · konteks",partial:"Parsial",missing:"Belum tersedia",empty:"Kosong"};
    document.getElementById("quality-grid").innerHTML=data.dataQuality.map(function(item){return'<article class="is-'+escapeHtml(item.status)+'"><span>'+escapeHtml(labels[item.status]||item.status)+'</span><strong>'+escapeHtml(item.theme)+'</strong><p>'+escapeHtml(item.coverage)+'</p><small>'+escapeHtml(item.source)+'</small></article>'}).join("");
    document.getElementById("source-list").innerHTML=data.sources.map(function(source){return'<article><strong>'+escapeHtml(source.role)+'</strong><code>'+escapeHtml(source.file)+'</code><small>'+(source.generatedAt?'Pembaruan sumber: '+escapeHtml(source.generatedAt):source.methodVersion?'Metode: '+escapeHtml(source.methodVersion):'Sumber spasial WebGIS')+'</small></article>'}).join("");
  }

  fetch("data/ecosystem-compilation.json?v=20260831-1",{cache:"no-store"}).then(function(response){if(!response.ok)throw new Error("Kompilasi tidak dapat dimuat");return response.json()}).then(render).catch(function(error){document.getElementById("compilation-status").textContent="Data sementara tidak tersedia";document.getElementById("compilation-updated").textContent=error.message;document.getElementById("theme-groups").innerHTML='<article class="ecd-loading">Kompilasi gagal dimuat. Silakan coba lagi.</article>'});
})();
