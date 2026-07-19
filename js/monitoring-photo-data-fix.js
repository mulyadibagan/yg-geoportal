(function () {
  'use strict';

  var callbackName = 'ygMonitoringDashboardCallback';
  var originalCallback = window[callbackName];

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
        parsed = text.split(/[\n,;|]+/);
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
    var candidates = [
      properties.photos,
      properties.photoUrls,
      properties.photoUrl,
      properties.documentationPhotos,
      properties.documentationPhotoUrls,
      properties.dokumentasiFoto,
      properties.foto
    ];

    for (var i = 0; i < candidates.length; i += 1) {
      var photos = normalizePhotos(candidates[i]);
      if (photos.length) return photos;
    }

    return [];
  }

  if (typeof originalCallback !== 'function') return;

  window[callbackName] = function (data) {
    var features = data && Array.isArray(data.features) ? data.features : [];

    features.forEach(function (feature) {
      var properties = feature && feature.properties;
      if (!properties) return;
      properties.photos = findPhotos(properties);
    });

    return originalCallback(data);
  };
})();
