(function () {
  'use strict';

  var API = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var params = new URLSearchParams(window.location.search);
  var builderPhase = text(params.get('phase')).toLowerCase() === 'pre' ? 'pre' : 'post';
  var sessions = [];
  var existingPostCount = 0;

  function text(v) { return v === null || v === undefined ? '' : String(v).trim(); }
  function esc(v) { return text(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      var cb = 'ygPosttest' + Date.now() + Math.floor(Math.random() * 1000);
      var s = document.createElement('script');
      window[cb] = function (data) {
        delete window[cb];
        if (s.parentNode) s.parentNode.removeChild(s);
        resolve(data);
      };
      s.onerror = function () {
        delete window[cb];
        if (s.parentNode) s.parentNode.removeChild(s);
        reject(new Error('API'));
      };
      s.src = url + (url.indexOf('?') > -1 ? '&' : '?') + 'callback=' + cb + '&t=' + Date.now();
      document.head.appendChild(s);
      setTimeout(function () {
        if (window[cb]) {
          delete window[cb];
          if (s.parentNode) s.parentNode.removeChild(s);
          reject(new Error('timeout'));
        }
      }, 15000);
    });
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

  function formatOptions(options) {
    var rows = Array.isArray(options) ? options : [];
    if (!rows.length) return '<span>Tidak ada opsi</span>';
    return rows.map(function (opt) {
      var label = text(opt.label || opt.value);
      var value = text(opt.value);
      var score = Number(opt.score) || 0;
      return '<span>' + esc(label + ' (' + value + ') - skor ' + score) + '</span>';
    }).join('');
  }

  function normalizeOptionText(option, key) {
    var label = text(option && (option.label || option.value));
    var cleaned = label.replace(/^[A-Da-d]\.\s*/g, '').trim();
    if (cleaned) return cleaned;
    return text(option && option.value) === key ? text(option.value) : '';
  }

  function answerKeyFromOptions(options) {
    var rows = Array.isArray(options) ? options : [];
    var scored = rows.find(function (item) {
      return Number(item && item.score) === 1;
    });
    var key = text(scored && scored.value).toUpperCase();
    return ['A', 'B', 'C', 'D'].indexOf(key) > -1 ? key : '';
  }

  function autoresizeTextarea(node) {
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = Math.max(node.scrollHeight, 44) + 'px';
  }

  function bindAutoResizeWithin(scope) {
    var root = scope || document;
    var areas = root.querySelectorAll('textarea.auto-grow');
    areas.forEach(function (area) {
      if (!area.dataset.autogrowBound) {
        area.addEventListener('input', function () {
          autoresizeTextarea(area);
        });
        area.dataset.autogrowBound = '1';
      }
      autoresizeTextarea(area);
    });
  }

  function renderExistingQuestions(detail) {
    var box = document.getElementById('existing-list');
    if (!box) return;
    if (!detail || detail.ok === false) {
      existingPostCount = 0;
      box.innerHTML = '<p class="loading">Gagal memuat daftar soal.</p>';
      renumberDraftCards();
      return;
    }

    var questions = (detail.questions || []).filter(function (q) {
      return text(q.phase).toLowerCase() === builderPhase;
    });
    existingPostCount = questions.length;

    if (!questions.length) {
      box.innerHTML = '<p class="loading">Belum ada soal ' + esc(phaseLabelLower()) + ' di sesi ini.</p>';
      renumberDraftCards();
      return;
    }

    box.innerHTML = questions.map(function (q, i) {
      var key = answerKeyFromOptions(q.options);
      return '' +
        '<article class="existing-item" data-question-id="' + esc(q.questionId || '') + '">' +
          '<h4>' + (i + 1) + '. ' + esc(q.questionText || '-') + '</h4>' +
          '<div class="existing-options">' + formatOptions(q.options) + '</div>' +
          '<div class="existing-actions"><button type="button" class="btn btn-alt btn-edit-question">Revisi soal ini</button></div>' +
          '<div class="existing-edit" hidden>' +
            '<label>Pertanyaan<textarea class="edit-q-text auto-grow" rows="3">' + esc(q.questionText || '') + '</textarea></label>' +
            '<div class="option-grid">' +
              '<label>Pilihan A<textarea class="edit-q-a auto-grow" rows="2" placeholder="Isi pilihan A">' + esc(normalizeOptionText((q.options || []).find(function (it) { return text(it.value).toUpperCase() === 'A'; }), 'A')) + '</textarea></label>' +
              '<label>Pilihan B<textarea class="edit-q-b auto-grow" rows="2" placeholder="Isi pilihan B">' + esc(normalizeOptionText((q.options || []).find(function (it) { return text(it.value).toUpperCase() === 'B'; }), 'B')) + '</textarea></label>' +
              '<label>Pilihan C<textarea class="edit-q-c auto-grow" rows="2" placeholder="Isi pilihan C">' + esc(normalizeOptionText((q.options || []).find(function (it) { return text(it.value).toUpperCase() === 'C'; }), 'C')) + '</textarea></label>' +
              '<label>Pilihan D<textarea class="edit-q-d auto-grow" rows="2" placeholder="Isi pilihan D">' + esc(normalizeOptionText((q.options || []).find(function (it) { return text(it.value).toUpperCase() === 'D'; }), 'D')) + '</textarea></label>' +
            '</div>' +
            '<label>Kunci jawaban' +
              '<select class="edit-q-key">' +
                '<option value="">Pilih kunci</option>' +
                '<option value="A"' + (key === 'A' ? ' selected' : '') + '>A</option>' +
                '<option value="B"' + (key === 'B' ? ' selected' : '') + '>B</option>' +
                '<option value="C"' + (key === 'C' ? ' selected' : '') + '>C</option>' +
                '<option value="D"' + (key === 'D' ? ' selected' : '') + '>D</option>' +
              '</select>' +
            '</label>' +
            '<div class="existing-actions">' +
              '<button type="button" class="btn btn-save-edit">Simpan revisi</button>' +
              '<button type="button" class="btn btn-alt btn-cancel-edit">Batal</button>' +
            '</div>' +
            '<p class="existing-edit-status"></p>' +
          '</div>' +
        '</article>';
    }).join('');

    bindAutoResizeWithin(box);
    bindExistingEditActions();

    renumberDraftCards();
  }

  function buildOptionsFromEditInputs(editBox) {
    var a = text(editBox.querySelector('.edit-q-a') && editBox.querySelector('.edit-q-a').value);
    var b = text(editBox.querySelector('.edit-q-b') && editBox.querySelector('.edit-q-b').value);
    var c = text(editBox.querySelector('.edit-q-c') && editBox.querySelector('.edit-q-c').value);
    var d = text(editBox.querySelector('.edit-q-d') && editBox.querySelector('.edit-q-d').value);
    var key = text(editBox.querySelector('.edit-q-key') && editBox.querySelector('.edit-q-key').value).toUpperCase();

    if (!a || !b || !c || !d || ['A', 'B', 'C', 'D'].indexOf(key) === -1) {
      return { error: 'Lengkapi opsi A-D dan pilih kunci jawaban.' };
    }

    return {
      error: '',
      options: [
        { label: 'A. ' + a, value: 'A', score: key === 'A' ? 1 : 0 },
        { label: 'B. ' + b, value: 'B', score: key === 'B' ? 1 : 0 },
        { label: 'C. ' + c, value: 'C', score: key === 'C' ? 1 : 0 },
        { label: 'D. ' + d, value: 'D', score: key === 'D' ? 1 : 0 }
      ]
    };
  }

  function bindExistingEditActions() {
    var email = text(document.getElementById('staff-email') && document.getElementById('staff-email').value);
    var sessionId = text(document.getElementById('session-id') && document.getElementById('session-id').value);
    var rows = document.querySelectorAll('.existing-item');

    rows.forEach(function (row) {
      var toggleBtn = row.querySelector('.btn-edit-question');
      var editBox = row.querySelector('.existing-edit');
      var cancelBtn = row.querySelector('.btn-cancel-edit');
      var saveBtn = row.querySelector('.btn-save-edit');
      var statusNode = row.querySelector('.existing-edit-status');
      var questionId = text(row.getAttribute('data-question-id'));

      if (toggleBtn && editBox) {
        toggleBtn.addEventListener('click', function () {
          editBox.hidden = false;
          if (statusNode) statusNode.textContent = '';
        });
      }

      if (cancelBtn && editBox) {
        cancelBtn.addEventListener('click', function () {
          editBox.hidden = true;
          if (statusNode) statusNode.textContent = '';
        });
      }

      if (saveBtn && editBox) {
        saveBtn.addEventListener('click', async function () {
          var latestEmail = text(document.getElementById('staff-email') && document.getElementById('staff-email').value);
          var latestSessionId = text(document.getElementById('session-id') && document.getElementById('session-id').value) || sessionId;
          if (!latestEmail || !/@yayasangambut\.org$/i.test(latestEmail)) {
            if (statusNode) statusNode.textContent = 'Gunakan email official Yayasan Gambut.';
            return;
          }

          var questionText = text(editBox.querySelector('.edit-q-text') && editBox.querySelector('.edit-q-text').value);
          if (!questionText) {
            if (statusNode) statusNode.textContent = 'Pertanyaan wajib diisi.';
            return;
          }

          var optionsResult = buildOptionsFromEditInputs(editBox);
          if (optionsResult.error) {
            if (statusNode) statusNode.textContent = optionsResult.error;
            return;
          }

          saveBtn.disabled = true;
          if (statusNode) statusNode.textContent = 'Menyimpan revisi...';
          try {
            await postAction('prepost-update-question', {
              staffEmail: latestEmail,
              questionId: questionId,
              sessionId: latestSessionId,
              phase: builderPhase,
              questionText: questionText,
              questionType: 'single',
              options: optionsResult.options,
              maxScore: 1,
              order: 0
            });
            if (statusNode) statusNode.textContent = 'Revisi tersimpan.';
            await loadSessionDetail();
          } catch (error) {
            if (statusNode) statusNode.textContent = 'Gagal menyimpan revisi.';
          } finally {
            saveBtn.disabled = false;
          }
        });
      }
    });
  }

  function renderSessionLinks(session) {
    var box = document.getElementById('session-links');
    if (!box) return;
    if (!session) {
      box.innerHTML = '';
      return;
    }

    var links = [];
    if (builderPhase === 'pre') {
      if (session.preFormUrl) links.push('<a href="' + esc(session.preFormUrl) + '" target="_blank" rel="noopener noreferrer">Link pre-test</a>');
      if (session.preQrUrl) links.push('<a href="' + esc(session.preQrUrl) + '" target="_blank" rel="noopener noreferrer">QR pre-test</a>');
    } else {
      if (session.postFormUrl) links.push('<a href="' + esc(session.postFormUrl) + '" target="_blank" rel="noopener noreferrer">Link post-test</a>');
      if (session.postQrUrl) links.push('<a href="' + esc(session.postQrUrl) + '" target="_blank" rel="noopener noreferrer">QR post-test</a>');
    }
    box.innerHTML = links.join('');
  }

  function phaseLabel() {
    return builderPhase === 'pre' ? 'Pre-Test' : 'Post-Test';
  }

  function phaseLabelLower() {
    return builderPhase === 'pre' ? 'pre-test' : 'post-test';
  }

  function applyPhaseLabels() {
    var titleNode = document.getElementById('builder-title');
    var subtitleNode = document.getElementById('builder-subtitle');
    var existingTitleNode = document.getElementById('existing-title');
    var inputTitleNode = document.getElementById('input-title');
    var noteTitleNode = document.getElementById('builder-note-title');
    var noteBodyNode = document.getElementById('builder-note-body');

    if (titleNode) titleNode.textContent = 'Builder Soal ' + phaseLabel();
    if (subtitleNode) subtitleNode.textContent = 'Buat banyak soal ' + phaseLabelLower() + ' sekaligus. Soal yang sudah diisi tetap terlihat di atas seperti alur Google Form.';
    if (existingTitleNode) existingTitleNode.textContent = 'Soal ' + phaseLabel() + ' yang Sudah Tersimpan';
    if (inputTitleNode) inputTitleNode.textContent = 'Input Soal Baru (' + phaseLabel() + ')';

    if (builderPhase === 'pre') {
      if (noteTitleNode) noteTitleNode.textContent = 'Catatan pre-test:';
      if (noteBodyNode) noteBodyNode.textContent = 'Bagikan link atau QR pre-test kepada peserta untuk asesmen awal.';
    } else {
      if (noteTitleNode) noteTitleNode.textContent = 'Data peserta post-test dikumpulkan di form peserta:';
      if (noteBodyNode) noteBodyNode.textContent = 'jenis kelamin, kategori umur, utusan/perwakilan lembaga.';
    }
  }

  function addDraftCard(prefill) {
    var list = document.getElementById('draft-list');
    var tpl = document.getElementById('question-card-template');
    if (!list || !tpl) return;

    var node = tpl.content.firstElementChild.cloneNode(true);
    list.appendChild(node);

    var index = existingPostCount + list.querySelectorAll('.question-card').length;
    var numberNode = node.querySelector('.q-number');
    if (numberNode) numberNode.textContent = String(index);

    if (prefill) {
      var textNode = node.querySelector('.q-text');
      var aNode = node.querySelector('.q-a');
      var bNode = node.querySelector('.q-b');
      var cNode = node.querySelector('.q-c');
      var dNode = node.querySelector('.q-d');
      var keyNode = node.querySelector('.q-key');
      if (textNode) textNode.value = text(prefill.questionText);
      if (aNode) aNode.value = text(prefill.a);
      if (bNode) bNode.value = text(prefill.b);
      if (cNode) cNode.value = text(prefill.c);
      if (dNode) dNode.value = text(prefill.d);
      if (keyNode) keyNode.value = text(prefill.key).toUpperCase();
    }

    bindAutoResizeWithin(node);

    var removeBtn = node.querySelector('.remove-card');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        if (list.querySelectorAll('.question-card').length <= 1) return;
        node.remove();
        renumberDraftCards();
      });
    }
  }

  function renumberDraftCards() {
    var cards = document.querySelectorAll('#draft-list .question-card');
    cards.forEach(function (card, idx) {
      var n = card.querySelector('.q-number');
      if (n) n.textContent = String(existingPostCount + idx + 1);
    });
  }

  function collectDraftCards() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('#draft-list .question-card'));
    return cards.map(function (card, idx) {
      var numberText = text(card.querySelector('.q-number') && card.querySelector('.q-number').textContent);
      var displayIndex = Number(numberText) || (existingPostCount + idx + 1);
      return {
        index: displayIndex,
        questionText: text(card.querySelector('.q-text') && card.querySelector('.q-text').value),
        a: text(card.querySelector('.q-a') && card.querySelector('.q-a').value),
        b: text(card.querySelector('.q-b') && card.querySelector('.q-b').value),
        c: text(card.querySelector('.q-c') && card.querySelector('.q-c').value),
        d: text(card.querySelector('.q-d') && card.querySelector('.q-d').value),
        key: text(card.querySelector('.q-key') && card.querySelector('.q-key').value).toUpperCase()
      };
    });
  }

  function validateDraftRows(rows) {
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      if (!row.questionText || !row.a || !row.b || !row.c || !row.d || ['A', 'B', 'C', 'D'].indexOf(row.key) === -1) {
        return 'Lengkapi semua field pada pertanyaan ke-' + row.index + '.';
      }
    }
    return '';
  }

  function toApiOptions(row) {
    return [
      { label: 'A. ' + row.a, value: 'A', score: row.key === 'A' ? 1 : 0 },
      { label: 'B. ' + row.b, value: 'B', score: row.key === 'B' ? 1 : 0 },
      { label: 'C. ' + row.c, value: 'C', score: row.key === 'C' ? 1 : 0 },
      { label: 'D. ' + row.d, value: 'D', score: row.key === 'D' ? 1 : 0 }
    ];
  }

  async function loadSessions() {
    var select = document.getElementById('session-id');
    if (!select) return;

    select.innerHTML = '<option value="">Memuat sesi...</option>';
    try {
      var data = await jsonp(API + '?page=prepost-live-summary&scope=active');
      var rows = Array.isArray(data && data.sessions) ? data.sessions : [];
      sessions = rows.map(function (item) { return item.session || item; }).filter(Boolean);

      if (!sessions.length) {
        select.innerHTML = '<option value="">Belum ada sesi aktif</option>';
        return;
      }

      var options = ['<option value="">Pilih Session ID</option>'];
      sessions.forEach(function (session) {
        var id = text(session.sessionId);
        if (!id) return;
        var title = text(session.title || id);
        options.push('<option value="' + esc(id) + '">' + esc(title + ' (' + id + ')') + '</option>');
      });
      select.innerHTML = options.join('');

      var params = new URLSearchParams(window.location.search);
      var fromUrl = text(params.get('session'));
      if (fromUrl) {
        select.value = fromUrl;
        loadSessionDetail();
      }
    } catch (error) {
      select.innerHTML = '<option value="">Gagal memuat sesi</option>';
    }
  }

  async function loadSessionDetail() {
    var status = document.getElementById('session-status');
    var select = document.getElementById('session-id');
    var sessionId = text(select && select.value);

    if (!sessionId) {
      if (status) status.textContent = 'Pilih sesi untuk melanjutkan.';
      renderSessionLinks(null);
      renderExistingQuestions(null);
      return;
    }

    if (status) status.textContent = 'Memuat detail sesi...';
    try {
      var detail = await jsonp(API + '?page=prepost-session-detail&sessionId=' + encodeURIComponent(sessionId));
      renderExistingQuestions(detail || {});
      renderSessionLinks(detail && detail.session ? detail.session : null);
      if (status) status.textContent = 'Detail sesi dimuat. Anda bisa langsung menambah banyak soal ' + phaseLabelLower() + '.';
    } catch (error) {
      if (status) status.textContent = 'Gagal memuat detail sesi. Coba lagi.';
      renderSessionLinks(null);
      renderExistingQuestions(null);
    }
  }

  async function saveAllQuestions() {
    var status = document.getElementById('save-status');
    var button = document.getElementById('save-all');
    var email = text(document.getElementById('staff-email') && document.getElementById('staff-email').value);
    var sessionId = text(document.getElementById('session-id') && document.getElementById('session-id').value);

    if (!email || !/@yayasangambut\.org$/i.test(email)) {
      if (status) status.textContent = 'Gunakan email official Yayasan Gambut.';
      return;
    }
    if (!sessionId) {
      if (status) status.textContent = 'Pilih sesi terlebih dahulu.';
      return;
    }

    var rows = collectDraftCards();
    var err = validateDraftRows(rows);
    if (err) {
      if (status) status.textContent = err;
      return;
    }

    button.disabled = true;
    if (status) status.textContent = 'Menyimpan ' + rows.length + ' pertanyaan...';

    try {
      for (var i = 0; i < rows.length; i += 1) {
        var row = rows[i];
        await postAction('prepost-create-question', {
          staffEmail: email,
          sessionId: sessionId,
          phase: builderPhase,
          questionText: row.questionText,
          questionType: 'single',
          options: toApiOptions(row),
          maxScore: 1,
          order: 0
        });
      }

      if (status) status.textContent = 'Semua pertanyaan berhasil disimpan.';
      var list = document.getElementById('draft-list');
      if (list) list.innerHTML = '';
      await loadSessionDetail();
      addDraftCard();
    } catch (error) {
      if (status) status.textContent = 'Gagal menyimpan pertanyaan. Coba lagi.';
    } finally {
      button.disabled = false;
    }
  }

  function init() {
    applyPhaseLabels();
    addDraftCard();
    bindAutoResizeWithin(document);

    var select = document.getElementById('session-id');
    if (select) select.addEventListener('change', loadSessionDetail);

    var addBtn = document.getElementById('add-card');
    if (addBtn) addBtn.addEventListener('click', function () {
      addDraftCard();
      renumberDraftCards();
    });

    var refreshBtn = document.getElementById('refresh-existing');
    if (refreshBtn) refreshBtn.addEventListener('click', loadSessionDetail);

    var saveBtn = document.getElementById('save-all');
    if (saveBtn) saveBtn.addEventListener('click', saveAllQuestions);

    loadSessions();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
