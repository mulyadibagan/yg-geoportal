(function () {
  'use strict';
  var donorName = new URLSearchParams(location.search).get('donor') || 'Aramco Asia Singapore';
  var storageKey = 'ygDonorDrafts_v1';
  var donor;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }
  function drafts() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (error) { return {}; }
  }
  function combinedData() {
    var extra = drafts()[donor.name] || { programs: [], timeline: [] };
    return {
      programs: (donor.programs || []).concat(extra.programs || []),
      timeline: (donor.timeline || []).concat(extra.timeline || [])
    };
  }
  function render() {
    var data = combinedData();
    var indicators = (donor.indicators || []).map(function (item) {
      var progress = Math.max(0, Math.min(100, Number(item.progress || 0)));
      return '<article class="funding-indicator donor-page-indicator"><i aria-hidden="true">●</i><strong>' + esc(item.value) + '</strong><span>' + esc(item.label) + '</span><div class="impact-track" aria-label="Capaian ' + progress + '%"><b style="width:' + progress + '%"></b></div><small>' + progress.toLocaleString('id-ID', {maximumFractionDigits:1}) + '% capaian</small></article>';
    }).join('') || '<p>Belum ada indikator capaian.</p>';
    var programs = data.programs.map(function (item) {
      return '<article><b>' + esc(item.status || 'Berjalan') + '</b><strong>' + esc(item.period || '') + '</strong><h3>' + esc(item.name) + '</h3><p>' + esc(item.summary || '') + '</p></article>';
    }).join('') || '<p>Belum ada program.</p>';
    var timeline = data.timeline.map(function (item) {
      return '<article><b>' + esc(item.title) + '</b><strong>' + esc(item.year || '') + '</strong><p>' + esc(item.detail || '') + '</p></article>';
    }).join('') || '<p>Belum ada timeline.</p>';
    document.title = donor.name + ' | YG GeoPortal';
    document.getElementById('donor-profile').className = 'funding-dialog donor-page-dialog';
    document.getElementById('donor-profile').innerHTML =
      '<header class="funding-hero"><span class="funding-badge">MITRA PENDANAAN</span><h2>' + esc(donor.name) + '</h2><div class="funding-meta"><span><b>Periode</b>' + esc(donor.period) + '</span><span><b>Fokus program</b>' + esc(donor.focus) + '</span></div></header>' +
      '<div class="funding-content">' +
        '<div class="funding-heading"><div><span>Ringkasan dampak</span><h3>Grafik Capaian Program</h3></div><p>' + (donor.locations || []).map(esc).join(' · ') + '</p></div>' +
        '<div class="funding-indicators donor-page-indicators">' + indicators + '</div>' +
        '<section class="funding-timeline"><div class="funding-heading"><div><span>Program aktif</span><h3>Program Berjalan</h3></div></div><div class="funding-timeline-grid donor-program-grid">' + programs + '</div></section>' +
        '<section class="funding-timeline"><div class="funding-heading"><div><span>Perjalanan program</span><h3>Timeline Program</h3></div></div><div class="funding-timeline-grid donor-timeline-grid">' + timeline + '</div></section>' +
      '</div>';
  }
  function saveDraft(event) {
    event.preventDefault();
    var type = document.getElementById('entry-type').value;
    var title = document.getElementById('entry-title').value.trim();
    var period = document.getElementById('entry-period').value.trim();
    var status = document.getElementById('entry-status').value;
    var summary = document.getElementById('entry-summary').value.trim();
    var all = drafts();
    var current = all[donor.name] || { programs: [], timeline: [] };
    if (type === 'program') current.programs.push({ name: title, period: period, status: status, summary: summary });
    else current.timeline.push({ year: period, title: title, detail: summary, status: status });
    all[donor.name] = current;
    localStorage.setItem(storageKey, JSON.stringify(all));
    event.target.reset();
    document.getElementById('entry-status-text').textContent = 'Draf tersimpan pada browser ini.';
    render();
  }
  function exportData() {
    var payload = JSON.stringify({ donor: donor.name, drafts: drafts()[donor.name] || {} }, null, 2);
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    link.download = donor.slug + '-draft.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  fetch('data/donors.json?v=20260726-2', { cache: 'no-store' })
    .then(function (response) { return response.json(); })
    .then(function (rows) {
      donor = rows.find(function (item) { return item.name === donorName; }) || rows[0];
      render();
      document.getElementById('donor-entry-form').addEventListener('submit', saveDraft);
      document.getElementById('export-donor-data').addEventListener('click', exportData);
    })
    .catch(function () {
      document.getElementById('donor-profile').textContent = 'Profil donor tidak dapat dimuat.';
    });
})();
