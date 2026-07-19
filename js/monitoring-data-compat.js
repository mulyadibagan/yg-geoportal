(function () {
  'use strict';

  var callbackName = 'ygMonitoringDashboardCallback';
  var assignedCallback = null;

  function firstValue(object, keys) {
    if (!object || typeof object !== 'object') return '';
    for (var i = 0; i < keys.length; i += 1) {
      var value = object[keys[i]];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
    return '';
  }

  function collectPhotoValues(value, output) {
    if (value === undefined || value === null || value === '') return;

    if (Array.isArray(value)) {
      value.forEach(function (item) {
        collectPhotoValues(item, output);
      });
      return;
    }

    if (typeof value === 'object') {
      var direct = firstValue(value, [
        'url', 'webViewLink', 'webContentLink', 'fileUrl', 'photoUrl',
        'imageUrl', 'src', 'link', 'downloadUrl'
      ]);
      if (direct) collectPhotoValues(direct, output);
      else Object.keys(value).forEach(function (key) {
        collectPhotoValues(value[key], output);
      });
      return;
    }

    var text = String(value).trim();
    if (!text) return;

    try {
      var parsed = JSON.parse(text);
      if (parsed !== text) {
        collectPhotoValues(parsed, output);
        return;
      }
    } catch (error) {
      // Nilai bukan JSON; lanjutkan sebagai teks biasa.
    }

    var urls = text.match(/https?:\/\/[^\s,;|"'<>]+/gi);
    if (urls && urls.length) {
      urls.forEach(function (url) {
        if (output.indexOf(url) === -1) output.push(url);
      });
    }
  }

  function normalizeProperties(properties) {
    var p = properties && typeof properties === 'object' ? properties : {};

    if (!p.activityDate) {
      p.activityDate = firstValue(p, [
        'monitoringDate', 'activity_date', 'monitoring_date', 'tanggalKegiatan',
        'tanggalMonitoring', 'date', 'reportDate', 'eventDate', 'publishedAt',
        'verifiedAt', 'receivedAt', 'createdAt', 'timestamp'
      ]);
    }

    var photos = [];
    [
      'photos', 'photoUrls', 'photoURLs', 'photoLinks', 'images', 'imageUrls',
      'documentationPhotos', 'documentation', 'attachments', 'files',
      'dokumentasiFoto', 'foto', 'fotoUrls', 'uploadedPhotos'
    ].forEach(function (key) {
      collectPhotoValues(p[key], photos);
    });

    if (!photos.length) {
      Object.keys(p).forEach(function (key) {
        if (/foto|photo|image|dokumentasi|attachment/i.test(key)) {
          collectPhotoValues(p[key], photos);
        }
      });
    }

    if (photos.length) p.photos = photos;
    return p;
  }

  function normalizePayload(data) {
    if (!data || typeof data !== 'object') return data;

    var features = Array.isArray(data.features)
      ? data.features
      : Array.isArray(data.updates)
        ? data.updates
        : Array.isArray(data.reports)
          ? data.reports
          : [];

    if (!Array.isArray(data.features) && features.length) {
      data.features = features;
    }

    data.features = (data.features || []).map(function (item) {
      if (item && item.type === 'Feature') {
        item.properties = normalizeProperties(item.properties || {});
        return item;
      }

      return {
        type: 'Feature',
        properties: normalizeProperties(item && item.properties ? item.properties : item || {}),
        geometry: item && item.geometry ? item.geometry : null
      };
    });

    return data;
  }

  try {
    Object.defineProperty(window, callbackName, {
      configurable: true,
      enumerable: true,
      get: function () {
        return assignedCallback
          ? function (data) { assignedCallback(normalizePayload(data)); }
          : undefined;
      },
      set: function (fn) {
        assignedCallback = typeof fn === 'function' ? fn : null;
      }
    });
  } catch (error) {
    // Fallback untuk browser lama.
    var timer = window.setInterval(function () {
      var original = window[callbackName];
      if (typeof original !== 'function' || original.__ygCompatWrapped) return;
      var wrapped = function (data) { original(normalizePayload(data)); };
      wrapped.__ygCompatWrapped = true;
      window[callbackName] = wrapped;
      window.clearInterval(timer);
    }, 10);
    window.setTimeout(function () { window.clearInterval(timer); }, 10000);
  }
})();
