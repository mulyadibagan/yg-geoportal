(function () {
  'use strict';

  var callbackName = 'ygMonitoringDashboardCallback';
  var originalCallback = window[callbackName];
  var updatesEndpoint = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=public-updates';

  function cleanUrl(value) {
    if (value == null) return '';
    if (typeof value === 'object') {
      value = value.url || value.webViewLink || value.downloadUrl || value.src || value.link || value.fileUrl || '';
    }
    value = String(value).trim();
    return value && /^https?:\/\//i.test(value) ? value : '';
  }

  function normalizePhotos(value) {
    var parsed = value;
    if (typeof parsed === 'string') {
      var text = parsed.trim();
      if (!text) return [];
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        parsed = text.match(/https?:\/\/[^\s,;|]+/gi) || text.split(/[\n,;|]+/);
      }
    }
    if (!Array.isArray(parsed)) parsed = [parsed];
    return parsed.map(cleanUrl).filter(function (url, index, list) {
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
      properties.images,
      properties.photoLinks,
      properties.tautanFoto
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
    try { return JSON.parse(value); } catch (error) { return {}; }
  }

  function getObjectId(properties) {
    properties = properties || {};
    var changes = parseObject(properties.proposedChanges);
    var information = parseObject(properties.proposedInformation);
    return String(
      properties.targetObjectId || changes.targetObjectId || information.targetObjectId || ''
    ).trim();
  }

  function fallbackKey(properties) {
    properties = properties || {};
    var changes = parseObject(properties.proposedChanges);
    var layer = properties.targetLayerId || changes.targetLayerId || '';
    var title = properties.targetObjectName || properties.locationName || changes.targetObjectName || properties.title || '';
    return String(layer).trim().toLowerCase() + '|' + String(title).trim().toLowerCase();
  }

  function reportType(properties) {
    return String((properties || {}).reportType || '').trim().toLowerCase();
  }

  function mergeAllPhotoSources(mainData, extraData) {
    mainData = mainData || { features: [] };
    var allMain = Array.isArray(mainData.features) ? mainData.features : [];
    var extra = extraData && Array.isArray(extraData.features) ? extraData.features : [];
    var monitoringFeatures = [];
    var photoFeatures = [];
    var byId = {};
    var byFallback = {};

    allMain.forEach(function (feature) {
      var properties = feature && feature.properties;
      if (!properties) return;
      var type = reportType(properties);
      if (type === 'monitoring') monitoringFeatures.push(feature);
      else if (/foto/.test(type)) photoFeatures.push(feature);
    });

    extra.forEach(function (feature) {
      var properties = feature && feature.properties;
      if (properties && findPhotos(properties).length) photoFeatures.push(feature);
    });

    monitoringFeatures.forEach(function (feature) {
      var properties = feature.properties;
      properties.photos = findPhotos(properties);
      var objectId = getObjectId(properties);
      var key = fallbackKey(properties);
      if (objectId) byId[objectId] = properties;
      if (key !== '|') byFallback[key] = properties;
    });

    photoFeatures.forEach(function (feature) {
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

    mainData.features = monitoringFeatures;
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

    window[jsonpCallback] = finish;
    script.async = true;
    script.src = updatesEndpoint + '&callback=' + encodeURIComponent(jsonpCallback) + '&t=' + Date.now();
    script.onerror = function () { finish({ features: [] }); };
    timer = window.setTimeout(function () { finish({ features: [] }); }, 5000);
    document.head.appendChild(script);
  }

  if (typeof originalCallback !== 'function') return;

  window[callbackName] = function (data) {
    var immediate = mergeAllPhotoSources(data || { features: [] }, { features: [] });
    loadUpdates(function (updatesData) {
      originalCallback(mergeAllPhotoSources(immediate, updatesData));
    });
  };
})();
