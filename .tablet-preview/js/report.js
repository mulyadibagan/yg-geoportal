
(() => {
  "use strict";

  const form = document.getElementById("report-form");
  const imageInput = document.getElementById("images");
  const preview = document.getElementById("preview");
  const status = document.getElementById("submit-status");
  const submitButton = document.getElementById("submit-button");
  const success = document.getElementById("success");
  const frame = document.getElementById("submit-frame");

  let compressedImages = [];
  let marker = null;
  let submissionStarted = false;

  const map = L.map("location-map").setView([1.15, 101.95], 8);
  const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
  const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: "Tiles &copy; Esri"
  });
  L.control.layers({"Peta Jalan":street,"Citra Satelit":satellite}, null, {collapsed:true}).addTo(map);

  function setLocation(lat, lng, zoom = 15) {
    document.getElementById("latitude").value = Number(lat).toFixed(7);
    document.getElementById("longitude").value = Number(lng).toFixed(7);
    if (marker) marker.setLatLng([lat, lng]);
    else marker = L.marker([lat, lng], {draggable:true}).addTo(map);
    marker.off("dragend").on("dragend", event => {
      const point = event.target.getLatLng();
      setLocation(point.lat, point.lng, map.getZoom());
    });
    map.setView([lat, lng], zoom);
  }

  map.on("click", event => setLocation(event.latlng.lat, event.latlng.lng, Math.max(map.getZoom(), 14)));

  document.getElementById("get-location").addEventListener("click", function() {
    if (!navigator.geolocation) {
      alert("Browser ini tidak mendukung GPS.");
      return;
    }
    const button = this;
    button.disabled = true;
    button.textContent = "Mengambil lokasi...";
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation(position.coords.latitude, position.coords.longitude, 16);
        button.textContent = "✓ Lokasi Tersimpan";
      },
      () => {
        alert("Lokasi tidak dapat diambil. Pastikan izin lokasi browser aktif.");
        button.disabled = false;
        button.textContent = "📍 Ambil Lokasi Saya";
      },
      {enableHighAccuracy:true, timeout:15000, maximumAge:0}
    );
  });

  imageInput.addEventListener("change", async function() {
    const files = Array.from(this.files || []).slice(0, 5);
    compressedImages = [];
    preview.innerHTML = "";
    status.textContent = files.length ? "Memproses foto..." : "";

    for (const file of files) {
      try {
        const dataUrl = await compressImage(file, 1400, 0.72);
        compressedImages.push({name:file.name, type:"image/jpeg", dataUrl});
        const figure = document.createElement("figure");
        const image = document.createElement("img");
        const caption = document.createElement("small");
        image.src = dataUrl;
        image.alt = file.name;
        caption.textContent = file.name;
        figure.append(image, caption);
        preview.appendChild(figure);
      } catch (error) {
        console.error(error);
      }
    }
    status.textContent = `${compressedImages.length} foto siap dikirim.`;
  });

  form.addEventListener("submit", event => {
    event.preventDefault();

    const selectedType = document.querySelector('input[name="reportTypeUI"]:checked');
    if (!selectedType) {
      alert("Pilih jenis laporan.");
      return;
    }

    const payload = {
      reportType:selectedType.value,
      name:value("name"),
      organization:value("organization"),
      email:value("email"),
      phone:value("phone"),
      province:value("province"),
      regency:value("regency"),
      district:value("district"),
      village:value("village"),
      locationName:value("location-name"),
      latitude:value("latitude"),
      longitude:value("longitude"),
      title:value("title"),
      activityDate:value("activity-date"),
      description:value("description"),
      oldInformation:value("old-information"),
      proposedInformation:value("proposed-information"),
      documentUrl:value("document-url"),
      images:compressedImages
    };

    document.getElementById("payload").value = JSON.stringify(payload);
    submitButton.disabled = true;
    submitButton.textContent = "Mengirim...";
    status.textContent = "Mohon tunggu. Foto sedang diunggah.";
    submissionStarted = true;
    form.submit();
  });

  frame.addEventListener("load", () => {
    if (!submissionStarted) return;
    window.setTimeout(() => {
      form.hidden = true;
      success.hidden = false;
      success.scrollIntoView({behavior:"smooth", block:"start"});
      submissionStarted = false;
    }, 600);
  });

  document.getElementById("send-another").addEventListener("click", () => {
    form.reset();
    compressedImages = [];
    preview.innerHTML = "";
    status.textContent = "";
    submitButton.disabled = false;
    submitButton.textContent = "Kirim Laporan";
    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }
    form.hidden = false;
    success.hidden = true;
    window.scrollTo({top:0, behavior:"smooth"});
  });

  function value(id) {
    return document.getElementById(id).value.trim();
  }

  function compressImage(file, maxDimension, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  window.setTimeout(() => map.invalidateSize(true), 250);
})();
