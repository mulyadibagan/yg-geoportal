(function () {
  'use strict';

  var API = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var all = [];
  var prepostSessions = [];
  var prepostSummaryData = null;
  var prepostVisibleCount = 6;
  var sourceCounts = { baseline: 0, published: 0 };

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
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (error) {}
        }
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
      var d = new Date(Date.UTC(Number(local[3]), Number(local[2]) - 1, Number(local[1])));
      return isNaN(d.getTime()) ? null : d;
    }
    var parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  function yearOf(v) { var d = dateValue(v); return d ? String(d.getUTCFullYear()) : ''; }
  function formatDate(v) { if (!v) return '-'; var d = dateValue(v); return d ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : v; }
  function formatPct(v, digits) {
    var d = typeof digits === 'number' ? digits : 1;
    return Number(v || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: d }) + '%';
  }
  function formatLocalDateTime(v) {
    var value = text(v);
    if (!value) return '-';
    var dt = new Date(value);
    if (isNaN(dt.getTime())) return value;
    return dt.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function mapBreakdownRows(source) {
    var obj = source && typeof source === 'object' ? source : {};
    return Object.keys(obj).map(function (key) {
      return { label: text(key), value: Number(obj[key] || 0) };
    }).filter(function (item) {
      return item.label && item.value > 0;
    }).sort(function (a, b) {
      return b.value - a.value;
    });
  }

  function renderBreakdownInline(source, emptyLabel) {
    var rows = mapBreakdownRows(source);
    if (!rows.length) return '<span class="prepost-breakdown-empty">' + esc(emptyLabel) + '</span>';
    return rows.map(function (item) {
      return '<span class="prepost-breakdown-chip">' + esc(item.label) + ': ' + Number(item.value).toLocaleString('id-ID') + '</span>';
    }).join('');
  }

  function buildLiveSessionDetailUrl(sessionId) {
    return 'prepost-live-session.html?session=' + encodeURIComponent(text(sessionId));
  }

  function liveRecord(feature) {
    var p = feature.properties || {};
    var info = parse(p.proposedInformation);
    var changes = parse(p.proposedChanges);
    var c = changes.capacityBuilding || info || {};
    var administrativeLocation = [p.village, p.district, p.regency].map(text).filter(Boolean).join(', ');
    var metadata = p.targetFeatureProperties || {};
    return {
      kind: 'training',
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
      supportSessionId: text(c.supportSessionId),
      supportTestSummary: c.supportTestSummary && typeof c.supportTestSummary === 'object'
        ? c.supportTestSummary : parse(c.supportTestSummary),
      documents: documentUrls(p.documentUrls || p.documents || p.documentUrl || c.documentUrls || c.documentUrl),
      photos: Array.isArray(p.photos) ? p.photos : []
    };
  }

  function activityEngagementRecord(feature) {
    var p = feature.properties || {};
    var metadata = p.targetFeatureProperties || {};
    var participants = num(metadata.Jumlah_Peserta || metadata.Peserta);
    var female = num(metadata.Peserta_Perempuan || metadata.Perempuan);
    if (!participants) return null;
    return {
      kind: 'activity-engagement',
      activityType: text(metadata.Jenis_Kegiatan || metadata.Kategori || metadata.Program) || 'Kegiatan lapangan',
      id: text(p.reportId),
      name: text(p.title) || 'Kegiatan pelibatan masyarakat',
      date: text(p.activityDate) || text(p.publishedAt),
      location: text(p.locationName) || [p.village, p.district, p.regency].map(text).filter(Boolean).join(', '),
      regency: text(p.regency),
      male: Math.max(0, participants - female),
      female: female,
      youth: num(metadata.Peserta_Pemuda),
      target: text(metadata.Kelompok_Terlibat),
      donor: text(metadata.Donor || metadata.Donor_Cluster || metadata.Nama_Donor),
      partner: text(metadata.Kelompok_Terlibat),
      topic: text(metadata.Jenis_Kegiatan) || 'Pelibatan masyarakat dalam kegiatan lapangan',
      group: text(metadata.Kelompok_Terlibat),
      documents: [],
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
    var sourceNode = document.getElementById('capacity-source-status');
    if(sourceNode)sourceNode.textContent='Sumber kanonik: '+sourceCounts.baseline.toLocaleString('id-ID')+
      ' arsip tervalidasi + '+sourceCounts.published.toLocaleString('id-ID')+
      ' laporan terpublikasi · duplikat ID dihitung satu kali.';

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
        var testSummary = r.supportTestSummary || {};
        var posttest = r.supportSessionId
          ? '<div class="capacity-posttest-summary"><div><span>POST-TEST SESSION</span>' +
            '<strong>' + num(testSummary.postRespondents).toLocaleString('id-ID') +
            ' responden post-test</strong><small>Skor rata-rata ' +
            num(testSummary.postAvgScore).toLocaleString('id-ID', { maximumFractionDigits: 2 }) +
            (num(testSummary.completionRate) ? ' · completion ' +
              num(testSummary.completionRate).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '%' : '') +
            '</small></div><a href="' + esc(buildLiveSessionDetailUrl(r.supportSessionId)) +
            '">Buka detail post-test →</a></div>'
          : '';
        return '' +
          '<article class="capacity-card" data-capacity-report-id="' + esc(r.id || '') + '">' +
            '<div class="capacity-card__head">' +
              '<div><span class="type-label">' + (r.kind === 'activity-engagement' ? 'PELAPORAN PELIBATAN · ' + esc(r.activityType || 'KEGIATAN LAPANGAN') : 'PELATIHAN / CAPACITY BUILDING') + '</span><h3>' + esc(r.name) + '</h3><p class="capacity-card__location">Lokasi: ' + esc(r.location || '-') + '</p></div>' +
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
            posttest +
            (photos ? '<div class="capacity-photos">' + photos + '</div>' : '') +
          '</article>';
      }).join('');

    var requestedReport = new URLSearchParams(window.location.search).get('report');
    if (requestedReport) {
      var requestedCard = Array.prototype.find.call(
        box.querySelectorAll('[data-capacity-report-id]'),
        function (card) { return card.dataset.capacityReportId === requestedReport; }
      );
      if (requestedCard) {
        requestedCard.classList.add('is-requested-report');
        window.requestAnimationFrame(function () {
          requestedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          requestedCard.focus({ preventScroll: true });
        });
        requestedCard.tabIndex = -1;
      }
    }
  }

  function renderPrepostSummary(data) {
    prepostSummaryData = data;
    var sessionsNode = document.getElementById('prepost-stat-sessions');
    var preNode = document.getElementById('prepost-stat-pre');
    var postNode = document.getElementById('prepost-stat-post');
    var gainNode = document.getElementById('prepost-stat-gain');
    var targetNode = document.getElementById('prepost-stat-target');
    var completionNode = document.getElementById('prepost-stat-completion');
    var postPercentNode = document.getElementById('prepost-stat-post-percent');
    var conversionNode = document.getElementById('prepost-stat-conversion');
    var metaNode = document.getElementById('prepost-live-meta');
    var listNode = document.getElementById('prepost-session-list');
    if (!sessionsNode || !postNode || !gainNode || !listNode) return;

    var totals = data && data.totals ? data.totals : { sessions: 0, preRespondents: 0, postRespondents: 0, avgGain: 0 };
    sessionsNode.textContent = Number(totals.sessions || 0).toLocaleString('id-ID');
    if (preNode) preNode.textContent = Number(totals.preRespondents || 0).toLocaleString('id-ID');
    postNode.textContent = Number(totals.postRespondents || 0).toLocaleString('id-ID');
    gainNode.textContent = Number(totals.avgGain || 0).toLocaleString('id-ID');
    if (metaNode) {
      metaNode.textContent = 'Pembaruan terakhir: ' + formatLocalDateTime(data && data.generatedAt);
    }

    var sessions = Array.isArray(data && data.sessions) ? data.sessions : [];
    prepostSessions = sessions.map(function (item) { return item.session || item; }).filter(Boolean);
    renderManageSessionOptions(prepostSessions);

    var aggregate = sessions.reduce(function (acc, item) {
      var summary = item.summary || {};
      var target = Number(item.targetParticipants || 0);
      var pre = Number(summary.preRespondents || 0);
      var post = Number(summary.postRespondents || 0);
      var postPercent = Number(summary.postAvgPercent || 0);
      acc.target += target;
      acc.pre += pre;
      acc.post += post;
      if (post > 0) {
        acc.postPercentWeighted += (postPercent * post);
        acc.postPercentBase += post;
      }
      return acc;
    }, {
      target: 0,
      pre: 0,
      post: 0,
      postPercentWeighted: 0,
      postPercentBase: 0
    });

    if (targetNode) targetNode.textContent = Number(aggregate.target || 0).toLocaleString('id-ID');
    if (completionNode) {
      var completion = aggregate.target > 0 ? (aggregate.post / aggregate.target) * 100 : 0;
      completionNode.textContent = formatPct(completion, 1);
    }
    if (postPercentNode) {
      var weightedPostPercent = aggregate.postPercentBase > 0
        ? (aggregate.postPercentWeighted / aggregate.postPercentBase)
        : 0;
      postPercentNode.textContent = formatPct(weightedPostPercent, 1);
    }
    if (conversionNode) {
      var conversion = aggregate.pre > 0 ? (aggregate.post / aggregate.pre) * 100 : 0;
      conversionNode.textContent = formatPct(conversion, 1);
    }

    if (!sessions.length) {
      listNode.innerHTML = '<div class="capacity-empty">Belum ada sesi pre/post test.</div>';
      return;
    }

    var visibleSessions = sessions.slice(0, prepostVisibleCount);
    listNode.innerHTML = visibleSessions.map(function (item) {
      var session = item.session || item;
      var summary = item.summary || {};
      var preRespondents = Number(summary.preRespondents || 0);
      var postRespondents = Number(summary.postRespondents || 0);
      var preQuestions = Number(summary.preQuestionCount || 0);
      var postQuestions = Number(summary.postQuestionCount || 0);
      var completionRate = Number(summary.completionRate || 0);
      var evidenceStatus = 'Belum ada responden';
      if (preQuestions === 0 && postQuestions === 0) {
        evidenceStatus = 'Soal belum dibuat';
      } else if (postRespondents === 0 && preRespondents > 0) {
        evidenceStatus = 'Belum ada post-test';
      } else if (postRespondents > 0 && preRespondents === 0) {
        evidenceStatus = 'Post-test berjalan';
      } else if (postRespondents > 0 && preRespondents > 0 && postRespondents < preRespondents) {
        evidenceStatus = 'Perlu dorong penyelesaian post-test';
      } else if (postRespondents > 0) {
        evidenceStatus = 'Data pre/post tersedia';
      }

      var detailUrl = buildLiveSessionDetailUrl(session.sessionId || '');

      return '' +
        '<article class="prepost-session-card prepost-session-card--compact prepost-session-card--clickable" data-session-id="' + esc(session.sessionId || '') + '" tabindex="0" role="link" aria-label="Buka detail live session ' + esc(session.title || session.sessionId || 'sesi') + '">' +
          '<div class="prepost-session-card__head">' +
            '<h4>' + esc(session.title || session.sessionId || 'Sesi') + '</h4>' +
            '<span>' + esc(session.activityDate || '-') + '</span>' +
          '</div>' +
          '<p>' + esc(session.location || session.village || '-') + '</p>' +
          '<span class="prepost-session-card__status">' + esc(evidenceStatus) + '</span>' +
          '<div class="prepost-session-card__metrics prepost-session-card__metrics--compact">' +
            '<span><small>Responden</small><strong>' + postRespondents.toLocaleString('id-ID') + '</strong></span>' +
            '<span><small>Nilai post</small><strong>' + formatPct(summary.postAvgPercent || 0, 1) + '</strong></span>' +
            '<span><small>Cakupan</small><strong>' + formatPct(completionRate, 1) + '</strong></span>' +
          '</div>' +
          '<div class="prepost-session-card__links">' +
            (session.sessionId ? '<a class="prepost-session-card__detail-link" href="' + esc(detailUrl) + '">Buka detail sesi</a>' : '') +
          '</div>' +
        '</article>';
    }).join('') +
      (sessions.length > prepostVisibleCount
        ? '<button type="button" class="prepost-load-more" data-prepost-load-more>Tampilkan ' +
          Math.min(6, sessions.length - prepostVisibleCount).toLocaleString('id-ID') +
          ' sesi berikutnya <small>' + prepostVisibleCount.toLocaleString('id-ID') + ' dari ' +
          sessions.length.toLocaleString('id-ID') + ' ditampilkan</small></button>'
        : '');
  }

  function initPrepostSessionCardNavigation() {
    var list = document.getElementById('prepost-session-list');
    if (!list || list.dataset.navBound) return;

    function goToDetail(card) {
      var id = text(card && card.getAttribute('data-session-id'));
      if (!id) return;
      window.location.href = buildLiveSessionDetailUrl(id);
    }

    list.addEventListener('click', function (event) {
      var loadMore = event.target && event.target.closest ? event.target.closest('[data-prepost-load-more]') : null;
      if (loadMore) {
        prepostVisibleCount += 6;
        renderPrepostSummary(prepostSummaryData);
        return;
      }
      if (event.target && event.target.closest && event.target.closest('a')) return;
      var card = event.target && event.target.closest ? event.target.closest('.prepost-session-card--clickable') : null;
      if (!card) return;
      goToDetail(card);
    });

    list.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var card = event.target && event.target.closest ? event.target.closest('.prepost-session-card--clickable') : null;
      if (!card) return;
      event.preventDefault();
      goToDetail(card);
    });

    list.dataset.navBound = '1';
  }

  function renderManageSessionOptions(sessions) {
    var select = document.getElementById('prepost-manage-session');
    if (!select) return;

    var currentValue = text(select.value);
    var options = ['<option value="">Pilih Session ID</option>'];
    (sessions || []).forEach(function (session) {
      var id = text(session && session.sessionId);
      if (!id) return;
      var title = text(session.title || id);
      var date = text(session.activityDate);
      options.push('<option value="' + esc(id) + '">' + esc(title + ' (' + id + ')' + (date ? ' - ' + date : '')) + '</option>');
    });
    select.innerHTML = options.join('');

    if (currentValue && select.querySelector('option[value="' + currentValue.replace(/"/g, '&quot;') + '"]')) {
      select.value = currentValue;
    }

    var manualSessionId = document.getElementById('prepost-question-session');
    var manualValue = text(manualSessionId && manualSessionId.value);
    if (!currentValue && manualValue) {
      select.value = manualValue;
    }

    syncPosttestBuilderLink(text(select.value) || manualValue);
  }

  function selectedBuilderPhase() {
    var phaseNode = document.getElementById('prepost-builder-phase');
    var phase = text(phaseNode && phaseNode.value).toLowerCase();
    return phase === 'pre' ? 'pre' : 'post';
  }

  function syncPosttestBuilderLink(sessionId, phase) {
    var link = document.getElementById('prepost-open-builder');
    if (!link) return;
    var base = 'posttest-builder.html';
    var id = text(sessionId);
    var mode = text(phase || selectedBuilderPhase()).toLowerCase() === 'pre' ? 'pre' : 'post';
    var query = 'phase=' + encodeURIComponent(mode);
    if (id) query = 'session=' + encodeURIComponent(id) + '&' + query;
    link.href = base + '?' + query;
  }

  function formatQuestionOptions(options) {
    var rows = Array.isArray(options) ? options : [];
    if (!rows.length) return '<span class="prepost-question-option">Tanpa opsi</span>';
    return rows.map(function (option) {
      var label = text(option && (option.label || option.value));
      var value = text(option && option.value);
      var score = num(option && option.score);
      var suffix = value ? ' (' + value + ')' : '';
      return '<span class="prepost-question-option">' + esc(label + suffix) + ' - skor ' + esc(score) + '</span>';
    }).join('');
  }

  function renderManageSessionDetail(data) {
    var statusNode = document.getElementById('prepost-session-detail-status');
    var box = document.getElementById('prepost-session-detail');
    if (!box) return;

    if (!data || data.ok === false) {
      setSessionDetailVisible(false);
      box.innerHTML = '<div class="capacity-empty">Detail sesi tidak ditemukan.</div>';
      if (statusNode) statusNode.textContent = 'Detail sesi tidak ditemukan. Pastikan Session ID benar.';
      return;
    }

    var session = data.session || {};
    var summary = data.summary || {};
    var questions = Array.isArray(data.questions) ? data.questions : [];
    var preQuestions = questions.filter(function (item) { return text(item.phase).toLowerCase() === 'pre'; });
    var postQuestions = questions.filter(function (item) { return text(item.phase).toLowerCase() === 'post'; });

    var links = '' +
      '<div class="prepost-manage-links">' +
        (session.preFormUrl ? '<a href="' + esc(session.preFormUrl) + '" target="_blank" rel="noopener noreferrer">Buka link pre-test</a>' : '') +
        (session.postFormUrl ? '<a href="' + esc(session.postFormUrl) + '" target="_blank" rel="noopener noreferrer">Buka link post-test</a>' : '') +
        (session.preQrUrl ? '<a href="' + esc(session.preQrUrl) + '" target="_blank" rel="noopener noreferrer">Lihat QR pre-test</a>' : '') +
        (session.postQrUrl ? '<a href="' + esc(session.postQrUrl) + '" target="_blank" rel="noopener noreferrer">Lihat QR post-test</a>' : '') +
      '</div>';

    var preList = preQuestions.map(function (item, index) {
      return '' +
        '<article class="prepost-question-item">' +
          '<h5>' + (index + 1) + '. ' + esc(item.questionText || '-') + '</h5>' +
          '<div class="prepost-question-options">' + formatQuestionOptions(item.options) + '</div>' +
        '</article>';
    }).join('');

    var postList = postQuestions.map(function (item, index) {
      return '' +
        '<article class="prepost-question-item">' +
          '<h5>' + (index + 1) + '. ' + esc(item.questionText || '-') + '</h5>' +
          '<div class="prepost-question-options">' + formatQuestionOptions(item.options) + '</div>' +
        '</article>';
    }).join('');

    box.innerHTML = '' +
      '<article class="prepost-session-detail-card">' +
        '<div class="prepost-session-detail-head">' +
          '<h4>' + esc(session.title || session.sessionId || 'Sesi') + '</h4>' +
          '<p>' + esc([session.activityDate, session.location || session.village, session.facilitator].filter(Boolean).join(' | ') || '-') + '</p>' +
        '</div>' +
        '<div class="prepost-session-detail-stats">' +
          '<span>Pre responden: ' + Number(summary.preRespondents || 0).toLocaleString('id-ID') + '</span>' +
          '<span>Post responden: ' + Number(summary.postRespondents || 0).toLocaleString('id-ID') + '</span>' +
          '<span>Rata-rata post (%): ' + Number(summary.postAvgPercent || 0).toLocaleString('id-ID') + '</span>' +
          '<span>Jumlah soal post: ' + Number(summary.postQuestionCount || 0).toLocaleString('id-ID') + '</span>' +
        '</div>' +
        '<div class="prepost-session-detail-demography">' +
          '<strong>Data peserta post-test:</strong> jenis kelamin, kategori umur, utusan/perwakilan lembaga.' +
        '</div>' +
        links +
        '<div class="prepost-question-columns">' +
          '<section><h5>Pre-test (' + preQuestions.length + ' soal)</h5>' + (preList || '<div class="capacity-empty">Belum ada pertanyaan pre-test.</div>') + '</section>' +
          '<section><h5>Post-test (' + postQuestions.length + ' soal)</h5>' + (postList || '<div class="capacity-empty">Belum ada pertanyaan post-test.</div>') + '</section>' +
        '</div>' +
      '</article>';

    setSessionDetailVisible(true);
    if (statusNode) statusNode.textContent = 'Detail sesi dan seluruh pertanyaan berhasil dimuat.';
  }

  function setSessionDetailVisible(visible) {
    var box = document.getElementById('prepost-session-detail');
    if (!box) return;
    box.classList.toggle('is-collapsed', !visible);
  }

  async function loadManageSessionDetail() {
    var statusNode = document.getElementById('prepost-session-detail-status');
    var select = document.getElementById('prepost-manage-session');
    var fallbackInput = document.getElementById('prepost-question-session');
    var sessionId = text(select && select.value) || text(fallbackInput && fallbackInput.value);
    var box = document.getElementById('prepost-session-detail');

    if (!sessionId) {
      if (statusNode) statusNode.textContent = 'Pilih Session ID terlebih dahulu.';
      setSessionDetailVisible(false);
      if (box) box.innerHTML = '<div class="capacity-empty">Pilih Session ID untuk melihat detail sesi.</div>';
      return;
    }

    if (statusNode) statusNode.textContent = 'Memuat detail sesi...';
    setSessionDetailVisible(true);
    if (box) box.innerHTML = '<div class="loading">Memuat semua pertanyaan dan link sesi...</div>';

    try {
      var data = await jsonp(API + '?page=prepost-session-detail&sessionId=' + encodeURIComponent(sessionId) + '&t=' + Date.now());
      renderManageSessionDetail(data || {});
    } catch (error) {
      if (statusNode) statusNode.textContent = 'Gagal memuat detail sesi. Coba lagi.';
      if (box) box.innerHTML = '<div class="capacity-empty">Gagal memuat detail sesi.</div>';
    }
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

  function waitMs(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function sessionMatchesFingerprint(session, fingerprint) {
    return text(session && session.title).toLowerCase() === text(fingerprint && fingerprint.title).toLowerCase() &&
      text(session && session.activityDate) === text(fingerprint && fingerprint.activityDate) &&
      text(session && session.location).toLowerCase() === text(fingerprint && fingerprint.location).toLowerCase() &&
      text(session && session.facilitator).toLowerCase() === text(fingerprint && fingerprint.facilitator).toLowerCase();
  }

  async function findCreatedSessionId(fingerprint) {
    for (var i = 0; i < 5; i += 1) {
      try {
        var data = await jsonp(API + '?page=prepost-sessions&status=active&t=' + Date.now());
        var rows = Array.isArray(data && data.sessions) ? data.sessions : [];
        var matched = rows.map(function (item) { return item.session || item; }).find(function (session) {
          return sessionMatchesFingerprint(session, fingerprint);
        });
        if (matched && matched.sessionId) {
          return matched.sessionId;
        }
      } catch (error) {}

      await waitMs(900);
    }

    return '';
  }

  function openPosttestBuilder(sessionId, phase) {
    var target = 'posttest-builder.html';
    var id = text(sessionId);
    var mode = text(phase || selectedBuilderPhase()).toLowerCase() === 'pre' ? 'pre' : 'post';
    var query = 'phase=' + encodeURIComponent(mode);
    if (id) query = 'session=' + encodeURIComponent(id) + '&' + query;
    window.location.href = target + '?' + query;
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
    var builderPhase = selectedBuilderPhase();
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
      var fingerprint = {
        title: title,
        activityDate: activityDate,
        location: location,
        facilitator: facilitator
      };

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
      if (statusNode) statusNode.textContent = 'Sesi berhasil dibuat. Menyiapkan halaman builder...';
      var createdSessionId = await findCreatedSessionId(fingerprint);
      loadPrepost();
      openPosttestBuilder(createdSessionId, builderPhase);
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
      var manageSessionSelect = document.getElementById('prepost-manage-session');
      if (manageSessionSelect && sessionId) manageSessionSelect.value = sessionId;
      setSessionDetailVisible(false);
      if (statusNode) statusNode.textContent = 'Pertanyaan tersimpan. Klik "Tampilkan detail sesi" untuk review seluruh soal.';
    } catch (error) {
      if (statusNode) statusNode.textContent = 'Gagal mengirim pertanyaan. Coba lagi.';
    }
  }

  async function loadCapacity() {
    var historical = [];
    try {
      historical = await fetch('data/capacity-building.json?v=20260722-3').then(function (r) {
        return r.json();
      }).then(function (rows) {
        return rows.map(function (row) {
          row.kind = 'training';
          return row;
        });
      });
    } catch (e) {}
    sourceCounts.baseline=historical.length;

    var live = [];
    try {
      var data = await jsonp(API + '?page=public-reports&t=' + Date.now());
      var features = data.features || [];
      live = features
        .filter(function (f) { return text((f.properties || {}).reportType) === 'Capacity Building'; })
        .map(liveRecord);
      live = live.concat(features
        .filter(function (f) {
          var p = f.properties || {};
          var metadata = p.targetFeatureProperties || {};
          return text(p.reportType) !== 'Capacity Building' &&
            num(metadata.Jumlah_Peserta || metadata.Peserta || metadata.participants) > 0;
        })
        .map(activityEngagementRecord)
        .filter(Boolean));
      sourceCounts.published=live.length;
    } catch (e) {}

    var seen = {};
    all = historical.concat(live).filter(function (r) {
      var k = r.id || [r.name, r.date, r.location].join('|');
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    });

    var scope = text(document.body.getAttribute('data-capacity-scope')).toLowerCase();
    if (scope === 'community') {
      all = all.filter(function (r) { return r.kind === 'activity-engagement'; });
    } else if (scope === 'training') {
      all = all.filter(function (r) { return r.kind === 'training'; });
    }

    populateFilters();
    renderCapacity();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initPrepostSessionCardNavigation();

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
    var loadSessionDetailNode = document.getElementById('prepost-load-session-detail');
    if (loadSessionDetailNode) loadSessionDetailNode.addEventListener('click', loadManageSessionDetail);
    var hideSessionDetailNode = document.getElementById('prepost-hide-session-detail');
    if (hideSessionDetailNode) {
      hideSessionDetailNode.addEventListener('click', function () {
        setSessionDetailVisible(false);
      });
    }
    var manageSessionNode = document.getElementById('prepost-manage-session');
    if (manageSessionNode) {
      manageSessionNode.addEventListener('change', function () {
        var questionSession = document.getElementById('prepost-question-session');
        if (questionSession) questionSession.value = text(manageSessionNode.value);
        syncPosttestBuilderLink(text(manageSessionNode.value));
      });
    }
    ['prepost-question-text', 'prepost-option-a', 'prepost-option-b', 'prepost-option-c', 'prepost-option-d'].forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) return;
      node.addEventListener('focus', function () {
        setSessionDetailVisible(false);
      });
    });

    if (document.getElementById('capacity-list')) loadCapacity();
    if (document.body.hasAttribute('data-require-staff')) {
      window.addEventListener('yg:staff-access-granted', loadPrepost, { once: true });
    } else if (document.getElementById('prepost-session-list')) {
      loadPrepost();
    }
    var builderPhaseNode = document.getElementById('prepost-builder-phase');
    if (builderPhaseNode) {
      builderPhaseNode.addEventListener('change', function () {
        syncPosttestBuilderLink('', selectedBuilderPhase());
      });
    }

    syncPosttestBuilderLink('', selectedBuilderPhase());
  });
})();
