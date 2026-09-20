(function () {
  "use strict";
  var state = { analysis: null, map: null, layers: {}, layerControl: null, draft: null };
  var priorityRank = { kritis: 3, tinggi: 2, sedang: 1 };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function number(value, digits) {
    return Number(value || 0).toLocaleString("id-ID", {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits == null ? 1 : digits
    });
  }

  function dateTime(value) {
    var parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("id-ID", {
      dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta"
    }) + " WIB";
  }

  function badge(priority) {
    var value = priority || "sedang";
    return '<span class="rdtr-badge rdtr-badge--' + esc(value) + '">' + esc(value) + "</span>";
  }

  function topPriority(row) {
    return (row.recommendations || []).reduce(function (best, item) {
      return (priorityRank[item.priority] || 0) > (priorityRank[best] || 0) ? item.priority : best;
    }, "sedang");
  }

  function renderSummary(data) {
    var summary = data.summary || {};
    document.getElementById("rdtr-kpi-villages").textContent = number(summary.villageCount, 0);
    document.getElementById("rdtr-kpi-area").textContent = number(summary.areaHa, 0);
    document.getElementById("rdtr-kpi-peat").textContent = number(summary.peatCoveragePct, 1) + "%";
    document.getElementById("rdtr-kpi-forest").textContent = number(summary.forestCoveragePct, 1) + "%";
    document.getElementById("rdtr-kpi-rtrw").textContent = number(summary.rtrwClassCount, 0);
    document.getElementById("rdtr-generated").textContent =
      "Baseline internal dibuat " + dateTime(data.metadata && data.metadata.generatedAt) + ".";
  }

  function renderReadiness(rows) {
    var label = { ready: "siap", partial: "sebagian", missing: "belum tersedia" };
    document.getElementById("rdtr-readiness").innerHTML = (rows || []).map(function (row) {
      return '<div class="rdtr-readiness-row is-' + esc(row.status) + '"><i></i><span>' +
        esc(row.label) + "</span><small>" + esc(label[row.status] || row.status) + "</small></div>";
    }).join("");
  }

  function villageRow(row) {
    var rtrw = (row.rtrwCoverage || [])[0];
    var mangrove = row.mangrove || {};
    var mangroveText = mangrove.status === "analysed"
      ? number(mangrove.currentMangroveHa, 1) + " ha tersisa"
      : "Belum dianalisis";
    var mangroveSmall = mangrove.status === "analysed"
      ? "Kehilangan indikatif " + number(mangrove.indicativeMangroveLossHa, 1) + " ha"
      : "Perlu verifikasi pesisir";
    return "<tr data-village-name=\"" + esc(row.name.toLowerCase()) + "\">" +
      "<td><strong>" + esc(row.name) + "</strong><small>Bangko · Rokan Hilir</small></td>" +
      "<td><strong>" + number(row.areaHa, 1) + " ha</strong></td>" +
      "<td><strong>" + esc(rtrw ? rtrw.name : "Belum terklasifikasi") + "</strong>" +
        (rtrw ? "<small>" + number(rtrw.areaHa, 1) + " ha</small>" : "") + "</td>" +
      "<td><strong>" + number(row.peatCoveragePct, 1) + "%</strong><small>" + number(row.peatAreaHa, 1) + " ha indikatif</small></td>" +
      "<td><strong>" + number(row.forestCoveragePct, 1) + "%</strong><small>" + number(row.forestAreaHa, 1) + " ha non-APL</small></td>" +
      "<td><strong>" + esc(mangroveText) + "</strong><small>" + esc(mangroveSmall) + "</small></td>" +
      "<td>" + badge(topPriority(row)) + "</td></tr>";
  }

  function renderVillages(rows) {
    document.getElementById("rdtr-village-body").innerHTML = (rows || []).map(villageRow).join("");
  }

  function aggregateRecommendations(rows) {
    var grouped = new Map();
    (rows || []).forEach(function (row) {
      (row.recommendations || []).forEach(function (item) {
        var current = grouped.get(item.theme);
        if (!current) current = { theme: item.theme, recommendation: item.recommendation, priority: item.priority, villages: [] };
        if ((priorityRank[item.priority] || 0) > (priorityRank[current.priority] || 0)) {
          current.priority = item.priority;
          current.recommendation = item.recommendation;
        }
        current.villages.push(row.name);
        grouped.set(item.theme, current);
      });
    });
    return Array.from(grouped.values()).sort(function (a, b) {
      return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
    });
  }

  function renderRecommendations(rows) {
    document.getElementById("rdtr-recommendations").innerHTML = aggregateRecommendations(rows).map(function (row) {
      return '<article class="rdtr-recommendation"><header><h3>' + esc(row.theme) + "</h3>" + badge(row.priority) +
        "</header><p>" + esc(row.recommendation) + "</p><small>Cakupan: " +
        (row.villages.length === state.analysis.summary.villageCount ? "seluruh wilayah perencanaan" : esc(row.villages.join(", "))) +
        "</small></article>";
    }).join("");
  }

  function renderLegal(rows) {
    document.getElementById("rdtr-legal").innerHTML = (rows || []).map(function (row) {
      return "<article><strong>" + esc(row.code) + "</strong><span>" + esc(row.theme) + "</span></article>";
    }).join("");
  }

  function renderQuestions(rows) {
    document.getElementById("rdtr-questions").innerHTML = (rows || []).map(function (row) {
      return "<li>" + esc(row) + "</li>";
    }).join("");
  }

  function colorFrom(value) {
    var colors = ["#a25728", "#176c8c", "#4b7d49", "#8d546f", "#806523", "#5d59a1", "#338477"];
    var hash = 0, text = String(value || "");
    for (var i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return colors[Math.abs(hash) % colors.length];
  }

  function popup(label, properties) {
    return "<strong>" + esc(label) + "</strong><br>" + Object.entries(properties || {}).filter(function (row) {
      return row[1] !== "" && row[1] != null;
    }).map(function (row) { return esc(row[0]) + ": " + esc(row[1]); }).join("<br>");
  }

  function initMap(data) {
    var map = L.map("rdtr-map", { zoomControl: true, preferCanvas: true });
    state.map = map;
    var road = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "© OpenStreetMap contributors"
    }).addTo(map);
    var satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 18, attribution: "Tiles © Esri"
    });
    state.layers.rtrw = L.geoJSON(data.map.rtrw, {
      renderer: L.canvas({ padding: .5 }),
      style: function (feature) { var color = colorFrom(feature.properties.class); return { color: color, weight: 1.5, fillColor: color, fillOpacity: .18 }; },
      onEachFeature: function (feature, layer) { layer.bindPopup(popup("RTRW Riau", {
        "Arahan": feature.properties.class,
        "Pola": feature.properties.pattern,
        "Dasar": feature.properties.legalBasis
      })); }
    }).addTo(map);
    state.layers.peat = L.geoJSON(data.map.peat, {
      renderer: L.canvas({ padding: .5 }),
      style: { color: "#73508b", weight: 1.2, fillColor: "#9c78b1", fillOpacity: .24 },
      onEachFeature: function (feature, layer) { layer.bindPopup(popup("Indikasi gambut", {
        "Kelas": feature.properties.peatClass,
        "Ketebalan": feature.properties.thickness,
        "Tahun": feature.properties.year
      })); }
    });
    state.layers.forest = L.geoJSON(data.map.forest, {
      renderer: L.canvas({ padding: .5 }),
      style: { color: "#287047", weight: 1.3, fillColor: "#4d996b", fillOpacity: .22 },
      onEachFeature: function (feature, layer) { layer.bindPopup(popup("Kawasan hutan", { "Fungsi": feature.properties.function })); }
    });
    state.layers.study = L.geoJSON(data.map.studyArea, {
      style: { color: "#123f38", weight: 2.5, fillOpacity: .02 },
      onEachFeature: function (feature, layer) {
        var props = feature.properties || {};
        layer.bindTooltip(props.WADMKD || props.NAMOBJ || "Wilayah perencanaan");
      }
    }).addTo(map);
    state.layerControl = L.control.layers({ "Peta jalan": road, "Citra satelit": satellite }, {
      "Batas 11 wilayah": state.layers.study,
      "RTRW Riau": state.layers.rtrw,
      "Gambut BBSDLP 2019": state.layers.peat,
      "Kawasan hutan non-APL": state.layers.forest
    }, { collapsed: false }).addTo(map);
    map.fitBounds(state.layers.study.getBounds(), { padding: [18, 18] });
    document.getElementById("rdtr-map-status").textContent = "Baseline privat siap · aktifkan layer untuk membandingkan";
  }

  function safeIntersect(left, right) {
    try { return turf.intersect(turf.featureCollection([left, right])); } catch (error) { return null; }
  }

  function intersectionAreaHa(left, features) {
    return (features || []).reduce(function (sum, right) {
      var overlap = safeIntersect(left, right);
      return sum + (overlap ? turf.area(overlap) / 10000 : 0);
    }, 0);
  }

  function draftZoneName(feature) {
    var props = feature.properties || {};
    var fields = ["SUBZONA", "NAMOBJ", "ZONA", "NAMA_ZONA", "KODE_ZONA", "KODZON", "POLA_RUANG", "RENCANA", "KETERANGAN", "KET"];
    for (var i = 0; i < fields.length; i += 1) if (props[fields[i]] != null && String(props[fields[i]]).trim()) return String(props[fields[i]]).trim();
    var first = Object.values(props).find(function (value) { return typeof value === "string" && value.trim(); });
    return first || "Zona tanpa nama";
  }

  function isIntensiveZone(name) {
    return /permukiman|perumahan|perdagangan|jasa|industri|pelabuhan|perkantoran|pariwisata|transportasi|budidaya|campuran/i.test(name);
  }

  function flattenDraft(value) {
    var collections = Array.isArray(value) ? value : [value];
    var features = [];
    collections.forEach(function (collection) {
      if (collection && collection.type === "FeatureCollection") features.push.apply(features, collection.features || []);
      else if (collection && collection.type === "Feature") features.push(collection);
    });
    return turf.featureCollection(features.filter(function (feature) {
      return feature.geometry && /Polygon/.test(feature.geometry.type);
    }));
  }

  function analyseDraft(collection, fileName) {
    var studyUnion = turf.union(turf.featureCollection(state.analysis.map.studyArea.features));
    var clipped = [];
    (collection.features || []).forEach(function (feature) {
      var overlap = safeIntersect(feature, studyUnion);
      if (!overlap || turf.area(overlap) < 100) return;
      overlap.properties = Object.assign({}, feature.properties, { _ygZone: draftZoneName(feature) });
      clipped.push(overlap);
    });
    if (!clipped.length) throw new Error("Tidak ada polygon draf yang beririsan dengan 11 wilayah perencanaan.");
    var zones = new Map(), findings = [];
    clipped.forEach(function (feature) {
      var name = feature.properties._ygZone;
      var hectares = turf.area(feature) / 10000;
      zones.set(name, (zones.get(name) || 0) + hectares);
      if (!isIntensiveZone(name)) return;
      var peatHa = intersectionAreaHa(feature, state.analysis.map.peat.features);
      var forestHa = intersectionAreaHa(feature, state.analysis.map.forest.features);
      if (peatHa > .1 || forestHa > .1) findings.push({ zone: name, areaHa: hectares, peatHa: peatHa, forestHa: forestHa });
    });
    if (state.layers.draft) {
      state.map.removeLayer(state.layers.draft);
      state.layerControl.removeLayer(state.layers.draft);
    }
    state.layers.draft = L.geoJSON(turf.featureCollection(clipped), {
      renderer: L.canvas({ padding: .5 }),
      style: function (feature) {
        var intensive = isIntensiveZone(feature.properties._ygZone);
        return { color: intensive ? "#b83d33" : "#245e9a", weight: 2, fillColor: intensive ? "#e36f62" : "#4b8ac3", fillOpacity: .28 };
      },
      onEachFeature: function (feature, layer) {
        layer.bindPopup(popup("Draf RDTR · lokal", { "Zona": feature.properties._ygZone, "Berkas": fileName }));
      }
    }).addTo(state.map);
    state.layerControl.addOverlay(state.layers.draft, "Draf RDTR · lokal");
    state.map.fitBounds(state.layers.draft.getBounds(), { padding: [18, 18] });
    state.draft = { fileName: fileName, features: clipped, zones: zones, findings: findings };
    renderDraftFindings();
  }

  function renderDraftFindings() {
    var draft = state.draft;
    var totalArea = draft.features.reduce(function (sum, feature) { return sum + turf.area(feature) / 10000; }, 0);
    var highest = Array.from(draft.zones.entries()).sort(function (a, b) { return b[1] - a[1]; });
    var html = '<div class="rdtr-draft-summary"><article><strong>' + number(draft.features.length, 0) +
      '</strong><span>polygon beririsan</span></article><article><strong>' + number(draft.zones.size, 0) +
      '</strong><span>zona teridentifikasi</span></article><article><strong>' + number(totalArea, 1) +
      ' ha</strong><span>cakupan terbaca</span></article><article><strong>' + number(draft.findings.length, 0) +
      '</strong><span>indikasi perlu klarifikasi</span></article></div>';
    if (highest.length) html += "<p><strong>Zona terluas:</strong> " + esc(highest.slice(0, 5).map(function (row) {
      return row[0] + " (" + number(row[1], 1) + " ha)";
    }).join(" · ")) + "</p>";
    if (!draft.findings.length) html += "<p>Belum ditemukan zona intensif yang beririsan dengan baseline gambut atau kawasan hutan. Tetap diperlukan pemeriksaan KLHS, sempadan, rob, banjir, abrasi, dan kondisi lapangan.</p>";
    draft.findings.sort(function (a, b) { return (b.peatHa + b.forestHa) - (a.peatHa + a.forestHa); }).forEach(function (row) {
      html += '<article class="rdtr-finding"><h3>' + esc(row.zone) + '</h3><p>Area draf: <strong>' + number(row.areaHa, 1) +
        ' ha</strong> · irisan gambut: <strong>' + number(row.peatHa, 1) + ' ha</strong> · irisan kawasan hutan: <strong>' +
        number(row.forestHa, 1) + ' ha</strong>.</p><p><strong>Usulan YG:</strong> minta justifikasi zonasi, uji daya dukung/KLHS, status kawasan, dan persyaratan pengendalian sebelum zona ditetapkan.</p></article>';
    });
    document.getElementById("rdtr-draft-findings").innerHTML = html;
    document.getElementById("rdtr-draft-status").textContent = "Draf lokal siap: " + draft.fileName + " · tidak diunggah ke server.";
  }

  async function loadDraft(file) {
    var status = document.getElementById("rdtr-draft-status");
    status.textContent = "Membaca draf secara lokal…";
    try {
      var value;
      if (/\.zip$/i.test(file.name)) {
        if (typeof window.shp !== "function") throw new Error("Pembaca ZIP Shapefile belum tersedia.");
        value = await window.shp(await file.arrayBuffer());
      } else value = JSON.parse(await file.text());
      var collection = flattenDraft(value);
      if (!collection.features.length) throw new Error("Berkas tidak memuat polygon GeoJSON yang dapat dianalisis.");
      analyseDraft(collection, file.name);
    } catch (error) {
      status.textContent = "Draf gagal dibaca: " + error.message;
    }
  }

  function csvCell(value) {
    return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
  }

  function exportCsv() {
    var header = ["Wilayah", "Luas_ha", "Arahan_RTRW_terluas", "RTRW_ha", "Gambut_ha", "Gambut_persen", "Kawasan_hutan_ha", "Kawasan_hutan_persen", "Mangrove_status", "Prioritas", "Rekomendasi"];
    var lines = [header.map(csvCell).join(",")];
    state.analysis.villages.forEach(function (row) {
      var top = (row.rtrwCoverage || [])[0] || {};
      lines.push([
        row.name, row.areaHa, top.name || "", top.areaHa || "", row.peatAreaHa, row.peatCoveragePct,
        row.forestAreaHa, row.forestCoveragePct, row.mangrove.status, topPriority(row),
        (row.recommendations || []).map(function (item) { return item.theme + ": " + item.recommendation; }).join(" | ")
      ].map(csvCell).join(","));
    });
    var blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "analisis-internal-rdtr-bagansiapiapi-2026-09-22.csv";
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function consultationText() {
    var summary = state.analysis.summary;
    var recommendations = aggregateRecommendations(state.analysis.villages);
    return [
      "POIN KONSULTASI PUBLIK I RDTR KAWASAN PERKOTAAN BAGANSIAPIAPI",
      "Bahan internal Yayasan Gambut · 22 September 2026",
      "",
      "Baseline: " + summary.villageCount + " wilayah · " + number(summary.areaHa, 1) + " ha · indikasi gambut " + number(summary.peatCoveragePct, 1) + "% · kawasan hutan non-APL " + number(summary.forestCoveragePct, 1) + "%.",
      "",
      "REKOMENDASI:",
      recommendations.map(function (row, index) { return (index + 1) + ". " + row.theme + " — " + row.recommendation; }).join("\n"),
      "",
      "PERTANYAAN KUNCI:",
      state.analysis.consultationQuestions.map(function (row, index) { return (index + 1) + ". " + row; }).join("\n"),
      "",
      "Catatan: konflik zonasi belum dapat disimpulkan sebelum geometri dan aturan zonasi draf RDTR diterima."
    ].join("\n");
  }

  async function copyPoints() {
    var button = document.getElementById("rdtr-copy-points");
    try {
      await navigator.clipboard.writeText(consultationText());
      button.textContent = "Poin sudah disalin";
    } catch (error) {
      var text = document.createElement("textarea");
      text.value = consultationText(); document.body.appendChild(text); text.select(); document.execCommand("copy"); text.remove();
      button.textContent = "Poin sudah disalin";
    }
    setTimeout(function () { button.textContent = "Salin poin konsultasi"; }, 2200);
  }

  function bind() {
    document.getElementById("rdtr-village-search").addEventListener("input", function (event) {
      var query = event.target.value.trim().toLowerCase();
      document.querySelectorAll("#rdtr-village-body tr").forEach(function (row) {
        row.hidden = Boolean(query && !String(row.dataset.villageName || "").includes(query));
      });
    });
    document.getElementById("rdtr-draft-file").addEventListener("change", function (event) {
      if (event.target.files && event.target.files[0]) loadDraft(event.target.files[0]);
      event.target.value = "";
    });
    document.getElementById("rdtr-export-csv").addEventListener("click", exportCsv);
    document.getElementById("rdtr-copy-points").addEventListener("click", copyPoints);
    document.getElementById("rdtr-print").addEventListener("click", function () { window.print(); });
  }

  function init(bootstrap) {
    if (!bootstrap || !bootstrap.analysis || state.analysis) return;
    state.analysis = bootstrap.analysis;
    renderSummary(state.analysis);
    renderReadiness(state.analysis.readiness);
    renderVillages(state.analysis.villages);
    renderRecommendations(state.analysis.villages);
    renderLegal(state.analysis.legalFramework);
    renderQuestions(state.analysis.consultationQuestions);
    initMap(state.analysis);
    bind();
  }

  if (window.YG_RDTR_BOOTSTRAP) init(window.YG_RDTR_BOOTSTRAP);
  else document.addEventListener("yg:rdtr-authorized", function () { init(window.YG_RDTR_BOOTSTRAP); }, { once: true });
})();
