(function(){
  "use strict";
  var SNAPSHOT_URL="https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev/snapshots/current/objects.json";
  var MANIFEST_URL="data/administrative-village-analytics/manifest.json";
  var params=new URLSearchParams(window.location.search);
  var key=String(params.get("key")||"").trim().toLowerCase();
  var source=String(params.get("source")||"intervention").trim().toLowerCase();
  var map=null;

  function el(id){return document.getElementById(id);}
  function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function number(value){var n=Number(value);return isFinite(n)?n:null;}
  function format(value,digits){var n=number(value);return n==null?"Belum tersedia":n.toLocaleString("id-ID",{maximumFractionDigits:digits==null?2:digits});}
  function ha(value){var n=number(value);return n==null?"Belum tersedia":format(n,2)+" ha";}
  function percent(value){var n=number(value);return n==null?"—":format(n,1)+"%";}
  function titleCase(value){return String(value||"").replace(/\b\w/g,function(c){return c.toUpperCase();});}
  function normalized(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
  function featureKey(feature){
    var p=feature&&feature.properties||{};
    return [p.WADMKD||p.Desa||p.NAMOBJ||p.Nama_Desa,p.WADMKC||p.Kecamatan,p.WADMKK||p.Kabupaten].filter(Boolean).join("|").trim().toLowerCase();
  }
  function layerId(feature){var p=feature&&feature.properties||{};return String(p.Layer_ID||p.Source_Layer||"").toLowerCase();}
  function ringArea(ring){
    if(!Array.isArray(ring)||ring.length<3){return 0;}
    var radius=6378137,rad=Math.PI/180,total=0;
    for(var i=0;i<ring.length;i+=1){var a=ring[i],b=ring[(i+1)%ring.length];if(a&&b){total+=(b[0]-a[0])*rad*(2+Math.sin(a[1]*rad)+Math.sin(b[1]*rad));}}
    return Math.abs(total*radius*radius/2);
  }
  function polygonArea(rings){if(!Array.isArray(rings)||!rings.length){return 0;}var total=ringArea(rings[0]);for(var i=1;i<rings.length;i+=1){total-=ringArea(rings[i]);}return Math.max(0,total);}
  function geometryAreaHa(geometry){
    if(!geometry||!Array.isArray(geometry.coordinates)){return null;}
    var sqm=0;
    if(geometry.type==="Polygon"){sqm=polygonArea(geometry.coordinates);}
    if(geometry.type==="MultiPolygon"){geometry.coordinates.forEach(function(poly){sqm+=polygonArea(poly);});}
    return sqm>0?sqm/10000:null;
  }
  function kpi(icon,label,value,note){return '<article class="vp-kpi"><div class="vp-kpi__icon">'+esc(icon)+'</div><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(note||"")+'</small></article>';}
  function showError(message){el("loading-state").hidden=true;el("error-message").textContent=message;el("error-state").hidden=false;}
  function toast(message){var node=el("toast");node.textContent=message;node.classList.add("is-visible");window.setTimeout(function(){node.classList.remove("is-visible");},2200);}

  async function loadJson(url){var response=await fetch(url,{cache:"no-store"});if(!response.ok){throw new Error("HTTP "+response.status);}return response.json();}
  async function findFeature(){
    try{
      if(source==="administrative"){
        var administrative=await loadJson("data/batas_administrasi_desa_riau.geojson?v=20260822-admin-profile1");
        var boundaries=Array.isArray(administrative.features)?administrative.features:[];
        return boundaries.find(function(feature){return featureKey(feature)===key;})||null;
      }
      var data=await loadJson(SNAPSHOT_URL);
      var features=Array.isArray(data.features)?data.features:[];
      var exact=features.find(function(feature){return layerId(feature)==="desa_intervensi"&&featureKey(feature)===key;});
      if(exact){return exact;}
      var village=normalized(key.split("|")[0]);
      return features.find(function(feature){
        var p=feature&&feature.properties||{};
        return layerId(feature)==="desa_intervensi"&&normalized(p.WADMKD||p.Desa||p.NAMOBJ||p.Nama_Desa)===village;
      })||null;
    }catch(error){console.warn("Batas desa tidak dapat dimuat",error);return null;}
  }
  function renderMap(feature,name){
    map=L.map("village-map",{zoomControl:true,scrollWheelZoom:false});
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxNativeZoom:17,maxZoom:20,attribution:"Tiles &copy; Esri"}).addTo(map);
    if(feature&&feature.geometry){
      var layer=L.geoJSON(feature,{style:{color:"#66e0bd",weight:4,opacity:1,fillColor:"#087f78",fillOpacity:.18}}).addTo(map);
      var bounds=layer.getBounds();
      if(bounds.isValid()){map.fitBounds(bounds,{padding:[24,24],maxZoom:14});}
      layer.bindTooltip(name,{permanent:false,direction:"center"});
    }else{
      map.setView([1.25,102.05],7);
      el("map-caption").textContent="Batas polygon tidak tersedia pada snapshot saat ini; angka analisis tetap dibaca dari basis data desa.";
    }
  }
  function renderLoss(record,method){
    var annual=record.annualLossHa||{},years=Object.keys(annual).sort(),values=years.map(function(y){return number(annual[y]);}),available=values.filter(function(v){return v!=null;}),max=Math.max.apply(Math,[1].concat(available));
    el("loss-bars").innerHTML=years.map(function(year){
      var value=number(annual[year]),empty=value==null,width=value==null?0:(value/max*100);
      return '<div class="vp-bar'+(empty?' vp-bar--empty':'')+'"><span>'+esc(year)+'</span><div class="vp-bar__track"><div class="vp-bar__fill" style="width:'+width.toFixed(2)+'%"></div></div><strong>'+(empty?'Belum ada':format(value,1)+' ha')+'</strong></div>';
    }).join("");
    var start=years[0]||"",end=years[years.length-1]||"";
    el("loss-chart-title").textContent="Kehilangan tutupan pohon "+start+"–"+end;
    el("loss-note").textContent="Data sumber tersedia sampai "+(method.lossDataThroughYear||"tahun terakhir yang tertera")+". Tahun setelah cakupan sumber ditandai “Belum ada”, bukan nol.";
  }
  function renderHotspots(record){
    el("hotspot-summary").innerHTML='<div class="vp-hotspot-box"><span>7 hari terakhir</span><strong>'+format(record.hotspot7d,0)+'</strong></div><div class="vp-hotspot-box"><span>30 hari terakhir</span><strong>'+format(record.hotspot30d,0)+'</strong></div>';
    var rows=Array.isArray(record.hotspotYearly5y)?record.hotspotYearly5y:[],max=Math.max.apply(Math,[1].concat(rows.map(function(x){return number(x.count)||0;})));
    el("hotspot-years").innerHTML=rows.map(function(item){var value=number(item.count)||0;var height=Math.max(3,value/max*88);return '<div class="vp-mini"><strong>'+format(value,0)+'</strong><div class="vp-mini__bar" style="height:'+height.toFixed(1)+'px"></div><span>'+esc(item.year)+'</span></div>';}).join("");
  }
  function renderReferences(record,area){
    var ref=record.referenceAreasHa||{};
    var rows=[
      ["APL",ref.apl],["Hutan produksi",ref.productionForest],["Hutan lindung",ref.protectionForest],
      ["Kawasan konservasi",ref.conservation],["Ekosistem gambut",ref.peat],
      ["Konsesi",ref.concession],["Perhutanan sosial",ref.socialForestry]
    ];
    el("reference-list").innerHTML=rows.map(function(item){var value=number(item[1]);var width=value!=null&&area?Math.min(100,value/area*100):0;return '<div class="vp-reference"><span>'+esc(item[0])+'</span><strong>'+esc(ha(value))+'</strong><div class="vp-reference__track"><div class="vp-reference__fill" style="width:'+width.toFixed(2)+'%"></div></div></div>';}).join("");
  }
  function samePlace(row,name,district,regency){
    if(!row||normalized(row.village)!==normalized(name)){return false;}
    if(row.district&&district&&normalized(row.district)!==normalized(district)){return false;}
    if(row.regency&&regency&&normalized(row.regency)!==normalized(regency)){return false;}
    return true;
  }
  function sentence(value){
    var text=String(value||"").trim();
    return text?text.charAt(0).toUpperCase()+text.slice(1):"";
  }
  function priorityFile(regency){
    var id=normalized(regency);
    var files={
      "bengkalis":"data/mangrove-priority-bengkalis-results.json",
      "siak":"data/mangrove-priority-siak-results.json",
      "kota dumai":"data/mangrove-priority-dumai-results.json",
      "dumai":"data/mangrove-priority-dumai-results.json",
      "rokan hilir":"data/mangrove-priority-rokan-hilir-results.json",
      "indragiri hilir":"data/mangrove-priority-indragiri-hilir-results.json",
      "kepulauan meranti":"data/mangrove-priority-kepulauan-meranti-results.json",
      "pelalawan":"data/mangrove-priority-pelalawan-results.json"
    };
    return files[id]||"";
  }
  function emptyModule(id,title,message,badgeId){
    el(id).className="vp-module-empty";
    el(id).innerHTML="<strong>"+esc(title)+"</strong>"+esc(message);
    el(badgeId).textContent="Belum tersedia";
  }
  function renderCoastalModule(row,meta,name){
    if(!row||row.status!=="analysed"){
      emptyModule("coastal-content","Data pesisir belum tersedia","Belum ada hasil perubahan garis pantai yang lolos pemrosesan untuk desa ini.","coastal-confidence");
      return;
    }
    var erosion=number(row.erosionAreaHa)||0,accretion=number(row.accretionAreaHa)||0,total=erosion+accretion;
    var erosionPct=total?erosion/total*100:0;
    el("coastal-confidence").textContent="Keyakinan "+String(row.confidence||"—");
    el("coastal-content").className="";
    el("coastal-content").innerHTML=
      '<div class="vp-coastal-metrics">'+
        '<div class="vp-coastal-metric loss"><span>Indikasi kehilangan daratan</span><strong>'+ha(erosion)+'</strong></div>'+
        '<div class="vp-coastal-metric gain"><span>Indikasi pertambahan daratan</span><strong>'+ha(accretion)+'</strong></div>'+
        '<div class="vp-coastal-metric"><span>Laju kemunduran rerata</span><strong>'+format(row.indicativeRetreatRateMPerYear,2)+' m/tahun</strong></div>'+
        '<div class="vp-coastal-metric"><span>Kemunduran rerata periode</span><strong>'+format(row.indicativeMeanRetreatM,1)+' m</strong></div>'+
      '</div>'+
      '<div class="vp-coast-balance" title="Proporsi kehilangan terhadap total area berubah"><i style="width:'+erosionPct.toFixed(1)+'%"></i></div>'+
      '<p class="vp-module-note">Panjang pantai '+format(row.coastlineLengthKm,2)+' km · ketidakpastian posisi ±'+format(row.positionalUncertaintyM,1)+' m. Perubahan di bawah ketidakpastian tidak boleh ditafsirkan sebagai abrasi pasti.</p>'+
      '<div class="vp-data-period"><span>Periode '+esc(row.baseline||meta.baseline||"2016")+'–'+esc(row.current||meta.current||"2025")+'</span><span>Sentinel-2 · '+format(row.clearCoveragePct,1)+'% bebas awan</span></div>';
    var coastalLink=document.querySelector(".vp-coastal-card .vp-module-link");
    if(coastalLink){coastalLink.href="coastal-monitoring.html?village="+encodeURIComponent(name);}
  }
  function renderPriorityModule(row,meta){
    if(!row||row.status!=="analysed"){
      emptyModule("priority-content","Hasil prioritas belum tersedia","Desa ini belum memiliki hasil penilaian prioritas rehabilitasi mangrove.","priority-confidence");
      return;
    }
    var classes=row.priorityClasses||{},classHtml=Object.keys(classes).filter(function(k){return Number(classes[k])>0;}).map(function(k){return"<span>"+esc(k)+" · "+format(classes[k],0)+" polygon</span>";}).join("");
    var priorityArea=number(row.priorityAreaHa);
    if(priorityArea==null){priorityArea=number(row.roadFilteredAreaHa);}
    if(priorityArea==null){priorityArea=number(row.candidateAreaHa);}
    el("priority-confidence").textContent="Keyakinan "+String(row.confidence||"—");
    el("priority-content").className="";
    el("priority-content").innerHTML=
      '<div class="vp-priority-scores">'+
        '<div class="vp-score"><span>Skor kebutuhan</span><strong>'+format(row.needScore,0)+'/100</strong><small>'+esc(row.needClass||"—")+'</small></div>'+
        '<div class="vp-score"><span>Skor kelayakan</span><strong>'+format(row.suitabilityScore,0)+'/100</strong><small>'+esc(row.suitabilityClass||"—")+'</small></div>'+
      '</div>'+
      '<div class="vp-priority-metrics">'+
        '<div class="vp-priority-metric"><span>Luas prioritas</span><strong>'+ha(priorityArea)+'</strong></div>'+
        '<div class="vp-priority-metric"><span>Polygon prioritas</span><strong>'+format(row.priorityPolygonCount,0)+'</strong></div>'+
        '<div class="vp-priority-metric"><span>Indikasi kehilangan mangrove</span><strong>'+ha(row.indicativeMangroveLossHa)+'</strong></div>'+
        '<div class="vp-priority-metric"><span>Skor polygon tertinggi</span><strong>'+format(row.topPriorityScore,1)+'</strong></div>'+
      '</div>'+
      (classHtml?'<div class="vp-priority-classes">'+classHtml+'</div>':"")+
      '<div class="vp-priority-action"><span>REKOMENDASI TINDAKAN</span><p>'+esc(sentence(row.recommendedAction||"Verifikasi kandidat rehabilitasi pada peta prioritas."))+'</p></div>'+
      '<div class="vp-data-period"><span>Baseline '+esc(row.baseline||meta.baseline||"2016")+' · pembanding '+esc(row.current||meta.current||"2025")+'</span><span>Resolusi '+format(row.resolutionM||10,0)+' m</span></div>';
    var link=el("priority-link"),regency=String(row.regency||"").toLowerCase(),village=row.id||normalized(row.village).replace(/\s+/g,"-");
    link.href="mangrove-priority.html?regency="+encodeURIComponent(regency)+"&village="+encodeURIComponent(village);
  }
  async function loadCoastalMangrove(name,district,regency){
    var coastalFiles=["data/coastal-change-annual.json","data/coastal-change-non-intervention-annual.json"];
    var pFile=priorityFile(regency);
    try{
      var jobs=coastalFiles.map(function(file){return loadJson(file+"?v=20260822-profile1");});
      if(pFile){jobs.push(loadJson(pFile+"?v=20260822-profile1"));}
      var results=await Promise.allSettled(jobs),coastalRows=[],coastalMeta={},priorityRows=[],priorityMeta={};
      results.forEach(function(result,index){
        if(result.status!=="fulfilled"){return;}
        var data=result.value||{};
        if(index<coastalFiles.length){coastalRows=coastalRows.concat(data.villages||[]);if(!Object.keys(coastalMeta).length){coastalMeta=data;}}
        else{priorityRows=priorityRows.concat(data.villages||[]);priorityMeta=data;}
      });
      renderCoastalModule(coastalRows.find(function(row){return samePlace(row,name,district,regency);}),coastalMeta,name);
      renderPriorityModule(priorityRows.find(function(row){return samePlace(row,name,district,regency);}),priorityMeta);
    }catch(error){
      console.warn("Data pesisir dan prioritas gagal dimuat",error);
      emptyModule("coastal-content","Data gagal dimuat","Terjadi gangguan saat membaca analisis pesisir.","coastal-confidence");
      emptyModule("priority-content","Data gagal dimuat","Terjadi gangguan saat membaca hasil prioritas mangrove.","priority-confidence");
    }
  }

  function render(record,manifest,feature){
    var parts=key.split("|"),props=feature&&feature.properties||{};
    var name=props.WADMKD||props.Desa||props.NAMOBJ||record.name||titleCase(parts[0]);
    var district=props.WADMKC||props.Kecamatan||titleCase(parts[1]);
    var regency=props.WADMKK||props.Kabupaten||titleCase(parts[2]);
    var attributeArea=number(props.Luas_Ha||props.Area_Ha||props.areaHa||props.LUASWH);
    var area=attributeArea||geometryAreaHa(feature&&feature.geometry);
    var current=number(record.currentForestHa),baseline=number(record.baselineForestHa),loss=number(record.totalLossHa);
    var remainingPct=baseline&&current!=null?Math.max(0,Math.min(100,current/baseline*100)):null;
    var method=manifest.method||{},viirs=manifest.viirs||{};
    document.title=name+" · Profil & Analisis Desa | Yayasan Gambut";
    el("profile-type-label").textContent=source==="administrative"?"DESA ADMINISTRASI RIAU":"DESA INTERVENSI YG";
    el("village-name").textContent=name;
    el("village-location").textContent=[district,regency].filter(Boolean).join(" · ");
    var updated=viirs.updatedAt||manifest.generatedAt;
    el("data-updated").textContent=updated?"Pembaruan analisis "+new Date(updated).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"}):"Tanggal pembaruan belum tersedia";
    el("kpi-grid").innerHTML=[
      kpi("⌗","Luas desa",ha(area),"berdasarkan polygon analisis"),
      kpi("♣","Tutupan pohon awal",ha(baseline),"baseline "+(method.baselineYear||"dataset")),
      kpi("◒","Sisa tutupan pohon",ha(current),remainingPct==null?"persentase belum tersedia":percent(remainingPct)+" dari baseline "+(method.baselineYear||2000)),
      kpi("↘","Kehilangan kumulatif",ha(loss),"akumulasi pixel kehilangan")
    ].join("");
    el("forest-percent").textContent=percent(remainingPct);
    el("current-forest").textContent=ha(current);
    el("forest-donut").style.setProperty("--value",remainingPct==null?0:remainingPct);
    el("forest-definition").textContent="Tutupan pohon baseline "+(method.baselineYear||2000)+" yang belum terdeteksi mengalami kehilangan hingga "+(method.lossDataThroughYear||"tahun data terakhir")+". Regenerasi atau pertambahan tidak dihitung.";
    el("baseline-period").textContent=method.baselineYear||"—";
    el("loss-through").textContent=method.lossDataThroughYear||"—";
    renderLoss(record,method);renderHotspots(record);renderReferences(record,area);
    el("loading-state").hidden=true;el("profile-content").hidden=false;
    loadCoastalMangrove(name,district,regency);
    window.requestAnimationFrame(function(){renderMap(feature,name);});
  }

  async function init(){
    el("map-layout-link").href="map-layout.html?source="+encodeURIComponent(source)+"&key="+encodeURIComponent(key);
    if(!key){showError("Tautan desa tidak lengkap. Silakan pilih desa melalui WebGIS.");return;}
    try{
      var pair=await Promise.all([loadJson(MANIFEST_URL+"?v="+Date.now()),findFeature()]);
      var manifest=pair[0],feature=pair[1],shard=manifest.index&&manifest.index[key];
      if(shard==null){
        el("profile-status").innerHTML="<i></i> Analisis utama belum tersedia";
        render({},manifest,feature);
        return;
      }
      var records=await loadJson("data/administrative-village-analytics/"+shard+".json?v="+encodeURIComponent(manifest.generatedAt||""));
      var record=records[key];
      if(!record){
        el("profile-status").innerHTML="<i></i> Analisis utama belum tersedia";
        render({},manifest,feature);
        return;
      }
      render(record,manifest,feature);
    }catch(error){console.error(error);showError(error.message||"Terjadi gangguan ketika membaca data desa.");}
  }
  el("print-profile").addEventListener("click",function(){window.print();});
  el("share-profile").addEventListener("click",async function(){
    try{
      if(navigator.share){await navigator.share({title:document.title,url:window.location.href});return;}
      await navigator.clipboard.writeText(window.location.href);toast("Tautan profil disalin");
    }catch(error){if(error&&error.name!=="AbortError"){toast("Tautan belum dapat disalin");}}
  });
  init();
})();