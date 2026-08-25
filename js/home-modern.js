(function () {
  'use strict';

  function driveThumbnail(url) {
    var value = String(url || '').trim();
    var match = value.match(/\/d\/([^/]+)/) || value.match(/[?&]id=([^&]+)/);
    return match
      ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(match[1]) + '&sz=w1600'
      : value;
  }

  function setPhotoFallbacks(image, urls) {
    var candidates = (urls || []).map(driveThumbnail).filter(Boolean);
    var index = 0;
    if (!image || !candidates.length) return;
    image.onerror = function () {
      index += 1;
      if (index < candidates.length) image.src = candidates[index];
    };
    image.src = candidates[0];
  }

  function configureEvidenceCards() {
    var gallery = document.querySelector('.home-evidence-gallery');
    if (!gallery) return;

    var cards = gallery.querySelectorAll('a');

    if (cards[1]) {
      var nurseryImage = cards[1].querySelector('img');
      var nurseryTitle = cards[1].querySelector('b');
      var nurseryMeta = cards[1].querySelector('small');

      cards[1].href = 'webgis.html?search=Sepahat&layer=nursery_mangrove';
      if (nurseryImage) {
        nurseryImage.setAttribute('data-home-photo', 'HOME-NURSERY-SEPAHAT');
        nurseryImage.alt = 'Dokumentasi rumah bibit Sepahat';
        setPhotoFallbacks(nurseryImage, [
          'https://drive.google.com/file/d/12M-0UoJ3zVkyd8JJZgefXx1uQpGcCgp9/view?usp=drivesdk',
          'https://drive.google.com/file/d/1FUZWggOHfixJy7tNlzJakOrOgOspBPlK/view?usp=drivesdk',
          'https://drive.google.com/file/d/1w-Eq1tnS_ONKspmyHbrJWIPIE_hINoex/view?usp=drivesdk'
        ]);
      }
      if (nurseryTitle) nurseryTitle.textContent = 'Rumah bibit Sepahat';
      if (nurseryMeta) nurseryMeta.textContent = 'Sepahat';
      cards[1].classList.add('has-photo');
    }

    if (cards[2]) {
      var canalImage = cards[2].querySelector('img');
      var canalTitle = cards[2].querySelector('b');
      var canalMeta = cards[2].querySelector('small');

      cards[2].href = 'webgis.html?object=SEKAT-TEMIANG-2022-001';
      if (canalImage) {
        canalImage.setAttribute('data-home-photo', 'SEKAT-TEMIANG-2022-001');
        canalImage.alt = 'Dokumentasi sekat kanal Temiang';
      }
      if (canalTitle) canalTitle.textContent = 'Sekat kanal di Temiang';
      if (canalMeta) canalMeta.textContent = 'Temiang';
    }
  }

  function applyEvidencePhotos(index) {
    document.querySelectorAll('[data-home-photo]').forEach(function (image) {
      var photos = index[image.getAttribute('data-home-photo')] || [];
      if (!photos.length) return;
      image.src = driveThumbnail(photos[0]);
      image.closest('a').classList.add('has-photo');
    });
  }

  configureEvidenceCards();

  fetch('data/program-photo-index.json?v=20260825-home-evidence1', { cache: 'force-cache' })
    .then(function (response) {
      if (!response.ok) throw new Error('photo-index');
      return response.json();
    })
    .then(applyEvidencePhotos)
    .catch(function () {
      document.querySelectorAll('.home-evidence-gallery a').forEach(function (item) {
        if (!item.classList.contains('has-photo')) item.classList.add('photo-unavailable');
      });
    });
})();