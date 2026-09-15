(function () {
  "use strict";
  var REPORT_URL = "https://drive.google.com/file/d/1urwXsg64a4ttgihusCFZzTiKmGYyyqWB/view?usp=drivesdk";
  var map = L.map("phase1-map", { zoomControl: true });
  var satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles © Esri" });
  var streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
  satellite.addTo(map);
  L.control.layers({ "Citra satelit": satellite, "Peta jalan": streets }, null, { collapsed: false }).addTo(map);

  function n(value) { return Number(value) || 0; }
  function format(value, digits) { return new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0 }).format(value); }
  function popup(feature, index) {
    var p = feature.properties || {};
    return '<div class="phase-map-popup"><h3>Polygon Fase 1 · Plot ' + (index + 1) + '</h3><dl>' +
      '<dt>Desa</dt><dd>' + (p.Desa || 'Buruk Bakul') + '</dd>' +
      '<dt>Fase</dt><dd>' + (p.Ket || 'Phase I') + '</dd>' +
      '<dt>Tahun</dt><dd>' + (p.Tahun || '2023') + '</dd>' +
      '<dt>Luas</dt><dd>' + format(n(p.Luas_Ha), 2) + ' ha</dd>' +
      '<dt>Penanaman</dt><dd>' + format(n(p.Jumlah_Bib)) + ' mangrove</dd>' +
      '<dt>ID objek</dt><dd>' + (p.Object_ID || '—') + '</dd></dl>' +
      '<a href="' + REPORT_URL + '" target="_blank" rel="noopener noreferrer">Buka evidence laporan ↗</a></div>';
  }

  fetch("data/area_mangrove.geojson?v=20260824-phase1-map1", { cache: "no-store" })
    .then(function (response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
    .then(function (data) {
      var features = (data.features || []).filter(function (feature) {
        var p = feature.properties || {};
        return /^phase\s*i$/i.test(String(p.Ket || "").trim()) && /^buruk\s*bakul$/i.test(String(p.Desa || "").trim());
      });
      var layer = L.geoJSON({ type: "FeatureCollection", features: features }, {
        style: { color: "#ffca28", weight: 3, fillColor: "#ffca28", fillOpacity: .24 },
        onEachFeature: function (feature, polygon) { polygon.bindPopup(popup(feature, features.indexOf(feature)), { maxWidth: 330 }); }
      }).addTo(map);
      var area = features.reduce(function (sum, f) { return sum + n((f.properties || {}).Luas_Ha); }, 0);
      var seedlings = features.reduce(function (sum, f) { return sum + n((f.properties || {}).Jumlah_Bib); }, 0);
      document.getElementById("phase-map-polygons").textContent = format(features.length);
      document.getElementById("phase-map-area").textContent = format(area, 2) + " ha";
      document.getElementById("phase-map-seedlings").textContent = format(seedlings);
      document.getElementById("phase-map-status").textContent = features.length + " polygon ditampilkan · fase lain disembunyikan";
      if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [35, 35], maxZoom: 16 });
      else map.setView([1.423, 102.058], 14);
    })
    .catch(function (error) {
      document.getElementById("phase-map-status").textContent = "Polygon belum dapat dimuat";
      map.setView([1.423, 102.058], 14);
      console.error("Peta Aramco Fase 1 gagal dimuat:", error);
    });
})();
