(() => {
  "use strict";

  function normalize(value) {
    return String(value == null ? "" : value)
      .trim()
      .replace(/^["']+|["']+$/g, "")
      .replace(/&amp;/g, "&");
  }

  function parseObject(value) {
    if (value && typeof value === "object") return value;
    if (typeof value !== "string" || !value.trim()) return {};
    try {
      return JSON.parse(value);
    } catch (error) {
      return {};
    }
  }

  function driveId(value) {
    const text = normalize(value);
    const patterns = [
      /\/file\/d\/([A-Za-z0-9_-]+)/i,
      /\/d\/([A-Za-z0-9_-]+)/i,
      /[?&]id=([A-Za-z0-9_-]+)/i,
      /\/thumbnail\?(?:[^#]*&)?id=([A-Za-z0-9_-]+)/i
    ];

    for (let index = 0; index < patterns.length; index += 1) {
      const match = text.match(patterns[index]);
      if (match) return match[1];
    }

    return /^[A-Za-z0-9_-]{20,}$/.test(text) ? text : "";
  }

  function splitValues(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.flatMap(splitValues);

    if (typeof value === "object") {
      return Object.values(value).flatMap(splitValues);
    }

    return String(value)
      .split(/\r?\n|\s*;\s*|,\s*(?=https?:\/\/|[A-Za-z0-9_-]{20,}$)/)
      .map(normalize)
      .filter(Boolean);
  }

  function isImageFilename(value) {
    return /\.(?:jpe?g|png|webp|gif)(?:[?#].*)?$/i.test(value);
  }

  function candidates(value) {
    const clean = normalize(value);
    const id = driveId(clean);

    if (id) {
      return [
        "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w1200",
        "https://lh3.googleusercontent.com/d/" + encodeURIComponent(id)
      ];
    }

    if (/^https?:\/\//i.test(clean)) return [clean];
    if (!isImageFilename(clean)) return [];

    const encoded = clean.split("/").map(encodeURIComponent).join("/");
    if (clean.includes("/")) return [encoded];

    return [
      "assets/photos/" + encoded,
      "assets/images/" + encoded,
      "images/" + encoded,
      "photos/" + encoded,
      encoded
    ];
  }

  function originalUrl(value) {
    const clean = normalize(value);
    const id = driveId(clean);
    if (id) {
      return "https://drive.google.com/file/d/" +
        encodeURIComponent(id) + "/view?usp=sharing";
    }
    return /^https?:\/\//i.test(clean) ? clean : candidates(clean)[0] || "";
  }

  function collectPhotos(properties) {
    const props = properties || {};
    const nestedSources = [
      props,
      parseObject(props.targetFeatureProperties),
      parseObject(props.proposedChanges)
    ];
    const keys = [
      "_ygPhotos", "photos", "photo", "photoUrl", "photoURL",
      "Foto", "Foto_1", "Foto_2", "Foto_3", "Foto_URL", "Photo_URL",
      "images", "imageUrls", "Dokumentasi", "Lampiran_Foto"
    ];
    const seen = new Set();
    const result = [];

    nestedSources.forEach(source => {
      keys.forEach(key => {
        splitValues(source && source[key]).forEach(value => {
          const imageCandidates = candidates(value);
          if (!imageCandidates.length) return;

          const id = driveId(value);
          const dedupeKey = id
            ? "drive:" + id
            : normalize(value).split(/[?#]/)[0].toLowerCase();
          if (seen.has(dedupeKey)) return;
          seen.add(dedupeKey);
          result.push({ value, imageCandidates });
        });
      });
    });

    return result;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function galleryHtml(photos) {
    return '<div class="yg-v3-gallery yg-object-photo-fix-gallery">' +
      photos.map((photo, index) => {
        const serialized = photo.imageCandidates.map(encodeURIComponent).join("|");
        return '<a class="yg-photo-card" href="' +
          escapeHtml(originalUrl(photo.value)) +
          '" target="_blank" rel="noopener noreferrer" title="Buka foto">' +
          '<img src="' + escapeHtml(photo.imageCandidates[0]) +
          '" data-yg-photo-candidates="' + escapeHtml(serialized) +
          '" data-yg-photo-index="0" loading="lazy" alt="Foto ' +
          (index + 1) + '">' +
          '<span class="yg-photo-fallback" style="display:none">Buka Foto ' +
          (index + 1) + '</span></a>';
      }).join("") +
      "</div>";
  }

  function activateFallbacks(container) {
    container.querySelectorAll("img[data-yg-photo-candidates]").forEach(image => {
      image.addEventListener("error", () => {
        const list = String(image.dataset.ygPhotoCandidates || "")
          .split("|")
          .filter(Boolean)
          .map(decodeURIComponent);
        const nextIndex = Number(image.dataset.ygPhotoIndex || 0) + 1;

        if (nextIndex < list.length) {
          image.dataset.ygPhotoIndex = String(nextIndex);
          image.src = list[nextIndex];
          return;
        }

        image.style.display = "none";
        const fallback = image.nextElementSibling;
        if (fallback) fallback.style.display = "flex";
      });
    });
  }

  function enhancePopup(event) {
    const popup = event && event.popup;
    const source = popup && popup._source;
    const feature = source && source.feature;
    const element = popup && popup.getElement && popup.getElement();
    if (!feature || !element) return;

    const body = element.querySelector(".popup-body");
    if (!body) return;
    if (body.querySelector(".yg-v3-gallery, .yg-update-gallery")) return;

    const photos = collectPhotos(feature.properties || {});
    if (!photos.length) return;

    body.insertAdjacentHTML("beforeend", galleryHtml(photos));
    activateFallbacks(body);
  }

  function attach() {
    if (!window.YG_MAP || !window.YG_MAP.map) {
      window.setTimeout(attach, 300);
      return;
    }
    window.YG_MAP.map.on("popupopen", enhancePopup);
  }

  attach();
})();
