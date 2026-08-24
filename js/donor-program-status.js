(function () {
  'use strict';

  var cardSelectors = {
    aramco: '[data-open-aramco]',
    gec: '[data-open-gec]',
    ppcf: '[data-open-ppcf]',
    kolibri: '[data-open-kolibri]',
    penabulu: '[data-open-penabulu]',
    'pertamina-foundation': '[data-open-pertamina]'
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
    fetch('data/donors.json?v=20260808-penabulu-plan-evidence1', { cache: 'no-store' })
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

  function bindAramcoDirectPage() {
    var card = document.querySelector(cardSelectors.aramco);
    if (!card || card.dataset.directPageBound === 'true') return;
    card.dataset.directPageBound = 'true';
    card.setAttribute('aria-label', 'Buka dashboard program Aramco Asia Singapore');
    card.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.href = 'aramco.html';
    }, true);
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindAramcoDirectPage();
    refresh();
    var grid = document.getElementById('donor-grid');
    if (grid && window.MutationObserver) {
      new MutationObserver(function () {
        bindAramcoDirectPage();
        applyCachedStatuses();
      }).observe(grid, { childList: true, subtree: true });
    }
  });
})();