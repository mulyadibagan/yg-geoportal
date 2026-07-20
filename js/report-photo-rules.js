(() => {
  "use strict";

  const form = document.getElementById("report-form");
  const preview = document.getElementById("preview");
  const layerSelect = document.getElementById("correction-layer");
  const imageInput = document.getElementById("images");

  if (!form || !preview || !layerSelect || !imageInput) return;

  function selectedReportType() {
    const checked = document.querySelector('input[name="reportTypeUI"]:checked');
    return checked ? checked.value : "";
  }

  function photoCount() {
    return preview.querySelectorAll("figure").length;
  }

  function requiresPhoto(type) {
    return type &&
      type !== "Perbaikan Informasi" &&
      type !== "Area/Poligon Baru";
  }

  function ensureRuleBox() {
    let box = document.getElementById("yg-photo-rule-box");
    if (box) return box;

    box = document.createElement("div");
    box.id = "yg-photo-rule-box";
    box.className = "yg-photo-rule-box";
    preview.parentNode.insertBefore(box, preview);
    return box;
  }

  function decoratePreview() {
    const figures = Array.from(preview.querySelectorAll("figure"));
    const type = selectedReportType();
    const isMangroveBeforeAfter =
      (
        type === "Tambah Foto Kegiatan" ||
        type === "Replanting/Penyulaman Mangrove"
      ) &&
      layerSelect.value === "area_mangrove";

    figures.forEach((figure, index) => {
      let badge = figure.querySelector(".yg-photo-stage-badge");
      if (!badge) {
        badge = document.createElement("strong");
        badge.className = "yg-photo-stage-badge";
        figure.appendChild(badge);
      }

      if (isMangroveBeforeAfter && index === 0) {
        badge.textContent = "BEFORE · sebelum";
        badge.dataset.stage = "before";
        badge.hidden = false;
      } else if (isMangroveBeforeAfter && index === 1) {
        badge.textContent = "AFTER · sesudah";
        badge.dataset.stage = "after";
        badge.hidden = false;
      } else {
        badge.textContent = "Foto pendukung";
        badge.dataset.stage = "supporting";
        badge.hidden = !isMangroveBeforeAfter;
      }
    });
  }

  function updateRuleMessage() {
    const type = selectedReportType();
    const layerId = layerSelect.value;
    const box = ensureRuleBox();

    box.className = "yg-photo-rule-box";

    if (type === "Monitoring") {
      box.innerHTML =
        "<b>Foto wajib:</b> setiap laporan monitoring harus memiliki minimal 1 foto lapangan.";
      box.classList.add("required");
    } else if (
      (
        type === "Tambah Foto Kegiatan" ||
        type === "Replanting/Penyulaman Mangrove"
      ) &&
      layerId === "area_mangrove"
    ) {
      box.innerHTML =
        "<b>Foto before–after wajib:</b> unggah minimal 2 foto. " +
        "Foto pertama harus kondisi <b>sebelum (BEFORE)</b> dan foto kedua kondisi <b>sesudah (AFTER)</b>. " +
        "Gunakan sudut pengambilan yang sama atau semirip mungkin.";
      box.classList.add("before-after");
    } else if (requiresPhoto(type)) {
      box.innerHTML =
        "<b>Foto wajib:</b> laporan ini harus memiliki minimal 1 foto yang jelas dan relevan.";
      box.classList.add("required");
    } else {
      box.innerHTML =
        "Foto bersifat opsional untuk koreksi atribut. Maksimal 5 foto.";
    }

    decoratePreview();
  }

  form.addEventListener(
    "submit",
    event => {
      const type = selectedReportType();
      const count = photoCount();

      if (type === "Monitoring" && count < 1) {
        event.preventDefault();
        event.stopImmediatePropagation();
        alert("Laporan monitoring wajib memiliki minimal 1 foto lapangan.");
        imageInput.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (requiresPhoto(type) && count < 1) {
        event.preventDefault();
        event.stopImmediatePropagation();
        alert("Jenis laporan ini wajib memiliki minimal 1 foto lapangan.");
        imageInput.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (
        (
          type === "Tambah Foto Kegiatan" ||
          type === "Replanting/Penyulaman Mangrove"
        ) &&
        layerSelect.value === "area_mangrove" &&
        count < 2
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        alert(
          "Kegiatan pada Area Penanaman Mangrove wajib memiliki minimal 2 foto: " +
          "foto pertama BEFORE (sebelum) dan foto kedua AFTER (sesudah)."
        );
        imageInput.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    true
  );

  document.addEventListener("change", event => {
    if (
      event.target.matches('input[name="reportTypeUI"]') ||
      event.target === layerSelect ||
      event.target === imageInput
    ) {
      window.setTimeout(updateRuleMessage, 30);
    }
  });

  const observer = new MutationObserver(() => {
    decoratePreview();
  });

  observer.observe(preview, { childList: true, subtree: true });

  const style = document.createElement("style");
  style.textContent = `
    .yg-photo-rule-box {
      margin: 12px 0;
      padding: 12px 14px;
      border: 1px solid #cbdad3;
      border-radius: 12px;
      background: #f4f8f6;
      color: #38534a;
      line-height: 1.5;
      font-size: 13px;
    }
    .yg-photo-rule-box.required {
      border-color: #d9a11b;
      background: #fff8df;
      color: #6b4b00;
    }
    .yg-photo-rule-box.before-after {
      border-color: #11865d;
      background: #eaf7f1;
      color: #075f42;
    }
    #preview figure { position: relative; }
    .yg-photo-stage-badge {
      position: absolute;
      left: 8px;
      bottom: 8px;
      z-index: 2;
      padding: 5px 8px;
      border-radius: 999px;
      background: rgba(7, 95, 66, .92);
      color: #fff;
      font-size: 10px;
      line-height: 1;
      letter-spacing: .03em;
    }
  `;
  document.head.appendChild(style);

  updateRuleMessage();
})();
