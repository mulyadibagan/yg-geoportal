(function () {
  'use strict';
  var API = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var PERTAMINA_ID = 'DNR-PERTAMINA-FOUNDATION';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
    });
  }
  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      var callback = 'ygPertaminaTimeline_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      var script = document.createElement('script');
      window[callback] = function (data) {
        delete window[callback];
        script.remove();
        resolve(data);
      };
      script.onerror = function () {
        delete window[callback];
        script.remove();
        reject(new Error('Tagging pusat tidak dapat dimuat.'));
      };
      script.src = url + (url.indexOf('?') > -1 ? '&' : '?') +
        'callback=' + encodeURIComponent(callback) + '&t=' + Date.now();
      document.head.appendChild(script);
    });
  }
  function formatDate(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value || '-');
    return date.toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'});
  }
  function render(assignments, capacityRows) {
    var list = document.getElementById('pertamina-evidence-list');
    var status = document.getElementById('pertamina-evidence-status');
    var countNodes = document.querySelectorAll('[data-pertamina-training-count]');
    if (!list || !status) return;
    var capacityById = {};
    (capacityRows || []).forEach(function (row) { capacityById[String(row.id || '')] = row; });
    var seen = {};
    var rows = (assignments || []).filter(function (assignment) {
      return String(assignment.donorId || '') === PERTAMINA_ID;
    }).filter(function (assignment) {
      var evidenceId = String(assignment.evidenceId || '');
      if (!evidenceId || seen[evidenceId]) return false;
      seen[evidenceId] = true;
      return true;
    }).map(function (assignment) {
      return {assignment:assignment, evidence:capacityById[String(assignment.evidenceId || '')] || null};
    }).sort(function (left, right) {
      return (Date.parse((left.evidence || {}).date || left.assignment.verifiedAt || '') || 0) -
        (Date.parse((right.evidence || {}).date || right.assignment.verifiedAt || '') || 0);
    });
    countNodes.forEach(function (node) { node.textContent = String(rows.length); });
    status.textContent = rows.length + ' kegiatan ter-tag';
    if (!rows.length) {
      list.innerHTML = '<p class="pertamina-evidence-empty">Belum ada pelatihan yang di-tag ke Pertamina Foundation.</p>';
      return;
    }
    list.innerHTML = rows.map(function (item) {
      var assignment = item.assignment;
      var evidence = item.evidence || {};
      var participants = Number(evidence.male || 0) + Number(evidence.female || 0);
      var title = evidence.name || assignment.evidenceTitle || assignment.indicatorLabel || 'Kegiatan pelatihan';
      var date = evidence.date || assignment.verifiedAt || '';
      var description = evidence.topic || assignment.note || '';
      var meta = [assignment.indicatorLabel, evidence.location, participants ? participants + ' peserta' : '', evidence.partner ? 'Mitra: ' + evidence.partner : ''].filter(Boolean);
      return '<article class="pertamina-evidence-item">' +
        '<time class="pertamina-evidence-date" datetime="' + esc(date) + '">' + esc(formatDate(date)) + '</time>' +
        '<div class="pertamina-evidence-card"><strong>' + esc(title) + '</strong>' +
        (description ? '<p>' + esc(description) + '</p>' : '') +
        '<div class="pertamina-evidence-meta">' + meta.map(function (value) { return '<span>' + esc(value) + '</span>'; }).join('') + '</div></div></article>';
    }).join('');
  }
  function showError(error) {
    var list = document.getElementById('pertamina-evidence-list');
    var status = document.getElementById('pertamina-evidence-status');
    if (status) status.textContent = 'Data belum tersedia';
    if (list) list.innerHTML = '<p class="pertamina-evidence-empty">' + esc(error && error.message ? error.message : 'Timeline gagal dimuat.') + '</p>';
  }
  document.addEventListener('DOMContentLoaded', function () {
    Promise.all([
      jsonp(API + '?page=donor-programmes'),
      fetch('data/capacity-building.json?v=20260727-pertamina-live1', {cache:'no-store'}).then(function (response) {
        if (!response.ok) throw new Error('Data pelatihan tidak dapat dimuat.');
        return response.json();
      })
    ]).then(function (results) {
      render((results[0] || {}).assignments || [], results[1] || []);
    }).catch(showError);
  });
})();
