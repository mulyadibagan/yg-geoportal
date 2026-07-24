(function(){
  "use strict";

  var GFW={
    cover:"https://tiles.globalforestwatch.org/idn_land_cover_2017/latest/dynamic/{z}/{x}/{y}.png",
    loss:"https://tiles.globalforestwatch.org/umd_tree_cover_loss/latest/dynamic/{z}/{x}/{y}.png?render_type=true_color&tree_cover_density_threshold=30",
    alerts:"https://tiles.globalforestwatch.org/gfw_integrated_dist_alerts/latest/dynamic/{z}/{x}/{y}.png?alert_confidence=high&render_type=true_color&tree_cover_density_threshold=30"
  };
  var INDONESIA_BOUNDS=L.latLngBounds(
    L.latLng(-11.25,94.5),
    L.latLng(6.3,141.5)
  );
  var GRID_OPTIONS={
    bounds:INDONESIA_BOUNDS,
    updateWhenIdle:true,
    updateWhenZooming:false,
    keepBuffer:1
  };
  var analytics={villages:{},socialForestry:{}};
  var attached=new WeakSet();
  var currentAnalysisContext=null;

  function esc(value){
    return String(value==null?"":value).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  function number(value){
    var n=Number(String(value==null?"":value).replace(",","."));
    return isFinite(n)?n:0;
  }

  function ringAreaSquareMeters(ring){
    if(!Array.isArray(ring)||ring.length<3){return 0;}
    var toRadians=Math.PI/180;
    var radius=6378137;
    var area=0;
    for(var i=0;i<ring.length;i+=1){
      var current=ring[i];
      var next=ring[(i+1)%ring.length];
      if(!Array.isArray(current)||!Array.isArray(next)){continue;}
      area+=(next[0]-current[0])*toRadians*(2+Math.sin(current[1]*toRadians)+Math.sin(next[1]*toRadians));
    }
    return Math.abs(area*radius*radius/2);
  }

  function polygonAreaSquareMeters(rings){
    if(!Array.isArray(rings)||!rings.length){return 0;}
    var area=ringAreaSquareMeters(rings[0]);
    for(var i=1;i<rings.length;i+=1){
      area-=ringAreaSquareMeters(rings[i]);
    }
    return Math.max(0,area);
  }

  function geometryAreaHa(geometry){
    if(!geometry||!Array.isArray(geometry.coordinates)){return 0;}
    var squareMeters=0;
    if(geometry.type==="Polygon"){
      squareMeters=polygonAreaSquareMeters(geometry.coordinates);
    }else if(geometry.type==="MultiPolygon"){
      squareMeters=geometry.coordinates.reduce(function(total,polygon){
        return total+polygonAreaSquareMeters(polygon);
      },0);
    }
    return squareMeters/10000;
  }

  function analysisKeyValue(value){
    if(typeof value==="number"&&Number.isInteger(value)){return value.toFixed(1);}
    return String(value==null?"":value);
  }

  function formatHa(value){
    if(value==null||value===""){return "Belum dihitung";}
    var n=Number(value);
    return isFinite(n)?n.toLocaleString("id-ID",{maximumFractionDigits:2})+" ha":"Belum dihitung";
  }

  function unitInfo(feature,layerId){
    var p=feature&&feature.properties||{};
    var areaFromAttributes=number(p.Luas_Ha||p.Area_Ha||p.areaHa||p.LUASWH);
    var areaFromGeometry=geometryAreaHa(feature&&feature.geometry);
    if(layerId==="perhutanan_sosial_riau"){
      return {
        type:"socialForestry",
        title:p.NAMA_HKM||p.NAMA_DESA||p.NAMA_KEC||"Perhutanan sosial",
        subtitle:"Tutupan hutan dan hotspot dalam areal perhutanan sosial",
        area:number(p.LUAS_POLI||p.L_IUPHKM||p.LUAS_HA)||areaFromGeometry,
        key:analysisKeyValue(p.OBJECTID||p.ID||p.NO_IUPHKM||p.SK||
          [p.NAMA_HKM,p.NAMA_DESA,p.NAMA_KAB].filter(Boolean).join("|")).trim().toLowerCase()
      };
    }
    return {
      type:"villages",
      title:p.WADMKD||p.Desa||p.NAMOBJ||p.Nama_Desa||"Desa intervensi",
      subtitle:"Tutupan hutan dan hotspot dalam batas desa",
      area:areaFromAttributes||areaFromGeometry,
      key:String(p.Village_ID||p.VILLAGE_ID||p.Kode_Desa||p.KODE_DESA||
        [p.WADMKD||p.Desa,p.WADMKC||p.Kecamatan,p.WADMKK||p.Kabupaten].filter(Boolean).join("|")).trim().toLowerCase()
    };
  }

  function recordFor(info){
    var records=analytics[info.type]||{};
    if(records[info.key]){return records[info.key];}
    var title=normalizedName(info.title);
    return Object.keys(records).map(function(k){return records[k];}).find(function(item){
      return normalizedName(item.name||item.village||"")===title;
    })||null;
  }

  function normalizedName(value){
    return String(value||"")
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  }

  function kpi(label,value){
    return '<div class="yg-va-kpi"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>';
  }

  function bars(record){
    var annual=record&&(record.annualLossHa||record.annual_loss_ha)||{};
    var entries=Array.isArray(annual)
      ? annual.map(function(x){return [x.year,x.value];})
      : Object.keys(annual).map(function(year){return [year,annual[year]];});
    if(!entries.length){return '<div class="yg-va-note">Statistik tahunan belum dihitung untuk areal ini.</div>';}
    entries.sort(function(a,b){return Number(a[0])-Number(b[0]);});
    var max=Math.max.apply(null,entries.map(function(x){return Number(x[1])||0;}))||1;
    return entries.map(function(x){
      var value=Number(x[1])||0;
      return '<div class="yg-va-bar"><span>'+esc(x[0])+'</span><div class="yg-va-track"><div class="yg-va-fill" style="width:'+(value/max*100).toFixed(1)+'%"></div></div><strong>'+value.toLocaleString("id-ID",{maximumFractionDigits:1})+' ha</strong></div>';
    }).join("");
  }

  function referenceMetrics(record){
    var values=record&&record.referenceAreasHa;
    if(!values){
      return '<div class="yg-va-note">Irisan layer referensi belum dihitung untuk areal ini.</div>';
    }
    return '<div class="yg-va-grid">'+
      kpi("Kawasan hutan",formatHa(values.forestEstate))+
      kpi("Lahan gambut",formatHa(values.peat))+
      kpi("IUPHHK-HT",formatHa(values.concession))+
      kpi("Perhutanan sosial",formatHa(values.socialForestry))+
      '</div>';
  }

  function referenceBars(record,totalArea){
    var values=record&&record.referenceAreasHa;
    if(!values||!totalArea){return "";}
    var rows=[
      ["Kawasan hutan",values.forestEstate,"#455a64"],
      ["Gambut",values.peat,"#6a4a3a"],
      ["IUPHHK-HT",values.concession,"#c62828"],
      ["Perhutanan sosial",values.socialForestry,"#00897b"]
    ];
    return rows.map(function(row){
      var value=Number(row[1])||0;
      var percent=Math.min(100,value/totalArea*100);
      return '<div class="yg-va-bar"><span>'+esc(row[0])+'</span><div class="yg-va-track"><div class="yg-va-fill" style="width:'+percent.toFixed(1)+'%;background:'+row[2]+'"></div></div><strong>'+percent.toLocaleString("id-ID",{maximumFractionDigits:1})+'%</strong></div>';
    }).join("");
  }

  function hotspotSummaryBars(record){
    var v7=Number(record&&record.hotspot7d)||0;
    var v30=Number(record&&record.hotspot30d)||0;
    var max=Math.max(v7,v30,1);
    return '<div class="yg-va-trend">'+
      '<div class="yg-va-bar yg-va-bar-trend"><span>7 hari</span><div class="yg-va-track"><div class="yg-va-fill" style="width:'+(v7/max*100).toFixed(1)+'%;background:#ff4d2e"></div></div><strong>'+v7+' titik</strong></div>'+
      '<div class="yg-va-bar yg-va-bar-trend"><span>30 hari</span><div class="yg-va-track"><div class="yg-va-fill" style="width:'+(v30/max*100).toFixed(1)+'%;background:#ff4d2e"></div></div><strong>'+v30+' titik</strong></div>'+
      '</div>';
  }

  function hotspotYearlyBars(record){
    var yearly=record&&record.hotspotYearly5y;
    var rows=[];
    if(Array.isArray(yearly)&&yearly.length){
      rows=yearly
        .map(function(item){
          return {
            year:String(item&&item.year||""),
            count:Number(item&&item.count)||0
          };
        })
        .filter(function(item){return /^\d{4}$/.test(item.year);});
    }
    if(!rows.length){
      var nowYear=(new Date()).getFullYear();
      for(var year=nowYear-4;year<=nowYear;year+=1){
        rows.push({year:String(year),count:0});
      }
    }
    rows.sort(function(a,b){return Number(a.year)-Number(b.year);});
    var max=Math.max.apply(null,rows.map(function(item){return item.count;}))||1;
    var content=rows.map(function(item){
      return '<div class="yg-va-bar yg-va-bar-trend"><span>'+esc(item.year)+'</span><div class="yg-va-track"><div class="yg-va-fill" style="width:'+(item.count/max*100).toFixed(1)+'%;background:#ff4d2e"></div></div><strong>'+item.count+' titik</strong></div>';
    }).join("");
    return '<div class="yg-va-trend">'+content+'</div>';
  }

  function panel(){
    var element=document.getElementById("yg-village-analytics");
    if(element){return element;}
    element=document.createElement("section");
    element.id="yg-village-analytics";
    element.className="yg-village-analytics";
    element.hidden=true;
    element.innerHTML='<header class="yg-va-head"><div><h2 id="yg-va-title">Analitik areal</h2><p id="yg-va-subtitle"></p></div><div class="yg-va-actions"><button class="yg-va-download" type="button" id="yg-va-download">Unduh laporan</button><button class="yg-va-close" type="button" aria-label="Tutup">×</button></div></header><div class="yg-va-body" id="yg-va-body"></div>';
    document.getElementById("map-area").appendChild(element);
    element.querySelector(".yg-va-close").addEventListener("click",function(){element.hidden=true;});
    element.querySelector("#yg-va-download").addEventListener("click",function(){
      downloadAnalysisReport();
    });
    return element;
  }

  function reportKpis(info,record,pendingAdministrativeAnalytics){
    var baseline=record&&Number(record.baselineForestHa);
    var current=record&&Number(record.currentForestHa);
    var loss=record&&Number(record.totalLossHa);
    var gain=record&&Number(record.gainHa);
    var percent=current!=null&&isFinite(current)&&info.area>0?current/info.area*100:NaN;
    return [
      ["Luas areal",formatHa(info.area)],
      ["Tutupan baseline",pendingAdministrativeAnalytics?"Sedang diproses":formatHa(baseline)],
      ["Estimasi tutupan 2025",pendingAdministrativeAnalytics?"Sedang diproses":formatHa(current)],
      ["Tutupan areal",isFinite(percent)?percent.toLocaleString("id-ID",{maximumFractionDigits:1})+"%":(pendingAdministrativeAnalytics?"Sedang diproses":"Belum dihitung")],
      ["Kehilangan total",pendingAdministrativeAnalytics?"Sedang diproses":formatHa(loss)],
      ["Pertambahan/pemulihan",pendingAdministrativeAnalytics?"Sedang diproses":formatHa(gain)],
      ["Hotspot 7 hari",record&&record.hotspot7d!=null?String(record.hotspot7d):(pendingAdministrativeAnalytics?"Sedang diproses":"Lihat layer")],
      ["Hotspot 30 hari",record&&record.hotspot30d!=null?String(record.hotspot30d):(pendingAdministrativeAnalytics?"Sedang diproses":"Belum dihitung")]
    ];
  }

  function fileNameSafe(text){
    return String(text||"laporan")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,"-")
      .replace(/^-+|-+$/g,"")
      .slice(0,80)||"laporan";
  }

  function nowLabel(){
    return new Date().toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"});
  }

  function cloneFeature(feature){
    try{return JSON.parse(JSON.stringify(feature||{}));}
    catch(_error){return feature||{};}
  }

  function activeEnvironmentLayerIds(){
    var nodes=document.querySelectorAll('.yg-env-control input[data-env]:checked');
    return Array.prototype.slice.call(nodes).map(function(node){
      return String(node.getAttribute("data-env")||"").trim();
    }).filter(Boolean);
  }

  function activeReferenceLegendRows(){
    var nodes=document.querySelectorAll('.reference-layer-row input[data-reference-layer-id]:checked');
    return Array.prototype.slice.call(nodes).map(function(node){
      var row=node.closest('.reference-layer-row');
      if(!row){return null;}
      var label=row.querySelector('label');
      var swatch=row.querySelector('.swatch');
      return {
        label:label?String(label.textContent||"").trim():"Layer referensi",
        color:swatch?window.getComputedStyle(swatch).backgroundColor:"#4f6b61"
      };
    }).filter(Boolean);
  }

  function reportLegendItems(){
    var items=[
      {label:"Batas wilayah terpilih",color:"#0d6efd"}
    ];
    var envLabels={
      hotspot:{label:"Hotspot NASA VIIRS (30 hari)",color:"#ff4d2e"},
      cover:{label:"Tutupan lahan Indonesia 2017",color:"#6a8f5f"},
      loss:{label:"Kehilangan tutupan",color:"#e65100"},
      alerts:{label:"Alert perubahan terbaru",color:"#8b1d1d"}
    };
    activeEnvironmentLayerIds().forEach(function(id){
      if(envLabels[id]){items.push(envLabels[id]);}
    });

    var references=activeReferenceLegendRows();
    references.forEach(function(item){items.push(item);});
    return items;
  }

  function geometryRings(geometry){
    if(!geometry||!Array.isArray(geometry.coordinates)){return [];}
    if(geometry.type==="Polygon"){
      return geometry.coordinates.filter(function(r){return Array.isArray(r)&&r.length>=3;});
    }
    if(geometry.type==="MultiPolygon"){
      return geometry.coordinates.reduce(function(all,polygon){
        if(!Array.isArray(polygon)){return all;}
        polygon.forEach(function(ring){
          if(Array.isArray(ring)&&ring.length>=3){all.push(ring);}
        });
        return all;
      },[]);
    }
    return [];
  }

  function renderSchematicMapData(context){
    var geometry=context&&context.feature&&context.feature.geometry;
    var rings=geometryRings(geometry);
    if(!rings.length){return null;}

    var width=1280;
    var height=720;
    var padding=60;
    var canvas=document.createElement("canvas");
    canvas.width=width;
    canvas.height=height;
    var ctx=canvas.getContext("2d");
    if(!ctx){return null;}

    ctx.fillStyle="#eef5f1";
    ctx.fillRect(0,0,width,height);

    var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    rings.forEach(function(ring){
      ring.forEach(function(coord){
        var x=Number(coord&&coord[0]);
        var y=Number(coord&&coord[1]);
        if(!isFinite(x)||!isFinite(y)){return;}
        if(x<minX){minX=x;} if(x>maxX){maxX=x;}
        if(y<minY){minY=y;} if(y>maxY){maxY=y;}
      });
    });
    if(!isFinite(minX)||!isFinite(minY)||!isFinite(maxX)||!isFinite(maxY)){return null;}

    var rangeX=Math.max(1e-9,maxX-minX);
    var rangeY=Math.max(1e-9,maxY-minY);
    var scale=Math.min((width-padding*2)/rangeX,(height-padding*2)/rangeY);
    var offsetX=(width-rangeX*scale)/2;
    var offsetY=(height-rangeY*scale)/2;
    function px(coord){return offsetX+(Number(coord[0])-minX)*scale;}
    function py(coord){return height-(offsetY+(Number(coord[1])-minY)*scale);}

    ctx.strokeStyle="#d8e6de";
    ctx.lineWidth=1;
    for(var gx=padding;gx<=width-padding;gx+=80){
      ctx.beginPath();ctx.moveTo(gx,padding);ctx.lineTo(gx,height-padding);ctx.stroke();
    }
    for(var gy=padding;gy<=height-padding;gy+=80){
      ctx.beginPath();ctx.moveTo(padding,gy);ctx.lineTo(width-padding,gy);ctx.stroke();
    }

    ctx.fillStyle="rgba(13,110,253,0.18)";
    ctx.strokeStyle="#0d6efd";
    ctx.lineWidth=4;
    rings.forEach(function(ring,index){
      ctx.beginPath();
      ring.forEach(function(coord,i){
        var x=px(coord),y=py(coord);
        if(i===0){ctx.moveTo(x,y);} else {ctx.lineTo(x,y);} 
      });
      ctx.closePath();
      if(index===0){ctx.fill("evenodd");}
      ctx.stroke();
    });

    ctx.fillStyle="#0b4f8f";
    ctx.font="700 28px Arial";
    ctx.fillText("Peta fokus wilayah terpilih",padding,40);
    ctx.font="18px Arial";
    ctx.fillStyle="#496057";
    ctx.fillText(context&&context.info&&context.info.title?String(context.info.title):"Wilayah",padding,66);

    var center={lat:(minY+maxY)/2,lng:(minX+maxX)/2};
    return {
      image:canvas.toDataURL("image/jpeg",0.9),
      center:center,
      zoom:"N/A (schematic)",
      legend:reportLegendItems(),
      isFallback:true
    };
  }

  function blobToDataUrl(blob){
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onload=function(){resolve(String(reader.result||""));};
      reader.onerror=function(){reject(reader.error||new Error("Gagal membaca blob"));};
      reader.readAsDataURL(blob);
    });
  }

  async function loadLogoDataUrl(){
    try{
      var response=await fetch("assets/logo-yayasan-gambut.png",{cache:"no-store"});
      if(!response.ok){return null;}
      var blob=await response.blob();
      return await blobToDataUrl(blob);
    }catch(error){
      console.warn("Logo tidak dapat dimuat untuk laporan",error);
      return null;
    }
  }

  async function captureReportMapImage(context){
    if(!context||!context.feature||typeof window.html2canvas!=="function"){return null;}
    var mapNode=document.createElement("div");
    mapNode.style.cssText=[
      "position:fixed",
      "left:-20000px",
      "top:0",
      "width:1280px",
      "height:720px",
      "z-index:-1",
      "background:#f2f7f4"
    ].join(";");
    document.body.appendChild(mapNode);

    var reportMap=L.map(mapNode,{
      zoomControl:false,
      attributionControl:false,
      preferCanvas:true,
      dragging:false,
      scrollWheelZoom:false,
      doubleClickZoom:false,
      boxZoom:false,
      keyboard:false,
      tap:false,
      touchZoom:false
    }).setView([1.2,102.1],8);

    var base=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      maxZoom:19,
      crossOrigin:true
    }).addTo(reportMap);

    var env=activeEnvironmentLayerIds();
    if(env.indexOf("cover")>=0){
      L.tileLayer(GFW.cover,{opacity:.55,maxZoom:18,crossOrigin:true}).addTo(reportMap);
    }
    if(env.indexOf("loss")>=0){
      L.tileLayer(GFW.loss,{opacity:.7,maxZoom:18,crossOrigin:true}).addTo(reportMap);
    }
    if(env.indexOf("alerts")>=0){
      L.tileLayer(GFW.alerts,{opacity:.75,maxZoom:18,crossOrigin:true}).addTo(reportMap);
    }

    var selected=L.geoJSON(cloneFeature(context.feature),{
      style:function(){
        return {
          color:"#0d6efd",
          weight:3,
          fillColor:"#0d6efd",
          fillOpacity:.16
        };
      }
    }).addTo(reportMap);

    var bounds=selected.getBounds();
    if(bounds&&bounds.isValid()){
      reportMap.fitBounds(bounds,{padding:[45,45],maxZoom:13});
    }

    try{
      await new Promise(function(resolve){window.setTimeout(resolve,2200);});
      var center=reportMap.getCenter();
      var zoom=reportMap.getZoom();
      var canvas=await window.html2canvas(mapNode,{
        useCORS:true,
        allowTaint:true,
        logging:false,
        scale:1,
        backgroundColor:"#f2f7f4"
      });
      return {
        image:canvas.toDataURL("image/jpeg",0.86),
        center:center,
        zoom:zoom,
        legend:reportLegendItems(),
        isFallback:false
      };
    }catch(error){
      console.warn("Gagal menangkap snapshot peta",error);
      return renderSchematicMapData(context);
    }finally{
      try{reportMap.remove();}catch(_error){}
      try{base.remove();}catch(_error){}
      mapNode.remove();
    }
  }

  function drawReportLegend(doc,legendItems,startY,margin){
    if(!legendItems||!legendItems.length){return startY;}
    var y=startY;
    doc.setFontSize(10);
    doc.setTextColor(28,44,39);
    doc.text("Legenda laporan",margin,y);
    y+=4;

    legendItems.forEach(function(item){
      if(y>287){return;}
      var label=String(item&&item.label||"Layer");
      var color=String(item&&item.color||"#4f6b61");
      var rgb=[79,107,97];
      var match=color.match(/\d+/g);
      if(match&&match.length>=3){
        rgb=[Number(match[0])||79,Number(match[1])||107,Number(match[2])||97];
      }else if(/^#([a-f0-9]{6})$/i.test(color)){
        rgb=[
          parseInt(color.slice(1,3),16),
          parseInt(color.slice(3,5),16),
          parseInt(color.slice(5,7),16)
        ];
      }
      doc.setFillColor(rgb[0],rgb[1],rgb[2]);
      doc.rect(margin,y-2.7,4,4,"F");
      doc.setFontSize(8.5);
      doc.setTextColor(56,72,67);
      doc.text(label,margin+6,y);
      y+=5.3;
    });
    return y;
  }

  async function downloadAnalysisReport(){
    var context=currentAnalysisContext;
    if(!context){return;}
    if(!window.jspdf||!window.jspdf.jsPDF){
      alert("Generator PDF belum siap. Muat ulang halaman lalu coba lagi.");
      return;
    }

    var button=document.getElementById("yg-va-download");
    if(button){button.disabled=true;button.textContent="Menyiapkan...";}

    try{
      var jsPDF=window.jspdf.jsPDF;
      var doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
      var mapSnapshot=await captureReportMapImage(context);
      if(!mapSnapshot){
        mapSnapshot=renderSchematicMapData(context);
      }
      var mapImage=mapSnapshot&&mapSnapshot.image;
      var logoImage=await loadLogoDataUrl();
      var margin=12;
      var y=12;

      doc.setFillColor(7,95,73);
      doc.rect(0,0,210,30,"F");
      if(logoImage){
        doc.addImage(logoImage,"PNG",176,5,24,19);
      }
      doc.setTextColor(255,255,255);
      doc.setFontSize(16);
      doc.text("Laporan Analisis Wilayah",margin,12);
      doc.setFontSize(10);
      doc.text(context.info.title,margin,19);
      doc.text("Diproduksi oleh Yayasan Gambut",margin,24);
      doc.text("Dibuat: "+nowLabel(),margin,28);

      y=36;
      doc.setTextColor(28,44,39);
      doc.setFontSize(10);
      doc.text("Ringkasan",margin,y);
      y+=4;

      var kpis=reportKpis(context.info,context.record,context.pendingAdministrativeAnalytics);
      for(var i=0;i<kpis.length;i+=1){
        var col=i%2;
        var row=Math.floor(i/2);
        var x=margin+(col*94);
        var boxY=y+(row*12);
        doc.setDrawColor(220,231,225);
        doc.rect(x,boxY,90,10);
        doc.setFontSize(8);
        doc.setTextColor(88,104,99);
        doc.text(kpis[i][0],x+2,boxY+3.5);
        doc.setFontSize(10);
        doc.setTextColor(7,95,73);
        doc.text(String(kpis[i][1]),x+2,boxY+7.8);
      }

      y+=50;
      doc.setFontSize(10);
      doc.setTextColor(28,44,39);
      doc.text("Layout peta",margin,y);
      y+=3;

      if(mapImage){
        doc.addImage(mapImage,"JPEG",margin,y,186,88);
        y+=92;
      }else{
        doc.setFontSize(9);
        doc.setTextColor(114,82,0);
        doc.text("Snapshot peta tidak tersedia pada browser ini.",margin,y+6);
        y+=12;
      }

      y=drawReportLegend(doc,mapSnapshot&&mapSnapshot.legend||reportLegendItems(),y,margin);

      if(mapSnapshot&&mapSnapshot.center){
        doc.setFontSize(8);
        doc.setTextColor(88,104,99);
        doc.text(
          "Pusat peta: "+mapSnapshot.center.lat.toFixed(5)+", "+mapSnapshot.center.lng.toFixed(5)+" | Zoom: "+mapSnapshot.zoom,
          margin,
          Math.min(291,y+6)
        );
      }

      if(context.pendingAdministrativeAnalytics){
        doc.setFontSize(8);
        doc.setTextColor(114,82,0);
        doc.text(
          "Status: sebagian indikator sedang diproses otomatis pada pipeline analitik.",
          margin,
          Math.min(291,y+11)
        );
      }

      if(mapSnapshot&&mapSnapshot.isFallback){
        doc.setFontSize(8);
        doc.setTextColor(114,82,0);
        doc.text(
          "Catatan peta: browser membatasi capture tile, laporan memakai peta skematik polygon terpilih.",
          margin,
          Math.min(294,y+15)
        );
      }

      doc.setFontSize(8);
      doc.setTextColor(88,104,99);
      doc.text(
        "Sumber data: NASA FIRMS/VIIRS, Global Forest Watch (Hansen GFC), dan data spasial internal Yayasan Gambut.",
        margin,
        295
      );

      var filename="laporan-"+fileNameSafe(context.info.title)+"-"+
        new Date().toISOString().slice(0,10)+".pdf";
      doc.save(filename);
    }finally{
      if(button){button.disabled=false;button.textContent="Unduh laporan";}
    }
  }

  function showAnalysis(feature,layerId){
    var element=panel(),info=unitInfo(feature,layerId),record=recordFor(info);
    var pendingAdministrativeAnalytics=!record&&layerId==="batas_administrasi_desa_riau";
    var kpis=reportKpis(info,record,pendingAdministrativeAnalytics);
    document.getElementById("yg-va-title").textContent=info.title;
    document.getElementById("yg-va-subtitle").textContent=info.subtitle;
    currentAnalysisContext={
      info:info,
      record:record,
      layerId:layerId,
      pendingAdministrativeAnalytics:pendingAdministrativeAnalytics
    };
    document.getElementById("yg-va-body").innerHTML=
      '<div class="yg-va-grid">'+
      kpi(kpis[0][0],kpis[0][1])+
      kpi(kpis[1][0],kpis[1][1])+
      kpi(kpis[2][0],kpis[2][1])+
      kpi(kpis[3][0],kpis[3][1])+
      kpi(kpis[4][0],kpis[4][1])+
      kpi(kpis[5][0],kpis[5][1])+
      kpi(kpis[6][0],kpis[6][1])+
      kpi(kpis[7][0],kpis[7][1])+
      '</div><section class="yg-va-section"><h3>Kehilangan tutupan hutan per tahun</h3>'+bars(record)+'</section>'+
      '<section class="yg-va-section"><h3>Luas irisan layer referensi</h3>'+referenceMetrics(record)+referenceBars(record,info.area)+'</section>'+
      '<section class="yg-va-section"><h3>Ringkasan hotspot</h3>'+hotspotSummaryBars(record)+'</section>'+
      '<section class="yg-va-section"><h3>Total hotspot per tahun (5 tahun terakhir)</h3>'+hotspotYearlyBars(record)+'</section>'+
      (!record?'<div class="yg-va-note" style="margin-top:12px">'+(pendingAdministrativeAnalytics?"Data analisis untuk desa ini sedang diproses otomatis dan akan terisi bertahap setelah pipeline selesai.":"Angka luas hutan memerlukan analisis raster per polygon. Sistem tidak mengestimasi angka dari gambar tile.")+'</div>':"")+
      '<div class="yg-va-source">Sumber: NASA FIRMS/VIIRS melalui GFW dan Global Forest Watch/Hansen. Hotspot adalah anomali panas, bukan konfirmasi kebakaran.</div>';
    element.hidden=false;
  }

  function attachOne(layer,layerId){
    if(!layer||!layer.feature||attached.has(layer)){return;}
    attached.add(layer);
    var open=function(){showAnalysis(layer.feature,layerId);};
    layer.on("click",open);
    layer.on("popupopen",open);
  }

  function attachGroup(group,layerId){
    if(!group){return false;}
    (function visit(layer){
      if(layer&&layer.feature){attachOne(layer,layerId);}
      if(layer&&layer.eachLayer){layer.eachLayer(visit);}
    })(group);
    return true;
  }

  function attachAll(){
    var api=window.YG_MAP;
    if(!api){return;}
    attachGroup(api.layerObjects&&api.layerObjects.desa_intervensi,"desa_intervensi");
    attachGroup(api.referenceLayerObjects&&api.referenceLayerObjects.perhutanan_sosial_riau,"perhutanan_sosial_riau");
    attachGroup(api.referenceLayerObjects&&api.referenceLayerObjects.batas_administrasi_desa_riau,"batas_administrasi_desa_riau");
  }

  function detectedLayerId(feature){
    var p=feature&&feature.properties||{};
    if(p.NO_IUPHKM||p.NAMA_HKM||p.L_IUPHKM){return "perhutanan_sosial_riau";}
    if(p.Village_ID||p.VILLAGE_ID||p.Kode_Desa||p.KODE_DESA){
      return "desa_intervensi";
    }
    return "";
  }

  function attachDiscovered(layer){
    if(!layer){return;}
    if(layer.eachLayer){
      layer.eachLayer(function(child){attachDiscovered(child);});
      return;
    }
    var layerId=detectedLayerId(layer.feature);
    if(layerId){attachOne(layer,layerId);}
  }

  function viirsUrl(){
    var end=new Date(),start=new Date(end.getTime()-30*86400000);
    function day(date){return date.toISOString().slice(0,10);}
    return "https://tiles.globalforestwatch.org/nasa_viirs_fire_alerts/latest/dynamic/{z}/{x}/{y}.pbf?start_date="+day(start)+"&end_date="+day(end);
  }

  function environmentalControl(map,layers){
    var control=L.control({position:"topright"});
    control.onAdd=function(){
      var box=L.DomUtil.create("div","yg-env-control");
      L.DomEvent.disableClickPropagation(box);
      box.innerHTML='<strong>Pemantauan lingkungan</strong>'+
        toggle("hotspot","Hotspot NASA VIIRS (30 hari)")+
        toggle("cover","Tutupan lahan Indonesia 2017")+
        toggle("loss","Kehilangan tutupan")+
        toggle("alerts","Alert perubahan terbaru")+
        '<div class="yg-env-source">NASA FIRMS · Global Forest Watch</div>';
      box.addEventListener("change",function(event){
        var layer=layers[event.target.getAttribute("data-env")];
        if(!layer){return;}
        event.target.checked?layer.addTo(map):map.removeLayer(layer);
      });
      return box;
    };
    control.addTo(map);
  }

  function toggle(id,label){
    return '<label><input type="checkbox" data-env="'+id+'"> '+esc(label)+'</label>';
  }

  function indonesiaClip(map,pane){
    var namespace="http://www.w3.org/2000/svg";
    var svg=document.createElementNS(namespace,"svg");
    var definitions=document.createElementNS(namespace,"defs");
    var clip=document.createElementNS(namespace,"clipPath");
    var path=document.createElementNS(namespace,"path");
    var geometry=null,scheduled=false;
    clip.id="yg-indonesia-environment-clip";
    clip.setAttribute("clipPathUnits","userSpaceOnUse");
    path.setAttribute("clip-rule","evenodd");
    clip.appendChild(path);
    definitions.appendChild(clip);
    svg.appendChild(definitions);
    svg.setAttribute("aria-hidden","true");
    svg.style.cssText="position:absolute;width:0;height:0;overflow:hidden";
    document.getElementById("map").appendChild(svg);
    pane.style.clipPath="url(#"+clip.id+")";
    pane.style.webkitClipPath="url(#"+clip.id+")";
    pane.style.visibility="hidden";

    function ringPath(ring){
      return ring.map(function(coordinate,index){
        var point=map.latLngToLayerPoint([coordinate[1],coordinate[0]]);
        return (index?"L":"M")+point.x.toFixed(1)+" "+point.y.toFixed(1);
      }).join("")+"Z";
    }

    function geometryPath(value){
      if(!value){return "";}
      if(value.type==="Polygon"){
        return value.coordinates.map(ringPath).join("");
      }
      if(value.type==="MultiPolygon"){
        return value.coordinates.map(function(polygon){
          return polygon.map(ringPath).join("");
        }).join("");
      }
      return "";
    }

    function redraw(){
      scheduled=false;
      if(!geometry){return;}
      path.setAttribute("d",geometryPath(geometry));
      pane.style.visibility="visible";
    }

    function schedule(){
      if(scheduled){return;}
      scheduled=true;
      requestAnimationFrame(redraw);
    }

    map.on("move moveend zoom zoomend viewreset resize",schedule);
    return fetch("data/indonesia-boundary.geojson?v=20260724-2")
      .then(function(response){
        if(!response.ok){throw new Error("HTTP "+response.status);}
        return response.json();
      })
      .then(function(data){
        geometry=data&&data.features&&data.features[0]&&data.features[0].geometry;
        if(!geometry){throw new Error("Geometri Indonesia tidak tersedia");}
        redraw();
      })
      .catch(function(error){
        pane.style.visibility="hidden";
        console.warn("Layer lingkungan dinonaktifkan karena batas Indonesia gagal dimuat",error);
      });
  }

  function init(){
    var api=window.YG_MAP;
    if(!api||!api.map){setTimeout(init,250);return;}
    var map=api.map;
    var environmentPane=map.createPane("yg-indonesia-environment-pane");
    environmentPane.style.zIndex="385";
    environmentPane.style.width="100%";
    environmentPane.style.height="100%";
    indonesiaClip(map,environmentPane);
    GRID_OPTIONS.pane="yg-indonesia-environment-pane";
    map.on("layeradd",function(event){attachDiscovered(event.layer);});
    map.eachLayer(function(layer){attachDiscovered(layer);});
    var viirs=L.vectorGrid.protobuf(viirsUrl(),Object.assign({},GRID_OPTIONS,{
      interactive:true,
      maxNativeZoom:14,
      vectorTileLayerStyles:{
        nasa_viirs_fire_alerts:{radius:5,color:"#8b1d1d",weight:1,fill:true,fillColor:"#ff4d2e",fillOpacity:.85}
      }
    }));
    viirs.on("click",function(event){
      var props=event.layer&&event.layer.properties||{};
      L.popup().setLatLng(event.latlng).setContent(
        "<strong>Hotspot NASA VIIRS</strong><br>"+
        esc(props.alert__date||props.acq_date||props.date||"30 hari terakhir")+
        "<br><small>Anomali panas, bukan konfirmasi kebakaran.</small>"
      ).openOn(map);
    });
    environmentalControl(map,{
      hotspot:viirs,
      cover:L.tileLayer(GFW.cover,Object.assign({},GRID_OPTIONS,{opacity:.55,maxZoom:18,attribution:"Global Forest Watch"})),
      loss:L.tileLayer(GFW.loss,Object.assign({},GRID_OPTIONS,{opacity:.7,maxZoom:18,attribution:"Global Forest Watch / UMD"})),
      alerts:L.tileLayer(GFW.alerts,Object.assign({},GRID_OPTIONS,{opacity:.75,maxZoom:18,attribution:"Global Forest Watch"}))
    });
    window.YG_ENVIRONMENTAL_MONITORING={
      map:map,
      refreshBindings:attachAll
    };
    fetch("data/village-forest-analytics.json?v="+Date.now())
      .then(function(response){return response.ok?response.json():analytics;})
      .then(function(data){analytics=data;})
      .catch(function(error){console.warn("Analitik areal belum tersedia",error);})
      .finally(function(){
        attachAll();
        var attempts=0;
        var timer=setInterval(function(){
          attempts+=1;
          attachAll();
          if(attempts>2400){clearInterval(timer);}
        },250);
      });
  }

  init();
})();
