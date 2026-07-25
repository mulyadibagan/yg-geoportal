(function () {
  'use strict';

  var API = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var all = [];

  function text(v) { return v === null || v === undefined ? '' : String(v).trim(); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function parse(v) { if (!v) return {}; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch (e) { return {}; } }
  function esc(v) { return text(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeUrl(v) { var url = text(v); return /^https?:\/\//i.test(url) ? url : ''; }
  function driveId(v) {
    var url = text(v);
    var patterns = [
      /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/i,
      /drive\.google\.com\/open\?id=([A-Za-z0-9_-]+)/i,
      /drive\.google\.com\/uc\?(?:[^#]*&)?id=([A-Za-z0-9_-]+)/i,
      /[?&]id=([A-Za-z0-9_-]+)/i
    ];
    for (var i = 0; i < patterns.length; i += 1) {
      var match = url.match(patterns[i]);
      if (match && match[1]) return match[1];
    }
    return '';
  }
  function photoUrl(v) {
    var url = safeUrl(v);
    var id = driveId(url);
    return id ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w1200' : url;
  }

  function documentUrls(v) {
    var values = [];
    if (Array.isArray(v)) {
      values = v;
    } else if (v && typeof v === 'object') {
      values = [v.url || v.webViewLink || v.fileUrl];
    } else {
      var raw = text(v);
      if (raw.charAt(0) === '[') {
        try { values = JSON.parse(raw); } catch (e) { values = []; }
      }
      if (!values.length && raw) values = raw.split(/\r?\n|\s*,\s*/);
    }
    var seen = {};
    return values.map(function (item) {
      return safeUrl(typeof item === 'object' ? (item.url || item.webViewLink || item.fileUrl) : item);
    }).filter(function (url) {
      if (!url || seen[url]) return false;
      seen[url] = 1;
      return true;
    });
  }

  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      var cb = 'ygCapacity' + Date.now() + Math.floor(Math.random() * 1000);
      var s = document.createElement('script');
      window[cb] = function (data) {
        delete window[cb];
        s.remove();
        resolve(data);
      };
      s.onerror = function () {
        delete window[cb];
        s.remove();
        reject(new Error('API'));
      };
      s.src = url + (url.indexOf('?') > -1 ? '&' : '?') + 'callback=' + cb;
      document.head.appendChild(s);
      setTimeout(function () {
        if (window[cb]) {
          delete window[cb];
          s.remove();
          reject(new Error('timeout'));
        }
      }, 15000);
    });
  }

  function dateValue(v) {
    var value = text(v);
    if (!value) return null;
    var local = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\D.*)?$/);
    if (local) {
      var d = new Date(Number(local[3]), Number(local[2]) - 1, Number(local[1]));
      return isNaN(d.getTime()) ? null : d;
    }
    var parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  function yearOf(v) { var d = dateValue(v); return d ? String(d.getFullYear()) : ''; }
  function formatDate(v) { if (!v) return '-'; var d = dateValue(v); return d ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : v; }

  function liveRecord(feature) {
    var p = feature.properties || {};
    var info = parse(p.proposedInformation);
    var changes = parse(p.proposedChanges);
    var c = changes.capacityBuilding || info || {};
    var administrativeLocation = [p.village, p.district, p.regency].map(text).filter(Boolean).join(', ');
    var metadata = p.targetFeatureProperties || {};
    return {
      id: text(p.reportId),
      name: text(p.title) || 'Kegiatan peningkatan kapasitas',
      date: text(p.activityDate) || text(p.publishedAt),
      location: text(p.locationName) || administrativeLocation,
      regency: text(p.regency),
      male: num(c.maleParticipants),
      female: num(c.femaleParticipants),
      youth: num(c.youthTotal),
      target: text(c.participantTarget),
      donor: text(c.donor || metadata.Donor || metadata.Donor_Cluster || metadata.Nama_Donor),
      partner: text(c.partnerOrResourcePerson),
      topic: text(c.topic),
      group: text(c.communityGroup),
      documents: documentUrls(p.documentUrls || p.documents || p.documentUrl || c.documentUrls || c.documentUrl),
      photos: Array.isArray(p.photos) ? p.photos : []
    };
  }

  function populateFilters() {
    ['year', 'regency'].forEach(function (key) {
      var select = document.getElementById('capacity-' + key);
      if (!select) return;
      select.innerHTML = key === 'year'
        ? '<option value="">Semua tahun</option>'
        : '<option value="">Semua kabupaten</option>';
      var vals = {};
      all.forEach(function (r) {
        var v = key === 'year' ? yearOf(r.date) : text(r.regency);
        if (v) vals[v] = 1;
      });
      Object.keys(vals).sort().forEach(function (v) {
        var o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        select.appendChild(o);
      });
    });
  }

  function renderCapacity() {
    var searchNode = document.getElementById('capacity-search');
    var yearNode = document.getElementById('capacity-year');
    var regencyNode = document.getElementById('capacity-regency');
    var box = document.getElementById('capacity-list');
    if (!searchNode || !yearNode || !regencyNode || !box) return;

    var q = text(searchNode.value).toLowerCase();
    var year = yearNode.value;
    var reg = regencyNode.value;
    var rows = all.filter(function (r) {
      var hay = [r.name, r.location, r.target, r.partner, r.topic, r.group].join(' ').toLowerCase();
      return (!q || hay.indexOf(q) > -1) && (!year || yearOf(r.date) === year) && (!reg || r.regency === reg);
    });

    var total = rows.reduce(function (n, r) { return n + num(r.male) + num(r.female); }, 0);
    var women = rows.reduce(function (n, r) { return n + num(r.female); }, 0);
    var youth = rows.reduce(function (n, r) { return n + num(r.youth); }, 0);

    var activitiesNode = document.getElementById('capacity-stat-activities');
    var participantsNode = document.getElementById('capacity-stat-participants');
    var womenNode = document.getElementById('capacity-stat-women');
    var youthNode = document.getElementById('capacity-stat-youth');
    if (activitiesNode) activitiesNode.textContent = rows.length.toLocaleString('id-ID');
    if (participantsNode) participantsNode.textContent = total.toLocaleString('id-ID');
    if (womenNode) womenNode.textContent = women.toLocaleString('id-ID');
    if (youthNode) youthNode.textContent = youth ? youth.toLocaleString('id-ID') : '-';

    if (!rows.length) {
      box.innerHTML = '<div class="capacity-empty">Belum ada kegiatan yang sesuai dengan filter.</div>';
      return;
    }

    box.innerHTML = rows
      .sort(function (a, b) {
        var ad = dateValue(a.date);
        var bd = dateValue(b.date);
        return (bd ? bd.getTime() : 0) - (ad ? ad.getTime() : 0);
      })
      .map(function (r) {
        var photos = (r.photos || []).slice(0, 5).map(function (u) {
          return '<img src="' + esc(photoUrl(u)) + '" alt="Dokumentasi ' + esc(r.name) + '" loading="lazy">';
        }).join('');
        var documents = documentUrls(r.documents || r.documentUrl).map(function (url, index) {
          return '<a class="capacity-document" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Materi ' + (index + 1) + '</a>';
        }).join('');
        return '' +
          '<article class="capacity-card">' +
            '<div class="capacity-card__head">' +
              '<div><h3>' + esc(r.name) + '</h3><p class="capacity-card__location">Lokasi: ' + esc(r.location || '-') + '</p></div>' +
              '<time>' + esc(formatDate(r.date)) + '</time>' +
            '</div>' +
            '<div class="capacity-card__metrics">' +
              '<span>' + (num(r.male) + num(r.female)).toLocaleString('id-ID') + ' peserta</span>' +
              '<span>' + num(r.male) + ' laki-laki</span>' +
              '<span>' + num(r.female) + ' perempuan</span>' +
              (num(r.youth) ? '<span>' + num(r.youth) + ' pemuda</span>' : '') +
            '</div>' +
            '<div class="capacity-card__details">' +
              '<p><strong>Sasaran peserta</strong>' + esc(r.target || r.group || '-') + '</p>' +
              '<p><strong>Donor</strong>' + esc(r.donor || '-') + '</p>' +
              '<p><strong>Mitra/Narasumber</strong>' + esc(r.partner || '-') + '</p>' +
              '<p><strong>Topik/Materi</strong>' + esc(r.topic || '-') + '</p>' +
            '</div>' +
            (documents ? '<div class="capacity-documents">' + documents + '</div>' : '') +
            (photos ? '<div class="capacity-photos">' + photos + '</div>' : '') +
          '</article>';
      }).join('');
  }

  function renderPrepostSummary(data) {
    var sessionsNode = document.getElementById('prepost-stat-sessions');
    var preNode = document.getElementById('prepost-stat-pre');
    var postNode = document.getElementById('prepost-stat-post');
    var gainNode = document.getElementById('prepost-stat-gain');
    var listNode = document.getElementById('prepost-session-list');
    if (!sessionsNode || !preNode || !postNode || !gainNode || !listNode) return;

    var totals = data && data.totals ? data.totals : { sessions: 0, preRespondents: 0, postRespondents: 0, avgGain: 0 };
    sessionsNode.textContent = Number(totals.sessions || 0).toLocaleString('id-ID');
    preNode.textContent = Number(totals.preRespondents || 0).toLocaleString('id-ID');
    postNode.textContent = Number(totals.postRespondents || 0).toLocaleString('id-ID');
    gainNode.textContent = Number(totals.avgGain || 0).toLocaleString('id-ID');

    var sessions = Array.isArray(data && data.sessions) ? data.sessions : [];
    if (!sessions.length) {
      listNode.innerHTML = '<div class="capacity-empty">Belum ada sesi pre/post test.</div>';
      return;
    }

    listNode.innerHTML = sessions.map(function (item) {
      var session = item.session || item;
      var summary = item.summary || {};
      var evidenceStatus = summary.postRespondents > 0 ? 'Lengkap sebagian' : 'Belum ada post-test';
      return '' +
        '<article class="prepost-session-card">' +
          '<div class="prepost-session-card__head">' +
            '<h4>' + esc(session.title || session.sessionId || 'Sesi') + '</h4>' +
            '<span>' + esc(session.activityDate || '-') + '</span>' +
          '</div>' +
          '<p>' + esc(session.location || session.village || '-') + '</p>' +
          '<div class="prepost-session-card__metrics">' +
            '<span>Pre: ' + Number(summary.preRespondents || 0).toLocaleString('id-ID') + '</span>' +
            '<span>Post: ' + Number(summary.postRespondents || 0).toLocaleString('id-ID') + '</span>' +
            '<span>Gain: ' + Number(summary.gainScore || 0).toLocaleString('id-ID') + '</span>' +
            '<span>Status: ' + evidenceStatus + '</span>' +
          '</div>' +
          '<div class="prepost-session-card__links">' +
            (session.preFormUrl ? '<a href="' + esc(session.preFormUrl) + '" target="_blank" rel="noopener noreferrer">Link pre-test</a>' : '') +
            (session.postFormUrl ? '<a href="' + esc(session.postFormUrl) + '" target="_blank" rel="noopener noreferrer">Link post-test</a>' : '') +
            (session.postQrUrl ? '<a href="' + esc(session.postQrUrl) + '" target="_blank" rel="noopener noreferrer">QR post-test</a>' : '') +
          '</div>' +
        '</article>';
    }).join('');
  }

  function postAction(action, payload) {
    var body = new URLSearchParams();
    body.set('action', action);
    body.set('payload', JSON.stringify(payload || {}));
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      mode: 'no-cors',
      body: body.toString()
    });
  }

  async function loadPrepost() {
    var listNode = document.getElementById('prepost-session-list');
    if (listNode) listNode.innerHTML = '<div class="loading">Memuat sesi pre/post test...</div>';
    try {
      var data = await jsonp(API + '?page=prepost-live-summary&scope=active&t=' + Date.now());
      renderPrepostSummary(data || {});
    } catch (error) {
      if (listNode) {
        listNode.innerHTML = '<div class="capacity-empty">Gagal memuat sesi pre/post test. Coba refresh.</div>';
      }
    }
  }

  async function createSessionFromForm() {
    var email = text(document.getElementById('prepost-staff-email') && document.getElementById('prepost-staff-email').value);
    var title = text(document.getElementById('prepost-session-title') && document.getElementById('prepost-session-title').value);
    var activityDate = text(document.getElementById('prepost-session-date') && document.getElementById('prepost-session-date').value);
    var target = num(document.getElementById('prepost-session-target') && document.getElementById('prepost-session-target').value);
    var location = text(document.getElementById('prepost-session-location') && document.getElementById('prepost-session-location').value);
    var facilitator = text(document.getElementById('prepost-session-facilitator') && document.getElementById('prepost-session-facilitator').value);
    var statusNode = document.getElementById('prepost-create-status');

    if (!email || !/@yayasangambut\.org$/i.test(email)) {
      if (statusNode) statusNode.textContent = 'Gunakan email official Yayasan Gambut.';
      return;
    }
    if (!title || !activityDate) {
      if (statusNode) statusNode.textContent = 'Isi nama sesi dan tanggal kegiatan terlebih dahulu.';
      return;
    }

    if (statusNode) statusNode.textContent = 'Mengirim data sesi...';
    try {
      await postAction('prepost-create-session', {
        staffEmail: email,
        title: title,
        activityDate: activityDate,
        targetParticipants: target,
        location: location,
        village: location,
        facilitator: facilitator,
        status: 'active'
      });
      if (statusNode) statusNode.textContent = 'Permintaan pembuatan sesi terkirim. Klik refresh data.';
      loadPrepost();
    } catch (error) {
      if (statusNode) statusNode.textContent = 'Gagal mengirim sesi. Coba lagi.';
    }
  }

  function buildAbcdOptions(answerKey) {
    var optionsMap = [
      { key: 'A', id: 'prepost-option-a' },
      { key: 'B', id: 'prepost-option-b' },
      { key: 'C', id: 'prepost-option-c' },
      { key: 'D', id: 'prepost-option-d' }
    ];
    var selectedKey = text(answerKey).toUpperCase();
    return optionsMap.map(function (item) {
      var field = document.getElementById(item.id);
      var labelText = text(field && field.value);
      if (!labelText) return null;
      return {
        label: item.key + '. ' + labelText,
        value: item.key,
        score: selectedKey && selectedKey === item.key ? 1 : 0
      };
    }).filter(Boolean);
  }

  async function createQuestionFromForm() {
    var email = text(document.getElementById('prepost-staff-email') && document.getElementById('prepost-staff-email').value);
    var sessionId = text(document.getElementById('prepost-question-session') && document.getElementById('prepost-question-session').value);
    var phase = text(document.getElementById('prepost-question-phase') && document.getElementById('prepost-question-phase').value).toLowerCase();
    var questionText = text(document.getElementById('prepost-question-text') && document.getElementById('prepost-question-text').value);
    var answerKey = text(document.getElementById('prepost-answer-key') && document.getElementById('prepost-answer-key').value).toUpperCase();
    var statusNode = document.getElementById('prepost-question-status');

    if (!email || !/@yayasangambut\.org$/i.test(email)) {
      if (statusNode) statusNode.textContent = 'Gunakan email official Yayasan Gambut.';
      return;
    }
    if (!sessionId || !questionText) {
      if (statusNode) statusNode.textContent = 'Isi Session ID dan pertanyaan terlebih dahulu.';
      return;
    }

    if (['A', 'B', 'C', 'D'].indexOf(answerKey) === -1) {
      if (statusNode) statusNode.textContent = 'Pilih kunci jawaban A, B, C, atau D.';
      return;
    }

    var options = buildAbcdOptions(answerKey);
    if (options.length !== 4) {
      if (statusNode) statusNode.textContent = 'Isi lengkap pilihan A, B, C, dan D.';
      return;
    }

    var hasAnswerKeyOption = options.some(function (item) {
      return text(item.value).toUpperCase() === answerKey;
    });
    if (!hasAnswerKeyOption) {
      if (statusNode) statusNode.textContent = 'Kunci jawaban tidak ditemukan pada opsi A/B/C/D yang diisi.';
      return;
    }

    if (statusNode) statusNode.textContent = 'Mengirim pertanyaan...';
    try {
      await postAction('prepost-create-question', {
        staffEmail: email,
        sessionId: sessionId,
        phase: phase === 'post' ? 'post' : 'pre',
        questionText: questionText,
        questionType: 'single',
        options: options,
        maxScore: 1,
        order: 0
      });
      if (statusNode) statusNode.textContent = 'Permintaan tambah pertanyaan terkirim.';
      var questionNode = document.getElementById('prepost-question-text');
      if (questionNode) questionNode.value = '';
      ['prepost-option-a','prepost-option-b','prepost-option-c','prepost-option-d'].forEach(function(id){
        var node = document.getElementById(id);
        if (node) node.value = '';
      });
      var answerNode = document.getElementById('prepost-answer-key');
      if (answerNode) answerNode.value = '';
    } catch (error) {
      if (statusNode) statusNode.textContent = 'Gagal mengirim pertanyaan. Coba lagi.';
    }
  }

  function initTabs() {
    document.querySelectorAll('[data-dashboard-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var capacity = btn.dataset.dashboardView === 'capacity';
        var monitoringView = document.getElementById('monitoring-view');
        var capacityView = document.getElementById('capacity-view');
        if (monitoringView) monitoringView.hidden = capacity;
        if (capacityView) capacityView.hidden = !capacity;
        document.querySelectorAll('[data-dashboard-view]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
      });
    });
  }

  async function loadCapacity() {
    var historical = [];
    try {
      historical = await fetch('data/capacity-building.json?v=20260722-3').then(function (r) { return r.json(); });
    } catch (e) {}

    var live = [];
    try {
      var data = await jsonp(API + '?page=public-reports&t=' + Date.now());
      live = (data.features || [])
        .filter(function (f) { return text((f.properties || {}).reportType) === 'Capacity Building'; })
        .map(liveRecord);
    } catch (e) {}

    var seen = {};
    all = historical.concat(live).filter(function (r) {
      var k = r.id || [r.name, r.date, r.location].join('|');
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    });

    populateFilters();
    renderCapacity();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTabs();

    ['capacity-search', 'capacity-year', 'capacity-regency'].forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) return;
      node.addEventListener(id === 'capacity-search' ? 'input' : 'change', renderCapacity);
    });

    var refreshNode = document.getElementById('prepost-refresh');
    if (refreshNode) refreshNode.addEventListener('click', loadPrepost);
    var createSessionNode = document.getElementById('prepost-create-session');
    if (createSessionNode) createSessionNode.addEventListener('click', createSessionFromForm);
    var createQuestionNode = document.getElementById('prepost-create-question');
    if (createQuestionNode) createQuestionNode.addEventListener('click', createQuestionFromForm);

    loadCapacity();
    loadPrepost();
  });
})();
