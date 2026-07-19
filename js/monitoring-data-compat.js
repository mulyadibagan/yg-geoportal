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

  function normalizeDateValue(value) {
    if (value === undefined || value === null || value === '') return '';
    if (value instanceof Date) return value.toISOString();

    if (typeof value === 'number' && isFinite(value)) {
      if (value > 100000000000) return new Date(value).toISOString();
      if (value > 1000000000) return new Date(value * 1000).toISOString();
      if (value > 20000 && value < 100000) {
        return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString();
      }
    }

    var text = String(value).trim();
    if (!text) return '';

    var indo = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (indo) {
      var day = Number(indo[1]);
      var month = Number(indo[2]);
      var year = Number(indo[3]);
      var hour = Number(indo[4] || 0);
      var minute = Number(indo[5] || 0);
      var second = Number(indo[6] || 0);
      var parsedIndo = new Date(year, month - 1, day, hour, minute, second);
      if (
        parsedIndo.getFullYear() === year &&
        parsedIndo.getMonth() === month - 1 &&
        parsedIndo.getDate() === day
      ) return parsedIndo.toISOString();
    }

    var isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
    if (isoDate) {
      var parsedIso = new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
      if (!isNaN(parsedIso.getTime())) return parsedIso.toISOString();
    }

    var direct = new Date(text);
    return isNaN(direct.getTime()) ? text : direct.toISOString();
  }

  function normalizeProperties(properties) {
    var p = properties && typeof properties === 'object' ? properties : {};
    var rawDate = p.activityDate || firstValue(p, [
      'monitoringDate', 'activity_date', 'monitoring_date', 'tanggalKegiatan',
      'tanggalMonitoring', 'date', 'reportDate', 'eventDate', 'publishedAt',
      'verifiedAt', 'receivedAt', 'createdAt', 'timestamp'
    ]);
    if (rawDate) p.activityDate = normalizeDateValue(rawDate);
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

    if (!Array.isArray(data.features) && features.length) data.features = features;

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
