(function () {
  "use strict";

  const state = { data: null, search: "", target: "", status: "", period: "" };
  const labels = {
    explicit: "Tercantum dalam RAD",
    verified: "Kontribusi terverifikasi",
    supporting: "Kontribusi pendukung",
    unmapped: "Belum dipetakan"
  };
  const elements = {
    goals: document.getElementById("rad-goals"),
    formalTargets: document.getElementById("rad-formal-targets"),
    target: document.getElementById("rad-target"),
    status: document.getElementById("rad-status"),
    period: document.getElementById("rad-period"),
    search: document.getElementById("rad-search"),
    reset: document.getElementById("rad-reset"),
    count: document.getElementById("rad-result-count"),
    groups: document.getElementById("rad-action-groups")
  };

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const allActions = () => state.data.targets.flatMap(target =>
    target.actions.map(action => Object.assign({ targetId: target.id, targetNumber: target.number, targetTitle: target.title, theme: target.theme }, action))
  );
  const hasLink = action => action.status !== "unmapped";
  const searchable = action => [action.name, action.period, action.lead, action.partners, action.rationale, action.theme, action.targetTitle].join(" ").toLowerCase();

  function renderSummary() {
    const summary = state.data.summary;
    const linked = allActions().filter(hasLink).length;
    Object.entries({ goals: summary.goals, targets: summary.targets, actions: summary.actions, explicit: summary.explicit, linked }).forEach(([key, value]) => {
      const node = document.querySelector('[data-stat="' + key + '"]');
      if (node) node.textContent = Number(value).toLocaleString("id-ID");
    });
    elements.goals.innerHTML = state.data.goals.map((goal, index) => '<article class="rad-goal"><span>' + (index + 1) + '</span>' + escapeHtml(goal) + '</article>').join("");
    elements.formalTargets.innerHTML = state.data.formalTargets.map((target, index) => '<article class="rad-formal-target"><strong>Sasaran formal ' + (index + 1) + '</strong>' + escapeHtml(target) + '</article>').join("");
  }

  function fillFilters() {
    elements.target.insertAdjacentHTML("beforeend", state.data.targets.map(target => '<option value="' + escapeHtml(target.id) + '">' + target.number + ' · ' + escapeHtml(target.title) + '</option>').join(""));
    const periods = [...new Set(allActions().map(action => action.period))].sort((a, b) => a.localeCompare(b, "id", { numeric: true }));
    elements.period.insertAdjacentHTML("beforeend", periods.map(period => '<option value="' + escapeHtml(period) + '">' + escapeHtml(period) + '</option>').join(""));
  }

  function filteredTargets() {
    const query = state.search.trim().toLowerCase();
    return state.data.targets.map(target => {
      if (state.target && state.target !== target.id) return null;
      const actions = target.actions.filter(action => {
        const combined = Object.assign({ targetTitle: target.title, theme: target.theme }, action);
        if (state.status && action.status !== state.status) return false;
        if (state.period && action.period !== state.period) return false;
        return !query || searchable(combined).includes(query);
      });
      if (!actions.length && target.actions.length) return null;
      if (!actions.length && (state.status || state.period || query)) return null;
      return Object.assign({}, target, { actions });
    }).filter(Boolean);
  }

  function renderAction(target, action) {
    const evidence = Array.isArray(action.evidence) ? action.evidence : [];
    const links = evidence.map(item => '<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener">' + escapeHtml(item.label) + ' ↗</a>').join("");
    return '<article class="kkmd-action rad-action">' +
      '<div class="kkmd-action-code">' + target.number + '.' + action.no + '</div>' +
      '<div class="kkmd-action-main"><h4>' + escapeHtml(action.name) + '</h4>' +
        '<div class="rad-action-summary"><div><strong>Periode target</strong>' + escapeHtml(action.period) + '</div><div><strong>Tema</strong>' + escapeHtml(target.theme) + '</div></div>' +
      '</div>' +
      '<div class="kkmd-action-links"><span class="rad-badge is-' + escapeHtml(action.status) + '">' + escapeHtml(labels[action.status]) + '</span>' + (links ? '<div class="rad-evidence-links">' + links + '</div>' : '') + '</div>' +
      '<details class="rad-action-details"><summary>Lihat dasar pemetaan dan pelaksana</summary><div class="rad-action-detail-grid">' +
        '<div><strong>Leading sector</strong>' + escapeHtml(action.lead) + '</div>' +
        '<div><strong>Mitra dalam RAD</strong>' + escapeHtml(action.partners) + '</div>' +
        '<div class="rad-action-rationale"><strong>Analisis keterkaitan YG</strong>' + escapeHtml(action.rationale) + '</div>' +
      '</div></details>' +
    '</article>';
  }

  function renderActions() {
    const targets = filteredTargets();
    const visible = targets.reduce((sum, target) => sum + target.actions.length, 0);
    elements.count.textContent = visible + " dari " + state.data.summary.actions + " rencana aksi ditampilkan";
    if (!targets.length) {
      elements.groups.innerHTML = '<div class="kkmd-empty"><strong>Tidak ada aksi yang cocok.</strong><br>Ubah filter atau kata pencarian.</div>';
      return;
    }
    elements.groups.innerHTML = targets.map(target => {
      const linked = target.actions.filter(hasLink).length;
      const rows = target.actions.map(action => renderAction(target, action)).join("");
      const gap = !target.actions.length && target.note
        ? '<div class="rad-gap"><strong>Catatan struktur RAD</strong>' + escapeHtml(target.note) + (target.indicators ? '<br><small>Indikator: ' + escapeHtml(target.indicators.join("; ")) + '</small>' : '') + '</div>'
        : '';
      return '<section class="kkmd-issue-group"><header class="kkmd-issue-head"><div class="kkmd-issue-title"><span class="kkmd-issue-number">' + target.number + '</span><div><small>' + escapeHtml(target.theme) + '</small><h3>' + escapeHtml(target.title) + '</h3></div></div><span class="kkmd-issue-count">' + linked + ' terkait · ' + target.actions.length + ' aksi</span></header><div class="kkmd-action-list">' + rows + gap + '</div></section>';
    }).join("");
  }

  function bindEvents() {
    elements.search.addEventListener("input", event => { state.search = event.target.value; renderActions(); });
    elements.target.addEventListener("change", event => { state.target = event.target.value; renderActions(); });
    elements.status.addEventListener("change", event => { state.status = event.target.value; renderActions(); });
    elements.period.addEventListener("change", event => { state.period = event.target.value; renderActions(); });
    elements.reset.addEventListener("click", () => {
      state.search = ""; state.target = ""; state.status = ""; state.period = "";
      elements.search.value = ""; elements.target.value = ""; elements.status.value = ""; elements.period.value = "";
      renderActions();
    });
  }

  fetch("data/bengkalis-lestari.json?v=20260807-rad1")
    .then(response => { if (!response.ok) throw new Error("Data RAD Bengkalis Lestari tidak dapat dimuat"); return response.json(); })
    .then(data => { state.data = data; renderSummary(); fillFilters(); bindEvents(); renderActions(); })
    .catch(error => { elements.count.textContent = "Data belum tersedia"; elements.groups.innerHTML = '<div class="kkmd-empty">' + escapeHtml(error.message) + '</div>'; });
})();
