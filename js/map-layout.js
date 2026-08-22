(function(){
"use strict";
var SNAPSHOT="https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev/snapshots/current/objects.json";
var params=new URLSearchParams(location.search);
var key=String(params.get("key")||"").trim().toLowerCase();
var source=String(params.get("source")||"intervention").trim().toLowerCase();
var map,localInset,riauInset,villageFeature,villageBounds,snapshotData,baseLayer;
var RIAU_FRAME=L.latLngBounds([[-1.25,99.85],[2.85,104.25]]);
var active={},customCount=0;
var defs={
  village:{label:"Batas desa",color:"#d7df00",fill:"rgba(215,223,0,.04)",locked:true,source:"Master Database Yayasan Gambut"},
  feg:{label:"Fungsi Ekosistem Gambut",color:"#a87500",fill:"rgba(239,158,0,.50)",url:"data/feg_riau.geojson",source:"Fungsi Ekosistem Gambut – referensi KLHK",sublegend:[["FEG fungsi lindung","#9b7000","rgba(155,112,0,.62)"],["FEG fungsi budidaya","#ed9d00","rgba(237,157,0,.62)"]]},
  forest:{label:"Kawasan hutan",color:"#33691e",fill:"rgba(76,175,80,.30)",url:"data/kawasan_hutan_sk_903.geojson",source:"Kawasan Hutan SK 903"},
  concession:{label:"Konsesi kehutanan",color:"#d32f2f",fill:"rgba(211,47,47,.10)",url:"data/IUPHHK_HT_2014.geojson",source:"IUPHHK-HT 2014"},
  social:{label:"Perhutanan sosial",color:"#00897b",fill:"rgba(0,137,123,.25)",url:"data/PERHUTANAN_SOSIAL_RIAU.geojson",source:"Perhutanan Sosial Riau"},
  peat:{label:"Sebaran gambut",color:"#6a1b9a",fill:"rgba(106,27,154,.22)",url:"data/Gambut_BBSDLP_2019.geojson",source:"Peta Gambut BBSDLP 2019"},
  area_mangrove:{label:"Area penanaman mangrove",color:"#00796b",fill:"rgba(0,121,107,.34)",program:true,source:"Master Database Yayasan Gambut"},
  apo:{label:"Alat pemecah ombak",color:"#d32f2f",fill:"rgba(211,47,47,.18)",program:true,source:"Master Database Yayasan Gambut"},
  sekat_kanal:{label:"Sekat kanal",color:"#00838f",fill:"#00838f",program:true,point:true,source:"Master Database Yayasan Gambut"},
  fdrs:{label:"FDRS / Water Table",color:"#e65100",fill:"#e65100",program:true,point:true,source:"Master Database Yayasan Gambut"},
  nursery_mangrove:{label:"Rumah pembibitan mangrove",color:"#8fa600",fill:"#8fa600",program:true,point:true,source:"Master Database Yayasan Gambut"},
  monitoring_reports:{label:"Monitoring terverifikasi",color:"#f9a825",fill:"#f9a825",program:true,point:true,source:"Master Database Yayasan Gambut"}
};
var order=["village","feg","forest","concession","social","peat","area_mangrove","apo","sekat_kanal","fdrs","nursery_mangrove","monitoring_reports"];
function el(id){return document.getElementById(id)}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function norm(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function lid(f){var p=f&&f.properties||{};return String(p.Layer_ID||p.Source_Layer||"").toLowerCase()}
function fkey(f){var p=f&&f.properties||{};return[p.WADMKD||p.Desa||p.NAMOBJ||p.Nama_Desa,p.WADMKC||p.Kecamatan,p.WADMKK||p.Kabupaten].filter(Boolean).join("|").trim().toLowerCase()}
function nameOf(f){var p=f&&f.properties||{};return p.Nama_Objek||p.title||p.WADMKD||p.Desa||p.NAMOBJ||""}
function toast(t){var n=el("toast");n.textContent=t;n.classList.add("show");setTimeout(function(){n.classList.remove("show")},2200)}
async function json(url){var r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}
function tile(kind){
  if(kind==="clean")return null;
  var url=kind==="satellite"?"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}":"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  return L.tileLayer(url,{maxNativeZoom:kind==="satellite"?17:19,maxZoom:20,crossOrigin:"anonymous",attribution:kind==="satellite"?"Tiles © Esri":"© OpenStreetMap"});
}
function setBasemap(kind){
  if(baseLayer)map.removeLayer(baseLayer);
  baseLayer=tile(kind);if(baseLayer)baseLayer.addTo(map);if(active.village)active.village.bringToFront();
}
function dms(value,lat){
  var a=Math.abs(value),d=Math.floor(a),m=Math.floor((a-d)*60),s=Math.round((((a-d)*60)-m)*60);
  return d+"°"+m+"′"+s+"″"+(lat?(value>=0?"N":"S"):(value>=0?"E":"W"));
}
function grid(){
  if(!map)return;var b=map.getBounds(),xs=[],ys=[],i;
  for(i=0;i<5;i+=1){xs.push(b.getWest()+(b.getEast()-b.getWest())*i/4);ys.push(b.getNorth()-(b.getNorth()-b.getSouth())*(i+.5)/5)}
  var xh=xs.map(function(x){return"<span>"+dms(x,false)+"</span>"}).join(""),yh=ys.map(function(y,index){return'<span style="top:'+(10+index*20)+'%">'+dms(y,true)+"</span>"}).join("");
  el("coord-top").innerHTML=xh;el("coord-bottom").innerHTML=xh;el("coord-left").innerHTML=yh;el("coord-right").innerHTML=yh;
  var center=map.getCenter(),meters=156543.03392*Math.cos(center.lat*Math.PI/180)/Math.pow(2,map.getZoom()),scale=Math.round(meters*96/0.0254);
  el("scale-label").textContent="± 1 : "+scale.toLocaleString("id-ID");
}
function coordsBBox(coords,box){
  if(!Array.isArray(coords))return box;
  if(typeof coords[0]==="number"&&typeof coords[1]==="number"){box[0]=Math.min(box[0],coords[0]);box[1]=Math.min(box[1],coords[1]);box[2]=Math.max(box[2],coords[0]);box[3]=Math.max(box[3],coords[1]);return box}
  coords.forEach(function(c){coordsBBox(c,box)});return box;
}
function intersects(f,b){
  if(!f||!f.geometry)return false;var x=coordsBBox(f.geometry.coordinates,[Infinity,Infinity,-Infinity,-Infinity]);
  return x[2]>=b.getWest()&&x[0]<=b.getEast()&&x[3]>=b.getSouth()&&x[1]<=b.getNorth();
}
function styleFor(id,f){
  var d=defs[id],p=f&&f.properties||{},color=d.color,fill=d.fill;
  if(id==="feg"){var v=String(p.fungsi_feg||p.feg_kghltr||p.feg_50k||p.feg_peat||"").toLowerCase();if(v.includes("lindung")){color="#9b7000";fill="#9b7000"}else{color="#ed9d00";fill="#ed9d00"}}
  return{color:color,weight:id==="village"?4:1.4,opacity:1,fillColor:fill,fillOpacity:id==="village"?.04:(id==="concession"?.10:.32),dashArray:id==="village"?"8 4":null};
}
function pointFor(id,feature,latlng){var d=defs[id];return L.circleMarker(latlng,{radius:6,color:"#fff",weight:2,fillColor:d.color,fillOpacity:1})}
function labelLayer(layer,feature,id){
  var text=id==="village"?(feature.properties.WADMKD||feature.properties.Desa):nameOf(feature);
  if(text&&id!=="forest"&&id!=="feg"&&id!=="peat")layer.bindTooltip(String(text),{permanent:id==="village",direction:"center",className:"ml-label"});
}
function geoLayer(id,data){
  return L.geoJSON(data,{style:function(f){return styleFor(id,f)},pointToLayer:function(f,ll){return pointFor(id,f,ll)},onEachFeature:function(f,l){labelLayer(l,f,id)}});
}
function sourceEntries(){
  var seen={},list=[];Object.keys(active).forEach(function(id){var d=defs[id];if(d&&d.source&&!seen[d.source]){seen[d.source]=1;list.push(d.source)}});
  el("source-list").innerHTML=list.map(function(x){return"<li>"+esc(x)+"</li>"}).join("");
}
function legend(){
  var rows=[];order.concat(Object.keys(defs).filter(function(x){return order.indexOf(x)<0})).forEach(function(id){
    if(!active[id])return;var d=defs[id];
    if(d.sublegend)d.sublegend.forEach(function(s){rows.push([s[0],s[1],s[2],false])});
    else rows.push([d.label,d.color,d.fill,d.point]);
  });
  el("layout-legend").innerHTML=rows.map(function(r){return'<div class="legend-row"><i class="legend-symbol'+(r[3]?" point":"")+'" style="--stroke:'+r[1]+';--fill:'+r[2]+'"></i><span>'+esc(r[0])+'</span></div>'}).join("");
  sourceEntries();
}
async function addLayer(id){
  if(active[id])return;var d=defs[id],data;
  setToggleLoading(id,true);
  try{
    if(id==="village")data=villageFeature;
    else if(d.program)data={type:"FeatureCollection",features:(snapshotData.features||[]).filter(function(f){return lid(f)===id&&intersects(f,villageBounds.pad(.35))})};
    else{data=await json(d.url);data={type:"FeatureCollection",features:(data.features||[]).filter(function(f){return intersects(f,villageBounds.pad(.25))})}}
    var layer=geoLayer(id,data).addTo(map);active[id]=layer;if(id==="village")layer.bringToFront();legend();status(d.label+" aktif");
  }catch(e){console.error(e);toast("Layer "+d.label+" gagal dimuat");var box=document.querySelector('[data-layer="'+id+'"] input');if(box)box.checked=false}
  finally{setToggleLoading(id,false)}
}
function removeLayer(id){if(!active[id]||defs[id].locked)return;map.removeLayer(active[id]);delete active[id];legend()}
function setToggleLoading(id,on){var row=document.querySelector('[data-layer="'+id+'"]');if(row)row.classList.toggle("is-loading",on)}
function status(t){el("layout-status").textContent=t}
function controls(){
  el("layer-options").innerHTML=order.map(function(id){var d=defs[id];return'<label class="ml-layer-toggle" data-layer="'+id+'" style="--swatch:'+d.color+';--fill:'+d.fill+'"><input type="checkbox" '+(id==="village"?"checked disabled":"")+'><i></i><span>'+esc(d.label)+'</span></label>'}).join("");
  document.querySelectorAll(".ml-layer-toggle input").forEach(function(input){input.addEventListener("change",function(){var id=input.parentNode.dataset.layer;if(input.checked)addLayer(id);else removeLayer(id)})});
}
function fitRiauInset(){
  if(!riauInset){return}
  riauInset.invalidateSize(false);
  var frame=L.latLngBounds(RIAU_FRAME.getSouthWest(),RIAU_FRAME.getNorthEast());
  if(villageBounds&&villageBounds.isValid()){frame.extend(villageBounds)}
  riauInset.fitBounds(frame.pad(.10),{padding:[8,8],animate:false});
}
function initInsets(){
  localInset=L.map("inset-local",{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false});
  tile("road").addTo(localInset);var vl=geoLayer("village",villageFeature).addTo(localInset);localInset.fitBounds(vl.getBounds().pad(.6));
  riauInset=L.map("inset-riau",{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false});
  tile("road").addTo(riauInset);
  var c=villageBounds.getCenter(),p=villageFeature.properties||{},villageName=p.WADMKD||p.Desa||p.NAMOBJ||key.split("|")[0]||"Lokasi desa";
  L.rectangle(villageBounds,{color:"#d32f2f",weight:2,fillOpacity:.12}).addTo(riauInset);
  L.circleMarker(c,{radius:5,color:"#ffffff",weight:2,fillColor:"#d32f2f",fillOpacity:1})
    .addTo(riauInset)
    .bindTooltip(villageName,{permanent:true,direction:"auto",offset:[7,0],opacity:1,className:"ml-inset-village-label"});
  fitRiauInset();
}
function titleSetup(){
  var p=villageFeature.properties||{},parts=key.split("|"),v=p.WADMKD||p.Desa||parts[0],k=p.WADMKC||p.Kecamatan||parts[1],kab=p.WADMKK||p.Kabupaten||parts[2];
  el("map-title-input").value="Peta Desa "+v;el("map-subtitle-input").value=["Desa "+v,"Kecamatan "+k,"Kabupaten "+kab,"Provinsi Riau"].filter(Boolean).join("\n");
  function sync(){el("sheet-title").textContent=el("map-title-input").value||"Peta Desa";el("sheet-subtitle").innerHTML=esc(el("map-subtitle-input").value).replace(/\n/g,"<br>")}
  el("map-title-input").addEventListener("input",sync);el("map-subtitle-input").addEventListener("input",sync);sync();document.title="Layout Peta "+v+" | Yayasan Gambut";
}
function initMap(){
  map=L.map("print-map",{zoomControl:true,preferCanvas:true}).setView([1.2,102],9);setBasemap("road");L.control.scale({imperial:false,maxWidth:160,position:"bottomleft"}).addTo(map);
  var village=geoLayer("village",villageFeature).addTo(map);active.village=village;villageBounds=village.getBounds();map.fitBounds(villageBounds.pad(.08));map.on("moveend zoomend",grid);
  controls();legend();titleSetup();initInsets();grid();el("map-loading").hidden=true;status("Layout siap");setTimeout(function(){map.invalidateSize();localInset.invalidateSize();fitRiauInset();map.fitBounds(villageBounds.pad(.08));grid()},100);
}
async function capture(){
  status("Menyiapkan gambar resolusi tinggi…");map.invalidateSize();localInset.invalidateSize();fitRiauInset();await new Promise(function(r){setTimeout(r,500)});
  return html2canvas(el("map-sheet"),{scale:2,useCORS:true,allowTaint:false,backgroundColor:"#ffffff",logging:false});
}
async function download(kind){
  var buttons=[el("export-png"),el("export-pdf")];buttons.forEach(function(b){b.disabled=true});
  try{
    var canvas=await capture(),filename=(el("sheet-title").textContent||"layout-peta").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    if(kind==="png"){var a=document.createElement("a");a.download=filename+".png";a.href=canvas.toDataURL("image/png");a.click()}
    else{var size=el("paper-size").value,pdf=new window.jspdf.jsPDF({orientation:"landscape",unit:"mm",format:size}),w=pdf.internal.pageSize.getWidth(),h=pdf.internal.pageSize.getHeight();pdf.addImage(canvas.toDataURL("image/jpeg",.94),"JPEG",0,0,w,h);pdf.save(filename+".pdf")}
    status("Layout berhasil dibuat");toast((kind==="png"?"PNG":"PDF")+" berhasil diunduh");
  }catch(e){console.error(e);status("Ekspor gagal");toast("Ekspor gagal. Coba peta dasar tanpa citra atau gunakan cetak browser.")}
  finally{buttons.forEach(function(b){b.disabled=false})}
}
function customFile(file){
  if(!file)return;var reader=new FileReader();reader.onload=function(){
    try{var data=JSON.parse(reader.result),id="custom_"+(++customCount),name=el("custom-layer-name").value.trim()||file.name.replace(/\.[^.]+$/,""),colors=["#7b1fa2","#1565c0","#c62828","#2e7d32"],color=colors[(customCount-1)%colors.length];
      defs[id]={label:name,color:color,fill:color,source:"GeoJSON pengguna: "+file.name};var layer=geoLayer(id,data).addTo(map);active[id]=layer;legend();if(layer.getBounds&&layer.getBounds().isValid())map.fitBounds(layer.getBounds().pad(.08));toast("Layer "+name+" ditambahkan");
    }catch(e){toast("File GeoJSON tidak valid")}
  };reader.readAsText(file);
}
async function init(){
  if(!key){el("map-loading").textContent="Kunci desa tidak tersedia";status("Pilih desa dari WebGIS");return}
  try{
    if(source==="administrative"){
      var pair=await Promise.all([json("data/batas_administrasi_desa_riau.geojson?v=20260822-admin-layout1"),json(SNAPSHOT)]);
      snapshotData=pair[1];
      var boundaries=pair[0].features||[];
      villageFeature=boundaries.find(function(f){return fkey(f)===key});
    }else{
      snapshotData=await json(SNAPSHOT);
      var features=snapshotData.features||[];
      villageFeature=features.find(function(f){return lid(f)==="desa_intervensi"&&fkey(f)===key});
      if(!villageFeature){
        var n=norm(key.split("|")[0]);
        villageFeature=features.find(function(f){return lid(f)==="desa_intervensi"&&norm((f.properties||{}).WADMKD||(f.properties||{}).Desa)===n});
      }
    }
    if(!villageFeature||!villageFeature.geometry)throw new Error("Batas desa tidak ditemukan");
    initMap();
  }catch(e){console.error(e);el("map-loading").textContent="Batas desa gagal dimuat";status(e.message)}
}
el("basemap-select").addEventListener("change",function(){setBasemap(this.value)});
el("fit-village").addEventListener("click",function(){if(villageBounds)map.fitBounds(villageBounds.pad(.08))});
el("export-png").addEventListener("click",function(){download("png")});
el("export-pdf").addEventListener("click",function(){download("pdf")});
el("custom-geojson").addEventListener("change",function(){customFile(this.files&&this.files[0]);this.value=""});
el("created-date").textContent=new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
init();
})();