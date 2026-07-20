(function () {
  'use strict';

  var REPORTS_CALLBACK = 'ygMonitoringDashboardCallback';
  var UPDATES_CALLBACK = 'ygMonitoringPhotoUpdatesCallback';
  var UPDATES_API = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=public-updates';
  var originalCallback = window[REPORTS_CALLBACK];
  var pendingReports = null;
  var updatesReady = false;
  var updatesByObject = {};
  var fallbackTimer = null;

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function uniqueUrls(values) {
    var seen = {};
    return (values || []).filter(function (value) {
      var url = clean(value);
      if (!url || seen[url]) return false;
      seen[url] = true;
      return true;
    });
  }

  function collectUpdates(data) {
    var updates = data && Array.isArray(data.updates) ? data.updates : [];

    updates.forEach(function (update) {
      if (clean(update.reportType).toLowerCase() !== 'tambah foto kegiatan') return;

      var proposed = update.proposedChanges && typeof update.proposedChanges === 'object'
        ? update.proposedChanges
        : {};
      var objectId = clean(proposed.targetObjectId || update.targetObjectId);
      var photos = Array.isArray(update.photos) ? update.photos : [];

      if (!objectId || !photos.length) return;
      updatesByObject[objectId] = uniqueUrls((updatesByObject[objectId] || []).concat(photos));
    });
  }

  function mergePhotos(data) {
    var features = data && Array.isArray(data.features) ? data.features : [];

    features.forEach(function (feature) {
      var props = feature && feature.properties ? feature.properties : {};
      var objectId = clean(props.targetObjectId);
      var extraPhotos = objectId ? updatesByObject[objectId] || [] : [];
      var ownPhotos = Array.isArray(props.photos) ? props.photos : [];

      if (extraPhotos.length) {
        props.photos = uniqueUrls(ownPhotos.concat(extraPhotos));
      }
    });

    return data;
  }

  function deliver() {
    if (!pendingReports || typeof originalCallback !== 'function') return;
    window.clearTimeout(fallbackTimer);
    var data = mergePhotos(pendingReports);
    pendingReports = null;
    originalCallback(data);
  }

  if (typeof originalCallback !== 'function') return;

  window[REPORTS_CALLBACK] = function (data) {
    pendingReports = data;

    if (updatesReady) {
      deliver();
      return;
    }

    fallbackTimer = window.setTimeout(function () {
      updatesReady = true;
      deliver();
    }, 2500);
  };

  window[UPDATES_CALLBACK] = function (data) {
    collectUpdates(data);
    updatesReady = true;
    deliver();
  };

  var script = document.createElement('script');
  script.src = UPDATES_API + '&callback=' + UPDATES_CALLBACK + '&t=' + Date.now();
  script.async = true;
  script.onerror = function () {
    updatesReady = true;
    deliver();
  };
  document.head.appendChild(script);
})();
