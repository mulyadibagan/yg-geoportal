(function () {
  'use strict';

  var gallerySequence = 0;
  var activeGallery = null;
  var activeIndex = 0;

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function escapeHtml(value) {
    return clean(value).replace(/[&<>"']/g, function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  function readItems(source) {
    var seen = {};
    return Array.prototype.map.call(
      source.querySelectorAll('.yg-photo-card'),
      function (card, index) {
        var image = card.querySelector('img');
        var full = clean(card.getAttribute('href'));
        var thumb = clean(image && image.getAttribute('src')) || full;
        var key = full || thumb;
        if (!key || seen[key]) return null;
        seen[key] = true;
        return {
          full: full || thumb,
          thumb: thumb,
          alt: clean(image && image.getAttribute('alt')) || ('Foto ' + (index + 1))
        };
      }
    ).filter(Boolean);
  }

  function galleryMarkup(id, items) {
    var thumbs = items.map(function (item, index) {
      return (
        '<button class="yg-popup-gallery-v2__thumb' + (index === 0 ? ' is-active' : '') + '"' +
          ' type="button" data-gallery-index="' + index + '"' +
          ' aria-label="Tampilkan ' + escapeHtml(item.alt) + '">' +
          '<img src="' + escapeHtml(item.thumb) + '" alt="" loading="lazy">' +
        '</button>'
      );
    }).join('');

    return (
      '<section class="yg-popup-gallery-v2" data-gallery-id="' + id + '" aria-label="Galeri foto">' +
        '<button class="yg-popup-gallery-v2__stage" type="button" data-gallery-open aria-label="Perbesar foto">' +
          '<img src="' + escapeHtml(items[0].thumb) + '" alt="' + escapeHtml(items[0].alt) + '">' +
          '<span class="yg-popup-gallery-v2__count">1 / ' + items.length + '</span>' +
          '<span class="yg-popup-gallery-v2__empty" hidden>Foto tidak dapat dimuat. Tekan untuk membuka sumber asli.</span>' +
        '</button>' +
        (items.length > 1 ? '<div class="yg-popup-gallery-v2__thumbs">' + thumbs + '</div>' : '') +
      '</section>'
    );
  }

  function activate(gallery, index) {
    var items = gallery._ygGalleryItems || [];
    if (!items.length) return;
    index = Math.max(0, Math.min(Number(index) || 0, items.length - 1));
    gallery._ygGalleryIndex = index;

    var item = items[index];
    var stageImage = gallery.querySelector('.yg-popup-gallery-v2__stage img');
    var empty = gallery.querySelector('.yg-popup-gallery-v2__empty');
    var count = gallery.querySelector('.yg-popup-gallery-v2__count');

    if (empty) empty.hidden = true;
    if (stageImage) {
      stageImage.hidden = false;
      stageImage.alt = item.alt;
      stageImage.onerror = function () {
        this.hidden = true;
        if (empty) empty.hidden = false;
      };
      stageImage.src = item.thumb;
    }
    if (count) count.textContent = (index + 1) + ' / ' + items.length;
    gallery.querySelectorAll('.yg-popup-gallery-v2__thumb').forEach(function (thumb, thumbIndex) {
      thumb.classList.toggle('is-active', thumbIndex === index);
      thumb.setAttribute('aria-current', thumbIndex === index ? 'true' : 'false');
    });
  }

  function enhance(source) {
    if (!source || source.getAttribute('data-gallery-v2-ready') === 'true') return;
    var items = readItems(source);
    if (!items.length) return;

    gallerySequence += 1;
    var wrapper = document.createElement('div');
    wrapper.innerHTML = galleryMarkup('yg-gallery-' + gallerySequence, items);
    var gallery = wrapper.firstElementChild;
    gallery._ygGalleryItems = items;
    gallery._ygGalleryIndex = 0;
    source.setAttribute('data-gallery-v2-ready', 'true');
    source.replaceWith(gallery);
  }

  function enhanceAll(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches('.yg-v3-gallery')) enhance(scope);
    scope.querySelectorAll('.yg-v3-gallery').forEach(enhance);
  }

  function ensureLightbox() {
    var lightbox = document.getElementById('yg-gallery-lightbox');
    if (lightbox) return lightbox;
    lightbox = document.createElement('div');
    lightbox.id = 'yg-gallery-lightbox';
    lightbox.className = 'yg-gallery-lightbox';
    lightbox.setAttribute('aria-hidden', 'true');
    lightbox.innerHTML =
      '<button class="yg-gallery-lightbox__close" type="button" data-lightbox-close aria-label="Tutup">×</button>' +
      '<button class="yg-gallery-lightbox__nav yg-gallery-lightbox__prev" type="button" data-lightbox-prev aria-label="Foto sebelumnya">‹</button>' +
      '<img class="yg-gallery-lightbox__image" alt="Foto dokumentasi">' +
      '<button class="yg-gallery-lightbox__nav yg-gallery-lightbox__next" type="button" data-lightbox-next aria-label="Foto berikutnya">›</button>' +
      '<span class="yg-gallery-lightbox__counter"></span>';
    document.body.appendChild(lightbox);
    return lightbox;
  }

  function renderLightbox() {
    if (!activeGallery) return;
    var items = activeGallery._ygGalleryItems || [];
    if (!items.length) return;
    activeIndex = (activeIndex + items.length) % items.length;
    var item = items[activeIndex];
    var lightbox = ensureLightbox();
    lightbox.querySelector('.yg-gallery-lightbox__image').src = item.full;
    lightbox.querySelector('.yg-gallery-lightbox__image').alt = item.alt;
    lightbox.querySelector('.yg-gallery-lightbox__counter').textContent =
      (activeIndex + 1) + ' / ' + items.length;
    lightbox.querySelector('[data-lightbox-prev]').hidden = items.length < 2;
    lightbox.querySelector('[data-lightbox-next]').hidden = items.length < 2;
  }

  function openLightbox(gallery) {
    activeGallery = gallery;
    activeIndex = gallery._ygGalleryIndex || 0;
    var lightbox = ensureLightbox();
    renderLightbox();
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('yg-gallery-lightbox-open');
  }

  function closeLightbox() {
    var lightbox = document.getElementById('yg-gallery-lightbox');
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('yg-gallery-lightbox-open');
    activeGallery = null;
  }

  document.addEventListener('click', function (event) {
    var thumb = event.target.closest('.yg-popup-gallery-v2__thumb');
    if (thumb) {
      activate(thumb.closest('.yg-popup-gallery-v2'), thumb.getAttribute('data-gallery-index'));
      return;
    }
    var stage = event.target.closest('[data-gallery-open]');
    if (stage) {
      openLightbox(stage.closest('.yg-popup-gallery-v2'));
      return;
    }
    if (event.target.closest('[data-lightbox-close]')) closeLightbox();
    if (event.target.closest('[data-lightbox-prev]')) {
      activeIndex -= 1;
      renderLightbox();
    }
    if (event.target.closest('[data-lightbox-next]')) {
      activeIndex += 1;
      renderLightbox();
    }
  });

  document.addEventListener('keydown', function (event) {
    var lightbox = document.getElementById('yg-gallery-lightbox');
    if (!lightbox || !lightbox.classList.contains('is-open')) return;
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') {
      activeIndex -= 1;
      renderLightbox();
    }
    if (event.key === 'ArrowRight') {
      activeIndex += 1;
      renderLightbox();
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    enhanceAll(document);
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) enhanceAll(node);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  });

  document.addEventListener('popupopen', function () {
    window.setTimeout(function () { enhanceAll(document); }, 0);
  });

  window.YGPopupGalleryV2 = { enhance: enhanceAll };
})();
