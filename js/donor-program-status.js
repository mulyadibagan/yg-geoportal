(function () {
  'use strict';

  var cardSelectors = {
    aramco: '[data-open-aramco]',
    gec: '[data-open-gec]',
    ppcf: '[data-open-ppcf]',
    kolibri: '[data-open-kolibri]',
    penabulu: '[data-open-penabulu]'
  };
  var donorRows = [];
  var refreshQueued = false;

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
    var badgeClass = 'donor-status-badge ' + (active ? 'is-active' : 'is-complete');
    var badgeText = active ? 'Aktif · ' + activeCount + ' program' : 'Program selesai';
    if (badge.className !== badgeClass) badge.className = badgeClass;
    if (badge.textContent !== badgeText) badge.textContent = badgeText;
    card.dataset.programmeStatus = active ? 'active' : 'complete';
  }

  function refresh() {
    fetch('data/donors.json?v=20260726-ipems1', { cache: 'no-store' })
      .then(function (response) { return response.json(); })
      .then(function (donors) {
        donorRows = donors;
        donorRows.forEach(applyStatus);
      })
      .catch(function (error) { console.warn('Status program donor tidak dapat dimuat.', error); });
  }

  function applyCachedStatuses() {
    if (refreshQueued) return;
    refreshQueued = true;
    window.requestAnimationFrame(function () {
      refreshQueued = false;
      donorRows.forEach(applyStatus);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    refresh();
    var grid = document.getElementById('donor-grid');
    if (grid && window.MutationObserver) {
      new MutationObserver(applyCachedStatuses).observe(grid, { childList: true, subtree: true });
    }
  });
})();
