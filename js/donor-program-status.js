(function () {
  'use strict';

  var cardSelectors = {
    aramco: '[data-open-aramco]',
    gec: '[data-open-gec]',
    ppcf: '[data-open-ppcf]',
    kolibri: '[data-open-kolibri]',
    penabulu: '[data-open-penabulu]',
    'ma-earth': '[data-open-ma-earth]',
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

  function findDonorCard(donor) {
    var selector = cardSelectors[donor.slug];
    if (selector) {
      var knownCard = document.querySelector(selector);
      if (knownCard) return knownCard;
    }
    var donorName = String(donor.name || '').trim().toLowerCase();
    return Array.prototype.find.call(
      document.querySelectorAll('#donor-grid .funding-card'),
      function (card) {
        var name = card.querySelector(':scope > span');
        return name && String(name.textContent || '').trim().toLowerCase() === donorName;
      }
    ) || null;
  }

  function reorderCards() {
    var grid = document.getElementById('donor-grid');
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll(':scope > .funding-card'));
    var ordered = cards.map(function (card, index) {
      var status = card.dataset.programmeStatus || 'unknown';
      return { card: card, index: index, rank: status === 'active' ? 0 : status === 'complete' ? 2 : 1 };
    }).sort(function (a, b) {
      return a.rank - b.rank || a.index - b.index;
    }).map(function (item) { return item.card; });
    var changed = ordered.some(function (card, index) { return cards[index] !== card; });
    if (!changed) return;
    ordered.forEach(function (card) { grid.appendChild(card); });
  }

  function applyStatus(donor) {
    var card = findDonorCard(donor);
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
    fetch('data/donors.json?v=20260903-ma-earth-1000-1', { cache: 'no-store' })
      .then(function (response) { return response.json(); })
      .then(function (donors) {
        donorRows = donors;
        donorRows.forEach(applyStatus);
        reorderCards();
      })
      .catch(function (error) { console.warn('Status program donor tidak dapat dimuat.', error); });
  }

  function applyCachedStatuses() {
    if (refreshQueued) return;
    refreshQueued = true;
    window.requestAnimationFrame(function () {
      refreshQueued = false;
      donorRows.forEach(applyStatus);
      reorderCards();
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
