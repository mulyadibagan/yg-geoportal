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

  function setText(selector, idText, enText, english) {
    var element = document.querySelector(selector);
    if (element) element.textContent = english ? enText : idText;
  }

  function applyHomepageLanguage(language) {
    var english = language === 'en';

    setText('.brand > span > span', 'WebGIS Yayasan Gambut', 'Yayasan Gambut WebGIS', english);
    setText('a[href="staff-login.html"]', 'Login Staf', 'Staff Login', english);
    setText('a[href="fire-weather.html"]', 'Karhutla & Cuaca', 'Wildfire & Weather', english);

    var socialForestry = document.querySelector('a[href="social-forestry-directory.html"]');
    if (socialForestry) {
      var sfSmall = socialForestry.querySelector('small');
      Array.from(socialForestry.childNodes).forEach(function (node) {
        if (node.nodeType === 3 && node.nodeValue.trim()) {
          node.nodeValue = english ? 'Social Forestry Directory' : 'Direktori Perhutanan Sosial';
        }
      });
      if (sfSmall) sfSmall.textContent = english ? 'Spatial profiles and non-spatial documents' : 'Profil spasial dan dokumen nonspasial';
    }

    var monitoring = document.querySelector('a[href="monitoring.html"] small');
    if (monitoring) monitoring.textContent = english ? 'Object and site monitoring results' : 'Hasil pemantauan objek dan lokasi';
    var engagement = document.querySelector('a[href="community-engagement.html"] small');
    if (engagement) engagement.textContent = english ? 'Group participation in field activities' : 'Partisipasi kelompok dalam kegiatan lapangan';
    var capacity = document.querySelector('a[href="capacity-building.html"]');
    if (capacity) {
      var capacitySmall = capacity.querySelector('small');
      Array.from(capacity.childNodes).forEach(function (node) {
        if (node.nodeType === 3 && node.nodeValue.trim()) {
          node.nodeValue = english ? 'Capacity Building' : 'Peningkatan Kapasitas';
        }
      });
      if (capacitySmall) capacitySmall.textContent = english ? 'Training and learning evaluation' : 'Pelatihan dan evaluasi pembelajaran';
    }

    setText('[data-editable-id="hero-title"]', 'Memetakan aksi. Merekam perubahan.', 'Mapping action. Tracking change.', english);
    setText('[data-editable-id="hero-tagline"]', 'Menghubungkan lokasi, capaian, foto evidence, dan laporan program dalam satu platform.', 'Connecting locations, results, evidence photos, and programme reports in one platform.', english);
    setText('.home-secondary-action', 'Lihat Dampak Program', 'View Programme Impact', english);

    var evidenceCards = document.querySelectorAll('.home-evidence-gallery a');
    if (evidenceCards[0]) {
      var coastTitle = evidenceCards[0].querySelector('b');
      var coastMeta = evidenceCards[0].querySelector('small');
      if (coastTitle) coastTitle.textContent = english ? 'Coastal Protection' : 'Perlindungan pesisir';
      if (coastMeta) coastMeta.textContent = english ? 'Kelapa Pati · view evidence →' : 'Kelapa Pati · buka evidence →';
    }
    if (evidenceCards[1]) {
      var nurseryTitle = evidenceCards[1].querySelector('b');
      var nurseryMeta = evidenceCards[1].querySelector('small');
      var nurseryImage = evidenceCards[1].querySelector('img');
      if (nurseryTitle) nurseryTitle.textContent = english ? 'Sepahat Community Nursery' : 'Rumah bibit Sepahat';
      if (nurseryMeta) nurseryMeta.textContent = 'Sepahat';
      if (nurseryImage) nurseryImage.alt = english ? 'Sepahat community nursery documentation' : 'Dokumentasi rumah bibit Sepahat';
    }
    if (evidenceCards[2]) {
      var canalTitle = evidenceCards[2].querySelector('b');
      var canalMeta = evidenceCards[2].querySelector('small');
      var canalImage = evidenceCards[2].querySelector('img');
      if (canalTitle) canalTitle.textContent = english ? 'Canal Block in Temiang' : 'Sekat kanal di Temiang';
      if (canalMeta) canalMeta.textContent = 'Temiang';
      if (canalImage) canalImage.alt = english ? 'Temiang canal block documentation' : 'Dokumentasi sekat kanal Temiang';
    }

    setText('#dash-participants-detail', 'pelatihan + kegiatan lapangan', 'training + field activities', english);

    document.querySelectorAll('.funding-card').forEach(function (card) {
      var period = card.querySelector('strong');
      var small = card.querySelector('small');
      if (period && period.textContent.trim() === '2021 - Sekarang') {
        period.textContent = english ? '2021 - Present' : '2021 - Sekarang';
      }
      if (small) {
        var value = small.textContent.trim();
        if (english) {
          value = value
            .replace(/^4 desa · lihat ringkasan program$/, '4 villages · view programme summary')
            .replace(/^Bengkalis & Siak · lihat ringkasan program$/, 'Bengkalis & Siak · view programme summary')
            .replace(/^Imbo Putui · lihat ringkasan program$/, 'Imbo Putui · view programme summary')
            .replace(/^Pematang Duku · lihat ringkasan program$/, 'Pematang Duku · view programme summary')
            .replace(/^Desa Temiang · lihat ringkasan program$/, 'Temiang Village · view programme summary');
        } else {
          value = value
            .replace(/^4 villages · view programme summary$/, '4 desa · lihat ringkasan program')
            .replace(/^Bengkalis & Siak · view programme summary$/, 'Bengkalis & Siak · lihat ringkasan program')
            .replace(/^Imbo Putui · view programme summary$/, 'Imbo Putui · lihat ringkasan program')
            .replace(/^Pematang Duku · view programme summary$/, 'Pematang Duku · lihat ringkasan program')
            .replace(/^Temiang Village · view programme summary$/, 'Desa Temiang · lihat ringkasan program');
        }
        small.textContent = value;
      }
    });
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

  window.addEventListener('yg:languagechange', function (event) {
    applyHomepageLanguage(event && event.detail ? event.detail.language : 'id');
  });

  document.addEventListener('DOMContentLoaded', function () {
    var language = window.YG_I18N && window.YG_I18N.language ? window.YG_I18N.language : 'id';
    applyHomepageLanguage(language);
  });

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