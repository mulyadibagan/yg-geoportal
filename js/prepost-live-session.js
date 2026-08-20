(function(){
  'use strict';

  var API = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var SNAPSHOT_URL = 'https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev/snapshots/current/dashboard.json';
  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get('session') || '';
  var participantResponses = [];

  function text(v){ return v === null || v === undefined ? '' : String(v).trim(); }
  function esc(v){ return text(v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function num(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function pct(v){ return num(v).toLocaleString('id-ID',{maximumFractionDigits:1}) + '%'; }
  function maskParticipantName(value,index){
    var name = text(value).replace(/\s+/g,' ');
    if(!name) return 'Peserta ' + (index + 1);
    if(name.length <= 4) return name.charAt(0) + '***' + name.charAt(name.length - 1);
    return name.slice(0,2) + '***' + name.slice(-2);
  }
  function parseLegacyDateTime(v){
    var m = text(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if(!m) return null;
    var day = Number(m[1]);
    var month = Number(m[2]);
    var year = Number(m[3]);
    var hour = Number(m[4] || 0);
    var minute = Number(m[5] || 0);
    var second = Number(m[6] || 0);
    if(!day || !month || !year) return null;
    return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
  }
  function formatDateTime(v){
    var value = text(v);
    if(!value) return '-';
    var dt = new Date(value);
    if(isNaN(dt.getTime())){
      dt = parseLegacyDateTime(value);
    }
    return dt && !isNaN(dt.getTime())
      ? dt.toLocaleString('id-ID',{ timeZone:'Asia/Jakarta', hour12:false })
      : value;
  }

  function jsonp(url,prefix){
    return new Promise(function(resolve,reject){
      var cb = (prefix || 'ygLive_') + Date.now() + Math.floor(Math.random() * 1000);
      var script = document.createElement('script');
      var timer = setTimeout(function(){ cleanup(); reject(new Error('timeout')); },30000);

      function cleanup(){
        clearTimeout(timer);
        try{ delete window[cb]; } catch(e){ window[cb] = undefined; }
        if(script.parentNode) script.parentNode.removeChild(script);
      }

      window[cb] = function(data){ cleanup(); resolve(data); };
      script.onerror = function(){ cleanup(); reject(new Error('API')); };
      script.src = url + (url.indexOf('?') > -1 ? '&' : '?') + 'callback=' + cb + '&t=' + Date.now();
      script.async = true;
      document.head.appendChild(script);
    });
  }

  function breakdownHtml(source){
    var obj = source && typeof source === 'object' ? source : {};
    var keys = Object.keys(obj).filter(function(key){ return text(key) && num(obj[key]) > 0; });
    if(!keys.length) return '<span>Belum ada data.</span>';
    return keys.sort(function(a,b){ return num(obj[b]) - num(obj[a]); }).map(function(key){
      return '<span>' + esc(key) + ': ' + num(obj[key]).toLocaleString('id-ID') + '</span>';
    }).join('');
  }

  function optionMarkup(option){
    var label = text(option && (option.label || option.value));
    var score = num(option && option.score);
    var cls = score === 1 ? 'question-option correct' : 'question-option';
    var prefix = score === 1 ? '[JAWABAN BENAR] ' : '';
    return '<span class="' + cls + '">' + esc(prefix + label) + '</span>';
  }

  function questionMarkup(rows){
    if(!rows.length) return '<p class="question-empty">Belum ada soal.</p>';
    return rows.map(function(item,index){
      var options = Array.isArray(item.options) ? item.options : [];
      return '<article class="question-item">' +
        '<h4>' + (index + 1) + '. ' + esc(item.questionText || '-') + '</h4>' +
        options.map(optionMarkup).join('') +
      '</article>';
    }).join('');
  }

  function applyMeta(detail){
    var titleNode = document.getElementById('live-title');
    var metaNode = document.getElementById('live-meta');
    var generatedNode = document.getElementById('live-generated');

    if(!detail || detail.ok === false){
      if(titleNode) titleNode.textContent = 'Sesi tidak ditemukan';
      if(metaNode) metaNode.textContent = 'Periksa parameter session pada URL.';
      if(generatedNode) generatedNode.textContent = '-';
      return;
    }

    var session = detail.session || {};
    if(titleNode) titleNode.textContent = session.title || session.sessionId || 'Live Session';
    if(metaNode) metaNode.textContent = [session.activityDate, session.location || session.village, session.facilitator].filter(Boolean).join(' | ');
    if(generatedNode) generatedNode.textContent = 'Data dibuat: ' + (detail.generatedAt
      ? new Date(detail.generatedAt).toLocaleString('id-ID',{ timeZone:'Asia/Jakarta', hour12:false })
      : '-');
  }

  function applySummary(detail){
    var summary = detail && detail.summary ? detail.summary : {};
    var session = detail && detail.session ? detail.session : {};
    var pre = num(summary.preRespondents);
    var post = num(summary.postRespondents);
    var target = num(session.targetParticipants);

    var links = document.getElementById('live-links');
    var linkHtml = '' +
      (session.postFormUrl ? '<a href="' + esc(session.postFormUrl) + '" target="_blank" rel="noopener noreferrer">Link post-test</a>' : '') +
      (session.postQrUrl ? '<a href="' + esc(session.postQrUrl) + '" target="_blank" rel="noopener noreferrer">QR post-test</a>' : '');
    if(links) links.innerHTML = linkHtml;

    var preNode = document.getElementById('live-pre');
    var postNode = document.getElementById('live-post');
    var prePctNode = document.getElementById('live-pre-pct');
    var postPctNode = document.getElementById('live-post-pct');
    var gainPctNode = document.getElementById('live-gain-pct');
    var completionNode = document.getElementById('live-completion');

    if(preNode) preNode.textContent = pre.toLocaleString('id-ID');
    if(postNode) postNode.textContent = post.toLocaleString('id-ID');
    if(prePctNode) prePctNode.textContent = pct(summary.preAvgPercent);
    if(postPctNode) postPctNode.textContent = pct(summary.postAvgPercent);
    if(gainPctNode) gainPctNode.textContent = num(summary.gainPercentPoint).toLocaleString('id-ID');
    if(completionNode) completionNode.textContent = target > 0 ? pct((post / target) * 100) : '0%';

    var genderNode = document.getElementById('live-gender');
    var ageNode = document.getElementById('live-age');
    var delegateNode = document.getElementById('live-delegate');
    if(genderNode) genderNode.innerHTML = breakdownHtml(summary.postDemographics && summary.postDemographics.gender);
    if(ageNode) ageNode.innerHTML = breakdownHtml(summary.postDemographics && summary.postDemographics.ageCategory);
    if(delegateNode) delegateNode.innerHTML = breakdownHtml(summary.postDemographics && summary.postDemographics.delegate);

    participantResponses = Array.from({length:post},function(_,index){
      return {participantCode:'Peserta ' + (index + 1)};
    });
    renderParticipantResponses(participantResponses);
  }

  function applyQuestions(detail){
    var questions = Array.isArray(detail && detail.questions) ? detail.questions : [];
    var postRows = questions.filter(function(item){ return text(item.phase).toLowerCase() === 'post'; });

    var postTitle = document.getElementById('live-post-title');
    var postList = document.getElementById('live-post-questions');

    if(postTitle) postTitle.textContent = 'Post-test (' + postRows.length + ' soal)';
    if(postList) postList.innerHTML = questionMarkup(postRows);
  }

  async function loadSnapshotDetail(){
    var response = await fetch(SNAPSHOT_URL,{cache:'no-store'});
    if(!response.ok) throw new Error('snapshot HTTP ' + response.status);
    var snapshot = await response.json();
    var prepost = snapshot && snapshot.capacitySources && snapshot.capacitySources.prepost;
    var sessions = prepost && Array.isArray(prepost.sessions) ? prepost.sessions : [];
    var session = sessions.find(function(item){ return text(item.sessionId) === sessionId; });
    if(!session) return null;
    return {
      ok:true,
      generatedAt:prepost.generatedAt || snapshot.snapshotGeneratedAt || snapshot.generatedAt,
      session:session,
      summary:session.summary || {},
      questions:[],
      source:'snapshot'
    };
  }

  function applyError(message){
    var titleNode = document.getElementById('live-title');
    var metaNode = document.getElementById('live-meta');
    var cards = document.querySelectorAll('.live-card');
    if(titleNode) titleNode.textContent = 'Gagal memuat live session';
    if(metaNode) metaNode.textContent = text(message) || 'Terjadi kesalahan saat mengambil data sesi.';
    cards.forEach(function(card){
      card.innerHTML = '<div class="error-box">Data live session tidak tersedia. Silakan kembali ke halaman monitoring dan coba lagi.</div>';
    });
  }

  function responseTableMarkup(rows){
    if(!rows.length){
      return '<p class="question-empty">Belum ada peserta post-test yang mengisi.</p>';
    }
    return '<table class="live-table">' +
      '<thead><tr>' +
        '<th>No</th>' +
        '<th>Peserta</th>' +
        '<th>Status</th>' +
      '</tr></thead>' +
      '<tbody>' + rows.map(function(item,index){
        return '<tr>' +
          '<td>' + (index + 1) + '</td>' +
          '<td>' + esc(item.participantCode || ('Peserta ' + (index + 1))) + '</td>' +
          '<td>Sudah mengisi post-test</td>' +
        '</tr>';
      }).join('') + '</tbody>' +
    '</table>';
  }

  function renderParticipantResponses(rows){
    var tableNode = document.getElementById('live-participant-table');
    var noteNode = document.getElementById('live-participant-note');
    var toggleBtn = document.getElementById('live-toggle-participants');
    if(tableNode) tableNode.innerHTML = responseTableMarkup(rows || []);
    if(noteNode) noteNode.textContent = (rows || []).length
      ? 'Total responden post-test: ' + (rows || []).length.toLocaleString('id-ID') + ' · identitas tidak ditampilkan.'
      : 'Belum ada peserta post-test yang mengisi.';
    if(toggleBtn) toggleBtn.textContent = (rows || []).length
      ? 'Daftar peserta anonim (' + (rows || []).length.toLocaleString('id-ID') + ')'
      : 'Daftar peserta anonim';
  }

  async function loadMaskedParticipantNames(){
    try{
      var response = await jsonp(
        API + '?page=prepost-session-responses&sessionId=' + encodeURIComponent(sessionId) + '&phase=post',
        'ygLiveMaskedResponses_'
      );
      var rows = response && Array.isArray(response.responses) ? response.responses : [];
      if(!rows.length) return;
      var total = Math.max(participantResponses.length,rows.length);
      participantResponses = Array.from({length:total},function(_,index){
        var source = rows[index] || {};
        return {participantCode:maskParticipantName(source.participantName,index)};
      });
      renderParticipantResponses(participantResponses);
      var noteNode = document.getElementById('live-participant-note');
      if(noteNode) noteNode.textContent = 'Total responden post-test: ' + participantResponses.length.toLocaleString('id-ID') + ' · nama disamarkan.';
    }catch(responseError){
      // Daftar anonim dari ringkasan tetap digunakan jika sumber nama tidak tersedia.
    }
  }

  function initParticipantToggle(){
    var btn = document.getElementById('live-toggle-participants');
    var card = document.getElementById('live-participant-card');
    if(!btn || !card) return;

    btn.addEventListener('click',function(){
      var isHidden = card.classList.contains('live-card--hidden');
      if(isHidden){
        card.classList.remove('live-card--hidden');
        btn.textContent = participantResponses.length
          ? 'Sembunyikan daftar anonim (' + participantResponses.length.toLocaleString('id-ID') + ')'
          : 'Sembunyikan daftar anonim';
      } else {
        card.classList.add('live-card--hidden');
        btn.textContent = participantResponses.length
          ? 'Daftar peserta anonim (' + participantResponses.length.toLocaleString('id-ID') + ')'
          : 'Daftar peserta anonim';
      }
    });
  }

  async function init(){
    if(!sessionId){
      applyError('Session ID tidak ditemukan di URL.');
      return;
    }
    var fallback = null;
    try{
      fallback = await loadSnapshotDetail();
      if(fallback){
        applyMeta(fallback);
        applySummary(fallback);
        applyQuestions(fallback);
        var generatedNode = document.getElementById('live-generated');
        if(generatedNode) generatedNode.textContent += ' · ringkasan snapshot';
      }
    }catch(snapshotError){}

    try{
      var detail = await jsonp(API + '?page=prepost-session-detail&sessionId=' + encodeURIComponent(sessionId), 'ygLiveSession_');
      if(!detail || detail.ok === false) throw new Error(detail && detail.error ? detail.error : 'Sesi tidak ditemukan.');
      applyMeta(detail);
      applySummary(detail);
      applyQuestions(detail);
    }catch(detailError){
      if(!fallback){
        applyError('Tidak dapat memuat data dari server maupun snapshot.');
        return;
      }
    }

    initParticipantToggle();
    loadMaskedParticipantNames();
  }

  if(document.body.hasAttribute('data-require-staff')){
    window.addEventListener('yg:staff-access-granted',init,{once:true});
  }else{
    init();
  }
})();
