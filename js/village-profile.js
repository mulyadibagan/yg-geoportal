(function(){
  "use strict";
  var SNAPSHOT_URL="https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev/snapshots/current/objects.json";
  var MANIFEST_URL="data/administrative-village-analytics/manifest.json";
  var params=new URLSearchParams(window.location.search);
  var key=String(params.get("key")||"").trim().toLowerCase();
  var source=String(params.get("source")||"intervention").trim().toLowerCase();
  var map=null,monthlyHotspotLayer=null,monthlyHotspotPoints=[],profileProgramFeatures=[];

  function el(id){return document.getElementById(id);}
  function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function number(value){if(value==null||String(value).trim()===""){return null;}var n=Number(value);return isFinite(n)?n:null;}
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
  function sourceType(feature){var p=feature&&feature.properties||{};return String(p.Source_Type||"").toLowerCase();}
  function isActivityFeature(feature){
    var id=layerId(feature),type=sourceType(feature);
    return ["community_report","monitoring_report","titik_penanaman"].indexOf(type)!==-1||["community_reports","monitoring_reports","titik_penanaman"].indexOf(id)!==-1;
  }
  function isNewInfrastructureReport(feature){
    var props=feature&&feature.properties||{},id=layerId(feature),type=sourceType(feature);
    if(type!=="community_report"||["sekat_kanal","fdrs"].indexOf(id)===-1||String(props.Target_Object_ID||"").trim()){return false;}
    return /instalasi|installasi|installation|pembangunan|dibangun|titik baru/.test(normalized([props.reportType,props.title,props.Nama_Objek,props.description].join(" ")));
  }
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
      var data=await loadJson("data/desa_intervensi.geojson?v=20260822-program-profile1");
      var features=Array.isArray(data.features)?data.features:[];
      var exact=features.find(function(feature){return featureKey(feature)===key;});
      if(exact){return exact;}
      var village=normalized(key.split("|")[0]);
      return features.find(function(feature){
        var p=feature&&feature.properties||{};
        var aliases=Array.isArray(p.Intervention_Aliases)?p.Intervention_Aliases:[];
        return [p.WADMKD,p.Desa,p.NAMOBJ,p.Nama_Desa,p.Intervention_Source_Name].concat(aliases).some(function(value){return normalized(value)===village;});
      })||null;
    }catch(error){console.warn("Batas desa tidak dapat dimuat",error);return null;}
  }
  function renderMap(feature,name){
    map=L.map("village-map",{zoomControl:true,scrollWheelZoom:false});
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxNativeZoom:17,maxZoom:20,attribution:"Tiles &copy; Esri"}).addTo(map);
    var overlays={};
    if(feature&&feature.geometry){
      var layer=L.geoJSON(feature,{style:{color:"#66e0bd",weight:4,opacity:1,fillColor:"#087f78",fillOpacity:.18}}).addTo(map);
      overlays["Batas desa"]=layer;
      var bounds=layer.getBounds();
      if(bounds.isValid()){map.fitBounds(bounds,{padding:[24,24],maxZoom:14});}
      layer.bindTooltip(name,{permanent:false,direction:"center"});
    }else{
      map.setView([1.25,102.05],7);
      el("map-caption").textContent="Batas polygon tidak tersedia pada snapshot saat ini; angka analisis tetap dibaca dari basis data desa.";
    }
    function programmeLayer(id,label,markerClass,color){
      var features=profileProgramFeatures.filter(function(item){return layerId(item)===id&&item.geometry;});
      if(!features.length)return;
      var group=L.geoJSON({type:"FeatureCollection",features:features},{
        pointToLayer:function(item,latlng){return L.marker(latlng,{icon:L.divIcon({className:"",html:'<span class="vp-map-marker '+markerClass+'">'+(id==="fdrs"?"F":"S")+'</span>',iconSize:[22,22],iconAnchor:[11,11]})});},
        style:{color:color,weight:4,opacity:.95},
        onEachFeature:function(item,itemLayer){var p=item.properties||{};itemLayer.bindPopup('<strong>'+esc(p.Nama_Objek||label)+'</strong><br>'+esc(p.Tahun||p.activityDate||"")+'<br><small>'+esc(label)+'</small>');}
      }).addTo(map);
      overlays[label+" ("+features.length+")"]=group;
    }
    programmeLayer("fdrs","FDRS / TMA","vp-map-marker--fdrs","#ed6c19");
    programmeLayer("sekat_kanal","Sekat kanal","vp-map-marker--canal","#078a9b");
    monthlyHotspotLayer=L.layerGroup().addTo(map);overlays["Hotspot laporan final"]=monthlyHotspotLayer;
    L.control.layers(null,overlays,{collapsed:true,position:"topright"}).addTo(map);
    drawMonthlyHotspotPoints(monthlyHotspotPoints);
  }

  function drawMonthlyHotspotPoints(points){
    monthlyHotspotPoints=points||[];
    if(!monthlyHotspotLayer)return;
    monthlyHotspotLayer.clearLayers();
    monthlyHotspotPoints.forEach(function(point){
      L.marker([Number(point.latitude),Number(point.longitude)],{icon:L.divIcon({className:"",html:'<span class="vp-map-marker vp-map-marker--hotspot">!</span>',iconSize:[22,22],iconAnchor:[11,11]})}).bindPopup('<strong>Hotspot high-confidence</strong><br>'+esc(point.date)+' '+esc(String(point.time||"").padStart(4,"0"))+' UTC<br>Satelit: '+esc(point.satellite||"—")+'<br>FRP: '+(point.frp==null?'—':Number(point.frp).toLocaleString("id-ID",{maximumFractionDigits:2})+' MW')).addTo(monthlyHotspotLayer);
    });
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
  function renderReferences(record,area){
    var ref=record.referenceAreasHa||{};
    var rows=[
      ["APL",ref.apl],["Hutan produksi",ref.productionForest],["Hutan lindung",ref.protectionForest],
      ["Kawasan konservasi",ref.conservation],["Ekosistem gambut",ref.peat],
      ["PBPH aktif (Mei 2026)",ref.concession],["Perhutanan sosial",ref.socialForestry]
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

  function placeAliases(feature,name){
    var props=feature&&feature.properties||{},aliases=Array.isArray(props.Intervention_Aliases)?props.Intervention_Aliases:[];
    return [name,props.Intervention_Source_Name].concat(aliases).map(normalized).filter(Boolean);
  }
  function containsPlace(value,aliases){
    var text=" "+normalized(value)+" ";
    return aliases.some(function(alias){return text.indexOf(" "+alias+" ")!==-1;});
  }
  function pointInRing(point,ring){
    if(!point||!Array.isArray(ring)){return false;}
    var x=point[0],y=point[1],inside=false;
    for(var i=0,j=ring.length-1;i<ring.length;j=i++){
      var xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
      var crosses=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi);
      if(crosses){inside=!inside;}
    }
    return inside;
  }
  function pointInGeometry(point,geometry){
    if(!geometry||!point){return false;}
    var polygons=geometry.type==="Polygon"?[geometry.coordinates]:(geometry.type==="MultiPolygon"?geometry.coordinates:[]);
    return polygons.some(function(polygon){
      return polygon.length&&pointInRing(point,polygon[0])&&!polygon.slice(1).some(function(hole){return pointInRing(point,hole);});
    });
  }
  function representativePoint(geometry){
    if(!geometry||!Array.isArray(geometry.coordinates)){return null;}
    if(geometry.type==="Point"){return geometry.coordinates;}
    if(geometry.type==="MultiPoint"||geometry.type==="LineString"){return geometry.coordinates[Math.floor(geometry.coordinates.length/2)]||null;}
    var ring=geometry.type==="Polygon"?geometry.coordinates[0]:(geometry.type==="MultiPolygon"&&geometry.coordinates[0]?geometry.coordinates[0][0]:null);
    if(!Array.isArray(ring)||!ring.length){return null;}
    var total=ring.reduce(function(sum,point){sum[0]+=point[0];sum[1]+=point[1];return sum;},[0,0]);
    return [total[0]/ring.length,total[1]/ring.length];
  }
  function segmentIntersects(a,b,c,d){
    if(!a||!b||!c||!d){return false;}
    var epsilon=1e-12;
    if(Math.max(a[0],b[0])+epsilon<Math.min(c[0],d[0])||Math.max(c[0],d[0])+epsilon<Math.min(a[0],b[0])||Math.max(a[1],b[1])+epsilon<Math.min(c[1],d[1])||Math.max(c[1],d[1])+epsilon<Math.min(a[1],b[1])){return false;}
    function cross(p,q,r){return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);}
    var abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
    return ((abC<=epsilon&&abD>=-epsilon)||(abD<=epsilon&&abC>=-epsilon))&&((cdA<=epsilon&&cdB>=-epsilon)||(cdB<=epsilon&&cdA>=-epsilon));
  }
  function ringsIntersect(a,b){
    if(!Array.isArray(a)||!Array.isArray(b)){return false;}
    for(var i=1;i<a.length;i+=1){for(var j=1;j<b.length;j+=1){if(segmentIntersects(a[i-1],a[i],b[j-1],b[j])){return true;}}}
    return false;
  }
  function geometryIntersectsBoundary(geometry,boundaryGeometry){
    if(!geometry||!boundaryGeometry){return false;}
    if(geometry.type==="Point"){return pointInGeometry(geometry.coordinates,boundaryGeometry);}
    if(geometry.type==="MultiPoint"){return geometry.coordinates.some(function(point){return pointInGeometry(point,boundaryGeometry);});}
    if(geometry.type==="LineString"||geometry.type==="MultiLineString"){
      var lines=geometry.type==="LineString"?[geometry.coordinates]:geometry.coordinates;
      var boundaryPolygons=boundaryGeometry.type==="Polygon"?[boundaryGeometry.coordinates]:(boundaryGeometry.type==="MultiPolygon"?boundaryGeometry.coordinates:[]);
      return lines.some(function(line){return line.some(function(point){return pointInGeometry(point,boundaryGeometry);})||boundaryPolygons.some(function(poly){return ringsIntersect(line,poly[0]);});});
    }
    var featurePolygons=geometry.type==="Polygon"?[geometry.coordinates]:(geometry.type==="MultiPolygon"?geometry.coordinates:[]);
    var boundaryPolygons=boundaryGeometry.type==="Polygon"?[boundaryGeometry.coordinates]:(boundaryGeometry.type==="MultiPolygon"?boundaryGeometry.coordinates:[]);
    return featurePolygons.some(function(featurePolygon){
      var featureRing=featurePolygon[0]||[];
      return featureRing.some(function(point){return pointInGeometry(point,boundaryGeometry);})||boundaryPolygons.some(function(boundaryPolygon){
        var boundaryRing=boundaryPolygon[0]||[];
        return boundaryRing.some(function(point){return pointInGeometry(point,geometry);})||ringsIntersect(featureRing,boundaryRing);
      });
    });
  }
  function featureMatchesPlace(feature,name,district,regency,boundary){
    var props=feature&&feature.properties||{},target=props.targetFeatureProperties||{},aliases=placeAliases(boundary,name);
    var villageValues=[props.Desa,props.village,props.Village,props.Nama_Desa,target.Desa,target.village].filter(Boolean);
    var regencyValue=props.Kabupaten||props.regency||target.Kabupaten||"";
    var regencyOk=!regencyValue||!regency||normalized(regencyValue)===normalized(regency);
    var textValues=[props.Nama_Objek,props.title,props.locationName,props.location,props.Lokasi,props.description].filter(Boolean);
    if(villageValues.length){
      if(regencyOk&&villageValues.some(function(value){return aliases.indexOf(normalized(value))!==-1;})){return true;}
      return regencyOk&&textValues.some(function(value){return containsPlace(value,aliases);});
    }
    if(regencyOk&&textValues.some(function(value){return containsPlace(value,aliases);})){return true;}
    var point=representativePoint(feature&&feature.geometry);
    return !!(point&&boundary&&pointInGeometry(point,boundary.geometry));
  }
  function activityMatchesPlace(feature,name,district,regency,boundary){
    if(featureMatchesPlace(feature,name,district,regency,boundary)){return true;}
    if(feature&&feature.geometry&&representativePoint(feature.geometry)&&boundary&&boundary.geometry){
      return geometryIntersectsBoundary(feature.geometry,boundary.geometry);
    }
    return false;
  }
  function outsideReference(feature,boundary){
    return !!(feature&&feature.geometry&&feature.geometry.type==="Point"&&boundary&&boundary.geometry&&!pointInGeometry(feature.geometry.coordinates,boundary.geometry));
  }
  function programLabel(id,fallback){
    var labels={
      "area_mangrove":"Penanaman mangrove","nursery_mangrove":"Rumah pembibitan mangrove",
      "sekat_kanal":"Sekat kanal","fdrs":"FDRS / pemantauan muka air","kopi":"Agroforestri kopi",
      "area_kopi":"Area agroforestri kopi","nursery_kopi":"Pembibitan kopi","permanent_measurement_plots":"Plot ukur permanen",
      "information_signs":"Papan informasi","apo":"Infrastruktur pesisir"
    };
    return labels[id]||fallback||titleCase(id.replace(/_/g," "));
  }
  function programIcon(id){
    var icons={"area_mangrove":"MG","nursery_mangrove":"RB","sekat_kanal":"SK","fdrs":"F","kopi":"KP","area_kopi":"KP","nursery_kopi":"BK","permanent_measurement_plots":"PUP","information_signs":"INF","apo":"PS"};
    return icons[id]||"YG";
  }
  function isProgramFeature(feature){
    var id=layerId(feature),excluded=["","desa_intervensi","titik_desa","community_reports","monitoring_reports","titik_penanaman"];
    return isNewInfrastructureReport(feature)||(!isActivityFeature(feature)&&excluded.indexOf(id)===-1);
  }
  function groupPrograms(features,boundary){
    var groups={};
    features.forEach(function(feature){
      var props=feature.properties||{},id=layerId(feature),donor=props.Donor||props.Nama_Donor||"",phase=props.Fase||"",year=props.Tahun||"";
      var groupKey=[id,normalized(donor),normalized(phase),year].join("|");
      if(!groups[groupKey]){groups[groupKey]={id:id,title:programLabel(id,props.Layer_Label||props.Kategori),donor:donor,phase:phase,year:year,count:0,area:0,length:0,plants:0,outside:0,species:{}};}
      var group=groups[groupKey],area=number(props.Luas_Ha),length=number(props.Panjang_M),plants=number(props.Jumlah_Tanam||props.Jumlah_Bib);
      if(area==null&&feature.geometry&&/Polygon/.test(feature.geometry.type)){area=geometryAreaHa(feature.geometry);}
      group.count+=1;group.area+=area||0;group.length+=length||0;group.plants+=plants||0;
      String(props.Jenis_Tanaman||props.Komoditas||"").split(/[,;]/).map(function(value){return value.trim();}).filter(Boolean).forEach(function(value){group.species[value]=true;});
      if(outsideReference(feature,boundary)){group.outside+=1;}
    });
    return Object.keys(groups).map(function(groupKey){return groups[groupKey];}).sort(function(a,b){return Number(b.year||0)-Number(a.year||0)||a.title.localeCompare(b.title);});
  }
  function programItem(group,name){
    var meta=[];
    if(group.donor){meta.push("<span>"+esc(group.donor)+"</span>");}
    if(group.phase){meta.push("<span>Fase "+esc(group.phase)+"</span>");}
    if(group.year){meta.push("<span>"+esc(group.year)+"</span>");}
    var species=Object.keys(group.species||{});if(species.length){meta.push("<span>Jenis: "+esc(compactText(species.join(", "),110))+"</span>");}
    if(group.outside){meta.push('<span class="vp-warning">'+format(group.outside,0)+' titik di luar batas referensi</span>');}
    var measures=[];
    if(group.area>0){measures.push("<span><strong>"+ha(group.area)+"</strong> luas tercatat</span>");}
    if(group.length>0){measures.push("<span><strong>"+format(group.length,0)+" m</strong> panjang</span>");}
    if(group.plants>0){measures.push("<span><strong>"+format(group.plants,0)+"</strong> tanaman</span>");}
    return '<article class="vp-program-item"><div class="vp-program-icon">'+esc(programIcon(group.id))+'</div><div class="vp-program-item__body">'+
      '<div class="vp-program-item__top"><h4>'+esc(group.title)+'</h4><span class="vp-program-count">'+format(group.count,0)+' objek</span></div>'+
      (meta.length?'<div class="vp-program-meta">'+meta.join("")+'</div>':"")+
      (measures.length?'<div class="vp-program-measures">'+measures.join("")+'</div>':"")+
      '<a class="vp-item-link" target="_blank" rel="noopener noreferrer" href="webgis.html?layer='+encodeURIComponent(group.id)+'&amp;village='+encodeURIComponent(name)+'">Lihat pada peta →</a></div></article>';
  }
  function dateValue(value){
    var text=String(value||"").trim(),match=text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(match){text=match[3]+"-"+match[2]+"-"+match[1];}
    var time=Date.parse(text);return isFinite(time)?time:0;
  }
  function displayDate(value){
    var text=String(value||"").trim(),ymd=text.match(/^(\d{4})-(\d{2})-(\d{2})$/),dmy=text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/),date=null;
    if(ymd){date=new Date(Number(ymd[1]),Number(ymd[2])-1,Number(ymd[3]));}
    else if(dmy){date=new Date(Number(dmy[3]),Number(dmy[2])-1,Number(dmy[1]));}
    else{var time=dateValue(value);if(time){date=new Date(time);}}
    return date?date.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"Tanggal belum tersedia";
  }
  function compactText(value,limit){
    var text=String(value||"").replace(/\s+/g," ").trim();
    return text.length>(limit||180)?text.slice(0,(limit||180)-1).trim()+"…":text;
  }
  function activityFromTraining(row){
    var male=number(row.male)||0,female=number(row.female)||0;
    return {kind:"training",date:row.date,title:row.name||"Pelatihan",participants:male+female,male:male,female:female,topic:row.topic||"",target:row.target||"",partner:row.partner||""};
  }
  function activityFromFeature(feature,name){
    var props=feature.properties||{},target=props.targetFeatureProperties||{},id=layerId(feature),type=sourceType(feature),participants=number(props.Jumlah_Peserta||target.Jumlah_Peserta);
    var survival=number(props.Survival),alive=number(props.Jumlah_Hidup),planted=number(props.Jumlah_Bib||target.Jumlah_Bib);
    if(planted==null&&alive!=null&&survival>0){planted=Math.round(alive/(survival/100));}
    var copy=props.Ancaman?"Ancaman: "+props.Ancaman:(props.description||""),qualityWarning="";
    if(id==="community_reports"&&/nursery|rumah bibit/i.test(String(props.title||props.Nama_Objek||""))&&/stok bibit/i.test(copy)){
      copy="Stok bibit dalam laporan masih menunggu verifikasi terhadap kapasitas rumah pembibitan.";
      qualityWarning="Kapasitas perlu diverifikasi";
    }
    return {
      kind:id==="monitoring_reports"||type==="monitoring_report"?"monitoring":"activity",date:props.activityDate||props.Tahun||props.receivedAt,title:props.title||props.Nama_Objek||props.Layer_Label||"Kegiatan",
      participants:participants,male:number(props.Peserta_Laki_Laki||target.Peserta_Laki_Laki),female:number(props.Peserta_Perempuan||target.Peserta_Perempuan),youth:number(props.Peserta_Pemuda||target.Peserta_Pemuda),
      donor:props.Donor||target.Donor||"",survival:survival,alive:alive,planted:planted,condition:props.Kondisi||"",groups:props.Kelompok_Terlibat||target.Kelompok_Terlibat||"",
      topic:props.Monitoring_Type||props.reportType||props.Kategori||"",copy:copy,objectId:props.Object_ID||"",layerId:id,village:props.Desa||target.Desa||name||"",area:number(props.Luas_Terpantau_Ha||props.Luas_Ha),hasGeometry:!!(feature.geometry&&representativePoint(feature.geometry)),
      additionalPlanting:id==="titik_penanaman"?(number(props.Jumlah_Tanam||target.Jumlah_Tanam)||0):0,qualityWarning:qualityWarning,history:false
    };
  }
  function reconcileMonitoring(activities){
    var groups={};
    activities.filter(function(item){return item.kind==="monitoring";}).forEach(function(item){
      var groupKey=[normalized(item.village),normalized(item.topic),item.area==null?"":item.area].join("|");
      if(!groups[groupKey]){groups[groupKey]=[];}groups[groupKey].push(item);
    });
    Object.keys(groups).forEach(function(groupKey){
      var rows=groups[groupKey].sort(function(a,b){return dateValue(b.date)-dateValue(a.date);});
      if(rows.length<2||dateValue(rows[0].date)===dateValue(rows[1].date)){return;}
      rows.slice(1).forEach(function(item){item.history=true;});
      var latest=rows[0],previous=rows[1],sameBaseline=latest.planted>0&&previous.planted>0&&Math.abs(latest.planted-previous.planted)<=Math.max(10,latest.planted*.05);
      var additions=activities.filter(function(item){var time=dateValue(item.date);return item.additionalPlanting>0&&normalized(item.village)===normalized(latest.village)&&time>dateValue(previous.date)&&time<=dateValue(latest.date);}).reduce(function(total,item){return total+item.additionalPlanting;},0);
      if(sameBaseline&&latest.alive!=null&&previous.alive!=null&&latest.alive>previous.alive+additions){
        latest.qualityWarning="Perubahan hasil perlu diverifikasi";
        latest.copy=(latest.copy?latest.copy+" · ":"")+"Jumlah hidup meningkat melebihi penanaman tambahan yang tercatat sejak monitoring sebelumnya.";
      }
    });
    return activities;
  }
  function activityItem(item){
    var meta=[];
    if(item.participants!=null&&item.participants>0){meta.push("<span>"+format(item.participants,0)+" peserta</span>");}
    if(item.male>0||item.female>0){meta.push("<span>"+format(item.male||0,0)+" laki-laki · "+format(item.female||0,0)+" perempuan</span>");}
    if(item.youth>0){meta.push("<span>"+format(item.youth,0)+" pemuda</span>");}
    if(item.survival!=null){meta.push("<span>Kelangsungan hidup "+format(item.survival,1)+"%</span>");}
    if(item.alive!=null){meta.push("<span>"+format(item.alive,0)+" hidup</span>");}
    if(item.condition){meta.push("<span>Kondisi "+esc(item.condition)+"</span>");}
    if(item.donor){meta.push("<span>"+esc(item.donor)+"</span>");}
    if(item.history){meta.push('<span class="vp-history">Riwayat monitoring</span>');}
    if(item.qualityWarning){meta.push('<span class="vp-quality">'+esc(item.qualityWarning)+'</span>');}
    var copy=item.kind==="training"?[item.topic,item.target?"Peserta: "+item.target:"",item.partner?"Mitra: "+item.partner:""].filter(Boolean).join(" · "):[item.topic,item.groups?"Terlibat: "+item.groups:"",item.copy].filter(Boolean).join(" · ");
    var link=item.hasGeometry?'<a class="vp-item-link" target="_blank" rel="noopener noreferrer" href="webgis.html?layer='+encodeURIComponent(item.layerId||'')+'&amp;object='+encodeURIComponent(item.objectId||'')+'&amp;search='+encodeURIComponent(item.title)+'">Lihat pada peta →</a>':(item.objectId?'<a class="vp-item-link" target="_blank" rel="noopener noreferrer" href="monitoring-detail.html?object='+encodeURIComponent(item.objectId)+'&amp;title='+encodeURIComponent(item.title)+'">Buka detail kegiatan →</a>':"");
    return '<article class="vp-activity-item'+(item.kind==="monitoring"?' is-monitoring':'')+'"><div class="vp-activity-item__body">'+
      '<div class="vp-activity-item__top"><h4>'+esc(item.title)+'</h4><span class="vp-activity-date">'+esc(displayDate(item.date))+'</span></div>'+
      (meta.length?'<div class="vp-activity-meta">'+meta.join("")+'</div>':"")+(copy?'<p class="vp-activity-copy">'+esc(compactText(copy,230))+'</p>':"")+link+'</div></article>';
  }
  function expandableList(items,renderer,limit,label){
    if(!items.length){return '<div class="vp-program-empty"><strong>Belum ada catatan</strong>Data akan muncul setelah objek atau laporan desa tersedia dan terverifikasi.</div>';}
    var visible=items.slice(0,limit).map(renderer).join(""),remaining=items.slice(limit);
    return visible+(remaining.length?'<details class="vp-program-more"><summary>Lihat '+format(remaining.length,0)+' '+esc(label)+' lainnya</summary><div class="vp-program-more__content">'+remaining.map(renderer).join("")+'</div></details>':"");
  }
  function vegetationClass(feature){
    var props=feature.properties||{},target=props.targetFeatureProperties||{},id=layerId(feature),text=normalized([id,props.Program,props.Kategori,props.Kategori_Ekosistem,props.Jenis_Ekosistem,props.Komoditas,props.Jenis_Tanaman,props.Nama_Objek,target.Program,target.Kategori_Ekosistem,target.Komoditas,target.Jenis_Tanaman].join(" "));
    if(id==="area_mangrove"||id==="titik_penanaman"||/mangrove/.test(text)){return "mangrove";}
    if(id==="kopi"||id==="area_kopi"||/kopi|liberika|liberica/.test(text)){return "coffee";}
    if(/lahan mineral|restorasi hutan|hutan adat/.test(text)){return "forest";}
    if(/gambut|peat|geronggang|jelutung/.test(text)){return "peat";}
    return "";
  }
  function plantedCount(feature){
    var props=feature.properties||{},target=props.targetFeatureProperties||{},id=layerId(feature),type=sourceType(feature);
    if(id==="nursery_mangrove"||id==="nursery_kopi"){return 0;}
    if(id==="monitoring_reports"||type==="monitoring_report"){return number(props.Jumlah_Bib||target.Jumlah_Bib)||0;}
    return number(props.Jumlah_Tanam||props.Jumlah_Bib||target.Jumlah_Tanam||target.Jumlah_Bib)||0;
  }
  function plantInventory(programs,reports){
    var records={mangrove:{},coffee:{},peat:{},forest:{}};
    programs.concat(reports).forEach(function(feature){
      var category=vegetationClass(feature),count=plantedCount(feature),props=feature.properties||{},target=props.targetFeatureProperties||{};
      if(!category||count<=0){return;}
      var recordKey=target.Object_ID||props.Target_Object_ID||props.Object_ID||[layerId(feature),props.Nama_Objek,props.activityDate].join("|");
      records[category][recordKey]=Math.max(records[category][recordKey]||0,count);
    });
    var totals={};Object.keys(records).forEach(function(category){totals[category]=Object.keys(records[category]).reduce(function(total,recordKey){return total+records[category][recordKey];},0);});
    return totals;
  }
  function renderPrograms(features,capacityRows,boundary,name,district,regency){
    var allFeatures=Array.isArray(features)?features:[];
    var programs=allFeatures.filter(function(feature){return isProgramFeature(feature)&&featureMatchesPlace(feature,name,district,regency,boundary);});
    profileProgramFeatures=programs.slice();
    var reportIds={},reports=allFeatures.filter(function(feature){
      var id=layerId(feature);if(!isActivityFeature(feature)){return false;}
      if(!activityMatchesPlace(feature,name,district,regency,boundary)){return false;}
      var props=feature.properties||{},reportId=props.reportId||props.Source_Report_ID||props.Object_ID||[id,props.title,props.activityDate,props.receivedAt].join("|");
      if(reportIds[reportId]){return false;}reportIds[reportId]=true;return true;
    });
    var aliases=placeAliases(boundary,name),trainings=(Array.isArray(capacityRows)?capacityRows:[]).filter(function(row){
      return containsPlace(row.location,aliases)&&(!row.regency||!regency||normalized(row.regency)===normalized(regency));
    });
    var groups=groupPrograms(programs,boundary),activities=reconcileMonitoring(trainings.map(activityFromTraining).concat(reports.map(function(feature){return activityFromFeature(feature,name);}))).sort(function(a,b){return dateValue(b.date)-dateValue(a.date);});
    var participantTotal=trainings.reduce(function(total,row){return total+(number(row.male)||0)+(number(row.female)||0);},0)+reports.reduce(function(total,feature){var props=feature.properties||{},target=props.targetFeatureProperties||{};return total+(number(props.Jumlah_Peserta||target.Jumlah_Peserta)||0);},0);
    var plantingArea=programs.filter(function(feature){return ["area_mangrove","area_kopi","mineral_land_restoration_area"].indexOf(layerId(feature))!==-1;}).reduce(function(total,feature){var props=feature.properties||{},area=number(props.Luas_Ha);if(area==null&&feature.geometry&&/Polygon/.test(feature.geometry.type)){area=geometryAreaHa(feature.geometry);}return total+(area||0);},0);
    var plants=plantInventory(programs,reports);
    var canalUnits=programs.filter(function(feature){return layerId(feature)==="sekat_kanal";}).length,fdrsUnits=programs.filter(function(feature){return layerId(feature)==="fdrs";}).length;
    el("program-badge").textContent=(programs.length||activities.length)?format(programs.length,0)+" objek · "+format(activities.length,0)+" kegiatan":"Belum ada catatan";
    el("program-summary").innerHTML=[
      ["Sekat kanal",format(canalUnits,0)+" unit","berdasarkan titik infrastruktur"],
      ["FDRS",format(fdrsUnits,0)+" unit","pemantauan muka air"],
      ["Mangrove tertanam",plants.mangrove>0?format(plants.mangrove,0)+" pohon":"—","stok persemaian tidak dihitung"],
      ["Kopi tertanam",plants.coffee>0?format(plants.coffee,0)+" pohon":"—","jumlah tanam yang tercatat"],
      ["Tanaman gambut",plants.peat>0?format(plants.peat,0)+" pohon":"—","selain tanaman kopi"],
      ["Tanaman hutan",plants.forest>0?format(plants.forest,0)+" pohon":"—","restorasi hutan/mineral"],
      ["Luas kegiatan",plantingArea>0?ha(plantingArea):"—","area yang memiliki polygon"],
      ["Partisipasi",participantTotal>0?format(participantTotal,0):"—","kehadiran, bukan orang unik"]
    ].map(function(item){return '<div class="vp-program-stat"><span>'+esc(item[0])+'</span><strong>'+esc(item[1])+'</strong><small>'+esc(item[2])+'</small></div>';}).join("");
    el("program-list").innerHTML=expandableList(groups,function(group){return programItem(group,name);},4,"program");
    el("activity-list").innerHTML=expandableList(activities,activityItem,4,"kegiatan");
    el("program-note").textContent="Kegiatan dan monitoring yang memiliki titik, garis, atau polygon dicocokkan melalui posisi dan irisannya dengan batas desa pada peta. Atribut nama desa digunakan untuk catatan nonspasial, seperti data pelatihan yang belum memiliki koordinat.";
  }

  function renderCommunityGroups(rows,name,district,regency){
    var matches=(Array.isArray(rows)?rows:[]).filter(function(group){
      return normalized(group.village)===normalized(name)&&
        (!group.district||!district||normalized(group.district)===normalized(district))&&
        (!group.regency||!regency||normalized(group.regency)===normalized(regency));
    });
    var section=el("community-group-section"),list=el("community-group-list");
    if(!section||!list||!matches.length){return;}
    section.hidden=false;
    el("community-group-badge").textContent=matches.length+" kelompok tercatat";
    list.innerHTML=matches.map(function(group){
      var membership=group.membership||{},lead=group.leadership||{},legal=group.legal||{};
      var gender=[];
      if(membership.male!=null){gender.push(format(membership.male,0)+" laki-laki");}
      if(membership.female!=null){gender.push(format(membership.female,0)+" perempuan");}
      return '<article class="vp-community-group">'+
        '<div class="vp-community-group__main"><small>KELOMPOK MASYARAKAT</small><h3>'+esc(group.shortName||group.name||"Kelompok mitra")+'</h3><p>'+esc(group.summary||"")+'</p></div>'+
        '<dl class="vp-community-group__facts">'+
          (lead.chair?'<div><dt>Ketua</dt><dd>'+esc(lead.chair)+'</dd></div>':'')+
          (membership.total!=null?'<div><dt>Anggota</dt><dd>'+format(membership.total,0)+(gender.length?'<small>'+esc(gender.join(" · "))+'</small>':'')+'</dd></div>':'')+
          (legal.number?'<div><dt>Legalitas</dt><dd>'+esc(legal.number)+(legal.date?'<small>'+esc(legal.date)+'</small>':'')+'</dd></div>':'')+
          (legal.validUntil?'<div><dt>Berlaku sampai</dt><dd>'+esc(legal.validUntil)+'</dd></div>':'')+
        '</dl>'+
        (legal.url?'<a class="vp-community-group__document" href="'+esc(legal.url)+'" target="_blank" rel="noopener noreferrer">Buka dokumen SK/legalitas ↗</a>':'')+
      '</article>';
    }).join("");
  }

  function render(record,manifest,feature,snapshotFeatures,capacityRows,communityGroups){
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
    renderPrograms(snapshotFeatures,capacityRows,feature,name,district,regency);
    renderCommunityGroups(communityGroups,name,district,regency);
    renderLoss(record,method);renderReferences(record,area);
    el("loading-state").hidden=true;el("profile-content").hidden=false;
    loadCoastalMangrove(name,district,regency);
    window.requestAnimationFrame(function(){
      renderMap(feature,name);
      if(window.YGFinalMonthlyHotspots){window.YGFinalMonthlyHotspots.init({geometry:feature&&feature.geometry,annualType:"village",annualKeys:[featureKey(feature)],onPoints:function(points){drawMonthlyHotspotPoints(points);}});}
    });
  }

  async function init(){
    el("map-layout-link").href="map-layout.html?source="+encodeURIComponent(source)+"&key="+encodeURIComponent(key);
    if(!key){showError("Tautan desa tidak lengkap. Silakan pilih desa melalui WebGIS.");return;}
    try{
      var pair=await Promise.all([loadJson(MANIFEST_URL+"?v="+Date.now()),findFeature(),loadJson(SNAPSHOT_URL),loadJson("data/capacity-building.json?v=20260823-dayun-coffee"),loadJson("data/community-groups.json?v=20260825-village-profile1").catch(function(){return {groups:[]};})]);
      var manifest=pair[0],feature=pair[1],snapshot=pair[2]||{},capacityRows=pair[3]||[],communityGroups=pair[4]&&pair[4].groups||[],snapshotFeatures=Array.isArray(snapshot.features)?snapshot.features:[],shard=manifest.index&&manifest.index[key];
      if(shard==null){
        el("profile-status").innerHTML="<i></i> Analisis utama belum tersedia";
        render({},manifest,feature,snapshotFeatures,capacityRows,communityGroups);
        return;
      }
      var records=await loadJson("data/administrative-village-analytics/"+shard+".json?v="+encodeURIComponent(manifest.generatedAt||""));
      var record=records[key];
      if(!record){
        el("profile-status").innerHTML="<i></i> Analisis utama belum tersedia";
        render({},manifest,feature,snapshotFeatures,capacityRows,communityGroups);
        return;
      }
      render(record,manifest,feature,snapshotFeatures,capacityRows,communityGroups);
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
