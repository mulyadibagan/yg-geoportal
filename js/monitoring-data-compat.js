(function () {
  'use strict';

  var callbackName = 'ygMonitoringDashboardCallback';
  var assignedCallback = null;

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
      var parsed = new Date(Number(indo[3]), Number(indo[2]) - 1, Number(indo[1]), Number(indo[4] || 0), Number(indo[5] || 0), Number(indo[6] || 0));
      if (!isNaN(parsed.getTime())) return parsed.toISOString();
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

  function firstValue(object, keys) {
    if (!object || typeof object !== 'object') return '';
    for (var i = 0; i < keys.length; i += 1) {
      var value = object[keys[i]];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
  }

  function pushUnique(output, url) {
    url = String(url || '').trim().replace(/[.,]+$/, '');
    if (/^https?:\/\//i.test(url) && output.indexOf(url) === -1) output.push(url);
  }

  function collectUrls(value, output, depth) {
    if (value === undefined || value === null || value === '' || depth > 6) return;
    value = parseMaybeJSON(value);
    if (Array.isArray(value)) { value.forEach(function (item) { collectUrls(item, output, depth + 1); }); return; }
    if (typeof value === 'object') {
      var direct = firstValue(value, ['url','webViewLink','webContentLink','fileUrl','photoUrl','imageUrl','src','link']);
      if (direct) collectUrls(direct, output, depth + 1);
      Object.keys(value).forEach(function (key) { if (/foto|photo|image|dokumentasi|attachment|lampiran/i.test(key)) collectUrls(value[key], output, depth + 1); });
      return;
    }
    (String(value).match(/https?:\/\/[^\s,;|"'< >\]\)]+/gi) || []).forEach(function (url) { pushUnique(output, url); });
  }

  function normalizeProperties(p) {
    p = p && typeof p === 'object' ? p : {};
    var rawDate = p.activityDate || firstValue(p,['monitoringDate','activity_date','monitoring_date','tanggalKegiatan','tanggalMonitoring','date','reportDate','eventDate','publishedAt','verifiedAt','receivedAt','createdAt','timestamp']);
    if (rawDate) p.activityDate = normalizeDateValue(rawDate);
    var photos = [];
    ['photos','photoUrls','images','imageUrls','documentation','attachments','dokumentasiFoto','foto','fotoUrls'].forEach(function (key) { collectUrls(p[key], photos, 0); });
    collectUrls(parseMaybeJSON(p.proposedInformation), photos, 0);
    if (photos.length) p.photos = photos;
    return p;
  }

  function normalizePayload(data) {
    if (!data || typeof data !== 'object') return data;
    var features = Array.isArray(data.features) ? data.features : [];
    if (!features.length && Array.isArray(data.updates)) features = data.updates;
    if (!features.length && Array.isArray(data.reports)) features = data.reports;
    if (!features.length && Array.isArray(data.items)) features = data.items;
    if (!features.length && Array.isArray(data.data)) features = data.data;
    data.features = features.map(function (item) {
      if (item && item.type === 'Feature') { item.properties = normalizeProperties(item.properties || {}); return item; }
      return {type:'Feature',properties:normalizeProperties(item && item.properties ? item.properties : item || {}),geometry:item && item.geometry ? item.geometry : null};
    });
    return data;
  }

  try {
    Object.defineProperty(window, callbackName, {
      configurable: true,
      enumerable: true,
      get: function () {
        return assignedCallback ? function (data) { assignedCallback(normalizePayload(data)); } : undefined;
      },
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
