(() => {
  "use strict";
  const API = "https://script.google.com/macros/s/AKfycbxeGTDZXkR0DyLZmBHTq2M-52Iu4dTTGpH164S7sYHg8qPzvffobC6-r-TBLVHMT3HU-A/exec?page=public-reports";
  const callbackName = "ygCommunityReportsCallback";
  let communityLayer = null;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  }

  function popup(properties) {
    const photos = Array.isArray(properties.photos) ? properties.photos : [];
    const links = photos.map((url,i) =>
      `<a class="community-photo-link" href="${esc(url)}" target="_blank" rel="noopener">Foto ${i+1}</a>`
    ).join("") + (properties.documentUrl
      ? `<a class="community-photo-link" href="${esc(properties.documentUrl)}" target="_blank" rel="noopener">Dokumen</a>`
      : "");

    return `<div class="community-popup">
      <div class="community-popup-head">
        <strong>${esc(properties.title || "Laporan Masyarakat")}</strong>
        <span>Terverifikasi Yayasan Gambut</span>
      </div>
      <div class="community-popup-body">
        <div><b>Jenis</b><span>${esc(properties.reportType || "-")}</span></div>
        <div><b>Lokasi</b><span>${esc([properties.locationName,properties.village,properties.regency].filter(Boolean).join(", ") || "-")}</span></div>
        <div><b>Tanggal</b><span>${esc(properties.activityDate || properties.receivedAt || "-")}</span></div>
        <div><b>Pelapor</b><span>${esc(properties.organization || properties.reporterName || "-")}</span></div>
        <p>${esc(properties.description || "-")}</p>
        ${links ? `<div class="community-popup-links">${links}</div>` : ""}
      </div>
    </div>`;
  }

  function mount(data) {
    const map = window.YG_MAP?.map;
    if (!map || !window.L) {
      setTimeout(() => mount(data), 300);
      return;
    }

    if (communityLayer) map.removeLayer(communityLayer);

    communityLayer = L.geoJSON(data, {
      pointToLayer:(feature,latlng)=>L.circleMarker(latlng,{
        radius:8,fillColor:"#7b1fa2",color:"#fff",weight:2,opacity:1,fillOpacity:.95
      }),
      onEachFeature:(feature,layer)=>layer.bindPopup(popup(feature.properties||{}),{maxWidth:340})
    }).addTo(map);

    L.control.layers(null,{
      "Laporan Masyarakat Terverifikasi":communityLayer
    },{position:"bottomright",collapsed:true}).addTo(map);

    window.YG_COMMUNITY_LAYER = communityLayer;
  }

  window[callbackName] = data => {
    if (data && data.type === "FeatureCollection") mount(data);
  };

  const script = document.createElement("script");
  script.src = API + "&callback=" + callbackName + "&t=" + Date.now();
  script.async = true;
  script.onerror = () => console.warn("Laporan masyarakat belum dapat dimuat.");
  document.head.appendChild(script);
})();