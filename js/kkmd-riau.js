(function () {
  "use strict";

  const state = { data: null, search: "", issue: "", status: "" };
  const els = {
    commitments: document.getElementById("kkmd-commitments"),
    issue: document.getElementById("kkmd-issue"),
    status: document.getElementById("kkmd-status"),
    search: document.getElementById("kkmd-search"),
    reset: document.getElementById("kkmd-reset"),
    count: document.getElementById("kkmd-result-count"),
    groups: document.getElementById("kkmd-action-groups")
  };

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const formatNumber = value => Number(value || 0).toLocaleString("id-ID", { maximumFractionDigits: 1 });
  const isMapped = action => (action.realization !== null && action.realization !== "") || Boolean(action.evidence);
  const searchable = action => [
    action.name, action.indicator, action.location, action.implementer,
    action.funding, action.problem, action.followup
  ].join(" ").toLowerCase();
  const evidenceLinks = action => String(action.evidence || "").split(/\s+/).filter(url => /^https?:\/\//i.test(url));

  function renderStats() {
    const stats = state.data.summary;
    const mapping = { issues: stats.issues, actions: stats.actions, mapped: stats.mapped, commitments: stats.formalCommitments };
    Object.entries(mapping).forEach(([key, value]) => {
      const target = document.querySelector('[data-stat="' + key + '"]');
      if (target) target.textContent = formatNumber(value);
    });
  }

  function renderCommitments() {
    els.commitments.innerHTML = state.data.commitments.map(item => {
      const percentage = item.target ? Math.min(100, (Number(item.realization) / Number(item.target)) * 100) : 0;
      const statusClass = percentage < 100 ? " is-progress" : "";
      return '<article class="kkmd-commitment">' +
        '<div class="kkmd-commitment-head"><h3>' + escapeHtml(item.label) + '</h3><span class="kkmd-badge' + statusClass + '">' + escapeHtml(item.status) + '</span></div>' +
        '<div class="kkmd-commitment-value"><strong>' + formatNumber(item.realization) + '</strong><span>' + escapeHtml(item.unit) + '</span></div>' +
        '<div class="kkmd-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(percentage) + '"><span style="width:' + percentage + '%"></span></div>' +
        '<div class="kkmd-commitment-meta"><span>Target ' + formatNumber(item.target) + ' ' + escapeHtml(item.unit) + '</span><strong>' + formatNumber(percentage) + '%</strong></div>' +
        '<a href="' + escapeHtml(item.evidence) + '" target="_blank" rel="noopener">Lihat bukti WebGIS →</a>' +
      '</article>';
    }).join("");
  }

  function fillIssueFilter() {
    els.issue.insertAdjacentHTML("beforeend", state.data.issues.map(issue =>
      '<option value="' + issue.number + '">Isu ' + issue.number + ' · ' + escapeHtml(issue.title) + '</option>'
    ).join(""));
  }

  function filteredIssues() {
    const query = state.search.trim().toLowerCase();
    return state.data.issues.map(issue => {
      if (state.issue && String(issue.number) !== state.issue) return null;
      const actions = issue.actions.filter(action => {
        if (state.status === "mapped" && !isMapped(action)) return false;
        if (state.status === "unmapped" && isMapped(action)) return false;
        return !query || searchable(action).includes(query);
      });
      return actions.length ? Object.assign({}, issue, { actions }) : null;
    }).filter(Boolean);
  }

  function renderActions() {
    const issues = filteredIssues();
    const count = issues.reduce((sum, issue) => sum + issue.actions.length, 0);
    els.count.textContent = count + " dari " + state.data.summary.actions + " rencana aksi ditampilkan";
    if (!issues.length) {
      els.groups.innerHTML = '<div class="kkmd-empty"><strong>Tidak ada kegiatan yang cocok.</strong><br>Ubah kata pencarian atau reset filter.</div>';
      return;
    }
    els.groups.innerHTML = issues.map(issue => {
      const mappedCount = issue.actions.filter(isMapped).length;
      const actions = issue.actions.map(action => {
        const mapped = isMapped(action);
        const links = evidenceLinks(action);
        const indicator = action.indicator.length > 430 ? action.indicator.slice(0, 427) + "…" : action.indicator;
        const meta = [
          action.location ? '<span>📍 ' + escapeHtml(action.location) + '</span>' : "",
          action.realization !== null && action.realization !== "" ? '<span>Realisasi: ' + escapeHtml(action.realization) + '</span>' : "",
          action.achievement !== null && action.achievement !== "" ? '<span>Capaian: ' + formatNumber(Number(action.achievement) * 100) + '%</span>' : ""
        ].join("");
        const linkMarkup = links.length
          ? links.map((url, index) => '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Bukti ' + (links.length > 1 ? index + 1 : "") + ' ↗</a>').join("")
          : '<span class="kkmd-unmapped">Belum dipetakan YG</span>';
        return '<article class="kkmd-action">' +
          '<div class="kkmd-action-code">' + issue.number + '.' + action.no + '</div>' +
          '<div class="kkmd-action-main"><h4>' + escapeHtml(action.name) + '</h4>' +
            (indicator ? '<p>' + escapeHtml(indicator) + '</p>' : "") +
            (meta ? '<div class="kkmd-action-meta">' + meta + '</div>' : "") +
          '</div><div class="kkmd-action-links">' + (mapped ? '<span class="kkmd-badge">Terpetakan</span>' : "") + linkMarkup + '</div>' +
        '</article>';
      }).join("");
      return '<section class="kkmd-issue-group"><header class="kkmd-issue-head"><div class="kkmd-issue-title"><span class="kkmd-issue-number">' + issue.number + '</span><h3>' + escapeHtml(issue.title) + '</h3></div><span class="kkmd-issue-count">' + mappedCount + ' terpetakan · ' + issue.actions.length + ' aksi</span></header><div class="kkmd-action-list">' + actions + '</div></section>';
    }).join("");
  }

  function bindEvents() {
    els.search.addEventListener("input", event => { state.search = event.target.value; renderActions(); });
    els.issue.addEventListener("change", event => { state.issue = event.target.value; renderActions(); });
    els.status.addEventListener("change", event => { state.status = event.target.value; renderActions(); });
    els.reset.addEventListener("click", () => {
      state.search = ""; state.issue = ""; state.status = "";
      els.search.value = ""; els.issue.value = ""; els.status.value = "";
      renderActions();
    });
  }

  fetch("data/kkmd-riau.json?v=20260807-kkmd1")
    .then(response => {
      if (!response.ok) throw new Error("Data KKMD tidak dapat dimuat");
      return response.json();
    })
    .then(data => {
      state.data = data;
      renderStats();
      renderCommitments();
      fillIssueFilter();
      bindEvents();
      renderActions();
    })
    .catch(error => {
      els.count.textContent = "Data belum tersedia";
      els.groups.innerHTML = '<div class="kkmd-empty">' + escapeHtml(error.message) + '</div>';
    });
})();
