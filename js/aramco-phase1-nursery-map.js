(function () {
  "use strict";
  var OBJECT_ID = "YG-NURSERY-MANGROVE-MRW2JG4D";
  var SNAPSHOT = "https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev/snapshots/current/objects.json";
  var REPORT = "https://drive.google.com/file/d/1urwXsg64a4ttgihusCFZzTiKmGYyyqWB/view?usp=drivesdk";
  var map = L.map("phase1-map");
  var satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles © Esri" }).addTo(map);
  var streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
  L.control.layers({ "Citra satelit": satellite, "Peta jalan": streets }, null, { collapsed: false }).addTo(map);
  fetch(SNAPSHOT, { cache: "no-store" })
    .then(function (response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
    .then(function (data) {
      var feature = (data.features || []).find(function (row) { return String((row.properties || {}).Object_ID || "") === OBJECT_ID; });
      if (!feature || !feature.geometry || feature.geometry.type !== "Point") throw new Error("Titik Fase I tidak ditemukan");
      var p = feature.properties || {}, c = feature.geometry.coordinates;
      var marker = L.circleMarker([c[1], c[0]], { radius: 11, color: "#fff", weight: 3, fillColor: "#8fa600", fillOpacity: 1 }).addTo(map);
      marker.bindPopup('<div class="phase-map-popup"><h3>Rumah Bibit Mangrove · Fase 1</h3><dl><dt>Desa</dt><dd>' + (p.Desa || 'Buruk Bakul') + '</dd><dt>Fase</dt><dd>' + (p.Fase || 'I') + '</dd><dt>Donor</dt><dd>' + (p.Donor || 'Aramco Asia Singapore') + '</dd><dt>ID objek</dt><dd>' + OBJECT_ID + '</dd><dt>Koordinat</dt><dd>' + c[1].toFixed(6) + ', ' + c[0].toFixed(6) + '</dd></dl><a href="' + REPORT + '" target="_blank" rel="noopener noreferrer">Buka evidence laporan ↗</a></div>', { maxWidth: 340 });
      map.setView([c[1], c[0]], 18);
      marker.openPopup();
      document.getElementById("phase-map-status").textContent = "1 titik Fase I ditampilkan · Fase II disembunyikan";
    })
    .catch(function (error) {
      map.setView([1.420107, 102.061234], 17);
      document.getElementById("phase-map-status").textContent = "Titik belum dapat dimuat";
      console.error("Titik rumah bibit Fase 1 gagal dimuat:", error);
    });
})();
