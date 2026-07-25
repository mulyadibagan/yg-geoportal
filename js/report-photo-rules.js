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

  function updateRuleMessage() {
    const box = ensureRuleBox();
    box.textContent = "Maksimal 5 foto.";
  }

  form.addEventListener(
    "submit",
    event => {
      const type = selectedReportType();
      const count = photoCount();

      if (requiresPhoto(type) && count < 1) {
        event.preventDefault();
        event.stopImmediatePropagation();
        alert("Tambahkan minimal 1 foto.");
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
        alert("Tambahkan minimal 2 foto.");
        imageInput.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    true
  );

  const style = document.createElement("style");
  style.textContent = `
    .yg-photo-rule-box {
      margin: 12px 0;
      color: #38534a;
      line-height: 1.5;
      font-size: 13px;
    }
  `;
  document.head.appendChild(style);

  updateRuleMessage();
})();
