(function () {
  'use strict';

  var panel = document.getElementById('dayun-offline-panel');
  if (!panel) return;

  var saveButton = document.getElementById('dayun-offline-save');
  var installButton = document.getElementById('dayun-offline-install');
  var deleteButton = document.getElementById('dayun-offline-delete');
  var statusBadge = document.getElementById('dayun-offline-badge');
  var statusText = document.getElementById('dayun-offline-status');
  var progress = document.getElementById('dayun-offline-progress');
  var progressBar = progress && progress.querySelector('span');
  var deferredPrompt = null;
  var registration = null;
  var packageMeta = { ready: false };

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function dateLabel(value) {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Jakarta'
      }).format(new Date(value)).replace('.', ':') + ' WIB';
    } catch (_) { return ''; }
  }

  function renderStatus(meta) {
    packageMeta = meta || { ready: false };
    var online = navigator.onLine !== false;
    panel.classList.toggle('is-ready', !!packageMeta.ready);
    panel.classList.toggle('is-offline', !online);
    if (packageMeta.ready) {
      statusBadge.textContent = online ? 'Offline siap' : 'Sedang offline';
      statusBadge.className = 'dy-offline-badge is-ready';
      statusText.textContent = (online ? 'Peta tersimpan di perangkat' : 'Peta dibuka dari penyimpanan perangkat') +
        (packageMeta.savedAt ? ' · diperbarui ' + dateLabel(packageMeta.savedAt) : '') + '.' +
        (isStandalone() ? ' Saat tidak ada jaringan, buka kembali ikon PWA ini; Peta Dayun akan terbuka otomatis.' : ' Pasang ke layar utama agar dapat masuk kembali tanpa jaringan.');
      saveButton.textContent = 'Perbarui peta offline';
      saveButton.disabled = !online;
      installButton.hidden = isStandalone();
      deleteButton.hidden = false;
    } else {
      statusBadge.textContent = online ? 'Belum disimpan' : 'Offline belum siap';
      statusBadge.className = 'dy-offline-badge' + (online ? '' : ' is-error');
      statusText.textContent = online
        ? 'Simpan sebelum berangkat agar peta dapat dibuka tanpa jaringan.'
        : 'Hubungkan internet, lalu simpan paket peta sebelum digunakan di lapangan.';
      saveButton.textContent = 'Simpan peta offline';
      saveButton.disabled = !online;
      installButton.hidden = true;
      deleteButton.hidden = true;
    }
    if (progress) progress.hidden = true;
  }

  function activeWorker() {
    return registration && (registration.active || registration.waiting || registration.installing);
  }

  function askWorker(type) {
    return new Promise(function (resolve, reject) {
      var worker = activeWorker();
      if (!worker) { reject(new Error('Layanan offline belum aktif.')); return; }
      var channel = new MessageChannel();
      var timer = setTimeout(function () { reject(new Error('Layanan offline tidak merespons.')); }, 8000);
      channel.port1.onmessage = function (event) { clearTimeout(timer); resolve(event.data || {}); };
      worker.postMessage({ type: type }, [channel.port2]);
    });
  }

  function showInstallGuide() {
    var old = document.getElementById('dayun-install-guide');
    if (old) old.remove();
    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var overlay = document.createElement('div');
    overlay.id = 'dayun-install-guide';
    overlay.className = 'dy-install-guide';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = '<div><button type="button" data-close aria-label="Tutup">×</button><img src="assets/logo-yayasan-gambut-192.png" alt=""><h2>Pasang Peta Dayun</h2><p>' +
      (ios ? 'Di Safari, ketuk <b>Bagikan</b>, lalu pilih <b>Tambahkan ke Layar Utama</b>.' : 'Buka menu browser (⋮), lalu pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.') +
      '</p><small>Setelah dipasang, buka Peta Dayun langsung dari ikon di layar smartphone.</small></div>';
    document.body.appendChild(overlay);
    function close() { overlay.remove(); }
    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close(); });
  }

  function showInstallOffer() {
    if (isStandalone()) return;
    var old = document.getElementById('dayun-install-offer');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = 'dayun-install-offer';
    overlay.className = 'dy-install-guide dy-install-offer';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'dayun-install-offer-title');
    overlay.innerHTML = '<div><img src="assets/logo-yayasan-gambut-192.png" alt=""><span class="dy-offline-badge is-ready">Peta offline siap</span><h2 id="dayun-install-offer-title">Tambahkan pintasan untuk masuk tanpa internet</h2><p>Paket sudah tersimpan. Pasang Peta Dayun ke layar utama agar dapat dibuka kembali setelah browser ditutup atau mode pesawat diaktifkan.</p><div class="dy-install-offer-actions"><button type="button" data-later>Nanti</button><button type="button" data-install-now>Pasang sekarang</button></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('[data-later]').addEventListener('click', function () { overlay.remove(); });
    overlay.querySelector('[data-install-now]').addEventListener('click', function () { overlay.remove(); installButton.click(); });
  }

  async function downloadPackage() {
    if (!navigator.onLine) { renderStatus(packageMeta); return; }
    var worker = activeWorker();
    if (!worker) { statusText.textContent = 'Layanan offline belum siap. Muat ulang halaman lalu coba kembali.'; return; }
    saveButton.disabled = true;
    installButton.hidden = true;
    deleteButton.hidden = true;
    statusBadge.textContent = 'Mengunduh';
    statusBadge.className = 'dy-offline-badge is-working';
    statusText.textContent = 'Menyiapkan halaman, data gawangan, dan citra Dayun…';
    if (progress) { progress.hidden = false; progressBar.style.width = '1%'; }
    if (navigator.storage && navigator.storage.persist) {
      try { await navigator.storage.persist(); } catch (_) {}
    }
    worker.postMessage({ type: 'DAYUN_OFFLINE_DOWNLOAD' });
  }

  saveButton.addEventListener('click', downloadPackage);

  installButton.addEventListener('click', async function () {
    if (isStandalone()) { installButton.hidden = true; return; }
    if (!packageMeta.ready) return;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) {}
      deferredPrompt = null;
      return;
    }
    showInstallGuide();
  });

  deleteButton.addEventListener('click', async function () {
    if (!window.confirm('Hapus paket Peta Dayun dari perangkat ini? Peta tetap tersedia saat ada internet.')) return;
    deleteButton.disabled = true;
    try { renderStatus(await askWorker('DAYUN_OFFLINE_DELETE')); }
    catch (error) { statusText.textContent = error.message; }
    finally { deleteButton.disabled = false; }
  });

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    if (packageMeta.ready && !isStandalone()) installButton.hidden = false;
  });
  window.addEventListener('appinstalled', function () { deferredPrompt = null; installButton.hidden = true; });
  window.addEventListener('online', function () { renderStatus(packageMeta); });
  window.addEventListener('offline', function () { renderStatus(packageMeta); });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (event) {
      var data = event.data || {};
      if (data.type === 'DAYUN_OFFLINE_PROGRESS') {
        var percent = Math.max(1, Math.round(data.completed / data.total * 100));
        statusText.textContent = 'Mengunduh paket peta… ' + percent + '%';
        if (progressBar) progressBar.style.width = percent + '%';
      }
      if (data.type === 'DAYUN_OFFLINE_READY') { renderStatus(data.meta); showInstallOffer(); }
      if (data.type === 'DAYUN_OFFLINE_DELETED') renderStatus({ ready: false });
      if (data.type === 'DAYUN_OFFLINE_ERROR') {
        renderStatus(packageMeta);
        statusBadge.textContent = 'Unduhan gagal';
        statusBadge.className = 'dy-offline-badge is-error';
        statusText.textContent = 'Paket belum lengkap. Pastikan internet stabil lalu coba lagi.';
      }
    });

    window.addEventListener('load', async function () {
      try {
        registration = await navigator.serviceWorker.register('./service-worker.js?v=20260920-dayun-entry1', { updateViaCache: 'none' });
        await registration.update();
        registration = await navigator.serviceWorker.ready;
        renderStatus(await askWorker('DAYUN_OFFLINE_STATUS'));
      } catch (error) {
        statusBadge.textContent = 'Tidak didukung';
        statusBadge.className = 'dy-offline-badge is-error';
        statusText.textContent = 'Browser ini belum dapat menyiapkan peta offline.';
        saveButton.disabled = true;
      }
    }, { once: true });
  } else {
    statusBadge.textContent = 'Tidak didukung';
    statusBadge.className = 'dy-offline-badge is-error';
    statusText.textContent = 'Gunakan Chrome, Edge, atau Safari terbaru untuk menyimpan peta offline.';
    saveButton.disabled = true;
  }
})();
