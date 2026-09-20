(function(){try{var raw=localStorage.getItem("ygEditorSessionV1")||sessionStorage.getItem("ygEditorSessionV1"),s=raw?JSON.parse(raw):null;if(s&&s.token&&Number(s.expiresAt||0)>Date.now()){location.replace("staff-social-forestry-directory.html"+location.search+location.hash);return}}catch(ignore){}})();(function () {
  "use strict";

  var rows = [];
  var activeScheme = "";
  var visibleLimit = 18;
  var pageSize = 18;
  var search = document.getElementById("profile-search");
  var regency = document.getElementById("regency-filter");
  var scheme = document.getElementById("scheme-filter");
  var grid = document.getElementById("profile-grid");
  var schemeGrid = document.getElementById("stat-scheme-grid");
  var regencyGrid = document.getElementById("regency-summary-grid");
  var loadMoreWrap = document.getElementById("load-more-wrap");
  var loadMore = document.getElementById("load-more");
  var displayStatus = document.getElementById("display-status");

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function esc(value) {
    return text(value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function norm(value) {
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function formatHa(value) {
    return Number(value || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " ha";
  }

  function canonicalScheme(value) {
    var normalized = norm(value);
    if (/kemitraan/.test(normalized)) return "Kemitraan Kehutanan";
    if (/adat|\bha\b/.test(normalized)) return "Hutan Adat";
    if (/tanaman rakyat|\bhtr\b/.test(normalized)) return "Hutan Tanaman Rakyat";
    if (/hutan desa|\bhd\b|lphd/.test(normalized)) return "Hutan Desa";
    if (/kemasyarakatan|\bhkm\b/.test(normalized)) return "Hutan Kemasyarakatan";
    return "Belum terklasifikasi";
  }

  function updateStats() {
    var regencies = new Set(rows.map(function (row) { return row.regency; }).filter(Boolean));
    var groups = {};
    rows.forEach(function (row) {
      var group = groups[row.scheme] || (groups[row.scheme] = { count: 0, area: 0 });
      group.count += 1;
      group.area += Number(row.areaHa || 0);
    });
    document.getElementById("stat-all").textContent = rows.length;
    document.getElementById("stat-approved").textContent = rows.length;
    document.getElementById("stat-regencies").textContent = regencies.size;
    schemeGrid.innerHTML = Object.keys(groups).sort().map(function (name) {
      var group = groups[name];
      var active = activeScheme === name;
      return '<button type="button" class="psd-area-card ' + (active ? "is-active" : "") + '" data-area-scheme="' + esc(name) + '" aria-pressed="' + active + '"><strong>' + formatHa(group.area) + '</strong><small>' + esc(name) + '</small><em>' + group.count + ' profil</em></button>';
    }).join("");

    var byRegency = {};
    rows.forEach(function (row) {
      if (!row.regency) return;
      var group = byRegency[row.regency] || (byRegency[row.regency] = { count: 0, area: 0 });
      group.count += 1;
      group.area += Number(row.areaHa || 0);
    });
    regencyGrid.innerHTML = Object.keys(byRegency).sort().map(function (name) {
      var group = byRegency[name];
      return '<button type="button" class="psd-regency-card" data-regency-card="' + esc(name) + '" aria-pressed="false"><span><strong>' + esc(name) + '</strong><small>' + group.count + ' PS · ' + formatHa(group.area) + '</small></span></button>';
    }).join("");
  }

  function filteredRows() {
    var query = norm(search.value);
    var area = regency.value;
    var selectedScheme = activeScheme || scheme.value;
    return rows.filter(function (row) {
      return (!area || row.regency === area) && (!selectedScheme || row.scheme === selectedScheme) && (!query || row.haystack.indexOf(query) > -1);
    });
  }

  function render() {
    var shown = filteredRows();
    var visible = shown.slice(0, visibleLimit);
    document.getElementById("result-count").textContent = shown.length + " profil";
    grid.innerHTML = visible.length ? visible.map(function (row) {
      return '<a class="psd-card" href="social-forestry-profile.html?key=' + encodeURIComponent(row.key) + '"><div class="psd-card__top"><span class="psd-badge">SK terbit</span><span class="psd-docs">Informasi publik</span></div><h3>' + esc(row.name) + '</h3><p>' + esc([row.village, row.district, row.regency].filter(Boolean).join(" · ")) + '</p><div class="psd-card__meta"><span>' + esc(row.scheme) + '</span>' + (row.decree ? '<span>' + esc(row.decree) + '</span>' : '') + '</div><span class="psd-card__action">Buka profil →</span></a>';
    }).join("") : '<div class="psd-empty">Tidak ada profil yang sesuai dengan filter.</div>';

    regencyGrid.querySelectorAll("[data-regency-card]").forEach(function (card) {
      var active = card.dataset.regencyCard === regency.value;
      card.classList.toggle("is-active", active);
      card.setAttribute("aria-pressed", String(active));
    });

    if (shown.length > visible.length) {
      loadMoreWrap.hidden = false;
      displayStatus.textContent = "Menampilkan " + visible.length + " dari " + shown.length + " profil";
      loadMore.textContent = "Muat " + Math.min(pageSize, shown.length - visible.length) + " profil berikutnya";
    } else {
      loadMoreWrap.hidden = true;
    }
  }

  function resetAndRender() {
    visibleLimit = pageSize;
    render();
  }

  async function init() {
    try {
      var result = await Promise.all([
        fetch("data/social-forestry-summary.json?v=20260920-public-directory1", { cache: "no-store" }).then(function (response) { return response.json(); }),
        fetch("data/social-forestry-details.json?v=20260920-public-directory1", { cache: "no-store" }).then(function (response) { return response.json(); })
      ]);
      var summary = result[0] && result[0].profiles || [];
      var details = result[1] || {};
      rows = summary.map(function (profile) {
        var detail = details[profile.key] || {};
        var row = {
          key: profile.key,
          name: profile.name || detail.name || "Profil PS",
          village: profile.village || detail.village || "",
          district: profile.district || detail.district || "",
          regency: profile.regency || detail.regency || "",
          scheme: canonicalScheme(profile.scheme || detail.scheme),
          decree: profile.decree || detail.decree || "",
          areaHa: profile.areaHa || detail.areaHa || 0
        };
        row.haystack = norm([row.name, row.village, row.district, row.regency, row.scheme, row.decree].join(" "));
        return row;
      }).sort(function (first, second) { return first.name.localeCompare(second.name, "id"); });

      var areas = Array.from(new Set(rows.map(function (row) { return row.regency; }).filter(Boolean))).sort();
      var schemes = Array.from(new Set(rows.map(function (row) { return row.scheme; }).filter(Boolean))).sort();
      regency.innerHTML = '<option value="">Semua kabupaten</option>' + areas.map(function (value) { return '<option>' + esc(value) + '</option>'; }).join("");
      scheme.innerHTML = '<option value="">Semua skema</option>' + schemes.map(function (value) { return '<option>' + esc(value) + '</option>'; }).join("");
      updateStats();
      render();
    } catch (error) {
      console.error(error);
      grid.innerHTML = '<div class="psd-empty">Direktori gagal dimuat. Silakan coba lagi.</div>';
    }
  }

  [search, regency, scheme].forEach(function (node) {
    node.addEventListener(node === search ? "input" : "change", function () {
      if (node === scheme) activeScheme = "";
      resetAndRender();
    });
  });

  schemeGrid.addEventListener("click", function (event) {
    var card = event.target.closest("[data-area-scheme]");
    if (!card) return;
    activeScheme = activeScheme === card.dataset.areaScheme ? "" : card.dataset.areaScheme;
    scheme.value = "";
    updateStats();
    resetAndRender();
  });

  regencyGrid.addEventListener("click", function (event) {
    var card = event.target.closest("[data-regency-card]");
    if (!card) return;
    regency.value = regency.value === card.dataset.regencyCard ? "" : card.dataset.regencyCard;
    resetAndRender();
    document.querySelector(".psd-content").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  loadMore.addEventListener("click", function () {
    visibleLimit += pageSize;
    render();
  });

  init();
})();
