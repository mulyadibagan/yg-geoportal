(function () {
  'use strict';

  var API = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var DONOR_DATA_API = 'https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev/api/donor/programmes';
  var donorMap = {
    'Aramco Asia Singapore': { card: '[data-open-aramco]', modal: '#aramco-dashboard' },
    'Global Environment Centre': { card: '[data-open-gec]', modal: '#gec-dashboard' },
    'Pan Pacific Conservation Foundation (PPCF)': { card: '[data-open-ppcf]', modal: '#ppcf-dashboard' },
    'Aliansi Kolibri': { card: '[data-open-kolibri]', modal: '#kolibri-dashboard' },
    'Yayasan Penabulu': { card: '[data-open-penabulu]', modal: '#penabulu-dashboard' },
    'Pertamina Foundation': { card: '[data-open-pertamina]', modal: '#pertamina-dashboard' }
  };
  var assignments = [];
  var donors = [];
  var assignmentsReady = false;
  var donorsReady = false;
  var applyQueued = false;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
    });
  }

  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      var callback = 'ygDonorEvidence_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      var script = document.createElement('script');
      window[callback] = function (data) {
        delete window[callback];
        script.remove();
        resolve(data);
      };
      script.onerror = function () {
        delete window[callback];
        script.remove();
        reject(new Error('Data evidence donor tidak dapat dimuat.'));
      };
      script.src = url + '&callback=' + encodeURIComponent(callback) + '&t=' + Date.now();
      document.head.appendChild(script);
    });
  }

  function outputName(row) {
    return String(row.indicatorLabel || 'Output belum diklasifikasikan').split('→')[0].trim();
  }

  function isCapacityEvidence(row) {
    return /capacity building|training|pelatihan|nursery training|pembibitan/i.test([
      row.evidenceType,
      row.indicatorLabel,
      row.evidenceTitle
    ].join(' '));
  }

  function evidenceDestination(row) {
    if (isCapacityEvidence(row)) {
      return {
        href: 'capacity-building.html?report=' +
          encodeURIComponent(row.evidenceId || ''),
        label: 'Buka detail peningkatan kapasitas →',
        external: false
      };
    }
    if (row.evidenceUrl && row.evidenceType === 'Evidence Nonspasial') {
      return {
        href: row.evidenceUrl,
        label: 'Buka laporan →',
        external: true
      };
    }
    return {
      href: 'webgis.html?search=' +
        encodeURIComponent(row.evidenceId || row.evidenceTitle || ''),
      label: 'Lihat evidence di peta →',
      external: false
    };
  }

  function statusFor(done, target) {
    if (target > 0 && done >= target) return { text: 'Completed', cls: 'state-completed' };
    if (done > 0) return { text: 'In Progress', cls: 'state-in-progress' };
    return { text: 'Planned', cls: '' };
  }

  function readStaffSession() {
    try {
      var session = JSON.parse(sessionStorage.getItem('ygEditorSessionV1') || 'null');
      if (!session || !session.token || Number(session.expiresAt) <= Date.now()) return null;
      return session;
    } catch (error) {
      return null;
    }
  }

  function updateGecMilestones(rows) {
    var nurseryRows = rows.filter(function (row) {
      return /^(ACT-GEC-01|ACT-GEC-02)$/i.test(String(row.indicatorId || '')) ||
        /coffee seedling nursery training/i.test(String(row.indicatorLabel || ''));
    });
    var uniqueActivities = {};
    nurseryRows.forEach(function (row) {
      uniqueActivities[row.indicatorId || row.indicatorLabel] = true;
    });
    var completed = Object.keys(uniqueActivities).length;
    var state = statusFor(completed, 2);
    var progress = document.getElementById('gec2026-progress-nursery');
    var badge = document.getElementById('gec2026-status-nursery');
    var brief = document.getElementById('gec2026-nursery-brief');
    var updateTitle = document.getElementById('gec2026-update-title');
    var updateMeta = document.getElementById('gec2026-update-meta');
    var auditRows = rows.filter(function (row) {
      return String(row.indicatorId || '') === 'ACT-GEC-08' ||
        /financial audit of yayasan gambut/i.test(String(row.indicatorLabel || ''));
    });
    var auditBadge = document.getElementById('gec2026-status-audit');
    var auditItem = document.getElementById('gec2026-timeline-audit');
    var auditState = statusFor(auditRows.length, 1);
    var progressText = Math.min(completed, 2) + ' / 2 villages';
    if (progress && progress.textContent !== progressText) progress.textContent = progressText;
    if (badge) {
      if (badge.textContent !== state.text) badge.textContent = state.text;
      if (badge.className !== state.cls) badge.className = state.cls;
    }
    if (auditBadge) {
      auditBadge.textContent = auditState.text;
      auditBadge.className = auditState.cls;
    }
    if (auditItem) {
      var oldLink = auditItem.querySelector('.gec2026-audit-evidence-link');
      if (oldLink) oldLink.remove();
      var privateAudit = auditRows.find(function (row) { return !!row.evidenceUrl; });
      if (privateAudit && readStaffSession()) {
        var link = document.createElement('a');
        link.className = 'gec2026-audit-evidence-link';
        link.href = privateAudit.evidenceUrl;
        link.target = '_self';
        link.setAttribute('aria-label', 'Buka dokumen audit');
        link.textContent = 'Buka dokumen audit →';
        auditItem.insertBefore(link, auditBadge || null);
      }
    }
    if (brief && nurseryRows.length) {
      var briefMarkup = nurseryRows.map(function (row) {
        var destination = evidenceDestination(row);
        return '<a class="gec2026-report-link" href="' + esc(destination.href) + '">' +
          esc(row.evidenceTitle || row.evidenceId) + '</a>';
      }).join('');
      if (brief.innerHTML !== briefMarkup) brief.innerHTML = briefMarkup;
    }
    if (nurseryRows.length) {
      var latest = nurseryRows.slice().sort(function (a, b) {
        return String(b.verifiedAt || '').localeCompare(String(a.verifiedAt || ''));
      })[0];
      var latestParts = String(latest.evidenceTitle || '').split('·').map(function (part) {
        return part.trim();
      }).filter(Boolean);
      var latestTitle = latestParts.shift() || latest.evidenceTitle || 'Capacity Building';
      var latestMeta = latestParts.join(' · ');
      if (updateTitle && updateTitle.textContent !== latestTitle) updateTitle.textContent = latestTitle;
      if (updateTitle) {
        updateTitle.href = evidenceDestination(latest).href;
      }
      if (updateMeta && updateMeta.textContent !== latestMeta) updateMeta.textContent = latestMeta;
    }
  }

  function programmeForDonor(donorName) {
    var donor = donors.find(function (item) { return item.name === donorName; });
    if (!donor) return null;
    var programmes = (donor.programs || []).filter(function (programme) {
      return (programme.outputs || []).length;
    });
    return programmes.find(function (programme) {
      return /^(aktif|berjalan|direncanakan)$/i.test(String(programme.status || ''));
    }) || programmes[0] || null;
  }

  function donorForName(donorName) {
    return donors.find(function (item) { return item.name === donorName; }) || null;
  }

  function evidenceRowsForDonor(donorName, liveRows) {
    var donor = donorForName(donorName);
    var seeded = (donor && donor.verifiedEvidence) || [];
    var liveIndicatorIds = {};
    (liveRows || []).forEach(function (row) {
      if (row.indicatorId) liveIndicatorIds[String(row.indicatorId)] = true;
    });
    return seeded.filter(function (row) {
      return !row.indicatorId || !liveIndicatorIds[String(row.indicatorId)];
    }).concat(liveRows || []).sort(function (a, b) {
      return String(a.activityDate || a.verifiedAt || '').localeCompare(
        String(b.activityDate || b.verifiedAt || '')
      );
    });
  }

  function displayPeriod(donor, programme) {
    var selected = programme || (donor.programs || [])[0] || {};
    var period = String(selected.period || '').replace(/â€“/g, '–');
    var years = period.match(/\b20\d{2}\b/g) || [];
    years = years.filter(function (year, index) { return years.indexOf(year) === index; });
    return years.length ? years.join('–') : period;
  }

  function renderPenabuluEvidence(rows) {
    var list = document.getElementById('penabulu-evidence-list');
    var status = document.getElementById('penabulu-evidence-status');
    if (!list || !status) return;
    status.textContent = rows.length
      ? rows.length + ' evidence terverifikasi'
      : 'Belum ada evidence terverifikasi';
    if (!rows.length) {
      list.innerHTML = '<p class="penabulu-evidence-empty">Belum ada paket bukti yang dapat ditampilkan.</p>';
      return;
    }
    list.innerHTML = rows.map(function (row) {
      var destination = row.evidenceUrl ? evidenceDestination(row) : null;
      var sourceLink = destination
        ? '<a href="' + esc(destination.href) + '"' +
          (destination.external ? ' target="_blank" rel="noopener"' : '') + '>' +
          esc(destination.label) + '</a>'
        : '';
      return '<article class="penabulu-evidence-card">' +
        '<header><span>Aktivitas ' + esc(row.activityCode || row.indicatorId || '') +
        '</span><em>TERVERIFIKASI</em></header>' +
        '<strong>' + esc(row.evidenceTitle || row.evidenceId) + '</strong>' +
        '<div class="penabulu-evidence-meta"><span>📅 ' +
        esc(row.activityDateLabel || row.verifiedAtLabel || row.verifiedAt || 'Tanggal belum tersedia') +
        '</span><span>📍 ' + esc(row.location || 'Desa Temiang') + '</span></div>' +
        (row.note ? '<p>' + esc(row.note) + '</p>' : '') +
        '<small>Basis: ' + esc(row.verificationBasis || 'Assignment evidence oleh admin') + '</small>' +
        sourceLink + '</article>';
    }).join('');
  }

  function renderMilestones(donorName, rows) {
    if (donorName === 'Global Environment Centre') {
      updateGecMilestones(rows);
      return;
    }
    var target = donorMap[donorName];
    var modal = target && document.querySelector(target.modal);
    var content = modal && modal.querySelector('.funding-content');
    var programme = programmeForDonor(donorName);
    var donor = donorForName(donorName);
    if (!content || !donor) return;
    var section = content.querySelector('.funding-milestone-status');
    if (!section) {
      section = document.createElement('section');
      section.className = 'funding-milestone-status';
      var evidenceSection = content.querySelector('.funding-evidence-summary');
      if (evidenceSection) content.insertBefore(section, evidenceSection);
      else content.appendChild(section);
    }
    var milestones = (programme ? (programme.outputs || []) : []).map(function (output) {
      var activityIds = (output.activities || []).map(function (activity) {
        return String(activity.id || '');
      });
      var outputRows = rows.filter(function (row) {
        return activityIds.indexOf(String(row.indicatorId || '')) >= 0 ||
          outputName(row) === output.name;
      });
      var uniqueActivities = {};
      outputRows.forEach(function (row) {
        uniqueActivities[row.indicatorId || row.indicatorLabel] = true;
      });
      var done = Object.keys(uniqueActivities).length;
      var targetCount = Math.max((output.activities || []).length, 1);
      return {
        name: output.name,
        done: done,
        target: targetCount,
        state: statusFor(done, targetCount),
        latest: outputRows.length ? outputRows[outputRows.length - 1].evidenceTitle : '',
        output: output,
        rows: outputRows
      };
    });
    if (!milestones.length) {
      milestones = (donor.indicators || []).map(function (indicator) {
        var progress = Number(indicator.progress || 0);
        return {
          name: indicator.label,
          done: Math.max(0, Math.min(progress, 100)),
          target: 100,
          state: progress >= 100
            ? { text: 'Completed', cls: 'state-completed' }
            : progress > 0
              ? { text: 'In Progress', cls: 'state-in-progress' }
              : { text: 'Planned', cls: '' },
          latest: indicator.value || ''
        };
      });
    }
    var milestoneMarkup = donorName === 'Aramco Asia Singapore'
      ? '<div class="donor-milestone-detail-list">' + milestones.map(function (item) {
          var activities = (item.output.activities || []).map(function (activity) {
            var linked = item.rows.filter(function (row) {
              return String(row.indicatorId || '') === String(activity.id || '');
            });
            var evidence = linked.map(function (row) {
              var destination = evidenceDestination(row);
              return '<div class="aramco-evidence-item"><b>✓ Evidence terverifikasi</b>' +
                '<span>' + esc(row.evidenceTitle || row.evidenceId) + '</span>' +
                (row.note ? '<small>' + esc(row.note) + '</small>' : '') +
                '<a href="' + esc(destination.href) + '"' +
                (destination.external ? ' target="_blank" rel="noopener"' : '') + '>' +
                destination.label + '</a></div>';
            }).join('');
            return '<li class="' + (linked.length ? 'is-verified' : 'is-pending') + '">' +
              '<div><strong>' + esc(activity.name) + '</strong><span>' +
              esc(activity.indicator || '') + '</span></div><em>' +
              (linked.length ? 'TERVERIFIKASI' : 'BELUM DITAG') + '</em>' +
              evidence + '</li>';
          }).join('');
          return '<details class="aramco-output-card"><summary><span>' + esc(item.name) +
            '</span><b>' + item.done + '/' + item.target + ' terverifikasi · ' +
            item.state.text + '</b></summary><ul>' + activities + '</ul></details>';
        }).join('') + '</div>'
      : '<ul class="gec2026-timeline donor-milestone-list">' +
        milestones.map(function (item) {
          return '<li><div><span>' + esc(item.name) + '</span><small>' +
            (item.target === 100
              ? item.done + '% capaian'
              : item.done + ' / ' + item.target + ' aktivitas terverifikasi') +
            (item.latest ? ' · ' + esc(item.latest) : '') +
            '</small></div><strong class="' + item.state.cls + '">' +
            (donorName === 'Yayasan Penabulu'
              ? (item.state.text === 'Completed' ? 'Selesai'
                : item.state.text === 'In Progress' ? 'Berjalan' : 'Direncanakan')
              : item.state.text) + '</strong></li>';
        }).join('') + '</ul>';
    var activityTotal = milestones.reduce(function (total, item) {
      return total + (item.target === 100 ? 0 : item.target);
    }, 0);
    var sectionMarkup = donorName === 'Yayasan Penabulu'
      ? '<div class="funding-heading"><div><span>Status output</span><h3>' +
        milestones.length + ' output · ' + activityTotal + ' aktivitas (' +
        esc(displayPeriod(donor, programme)) + ')</h3></div>' +
        '<p>Status dihitung dari paket evidence yang telah ditelaah dan evidence yang ditag admin.</p></div>' +
        milestoneMarkup
      : '<div class="funding-heading"><div><span>Milestone status</span><h3>Timeline (' +
        esc(displayPeriod(donor, programme)) + ')</h3></div>' +
        '<p>Status dihitung dari evidence yang sudah ditag admin.</p></div>' +
        milestoneMarkup;
    if (section._ygMilestoneMarkup !== sectionMarkup) {
      section.innerHTML = sectionMarkup;
      section._ygMilestoneMarkup = sectionMarkup;
    }
  }

  function applyDonorEvidence() {
    Object.keys(donorMap).forEach(function (donorName) {
      var donor = donorForName(donorName);
      var seededReady = donorsReady && donor && (donor.verifiedEvidence || []).length;
      var ready = donorsReady && (assignmentsReady || seededReady);
      var liveRows = assignments.filter(function (row) { return row.donorName === donorName; });
      var rows = ready ? evidenceRowsForDonor(donorName, liveRows) : [];
      var card = document.querySelector(donorMap[donorName].card);
      if (card) {
        var badge = card.querySelector('.donor-evidence-badge');
        if (!badge) {
          badge = document.createElement('em');
          badge.className = 'donor-evidence-badge';
          card.appendChild(badge);
        }
        var badgeText = !ready
          ? 'Memuat evidence...'
          : rows.length
            ? rows.length + ' evidence terverifikasi'
            : 'Belum ada evidence terverifikasi';
        if (badge.textContent !== badgeText) badge.textContent = badgeText;
        if (badge.classList.contains('has-evidence') !== (rows.length > 0)) {
          badge.classList.toggle('has-evidence', rows.length > 0);
        }
      }
      if (!ready) return;
      renderMilestones(donorName, rows);
      if (donorName === 'Yayasan Penabulu') renderPenabuluEvidence(rows);
      var modal = document.querySelector(donorMap[donorName].modal);
      var evidenceSection = modal && modal.querySelector('.funding-evidence-summary');
      if (evidenceSection) evidenceSection.remove();
    });
  }

  function queueApply() {
    if (applyQueued) return;
    applyQueued = true;
    window.requestAnimationFrame(function () {
      applyQueued = false;
      applyDonorEvidence();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var staffSession = readStaffSession();
    var donorHeaders = { accept: 'application/json' };
    if (staffSession) donorHeaders.authorization = 'Bearer ' + staffSession.token;
    fetch(DONOR_DATA_API + '?t=' + Date.now(), { cache: 'no-store', headers: donorHeaders })
      .then(function (response) {
        if (!response.ok) throw new Error('Data evidence donor tidak dapat dimuat.');
        return response.json();
      })
      .then(function (result) {
        assignments = Array.isArray(result && result.assignments) ? result.assignments : [];
        assignmentsReady = true;
        applyDonorEvidence();
        // dashboard-v3 menghitung layer secara asinkron; pastikan evidence pusat
        // kembali menjadi sumber status setelah kalkulasi layer selesai.
        [500, 1500, 3500, 7000].forEach(function (delay) {
          window.setTimeout(applyDonorEvidence, delay);
        });
      })
      .catch(function (error) {
        assignmentsReady = true;
        applyDonorEvidence();
        console.warn(error.message);
      });
    fetch('data/donors.json?v=20260808-penabulu-plan-evidence1', { cache: 'no-store' })
      .then(function (response) { return response.ok ? response.json() : []; })
      .then(function (result) {
        donors = Array.isArray(result) ? result : [];
        donorsReady = true;
        applyDonorEvidence();
      })
      .catch(function () {
        donorsReady = true;
        applyDonorEvidence();
        // file:// blocks local JSON. Central evidence remains usable, including GEC progress.
      });
    var grid = document.getElementById('donor-grid');
    if (grid && window.MutationObserver) {
      new MutationObserver(queueApply).observe(grid, { childList: true, subtree: true });
    }
    if (window.MutationObserver) {
      [
        'gec2026-progress-nursery',
        'gec2026-status-nursery',
        'gec2026-nursery-brief',
        'gec2026-update-title',
        'gec2026-update-meta'
      ].forEach(function (id) {
        var node = document.getElementById(id);
        if (!node) return;
        new MutationObserver(queueApply).observe(node, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: id === 'gec2026-status-nursery',
          attributeFilter: id === 'gec2026-status-nursery' ? ['class'] : undefined
        });
      });
    }
  });
})();
