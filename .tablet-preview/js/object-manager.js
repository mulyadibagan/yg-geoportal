(function () {
  'use strict';

  var schema = window.YG_OBJECT_SCHEMA || {};
  var api = schema.api;
  var data = null;
  var original = null;
  var layer = null;
  var selected = -1;
  var reports = [];
  var dirty = false;

  var layerSelect = document.getElementById('layer-select');
  var objectList = document.getElementById('object-list');
  var form = document.getElementById('edit-form');
  var syncStatus = document.getElementById('sync-status');

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function parseJson(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (error) {
      return {};
    }
  }

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function slug(value) {
    return normalizeText(value)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  function setSyncStatus(message, state) {
    syncStatus.textContent = message || '';
    syncStatus.className = 'sync-status ' + (state || '');
  }

  function loadReports() {
    return new Promise(function (resolve) {
      var callback = 'ygObjMgr' + Date.now();
      window[callback] = function (result) {
        reports = result && result.features || [];
        delete window[callback];
        resolve();
      };

      var script = document.createElement('script');
      script.src = api + '?page=public-reports&callback=' + callback + '&t=' + Date.now();
      script.onerror = resolve;
      document.head.appendChild(script);
    });
  }

  function loadLayer() {
    layer = (schema.layers || []).find(function (item) {
      return item.id === layerSelect.value;
    });

    if (!layer) return;

    setSyncStatus('Memuat ' + layer.label + '…', 'loading');

    fetch(layer.url + '?v=' + Date.now())
      .then(function (response) {
        if (!response.ok) throw new Error('GeoJSON tidak dapat dimuat.');
        return response.json();
      })
      .then(function (result) {
        data = result;
        original = clone(result);
        selected = -1;
        dirty = false;
        form.hidden = true;
        document.getElementById('empty').hidden = false;
        renderList();
        setSyncStatus('Data siap diedit.', 'ok');
      })
      .catch(function (error) {
        setSyncStatus(error.message, 'error');
      });
  }

  function displayName(properties, index) {
    return properties.Nama_Objek ||
      properties.Nama ||
      properties.Desa ||
      properties.NAMA_DESA ||
      layer.label + ' ' + (index + 1);
  }

  function duplicateIds() {
    var counts = {};
    (data && data.features || []).forEach(function (feature) {
      var id = normalizeText(feature.properties && feature.properties.Object_ID);
      if (!id) return;
      counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  }

  function validateFeature(index) {
    var feature = data.features[index];
    var properties = feature.properties || {};
    var errors = [];
    var warnings = [];
    var id = normalizeText(properties.Object_ID);
    var duplicates = duplicateIds();

    if (!id) errors.push('Object_ID belum diisi.');
    if (id && duplicates[id] > 1) errors.push('Object_ID digunakan lebih dari satu objek.');
    if (!normalizeText(properties.Nama_Objek)) errors.push('Nama_Objek belum diisi.');
    if (!normalizeText(properties.Kategori)) warnings.push('Kategori belum diisi.');
    if (!normalizeText(properties.Status_Objek)) warnings.push('Status objek belum diisi.');
    if (!feature.geometry || !feature.geometry.type) errors.push('Geometri objek tidak valid.');

    return { errors: errors, warnings: warnings };
  }

  function renderValidation(index) {
    var box = document.getElementById('validation-box');
    var result = validateFeature(index);
    var html = '';

    if (!result.errors.length && !result.warnings.length) {
      html = '<p class="validation-good">✓ Atribut utama objek sudah lengkap.</p>';
    } else {
      result.errors.forEach(function (message) {
        html += '<p class="validation-error">✕ ' + escapeHtml(message) + '</p>';
      });
      result.warnings.forEach(function (message) {
        html += '<p class="validation-warn">! ' + escapeHtml(message) + '</p>';
      });
    }

    box.innerHTML = html;
  }

  function renderList() {
    var query = document.getElementById('search').value.toLowerCase();
    var features = data && data.features || [];
    var html = '';
    var invalid = 0;

    features.forEach(function (feature, index) {
      var properties = feature.properties || {};
      var validation = validateFeature(index);
      if (validation.errors.length) invalid += 1;

      var text = (
        displayName(properties, index) + ' ' +
        (properties.Object_ID || '') + ' ' +
        (properties.Desa || '')
      ).toLowerCase();

      if (query && text.indexOf(query) < 0) return;

      html +=
        '<button class="object-item ' + (index === selected ? 'active' : '') + '" data-index="' + index + '">' +
          '<strong>' + escapeHtml(displayName(properties, index)) + '</strong>' +
          '<span>' + escapeHtml(properties.Object_ID || 'Tanpa Object_ID') + ' · ' + escapeHtml(properties.Desa || properties.NAMA_DESA || '') + '</span>' +
          (validation.errors.length ? '<em>Perlu diperbaiki</em>' : '') +
        '</button>';
    });

    objectList.innerHTML = html || '<p style="padding:14px">Tidak ada objek.</p>';
    document.getElementById('summary').textContent =
      features.length + ' objek · ' + layer.label +
      (invalid ? ' · ' + invalid + ' perlu diperbaiki' : '');
  }

  function matchingReports(properties) {
    return reports.filter(function (feature) {
      var report = feature.properties || {};
      if (String(report.reportType).toLowerCase() !== 'monitoring') return false;

      if (report.targetObjectId && report.targetObjectId === properties.Object_ID) {
        return true;
      }

      var target = parseJson(report.targetFeatureProperties);
      return report.targetLayerId === layer.id &&
        String(target.Desa || '').toLowerCase() === String(properties.Desa || '').toLowerCase() &&
        (!target.Luas_Ha || Math.abs(Number(target.Luas_Ha) - Number(properties.Luas_Ha || 0)) < 0.00001);
    });
  }

  function suggestObjectId(properties, index) {
    var prefix = layer.prefix || layer.id || 'OBJECT';
    var village = slug(properties.Desa || properties.Nama_Objek || 'LOKASI');
    var year = slug(properties.Tahun || 'NA');
    return [prefix, village, year, String(index + 1).padStart(3, '0')].join('-');
  }

  function openObject(index) {
    selected = index;
    var properties = data.features[index].properties || {};

    if (!properties.Object_ID || String(properties.Object_ID) === '0') {
      properties.Object_ID = suggestObjectId(properties, index);
      dirty = true;
    }
    if (!properties.Nama_Objek) {
      properties.Nama_Objek = displayName(properties, index);
      dirty = true;
    }
    if (!properties.Kategori) {
      properties.Kategori = layer.category || '';
      dirty = true;
    }
    if (!properties.Status_Objek) {
      properties.Status_Objek = 'Aktif';
      dirty = true;
    }
    properties.Source_Layer = layer.id;

    document.getElementById('empty').hidden = true;
    form.hidden = false;
    document.getElementById('edit-title').textContent = displayName(properties, index);

    [
      'Object_ID', 'Nama_Objek', 'Kategori', 'Status_Objek',
      'Kabupaten', 'Kecamatan', 'Desa', 'Tahun', 'Luas_Ha',
      'Jumlah_Tanam', 'Panjang_M', 'Program', 'Ket'
    ].forEach(function (key) {
      if (form.elements[key]) {
        form.elements[key].value = properties[key] == null ? '' : properties[key];
      }
    });

    document.getElementById('all-props').textContent = JSON.stringify(properties, null, 2);

    var matches = matchingReports(properties);
    document.getElementById('match-info').innerHTML = matches.length
      ? '<p class="match-good"><b>' + matches.length + ' monitoring cocok</b> dengan objek ini.</p>' +
        matches.slice(0, 5).map(function (item) {
          return '<small>' + escapeHtml(item.properties.reportId) + ' · ' + escapeHtml(item.properties.activityDate || '') + '</small><br>';
        }).join('')
      : '<p class="match-warn"><b>Belum ada monitoring yang cocok.</b> Periksa Object_ID, layer, desa, dan luas.</p>';

    renderValidation(index);
    renderList();
  }

  function applyFormToObject() {
    if (selected < 0) return false;

    var properties = data.features[selected].properties;

    [
      'Object_ID', 'Nama_Objek', 'Kategori', 'Status_Objek',
      'Kabupaten', 'Kecamatan', 'Desa', 'Tahun', 'Program', 'Ket'
    ].forEach(function (key) {
      properties[key] = form.elements[key].value.trim();
    });

    ['Luas_Ha', 'Jumlah_Tanam', 'Panjang_M'].forEach(function (key) {
      var value = form.elements[key].value;
      properties[key] = value === '' ? null : Number(value);
    });

    properties.Source_Layer = layer.id;
    properties.Last_Updated = new Date().toISOString();
    dirty = true;
    openObject(selected);
    return true;
  }

  function validateLayerBeforeSave() {
    var errors = [];
    var ids = {};

    (data && data.features || []).forEach(function (feature, index) {
      var result = validateFeature(index);
      result.errors.forEach(function (message) {
        errors.push('Objek ' + (index + 1) + ': ' + message);
      });

      var id = normalizeText(feature.properties && feature.properties.Object_ID);
      if (id) ids[id] = (ids[id] || 0) + 1;
    });

    Object.keys(ids).forEach(function (id) {
      if (ids[id] > 1) errors.push('Object_ID duplikat: ' + id);
    });

    return errors;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    applyFormToObject();
    setSyncStatus('Perubahan diterapkan lokal. Klik “Simpan ke GitHub”.', 'loading');
  });

  document.getElementById('reset-object').addEventListener('click', function () {
    if (selected < 0) return;
    data.features[selected] = clone(original.features[selected]);
    dirty = JSON.stringify(data) !== JSON.stringify(original);
    openObject(selected);
    setSyncStatus('Perubahan objek dibatalkan.', 'ok');
  });

  document.getElementById('download').addEventListener('click', function () {
    if (!data) return;
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' });
    var anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = layer.id + '.geojson';
    anchor.click();
    window.setTimeout(function () {
      URL.revokeObjectURL(anchor.href);
    }, 1000);
  });

  document.getElementById('save-github').addEventListener('click', function () {
    if (!data || !layer) return;
    if (!form.hidden) applyFormToObject();

    var token = document.getElementById('admin-token').value.trim();
    var message = document.getElementById('commit-message').value.trim();
    var errors = validateLayerBeforeSave();

    if (!token) {
      setSyncStatus('Token admin wajib diisi.', 'error');
      return;
    }
    if (!message) {
      setSyncStatus('Alasan perubahan wajib diisi.', 'error');
      return;
    }
    if (errors.length) {
      setSyncStatus(errors.slice(0, 3).join(' | '), 'error');
      return;
    }
    if (!dirty) {
      setSyncStatus('Tidak ada perubahan yang perlu disimpan.', 'error');
      return;
    }

    document.getElementById('sync-token-field').value = token;
    document.getElementById('sync-path-field').value = layer.url.replace(/^\.?\//, '');
    document.getElementById('sync-content-field').value = JSON.stringify(data, null, 2);
    document.getElementById('sync-message-field').value = message;

    setSyncStatus('Mengirim perubahan ke GitHub…', 'loading');
    document.getElementById('github-sync-form').action = api;
    document.getElementById('github-sync-form').submit();
  });

  window.addEventListener('message', function (event) {
    var result = event.data || {};
    if (result.source !== 'YG_GITHUB_SYNC') return;

    if (result.ok) {
      original = clone(data);
      dirty = false;
      setSyncStatus(
        'Berhasil disimpan ke GitHub. Commit: ' + (result.commitSha || '').slice(0, 7),
        'ok'
      );
    } else {
      setSyncStatus(result.message || 'Gagal menyimpan ke GitHub.', 'error');
    }
  });

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-index]');
    if (button) openObject(Number(button.dataset.index));
  });

  document.getElementById('search').addEventListener('input', renderList);

  layerSelect.innerHTML = (schema.layers || [])
    .filter(function (item) { return item.include !== false; })
    .map(function (item) {
      return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.label) + '</option>';
    })
    .join('');

  layerSelect.addEventListener('change', function () {
    if (dirty && !window.confirm('Perubahan layer saat ini belum disimpan. Tetap pindah layer?')) {
      layerSelect.value = layer.id;
      return;
    }
    loadLayer();
  });

  window.addEventListener('beforeunload', function (event) {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  loadReports().then(loadLayer);
})();
