(() => {
  'use strict';

  const buttons = Array.from(document.querySelectorAll('[data-install-app]'));
  if (!buttons.length) return;

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferredPrompt = null;

  const hideButtons = () => buttons.forEach((button) => { button.hidden = true; });
  const showButtons = () => buttons.forEach((button) => { button.hidden = false; });

  function showIOSGuide() {
    const old = document.getElementById('yg-ios-install-guide');
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'yg-ios-install-guide';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Pasang YG GeoPortal di iPhone atau iPad');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center;padding:16px';
    overlay.innerHTML = `<div style="width:min(100%,520px);background:#fff;border-radius:20px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:inherit;color:#17202a">
      <div style="display:flex;align-items:flex-start;gap:12px"><img src="assets/logo-yayasan-gambut-192.png" alt="" width="52" height="52" style="border-radius:12px;object-fit:contain"><div style="flex:1"><strong style="font-size:18px">Pasang YG GeoPortal</strong><p style="margin:5px 0 0;line-height:1.45;color:#52606d">Di iPhone/iPad, pemasangan dilakukan dari menu Safari.</p></div><button type="button" data-close-ios-guide aria-label="Tutup" style="border:0;background:#eef2f5;border-radius:50%;width:34px;height:34px;font-size:22px;line-height:1">×</button></div>
      <ol style="margin:18px 0 8px;padding-left:24px;line-height:1.65"><li>Ketuk tombol <strong>Bagikan</strong> <span aria-hidden="true">□↑</span> di Safari.</li><li>Pilih <strong>Tambahkan ke Layar Utama</strong>.</li><li>Ketuk <strong>Tambah</strong>.</li></ol>
      <p style="margin:12px 0 0;padding:11px 12px;background:#f2f7f4;border-radius:12px;font-size:13px;line-height:1.45">Setelah dipasang, YG GeoPortal dapat dibuka dari ikon di layar utama seperti aplikasi.</p>
    </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('[data-close-ios-guide]').addEventListener('click', close);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  }

  async function install() {
    if (isStandalone()) { hideButtons(); return; }
    if (isIOS) { showIOSGuide(); return; }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) {}
      deferredPrompt = null;
      return;
    }
    alert('Untuk memasang YG GeoPortal, buka menu browser lalu pilih “Instal aplikasi” atau “Tambahkan ke layar utama”.');
  }

  buttons.forEach((button) => button.addEventListener('click', install));

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showButtons();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideButtons();
  });

  if (isStandalone()) hideButtons();
  else if (isIOS) showButtons();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((error) => console.warn('YG GeoPortal service worker:', error));
    }, { once: true });
  }
})();
