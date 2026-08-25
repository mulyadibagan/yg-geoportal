(function () {
  'use strict';

  function driveThumbnail(url) {
    var value = String(url || '').trim();
    var match = value.match(/\/d\/([^/]+)/) || value.match(/[?&]id=([^&]+)/);
    return match
      ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(match[1]) + '&sz=w1600'
      : value;
  }

  function applyEvidencePhotos(index) {
    document.querySelectorAll('[data-home-photo]').forEach(function (image) {
      var photos = index[image.getAttribute('data-home-photo')] || [];
      if (!photos.length) return;
      image.src = driveThumbnail(photos[0]);
      image.closest('a').classList.add('has-photo');
    });
  }

  fetch('data/program-photo-index.json?v=20260825-home-evidence1', { cache: 'force-cache' })
    .then(function (response) {
      if (!response.ok) throw new Error('photo-index');
      return response.json();
    })
    .then(applyEvidencePhotos)
    .catch(function () {
      document.querySelectorAll('.home-evidence-gallery a').forEach(function (item) {
        item.classList.add('photo-unavailable');
      });
    });
})();
