(function () {
  'use strict';

  var REPORTS_API = 'https://script.google.com/macros/s/AKfycbxeGTDZXkR0DyLZmBHTq2M-52Iu4dTTGpH164S7sYHg8qPzvffobC6-r-TBLVHMT3HU-A/exec?page=public-reports';

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

  function photosOf(properties) {
    var value = properties && properties.photos;
    if (!value) return [];
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch (error) {
        value = value.match(/https?:\/\/[^\s,;|]+/gi) || [];
      }
    }
    if (!Array.isArray(value)) value = [value];
    return value.map(function (item) {
      if (item && typeof item === 'object') {
        item = item.url || item.webViewLink || item.fileUrl || item.src || '';
      }
      return clean(item);
    }).filter(function (url, index, list) {
      return /^https?:\/\//i.test(url) && list.indexOf(url) === index;
    });
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

    var reports = data && Array.isArray(data.features) ? data.features : [];
    var byReport = {};
    var byObject = {};
    var byFallback = {};

    reports.forEach(function (feature) {
      var properties = feature && feature.properties || {};
      if (normalize(properties.reportType) !== 'monitoring') return;
      var photos = photosOf(properties);
      if (!photos.length) return;
      if (reportKey(properties)) byReport[reportKey(properties)] = photos;
      if (objectKey(properties)) byObject[objectKey(properties)] = photos;
      byFallback[fallbackKey(properties)] = photos;
    });

    group.eachLayer(function (layer) {
      var properties = layer && layer.feature && layer.feature.properties || {};
      var photos = byReport[reportKey(properties)] ||
        byObject[objectKey(properties)] ||
        byFallback[fallbackKey(properties)] || [];
      if (!photos.length || !layer.getPopup || !layer.getPopup()) return;

      properties.photos = photos;
      var popup = layer.getPopup();
      var content = String(popup.getContent() || '');
      if (content.indexOf('yg-monitoring-live-gallery') !== -1) return;
      var gallery = photoGallery(photos);
      content = content.replace('</div></div>', gallery + '</div></div>');
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
      var attempts = 0;
      (function applyWhenReady() {
        attempts += 1;
        if (!mergeReports(data) && attempts < 40) {
          window.setTimeout(applyWhenReady, 300);
        }
      })();
    }

    window[callback] = finish;
    script.async = true;
    script.src = REPORTS_API + '&callback=' + encodeURIComponent(callback) + '&t=' + Date.now();
    script.onerror = function () { finish({ features: [] }); };
    timer = window.setTimeout(function () { finish({ features: [] }); }, 15000);
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
