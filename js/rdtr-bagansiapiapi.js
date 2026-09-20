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

  function decisionLabel(value) {
    return { hold: "Tahan", verify: "Verifikasi", conditional: "Bersyarat", revise: "Revisi" }[value] || value || "Verifikasi";
  }

  function decisionBadge(value) {
    var status = value || "verify";
    return '<span class="rdtr-decision-badge is-' + esc(status) + '">' + esc(decisionLabel(status)) + "</span>";
  }

  function statusLabel(value) {
    return {
      ready: "Siap", validated: "Tervalidasi", in_progress: "Berjalan", partial: "Sebagian",
      yg_draft: "Draf YG", draft: "Draf", blocked: "Tertahan", missing: "Belum tersedia",
      concept_only: "Konsep", pending: "Menunggu", indicative_geometry: "Geometri indikatif",
      not_started: "Belum dimulai", official: "Resmi", provisional: "Sementara",
      provisional_analytical_draft: "Rancangan analitis sementara",
      selected_provisional: "Dipilih sementara", conceptual_no_official_geometry: "Konsep tanpa geometri terotorisasi",
      not_delineated: "Belum didelineasi", candidate: "Kandidat",
      available_analytical_only: "Tersedia untuk analisis", available_for_screening: "Tersedia untuk penyaringan",
      blocked_missing_official_evidence: "Tertahan: bukti resmi belum tersedia", pending_evidence: "Menunggu bukti",
      partial_high_priority: "Sebagian · prioritas tinggi",
      blocked_no_official_zone_geometry: "Tertahan: geometri zona resmi belum tersedia",
      blocked_no_activity_scenarios: "Tertahan: skenario kegiatan belum tersedia",
      blocked_no_zone_and_population_projection: "Tertahan: zona dan proyeksi belum tersedia",
      blocked_no_zone_quality_targets: "Tertahan: target kualitas zona belum tersedia",
      scenario_framework_incomplete: "Kerangka skenario belum lengkap",
      unavailable_pending_official_draft: "Menunggu draf pemerintah terotorisasi",
      candidate_zone_families_no_official_geometry: "Kandidat tanpa geometri terotorisasi",
      framework_only_pending_official_zones: "Kerangka awal · menunggu zona resmi",
      candidate_portfolio_no_budget_or_commitment: "Portofolio kandidat · belum menjadi komitmen",
      insufficient_for_geometry: "Bukti belum cukup untuk geometri",
      framework_only: "Kerangka awal", candidate_only: "Kandidat",
      not_received: "Belum diterima",
      not_verified: "Belum terverifikasi",
      verified_available: "Terverifikasi · tersedia",
      verified_process_evidence: "Terverifikasi · bukti proses",
      historical_expired_reference: "Arsip historis · periode berakhir",
      mapped_policy_synthesis_v0: "Peta sintesis v0 terbangun",
      complete_internal_v0: "Selesai · internal v0",
      blocked_missing_p0_evidence: "Tertahan · bukti P0 belum lengkap",
      blocked_missing_klhs_and_draft: "Tertahan · KLHS dan draf belum diterima",
      pending_comparison_and_response: "Menunggu perbandingan dan respons",
      indicators_pending_complete_analysis_and_klhs: "Indikator dan sinkronisasi RTRW belum selesai",
      not_set_pending_plan_horizon_and_fiscal_analysis: "Penahapan menunggu horizon rencana dan analisis fiskal"
    }[value] || String(value || "Belum dinilai").replace(/_/g, " ");
  }

  function statusBadge(value) {
    var status = value || "pending";
    return '<span class="rdtr-status-badge is-' + esc(status) + '">' + esc(statusLabel(status)) + "</span>";
  }

  function strictestDecision(rows) {
    var rank = { revise: 4, hold: 3, conditional: 2, verify: 1 };
    return (rows || []).reduce(function (best, row) {
      return (rank[row.decision] || 0) > (rank[best] || 0) ? row.decision : best;
    }, "verify");
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
    var label = { ready: "siap", screening: "siap untuk penyaringan analitis", partial: "sebagian", missing: "belum tersedia" };
    document.getElementById("rdtr-readiness").innerHTML = (rows || []).map(function (row) {
      return '<div class="rdtr-readiness-row is-' + esc(row.status) + '"><i></i><span>' +
        esc(row.label) + "</span><small>" + esc(label[row.status] || row.status) + "</small></div>";
    }).join("");
  }

  function itemText(item) {
    if (typeof item === "string") return item;
    return item && (item.title || item.name || item.label || item.description || item.statement || item.direction || item.action) || "";
  }

  function roleLabel(value) {
    var labels = {
      candidate_primary_service_centre: "Calon pusat pelayanan utama",
      candidate_local_service_centres: "Calon pusat pelayanan lokal",
      candidate_coastal_river_livelihood_nodes: "Calon simpul penghidupan sungai–pesisir",
      safe_mobility_and_evacuation_network: "Jaringan mobilitas aman dan evakuasi",
      blue_green_hydrology_network: "Jaringan hidrologi biru–hijau",
      basic_service_network: "Jaringan layanan dasar",
      candidate_peat_ecosystem_protection_or_management: "Calon zona perlindungan/pengelolaan gambut",
      candidate_coastal_mangrove_river_protection: "Calon zona perlindungan pesisir–mangrove–sungai",
      candidate_forest_status_alignment: "Calon zona penyelarasan status kawasan hutan",
      candidate_safe_urban_consolidation: "Calon zona konsolidasi perkotaan aman",
      candidate_community_livelihood_and_production: "Calon zona penghidupan dan produksi masyarakat",
      candidate_risk_management_overlay: "Calon ketentuan khusus pengelolaan risiko",
      administrative_input_not_official_wp_geometry: "Masukan administrasi · bukan geometri WP resmi",
      analytical_unit_not_swp_or_zone: "Unit analitis · bukan SWP atau zona",
      higher_level_plan_screening_not_rdtr_zone: "Penyaringan rencana lebih tinggi · bukan zona RDTR",
      environmental_screening_not_legal_peat_function: "Penyaringan lingkungan · bukan fungsi gambut legal",
      forest_status_screening_not_rdtr_zone: "Penyaringan status kawasan hutan · bukan zona RDTR",
      official_wp_swp_block_subblock_zone_and_network_geometry: "Geometri draf pemerintah terotorisasi: WP–SWP–blok–subblok–zona–jaringan",
      official_klhs_evidence: "Bukti dan peta kerja KLHS resmi",
      candidate_ecosystem_and_hazard_areas: "Area kandidat ekosistem dan bahaya",
      coastal_protection_restoration_candidates_not_rdtr_zone: "Kandidat perlindungan/pemulihan pesisir · bukan zona RDTR",
      candidate_development_areas: "Area kandidat pengembangan",
      all_candidate_zones: "Semua calon zona",
      risk_management_special_provision: "Ketentuan khusus pengendalian risiko"
    };
    return labels[value] || String(value || "").replace(/_/g, " ");
  }

  function renderYgPlan(data) {
    var plan = data.ygPlan || {};
    var objectiveObject = typeof plan.planningObjective === "object" && plan.planningObjective || {};
    var objective = typeof plan.planningObjective === "string"
      ? plan.planningObjective
      : (objectiveObject.statement || objectiveObject.text) || "Tujuan penataan versi YG belum dirumuskan.";
    document.getElementById("rdtr-yg-plan-header").innerHTML =
      '<div><h3>' + esc(plan.title || "Rancangan Analitis RDTR versi YG") + '</h3><p>' +
      esc(plan.disclaimer || "Bahan kerja internal; bukan RDTR yang ditetapkan dan bukan pengganti kewenangan pemerintah.") +
      '</p></div><div class="rdtr-plan-meta"><span>Versi ' + esc(plan.version || "kerja") + "</span><span>" +
      esc(statusLabel(plan.status || "yg_draft")) + "</span><span>Cut-off hukum " + esc(plan.legalCutoff || "—") + "</span></div>";

    document.getElementById("rdtr-yg-objective").innerHTML = '<p class="rdtr-objective-statement">' + esc(objective) +
      '</p><div class="rdtr-objective-status">' + statusBadge(objectiveObject.measurementStatus || objectiveObject.status || "provisional") +
      "<p>" + esc(objectiveObject.qualification || "Rumusan tujuan masih sementara; indikator terukur dan keselarasan terhadap RTRW perlu diselesaikan.") +
      '</p></div><div class="rdtr-strategy-list">' + (plan.strategies || []).map(function (row, index) {
        return '<div class="rdtr-strategy"><span>' + (index + 1) + "</span><p>" + esc(itemText(row)) + "</p></div>";
      }).join("") + "</div>";

    document.getElementById("rdtr-yg-alternatives").innerHTML = (plan.alternatives || []).map(function (row) {
      var selected = Boolean(row.selected || row.status === "selected_provisional" || row.id === plan.selectedAlternativeId);
      return '<details class="rdtr-alternative' + (selected ? " is-selected" : "") + '"' + (selected ? " open" : "") +
        '><summary><strong>' + esc(row.id || "ALT") + " · " + esc(row.name || row.title || row.label) + "</strong><span>" +
        esc(selected ? "dipilih sementara" : statusLabel(row.status || "pending")) + '</span></summary><div class="rdtr-alternative-body"><p>' +
        esc(row.description || row.concept || row.summary || "") + "</p><p><strong>Penilaian YG.</strong> " +
        esc(row.assessment || row.evaluation || row.rationale || row.position || "Belum dinilai.") + "</p>" + regulationChips(row.regulationRefs || row.regulations) + "</div></details>";
    }).join("") || "<p>Alternatif konsep belum tersedia.</p>";
  }

  function renderPlanningWorkflow(data) {
    var stages = data.planningWorkflow || [];
    var stageNames = {
      "persiapan": "Persiapan",
      "pengumpulan-data-informasi": "Pengumpulan data dan informasi",
      "pengolahan-data-analisis": "Pengolahan data dan analisis",
      "perumusan-konsepsi": "Perumusan konsepsi",
      "penyusunan-rancangan-perkada": "Penyusunan rancangan perkada"
    };
    document.getElementById("rdtr-planning-workflow").innerHTML = stages.map(function (row, index) {
      var outputs = row.requiredOutputs || row.outputs || [];
      var gaps = Array.isArray(row.gaps) ? row.gaps.join("; ") : row.gaps;
      var work = Array.isArray(row.ygWork) ? row.ygWork.join("; ") : (row.ygWork || row.finding || row.description || "");
      return '<article class="rdtr-workflow-stage"><div class="rdtr-stage-top"><span class="rdtr-stage-number">' +
        (index + 1) + "</span>" + statusBadge(row.status) + "</div><h3>" + esc(row.title || row.name || row.stage || stageNames[row.id] || "Tahap penyusunan") +
        '</h3><p><strong>Kerja YG.</strong> ' + esc(work) + "</p>" +
        (gaps ? '<p><strong>Pengunci.</strong> ' + esc(gaps) + "</p>" : "") + regulationChips(row.regulationRefs || row.regulations) +
        (row.articleRef ? '<small class="rdtr-legal-ref"><strong>Dasar rinci:</strong> ' + esc(row.articleRef) + "</small>" : "") +
        (outputs.length ? "<ul>" + outputs.slice(0, 4).map(function (item) { return "<li>" + esc(itemText(item)) + "</li>"; }).join("") + "</ul>" : "") + "</article>";
    }).join("");

    var gates = data.crossCuttingGates || (data.ygPlan && data.ygPlan.crossCuttingGates) || [];
    document.getElementById("rdtr-cross-cutting-gates").innerHTML = gates.map(function (row) {
      return '<article id="gate-' + esc(row.id || "") + '" class="rdtr-gate is-' + esc(row.status || "pending") + '">' + statusBadge(row.status) + "<h4>" +
        esc(row.title || row.name || row.label) + "</h4><p>" + esc(row.requirement || row.test || row.finding || row.gap || row.description || "") +
        "</p>" + (row.evidenceRequired ? "<small><strong>Bukti yang diperlukan:</strong> " + esc(row.evidenceRequired) + "</small>" : "") +
        (row.articleRef ? '<small class="rdtr-legal-ref"><strong>Dasar rinci:</strong> ' + esc(row.articleRef) + "</small>" : "") +
        regulationChips(row.regulationRefs || row.regulations) + "</article>";
    }).join("");
  }

  function renderP0EvidenceBoard(board) {
    board = board || {};
    var items = board.items || [];
    var counts = board.statusCounts || {};
    var summaryRows = [
      { status: "verified_available", label: "Dokumen tersedia", count: counts.verified_available || 0 },
      { status: "verified_process_evidence", label: "Bukti proses", count: counts.verified_process_evidence || 0 },
      { status: "historical_expired_reference", label: "Arsip historis", count: counts.historical_expired_reference || 0 },
      { status: "not_verified", label: "Belum terverifikasi", count: counts.not_verified || 0 },
      { status: "not_received", label: "Belum diterima", count: counts.not_received || 0 }
    ];
    document.getElementById("rdtr-p0-evidence-summary").innerHTML = summaryRows.map(function (row) {
      return '<article class="rdtr-evidence-kpi is-' + esc(row.status) + '"><strong>' + esc(row.count) +
        '</strong><span>' + esc(row.label) + '</span><small>' + esc(statusLabel(row.status)) + "</small></article>";
    }).join("");
    document.getElementById("rdtr-p0-evidence-truth").innerHTML =
      '<p><strong>Kebenaran hukum sementara.</strong> ' + esc(board.legalTruth || "Belum dirumuskan.") +
      '</p><p><strong>Aturan kenaikan status.</strong> ' + esc(board.promotionRule || "Bukti wajib diverifikasi sebelum keputusan dinaikkan statusnya.") +
      '</p><small>Cut-off pemeriksaan: ' + esc(board.lastChecked || "—") + " · " + esc(board.scopeNote || "") + "</small>";
    document.getElementById("rdtr-p0-evidence-register").innerHTML = items.map(function (row) {
      var documentMeta = [row.issuer, row.documentNumber, row.documentDate, row.planningPeriod].filter(Boolean).join(" · ");
      var sources = (row.sourceLinks || []).map(function (link) {
        return '<a href="' + esc(link.url) + '" target="_blank" rel="noopener noreferrer">' + esc(link.label) + "</a>";
      }).join("");
      var analysisLinks = (row.analysisRefs || []).map(function (id) {
        return '<a href="#analysis-' + esc(id) + '">' + esc(id) + "</a>";
      }).join(" ");
      var gateLinks = (row.gateRefs || []).map(function (id) {
        return '<a href="#gate-' + esc(id) + '">' + esc(id) + "</a>";
      }).join(" ");
      return '<article id="evidence-' + esc(row.id) + '" class="rdtr-evidence-card is-' + esc(row.status || "pending") + '">' +
        '<header><div><span class="rdtr-evidence-id">' + esc(row.id) + " · " + esc(row.category || "Bukti P0") + '</span><h3>' +
        esc(row.title) + '</h3></div>' + statusBadge(row.status) + '</header><div class="rdtr-evidence-body">' +
        (documentMeta ? '<p class="rdtr-evidence-meta">' + esc(documentMeta) + "</p>" : "") +
        '<p><strong>Fungsi bukti.</strong> ' + esc(row.legalRole || "—") + '</p><p><strong>Temuan.</strong> ' + esc(row.finding || "—") +
        '</p><p class="rdtr-evidence-limit"><strong>Batas.</strong> ' + esc(row.limitation || "—") +
        '</p><p class="rdtr-evidence-action"><strong>Tindak lanjut.</strong> ' + esc(row.nextAction || "—") + "</p>" +
        '<small><strong>Sumber/status:</strong> ' + esc(row.sourceNote || "—") + "</small>" +
        (sources ? '<div class="rdtr-evidence-sources">' + sources + "</div>" : "") +
        '<div class="rdtr-evidence-refs"><span><strong>Analisis:</strong> ' + (analysisLinks || "—") +
        '</span><span><strong>Gerbang:</strong> ' + (gateLinks || "—") + "</span></div></div></article>";
    }).join("");
  }

  function renderPolicyMapFramework(framework) {
    framework = framework || {};
    var layers = framework.layers || [];
    document.getElementById("rdtr-policy-map-header").innerHTML =
      '<div><h3>' + esc(framework.title || "Peta Sintesis Kebijakan") + '</h3><p>' +
      esc(framework.purpose || "Geometri argumen internal berbasis kajian kebijakan.") +
      '</p><small>' + esc(framework.disclaimer || "Bukan peta RDTR yang ditetapkan.") +
      '</small></div><div class="rdtr-plan-meta"><span>' + esc(framework.version || "v0") +
      '</span><span>' + esc(statusLabel(framework.status)) + '</span><span>Cut-off ' + esc(framework.legalCutoff || "—") + "</span></div>";
    document.getElementById("rdtr-policy-layer-summary").innerHTML = layers.map(function (row) {
      var analysisLinks = (row.analysisRefs || []).map(function (id) {
        return '<a href="#analysis-' + esc(id) + '">' + esc(id) + "</a>";
      }).join(" ");
      return '<article class="rdtr-policy-layer-card" style="--policy-color:' + esc(row.color || "#176c8c") + '"><header><div><span>' +
        esc(row.id) + '</span><h3>' + esc(row.title) + '</h3></div>' + decisionBadge(row.decision) +
        '</header><div class="rdtr-policy-layer-metrics"><strong>' + number(row.grossAreaHa, 1) +
        ' ha</strong><span>' + number(row.featureCount, 0) + ' geometri</span><span>Keyakinan: ' +
        esc(String(row.confidence || "—").replace(/_/g, " ")) + '</span></div><p>' + esc(row.policyDirection) +
        '</p><div class="rdtr-policy-requirements"><strong>Syarat promosi:</strong><ul>' +
        (row.promotionRequirements || []).map(function (item) { return '<li>' + esc(item) + '</li>'; }).join("") +
        '</ul></div><small class="rdtr-trace-links"><strong>Analisis:</strong> ' + (analysisLinks || "—") +
        '</small>' + regulationChips(row.regulationRefs) + "</article>";
    }).join("");
    document.getElementById("rdtr-policy-map-rule").innerHTML =
      '<p><strong>Cara membaca.</strong> ' + esc(framework.readingRule || "Layer dapat bertumpang tindih.") +
      '</p><p><strong>Aturan keputusan.</strong> ' + esc(framework.decisionRule || "Setiap keputusan mengikuti kematangan bukti.") + "</p>";
    document.getElementById("rdtr-policy-map-stages").innerHTML = (framework.completionStages || []).map(function (row, index) {
      return '<article class="rdtr-policy-stage is-' + esc(row.status || "pending") + '"><header><span>' +
        (index + 1) + '</span>' + statusBadge(row.status) + '</header><h4>' + esc(row.title) +
        '</h4><p>' + esc(row.output || "") + '</p>' + ((row.requirements || []).length
          ? '<small><strong>Pengunci:</strong> ' + esc(row.requirements.join("; ")) + '</small>' : "") + "</article>";
    }).join("");
  }

  function planItem(row) {
    var code = row.id || row.code || "";
    var detail = row.proposal || row.description || row.function || row.direction || row.rule || row.action || row.rationale || "";
    var geometry = row.geometryStatus || row.locationStatus || row.maturity || row.status;
    var evidence = row.evidenceStatus || row.prerequisite || row.gap || row.validation || "";
    return '<article class="rdtr-plan-item"><header><h4>' + (code ? esc(code) + " · " : "") +
      esc(row.name || row.title || row.theme || roleLabel(row.role || row.scope) || row.type || "Komponen rencana") + "</h4>" + statusBadge(geometry || "concept_only") +
      "</header><p>" + esc(detail) + "</p>" + regulationChips(row.regulationRefs || row.regulations) +
      (evidence ? "<small><strong>Prasyarat/batas:</strong> " + esc(evidence) + "</small>" : "") + "</article>";
  }

  function renderPlanComponents(plan) {
    plan = plan || {};
    var structure = plan.structurePlan || {};
    var structureItems = [];
    (structure.centres || structure.centers || []).forEach(function (row) { structureItems.push(Object.assign({ type: "Pusat pelayanan" }, row)); });
    (structure.networks || []).forEach(function (row) { structureItems.push(Object.assign({ type: "Jaringan" }, row)); });
    document.getElementById("rdtr-structure-plan").innerHTML = '<div class="rdtr-plan-items">' + structureItems.map(planItem).join("") + "</div>";

    var pattern = plan.patternPlan || {};
    var patternRows = pattern.zones || pattern.items || [];
    var protectedRows = patternRows.filter(function (row) { return row.patternCategory === "protected_candidate"; });
    var cultivationRows = patternRows.filter(function (row) { return row.patternCategory === "cultivation_candidate"; });
    var uncategorizedRows = patternRows.filter(function (row) { return !row.patternCategory; });
    function patternGroup(title, rows) {
      return rows.length ? '<section class="rdtr-plan-group"><h4 class="rdtr-plan-group-label">' + esc(title) +
        '</h4><div class="rdtr-plan-items">' + rows.map(planItem).join("") + "</div></section>" : "";
    }
    document.getElementById("rdtr-pattern-plan").innerHTML =
      patternGroup("Calon zona lindung", protectedRows) + patternGroup("Calon zona budi daya", cultivationRows) +
      patternGroup("Klasifikasi menunggu verifikasi", uncategorizedRows);
    var zoning = plan.zoningRules || {};
    var zoningRows = Array.isArray(zoning) ? zoning : (zoning.rules || []);
    var numericPending = !Array.isArray(zoning) && zoning.numericIntensityParameters &&
      Object.keys(zoning.numericIntensityParameters).every(function (key) { return zoning.numericIntensityParameters[key] == null; });
    document.getElementById("rdtr-zoning-rules").innerHTML = (numericPending
      ? '<p class="rdtr-component-note"><strong>Angka intensitas belum ditetapkan.</strong> KDB, KLB, KDH, tinggi, kepadatan, dan sempadan menunggu bukti teknis.</p>'
      : "") + '<div class="rdtr-plan-items">' + zoningRows.map(planItem).join("") + "</div>";
    var programs = plan.programs || {};
    var programRows = Array.isArray(programs) ? programs : (programs.items || []);
    document.getElementById("rdtr-programs").innerHTML = (!Array.isArray(programs)
      ? '<div class="rdtr-program-status">' + statusBadge(programs.status) + statusBadge(programs.phasingStatus) +
        '<p>Program belum memiliki lokasi final, penahapan lima tahunan, pelaksana, pembiayaan, atau komitmen anggaran.</p></div>'
      : "") + '<div class="rdtr-plan-items">' +
      programRows.map(planItem).join("") + "</div>";

    document.getElementById("rdtr-plan-traceability").innerHTML = (plan.traceability || []).map(function (row) {
      return '<article class="rdtr-trace-item"><header><strong>' + esc(row.planComponentRef || row.id) + "</strong>" +
        statusBadge(row.evidenceStatus || "pending") + '</header><p>' + esc(row.decision || "Belum ada keputusan.") +
        '</p><small class="rdtr-trace-links"><strong>Analisis:</strong> ' + ((row.analysisRefs || []).map(function (id) {
          return '<a href="#analysis-' + esc(id) + '">' + esc(id) + "</a>";
        }).join(" ") || "—") + "</small>" + regulationChips(row.regulationRefs) + "</article>";
    }).join("");
  }

  function analysisList(title, items) {
    if (!items || !items.length) return "";
    return '<section class="rdtr-analysis-block"><h4>' + esc(title) + "</h4><ul>" + items.map(function (item) {
      return "<li>" + esc(item) + "</li>";
    }).join("") + "</ul></section>";
  }

  function priorityBadge(value) {
    var labels = { P0: "P0 · pengunci", P1: "P1 · pendukung", P2: "P2 · pemrograman" };
    return '<span class="rdtr-priority-badge is-' + esc(String(value || "P1").toLowerCase()) + '">' + esc(labels[value] || value || "P1") + "</span>";
  }

  function renderAnalysisProgramme(programme, rows) {
    programme = programme || {};
    var statusCounts = (rows || []).reduce(function (counts, row) {
      var key = String(row.status || "pending").indexOf("blocked") === 0 ? "blocked" : row.status;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
    document.getElementById("rdtr-analysis-programme").innerHTML =
      '<div class="rdtr-analysis-programme-copy"><strong>Urutan kerja analisis YG</strong><p>' + esc(programme.rule || "P0 mengunci geometri dan keputusan; P1 melengkapi analisis; P2 mematangkan program.") +
      '</p><small><strong>Aturan kenaikan status:</strong> ' + esc(programme.promotionRule || "Keputusan tidak dinaikkan sebelum prasyarat buktinya terpenuhi.") + "</small></div>" +
      '<div class="rdtr-analysis-counts">' + (programme.priorities || []).map(function (row) {
        return '<span class="is-' + esc(String(row.priority).toLowerCase()) + '"><strong>' + esc(row.count) + "</strong> " + esc(row.priority) + "</span>";
      }).join("") + '<span><strong>' + esc(statusCounts.blocked || 0) + "</strong> tertahan</span><span><strong>" +
      esc((statusCounts.not_started || 0)) + "</strong> belum dimulai</span></div>" +
      '<div class="rdtr-critical-path"><strong>Jalur kritis:</strong> ' + (programme.criticalPath || []).map(function (id) {
        return '<a href="#analysis-' + esc(id) + '">' + esc(id) + "</a>";
      }).join(" ") + "</div>";
  }

  function analysisMatches(row, query, priority, status) {
    var text = [row.id, row.category, row.workstream, row.analysisQuestion, row.finding, row.nextStep]
      .concat(row.requiredData || [], row.method || [], row.outputs || [], row.evidenceGaps || [])
      .join(" ").toLowerCase();
    var statusMatch = !status || (status === "blocked" ? String(row.status).indexOf("blocked") === 0 : row.status === status);
    return (!query || text.indexOf(query) >= 0) && (!priority || row.priority === priority) && statusMatch;
  }

  function renderAnalysisMatrix(rows) {
    var queryField = document.getElementById("rdtr-analysis-search");
    var priorityField = document.getElementById("rdtr-analysis-priority");
    var statusField = document.getElementById("rdtr-analysis-status");
    var query = queryField ? queryField.value.trim().toLowerCase() : "";
    var priority = priorityField ? priorityField.value : "";
    var status = statusField ? statusField.value : "";
    var filtered = (rows || []).filter(function (row) { return analysisMatches(row, query, priority, status); });
    document.getElementById("rdtr-analysis-matrix").innerHTML = filtered.map(function (row) {
      return '<details id="analysis-' + esc(row.id || row.letter || "") + '" class="rdtr-analysis-item"><summary><span><strong>' + esc(row.id || row.letter || "") + " · " +
        esc(row.title || row.name || row.analysis || row.category) + '</strong><small>' + esc(row.workstream || "") + '</small></span><span class="rdtr-analysis-badges">' +
        priorityBadge(row.priority) + statusBadge(row.status) + '</span></summary><div class="rdtr-analysis-item-body">' +
        '<p class="rdtr-analysis-question"><strong>Pertanyaan analisis.</strong> ' + esc(row.analysisQuestion || "Belum dirumuskan.") + "</p>" +
        '<p><strong>Temuan YG saat ini.</strong> ' + esc(row.finding || row.ygFinding || "Belum dianalisis.") + "</p>" +
        '<div class="rdtr-analysis-columns">' + analysisList("Data minimum", row.requiredData) + analysisList("Metode", row.method) +
        analysisList("Keluaran wajib", row.outputs) + analysisList("Bukti yang sudah tersedia", row.availableEvidence) +
        analysisList("Kesenjangan bukti", row.evidenceGaps) + "</div>" +
        '<div class="rdtr-analysis-decision"><p><strong>Kaitan geometri.</strong> ' + esc(row.geometryLink || "Belum dirumuskan.") +
        '</p><p><strong>Penggunaan keputusan.</strong> ' + esc(row.decisionUse || "Belum dirumuskan.") + "</p></div>" +
        '<p><strong>Langkah kerja YG.</strong> ' + esc(row.nextStep || row.gap || row.validation || "Tetapkan metode dan bukti.") + "</p>" +
        '<p class="rdtr-consultation-prompt"><strong>Pertanyaan konsultasi.</strong> ' + esc(row.consultationPrompt || "Minta bukti dan metode yang dapat ditelusuri.") + "</p>" +
        (row.articleRef ? '<small class="rdtr-legal-ref"><strong>Dasar rinci:</strong> ' + esc(row.articleRef) + "</small>" : "") +
        regulationChips(row.regulationRefs || row.regulations) + "</div></details>";
    }).join("") || '<p class="rdtr-analysis-empty">Tidak ada analisis yang cocok dengan penyaring.</p>';
  }

  function renderGeometryRegistry(rows) {
    var target = document.getElementById("rdtr-geometry-registry");
    target.innerHTML = "<h3>Status geometri analitis</h3>" + (rows || []).map(function (row) {
      return '<div class="rdtr-geometry-row"><div><strong>' + esc(row.name || row.title || row.id) + "</strong><small>" +
        esc(roleLabel(row.role || row.objectType)) + (row.scale ? " · skala " + esc(row.scale) : "") +
        (row.source ? " · Sumber: " + esc(row.source) : "") +
        (row.limitation ? " · " + esc(row.limitation) : "") +
        (row.permittedUse ? " · Penggunaan: " + esc(row.permittedUse) : "") + "</small></div>" + statusBadge(row.maturity || row.status) + "</div>";
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
      "<td><strong>" + number(row.forestCoveragePct, 1) + "%</strong><small>" + number(row.forestAreaHa, 1) + " ha indikatif non-APL</small></td>" +
      "<td><strong>" + esc(mangroveText) + "</strong><small>" + esc(mangroveSmall) + "</small></td>" +
      "<td>" + decisionBadge(strictestDecision(row.regulatoryAssessments)) + "</td>" +
      '<td><button class="rdtr-open-analysis" type="button" data-village-id="' + esc(row.id) + '">Buka analisis</button></td></tr>';
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
        (row.villages.length === state.analysis.summary.villageCount ? "seluruh unit kajian YG" : esc(row.villages.join(", "))) +
        "</small></article>";
    }).join("");
  }

  function renderPosition(data) {
    var position = data.analysisPosition || {};
    document.getElementById("rdtr-position").innerHTML = "<h3>" + esc(position.title || "Posisi awal Yayasan Gambut") +
      "</h3><p>" + esc(position.statement || "Analisis regulasi belum tersedia.") + "</p>" +
      '<p class="rdtr-position-caveat"><strong>Batas kesimpulan.</strong> ' + esc(position.caveat || "Kesimpulan wajib diverifikasi dengan dokumen resmi.") + "</p>";
    document.getElementById("rdtr-decision-classes").innerHTML = (data.decisionClasses || []).map(function (row) {
      return '<article class="rdtr-decision-card is-' + esc(row.id) + '"><strong>' + esc(row.label) + "</strong><span>" +
        esc(row.meaning) + "</span><span><b>Tindakan:</b> " + esc(row.action) + "</span></article>";
    }).join("");
  }

  function regulationChips(codes) {
    return '<div class="rdtr-reg-links">' + (codes || []).map(function (code) {
      return '<a class="rdtr-reg-link" href="#regulation-' + esc(code) + '">' + esc(code) + "</a>";
    }).join("") + "</div>";
  }

  function renderRegulatoryAssessments(rows) {
    document.getElementById("rdtr-regulatory-assessments").innerHTML = (rows || []).map(function (row) {
      return '<article class="rdtr-assessment"><header><div><h3>' + esc(row.theme) +
        '</h3><span class="rdtr-assessment-id">' + esc(row.id) + " · keyakinan " + esc(row.confidence) +
        "</span></div>" + decisionBadge(row.decision) + '</header><div class="rdtr-assessment-body">' +
        '<p><strong>Temuan YG.</strong> ' + esc(row.finding) + "</p>" + regulationChips(row.regulations) +
        '<p><strong>Kewajiban regulasi.</strong> ' + esc(row.requirement) + "</p>" +
        '<p><strong>Posisi YG.</strong> ' + esc(row.ygPosition) + "</p>" +
        '<p><strong>Batas validasi.</strong> ' + esc(row.validation) + "</p></div></article>";
    }).join("");
  }

  function renderVillageAnalysis(villageId) {
    var row = (state.analysis.villages || []).find(function (item) { return item.id === villageId; });
    if (!row) return;
    var tests = row.regulatoryAssessments || [];
    document.getElementById("rdtr-village-analysis").innerHTML =
      '<div class="rdtr-village-analysis-heading"><div><h3>Analisis regulasi · ' + esc(row.name) +
      "</h3><p>" + number(row.areaHa, 1) + " ha · " + tests.length + " uji tematik</p></div>" +
      decisionBadge(strictestDecision(tests)) + '</div><div class="rdtr-village-analysis-grid">' +
      tests.map(function (test) {
        return '<article class="rdtr-village-test"><header><h4>' + esc(test.theme) + "</h4>" +
          decisionBadge(test.decision) + "</header><p><strong>Temuan.</strong> " + esc(test.finding) + "</p>" +
          regulationChips(test.regulations) + '<p><strong>Posisi YG.</strong> ' + esc(test.position) + "</p></article>";
      }).join("") + "</div>";
    document.getElementById("rdtr-village-analysis").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function regulationCard(row) {
    var search = [row.code, row.title, row.status, row.obligation, row.ygTest].join(" ").toLowerCase();
    return '<details id="regulation-' + esc(row.id) + '" class="rdtr-regulation-card" data-scope="' + esc(row.scope) + '" data-search="' + esc(search) + '"><summary><div><h3>' +
      esc(row.code) + "<span>" + esc(row.title) + '</span></h3><div class="rdtr-regulation-meta"><span>' +
      esc(row.scope) + "</span><span>" + esc(row.status) + '</span></div></div></summary><div class="rdtr-regulation-body"><p><strong>Kewajiban relevan.</strong> ' +
      esc(row.obligation) + '</p><p><strong>Cara YG menguji.</strong> ' + esc(row.ygTest) + "</p>" +
      ((row.officialUrls || [{ label: "Buka sumber resmi", url: row.officialUrl }]).map(function (link) {
        return '<a href="' + esc(link.url) + '" target="_blank" rel="noopener noreferrer">' + esc(link.label) + " ↗</a>";
      }).join(" · ")) + "</div></details>";
  }

  function renderRegulationRegister(rows) {
    document.getElementById("rdtr-regulation-register").innerHTML = (rows || []).map(regulationCard).join("");
  }

  function filterRegulations() {
    var query = document.getElementById("rdtr-regulation-search").value.trim().toLowerCase();
    var scope = document.getElementById("rdtr-regulation-scope").value;
    document.querySelectorAll(".rdtr-regulation-card").forEach(function (card) {
      card.hidden = Boolean((query && !String(card.dataset.search || "").includes(query)) || (scope && card.dataset.scope !== scope));
    });
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

  function policyLayer(framework, id) {
    return ((framework && framework.layers) || []).find(function (row) { return row.id === id; }) || {};
  }

  function policyLayerPopup(title, sourceProperties, policy) {
    return popup(title, Object.assign({}, sourceProperties, {
      "Posisi YG": decisionLabel(policy.decision),
      "Arahan kebijakan": policy.policyDirection,
      "Syarat promosi": (policy.promotionRequirements || []).join("; "),
      "Hipotesis pola ruang": policy.patternHypothesis,
      "Keyakinan": String(policy.confidence || "—").replace(/_/g, " "),
      "Batas penggunaan": "Geometri argumen internal; bukan zona/subzona RDTR dan bukan dasar KKPR."
    }));
  }

  function featureContainsPoint(feature, point) {
    try {
      return Boolean(feature && feature.geometry && /Polygon/.test(feature.geometry.type) &&
        turf.booleanPointInPolygon(point, feature));
    } catch (error) {
      return false;
    }
  }

  function uniqueValues(values) {
    return Array.from(new Set((values || []).filter(Boolean)));
  }

  function inspectPolicyLocation(data, latlng) {
    var target = document.getElementById("rdtr-policy-inspector");
    if (!target) return;
    var point = turf.point([latlng.lng, latlng.lat]);
    var studyFeature = ((data.map && data.map.studyArea && data.map.studyArea.features) || []).find(function (feature) {
      return featureContainsPoint(feature, point);
    });
    var coordinate = Number(latlng.lat).toFixed(5) + ", " + Number(latlng.lng).toFixed(5);
    if (!studyFeature) {
      target.innerHTML = '<header><div><strong>Inspektur kebijakan lokasi</strong><small>' + esc(coordinate) +
        '</small></div>' + decisionBadge("verify") + '</header><p><strong>Di luar 11 unit kajian YG.</strong> ' +
        'Titik ini tidak dinilai oleh peta sintesis kebijakan Bagansiapiapi.</p>';
      return;
    }

    var framework = data.policyMapFramework || {};
    var policyHits = (framework.layers || []).filter(function (policy) {
      var mapKey = String(policy.mapRef || "").split(".").pop();
      var collection = data.map && data.map[mapKey];
      return ((collection && collection.features) || []).some(function (feature) {
        return featureContainsPoint(feature, point);
      });
    });
    var rtrwClasses = uniqueValues(((data.map && data.map.rtrw && data.map.rtrw.features) || []).filter(function (feature) {
      return featureContainsPoint(feature, point);
    }).map(function (feature) {
      return (feature.properties || {}).class;
    }));
    var draftZones = uniqueValues(((state.draft && state.draft.features) || []).filter(function (feature) {
      return featureContainsPoint(feature, point);
    }).map(function (feature) {
      return (feature.properties || {})._ygZone;
    }));
    var requirements = uniqueValues(policyHits.reduce(function (items, policy) {
      return items.concat(policy.promotionRequirements || []);
    }, []));
    var regulationRefs = uniqueValues(policyHits.reduce(function (items, policy) {
      return items.concat(policy.regulationRefs || []);
    }, []));
    var props = studyFeature.properties || {};
    var village = props.WADMKD || props.NAMOBJ || "Unit kajian YG";
    var context = '<div class="rdtr-policy-inspector-context"><span><strong>Lokasi:</strong> ' + esc(village) +
      '</span><span><strong>Koordinat:</strong> ' + esc(coordinate) + '</span><span><strong>RTRW Riau:</strong> ' +
      esc(rtrwClasses.join(" · ") || "tidak terbaca pada titik") + '</span><span><strong>Zona draf lokal:</strong> ' +
      esc(draftZones.join(" · ") || (state.draft ? "tidak beririsan" : "belum dimuat")) + '</span></div>';

    if (!policyHits.length) {
      target.innerHTML = '<header><div><strong>Inspektur kebijakan lokasi</strong><small>0 dari 3 layer arahan beririsan</small></div>' +
        decisionBadge("verify") + '</header>' + context +
        '<p><strong>Belum dapat dinyatakan layak dikembangkan.</strong> Tidak ada indikasi pada tiga layer kebijakan v0, tetapi ' +
        'RTRW kabupaten, batas WP, KLHS, bahaya, layanan, penggunaan lahan, dan tenurial belum lengkap.</p>';
      return;
    }

    target.innerHTML = '<header><div><strong>Inspektur kebijakan lokasi</strong><small>' + esc(policyHits.length) +
      ' dari 3 layer arahan beririsan</small></div>' + decisionBadge(strictestDecision(policyHits)) + '</header>' + context +
      '<div class="rdtr-policy-inspector-hits">' + policyHits.map(function (policy) {
        return '<article><strong>' + esc(policy.title) + '</strong><p>' + esc(policy.policyDirection) + '</p></article>';
      }).join("") + '</div><div class="rdtr-policy-inspector-gates"><strong>Pengunci sebelum status dapat dinaikkan:</strong><ul>' +
      requirements.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join("") + '</ul></div>' +
      regulationChips(regulationRefs) +
      '<small class="rdtr-policy-inspector-limit">Hasil titik adalah penyaringan internal, bukan penetapan zona/subzona atau dasar KKPR.</small>';
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
    var peatPolicy = policyLayer(data.policyMapFramework, "PM-YG-PEAT");
    var forestPolicy = policyLayer(data.policyMapFramework, "PM-YG-FOREST");
    var coastPolicy = policyLayer(data.policyMapFramework, "PM-YG-COAST");
    state.layers.peat = L.geoJSON(data.map.peat, {
      renderer: L.canvas({ padding: .5 }),
      style: { color: peatPolicy.color || "#8b3a72", weight: 1.4, fillColor: peatPolicy.color || "#8b3a72", fillOpacity: .23 },
      onEachFeature: function (feature, layer) { layer.bindPopup(policyLayerPopup("Arahan YG · indikasi gambut", {
        "Kelas": feature.properties.peatClass,
        "Ketebalan": feature.properties.thickness,
        "Tahun sumber": feature.properties.year
      }, peatPolicy)); }
    }).addTo(map);
    state.layers.forest = L.geoJSON(data.map.forest, {
      renderer: L.canvas({ padding: .5 }),
      style: { color: forestPolicy.color || "#287047", weight: 1.4, dashArray: "7 3", fillColor: forestPolicy.color || "#287047", fillOpacity: .18 },
      onEachFeature: function (feature, layer) { layer.bindPopup(policyLayerPopup("Arahan YG · indikasi non-APL", {
        "Fungsi sumber": feature.properties.function
      }, forestPolicy)); }
    }).addTo(map);
    if (data.map.mangroveCandidates) {
      state.layers.mangroveCandidates = L.geoJSON(data.map.mangroveCandidates, {
        renderer: L.canvas({ padding: .5 }),
        style: { color: coastPolicy.color || "#176c8c", weight: 1.6, fillColor: coastPolicy.color || "#176c8c", fillOpacity: .28 },
        onEachFeature: function (feature, layer) {
          var props = feature.properties || {};
          layer.bindPopup(policyLayerPopup("Arahan YG · kandidat pesisir", {
            "ID poligon": props.polygonId,
            "Wilayah": props.village,
            "Prioritas": [props.priorityClass, props.priorityLabel].filter(Boolean).join(" · "),
            "Skor": props.priorityScore,
            "Aksi analitis": props.recommendedAction,
            "Metode": props.methodVersion
          }, coastPolicy));
        }
      }).addTo(map);
    }
    state.layers.study = L.geoJSON(data.map.studyArea, {
      style: { color: "#123f38", weight: 2.5, fillOpacity: .02 },
      onEachFeature: function (feature, layer) {
        var props = feature.properties || {};
        layer.bindTooltip(props.WADMKD || props.NAMOBJ || "Unit kajian YG");
      }
    }).addTo(map);
    if (data.map.ygPlanningUnits) {
      state.layers.ygUnits = L.geoJSON(data.map.ygPlanningUnits, {
        renderer: L.canvas({ padding: .5 }),
        style: function (feature) {
          var colors = { high: "#b43a32", medium: "#b87518", review: "#176c8c" };
          var color = colors[feature.properties.screeningPriority] || "#176c8c";
          return { color: color, weight: 2, dashArray: "5 4", fillColor: color, fillOpacity: .03 };
        },
        onEachFeature: function (feature, layer) {
          var priority = { high: "Tinggi", medium: "Menengah", review: "Perlu ditinjau" }[feature.properties.screeningPriority] || "Perlu ditinjau";
          var constraint = { high: "Tinggi (penyaringan)", moderate: "Menengah (penyaringan)", evidence_gap: "Bukti belum cukup" }[feature.properties.knownConstraintBand] || "Belum dinilai";
          layer.bindPopup(popup("Unit penyaringan YG · bukan SWP/zona", {
            "Wilayah": feature.properties.name,
            "Prioritas penyaringan": priority,
            "Kendala terpetakan": constraint,
            "Dasar kendala": feature.properties.knownConstraintBasis,
            "Risiko belum terselesaikan": feature.properties.unresolvedRisk,
            "Kesesuaian pengembangan": "Belum ditentukan; menunggu analisis P0",
            "Arah sementara": feature.properties.direction,
            "Peran": roleLabel(feature.properties.role),
            "Batas interpretasi": feature.properties.screeningInterpretation,
            "Batas penggunaan": feature.properties.disclaimer
          }));
        }
      }).addTo(map);
    }
    var overlays = {
      "Batas 11 wilayah": state.layers.study,
      "RTRW Riau": state.layers.rtrw,
      "Arahan YG · tahan intensifikasi gambut": state.layers.peat,
      "Arahan YG · verifikasi non-APL": state.layers.forest
    };
    if (state.layers.mangroveCandidates) overlays["Arahan YG · perlindungan/pemulihan pesisir"] = state.layers.mangroveCandidates;
    if (state.layers.ygUnits) overlays["Unit penyaringan YG · bukan zonasi"] = state.layers.ygUnits;
    state.layerControl = L.control.layers({ "Peta jalan": road, "Citra satelit": satellite }, overlays, {
      collapsed: false
    }).addTo(map);
    map.fitBounds(state.layers.study.getBounds(), { padding: [18, 18] });
    map.on("click", function (event) { inspectPolicyLocation(data, event.latlng); });
    document.getElementById("rdtr-map-status").textContent = "Peta sintesis kebijakan v0 siap · layer dapat bertumpang tindih";
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
    var header = ["Wilayah", "Luas_ha", "Arahan_RTRW_terluas", "RTRW_ha", "Gambut_ha", "Gambut_persen", "Kawasan_hutan_ha", "Kawasan_hutan_persen", "Mangrove_status", "Posisi_awal", "Uji_regulasi", "Rekomendasi"];
    var lines = [header.map(csvCell).join(",")];
    state.analysis.villages.forEach(function (row) {
      var top = (row.rtrwCoverage || [])[0] || {};
      lines.push([
        row.name, row.areaHa, top.name || "", top.areaHa || "", row.peatAreaHa, row.peatCoveragePct,
        row.forestAreaHa, row.forestCoveragePct, row.mangrove.status, decisionLabel(strictestDecision(row.regulatoryAssessments)),
        (row.regulatoryAssessments || []).map(function (item) {
          return "[" + decisionLabel(item.decision) + "] " + item.theme + " — " + item.position + " (" + (item.regulations || []).join("; ") + ")";
        }).join(" | "),
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

  function exportAnalysisCsv() {
    var header = ["ID", "Pasal", "Prioritas", "Alur_kerja", "Analisis", "Status", "Pertanyaan_analisis", "Data_minimum", "Metode", "Keluaran", "Bukti_tersedia", "Kesenjangan_bukti", "Kaitan_geometri", "Penggunaan_keputusan", "Langkah_YG", "Pertanyaan_konsultasi", "Referensi_regulasi"];
    var lines = [header.map(csvCell).join(",")];
    (state.analysis.mandatoryAnalysisMatrix || []).forEach(function (row) {
      lines.push([
        row.id, row.articleRef, row.priority, row.workstream, row.category, statusLabel(row.status), row.analysisQuestion,
        (row.requiredData || []).join(" | "), (row.method || []).join(" | "), (row.outputs || []).join(" | "),
        (row.availableEvidence || []).join(" | "), (row.evidenceGaps || []).join(" | "), row.geometryLink,
        row.decisionUse, row.nextStep, row.consultationPrompt, (row.regulationRefs || []).join(" | ")
      ].map(csvCell).join(","));
    });
    var blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "matriks-21-analisis-rdtr-bagansiapiapi-internal.csv";
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function exportEvidenceCsv() {
    var header = ["ID", "Kategori", "Status", "Kelas_bukti", "Akses", "Judul", "Penerbit", "Nomor", "Tanggal", "Periode", "Fungsi_bukti", "Temuan", "Batas", "Tindak_lanjut", "Sumber_status", "Analisis", "Gerbang", "Tautan_resmi"];
    var lines = [header.map(csvCell).join(",")];
    var board = state.analysis.p0EvidenceBoard || {};
    (board.items || []).forEach(function (row) {
      lines.push([
        row.id, row.category, statusLabel(row.status), row.evidenceClass, row.access, row.title, row.issuer,
        row.documentNumber, row.documentDate, row.planningPeriod, row.legalRole, row.finding, row.limitation,
        row.nextAction, row.sourceNote, (row.analysisRefs || []).join(" | "), (row.gateRefs || []).join(" | "),
        (row.sourceLinks || []).map(function (link) { return link.label + ": " + link.url; }).join(" | ")
      ].map(csvCell).join(","));
    });
    var blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "register-bukti-p0-rdtr-bagansiapiapi-internal.csv";
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function consultationText() {
    var summary = state.analysis.summary;
    var recommendations = aggregateRecommendations(state.analysis.villages);
    return [
      "POIN KONSULTASI PUBLIK RDTR KAWASAN PERKOTAAN BAGANSIAPIAPI",
      "Bahan internal Yayasan Gambut · 22 September 2026",
      "",
      "Baseline: " + summary.villageCount + " wilayah · " + number(summary.areaHa, 1) + " ha · indikasi gambut " + number(summary.peatCoveragePct, 1) + "% · indikasi non-APL " + number(summary.forestCoveragePct, 1) + "%.",
      "",
      "REKOMENDASI:",
      recommendations.map(function (row, index) { return (index + 1) + ". " + row.theme + " — " + row.recommendation; }).join("\n"),
      "",
      "PERTANYAAN KUNCI:",
      state.analysis.consultationQuestions.map(function (row, index) { return (index + 1) + ". " + row; }).join("\n"),
      "",
      "PERTANYAAN ANALISIS P0:",
      (state.analysis.mandatoryAnalysisMatrix || []).filter(function (row) { return row.priority === "P0"; }).map(function (row, index) {
        return (index + 1) + ". [" + row.id + "] " + row.consultationPrompt;
      }).join("\n"),
      "",
      "BUKTI P0 YANG BELUM DITERIMA/TERVERIFIKASI:",
      ((state.analysis.p0EvidenceBoard && state.analysis.p0EvidenceBoard.items) || []).filter(function (row) {
        return row.status === "not_received" || row.status === "not_verified";
      }).map(function (row, index) {
        return (index + 1) + ". [" + row.id + "] " + row.title + " — " + row.nextAction;
      }).join("\n"),
      "",
      "KESIMPULAN ANALISIS REGULASI:",
      (state.analysis.regulatoryAssessments || []).map(function (row, index) {
        return (index + 1) + ". [" + decisionLabel(row.decision) + "] " + row.theme + " — " + row.ygPosition;
      }).join("\n"),
      "",
      "Catatan: konflik zonasi belum dapat disimpulkan sebelum geometri dan aturan zonasi draf RDTR diterima."
    ].join("\n");
  }

  function analysisText() {
    var plan = state.analysis.ygPlan || {};
    var position = state.analysis.analysisPosition || {};
    var evidenceBoard = state.analysis.p0EvidenceBoard || {};
    var objective = typeof plan.planningObjective === "string"
      ? plan.planningObjective
      : (plan.planningObjective && (plan.planningObjective.statement || plan.planningObjective.text)) || "Belum dirumuskan.";
    var selected = (plan.alternatives || []).find(function (row) {
      return row.selected || row.status === "selected_provisional" || row.id === plan.selectedAlternativeId;
    });
    var structure = plan.structurePlan || {};
    var structureItems = (structure.centres || structure.centers || []).concat(structure.networks || []);
    var pattern = plan.patternPlan || {};
    function numbered(rows) {
      return (rows || []).map(function (row, index) {
        return (index + 1) + ". " + (row.name || row.title || row.theme || row.id || "Komponen") + " — " +
          (row.proposal || row.description || row.function || row.direction || row.rule || row.action || row.rationale || "");
      }).join("\n");
    }
    return [
      "RANCANGAN ANALITIS RDTR BAGANSIAPIAPI — VERSI YG",
      "Bahan internal · bukan RDTR yang ditetapkan · versi " + (plan.version || "kerja") + " · cut-off hukum " + (plan.legalCutoff || "20 September 2026"),
      "",
      plan.disclaimer || position.statement || "Analisis ini tidak menggantikan kewenangan pemerintah dalam menyusun dan menetapkan RDTR.",
      "",
      "TUJUAN PENATAAN",
      objective,
      "Status tujuan: " + statusLabel(plan.planningObjective && plan.planningObjective.measurementStatus) + ". " +
        ((plan.planningObjective && plan.planningObjective.qualification) || "Indikator terukur dan keselarasan RTRW masih harus diselesaikan."),
      "",
      "ALTERNATIF TERPILIH SEMENTARA",
      selected ? (selected.id + " · " + (selected.name || selected.title || selected.label) + " — " + (selected.description || selected.concept || selected.summary || "")) : "Belum dipilih.",
      "",
      "RENCANA STRUKTUR RUANG",
      numbered(structureItems) || "Belum dirumuskan.",
      "",
      "RENCANA POLA RUANG",
      numbered(pattern.zones || pattern.items) || "Belum dirumuskan.",
      "",
      "ARAHAN PERATURAN ZONASI",
      numbered(Array.isArray(plan.zoningRules) ? plan.zoningRules : (plan.zoningRules && plan.zoningRules.rules)) || "Belum dirumuskan.",
      "",
      "PROGRAM PEMANFAATAN RUANG",
      numbered(Array.isArray(plan.programs) ? plan.programs : (plan.programs && plan.programs.items)) || "Belum dirumuskan.",
      "",
      "KENDALI BUKTI P0",
      evidenceBoard.legalTruth || "Status bukti P0 belum dirumuskan.",
      ((evidenceBoard.items || []).filter(function (row) {
        return row.status === "not_received" || row.status === "not_verified";
      }).map(function (row, index) {
        return (index + 1) + ". [" + row.id + "] " + row.title + " — " + row.nextAction;
      }).join("\n") || "Tidak ada pengunci bukti tercatat."),
      "",
      "PETA SINTESIS KEBIJAKAN",
      ((state.analysis.policyMapFramework && state.analysis.policyMapFramework.layers) || []).map(function (row, index) {
        return (index + 1) + ". [" + decisionLabel(row.decision) + "] " + row.title + " — " +
          number(row.grossAreaHa, 1) + " ha (luas kotor; dapat bertumpang tindih). " + row.policyDirection;
      }).join("\n") || "Belum tersedia.",
      "",
      "UJI DAN JUSTIFIKASI REGULASI",
      "",
      (state.analysis.regulatoryAssessments || []).map(function (row, index) {
        return [
          (index + 1) + ". " + row.theme + " — " + decisionLabel(row.decision),
          "Temuan: " + row.finding,
          "Dasar: " + (row.regulations || []).join(", "),
          "Posisi YG: " + row.ygPosition,
          "Validasi: " + row.validation
        ].join("\n");
      }).join("\n\n"),
      "",
      "BATAS PENGGUNAAN",
      position.caveat || "Geometri analitis bukan batas WP, SWP, zona, atau subzona yang mengikat. Kesimpulan harus diverifikasi dengan RTRW yang berlaku dan draf pemerintah terotorisasi, bernomor versi, serta bertanggal."
    ].join("\n");
  }

  function downloadJson(value, fileName, mimeType) {
    var blob = new Blob([JSON.stringify(value, null, 2)], { type: mimeType || "application/json;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function exportYgJson() {
    downloadJson({
      metadata: state.analysis.metadata,
      summary: state.analysis.summary,
      analysisPosition: state.analysis.analysisPosition,
      decisionClasses: state.analysis.decisionClasses,
      regulationRegister: state.analysis.regulationRegister,
      p0EvidenceBoard: state.analysis.p0EvidenceBoard,
      policyMapFramework: state.analysis.policyMapFramework,
      planningWorkflow: state.analysis.planningWorkflow,
      crossCuttingGates: state.analysis.crossCuttingGates,
      mandatoryAnalysisMatrix: state.analysis.mandatoryAnalysisMatrix,
      analysisProgramme: state.analysis.analysisProgramme,
      ygPlan: state.analysis.ygPlan,
      geometryRegistry: state.analysis.geometryRegistry
    }, "rancangan-analitis-rdtr-bagansiapiapi-versi-yg.json");
  }

  function exportYgGeoJson() {
    var collection = state.analysis.map && state.analysis.map.ygPlanningUnits;
    if (!collection) return;
    downloadJson(collection, "unit-penyaringan-analitis-yg-bukan-zonasi.geojson", "application/geo+json;charset=utf-8");
  }

  function exportPolicyMap() {
    var framework = state.analysis.policyMapFramework || {};
    var features = [];
    (framework.layers || []).forEach(function (policy) {
      var key = String(policy.mapRef || "").split(".").pop();
      var collection = state.analysis.map && state.analysis.map[key];
      (collection && collection.features || []).forEach(function (feature) {
        features.push({
          type: "Feature",
          geometry: feature.geometry,
          properties: Object.assign({}, feature.properties || {}, {
            policyMapId: framework.id,
            policyLayerId: policy.id,
            policyLayerTitle: policy.title,
            decision: policy.decision,
            confidence: policy.confidence,
            patternHypothesis: policy.patternHypothesis,
            policyDirection: policy.policyDirection,
            promotionRequirements: (policy.promotionRequirements || []).join(" | "),
            regulationRefs: (policy.regulationRefs || []).join(" | "),
            analysisRefs: (policy.analysisRefs || []).join(" | "),
            geometryStatus: "analytical_argument_geometry_not_official_rdtr_zone"
          })
        });
      });
    });
    downloadJson({
      type: "FeatureCollection",
      name: framework.title,
      metadata: {
        id: framework.id,
        version: framework.version,
        access: "staff_only",
        status: framework.status,
        legalCutoff: framework.legalCutoff,
        disclaimer: framework.disclaimer,
        readingRule: framework.readingRule
      },
      features: features
    }, "peta-sintesis-kebijakan-rdtr-bagansiapiapi-v0.geojson", "application/geo+json;charset=utf-8");
  }

  async function copyText(button, text, original) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      var field = document.createElement("textarea");
      field.value = text; document.body.appendChild(field); field.select(); document.execCommand("copy"); field.remove();
    }
    button.textContent = "Sudah disalin";
    setTimeout(function () { button.textContent = original; }, 2200);
  }

  async function copyPoints() {
    var button = document.getElementById("rdtr-copy-points");
    await copyText(button, consultationText(), "Salin poin konsultasi");
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
    document.getElementById("rdtr-export-analysis-csv").addEventListener("click", exportAnalysisCsv);
    document.getElementById("rdtr-export-evidence-csv").addEventListener("click", exportEvidenceCsv);
    ["rdtr-analysis-search", "rdtr-analysis-priority", "rdtr-analysis-status"].forEach(function (id) {
      var field = document.getElementById(id);
      field.addEventListener(id === "rdtr-analysis-search" ? "input" : "change", function () {
        renderAnalysisMatrix(state.analysis.mandatoryAnalysisMatrix);
      });
    });
    document.getElementById("rdtr-copy-points").addEventListener("click", copyPoints);
    document.getElementById("rdtr-copy-analysis").addEventListener("click", function (event) {
      copyText(event.currentTarget, analysisText(), "Salin rancangan YG");
    });
    document.getElementById("rdtr-export-yg-json").addEventListener("click", exportYgJson);
    document.getElementById("rdtr-export-yg-geojson").addEventListener("click", exportYgGeoJson);
    document.getElementById("rdtr-export-policy-map").addEventListener("click", exportPolicyMap);
    document.getElementById("rdtr-village-body").addEventListener("click", function (event) {
      var button = event.target.closest("[data-village-id]");
      if (button) renderVillageAnalysis(button.dataset.villageId);
    });
    document.getElementById("rdtr-regulation-search").addEventListener("input", filterRegulations);
    document.getElementById("rdtr-regulation-scope").addEventListener("change", filterRegulations);
    document.addEventListener("click", function (event) {
      var link = event.target.closest(".rdtr-reg-link, .rdtr-trace-links a");
      if (!link) return;
      var target = document.querySelector(link.getAttribute("href"));
      if (target) {
        target.hidden = false;
        target.open = true;
      }
    });
    document.getElementById("rdtr-print").addEventListener("click", function () { window.print(); });
  }

  function init(bootstrap) {
    if (!bootstrap || !bootstrap.analysis || state.analysis) return;
    state.analysis = bootstrap.analysis;
    renderSummary(state.analysis);
    renderReadiness(state.analysis.readiness);
    renderYgPlan(state.analysis);
    renderPlanningWorkflow(state.analysis);
    renderP0EvidenceBoard(state.analysis.p0EvidenceBoard);
    renderPolicyMapFramework(state.analysis.policyMapFramework);
    renderPlanComponents(state.analysis.ygPlan);
    renderAnalysisProgramme(state.analysis.analysisProgramme, state.analysis.mandatoryAnalysisMatrix);
    renderAnalysisMatrix(state.analysis.mandatoryAnalysisMatrix);
    renderGeometryRegistry(state.analysis.geometryRegistry);
    renderPosition(state.analysis);
    renderRegulatoryAssessments(state.analysis.regulatoryAssessments);
    renderVillages(state.analysis.villages);
    renderRecommendations(state.analysis.villages);
    renderRegulationRegister(state.analysis.regulationRegister);
    renderQuestions(state.analysis.consultationQuestions);
    initMap(state.analysis);
    bind();
  }

  if (window.YG_RDTR_BOOTSTRAP) init(window.YG_RDTR_BOOTSTRAP);
  else document.addEventListener("yg:rdtr-authorized", function () { init(window.YG_RDTR_BOOTSTRAP); }, { once: true });
})();
