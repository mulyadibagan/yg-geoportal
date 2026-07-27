(function () {
  'use strict';

  var API = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var ASSIGNMENT_KEY = 'ygIpemsEvidenceAssignments_v1';
  var PROGRAMME_CONFIG_KEY = 'ygIpemsProgrammeConfig_v1';
  var DONOR_DATA = [];
  var EVIDENCE_DATA = [];

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
    });
  }

  function idFrom(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function isActive(programme) {
    return /^(aktif|berjalan|direncanakan)$/i.test(String(programme.status || '').trim());
  }

  function activePhases(programme) {
    return (programme.phases || []).filter(isActive);
  }

  function isAssignable(programme) {
    return isActive(programme) && (!(programme.phases || []).length || activePhases(programme).length > 0);
  }

  function activeProgrammes(donor) {
    return (donor.programs || []).filter(isAssignable);
  }

  function taggableProgrammes(donor) {
    return (donor.programs || []).filter(function (programme) {
      return (programme.outputs || []).length || isAssignable(programme);
    });
  }

  function localProgrammeConfig() {
    try { return JSON.parse(localStorage.getItem(PROGRAMME_CONFIG_KEY) || '[]'); }
    catch (error) { return []; }
  }

  function applyLocalProgrammeConfig() {
    localProgrammeConfig().forEach(function (entry) {
      var donor = DONOR_DATA.find(function (item) {
        return String(item.id || idFrom(item.name)) === entry.donorId;
      });
      if (!donor) return;
      donor.programs = donor.programs || [];
      var index = donor.programs.findIndex(function (programme) {
        return String(programme.id || '') === String(entry.recordId || '');
      });
      if (index > -1) donor.programs[index] = Object.assign({}, donor.programs[index], entry.record);
      else donor.programs.push(entry.record);
    });
  }

  function programmeDisplayName(programme) {
    var title = programme.name || (programme.referenceLabel ? programme.referenceLabel + ' · Judul belum diisi' : 'Judul belum diisi');
    return [programme.phase, title].filter(Boolean).join(' · ');
  }

  function assignments() {
    try { return JSON.parse(localStorage.getItem(ASSIGNMENT_KEY) || '[]'); }
    catch (error) { return []; }
  }

  function saveAssignments(rows) {
    localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(rows));
  }

  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      var callback = 'ygIpemsAdmin_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      var script = document.createElement('script');
      window[callback] = function (data) {
        delete window[callback];
        script.remove();
        resolve(data);
      };
      script.onerror = function () {
        delete window[callback];
        script.remove();
        reject(new Error('Evidence API tidak dapat dimuat.'));
      };
      script.src = url + (url.indexOf('?') > -1 ? '&' : '?') +
        'callback=' + encodeURIComponent(callback) + '&t=' + Date.now();
      document.head.appendChild(script);
    });
  }

  function evidenceLabel(feature) {
    var props = feature.properties || {};
    var title = props.title || props.locationName || props.targetObjectName || 'Evidence tanpa judul';
    var type = props.reportType || 'Evidence';
    var village = props.village || '';
    return [type, title, village].filter(Boolean).join(' · ');
  }

  function evidenceId(feature, index) {
    return String((feature.properties || {}).reportId || feature.id || ('EV-LOCAL-' + index));
  }

  function renderEvidenceOptions() {
    var select = document.getElementById('assignment-evidence');
    var used = {};
    assignments().forEach(function (row) { used[row.evidenceId] = true; });
    var available = EVIDENCE_DATA.filter(function (feature, index) {
      return !used[evidenceId(feature, index)];
    });
    select.innerHTML = '<option value="">Pilih evidence yang akan diverifikasi</option>' +
      available.slice(0, 100).map(function (feature, index) {
        var originalIndex = EVIDENCE_DATA.indexOf(feature);
        return '<option value="' + esc(evidenceId(feature, originalIndex)) + '">' +
          esc(evidenceLabel(feature)) + '</option>';
      }).join('');
    if (!available.length) select.innerHTML += '<option disabled>Tidak ada evidence yang belum dihubungkan</option>';
  }

  function renderDonors() {
    var donorSelect = document.getElementById('assignment-donor');
    var taggableDonors = DONOR_DATA.filter(function (donor) { return taggableProgrammes(donor).length; });
    donorSelect.innerHTML = '<option value="">Pilih donor</option>' +
      taggableDonors.map(function (donor) {
        var hasActive = activeProgrammes(donor).length > 0;
        return '<option value="' + esc(donor.id || idFrom(donor.name)) + '">' +
          esc(donor.name + (hasActive ? ' · aktif' : ' · selesai / historis')) + '</option>';
      }).join('');

    document.getElementById('admin-donor-status-list').innerHTML = DONOR_DATA.map(function (donor) {
      var active = activeProgrammes(donor);
      var completed = (donor.programs || []).length - active.length;
      return '<article class="admin-donor-item"><header><strong>' + esc(donor.name) + '</strong>' +
        '<span class="' + (active.length ? 'is-active' : 'is-complete') + '">' +
        (active.length ? 'AKTIF' : 'SELESAI') + '</span></header>' +
        '<small>' + active.length + ' aktif · ' + completed + ' selesai</small></article>';
    }).join('');
  }

  function selectedDonor() {
    var id = document.getElementById('assignment-donor').value;
    return DONOR_DATA.find(function (donor) {
      return String(donor.id || idFrom(donor.name)) === id;
    });
  }

  function renderProgrammes() {
    var donor = selectedDonor();
    var select = document.getElementById('assignment-programme');
    var indicator = document.getElementById('assignment-indicator');
    var programmes = donor ? taggableProgrammes(donor) : [];
    select.disabled = !programmes.length;
    var options = [];
    programmes.forEach(function (programme) {
      var programmeId = programme.id || ('PRG-' + idFrom(donor.name + '-' + programme.name));
      if ((programme.phases || []).length) {
        activePhases(programme).forEach(function (phase) {
          options.push({
            id: phase.id || ('PHS-' + idFrom(programmeId + '-' + phase.name)),
            label: programme.name + ' · ' + phase.name + ' (' + (phase.period || programme.period || '') + ')'
          });
        });
      } else {
        options.push({
          id: programmeId,
          label: programmeDisplayName(programme) + ' · ' + (programme.period || '') +
            ' · ' + (isActive(programme) ? 'Aktif' : 'Selesai / historis')
        });
      }
    });
    select.innerHTML = '<option value="">Pilih program/fase</option>' + options.map(function (item) {
      return '<option value="' + esc(item.id) + '">' + esc(item.label) + '</option>';
    }).join('');
    indicator.disabled = true;
    indicator.innerHTML = '<option value="">Pilih capaian</option>';
  }

  function renderIndicators() {
    var donor = selectedDonor();
    var programmeId = document.getElementById('assignment-programme').value;
    var select = document.getElementById('assignment-indicator');
    var programme = donor && programmeId ? programmeById(donor, programmeId) : null;
    var indicators = [];
    if (programme && (programme.outputs || []).length) {
      (programme.outputs || []).forEach(function (output) {
        (output.activities || []).forEach(function (activity) {
          indicators.push({
            id: activity.id,
            label: output.name + ' → ' + activity.name,
            value: activity.indicator
          });
        });
      });
    } else if (donor && programmeId) {
      indicators = donor.indicators || [];
    }
    select.disabled = !indicators.length;
    select.innerHTML = '<option value="">Pilih capaian/indikator</option>' + indicators.map(function (item, index) {
      var id = item.id || ((donor.id || idFrom(donor.name)) + '-KPI-' + (index + 1));
      return '<option value="' + esc(id) + '">' + esc(item.label + ' · capaian saat ini ' + item.value) + '</option>';
    }).join('');
  }

  function programmeById(donor, programmeId) {
    var match = null;
    (donor.programs || []).some(function (programme) {
      var id = String(programme.id || ('PRG-' + idFrom(donor.name + '-' + programme.name)));
      if (id === programmeId && ((programme.outputs || []).length || isAssignable(programme))) {
        match = programme;
        return true;
      }
      return (programme.phases || []).some(function (phase) {
        var phaseId = String(phase.id || ('PHS-' + idFrom(id + '-' + phase.name)));
        if (phaseId !== programmeId || !isActive(phase)) return false;
        match = {
          id: phaseId,
          name: programme.name + ' / ' + phase.name,
          period: phase.period,
          status: phase.status,
          parentProgrammeId: id
        };
        return true;
      });
    });
    return match;
  }

  function indicatorById(donor, programme, indicatorId) {
    var activityMatch = null;
    ((programme && programme.outputs) || []).some(function (output) {
      return (output.activities || []).some(function (activity) {
        if (String(activity.id) !== indicatorId) return false;
        activityMatch = {
          id: activity.id,
          label: output.name + ' → ' + activity.name,
          value: activity.indicator
        };
        return true;
      });
    });
    if (activityMatch) return activityMatch;
    return (donor.indicators || []).find(function (item, index) {
      return String(item.id || ((donor.id || idFrom(donor.name)) + '-KPI-' + (index + 1))) === indicatorId;
    });
  }

  function renderHistory() {
    var rows = assignments();
    var container = document.getElementById('assignment-history');
    if (!rows.length) {
      container.innerHTML = '<div class="assignment-empty">Belum ada assignment pada browser ini.</div>';
      renderEvidenceOptions();
      return;
    }
    container.innerHTML = rows.slice().reverse().map(function (row) {
      return '<article class="assignment-record">' +
        '<div><strong>' + esc(row.evidenceTitle) + '</strong><small>' + esc(row.evidenceId) + '</small></div>' +
        '<div><span>' + esc(row.donorName) + '</span><small>' + esc(row.programmeName) + '</small></div>' +
        '<div><span>' + esc(row.indicatorLabel) + '</span><small>Diverifikasi ' + esc(row.verifiedAtLabel) + '</small></div>' +
        '<button type="button" data-remove-assignment="' + esc(row.assignmentId) + '">Batalkan</button>' +
      '</article>';
    }).join('');
    renderEvidenceOptions();
  }

  function saveAssignment(event) {
    event.preventDefault();
    var evidenceIdValue = document.getElementById('assignment-evidence').value;
    var donor = selectedDonor();
    var programmeId = document.getElementById('assignment-programme').value;
    var indicatorId = document.getElementById('assignment-indicator').value;
    var programme = donor && programmeById(donor, programmeId);
    var indicator = donor && indicatorById(donor, programme, indicatorId);
    var evidence = EVIDENCE_DATA.find(function (feature, index) {
      return evidenceId(feature, index) === evidenceIdValue;
    });
    var feedback = document.getElementById('assignment-feedback');

    if (!evidence || !donor || !programme || !indicator) {
      feedback.textContent = 'Lengkapi pilihan evidence, donor, program/fase, dan capaian.';
      return;
    }

    var now = new Date();
    var rows = assignments();
    rows.push({
      assignmentId: 'ASN-LOCAL-' + now.getTime(),
      evidenceId: evidenceIdValue,
      evidenceTitle: evidenceLabel(evidence),
      donorId: donor.id || idFrom(donor.name),
      donorName: donor.name,
      programmeId: programmeId,
      programmeName: programmeDisplayName(programme),
      indicatorId: indicatorId,
      indicatorLabel: indicator.label,
      note: document.getElementById('assignment-note').value.trim(),
      verifiedAt: now.toISOString(),
      verifiedAtLabel: now.toLocaleString('id-ID')
    });
    saveAssignments(rows);
    event.target.reset();
    renderProgrammes();
    renderHistory();
    feedback.textContent = 'Assignment lokal berhasil disimpan.';
  }

  function renderProgrammeAdmin() {
    var donorSelect = document.getElementById('programme-admin-donor');
    var currentDonorId = donorSelect.value;
    donorSelect.innerHTML = '<option value="">Pilih donor</option>' + DONOR_DATA.map(function (donor) {
      var id = donor.id || idFrom(donor.name);
      return '<option value="' + esc(id) + '">' + esc(donor.name) + '</option>';
    }).join('');
    if (currentDonorId) donorSelect.value = currentDonorId;
    renderProgrammeRecords();

    document.getElementById('programme-register').innerHTML = DONOR_DATA.map(function (donor) {
      var activeCount = activeProgrammes(donor).length;
      var programmes = (donor.programs || []).map(function (programme) {
        var framework = (programme.outputs || []).length
          ? '<div class="programme-framework">' +
              '<p><b>Goal</b>' + esc(programme.goal || '—') + '</p>' +
              '<p><b>Outcome</b>' + esc(programme.outcome || '—') + '</p>' +
              '<div class="programme-output-list">' + programme.outputs.map(function (output) {
                return '<details><summary>' + esc(output.name) + '<small>' +
                  (output.activities || []).length + ' aktivitas</small></summary><ul>' +
                  (output.activities || []).map(function (activity) {
                    return '<li><span>' + esc(activity.name) + '</span><small>' +
                      esc(activity.indicator) + '</small></li>';
                  }).join('') + '</ul></details>';
              }).join('') + '</div></div>'
          : '';
        return '<article class="programme-register-card"><header><div><strong>' + esc(programmeDisplayName(programme)) +
          '</strong><small>' + esc([programme.duration, programme.period].filter(Boolean).join(' · ')) + '</small></div><b class="' +
          (isAssignable(programme) ? 'is-active' : 'is-complete') + '">' +
          esc(isAssignable(programme) ? 'Aktif' : programme.status || 'Selesai') + '</b></header>' +
          (programme.detailsPending ? '<small class="programme-needs-detail">Judul dan keterangan belum diisi</small>' : '') +
          framework + '</article>';
      }).join('');
      return '<section class="donor-register-group"><div class="donor-register-head"><h3>' + esc(donor.name) +
        '</h3><span class="' + (activeCount ? 'is-active' : 'is-complete') + '">' +
        (activeCount ? 'DONOR AKTIF' : 'TIDAK AKTIF') + '</span></div>' + programmes + '</section>';
    }).join('');
  }

  function renderProgrammeRecords() {
    var donorId = document.getElementById('programme-admin-donor').value;
    var donor = DONOR_DATA.find(function (item) {
      return String(item.id || idFrom(item.name)) === donorId;
    });
    var select = document.getElementById('programme-admin-record');
    select.innerHTML = '<option value="">Tambah program/project baru</option>' + ((donor && donor.programs) || []).map(function (programme) {
      var id = programme.id || ('PRG-' + idFrom(donor.name + '-' + programme.name));
      return '<option value="' + esc(id) + '">' + esc(programmeDisplayName(programme) + ' · ' + (programme.period || '')) + '</option>';
    }).join('');
  }

  function addLogframeRow(value) {
    value = value || {};
    var row = document.createElement('div');
    row.className = 'logframe-row';
    row.innerHTML =
      '<label>Outcome<textarea class="logframe-outcome" rows="2" placeholder="Outcome">' + esc(value.outcome || '') + '</textarea></label>' +
      '<label>Output<textarea class="logframe-output" rows="2" placeholder="Output">' + esc(value.output || '') + '</textarea></label>' +
      '<label>Activity<textarea class="logframe-activity" rows="2" placeholder="Activity">' + esc(value.activity || '') + '</textarea></label>' +
      '<label>Indicator<textarea class="logframe-indicator" rows="2" placeholder="Indicator">' + esc(value.indicator || '') + '</textarea></label>' +
      '<button class="remove-logframe-row" type="button" aria-label="Hapus baris logframe">×</button>';
    document.getElementById('logframe-rows').appendChild(row);
  }

  function populateLogframe(programme) {
    var container = document.getElementById('logframe-rows');
    container.innerHTML = '';
    if (programme && (programme.outputs || []).length) {
      programme.outputs.forEach(function (output) {
        (output.activities || []).forEach(function (activity) {
          addLogframeRow({
            outcome: output.outcome || programme.outcome || '',
            output: output.name || '',
            activity: activity.name || '',
            indicator: activity.indicator || ''
          });
        });
      });
    }
    if (!container.children.length) addLogframeRow();
  }

  function collectLogframe() {
    var groups = {};
    Array.from(document.querySelectorAll('.logframe-row')).forEach(function (row) {
      var outcome = row.querySelector('.logframe-outcome').value.trim();
      var output = row.querySelector('.logframe-output').value.trim();
      var activity = row.querySelector('.logframe-activity').value.trim();
      var indicator = row.querySelector('.logframe-indicator').value.trim();
      if (!outcome && !output && !activity && !indicator) return;
      var key = outcome + '\u001f' + output;
      if (!groups[key]) {
        groups[key] = {
          id: 'OUT-LOCAL-' + idFrom(output || key) + '-' + Object.keys(groups).length,
          name: output,
          outcome: outcome,
          activities: []
        };
      }
      groups[key].activities.push({
        id: 'ACT-LOCAL-' + idFrom(activity || indicator) + '-' + groups[key].activities.length,
        name: activity,
        indicator: indicator
      });
    });
    return Object.keys(groups).map(function (key) { return groups[key]; });
  }

  function loadProgrammeRecord() {
    var donorId = document.getElementById('programme-admin-donor').value;
    var recordId = document.getElementById('programme-admin-record').value;
    var donor = DONOR_DATA.find(function (item) { return String(item.id || idFrom(item.name)) === donorId; });
    var programme = donor && (donor.programs || []).find(function (item) { return String(item.id || '') === recordId; });
    document.getElementById('programme-admin-phase').value = programme ? (programme.phase || '') : '';
    document.getElementById('programme-admin-name').value = programme ? (programme.name || '') : '';
    document.getElementById('programme-admin-period').value = programme ? (programme.period || '') : '';
    document.getElementById('programme-admin-status').value = programme ? (programme.status || 'Aktif') : 'Aktif';
    document.getElementById('programme-admin-organization').value = programme ? (programme.implementingOrganization || '') : '';
    document.getElementById('programme-admin-locations').value = programme ? ((programme.locations || []).join(', ')) : '';
    document.getElementById('programme-admin-summary').value = programme ? (programme.summary || '') : '';
    document.getElementById('programme-admin-goal').value = programme ? (programme.goal || '') : '';
    populateLogframe(programme);
  }

  function saveProgrammeConfig(event) {
    event.preventDefault();
    var donorId = document.getElementById('programme-admin-donor').value;
    var recordId = document.getElementById('programme-admin-record').value;
    var phase = document.getElementById('programme-admin-phase').value.trim();
    var name = document.getElementById('programme-admin-name').value.trim();
    var period = document.getElementById('programme-admin-period').value.trim();
    var status = document.getElementById('programme-admin-status').value;
    var organization = document.getElementById('programme-admin-organization').value.trim();
    var locations = document.getElementById('programme-admin-locations').value.split(',').map(function (item) { return item.trim(); }).filter(Boolean);
    var summary = document.getElementById('programme-admin-summary').value.trim();
    var goal = document.getElementById('programme-admin-goal').value.trim();
    var outputs = collectLogframe();
    var feedback = document.getElementById('programme-admin-feedback');
    if (!donorId || !name || !period) {
      feedback.textContent = 'Lengkapi donor, judul resmi, dan periode program/project.';
      return;
    }
    var savedId = recordId || ('PRG-LOCAL-' + Date.now());
    var entry = {
      donorId: donorId,
      recordId: savedId,
      record: {
        id: savedId,
        phase: phase,
        name: name,
        period: period,
        status: status,
        implementingOrganization: organization,
        locations: locations,
        goal: goal,
        outcome: outputs.length ? outputs[0].outcome : '',
        summary: summary,
        outputs: outputs,
        detailsPending: false
      }
    };
    var rows = localProgrammeConfig().filter(function (item) {
      return !(item.donorId === donorId && String(item.recordId) === String(savedId));
    });
    rows.push(entry);
    localStorage.setItem(PROGRAMME_CONFIG_KEY, JSON.stringify(rows));
    var donor = DONOR_DATA.find(function (item) { return String(item.id || idFrom(item.name)) === donorId; });
    donor.programs = donor.programs || [];
    var existingIndex = donor.programs.findIndex(function (item) { return String(item.id || '') === String(savedId); });
    if (existingIndex > -1) donor.programs[existingIndex] = Object.assign({}, donor.programs[existingIndex], entry.record);
    else donor.programs.push(entry.record);
    event.target.reset();
    populateLogframe(null);
    renderDonors();
    renderProgrammeAdmin();
    renderProgrammes();
    feedback.textContent = 'Konfigurasi lokal disimpan. Status donor diperbarui otomatis.';
  }

  function bind() {
    document.getElementById('assignment-donor').addEventListener('change', renderProgrammes);
    document.getElementById('assignment-programme').addEventListener('change', renderIndicators);
    document.getElementById('evidence-assignment-form').addEventListener('submit', saveAssignment);
    document.getElementById('programme-admin-donor').addEventListener('change', function () {
      renderProgrammeRecords();
      loadProgrammeRecord();
    });
    document.getElementById('programme-admin-record').addEventListener('change', loadProgrammeRecord);
    document.getElementById('add-logframe-row').addEventListener('click', function () { addLogframeRow(); });
    document.getElementById('logframe-rows').addEventListener('click', function (event) {
      var button = event.target.closest('.remove-logframe-row');
      if (!button) return;
      button.closest('.logframe-row').remove();
      if (!document.querySelector('.logframe-row')) addLogframeRow();
    });
    document.getElementById('programme-admin-form').addEventListener('submit', saveProgrammeConfig);
    document.getElementById('reset-programme-config').addEventListener('click', function () {
      localStorage.removeItem(PROGRAMME_CONFIG_KEY);
      location.reload();
    });
    document.getElementById('assignment-history').addEventListener('click', function (event) {
      var button = event.target.closest('[data-remove-assignment]');
      if (!button) return;
      saveAssignments(assignments().filter(function (row) {
        return row.assignmentId !== button.dataset.removeAssignment;
      }));
      renderHistory();
      document.getElementById('assignment-feedback').textContent = 'Assignment lokal dibatalkan.';
    });
  }

  function init() {
    bind();
    Promise.all([
      fetch('data/donors.json?v=20260727-output-tag1', { cache: 'no-store' }).then(function (response) { return response.json(); }),
      jsonp(API + '?page=public-reports').catch(function () { return { features: [] }; })
    ]).then(function (results) {
      DONOR_DATA = results[0] || [];
      applyLocalProgrammeConfig();
      EVIDENCE_DATA = (results[1] && results[1].features) || [];
      renderDonors();
      renderProgrammeAdmin();
      populateLogframe(null);
      renderHistory();
      if (!EVIDENCE_DATA.length) {
        document.getElementById('assignment-feedback').textContent =
          'API evidence tidak tersedia; status donor tetap dapat diuji.';
      }
    }).catch(function (error) {
      document.getElementById('assignment-feedback').textContent = error.message;
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
