(function () {
  'use strict';

  var callbackName = 'ygMonitoringDashboardCallback';
  var assignedCallback = null;

  function firstValue(object, keys) {
    if (!object || typeof object !== 'object') return '';
    for (var i = 0; i < keys.length; i += 1) {
      var value = object[keys[i]];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
  }

  function normalizeDateValue(value) {
    if (value === undefined || value === null || value === '') return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'number' && isFinite(value)) {
      if (value > 100000000000) return new Date(value).toISOString();
      if (value > 1000000000) return new Date(value * 1000).toISOString();
      if (value > 20000 && value < 100000) return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString();
    }
    var text = String(value).trim();
    if (!text) return '';
    var indo = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (indo) {
      var day = Number(indo[1]);
      var month = Number(indo[2]);
      var year = Number(indo[3]);
      var parsedIndo = new Date(year, month - 1, day, Number(indo[4] || 0), Number(indo[5] || 0), Number(indo[6] || 0));
      if (parsedIndo.getFullYear() === year && parsedIndo.getMonth() === month - 1 && parsedIndo.getDate() === day) return parsedIndo.toISOString();
    }
    var isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
    if (isoDate) {
      var parsedIso = new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
      if (!isNaN(parsedIso.getTime())) return parsedIso.toISOString();
    }
    var direct = new Date(text);
    return isNaN(direct.getTime()) ? text : direct.toISOString();
  }

  function parseMaybeJSON(value) {
    if (typeof value !== 'string') return value;
    var text = value.trim();
    if (!text || (text.charAt(0) !== '{' && text.charAt(0) !== '[')) return value;
    try { return JSON.parse(text); } catch (error) { return value; }
  }

  function pushUnique(output, url) {
    url = String(url || '').trim().replace(/[.,]+$/, '');
    if (/^https?:\/\//i.test(url) && output.indexOf(url) === -1) output.push(url);
  }

  function driveViewUrl(fileId) {
    var id = String(fileId || '').trim();
    return /^[A-Za-z0-9_-]{20,}$/.test(id) ? 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view' : '';
  }

  function collectUrls(value, output, depth) {
    if (value === undefined || value === null || value === '' || depth > 8) return;
    value = parseMaybeJSON(value);
    if (Array.isArray(value)) {
      value.forEach(function (item) { collectUrls(item, output, depth + 1); });
      return;
    }
    if (typeof value === 'object') {
      var direct = firstValue(value, [
        'url','webViewLink','webContentLink','fileUrl','photoUrl','imageUrl','src','link',
        'downloadUrl','viewUrl','downloadLink','thumbnailUrl','secureUrl'
      ]);
      if (direct) collectUrls(direct, output, depth + 1);

      var fileId = firstValue(value, ['fileId','driveFileId','googleDriveId','googleFileId']);
      if (!fileId && firstValue(value, ['mimeType','filename','fileName','name'])) fileId = value.id;
      if (fileId) pushUnique(output, driveViewUrl(fileId));

      Object.keys(value).forEach(function (key) {
        if (/foto|photo|image|dokumentasi|documentation|attachment|lampiran|file/i.test(key)) collectUrls(value[key], output, depth + 1);
      });
      return;
    }
    var text = String(value).trim();
    var urls = text.match(/https?:\/\/[^\s,;|"'< >\]\)]+/gi) || [];
    urls.forEach(function (url) { pushUnique(output, url); });
  }

  function restorePhotos(p) {
    var photos = [];
    var keys = [
      'photos','photoUrls','photoURLs','photoLinks','images','imageUrls','documentationPhotos',
      'documentation','attachments','files','dokumentasiFoto','foto','fotoUrls','uploadedPhotos',
      'photo1','photo2','photo3','photo4','photo5','foto1','foto2','foto3','foto4','foto5'
    ];
    keys.forEach(function (key) { collectUrls(p[key], photos, 0); });
    collectUrls(parseMaybeJSON(p.proposedInformation), photos, 0);
    collectUrls(parseMaybeJSON(p.proposedChanges), photos, 0);
    Object.keys(p).forEach(function (key) {
      if (/foto|photo|image|dokumentasi|documentation|attachment|lampiran/i.test(key)) collectUrls(p[key], photos, 0);
    });
    if (photos.length) p.photos = photos;
  }

  function normalizeProperties(properties) {
    var p = properties && typeof properties === 'object' ? properties : {};
    var rawDate = p.activityDate || firstValue(p, [
      'monitoringDate','activity_date','monitoring_date','tanggalKegiatan','tanggalMonitoring',
      'date','reportDate','eventDate','publishedAt','verifiedAt','receivedAt','createdAt','timestamp'
    ]);
    if (rawDate) p.activityDate = normalizeDateValue(rawDate);
    restorePhotos(p);
    return p;
  }

  function normalizePayload(data) {
    if (!data || typeof data !== 'object') return data;
    var features = Array.isArray(data.features) ? data.features : Array.isArray(data.updates) ? data.updates : Array.isArray(data.reports) ? data.reports : [];
    if (!Array.isArray(data.features) && features.length) data.features = features;
    data.features = (data.features || []).map(function (item) {
      if (item && item.type === 'Feature') {
        item.properties = normalizeProperties(item.properties || {});
        return item;
      }
      return { type: 'Feature', properties: normalizeProperties(item && item.properties ? item.properties : item || {}), geometry: item && item.geometry ? item.geometry : null };
    });
    return data;
  }

  try {
    Object.defineProperty(window, callbackName, {
      configurable: true,
      enumerable: true,
      get: function () { return assignedCallback ? function (data) { assignedCallback(normalizePayload(data)); } : undefined; },
      set: function (fn) { assignedCallback = typeof fn === 'function' ? fn : null; }
    });
  } catch (error) {
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