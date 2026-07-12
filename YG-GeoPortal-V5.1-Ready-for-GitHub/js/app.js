const LAYER_CONFIG=[{"id": "desa_intervensi", "label": "Batas Desa Intervensi", "color": "#2e7d32", "type": "polygon", "visible": true}, {"id": "apo", "label": "Alat Pemecah Ombak (APO)", "color": "#d32f2f", "type": "line", "visible": true}, {"id": "area_mangrove", "label": "Area Penanaman Mangrove", "color": "#00796b", "type": "polygon", "visible": true}, {"id": "titik_desa", "label": "Titik Desa Intervensi", "color": "#1565c0", "type": "point", "visible": false}, {"id": "kopi", "label": "Distribusi Lahan Kopi", "color": "#6d4c41", "type": "point", "visible": true}, {"id": "fdrs", "label": "Pembangunan FDRS", "color": "#e65100", "type": "point", "visible": true}, {"id": "sekat_kanal", "label": "Pembangunan Sekat Kanal", "color": "#00838f", "type": "point", "visible": true}, {"id": "nursery_mangrove", "label": "Rumah Pembibitan Mangrove", "color": "#8fa600", "type": "point", "visible": true}];
const map=L.map("map",{zoomControl:true,preferCanvas:true}).setView([1.15,101.95],8);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(map);

const layerObjects={},allBounds=L.latLngBounds([]),searchable=[];

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);}
function pretty(k){const m={NAMOBJ:"Nama Desa",WADMKD:"Desa",WADMKC:"Kecamatan",WADMKK:"Kabupaten",WADMPR:"Provinsi",Luas_Ha:"Luas (ha)",Panjang_M:"Panjang (m)",Ket:"Keterangan",Keterangan:"Keterangan",Tahun:"Tahun"};return m[k]||k.replace(/_/g," ");}
function hidden(k){return ["Id","No","OBJECTID","FID_1","KODE_DESA","KODE_KEC","KODE_KAB","KODE_PROV","SRS_ID","iddesa","X","Y","UUPP","REMARK"].includes(k);}
function popup(feature,config){const p=feature.properties||{};let h=`<div class="popup"><h3>${esc(config.label)}</h3>`;Object.keys(p).forEach(k=>{const v=p[k];if(v===null||v===""||hidden(k))return;h+=`<div class="popup-row"><b>${esc(pretty(k))}:</b> ${esc(v)}</div>`;});return h+"</div>";}

async function loadLayer(c){
  const r=await fetch(`data/${c.id}.geojson`);
  if(!r.ok)throw new Error(`Gagal memuat ${c.id}`);
  const data=await r.json();
  let g;
  g=L.geoJSON(data,{
    style:()=>({color:c.color,fillColor:c.color,fillOpacity:c.type==="line"?.12:.25,weight:c.type==="line"?4:2.2}),
    pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:7,fillColor:c.color,color:"#fff",weight:1.5,fillOpacity:.95}),
    onEachFeature:(f,l)=>{
      l.bindPopup(popup(f,c),{maxWidth:320});
      searchable.push({text:`${c.label} ${Object.values(f.properties||{}).join(" ")}`.toLowerCase(),layer:l,parent:g});
    }
  });
  layerObjects[c.id]=g;
  if(c.visible)g.addTo(map);
  const b=g.getBounds();if(b&&b.isValid())allBounds.extend(b);
  const cb=document.querySelector(`[data-layer-id="${c.id}"]`);
  cb?.addEventListener("change",()=>cb.checked?g.addTo(map):map.removeLayer(g));
}

Promise.allSettled(LAYER_CONFIG.map(loadLayer)).then(()=>{
  if(allBounds.isValid())map.fitBounds(allBounds,{padding:[20,20]});
  setTimeout(()=>map.invalidateSize(),250);
});

document.getElementById("fit-all").addEventListener("click",()=>allBounds.isValid()&&map.fitBounds(allBounds,{padding:[20,20]}));
document.getElementById("locate-me").addEventListener("click",()=>map.locate({setView:true,maxZoom:15,enableHighAccuracy:true}));
map.on("locationfound",e=>L.circleMarker(e.latlng,{radius:8,fillColor:"#7b1fa2",color:"#fff",weight:2,fillOpacity:1}).addTo(map).bindPopup("Lokasi Anda").openPopup());
map.on("locationerror",()=>alert("Lokasi tidak dapat ditemukan. Pastikan izin lokasi browser aktif."));

const search=document.getElementById("search");
function doSearch(){
  const q=search.value.trim().toLowerCase();if(q.length<2)return;
  const r=searchable.find(i=>i.text.includes(q));
  if(!r){search.style.borderColor="#c62828";return;}
  search.style.borderColor="#079cde";
  if(!map.hasLayer(r.parent))r.parent.addTo(map);
  if(r.layer.getLatLng)map.setView(r.layer.getLatLng(),15);
  else{const b=r.layer.getBounds();if(b?.isValid())map.fitBounds(b,{padding:[30,30],maxZoom:15});}
  r.layer.openPopup();
}
document.getElementById("search-button").addEventListener("click",doSearch);
search.addEventListener("keydown",e=>e.key==="Enter"&&doSearch());
document.getElementById("mobile-toggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
window.addEventListener("resize",()=>setTimeout(()=>map.invalidateSize(),200));
