(function () {
  'use strict';

  var callbackName = 'ygMonitoringDashboardCallback';
  var updatesCallbackName = 'ygMonitoringPhotoUpdatesCallback';
  var assignedCallback = null;
  var BASE = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';

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

  function keyText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize ? String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim() : String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function geometryKey(geometry) {
    if (!geometry || !geometry.type || typeof geometry.coordinates === 'undefined') return '';
    try { return JSON.stringify({ type: geometry.type, coordinates: geometry.coordinates }); }
    catch (error) { return ''; }
  }

  function objectKeys(feature) {
    var p = feature && feature.properties ? feature.properties : {};
    return {
      id: String(p.targetObjectId || '').trim(),
      name: keyText(p.targetObjectName || p.locationName || p.title || ''),
      layer: keyText(p.targetLayerId || p.layerId || p.layer || ''),
      geometry: geometryKey(feature && feature.geometry)
    };
  }

  function sameObject(targetKeys, sourceKeys) {
    if (!targetKeys || !sourceKeys) return false;

    // Layer wajib sama agar foto mangrove tidak pernah bercampur dengan
    // FDRS, sekat kanal, APO, atau jenis objek lain.
    if (!targetKeys.layer || !sourceKeys.layer || targetKeys.layer !== sourceKeys.layer) return false;

    // Nama objek yang sudah dinormalisasi menjadi identitas utama untuk
    // data lama karena targetObjectId dapat berubah saat geometri direvisi.
    if (targetKeys.name && sourceKeys.name) return targetKeys.name === sourceKeys.name;

    // Fallback aman hanya untuk data lama yang benar-benar tidak memiliki nama.
    if (targetKeys.id && sourceKeys.id) return targetKeys.id === sourceKeys.id;
    return !!targetKeys.geometry && targetKeys.geometry === sourceKeys.geometry;
  }

  function mergePhotoUpdates(reportData, updateData) {
    var reports = normalizePayload(reportData);
    var updates = normalizePayload(updateData);
    var reportFeatures = reports && Array.isArray(reports.features) ? reports.features : [];
    var updateFeatures = updates && Array.isArray(updates.features) ? updates.features : [];

    reportFeatures.forEach(function (feature) {
      var target = feature.properties || {};
      var targetKeys = objectKeys(feature);
      var merged = [];
      (Array.isArray(target.photos) ? target.photos : []).forEach(function (url) { pushUnique(merged, url); });

      updateFeatures.forEach(function (updateFeature) {
        var source = updateFeature.properties || {};
        if (keyText(source.reportType || '') !== 'tambah foto kegiatan') return;
        if (!sameObject(targetKeys, objectKeys(updateFeature))) return;
        (Array.isArray(source.photos) ? source.photos : []).forEach(function (url) { pushUnique(merged, url); });
      });

      target.photos = merged;
      feature.properties = target;
    });

    return reports;
  }

  function deliverWithUpdates(reportData) {
    var completed = false;
    function finish(data) {
      if (completed) return;
      completed = true;
      try { delete window[updatesCallbackName]; } catch (error) { window[updatesCallbackName] = undefined; }
      assignedCallback(normalizePayload(data));
    }

    window[updatesCallbackName] = function (updateData) {
      finish(mergePhotoUpdates(reportData, updateData));
    };

    var script = document.createElement('script');
    script.src = BASE + '?page=public-updates&callback=' + updatesCallbackName + '&t=' + Date.now();
    script.async = true;
    script.onerror = function () { finish(reportData); };
    document.head.appendChild(script);
    window.setTimeout(function () { finish(reportData); }, 8000);
  }

  try {
    Object.defineProperty(window, callbackName, {
      configurable: true,
      enumerable: true,
      get: function () {
        return assignedCallback ? function (data) { deliverWithUpdates(data); } : undefined;
      },
      set: function (fn) { assignedCallback = typeof fn === 'function' ? fn : null; }
    });
  } catch (error) {
    var timer = window.setInterval(function () {
      var original = window[callbackName];
      if (typeof original !== 'function' || original.__ygCompatWrapped) return;
      var wrapped = function (data) { assignedCallback = original; deliverWithUpdates(data); };
      wrapped.__ygCompatWrapped = true;
      window[callbackName] = wrapped;
      window.clearInterval(timer);
    }, 10);
    window.setTimeout(function () { window.clearInterval(timer); }, 10000);
  }
})();
