(function(){
  "use strict";
  var STORAGE="ygFloodBagansiapiapiSurveyV1", map, pointLayer, pending=null;
  var steps=[
    ["1 · Petakan sistem","Delineasi sub-tangkapan, saluran primer–sekunder, gorong-gorong, outlet, cekungan, dan badan penerima."],
    ["2 · Pulihkan koneksi","Hilangkan titik putus dan sumbatan; samakan invert; perbaiki gorong-gorong sebelum memperbesar ruas hulu."],
    ["3 · Pulihkan tampungan","Lindungi rawa/cekungan, siapkan kolam retensi, dan hentikan penimbunan koridor air."],
    ["4 · Kendalikan backflow","Pintu hanya dipilih bila pengukuran membuktikan aliran balik saat pasang atau muka sungai tinggi."],
    ["5 · Pompa bila terbukti","Pompa digunakan bila neraca volume menunjukkan retensi dan gravitasi tidak mencapai target waktu surut."]
  ];
  var decisions=[
    ["Saluran terputus atau dangkal","Rehabilitasi jaringan","Belum perlu pintu. Buktikan jalur kontinu sampai badan penerima."],
    ["Backflow pada outlet kecil","Flap gate modular","Sediakan stoplog, trash rack, apron, akses pembersihan, dan perlindungan korosi."],
    ["Backflow pada outlet primer","Pintu sorong dua sel","Satu sel tetap bekerja saat sel lain diisolasi; operasi manual darurat wajib tersedia."],
    ["Outlet tertutup lama saat hujan","Retensi/polder + pompa","Hitung hidrograf dan durasi pasang; gunakan pompa redundan dan listrik cadangan."],
    ["Tidak ada bukti backflow","Tanpa pintu","Perbaiki saluran, tampungan, sempadan, dan pengendalian limpasan tapak."],
    ["Arah aliran belum diketahui","Investigasi","Tracer, survei invert, AWLR dua sisi, pasut, penampang, dan inventaris aset."]
  ];
  var evidence=[
    ["Topografi","Benchmark, RTK/GNSS, elevasi jalan, rumah, tanggul, dan invert setiap perubahan penampang."],
    ["Hujan–pasang–muka air","Seri waktu serentak untuk memisahkan hujan, rob, luapan sungai, dan kejadian gabungan."],
    ["Jaringan lengkap","Saluran terbuka/tertutup, gorong-gorong, pintu lama, pompa, sambungan, dan badan penerima."],
    ["Hidraulik","Penampang, kekasaran, debit/kecepatan, sedimentasi, kehilangan energi, dan kondisi terendam."],
    ["Geoteknik–struktur","Bor/sondir, daya dukung, settlement, uplift, piping, gerusan, dan stabilitas tebing."],
    ["Operasi aset","Akses alat, sampah, sumber listrik, operator, stoplog, suku cadang, dan biaya siklus hidup."]
  ];
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]})}
  function loadPoints(){try{return JSON.parse(localStorage.getItem(STORAGE)||"[]")}catch(e){return[]}}
  function savePoints(rows){localStorage.setItem(STORAGE,JSON.stringify(rows))}
  function statusLabel(v){return {candidate:"Kandidat survei",checked:"Survei awal lengkap",verified:"Terverifikasi teknis",rejected:"Ditolak / bukan outlet"}[v]||v}
  function color(v){return {candidate:"#e39a16",checked:"#247ca1",verified:"#16845d",rejected:"#8b8f8d"}[v]||"#e39a16"}
  function renderStatic(){
    document.getElementById("flood-action-sequence").innerHTML=steps.map(function(x){return "<article><b>"+esc(x[0])+"</b><p>"+esc(x[1])+"</p></article>"}).join("");
    document.getElementById("flood-decision-matrix").innerHTML=decisions.map(function(x){return "<article><h3>"+esc(x[0])+"</h3><p><strong>Keputusan: "+esc(x[1])+"</strong></p><p>"+esc(x[2])+"</p></article>"}).join("");
    document.getElementById("flood-evidence-checklist").innerHTML=evidence.map(function(x){return "<article><b>"+esc(x[0])+"</b><p>"+esc(x[1])+"</p></article>"}).join("");
  }
  function popup(row){return "<b>"+esc(row.id)+" · "+esc(row.name)+"</b><br>Status: "+esc(statusLabel(row.status))+"<br>Jenis: "+esc(row.type)+"<br><small>"+esc(row.lat.toFixed(6))+", "+esc(row.lng.toFixed(6))+"</small>"}
  function renderPoints(){
    var rows=loadPoints(), body=document.querySelector("#flood-register tbody"), table=document.getElementById("flood-register"), empty=document.getElementById("flood-register-empty");
    body.innerHTML=rows.map(function(r,i){return "<tr><td><b>"+esc(r.id)+"</b><br>"+esc(r.name)+"</td><td>"+r.lat.toFixed(6)+"<br>"+r.lng.toFixed(6)+"</td><td><span class='status-pill'>"+esc(statusLabel(r.status))+"</span><br>"+esc(r.type)+"</td><td>"+esc(r.evidence||"Belum ada")+"</td><td>"+esc(r.decision||"Audit dan survei")+"</td><td><button class='table-action' data-remove='"+i+"'>Hapus</button></td></tr>"}).join("");
    table.hidden=!rows.length;empty.hidden=!!rows.length;document.getElementById("flood-point-count").textContent=rows.length;document.getElementById("flood-verified-count").textContent=rows.filter(function(r){return r.status==="verified"}).length;
    if(pointLayer){pointLayer.clearLayers();rows.forEach(function(r){L.circleMarker([r.lat,r.lng],{radius:9,color:"#fff",weight:2,fillColor:color(r.status),fillOpacity:1}).bindPopup(popup(r)).addTo(pointLayer)})}
    body.querySelectorAll("[data-remove]").forEach(function(b){b.onclick=function(){var a=loadPoints();a.splice(Number(b.dataset.remove),1);savePoints(a);renderPoints()}})
  }
  function initMap(data){
    map=L.map("flood-map",{preferCanvas:true}).setView([2.155,100.82],12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(map);
    var mapData=data.map||{}, study=L.geoJSON(mapData.studyArea||{type:"FeatureCollection",features:[]},{style:{color:"#315b50",weight:2,dashArray:"7 5",fillOpacity:.03},onEachFeature:function(f,l){l.bindTooltip((f.properties||{}).WADMKD||(f.properties||{}).NAMOBJ||"Wilayah kajian")}}).addTo(map);
    var hydro=L.geoJSON(mapData.ygHydrologyEvidence||{type:"FeatureCollection",features:[]},{renderer:L.canvas(),style:function(f){var k=String((f.properties||{}).waterway||"");return{color:k==="river"?"#075d86":"#2d98bd",weight:k==="river"?3:1.4,opacity:.85}},onEachFeature:function(f,l){var p=f.properties||{};l.bindPopup("<b>Alur referensi OSM</b><br>"+esc(p.name||"Tanpa nama")+"<br>Jenis: "+esc(p.waterway||p.water||"belum diklasifikasi")+"<br><small>Belum menunjukkan arah, elevasi, atau kapasitas.</small>")}});
    document.getElementById("flood-waterway-count").textContent=((mapData.ygHydrologyEvidence||{}).features||[]).length;
    var spatialDecision=L.layerGroup().addTo(map);
    function decisionMarker(latlng,label,color,html){
      L.circleMarker(latlng,{radius:10,color:"#fff",weight:3,fillColor:color,fillOpacity:1}).bindTooltip(label,{permanent:true,direction:"right",className:"flood-decision-label"}).bindPopup(html).addTo(spatialDecision);
    }
    decisionMarker([2.1352818,100.7864141],"K-01 · kandidat sekat outlet", "#c84630", "<b>K-01 · Outlet barat-daya</b><br>Sekat pada penampang stabil terakhir sebelum perairan pasang.<br><b>Buang:</b> ke estuari sisi barat saat muka air luar lebih rendah.<br><small>Kandidat survei; bukan koordinat konstruksi.</small>");
    L.polyline([[2.1352818,100.7864141],[2.1336,100.7816],[2.1328,100.7778]],{color:"#087ca7",weight:5,dashArray:"10 7"}).bindTooltip("ARAH BUANG K-01 → estuari",{permanent:true,direction:"bottom",className:"flood-flow-label"}).addTo(spatialDecision);
    decisionMarker([2.1089820,100.8007140],"K-02 · cari outlet sebenarnya", "#df8b13", "<b>K-02 · Koridor outlet selatan</b><br>Koordinat ini hanya ujung alur OSM. Telusuri sampai badan penerima; pintu ditempatkan pada outlet sebenarnya.<br><b>Buang:</b> ke badan penerima selatan/Sungai Rokan setelah koneksi terbukti.");
    L.polyline([[2.1089820,100.8007140],[2.1062,100.7973],[2.1037,100.7934]],{color:"#df8b13",weight:4,dashArray:"7 7"}).bindTooltip("KORIDOR TELUSUR K-02 → badan penerima",{permanent:true,direction:"bottom",className:"flood-flow-label"}).addTo(spatialDecision);
    decisionMarker([2.1730194,100.8084177],"X · jangan sekat di sini", "#777", "<b>Bukan lokasi pintu.</b><br>Ujung kanal yang belum terbukti sebagai outlet. Pertahankan aliran dan telusuri koneksi hilirnya.");
    var groups={"Batas wilayah kajian":study,"Rekomendasi sekat & arah buang":spatialDecision,"Alur air referensi OSM":hydro};
    var b=study.getBounds();if(b.isValid()){
      var url="https://gis.bnpb.go.id/server/rest/services/inarisk/layer_bahaya_banjir_30_sumatera/MapServer/export?bbox="+[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()].join(",")+"&bboxSR=4326&imageSR=4326&size=1200,1200&transparent=true&format=png32&f=image";
      groups["InaRISK BNPB (penyaringan)"]=L.imageOverlay(url,[[b.getSouth(),b.getWest()],[b.getNorth(),b.getEast()]],{opacity:.58,attribution:"InaRISK BNPB"});map.fitBounds(b.pad(.03));
    }
    pointLayer=L.layerGroup().addTo(map);groups["Titik survei internal"]=pointLayer;L.control.layers(null,groups,{collapsed:false}).addTo(map);
    setTimeout(function(){map.invalidateSize()},100);document.getElementById("flood-map-status").textContent="Siap · layer referensi dimatikan secara default";
    map.on("click",function(e){if(!pending)return;pending=null;document.getElementById("flood-add-point").hidden=false;document.getElementById("flood-cancel-point").hidden=true;openDialog(e.latlng)});
  }
  function openDialog(ll){var d=document.getElementById("flood-point-dialog"),rows=loadPoints();document.getElementById("point-id").value="OUT-"+String(rows.length+1).padStart(3,"0");document.getElementById("point-name").value="";document.getElementById("point-status").value="candidate";document.getElementById("point-evidence").value="";document.getElementById("point-decision").value="Audit konektivitas; belum boleh didesain";document.getElementById("point-lat").value=ll.lat;document.getElementById("point-lng").value=ll.lng;document.getElementById("point-coordinate").textContent="Koordinat: "+ll.lat.toFixed(6)+", "+ll.lng.toFixed(6);d.showModal()}
  function exportFile(content,name,type){var a=document.createElement("a"),u=URL.createObjectURL(new Blob([content],{type:type}));a.href=u;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(u)},0)}
  function bind(){
    document.getElementById("flood-add-point").onclick=function(){pending=true;this.hidden=true;document.getElementById("flood-cancel-point").hidden=false;document.getElementById("flood-map-status").textContent="Klik lokasi hasil survei pada peta"};
    document.getElementById("flood-cancel-point").onclick=function(){pending=null;this.hidden=true;document.getElementById("flood-add-point").hidden=false;document.getElementById("flood-map-status").textContent="Penambahan titik dibatalkan"};
    document.getElementById("flood-point-form").addEventListener("submit",function(e){if(e.submitter&&e.submitter.value==="cancel")return;e.preventDefault();var rows=loadPoints();rows.push({id:document.getElementById("point-id").value.trim(),name:document.getElementById("point-name").value.trim(),status:document.getElementById("point-status").value,type:document.getElementById("point-type").value,evidence:document.getElementById("point-evidence").value.trim(),decision:document.getElementById("point-decision").value.trim(),lat:Number(document.getElementById("point-lat").value),lng:Number(document.getElementById("point-lng").value),createdAt:new Date().toISOString()});savePoints(rows);document.getElementById("flood-point-dialog").close();renderPoints()});
    document.getElementById("flood-clear-points").onclick=function(){if(confirm("Hapus seluruh titik survei yang tersimpan di perangkat ini?")){savePoints([]);renderPoints()}};
    document.getElementById("flood-export-points").onclick=function(){var features=loadPoints().map(function(r){return{type:"Feature",properties:Object.assign({},r,{lat:undefined,lng:undefined}),geometry:{type:"Point",coordinates:[r.lng,r.lat]}}});exportFile(JSON.stringify({type:"FeatureCollection",name:"Register survei outlet Bagansiapiapi",metadata:{access:"staff_only",status:"field_screening_not_design",exportedAt:new Date().toISOString()},features:features},null,2),"register-survei-outlet-bagansiapiapi.geojson","application/geo+json")};
    document.getElementById("flood-export-matrix").onclick=function(){var rows=[["Kondisi","Keputusan","Catatan"]].concat(decisions);exportFile("\ufeff"+rows.map(function(r){return r.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"'}).join(",")}).join("\n"),"matriks-keputusan-teknis-banjir-bagansiapiapi.csv","text/csv")};
  }
  function init(bootstrap){if(!bootstrap||!bootstrap.analysis)return;renderStatic();initMap(bootstrap.analysis);renderPoints();bind()}
  if(window.YG_RDTR_BOOTSTRAP)init(window.YG_RDTR_BOOTSTRAP);else document.addEventListener("yg:rdtr-authorized",function(){init(window.YG_RDTR_BOOTSTRAP)},{once:true});
})();
