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

  function esc(value){
    return String(value==null?"":value).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  function number(value){
    var n=Number(String(value==null?"":value).replace(",","."));
    return isFinite(n)?n:0;
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
    if(layerId==="perhutanan_sosial_riau"){
      return {
        type:"socialForestry",
        title:p.NAMA_HKM||p.NAMA_DESA||p.NAMA_KEC||"Perhutanan sosial",
        subtitle:"Tutupan hutan dan hotspot dalam areal perhutanan sosial",
        area:number(p.LUAS_POLI||p.L_IUPHKM||p.LUAS_HA),
        key:analysisKeyValue(p.OBJECTID||p.ID||p.NO_IUPHKM||p.SK||
          [p.NAMA_HKM,p.NAMA_DESA,p.NAMA_KAB].filter(Boolean).join("|")).trim().toLowerCase()
      };
    }
    return {
      type:"villages",
      title:p.WADMKD||p.Desa||p.NAMOBJ||p.Nama_Desa||"Desa intervensi",
      subtitle:"Tutupan hutan dan hotspot dalam batas desa",
      area:number(p.Luas_Ha||p.Area_Ha||p.areaHa||p.LUASWH),
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
    element.innerHTML='<header class="yg-va-head"><div><h2 id="yg-va-title">Analitik areal</h2><p id="yg-va-subtitle"></p></div><button class="yg-va-close" type="button" aria-label="Tutup">×</button></header><div class="yg-va-body" id="yg-va-body"></div>';
    document.getElementById("map-area").appendChild(element);
    element.querySelector(".yg-va-close").addEventListener("click",function(){element.hidden=true;});
    return element;
  }

  function showAnalysis(feature,layerId){
    var element=panel(),info=unitInfo(feature,layerId),record=recordFor(info);
    var baseline=record&&Number(record.baselineForestHa);
    var current=record&&Number(record.currentForestHa);
    var loss=record&&Number(record.totalLossHa);
    var gain=record&&Number(record.gainHa);
    var percent=current!=null&&isFinite(current)&&info.area>0?current/info.area*100:NaN;
    document.getElementById("yg-va-title").textContent=info.title;
    document.getElementById("yg-va-subtitle").textContent=info.subtitle;
    document.getElementById("yg-va-body").innerHTML=
      '<div class="yg-va-grid">'+
      kpi("Luas areal",formatHa(info.area))+
      kpi("Tutupan baseline",formatHa(baseline))+
      kpi("Estimasi tutupan 2025",formatHa(current))+
      kpi("Tutupan areal",isFinite(percent)?percent.toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"Belum dihitung")+
      kpi("Kehilangan total",formatHa(loss))+
      kpi("Pertambahan/pemulihan",formatHa(gain))+
      kpi("Hotspot 7 hari",record&&record.hotspot7d!=null?record.hotspot7d:"Lihat layer")+
      kpi("Hotspot 30 hari",record&&record.hotspot30d!=null?record.hotspot30d:"Belum dihitung")+
      '</div><section class="yg-va-section"><h3>Kehilangan tutupan hutan per tahun</h3>'+bars(record)+'</section>'+
      '<section class="yg-va-section"><h3>Luas irisan layer referensi</h3>'+referenceMetrics(record)+referenceBars(record,info.area)+'</section>'+
      '<section class="yg-va-section"><h3>Ringkasan hotspot</h3>'+hotspotSummaryBars(record)+'</section>'+
      '<section class="yg-va-section"><h3>Total hotspot per tahun (5 tahun terakhir)</h3>'+hotspotYearlyBars(record)+'</section>'+
      (!record?'<div class="yg-va-note" style="margin-top:12px">Angka luas hutan memerlukan analisis raster per polygon. Sistem tidak mengestimasi angka dari gambar tile.</div>':"")+
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
