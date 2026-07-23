const LAYER_CONFIG=[{"id": "desa_intervensi", "label": "Batas Desa Intervensi", "color": "#2e7d32", "type": "polygon", "visible": true}, {"id": "apo", "label": "Alat Pemecah Ombak (APO)", "color": "#d32f2f", "type": "line", "visible": true}, {"id": "area_mangrove", "label": "Area Penanaman Mangrove", "color": "#00796b", "type": "polygon", "visible": true}, {"id": "titik_desa", "label": "Titik Desa Intervensi", "color": "#1565c0", "type": "point", "visible": false}, {"id": "kopi", "label": "Distribusi Lahan Kopi", "color": "#6d4c41", "type": "point", "visible": true}, {"id": "fdrs", "label": "Pembangunan FDRS", "color": "#e65100", "type": "point", "visible": true}, {"id": "sekat_kanal", "label": "Pembangunan Sekat Kanal", "color": "#00838f", "type": "point", "visible": true}, {"id": "nursery_mangrove", "label": "Rumah Pembibitan Mangrove", "color": "#8fa600", "type": "point", "visible": true}];
const DEFAULT_CENTER=[1.15,101.95];
const DEFAULT_ZOOM=8;

const map=L.map("map",{
  zoomControl:true,
  preferCanvas:true,
  minZoom:6
}).setView(DEFAULT_CENTER,DEFAULT_ZOOM);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  maxZoom:19,
  attribution:"&copy; OpenStreetMap contributors"
}).addTo(map);

L.control.scale({imperial:false,position:"bottomleft"}).addTo(map);

const layerObjects={};
const allBounds=L.latLngBounds([]);
const searchable=[];
let successfulLoads=0;
let failedLoads=0;

function escapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,ch=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[ch]);
}

function prettyKey(key){
  const names={
    NAMA_PROP:"Provinsi",NAMOBJ:"Nama Desa",WADMKD:"Desa",
    WADMKC:"Kecamatan",WADMKK:"Kabupaten",WADMPR:"Provinsi",
    NAMA_PROV:"Provinsi",NAMA_KAB:"Kabupaten",NAMA_KEC:"Kecamatan",
    NAMA_DESA:"Desa",Luas_Ha:"Luas (ha)",Panjang_M:"Panjang (m)",
    Ket:"Keterangan",Keterangan:"Keterangan",Tahun:"Tahun",
    Desa:"Desa",Kabupaten:"Kabupaten",Kecamatan:"Kecamatan"
  };
  return names[key]||key.replace(/_/g," ");
}

function hiddenField(key){
  return [
    "Id","No","OBJECTID","FID_1","KODE_DESA","KODE_KEC","KODE_KAB",
    "KODE_PROV","SRS_ID","iddesa","X","Y","UUPP","R105","DEFINITIF",
    "R305A1","R305B","R306A","R306B","R306C1A1","R306C1A2","R306C2",
    "Foto","Foto_2","REMARK"
  ].includes(key);
}

function popupHtml(feature,config){
  const props = feature.properties || {};
  const rows = Object.entries(props)
    .filter(([key, value]) => value !== null && value !== "" && typeof value !== "undefined" && !hiddenField(key))
    .map(([key, value]) => `
      <div class="popup-row">
        <b>${escapeHtml(prettyKey(key))}</b>
        <span>${escapeHtml(value)}</span>
      </div>`
    ).join("");

  return `<div class="popup-card">
      <div class="popup-head" style="background:${config.color}">
        <strong>${escapeHtml(config.label)}</strong>
        <span>Data spasial Yayasan Gambut</span>
      </div>
      <div class="popup-grid">${rows || '<div class="popup-row"><span>Informasi atribut belum tersedia.</span></div>'}</div>
    </div>`;
}

function updateLoadStatus(){
  const box=document.getElementById("load-status");
  const text=document.getElementById("load-status-text");
  const total=LAYER_CONFIG.length;

  if(successfulLoads+failedLoads<total){
    text.textContent=`Memuat ${successfulLoads+failedLoads} dari ${total} layer...`;
    return;
  }

  if(failedLoads===0){
    box.classList.add("ok");
    text.textContent=`Semua ${total} layer berhasil dimuat`;
  }else{
    box.classList.add("error");
    text.textContent=`${successfulLoads} layer berhasil, ${failedLoads} gagal`;
  }
}

async function loadLayer(config){
  try{
    const response=await fetch(`data/${config.id}.geojson`,{cache:"no-store"});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);

    const data=await response.json();
    let geoLayer;

    geoLayer=L.geoJSON(data,{
      style:()=>({
        color:config.color,
        fillColor:config.color,
        fillOpacity:config.type==="line"?.10:.24,
        weight:config.type==="line"?4:2.2,
        opacity:.95
      }),
      pointToLayer:(feature,latlng)=>L.circleMarker(latlng,{
        radius:7,
        fillColor:config.color,
        color:"#fff",
        weight:1.7,
        opacity:1,
        fillOpacity:.96
      }),
      onEachFeature:(feature,featureLayer)=>{
        featureLayer.bindPopup(popupHtml(feature,config),{maxWidth:330});
        featureLayer.on({
          mouseover:e=>{
            if(e.target.setStyle)e.target.setStyle({weight:4,fillOpacity:.38});
          },
          mouseout:e=>{
            if(geoLayer.resetStyle)geoLayer.resetStyle(e.target);
          }
        });

        const props=feature.properties||{};
        searchable.push({
          text:`${config.label} ${Object.values(props).join(" ")}`.toLowerCase(),
          layer:featureLayer,
          parent:geoLayer
        });
      }
    });

    layerObjects[config.id]=geoLayer;
    if(config.visible)geoLayer.addTo(map);

    const bounds=geoLayer.getBounds();
    if(bounds&&bounds.isValid())allBounds.extend(bounds);

    const checkbox=document.querySelector(`[data-layer-id="${config.id}"]`);
    checkbox?.addEventListener("change",()=>{
      if(checkbox.checked)geoLayer.addTo(map);
      else map.removeLayer(geoLayer);
    });

    successfulLoads++;
  }catch(error){
    console.error(`Gagal memuat layer ${config.id}`,error);
    failedLoads++;
    const checkbox=document.querySelector(`[data-layer-id="${config.id}"]`);
    if(checkbox){
      checkbox.disabled=true;
      checkbox.closest(".layer-item")?.setAttribute("title","Layer gagal dimuat");
    }
  }finally{
    updateLoadStatus();
  }
}

Promise.allSettled(LAYER_CONFIG.map(loadLayer)).then(()=>{
  if(allBounds.isValid())map.fitBounds(allBounds,{padding:[24,24]});
  window.setTimeout(()=>map.invalidateSize(),250);
});

function fitAll(){
  if(allBounds.isValid())map.fitBounds(allBounds,{padding:[24,24]});
  else map.setView(DEFAULT_CENTER,DEFAULT_ZOOM);
}

document.getElementById("fit-all").addEventListener("click",fitAll);
document.getElementById("reset-map").addEventListener("click",()=>map.setView(DEFAULT_CENTER,DEFAULT_ZOOM));

document.getElementById("locate-me").addEventListener("click",()=>{
  map.locate({setView:true,maxZoom:15,enableHighAccuracy:true});
});

map.on("locationfound",event=>{
  L.circleMarker(event.latlng,{
    radius:8,
    fillColor:"#7b1fa2",
    color:"#fff",
    weight:2,
    fillOpacity:1
  }).addTo(map).bindPopup("Lokasi Anda").openPopup();
});

map.on("locationerror",()=>{
  alert("Lokasi tidak dapat ditemukan. Pastikan izin lokasi browser telah diaktifkan.");
});

const searchInput=document.getElementById("search");

function doSearch(){
  const query=searchInput.value.trim().toLowerCase();
  if(query.length<2)return;

  const result=searchable.find(item=>item.text.includes(query));
  if(!result){
    searchInput.style.borderColor="#c62828";
    searchInput.setAttribute("title","Lokasi tidak ditemukan");
    return;
  }

  searchInput.style.borderColor="#079cde";
  searchInput.removeAttribute("title");

  if(!map.hasLayer(result.parent))result.parent.addTo(map);

  if(result.layer.getLatLng){
    map.setView(result.layer.getLatLng(),15);
  }else if(result.layer.getBounds){
    const bounds=result.layer.getBounds();
    if(bounds&&bounds.isValid())map.fitBounds(bounds,{padding:[35,35],maxZoom:15});
  }

  result.layer.openPopup();

  if(window.innerWidth<=760)closeMobileSidebar();
}

document.getElementById("search-button").addEventListener("click",doSearch);
searchInput.addEventListener("keydown",event=>{
  if(event.key==="Enter")doSearch();
});

const shell=document.getElementById("webgis-shell");
const sidebar=document.getElementById("sidebar");
const overlay=document.getElementById("sidebar-overlay");

function openMobileSidebar(){
  sidebar.classList.add("open");
  overlay.classList.add("open");
}

function closeMobileSidebar(){
  sidebar.classList.remove("open");
  overlay.classList.remove("open");
}

document.getElementById("mobile-toggle").addEventListener("click",openMobileSidebar);
overlay.addEventListener("click",closeMobileSidebar);

document.getElementById("toggle-sidebar").addEventListener("click",()=>{
  if(window.innerWidth<=760){
    sidebar.classList.contains("open")?closeMobileSidebar():openMobileSidebar();
  }else{
    shell.classList.toggle("sidebar-collapsed");
    window.setTimeout(()=>map.invalidateSize(),270);
  }
});

document.getElementById("fullscreen-map").addEventListener("click",async()=>{
  const target=document.querySelector(".map-wrap");
  try{
    if(!document.fullscreenElement){
      await target.requestFullscreen();
    }else{
      await document.exitFullscreen();
    }
    window.setTimeout(()=>map.invalidateSize(),250);
  }catch(error){
    console.warn("Fullscreen tidak tersedia",error);
  }
});

window.addEventListener("resize",()=>{
  window.clearTimeout(window.__ygResizeTimer);
  window.__ygResizeTimer=window.setTimeout(()=>map.invalidateSize(),220);
});
