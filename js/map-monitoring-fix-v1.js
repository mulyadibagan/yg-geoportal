(function () {
  'use strict';

  if (window.__YG_MAP_MONITORING_FIX_ACTIVE__) return;
  window.__YG_MAP_MONITORING_FIX_ACTIVE__ = true;

  var REPORTS_API = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=public-reports';
  var latestReportsData = null;

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalize(value) {
    return clean(value).toLowerCase();
  }

  function driveId(url) {
    var text = clean(url);
    var patterns = [
      /\/file\/d\/([A-Za-z0-9_-]+)/i,
      /[?&]id=([A-Za-z0-9_-]+)/i,
      /\/d\/([A-Za-z0-9_-]+)/i
    ];
    for (var i = 0; i < patterns.length; i += 1) {
      var match = text.match(patterns[i]);
      if (match) return match[1];
    }
    return '';
  }

  function thumbnail(url) {
    var id = driveId(url);
    return id
      ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w1200'
      : clean(url);
  }

  function original(url) {
    var id = driveId(url);
    return id
      ? 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view'
      : clean(url);
  }

  function escapeHtml(value) {
    return clean(value).replace(/[&<>"']/g, function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  function appendPhotoValues(output, value) {
    if (value == null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach(function (item) { appendPhotoValues(output, item); });
      return;
    }
    if (value && typeof value === 'object') {
      appendPhotoValues(output, value.url || value.webViewLink || value.fileUrl || value.src || '');
      return;
    }
    var text = clean(value);
    var values;
    if (!text) return;
    try {
      values = JSON.parse(text);
      if (values !== text) {
        appendPhotoValues(output, values);
        return;
      }
    } catch (error) {}
    values = text.match(/https?:\/\/[^\s,;|"'<>]+/gi) || [];
    values.forEach(function (url) {
      url = clean(url).replace(/[)\]}]+$/, '');
      if (output.indexOf(url) === -1) output.push(url);
    });
  }

  function photosOf(properties) {
    properties = properties || {};
    var photos = [];
    Object.keys(properties).forEach(function (key) {
      var normalizedKey = normalize(key).replace(/[^a-z0-9]+/g, '');
      if (
        normalizedKey === 'photos' ||
        normalizedKey.indexOf('photo') !== -1 ||
        normalizedKey.indexOf('foto') !== -1 ||
        normalizedKey.indexOf('image') !== -1 ||
        normalizedKey.indexOf('dokumentasi') !== -1 ||
        normalizedKey.indexOf('before') !== -1 ||
        normalizedKey.indexOf('after') !== -1
      ) {
        appendPhotoValues(photos, properties[key]);
      }
    });
    return photos;
  }

  function reportKey(properties) {
    properties = properties || {};
    return clean(properties.reportId || properties.monitoringId);
  }

  function objectKey(properties) {
    properties = properties || {};
    return normalize(properties.targetObjectId || properties.Object_ID || '');
  }

  function fallbackKey(properties) {
    properties = properties || {};
    var layer = properties.targetLayerId || properties.Layer_ID || properties.Source_Layer || '';
    var name = properties.targetObjectName || properties.locationName || properties.Nama_Objek || properties.title || '';
    return normalize(layer) + '|' + normalize(name);
  }

  function photoGallery(photos) {
    if (!photos.length) return '';
    return '<div class="yg-v3-gallery yg-monitoring-live-gallery">' +
      photos.map(function (url, index) {
        return '<a class="yg-photo-card" href="' + escapeHtml(original(url)) + '" target="_blank" rel="noopener noreferrer">' +
          '<img src="' + escapeHtml(thumbnail(url)) + '" loading="lazy" alt="Foto monitoring ' + (index + 1) + '">' +
        '</a>';
      }).join('') +
    '</div>';
  }

  function bringMonitoringToFront() {
    var api = window.YG_MAP;
    var group = api && api.layerObjects && api.layerObjects.monitoring_reports;
    if (!group || typeof group.eachLayer !== 'function') return false;
    if (api.map && !api.map.__ygMonitoringPhotoRefreshBound) {
      api.map.__ygMonitoringPhotoRefreshBound = true;
      api.map.on('popupopen', function (event) {
        var popupElement = event && event.popup && event.popup.getElement
          ? event.popup.getElement()
          : null;
        var popupBody = popupElement && popupElement.querySelector('.popup-body');
        if (popupBody && popupElement.classList.contains('yg-monitoring-popup')) {
          if (window.L && L.DomEvent) {
            L.DomEvent.disableScrollPropagation(popupBody);
            L.DomEvent.disableClickPropagation(popupBody);
          }
          popupBody.addEventListener('wheel', function (wheelEvent) {
            wheelEvent.preventDefault();
            wheelEvent.stopPropagation();
            popupBody.scrollTop += wheelEvent.deltaY;
          }, { passive: false });
          ['mousedown', 'pointerdown', 'touchstart', 'touchmove'].forEach(function (eventName) {
            popupBody.addEventListener(eventName, function (pointerEvent) {
              pointerEvent.stopPropagation();
            }, { passive: true });
          });
        }
        if (latestReportsData) {
          window.setTimeout(function () { mergeReports(latestReportsData); }, 0);
        }
      });
    }
    group.eachLayer(function (layer) {
      if (layer && typeof layer.bringToFront === 'function') layer.bringToFront();
      if (layer && layer._path) layer._path.style.pointerEvents = 'auto';
    });
    return true;
  }

  function mergeReports(data) {
    var api = window.YG_MAP;
    var group = api && api.layerObjects && api.layerObjects.monitoring_reports;
    if (!group || typeof group.eachLayer !== 'function') return false;
    if (api.map && !api.map.__ygMonitoringPhotoRefreshBound) {
      api.map.__ygMonitoringPhotoRefreshBound = true;
      api.map.on('popupopen', function (event) {
        var popupElement = event && event.popup && event.popup.getElement
          ? event.popup.getElement()
          : null;
        var popupBody = popupElement && popupElement.querySelector('.popup-body');
        if (popupBody && popupElement.classList.contains('yg-monitoring-popup')) {
          if (window.L && L.DomEvent) {
            L.DomEvent.disableScrollPropagation(popupBody);
            L.DomEvent.disableClickPropagation(popupBody);
          }
          popupBody.addEventListener('wheel', function (wheelEvent) {
            wheelEvent.preventDefault();
            wheelEvent.stopPropagation();
            popupBody.scrollTop += wheelEvent.deltaY;
          }, { passive: false });
          ['mousedown', 'pointerdown', 'touchstart', 'touchmove'].forEach(function (eventName) {
            popupBody.addEventListener(eventName, function (pointerEvent) {
              pointerEvent.stopPropagation();
            }, { passive: true });
          });
        }
        if (latestReportsData) {
          window.setTimeout(function () { mergeReports(latestReportsData); }, 0);
        }
      });
    }

    var reports = data && Array.isArray(data.features) ? data.features : [];
    var byReport = {};
    var byObject = {};
    var byFallback = {};
    var byLocation = {};

    reports.forEach(function (feature) {
      var properties = feature && feature.properties || {};
      var type = normalize(properties.reportType || properties.type || properties.Jenis_Laporan || properties.jenisLaporan);
      if (type && type.indexOf('monitor') === -1) return;
      var photos = photosOf(properties);
      if (!photos.length) return;
      if (reportKey(properties)) byReport[reportKey(properties)] = photos;
      if (objectKey(properties)) byObject[objectKey(properties)] = photos;
      byFallback[fallbackKey(properties)] = photos;
      var reportLocation = normalize(properties.targetObjectName || properties.locationName || properties.Nama_Objek || properties.title || properties.village || properties.desa || '');
      if (reportLocation) byLocation[reportLocation] = photos;
    });

    group.eachLayer(function (layer) {
      var properties = layer && layer.feature && layer.feature.properties || {};
      var photos = byReport[reportKey(properties)] ||
        byObject[objectKey(properties)] ||
        byFallback[fallbackKey(properties)] ||
        byLocation[normalize(properties.targetObjectName || properties.locationName || properties.Nama_Objek || properties.title || properties.village || properties.desa || '')] ||
        photosOf(properties) || [];
      if (!photos.length || !layer.getPopup || !layer.getPopup()) return;

      properties.photos = photos;
      var popup = layer.getPopup();
      var content = String(popup.getContent() || '');
      if (content.indexOf('yg-v3-gallery') !== -1) return;
      var gallery = photoGallery(photos);
      if (content.indexOf('<div class="popup-body">') !== -1) {
        content = content.replace(
          '<div class="popup-body">',
          '<div class="popup-body">' + gallery
        );
      } else {
        content += gallery;
      }
      popup.setContent(content);
    });

    bringMonitoringToFront();
    return true;
  }

  function loadReports() {
    var callback = 'ygMapMonitoringReports_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    var script = document.createElement('script');
    var timer;

    function finish(data) {
      window.clearTimeout(timer);
      try { delete window[callback]; } catch (error) { window[callback] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
      latestReportsData = data;
      var attempts = 0;
      (function applyWhenReady() {
        attempts += 1;
        mergeReports(data);
        if (attempts < 80) {
          window.setTimeout(applyWhenReady, 500);
        }
      })();
    }

    window[callback] = finish;
    script.async = true;
    script.src = REPORTS_API + '&callback=' + encodeURIComponent(callback) + '&t=' + Date.now();
    script.onerror = function () { finish({ features: [] }); };
    timer = window.setTimeout(function () { finish({ features: [] }); }, 30000);
    document.head.appendChild(script);
  }


  document.addEventListener('change', function (event) {
    if (event.target && event.target.matches('#layer-list input[type="checkbox"]')) {
      window.setTimeout(bringMonitoringToFront, 60);
    }
  });

  document.addEventListener('click', function (event) {
    if (event.target && event.target.closest('#layer-list')) {
      window.setTimeout(bringMonitoringToFront, 80);
    }
  });

  var style = document.createElement('style');
  style.textContent = '.yg-monitoring-live-gallery{border-top:1px solid #edf2ef;margin-top:6px}';
  document.head.appendChild(style);

  loadReports();
  window.setInterval(bringMonitoringToFront, 1500);
})();
