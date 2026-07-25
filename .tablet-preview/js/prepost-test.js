(function(){
  'use strict';

  var API = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get('session') || '';
  var phase = (params.get('phase') || 'pre').toLowerCase();
  var sessionDetail = null;
  var answers = {};

  function text(v){ return v === null || v === undefined ? '' : String(v).trim(); }
  function esc(v){ return text(v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

  function jsonp(url,prefix){
    return new Promise(function(resolve,reject){
      var callbackName = (prefix || 'ygPrepost_') + Date.now() + Math.floor(Math.random() * 1000);
      var script = document.createElement('script');
      var timer = setTimeout(function(){ cleanup(); reject(new Error('Timeout')); },15000);

      function cleanup(){
        clearTimeout(timer);
        try{ delete window[callbackName]; }catch(e){ window[callbackName] = undefined; }
        if(script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = function(data){ cleanup(); resolve(data); };
      script.onerror = function(){ cleanup(); reject(new Error('Gagal memuat data')); };
      script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'callback=' + callbackName + '&t=' + Date.now();
      script.async = true;
      document.head.appendChild(script);
    });
  }

  function renderMeta(){
    var titleNode = document.getElementById('session-title');
    var metaNode = document.getElementById('session-meta');
    if(!sessionDetail || sessionDetail.ok === false){
      titleNode.textContent = 'Sesi tidak ditemukan';
      metaNode.textContent = 'Periksa kembali link pre/post test yang Anda gunakan.';
      return;
    }
    var session = sessionDetail.session || {};
    titleNode.textContent = (phase === 'post' ? 'Post-test: ' : 'Pre-test: ') + (session.title || session.sessionId || 'Sesi');
    metaNode.textContent = [session.activityDate,session.location || session.village,session.facilitator].filter(Boolean).join(' | ');
  }

  function optionScore(option){
    var n = Number(option && option.score);
    return Number.isFinite(n) ? n : 0;
  }

  function renderQuestions(){
    var node = document.getElementById('question-list');
    if(!sessionDetail || sessionDetail.ok === false){
      node.innerHTML = '<p class="loading">Pertanyaan belum tersedia.</p>';
      return;
    }

    var rows = (sessionDetail.questions || []).filter(function(item){
      return text(item.phase).toLowerCase() === phase;
    });

    if(!rows.length){
      node.innerHTML = '<p class="loading">Belum ada pertanyaan untuk fase ini.</p>';
      return;
    }

    node.innerHTML = rows.map(function(question,index){
      var options = Array.isArray(question.options) ? question.options : [];
      var optionMarkup = options.map(function(option){
        var label = text(option.label || option.value);
        var value = text(option.value || option.label);
        return '<label><input type="radio" name="q-' + esc(question.questionId) + '" value="' + esc(value) + '"><span>' + esc(label) + '</span></label>';
      }).join('');
      return '<article class="question-item" data-question-id="' + esc(question.questionId) + '">' +
        '<h3>' + (index + 1) + '. ' + esc(question.questionText) + '</h3>' +
        '<div class="question-options">' + optionMarkup + '</div>' +
      '</article>';
    }).join('');

    rows.forEach(function(question){
      var radios = node.querySelectorAll('input[name="q-' + question.questionId + '"]');
      radios.forEach(function(radio){
        radio.addEventListener('change',function(){
          var option = (question.options || []).find(function(item){
            return text(item.value || item.label) === text(radio.value);
          }) || null;
          answers[question.questionId] = {
            questionId: question.questionId,
            value: radio.value,
            score: optionScore(option)
          };
        });
      });
    });
  }

  function collectAnswers(){
    return Object.keys(answers).map(function(key){ return answers[key]; });
  }

  async function loadSession(){
    if(!sessionId){
      sessionDetail = {ok:false};
      renderMeta();
      renderQuestions();
      return;
    }
    sessionDetail = await jsonp(
      API + '?page=prepost-session-detail&sessionId=' + encodeURIComponent(sessionId),
      'ygPrepostSession_'
    );
    renderMeta();
    renderQuestions();
  }

  async function submitAnswers(){
    var code = text(document.getElementById('participant-code').value);
    var name = text(document.getElementById('participant-name').value);
    var email = text(document.getElementById('participant-email').value);
    var status = document.getElementById('submit-status');
    var button = document.getElementById('submit-test');

    if(!code){
      status.textContent = 'Kode peserta wajib diisi.';
      return;
    }

    var rows = (sessionDetail && sessionDetail.questions || []).filter(function(item){
      return text(item.phase).toLowerCase() === phase;
    });
    var sentAnswers = collectAnswers();
    if(sentAnswers.length < rows.length){
      status.textContent = 'Lengkapi semua jawaban sebelum mengirim.';
      return;
    }

    var payload = {
      sessionId: sessionId,
      phase: phase,
      participantCode: code,
      participantName: name,
      participantEmail: email,
      sourceChannel: 'web',
      answers: sentAnswers
    };

    button.disabled = true;
    status.textContent = 'Mengirim jawaban...';

    try{
      var body = new URLSearchParams();
      body.set('action','prepost-submit-response');
      body.set('payload',JSON.stringify(payload));
      await fetch(API,{
        method:'POST',
        mode:'no-cors',
        headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
        body:body.toString()
      });
      status.textContent = 'Jawaban terkirim. Terima kasih atas partisipasi Anda.';
      button.disabled = true;
    }catch(error){
      button.disabled = false;
      status.textContent = 'Gagal mengirim jawaban. Coba lagi.';
    }
  }

  document.getElementById('submit-test').addEventListener('click',submitAnswers);
  loadSession().catch(function(){
    sessionDetail = {ok:false};
    renderMeta();
    renderQuestions();
  });
})();
