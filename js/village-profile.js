(function(){
  "use strict";
  var SNAPSHOT_URL="https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev/snapshots/current/objects.json";
  var MANIFEST_URL="data/administrative-village-analytics/manifest.json";
  var params=new URLSearchParams(window.location.search);
  var key=String(params.get("key")||"").trim().toLowerCase();
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
  function render(record,manifest,feature){
    var parts=key.split("|"),props=feature&&feature.properties||{};
    var name=props.WADMKD||props.Desa||props.NAMOBJ||record.name||titleCase(parts[0]);
    var district=props.WADMKC||props.Kecamatan||titleCase(parts[1]);
    var regency=props.WADMKK||props.Kabupaten||titleCase(parts[2]);
    var attributeArea=number(props.Luas_Ha||props.Area_Ha||props.areaHa||props.LUASWH);
    var area=attributeArea||geometryAreaHa(feature&&feature.geometry);
    var current=number(record.currentForestHa),baseline=number(record.baselineForestHa),loss=number(record.totalLossHa);
    var cover=area&&current!=null?Math.max(0,Math.min(100,current/area*100)):null;
    var method=manifest.method||{},viirs=manifest.viirs||{};
    document.title=name+" · Profil Desa Intervensi | Yayasan Gambut";
    el("village-name").textContent=name;
    el("village-location").textContent=[district,regency].filter(Boolean).join(" · ");
    var updated=viirs.updatedAt||manifest.generatedAt;
    el("data-updated").textContent=updated?"Pembaruan analisis "+new Date(updated).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"}):"Tanggal pembaruan belum tersedia";
    el("kpi-grid").innerHTML=[
      kpi("⌗","Luas desa",ha(area),"berdasarkan polygon analisis"),
      kpi("♣","Tutupan pohon awal",ha(baseline),"baseline "+(method.baselineYear||"dataset")),
      kpi("◒","Estimasi tutupan saat ini",ha(current),cover==null?"persentase belum tersedia":percent(cover)+" dari luas desa"),
      kpi("↘","Kehilangan kumulatif",ha(loss),"akumulasi pixel kehilangan")
    ].join("");
    el("forest-percent").textContent=percent(cover);
    el("current-forest").textContent=ha(current);
    el("forest-donut").style.setProperty("--value",cover==null?0:cover);
    el("forest-definition").textContent=method.forestDefinition||"Tutupan pohon mengikuti definisi dataset sumber.";
    el("baseline-period").textContent=method.baselineYear||"—";
    el("loss-through").textContent=method.lossDataThroughYear||"—";
    renderLoss(record,method);renderHotspots(record);renderReferences(record,area);
    el("loading-state").hidden=true;el("profile-content").hidden=false;
    window.requestAnimationFrame(function(){renderMap(feature,name);});
  }

  async function init(){
    if(!key){showError("Tautan desa tidak lengkap. Silakan pilih desa melalui WebGIS.");return;}
    try{
      var pair=await Promise.all([loadJson(MANIFEST_URL+"?v="+Date.now()),findFeature()]);
      var manifest=pair[0],feature=pair[1],shard=manifest.index&&manifest.index[key];
      if(shard==null){throw new Error("Analisis untuk desa ini belum tersedia pada indeks data.");}
      var records=await loadJson("data/administrative-village-analytics/"+shard+".json?v="+encodeURIComponent(manifest.generatedAt||""));
      var record=records[key];
      if(!record){throw new Error("Rekaman analisis desa tidak ditemukan.");}
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