(function(){
"use strict";
  const fetch = window.YG_STAFF_DATA ? window.YG_STAFF_DATA.fetch : window.fetch.bind(window);
  const staffSession = window.YG_STAFF_DATA ? window.YG_STAFF_DATA.session() : null;
var SNAPSHOT="https://webgis-api.yayasangambut.org/snapshots/current/objects.json";
var params=new URLSearchParams(location.search);
var key=String(params.get("key")||"").trim().toLowerCase();
var source=String(params.get("source")||"intervention").trim().toLowerCase();
var map,localInset,riauInset,villageFeature,villageBounds,snapshotData,baseLayer;
if(!window.L){el("map-loading").textContent="Pustaka peta belum termuat. Klik Coba lagi.";status("Peta belum siap");el("retry-layout").hidden=false;el("retry-layout").addEventListener("click",function(){location.reload()});return}
var RIAU_FRAME=L.latLngBounds([[-1.25,99.85],[2.85,104.25]]);
var active={},customCount=0,ready=false,loading=false,dataNotice="",programAvailable=true;
var defs={
  ...(staffSession ? {concession:{label:"PBPH · internal staf",color:"#d84315",fill:"rgba(216,67,21,.11)",url:"data/PBPH_RIAU_052026.geojson",source:"Referensi internal PBPH"}} : {}),
  village:{label:"Batas desa",color:"#d7df00",fill:"rgba(215,223,0,.04)",locked:true,source:"Master Database Yayasan Gambut"},
  forest:{label:"Kawasan hutan",color:"#33691e",fill:"rgba(76,175,80,.30)",url:"data/kawasan_hutan_sk_903.geojson",source:"Kawasan Hutan SK 903"},
  social:{label:"Perhutanan sosial",color:"#00897b",fill:"rgba(0,137,123,.25)",url:"data/PERHUTANAN_SOSIAL_RIAU.geojson",supplements:["data/social-forestry-pkk-samj.geojson","data/social-forestry-kud-agro-lestari.geojson","data/social-forestry-derived-2025.geojson","data/social-forestry-official-2026.geojson"],source:"Perhutanan Sosial Riau"},
  peat:{label:"Sebaran gambut",color:"#6a1b9a",fill:"rgba(106,27,154,.22)",url:"data/Gambut_BBSDLP_2019.geojson",source:"Peta Gambut BBSDLP 2019"},
  area_mangrove:{label:"Area penanaman mangrove",color:"#00796b",fill:"rgba(0,121,107,.34)",program:true,source:"Master Database Yayasan Gambut"},
  apo:{label:"Alat pemecah ombak",color:"#d32f2f",fill:"rgba(211,47,47,.18)",program:true,line:true,source:"Master Database Yayasan Gambut"},
  sekat_kanal:{label:"Sekat kanal",color:"#00838f",fill:"#00838f",program:true,point:true,source:"Master Database Yayasan Gambut"},
  fdrs:{label:"FDRS / Water Table",color:"#e65100",fill:"#e65100",program:true,point:true,source:"Master Database Yayasan Gambut"},
  nursery_mangrove:{label:"Rumah pembibitan mangrove",color:"#8fa600",fill:"#8fa600",program:true,point:true,source:"Master Database Yayasan Gambut"},
  monitoring_reports:{label:"Monitoring terverifikasi",color:"#f9a825",fill:"#f9a825",program:true,point:true,source:"Master Database Yayasan Gambut"}
};
var order=[...(staffSession?["concession"]:[]),"village","forest","social","peat","area_mangrove","apo","sekat_kanal","fdrs","nursery_mangrove","monitoring_reports"];
function el(id){return document.getElementById(id)}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function norm(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function lid(f){var p=f&&f.properties||{};return String(p.Layer_ID||p.Source_Layer||"").toLowerCase()}
function fkey(f){var p=f&&f.properties||{};return[p.WADMKD||p.Desa||p.NAMOBJ||p.Nama_Desa,p.WADMKC||p.Kecamatan,p.WADMKK||p.Kabupaten].filter(Boolean).join("|").trim().toLowerCase()}
function nameOf(f){var p=f&&f.properties||{};return p.Nama_Objek||p.title||p.WADMKD||p.Desa||p.NAMOBJ||""}
function toast(t){var n=el("toast");n.textContent=t;n.classList.add("show");setTimeout(function(){n.classList.remove("show")},2200)}
async function json(url){
  var controller=new AbortController(),timeout=setTimeout(function(){controller.abort()},15000);
  try{var r=await fetch(url,{cache:"no-store",signal:controller.signal});if(!r.ok)throw new Error("HTTP "+r.status);return await r.json()}
  finally{clearTimeout(timeout)}
}
function collection(data){if(!data||!Array.isArray(data.features))throw new Error("Format data peta tidak valid");return data}
async function loadSnapshot(){
  try{return collection(await json(SNAPSHOT))}
  catch(error){
    var cached=collection(await json("data/master-database-snapshot.json"));
    dataNotice=" · menggunakan cadangan data situs";return cached;
  }
}
function setReady(value){
  ready=value;["fit-village","export-png","export-pdf","basemap-select","custom-geojson"].forEach(function(id){el(id).disabled=!value});
}
function findVillage(features){
  var match=features.find(function(f){return fkey(f)===key});if(match)return match;
  var parts=key.split("|").map(norm),matches=features.filter(function(f){var actual=fkey(f).split("|").map(norm);return parts.length===actual.length&&parts.every(function(value,i){return value===actual[i]})});
  return matches.length===1?matches[0]:null;
}
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
  return{color:color,weight:id==="village"?4:1.4,opacity:1,fillColor:fill,fillOpacity:id==="village"?.04:(id==="concession"?.10:.32),dashArray:id==="village"?"8 4":null};
}
function pointFor(id,feature,latlng){var d=defs[id];return L.circleMarker(latlng,{radius:6,color:"#fff",weight:2,fillColor:d.color,fillOpacity:1})}
function labelLayer(layer,feature,id){
  var text=id==="village"?(feature.properties.WADMKD||feature.properties.Desa):nameOf(feature);
  if(text&&id!=="forest"&&id!=="peat")layer.bindTooltip(String(text),{permanent:id==="village",direction:"center",className:"ml-label"});
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
    else rows.push([d.label,d.color,d.fill,d.point,d.line]);
  });
  el("layout-legend").innerHTML=rows.map(function(r){var symbolClass=r[3]?" point":r[4]?" line":"";return'<div class="legend-row"><i class="legend-symbol'+symbolClass+'" style="--stroke:'+r[1]+';--fill:'+r[2]+'"></i><span>'+esc(r[0])+'</span></div>'}).join("");
  sourceEntries();
}
async function addLayer(id){
  if(active[id])return;var d=defs[id],data;
  setToggleLoading(id,true);
  try{
    if(id==="village")data=villageFeature;
    else if(d.program)data={type:"FeatureCollection",features:(snapshotData.features||[]).filter(function(f){return lid(f)===id&&intersects(f,villageBounds.pad(.35))})};
    else{
      data=await json(d.url);
      if(Array.isArray(d.supplements)&&d.supplements.length){
        var additions=await Promise.all(d.supplements.map(function(url){return json(url).catch(function(){return{features:[]}})}));
        additions.forEach(function(collection){data.features=(data.features||[]).concat(collection.features||[])});
      }
      data={type:"FeatureCollection",features:(data.features||[]).filter(function(f){return intersects(f,villageBounds.pad(.25))})};
    }
    var layer=geoLayer(id,data).addTo(map);active[id]=layer;if(id==="village")layer.bringToFront();legend();status(d.label+" aktif");
  }catch(e){console.error(e);toast("Layer "+d.label+" gagal dimuat");var box=document.querySelector('[data-layer="'+id+'"] input');if(box)box.checked=false}
  finally{setToggleLoading(id,false)}
}
function removeLayer(id){if(!active[id]||defs[id].locked)return;map.removeLayer(active[id]);delete active[id];legend()}
function setToggleLoading(id,on){var row=document.querySelector('[data-layer="'+id+'"]');if(row)row.classList.toggle("is-loading",on)}
function status(t){el("layout-status").textContent=t}
function controls(){
  el("layer-options").innerHTML=order.map(function(id){var d=defs[id];return'<label class="ml-layer-toggle" data-layer="'+id+'" style="--swatch:'+d.color+';--fill:'+d.fill+'"><input type="checkbox" '+(id==="village"?"checked disabled":(d.program&&!programAvailable?"disabled":""))+'><i></i><span>'+esc(d.label)+'</span></label>'}).join("");
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
  tile("road").addTo(localInset);var vl=geoLayer("village",villageFeature).addTo(localInset);vl.eachLayer(function(layer){if(layer.unbindTooltip){layer.unbindTooltip()}});localInset.fitBounds(vl.getBounds().pad(.6));
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
  controls();legend();titleSetup();initInsets();grid();el("map-loading").hidden=true;setReady(true);status("Layout siap"+dataNotice);setTimeout(function(){map.invalidateSize();localInset.invalidateSize();fitRiauInset();map.fitBounds(villageBounds.pad(.08));grid()},100);
}
async function waitForTiles(){
  var deadline=Date.now()+10000;
  while(true){
    var pending=false;[map,localInset,riauInset].forEach(function(value){value.eachLayer(function(layer){if(layer.isLoading&&layer.isLoading())pending=true})});
    if(!pending)return;
    if(Date.now()>deadline)throw new Error("Peta dasar belum selesai dimuat. Tunggu lalu coba kembali, atau pilih Tanpa peta dasar.");
    await new Promise(function(resolve){setTimeout(resolve,100)});
  }
}
function saveBlob(blob,filename){
  var url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},60000);
}
async function capture(){
  status("Menyiapkan gambar resolusi tinggi…");map.invalidateSize();localInset.invalidateSize();fitRiauInset();await new Promise(function(r){setTimeout(r,100)});await waitForTiles();
  return html2canvas(el("map-sheet"),{scale:2,useCORS:true,allowTaint:false,backgroundColor:"#ffffff",logging:false});
}
async function download(kind){
  if(!ready){toast("Tunggu sampai peta siap sebelum mengunduh");return}
  var buttons=[el("export-png"),el("export-pdf")];buttons.forEach(function(b){b.disabled=true});
  try{
    var canvas=await capture(),filename=(el("sheet-title").textContent||"layout-peta").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    if(kind==="png"){
      var blob=await new Promise(function(resolve,reject){canvas.toBlob(function(value){value?resolve(value):reject(new Error("PNG tidak dapat dibuat"))},"image/png")});
      saveBlob(blob,filename+".png");
    }
    else{var size=el("paper-size").value,pdf=new window.jspdf.jsPDF({orientation:"landscape",unit:"mm",format:size}),w=pdf.internal.pageSize.getWidth(),h=pdf.internal.pageSize.getHeight();pdf.addImage(canvas.toDataURL("image/jpeg",.94),"JPEG",0,0,w,h);pdf.save(filename+".pdf")}
    status("Layout berhasil dibuat");toast((kind==="png"?"PNG":"PDF")+" berhasil diunduh");
  }catch(e){console.error(e);status("Ekspor gagal");toast(e.message||"Ekspor gagal. Coba peta dasar tanpa citra atau gunakan cetak browser.")}
  finally{buttons.forEach(function(b){b.disabled=!ready})}
}
function customFile(file){
  if(!file)return;var reader=new FileReader();reader.onload=function(){
    try{var data=JSON.parse(reader.result),id="custom_"+(++customCount),name=el("custom-layer-name").value.trim()||file.name.replace(/\.[^.]+$/,""),colors=["#7b1fa2","#1565c0","#c62828","#2e7d32"],color=colors[(customCount-1)%colors.length];
      defs[id]={label:name,color:color,fill:color,source:"GeoJSON pengguna: "+file.name};var layer=geoLayer(id,data).addTo(map);active[id]=layer;legend();if(layer.getBounds&&layer.getBounds().isValid())map.fitBounds(layer.getBounds().pad(.08));toast("Layer "+name+" ditambahkan");
    }catch(e){toast("File GeoJSON tidak valid")}
  };reader.readAsText(file);
}
async function init(){
  if(loading||ready)return;loading=true;setReady(false);dataNotice="";programAvailable=true;
  el("retry-layout").hidden=true;el("map-loading").hidden=false;el("map-loading").textContent="Memuat batas desa…";status("Memuat data desa…");
  try{
    if(!key)throw new Error("Kunci desa tidak tersedia. Buka layout dari profil desa.");
    try{snapshotData=await loadSnapshot()}
    catch(error){snapshotData={type:"FeatureCollection",features:[]};programAvailable=false;dataNotice=" · data kegiatan belum tersedia";}
    if(source==="administrative"){
      var boundaries=collection(await json("data/batas_administrasi_desa_riau.geojson?v=20260822-admin-layout1"));
      villageFeature=findVillage(boundaries.features);
    }else{
      villageFeature=findVillage(snapshotData.features.filter(function(f){return lid(f)==="desa_intervensi"}));
      if(!villageFeature){
        var fallback=collection(await json("data/desa_intervensi.geojson"));
        villageFeature=findVillage(fallback.features);
      }
    }
    if(!villageFeature||!villageFeature.geometry||!["Polygon","MultiPolygon"].includes(villageFeature.geometry.type))throw new Error("Batas desa yang dipilih tidak ditemukan");
    var bounds=L.geoJSON(villageFeature).getBounds();if(!bounds.isValid())throw new Error("Geometri batas desa tidak valid");
    initMap();
  }catch(e){
    console.error(e);setReady(false);
    [map,localInset,riauInset].forEach(function(value){if(value)value.remove()});map=localInset=riauInset=null;active={};
    el("map-loading").hidden=false;el("map-loading").textContent="Peta belum dapat dimuat. Klik Coba lagi.";
    status(e.name==="AbortError"?"Koneksi data melewati batas waktu":e.message);el("retry-layout").hidden=false;
  }finally{loading=false}
}
el("retry-layout").addEventListener("click",init);
el("basemap-select").addEventListener("change",function(){setBasemap(this.value)});
el("fit-village").addEventListener("click",function(){if(villageBounds)map.fitBounds(villageBounds.pad(.08))});
el("export-png").addEventListener("click",function(){download("png")});
el("export-pdf").addEventListener("click",function(){download("pdf")});
el("custom-geojson").addEventListener("change",function(){customFile(this.files&&this.files[0]);this.value=""});
el("created-date").textContent=new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
init();
})();

