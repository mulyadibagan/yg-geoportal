(function () {
  'use strict';

  var gallery = [];
  var activeIndex = 0;
  var observerTimer = null;

  function extractDriveId(url) {
    var value = String(url || '').trim();
    var patterns = [
      /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/i,
      /drive\.google\.com\/open\?id=([A-Za-z0-9_-]+)/i,
      /drive\.google\.com\/uc\?(?:[^#]*&)?id=([A-Za-z0-9_-]+)/i,
      /drive\.google\.com\/thumbnail\?(?:[^#]*&)?id=([A-Za-z0-9_-]+)/i,
      /[?&]id=([A-Za-z0-9_-]+)/i
    ];

    for (var i = 0; i < patterns.length; i += 1) {
      var match = value.match(patterns[i]);
      if (match && match[1]) return match[1];
    }

    return '';
  }

  function buildPhotoUrls(url) {
    var original = String(url || '').trim();
    var driveId = extractDriveId(original);

    if (driveId) {
      return {
        thumbnail:
          'https://drive.google.com/thumbnail?id=' +
          encodeURIComponent(driveId) +
          '&sz=w1200',
        highres:
          'https://drive.google.com/thumbnail?id=' +
          encodeURIComponent(driveId) +
          '&sz=w2400',
        original:
          'https://drive.google.com/file/d/' +
          encodeURIComponent(driveId) +
          '/view'
      };
    }

    return {
      thumbnail: original,
      highres: original,
      original: original
    };
  }

  function ensureLightbox() {
    var lightbox = document.getElementById('yg-monitor-photo-lightbox');

    if (lightbox) return lightbox;

    lightbox = document.createElement('div');
    lightbox.id = 'yg-monitor-photo-lightbox';
    lightbox.className = 'yg-monitor-photo-lightbox';
    lightbox.setAttribute('aria-hidden', 'true');

    lightbox.innerHTML =
      '<div class="yg-monitor-photo-backdrop" data-photo-close></div>' +
      '<section class="yg-monitor-photo-dialog" role="dialog" aria-modal="true" aria-label="Dokumentasi monitoring">' +
        '<button class="yg-monitor-photo-close" type="button" data-photo-close aria-label="Tutup foto">×</button>' +
        '<button class="yg-monitor-photo-nav yg-monitor-photo-prev" type="button" data-photo-prev aria-label="Foto sebelumnya">‹</button>' +
        '<div class="yg-monitor-photo-stage">' +
          '<div class="yg-monitor-photo-loading">Memuat foto…</div>' +
          '<img src="" alt="Dokumentasi monitoring resolusi tinggi">' +
        '</div>' +
        '<button class="yg-monitor-photo-nav yg-monitor-photo-next" type="button" data-photo-next aria-label="Foto berikutnya">›</button>' +
        '<footer class="yg-monitor-photo-footer">' +
          '<span class="yg-monitor-photo-counter"></span>' +
          '<a class="yg-monitor-photo-open" href="#" target="_blank" rel="noopener noreferrer">Buka foto asli ↗</a>' +
        '</footer>' +
      '</section>';

    document.body.appendChild(lightbox);
    return lightbox;
  }

  function collectGallery() {
    gallery = Array.prototype.map.call(
      document.querySelectorAll('.yg-monitor-photo-button img'),
      function (image) {
        return {
          highres: image.getAttribute('data-highres') || image.src,
          original: image.getAttribute('data-original') || image.src,
          alt: image.alt || 'Dokumentasi monitoring'
        };
      }
    );
  }

  function renderLightbox() {
    if (!gallery.length) return;

    var lightbox = ensureLightbox();
    var item = gallery[activeIndex];
    var image = lightbox.querySelector('.yg-monitor-photo-stage img');
    var loading = lightbox.querySelector('.yg-monitor-photo-loading');
    var counter = lightbox.querySelector('.yg-monitor-photo-counter');
    var openLink = lightbox.querySelector('.yg-monitor-photo-open');
    var prev = lightbox.querySelector('[data-photo-prev]');
    var next = lightbox.querySelector('[data-photo-next]');

    image.style.display = 'none';
    loading.style.display = 'block';
    loading.textContent = 'Memuat foto…';

    image.onload = function () {
      loading.style.display = 'none';
      image.style.display = 'block';
    };

    image.onerror = function () {
      loading.textContent =
        'Foto tidak dapat dimuat di halaman. Klik “Buka foto asli”.';
    };

    image.alt = item.alt;
    image.src = item.highres;
    openLink.href = item.original;
    counter.textContent =
      'Foto ' + (activeIndex + 1) + ' dari ' + gallery.length;

    prev.hidden = gallery.length < 2;
    next.hidden = gallery.length < 2;
  }

  function openLightbox(index) {
    collectGallery();

    if (!gallery.length) return;

    activeIndex = Math.max(
      0,
      Math.min(Number(index) || 0, gallery.length - 1)
    );

    var lightbox = ensureLightbox();
    renderLightbox();
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('yg-monitor-photo-opened');
  }

  function closeLightbox() {
    var lightbox = document.getElementById(
      'yg-monitor-photo-lightbox'
    );

    if (!lightbox) return;

    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('yg-monitor-photo-opened');

    window.setTimeout(function () {
      var image = lightbox.querySelector(
        '.yg-monitor-photo-stage img'
      );
      if (!lightbox.classList.contains('open')) {
        image.src = '';
      }
    }, 180);
  }

  function movePhoto(step) {
    if (!gallery.length) return;

    activeIndex =
      (activeIndex + step + gallery.length) % gallery.length;

    renderLightbox();
  }

  function enhancePhotoGrid(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var images = scope.querySelectorAll('.photo-grid img');

    Array.prototype.forEach.call(images, function (image) {
      if (image.getAttribute('data-photo-ready') === 'true') {
        return;
      }

      var oldLink = image.closest('a');
      var originalUrl =
        (oldLink && oldLink.getAttribute('href')) ||
        image.getAttribute('src') ||
        '';

      if (!originalUrl) return;

      var urls = buildPhotoUrls(originalUrl);
      var button = document.createElement('button');

      button.type = 'button';
      button.className = 'yg-monitor-photo-button';
      button.setAttribute(
        'aria-label',
        'Perbesar ' + (image.alt || 'foto monitoring')
      );

      image.setAttribute('data-photo-ready', 'true');
      image.setAttribute('data-highres', urls.highres);
      image.setAttribute('data-original', urls.original);
      image.setAttribute('loading', 'lazy');
      image.setAttribute('decoding', 'async');
      image.src = urls.thumbnail;

      image.onerror = function () {
        this.classList.add('yg-monitor-photo-error');
        this.alt = 'Foto tidak dapat dimuat';
      };

      if (oldLink) {
        oldLink.parentNode.replaceChild(button, oldLink);
      } else {
        image.parentNode.insertBefore(button, image);
      }

      button.appendChild(image);

      var badge = document.createElement('span');
      badge.className = 'yg-monitor-photo-badge';
      badge.textContent = 'Perbesar';
      button.appendChild(badge);
    });

    document
      .querySelectorAll('.yg-monitor-photo-button')
      .forEach(function (button, index) {
        button.setAttribute('data-photo-index', String(index));
      });
  }

  function scheduleEnhance(root) {
    window.clearTimeout(observerTimer);
    observerTimer = window.setTimeout(function () {
      enhancePhotoGrid(root || document);
    }, 30);
  }

  document.addEventListener('click', function (event) {
    var photoButton = event.target.closest(
      '.yg-monitor-photo-button'
    );

    if (photoButton) {
      event.preventDefault();
      openLightbox(
        photoButton.getAttribute('data-photo-index')
      );
      return;
    }

    if (event.target.closest('[data-photo-close]')) {
      closeLightbox();
      return;
    }

    if (event.target.closest('[data-photo-prev]')) {
      movePhoto(-1);
      return;
    }

    if (event.target.closest('[data-photo-next]')) {
      movePhoto(1);
    }
  });

  document.addEventListener('keydown', function (event) {
    var lightbox = document.getElementById(
      'yg-monitor-photo-lightbox'
    );

    if (!lightbox || !lightbox.classList.contains('open')) {
      return;
    }

    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') movePhoto(-1);
    if (event.key === 'ArrowRight') movePhoto(1);
  });

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i += 1) {
      if (mutations[i].addedNodes.length) {
        scheduleEnhance(document);
        break;
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      enhancePhotoGrid(document);
    });
  } else {
    enhancePhotoGrid(document);
  }
})();
