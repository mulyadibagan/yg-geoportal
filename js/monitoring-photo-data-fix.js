(function () {
  'use strict';

  var callbackName = 'ygMonitoringDashboardCallback';
  var originalCallback = window[callbackName];
  var updatesEndpoint = 'https://script.google.com/macros/s/AKfycbxeGTDZXkR0DyLZmBHTq2M-52Iu4dTTGpH164S7sYHg8qPzvffobC6-r-TBLVHMT3HU-A/exec?page=public-updates';

  function cleanUrl(value) {
    if (value == null) return '';

    if (typeof value === 'object') {
      value = value.url || value.webViewLink || value.downloadUrl || value.src || value.link || value.fileUrl || '';
    }

    value = String(value).trim();
    if (!value || !/^https?:\/\//i.test(value)) return '';
    return value;
  }

  function normalizePhotos(value) {
    var parsed = value;

    if (typeof parsed === 'string') {
      var text = parsed.trim();
      if (!text) return [];

      try {
        parsed = JSON.parse(text);
      } catch (error) {
        /* Google Drive URLs in the sheet are commonly separated by spaces. */
        parsed = text.match(/https?:\/\/[^\s,;|]+/gi) || text.split(/[\n,;|]+/);
      }
    }

    if (!Array.isArray(parsed)) parsed = [parsed];

    return parsed
      .map(cleanUrl)
      .filter(function (url, index, list) {
        return url && list.indexOf(url) === index;
      });
  }

  function findPhotos(properties) {
    properties = properties || {};

    var candidates = [
      properties.photos,
      properties.photoUrls,
      properties.photoUrl,
      properties.documentationPhotos,
      properties.documentationPhotoUrls,
      properties.dokumentasiFoto,
      properties.foto,
      properties.imageUrls,
      properties.images
    ];

    var result = [];
    candidates.forEach(function (candidate) {
      normalizePhotos(candidate).forEach(function (url) {
        if (result.indexOf(url) === -1) result.push(url);
      });
    });

    return result;
  }

  function parseObject(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (error) {
      return {};
    }
  }

  function getObjectId(properties) {
    properties = properties || {};
    var changes = parseObject(properties.proposedChanges);
    var information = parseObject(properties.proposedInformation);

    return String(
      properties.targetObjectId ||
      changes.targetObjectId ||
      information.targetObjectId ||
      ''
    ).trim();
  }

  function fallbackKey(properties) {
    properties = properties || {};
    var changes = parseObject(properties.proposedChanges);
    var layer = properties.targetLayerId || changes.targetLayerId || '';
    var title = properties.targetObjectName || properties.locationName || changes.targetObjectName || properties.title || '';

    return (String(layer).trim().toLowerCase() + '|' + String(title).trim().toLowerCase());
  }

  function normalizeMainFeatures(data) {
    var features = data && Array.isArray(data.features) ? data.features : [];

    features.forEach(function (feature) {
      var properties = feature && feature.properties;
      if (!properties) return;
      properties.photos = findPhotos(properties);
    });

    return features;
  }

  function mergePhotoUpdates(mainData, updatesData) {
    var mainFeatures = normalizeMainFeatures(mainData);
    var updateFeatures = updatesData && Array.isArray(updatesData.features) ? updatesData.features : [];
    var byId = {};
    var byFallback = {};

    mainFeatures.forEach(function (feature) {
      var properties = feature && feature.properties;
      if (!properties) return;

      var objectId = getObjectId(properties);
      var key = fallbackKey(properties);

      if (objectId) byId[objectId] = properties;
      if (key !== '|') byFallback[key] = properties;
    });

    updateFeatures.forEach(function (feature) {
      var properties = feature && feature.properties;
      if (!properties) return;

      var photos = findPhotos(properties);
      if (!photos.length) return;

      var objectId = getObjectId(properties);
      var target = objectId ? byId[objectId] : null;
      if (!target) target = byFallback[fallbackKey(properties)];
      if (!target) return;

      var combined = findPhotos(target);
      photos.forEach(function (url) {
        if (combined.indexOf(url) === -1) combined.push(url);
      });
      target.photos = combined;
    });

    mainData.features = mainFeatures;
    return mainData;
  }

  function loadUpdates(done) {
    var jsonpCallback = 'ygMonitoringPhotoUpdates_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    var script = document.createElement('script');
    var finished = false;
    var timer;

    function finish(data) {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      try { delete window[jsonpCallback]; } catch (error) { window[jsonpCallback] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
      done(data || { features: [] });
    }

    window[jsonpCallback] = function (data) {
      finish(data);
    };

    script.async = true;
    script.src = updatesEndpoint + '&callback=' + encodeURIComponent(jsonpCallback) + '&t=' + Date.now();
    script.onerror = function () {
      finish({ features: [] });
    };

    timer = window.setTimeout(function () {
      finish({ features: [] });
    }, 12000);

    document.head.appendChild(script);
  }

  if (typeof originalCallback !== 'function') return;

  window[callbackName] = function (data) {
    loadUpdates(function (updatesData) {
      originalCallback(mergePhotoUpdates(data || { features: [] }, updatesData));
    });
  };
})();