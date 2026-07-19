(() => {
  "use strict";

  const form = document.getElementById("report-form");
  const input = document.getElementById("images");
  const preview = document.getElementById("preview");
  const button = document.getElementById("submit-button");
  const status = document.getElementById("submit-status");
  if (!form || !input || !preview || !button) return;

  let processing = false;

  function reportType() {
    const selected = document.querySelector('input[name="reportTypeUI"]:checked');
    return selected ? selected.value : "";
  }

  function photoCount() {
    return preview.querySelectorAll("figure").length;
  }

  function setProcessing(value) {
    processing = Boolean(value);
    if (processing) {
      button.disabled = true;
      button.textContent = "Memproses foto...";
    } else if (!form.dataset.ygSubmitting) {
      button.disabled = false;
      button.textContent = "Kirim Laporan";
    }
  }

  input.addEventListener("change", () => {
    if (input.files && input.files.length) setProcessing(true);
  });

  const observer = new MutationObserver(() => {
    const text = status ? status.textContent : "";
    if (/memproses\s+\d+\s+foto/i.test(text)) {
      setProcessing(true);
    } else if (/foto siap dikirim|gagal diproses/i.test(text) || (!text.trim() && photoCount())) {
      setProcessing(false);
    }
  });

  observer.observe(preview, { childList: true, subtree: true });
  if (status) observer.observe(status, { childList: true, subtree: true, characterData: true });

  form.addEventListener("submit", event => {
    if (processing) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert("Foto masih diproses. Tunggu sampai muncul tulisan foto siap dikirim.");
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (reportType() === "Monitoring" && photoCount() < 1) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert("Laporan monitoring wajib memiliki minimal 1 foto lapangan.");
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    form.dataset.ygSubmitting = "true";
  }, true);
})();