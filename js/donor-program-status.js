(function () {
  'use strict';

  var cardSelectors = {
    aramco: '[data-open-aramco]',
    gec: '[data-open-gec]',
    ppcf: '[data-open-ppcf]',
    kolibri: '[data-open-kolibri]',
    penabulu: '[data-open-penabulu]'
  };

  function isActive(program) {
    return /^(aktif|berjalan|direncanakan)$/i.test(String(program.status || '').trim());
  }

  function isAssignable(program) {
    var phases = program.phases || [];
    return isActive(program) && (!phases.length || phases.some(isActive));
  }

  function applyStatus(donor) {
    var card = document.querySelector(cardSelectors[donor.slug]);
    if (!card) return;
    var programmes = donor.programs || [];
    var activeCount = programmes.filter(isAssignable).length;
    var active = activeCount > 0;
    var badge = card.querySelector('.donor-status-badge');
    if (!badge) {
      badge = document.createElement('em');
      badge.className = 'donor-status-badge';
      card.appendChild(badge);
    }
    badge.className = 'donor-status-badge ' + (active ? 'is-active' : 'is-complete');
    badge.textContent = active ? 'Aktif · ' + activeCount + ' program' : 'Program selesai';
    card.dataset.programmeStatus = active ? 'active' : 'complete';
  }

  function refresh() {
    fetch('data/donors.json?v=20260726-ipems1', { cache: 'no-store' })
      .then(function (response) { return response.json(); })
      .then(function (donors) { donors.forEach(applyStatus); })
      .catch(function (error) { console.warn('Status program donor tidak dapat dimuat.', error); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    refresh();
    window.setTimeout(refresh, 1200);
  });
})();
