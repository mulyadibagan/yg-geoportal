(function (global) {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character];
    });
  }

  function errorMessage(error) {
    if (!global.isSecureContext) return 'Lokasi hanya tersedia melalui koneksi HTTPS.';
    if (!global.navigator.geolocation) return 'Perangkat ini tidak mendukung pembacaan lokasi.';
    if (error && error.code === 1) return 'Izin lokasi ditolak. Aktifkan izin lokasi pada browser lalu coba kembali.';
    if (error && error.code === 2) return 'Posisi belum dapat ditemukan. Pastikan GPS atau layanan lokasi aktif.';
    if (error && error.code === 3) return 'Pencarian lokasi terlalu lama. Silakan coba kembali di area yang lebih terbuka.';
    return 'Lokasi belum dapat ditampilkan. Silakan coba kembali.';
  }

  function create(map, options) {
    options = options || {};
    var button = options.button || null;
    var marker = null;
    var accuracyCircle = null;
    var watchId = null;
    var active = false;
    var firstPosition = true;

    function setButton(state, label) {
      if (!button) return;
      button.classList.toggle('is-active', state === 'active');
      button.classList.toggle('is-loading', state === 'loading');
      button.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
      button.setAttribute('aria-pressed', state === 'active' ? 'true' : 'false');
      button.title = label;
      var text = button.querySelector('[data-location-label]');
      if (text) text.textContent = label;
      else button.textContent = label;
    }

    function announce(message, kind) {
      if (typeof options.onStatus === 'function') options.onStatus(message, kind || 'info');
    }

    function stop(removeLayers) {
      if (watchId != null && global.navigator.geolocation) global.navigator.geolocation.clearWatch(watchId);
      watchId = null;
      active = false;
      firstPosition = true;
      setButton('idle', options.startLabel || 'Lokasi saya');
      if (removeLayers !== false) {
        if (marker) map.removeLayer(marker);
        if (accuracyCircle) map.removeLayer(accuracyCircle);
        marker = null;
        accuracyCircle = null;
      }
      announce('Pelacakan lokasi dihentikan. Titik lokasi telah dihapus dari peta.', 'idle');
    }

    function update(position) {
      var latitude = Number(position.coords.latitude);
      var longitude = Number(position.coords.longitude);
      var accuracy = Math.max(0, Number(position.coords.accuracy) || 0);
      var latlng = L.latLng(latitude, longitude);
      var detail = typeof options.describePosition === 'function' ? options.describePosition(latlng) || '' : '';
      var accuracyText = accuracy < 1000
        ? Math.round(accuracy) + ' m'
        : (accuracy / 1000).toLocaleString('id-ID', {maximumFractionDigits: 1}) + ' km';

      if (!accuracyCircle) {
        accuracyCircle = L.circle(latlng, {
          radius: accuracy,
          color: '#087d76',
          weight: 1.5,
          opacity: 0.9,
          fillColor: '#31b7d9',
          fillOpacity: 0.12,
          interactive: false
        }).addTo(map);
      } else {
        accuracyCircle.setLatLng(latlng).setRadius(accuracy);
      }

      if (!marker) {
        marker = L.circleMarker(latlng, {
          radius: 8,
          color: '#ffffff',
          weight: 3,
          fillColor: '#087d76',
          fillOpacity: 1,
          className: 'yg-user-location-marker'
        }).addTo(map);
      } else {
        marker.setLatLng(latlng);
      }

      marker.bindPopup(
        '<div class="yg-location-popup"><strong>Lokasi Anda</strong>' +
        '<span>Akurasi sekitar ' + escapeHtml(accuracyText) + '</span>' +
        (detail ? '<b>' + escapeHtml(detail) + '</b>' : '') +
        '<small>Koordinat hanya digunakan pada perangkat ini dan tidak disimpan.</small></div>'
      );

      if (firstPosition || options.follow === true) {
        map.setView(latlng, Math.max(map.getZoom(), Number(options.maxZoom) || 17));
        firstPosition = false;
      }
      active = true;
      setButton('active', options.stopLabel || 'Hentikan lokasi');
      announce('Lokasi ditemukan · akurasi sekitar ' + accuracyText + (detail ? ' · ' + detail : ''), 'ok');
    }

    function fail(error) {
      if (watchId != null && global.navigator.geolocation) global.navigator.geolocation.clearWatch(watchId);
      watchId = null;
      active = false;
      firstPosition = true;
      setButton('idle', options.startLabel || 'Lokasi saya');
      announce(errorMessage(error), 'error');
    }

    function start() {
      if (!global.isSecureContext || !global.navigator.geolocation) {
        fail(null);
        return;
      }
      setButton('loading', options.loadingLabel || 'Mencari lokasi…');
      announce('Mencari posisi perangkat…', 'loading');
      watchId = global.navigator.geolocation.watchPosition(update, fail, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000
      });
    }

    function toggle() {
      if (active || watchId != null) stop(true);
      else start();
    }

    if (button) {
      button.type = 'button';
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', toggle);
    }

    return {start:start, stop:stop, toggle:toggle};
  }

  global.YGUserLocation = {create:create};
})(window);
