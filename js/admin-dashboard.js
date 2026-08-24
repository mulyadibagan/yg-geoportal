(function () {
  'use strict';

  var API = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var DONOR_DATA_API = 'https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev/api/donor/programmes';
  var DONOR_ADMIN_RESULT_API = 'https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev/api/donor/admin-result';
  var PS_INBOX_KEY = 'ygIpemsPsInbox_v1';
  var ASSIGNMENT_KEY = 'ygIpemsEvidenceAssignments_v1';
  var NONSPATIAL_EVIDENCE_KEY = 'ygIpemsNonspatialEvidence_v1';
  var PROGRAMME_CONFIG_KEY = 'ygIpemsProgrammeConfig_v1';
  var DONOR_DATA = [];
  var EVIDENCE_DATA = [];
  var PROGRAMME_CONFIG = [];
  var ASSIGNMENT_DATA = [];
  var NONSPATIAL_EVIDENCE_DATA = [];
  var PS_PROFILE_INDEX = [];
  var PS_REVIEW_PENDING = null;
  var ADMIN_SESSION = null;
  var REMOTE_AVAILABLE = false;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
    });
  }

  function idFrom(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function normalizedText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function normalizedPsName(value) {
    return normalizedText(value).replace(/^kt\s+/, 'kth ');
  }

  function socialForestryProfileKey(feature) {
    var props = feature && feature.properties || {};
    var value = props.NO_IUPHKM || props.SK || props.OBJECTID || props.ID ||
      [props.NAMA_HKM, props.NAMA_DESA, props.NAMA_KAB].filter(Boolean).join('|');
    if (typeof value === 'number' && Number.isInteger(value)) value = value.toFixed(1);
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function buildSocialForestryProfileIndex(geojson) {
    PS_PROFILE_INDEX = ((geojson && geojson.features) || []).map(function (feature) {
      var props = feature.properties || {};
      return {
        name: normalizedPsName(props.NAMA_HKM),
        regency: normalizedText(props.NAMA_KAB),
        displayName: props.NAMA_HKM || 'Profil Perhutanan Sosial',
        village: props.NAMA_DESA || '',
        district: props.NAMA_KEC || '',
        displayRegency: props.NAMA_KAB || '',
        key: socialForestryProfileKey(feature)
      };
    }).filter(function (row) { return row.name && row.key; });
  }

  function socialForestryProfileMatch(psName, regency) {
    var name = normalizedPsName(psName), area = normalizedText(regency).replace(/^\d+\s+/, '');
    function findUnique(candidates) {
      var exact = candidates.filter(function (row) { return row.name === name; });
      if (exact.length === 1) return exact[0];
      var prefixed = candidates.filter(function (row) {
        return name.indexOf(row.name + ' ') === 0 || row.name.indexOf(name + ' ') === 0;
      }).sort(function (a, b) { return b.name.length - a.name.length; });
      return prefixed.length && (prefixed.length === 1 || prefixed[0].name.length > prefixed[1].name.length) ? prefixed[0] : null;
    }
    var areaCandidates = PS_PROFILE_INDEX.filter(function (row) {
      return !area || row.regency === area;
    });
    var match = findUnique(areaCandidates);
    if (!match && area) {
      match = findUnique(PS_PROFILE_INDEX);
      if (match) match = Object.assign({}, match, { regencyMismatch: true, inboxRegency: regency });
    }
    return match;
  }

  function socialForestryProfileUrl(psName, regency) {
    var match = socialForestryProfileMatch(psName, regency);
    return match ? 'social-forestry-profile.html?key=' + encodeURIComponent(match.key) : '';
  }

  function socialForestryDocumentCategory(value) {
    var category = String(value || '').toLowerCase();
    if (/sk|legal/.test(category)) return 'Legalitas';
    if (/peta|spasial/.test(category)) return 'Peta & Data Spasial';
    if (/kups/.test(category)) return 'KUPS';
    if (/rkps|rkt|rencana/.test(category)) return 'Rencana kerja';
    if (/profil/.test(category)) return 'Profil kelompok';
    return String(value || 'Dokumen pendukung').replace(/^\d+[_\s-]*/, '').replace(/_/g, ' ');
  }

  function openPsReviewPreview(button) {
    var profile = socialForestryProfileMatch(button.dataset.psName, button.dataset.psRegency);
    var feedback = document.getElementById('ps-inbox-feedback');
    if (!profile) {
      feedback.textContent = 'Profil PS tujuan belum dapat dicocokkan. Dokumen belum disetujui.';
      return;
    }
    var profileUrl = 'social-forestry-profile.html?key=' + encodeURIComponent(profile.key);
    PS_REVIEW_PENDING = {
      fileId: button.dataset.fileId,
      fileName: button.dataset.fileName,
      driveUrl: button.dataset.driveUrl,
      category: socialForestryDocumentCategory(button.dataset.psCategory),
      profile: profile,
      profileUrl: profileUrl
    };
    document.getElementById('ps-review-file').textContent = PS_REVIEW_PENDING.fileName || 'Dokumen PS';
    document.getElementById('ps-review-drive').href = PS_REVIEW_PENDING.driveUrl || '#';
    document.getElementById('ps-review-profile').textContent = profile.displayName;
    document.getElementById('ps-review-location').textContent = [profile.village, profile.district, profile.displayRegency].filter(Boolean).join(' · ');
    document.getElementById('ps-review-profile-link').href = profileUrl;
    document.getElementById('ps-review-category').textContent = 'Kategori: ' + PS_REVIEW_PENDING.category;
    var message = document.getElementById('ps-review-message');
    message.className = profile.regencyMismatch ? 'ps-review-message is-error' : 'ps-review-message';
    message.textContent = profile.regencyMismatch
      ? 'Peringatan: folder Inbox tercatat di ' + button.dataset.psRegency + ', tetapi profil resmi berada di ' + profile.displayRegency + '. Periksa profil dan dokumen sebelum menyetujui.'
      : 'Pastikan dokumen dan profil tujuan sudah benar sebelum menyetujui.';
    document.getElementById('ps-review-confirm').disabled = false;
    document.getElementById('ps-review-dialog').showModal();
  }

  function isActive(programme) {
    return /^(aktif|berjalan|direncanakan)$/i.test(String(programme.status || '').trim());
  }

  function activePhases(programme) {
    return (programme.phases || []).filter(isActive);
  }

  function isAssignable(programme) {
    return isActive(programme) && (!(programme.phases || []).length || activePhases(programme).length > 0);
  }

  function activeProgrammes(donor) {
    return (donor.programs || []).filter(isAssignable);
  }

  function taggableProgrammes(donor) {
    return (donor.programs || []).filter(function (programme) {
      return (programme.outputs || []).length || isAssignable(programme);
    });
  }

  function applyProgrammeConfig(rows) {
    (rows || []).forEach(function (entry) {
      var donor = DONOR_DATA.find(function (item) {
        return String(item.id || idFrom(item.name)) === entry.donorId;
      });
      if (!donor) return;
      donor.programs = donor.programs || [];
      var index = donor.programs.findIndex(function (programme) {
        return String(programme.id || '') === String(entry.recordId || '');
      });
      if (index > -1) donor.programs[index] = Object.assign({}, donor.programs[index], entry.record);
      else donor.programs.push(entry.record);
    });
  }

  function programmeDisplayName(programme) {
    var title = programme.name || (programme.referenceLabel ? programme.referenceLabel + ' · Judul belum diisi' : 'Judul belum diisi');
    return [programme.phase, title].filter(Boolean).join(' · ');
  }

  function assignments() {
    return ASSIGNMENT_DATA;
  }

  function saveAssignments(rows) {
    ASSIGNMENT_DATA = rows || [];
    if (!REMOTE_AVAILABLE) localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(ASSIGNMENT_DATA));
  }

  function localRows(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch (error) { return []; }
  }

  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      var callback = 'ygIpemsAdmin_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      var script = document.createElement('script');
      window[callback] = function (data) {
        delete window[callback];
        script.remove();
        resolve(data);
      };
      script.onerror = function () {
        delete window[callback];
        script.remove();
        reject(new Error('Evidence API tidak dapat dimuat.'));
      };
      script.src = url + (url.indexOf('?') > -1 ? '&' : '?') +
        'callback=' + encodeURIComponent(callback) + '&t=' + Date.now();
      document.head.appendChild(script);
    });
  }

  function requireStaffSession() {
    ADMIN_SESSION = window.YG_AUTH && window.YG_AUTH.readStoredSession();
    if (!ADMIN_SESSION || !ADMIN_SESSION.token) {
      throw new Error('Silakan masuk sebagai staf sebelum menyimpan perubahan.');
    }
    return ADMIN_SESSION;
  }

  async function postAdmin(action, payload) {
    var session = requireStaffSession();
    var requestId = 'yg-donor-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
    var body = new URLSearchParams({
      action: action,
      requestId: requestId,
      sessionToken: session.token,
      payload: JSON.stringify(payload || {})
    });
    await fetch(API, { method: 'POST', mode: 'no-cors', body: body });
    for (var attempt = 0; attempt < 24; attempt += 1) {
      await new Promise(function (resolve) { setTimeout(resolve, attempt ? 650 : 350); });
      var response = await fetch(DONOR_ADMIN_RESULT_API + '?requestId=' + encodeURIComponent(requestId) + '&t=' + Date.now(), {
        cache: 'no-store',
        headers: { accept: 'application/json', authorization: 'Bearer ' + session.token }
      });
      if (!response.ok) throw new Error('Konfirmasi penyimpanan gagal dimuat.');
      var result = await response.json();
      if (result && result.pending) continue;
      if (result && result.ok) return result.data;
      throw new Error((result && result.error) || 'Penyimpanan ke database pusat gagal.');
    }
    throw new Error('Penyimpanan belum mendapat konfirmasi dari server.');
  }

  function renderAuthState(message) {
    ADMIN_SESSION = window.YG_AUTH && window.YG_AUTH.readStoredSession();
    var status = document.getElementById('admin-auth-status');
    var form = document.getElementById('admin-auth-form');
    if (!REMOTE_AVAILABLE) {
      status.textContent = 'Backend pusat belum aktif; perubahan sementara tetap disimpan pada browser ini.';
      form.querySelectorAll('label, button, a').forEach(function (element) { element.hidden = true; });
      document.getElementById('assignment-mode').textContent = 'LOCAL FALLBACK';
    } else if (ADMIN_SESSION && ADMIN_SESSION.token) {
      status.textContent = message || ('Masuk sebagai ' + ADMIN_SESSION.username + '. Perubahan akan disimpan ke database pusat.');
      form.querySelectorAll('label, button, a').forEach(function (element) { element.hidden = true; });
    } else {
      status.textContent = message || 'Silakan masuk agar perubahan tersimpan ke database pusat.';
      form.querySelectorAll('label, button, a').forEach(function (element) { element.hidden = false; });
    }
  }

  function evidenceLabel(feature) {
    var props = feature.properties || {};
    var title = props.title || props.locationName || props.targetObjectName || 'Evidence tanpa judul';
    var village = props.village || props.locationName || '';
    var date = props.activityDate || props.receivedAt || props.submittedAt || '';
    if (date && /^\d{4}-\d{2}-\d{2}/.test(String(date))) date = String(date).slice(0, 10);
    return [title, village, date].filter(Boolean).join(' · ');
  }

  function evidenceGroup(feature) {
    var props = feature.properties || {};
    var type = String(props.reportType || props.geometryType || 'Evidence lainnya').trim();
    var aliases = {
      'Capacity Building': 'Peningkatan Kapasitas',
      'Monitoring': 'Monitoring Lapangan',
      'Titik Baru': 'Titik dan Infrastruktur Baru',
      'Area/Poligon Baru': 'Area/Poligon Baru'
    };
    return aliases[type] || type;
  }

  function evidenceTimestamp(feature) {
    var props = feature.properties || {};
    var value = props.activityDate || props.receivedAt || props.submittedAt || '';
    var time = Date.parse(value);
    return isNaN(time) ? 0 : time;
  }

  function evidenceId(feature, index) {
    return String((feature.properties || {}).reportId || feature.id || ('EV-LOCAL-' + index));
  }

  function loadDonorAdminData() {
    var session = window.YG_AUTH && window.YG_AUTH.readStoredSession();
    var headers = { accept: 'application/json' };
    if (session && session.token) headers.authorization = 'Bearer ' + session.token;
    return fetch(DONOR_DATA_API + '?t=' + Date.now(), {
      cache: 'no-store',
      headers: headers
    }).then(function (response) {
      if (!response.ok) throw new Error('Data program donor tidak dapat dimuat.');
      return response.json();
    });
  }

  function compactIndicatorLabel(outputName, activityName) {
    var outputCode = String(outputName || '').match(/^Output\s+[\w.-]+/i);
    var label = [outputCode ? outputCode[0] : '', activityName || outputName || 'Indikator'].filter(Boolean).join(' · ');
    return label.length > 105 ? label.slice(0, 102).trim() + '…' : label;
  }

  function isDonorEvidenceCandidate(feature) {
    var props = feature.properties || {};
    var source = String(props.source || '');
    var reportId = String(props.reportId || feature.id || '');
    // Inventaris layer dan baseline statis bukan antrean evidence donor.
    // Evidence yang diajukan lewat API atau diunggah staf tetap tersedia.
    var evidenceType = String(props.evidenceType || props.reportType || '').toLowerCase();
    var psOnly = props.dataDomain === 'social_forestry_profile' || props.psProfileDocument === true ||
      /sk\s*&?\s*legalitas|profil\s*ps|rkps|rkt|data\s*spasial\s*ps|kelengkapan\s*ps/.test(evidenceType);
    return !psOnly && !/^LAYER-/i.test(reportId) &&
      source !== 'data/capacity-building.json' &&
      !/\.geojson(?:$|\?)/i.test(source);
  }

  function renderPsInbox(rows) {
    var container = document.getElementById('ps-inbox-list');
    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) {
      container.innerHTML = '<div class="assignment-empty">Belum ada dokumen PS baru yang menunggu review.</div>';
      return;
    }
    container.innerHTML = rows.map(function (row) {
      var pending = row.status === 'Baru' || row.status === 'Perlu Review';
      var approved = row.status === 'Disetujui';
      var approveButton = pending || approved
        ? '<button class="btn btn-outline" data-ps-review="approve" data-file-id="' + esc(row.fileId) + '" data-file-name="' + esc(row.fileName) + '" data-drive-url="' + esc(row.url) + '" data-ps-category="' + esc(row.category) + '" data-ps-name="' + esc(row.psName) + '" data-ps-regency="' + esc(row.regency) + '">' + (approved ? 'Sinkronkan ke profil' : 'Setujui dokumen') + '</button>' : '';
      var revisionButton = pending ? '<button class="btn btn-light" data-ps-review="revision" data-file-id="' + esc(row.fileId) + '" data-ps-name="' + esc(row.psName) + '" data-ps-regency="' + esc(row.regency) + '">Perlu perbaikan</button>' : '';
      var actions = approveButton || revisionButton ? '<div class="ps-inbox-actions">' + approveButton + revisionButton + '</div>' : '';
      return '<article class="assignment-record ps-inbox-record"><div><strong>' + esc(row.fileName) + '</strong><small>' +
        esc([row.regency, row.psName, row.category].filter(Boolean).join(' · ')) + '</small></div><div><span>' + esc(row.status || 'Baru') +
        '</span><small>' + esc(row.createdAtLabel || '') + '</small></div><a href="' + esc(row.url) + '" target="_blank" rel="noopener">Buka Drive ↗</a>' + actions + '</article>';
    }).join('');
  }

  async function loadPsInbox() {
    var feedback = document.getElementById('ps-inbox-feedback');
    try {
      var session = requireStaffSession();
      var data = await jsonp(API + '?page=ps-inbox&sessionToken=' + encodeURIComponent(session.token));
      renderPsInbox(data && data.records);
      feedback.textContent = data && data.scannedAtLabel ? 'Drive diperiksa ' + data.scannedAtLabel + '.' : '';
    } catch (error) {
      renderPsInbox(localRows(PS_INBOX_KEY));
      feedback.textContent = error.message;
    }
  }

  function capacityEvidenceFeature(row) {
    var location = String(row.location || '').trim();
    var village = location.split(',')[0].trim();
    return {
      type: 'Feature',
      id: row.id,
      properties: {
        reportId: row.id,
        reportType: 'Capacity Building',
        title: row.name || 'Kegiatan peningkatan kapasitas',
        locationName: location,
        village: village,
        regency: row.regency || '',
        activityDate: row.date || '',
        status: 'Published baseline',
        targetGroup: row.target || '',
        partner: row.partner || '',
        topic: row.topic || '',
        male: Number(row.male || 0),
        female: Number(row.female || 0),
        source: 'data/capacity-building.json'
      }
    };
  }

  function firstProperty(properties, keys) {
    var value = '';
    (keys || []).some(function (key) {
      if (properties[key] == null || String(properties[key]).trim() === '') return false;
      value = String(properties[key]).trim();
      return true;
    });
    return value;
  }

  function layerEvidenceFeature(feature, layer, index) {
    var properties = Object.assign({}, feature.properties || {});
    var objectName = firstProperty(properties, [
      'Nama_Objek', 'nama_objek', 'name', 'Name', 'nama', 'Nama',
      'lokasi', 'Lokasi', 'desa', 'Desa', 'village', 'Village'
    ]) || (layer.label + ' #' + (index + 1));
    var village = firstProperty(properties, [
      'Desa', 'desa', 'village', 'Village', 'NAMOBJ', 'WADMKD'
    ]);
    var objectId = firstProperty(properties, [
      'Object_ID', 'objectId', 'id', 'ID', 'fid', 'FID'
    ]) || String(index + 1);
    properties.reportId = 'LAYER-' + layer.id + '-' + objectId;
    properties.reportType = 'Layer WebGIS · ' + layer.label;
    properties.title = objectName;
    properties.locationName = village || objectName;
    properties.village = village;
    properties.status = 'Objek layer aktif';
    properties.targetLayerId = layer.id;
    properties.targetLayerLabel = layer.label;
    properties.source = 'data/' + layer.id + '.geojson';
    return {
      type: 'Feature',
      id: properties.reportId,
      geometry: feature.geometry || null,
      properties: properties
    };
  }

  function loadLayerEvidence() {
    var layers = (window.YG_LAYER_CONFIG || []).filter(function (layer) {
      return layer.visible !== false && layer.verifiable !== false;
    });
    return Promise.all(layers.map(function (layer) {
      return fetch('data/' + layer.id + '.geojson?v=20260727-all-layers1', { cache: 'no-store' })
        .then(function (response) {
          if (!response.ok) return [];
          return response.json();
        })
        .then(function (collection) {
          return ((collection && collection.features) || []).map(function (feature, index) {
            return layerEvidenceFeature(feature, layer, index);
          });
        })
        .catch(function () { return []; });
    })).then(function (groups) {
      return groups.reduce(function (all, group) { return all.concat(group); }, []);
    });
  }

  function nonspatialEvidenceFeature(row) {
    return {
      type: 'Feature',
      id: row.id,
      properties: {
        reportId: row.id,
        reportType: 'Evidence Nonspasial',
        title: row.title,
        locationName: row.location || '',
        activityDate: row.date || '',
        description: row.description || '',
        documentUrl: row.url || '',
        evidenceType: row.type || 'Dokumen kegiatan',
        status: 'Terverifikasi admin',
        source: 'admin-dashboard'
      }
    };
  }

  function readEvidenceFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('File evidence gagal dibaca.')); };
      reader.readAsDataURL(file);
    });
  }

  function mergeEvidence(liveFeatures, capacityRows, layerFeatures, nonspatialRows) {
    var merged = [];
    var seen = {};
    (liveFeatures || [])
      .concat((capacityRows || []).map(capacityEvidenceFeature))
      .concat(layerFeatures || [])
      .concat((nonspatialRows || []).map(nonspatialEvidenceFeature))
      .forEach(function (feature, index) {
      var key = evidenceId(feature, index);
      if (seen[key]) return;
      seen[key] = true;
      merged.push(feature);
    });
    return merged;
  }

  function renderEvidenceOptions() {
    var select = document.getElementById('assignment-evidence');
    var used = {};
    assignments().forEach(function (row) { used[row.evidenceId] = true; });
    var available = EVIDENCE_DATA.filter(function (feature, index) {
      return isDonorEvidenceCandidate(feature) && !used[evidenceId(feature, index)];
    });
    var groups = {};
    available.forEach(function (feature) {
      var group = evidenceGroup(feature);
      if (!groups[group]) groups[group] = [];
      groups[group].push(feature);
    });
    var preferredOrder = ['Evidence Nonspasial', 'Peningkatan Kapasitas', 'Monitoring Lapangan', 'Titik dan Infrastruktur Baru', 'Area/Poligon Baru'];
    var groupNames = Object.keys(groups).sort(function (left, right) {
      var leftIndex = preferredOrder.indexOf(left);
      var rightIndex = preferredOrder.indexOf(right);
      if (leftIndex < 0) leftIndex = preferredOrder.length;
      if (rightIndex < 0) rightIndex = preferredOrder.length;
      return leftIndex - rightIndex || left.localeCompare(right, 'id');
    });
    select.innerHTML = '<option value="">Pilih evidence yang belum diverifikasi donor (' + available.length + ' tersedia)</option>' +
      groupNames.map(function (groupName) {
        var features = groups[groupName].slice().sort(function (left, right) {
          return evidenceTimestamp(right) - evidenceTimestamp(left) ||
            evidenceLabel(left).localeCompare(evidenceLabel(right), 'id');
        });
        return '<optgroup label="' + esc(groupName + ' (' + features.length + ')') + '">' +
          features.map(function (feature) {
            var originalIndex = EVIDENCE_DATA.indexOf(feature);
            return '<option value="' + esc(evidenceId(feature, originalIndex)) + '">' +
              esc(evidenceLabel(feature)) + '</option>';
          }).join('') + '</optgroup>';
      }).join('');
    if (!available.length) select.innerHTML += '<option disabled>Tidak ada evidence yang belum diverifikasi donor</option>';
  }

  function renderNonspatialEvidence() {
    var container = document.getElementById('nonspatial-evidence-list');
    if (!NONSPATIAL_EVIDENCE_DATA.length) {
      container.innerHTML = '<div class="assignment-empty">Belum ada evidence nonspasial.</div>';
      return;
    }
    var used = {};
    assignments().forEach(function (row) { used[row.evidenceId] = true; });
    container.innerHTML = NONSPATIAL_EVIDENCE_DATA.slice().reverse().map(function (row) {
      return '<article class="assignment-record nonspatial-evidence-record">' +
        '<div><strong>' + esc(row.title) + '</strong><small>' + esc(row.type + ' · ' + row.date) + '</small></div>' +
        '<div><span>' + esc(row.location || 'Tanpa lokasi') + '</span><small>' +
        '<a href="' + esc(row.url) + '" target="_blank" rel="noopener">Buka dokumen</a></small></div>' +
        '<div><span>' + (used[row.id] ? 'Sudah ditautkan' : 'Belum ditautkan') + '</span><small>' + esc(row.id) + '</small></div>' +
        '<button type="button" data-remove-nonspatial-evidence="' + esc(row.id) + '"' +
        (used[row.id] ? ' disabled title="Batalkan assignment sebelum menghapus evidence"' : '') + '>Hapus</button></article>';
    }).join('');
  }

  async function saveNonspatialEvidence(event) {
    event.preventDefault();
    var now = new Date();
    var fileInput = document.getElementById('nonspatial-evidence-file');
    var file = fileInput.files && fileInput.files[0];
    var feedback = document.getElementById('nonspatial-evidence-feedback');
    if (!file) {
      feedback.textContent = 'Pilih laporan atau dokumen yang akan diunggah.';
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      feedback.textContent = 'Ukuran file melebihi batas 20 MB.';
      return;
    }
    var supported = /\.(doc|docx|pdf|xls|xlsx|ppt|pptx|jpe?g|png|webp)$/i.test(file.name);
    if (!supported) {
      feedback.textContent = 'Format file belum didukung.';
      return;
    }
    feedback.textContent = 'Menyiapkan file evidence...';
    var dataUrl;
    try {
      dataUrl = await readEvidenceFile(file);
    } catch (error) {
      feedback.textContent = error.message;
      return;
    }
    var row = {
      id: 'EV-NS-' + now.getTime(),
      type: document.getElementById('nonspatial-evidence-type').value,
      title: document.getElementById('nonspatial-evidence-title-input').value.trim(),
      date: document.getElementById('nonspatial-evidence-date').value,
      location: document.getElementById('nonspatial-evidence-location').value.trim(),
      url: '',
      document: {
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: dataUrl
      },
      description: document.getElementById('nonspatial-evidence-description').value.trim(),
      verifiedAt: now.toISOString(),
      verifiedBy: ADMIN_SESSION && ADMIN_SESSION.username ? ADMIN_SESSION.username : 'admin'
    };
    feedback.textContent = REMOTE_AVAILABLE ? 'Mengunggah file dan menyimpan evidence...' : 'Menyimpan evidence sementara di browser...';
    try {
      if (REMOTE_AVAILABLE) NONSPATIAL_EVIDENCE_DATA = await postAdmin('donor-evidence-save', row);
      else {
        row.url = 'File lokal: ' + file.name;
        delete row.document;
        NONSPATIAL_EVIDENCE_DATA.push(row);
        localStorage.setItem(NONSPATIAL_EVIDENCE_KEY, JSON.stringify(NONSPATIAL_EVIDENCE_DATA));
      }
      var savedRow = NONSPATIAL_EVIDENCE_DATA.find(function (item) { return item.id === row.id; }) || row;
      EVIDENCE_DATA.push(nonspatialEvidenceFeature(savedRow));
      event.target.reset();
      renderNonspatialEvidence();
      renderEvidenceOptions();
      feedback.textContent = REMOTE_AVAILABLE
        ? 'Evidence nonspasial tersimpan dan siap ditautkan.'
        : 'Evidence tersimpan di browser dan siap ditautkan.';
    } catch (error) {
      feedback.textContent = error.message;
    }
  }

  function renderDonors() {
    var donorSelect = document.getElementById('assignment-donor');
    var taggableDonors = DONOR_DATA.filter(function (donor) { return taggableProgrammes(donor).length; });
    donorSelect.innerHTML = '<option value="">Pilih donor</option>' +
      taggableDonors.map(function (donor) {
        var hasActive = activeProgrammes(donor).length > 0;
        return '<option value="' + esc(donor.id || idFrom(donor.name)) + '">' +
          esc(donor.name + (hasActive ? ' · aktif' : ' · selesai / historis')) + '</option>';
      }).join('');

    document.getElementById('admin-donor-status-list').innerHTML = DONOR_DATA.map(function (donor) {
      var active = activeProgrammes(donor);
      var completed = (donor.programs || []).length - active.length;
      return '<article class="admin-donor-item"><header><strong>' + esc(donor.name) + '</strong>' +
        '<span class="' + (active.length ? 'is-active' : 'is-complete') + '">' +
        (active.length ? 'AKTIF' : 'SELESAI') + '</span></header>' +
        '<small>' + active.length + ' aktif · ' + completed + ' selesai</small></article>';
    }).join('');
    renderDonorCards();
  }

  function renderDonorCards() {
    var container = document.getElementById('admin-donor-card-grid');
    if (!container) return;
    var selectedId = document.getElementById('assignment-donor').value;
    if (!DONOR_DATA.length) {
      container.innerHTML = '<div class="assignment-empty">Belum ada donor yang tersedia.</div>';
      return;
    }
    container.innerHTML = DONOR_DATA.map(function (donor) {
      var donorId = String(donor.id || idFrom(donor.name));
      var active = activeProgrammes(donor);
      var total = (donor.programs || []).length;
      var locations = (donor.locations || []).slice(0, 3).join(' · ');
      return '<button type="button" class="admin-donor-card' + (donorId === selectedId ? ' is-selected' : '') +
        '" data-select-donor="' + esc(donorId) + '" aria-pressed="' + (donorId === selectedId ? 'true' : 'false') + '">' +
        '<span class="admin-donor-card-status ' + (active.length ? 'is-active' : 'is-complete') + '">' +
        (active.length ? 'AKTIF' : 'HISTORIS') + '</span>' +
        '<strong>' + esc(donor.name) + '</strong>' +
        '<span class="admin-donor-card-focus">' + esc(donor.focus || 'Program donor') + '</span>' +
        '<span class="admin-donor-card-meta"><b>' + active.length + '</b> aktif <b>' + total + '</b> program</span>' +
        (locations ? '<small>' + esc(locations) + '</small>' : '') +
        '<span class="admin-donor-card-action">Pilih donor →</span></button>';
    }).join('');
  }

  function selectedDonor() {
    var id = document.getElementById('assignment-donor').value;
    return DONOR_DATA.find(function (donor) {
      return String(donor.id || idFrom(donor.name)) === id;
    });
  }

  function renderProgrammes() {
    var donor = selectedDonor();
    var select = document.getElementById('assignment-programme');
    var indicator = document.getElementById('assignment-indicator');
    var programmes = donor ? taggableProgrammes(donor) : [];
    select.disabled = !programmes.length;
    var options = [];
    programmes.forEach(function (programme) {
      var programmeId = programme.id || ('PRG-' + idFrom(donor.name + '-' + programme.name));
      if ((programme.phases || []).length) {
        activePhases(programme).forEach(function (phase) {
          options.push({
            id: phase.id || ('PHS-' + idFrom(programmeId + '-' + phase.name)),
            label: programme.name + ' · ' + phase.name + ' (' + (phase.period || programme.period || '') + ')'
          });
        });
      } else {
        options.push({
          id: programmeId,
          label: programmeDisplayName(programme) + ' · ' + (programme.period || '') +
            ' · ' + (isActive(programme) ? 'Aktif' : 'Selesai / historis')
        });
      }
    });
    select.innerHTML = '<option value="">Pilih program/fase</option>' + options.map(function (item) {
      return '<option value="' + esc(item.id) + '">' + esc(item.label) + '</option>';
    }).join('');
    indicator.disabled = true;
    indicator.innerHTML = '<option value="">Pilih capaian</option>';
  }

  function renderIndicators() {
    var donor = selectedDonor();
    var programmeId = document.getElementById('assignment-programme').value;
    var select = document.getElementById('assignment-indicator');
    var programme = donor && programmeId ? programmeById(donor, programmeId) : null;
    var indicators = [];
    if (programme && (programme.outputs || []).length) {
      (programme.outputs || []).forEach(function (output) {
        (output.activities || []).forEach(function (activity) {
          indicators.push({
            id: activity.id,
            label: output.name + ' → ' + activity.name,
            optionLabel: compactIndicatorLabel(output.name, activity.name),
            value: activity.indicator
          });
        });
      });
    } else if (donor && programmeId) {
      indicators = donor.indicators || [];
    }
    select.disabled = !indicators.length;
    select.innerHTML = '<option value="">Pilih capaian/indikator</option>' + indicators.map(function (item, index) {
      var id = item.id || ((donor.id || idFrom(donor.name)) + '-KPI-' + (index + 1));
      return '<option value="' + esc(id) + '">' + esc(item.optionLabel || item.label) + '</option>';
    }).join('');
  }

  function programmeById(donor, programmeId) {
    var match = null;
    (donor.programs || []).some(function (programme) {
      var id = String(programme.id || ('PRG-' + idFrom(donor.name + '-' + programme.name)));
      if (id === programmeId && ((programme.outputs || []).length || isAssignable(programme))) {
        match = programme;
        return true;
      }
      return (programme.phases || []).some(function (phase) {
        var phaseId = String(phase.id || ('PHS-' + idFrom(id + '-' + phase.name)));
        if (phaseId !== programmeId || !isActive(phase)) return false;
        match = {
          id: phaseId,
          name: programme.name + ' / ' + phase.name,
          period: phase.period,
          status: phase.status,
          parentProgrammeId: id
        };
        return true;
      });
    });
    return match;
  }

  function indicatorById(donor, programme, indicatorId) {
    var activityMatch = null;
    ((programme && programme.outputs) || []).some(function (output) {
      return (output.activities || []).some(function (activity) {
        if (String(activity.id) !== indicatorId) return false;
        activityMatch = {
          id: activity.id,
          label: output.name + ' → ' + activity.name,
          value: activity.indicator
        };
        return true;
      });
    });
    if (activityMatch) return activityMatch;
    return (donor.indicators || []).find(function (item, index) {
      return String(item.id || ((donor.id || idFrom(donor.name)) + '-KPI-' + (index + 1))) === indicatorId;
    });
  }

  function renderHistory() {
    var rows = assignments();
    var container = document.getElementById('assignment-history');
    if (!rows.length) {
      container.innerHTML = '<div class="assignment-empty">Belum ada assignment pada database pusat.</div>';
      renderEvidenceOptions();
      renderNonspatialEvidence();
      return;
    }
    container.innerHTML = rows.slice().reverse().map(function (row) {
      return '<article class="assignment-record">' +
        '<div><strong>' + esc(row.evidenceTitle) + '</strong><small>' + esc(row.evidenceId) + '</small></div>' +
        '<div><span>' + esc(row.donorName) + '</span><small>' + esc(row.programmeName) + '</small></div>' +
        '<div><span>' + esc(row.indicatorLabel) + '</span><small>Diverifikasi ' + esc(row.verifiedAtLabel) + '</small></div>' +
        '<button type="button" data-remove-assignment="' + esc(row.assignmentId) + '">Batalkan</button>' +
      '</article>';
    }).join('');
    renderEvidenceOptions();
    renderNonspatialEvidence();
  }

  async function saveAssignment(event) {
    event.preventDefault();
    var evidenceIdValue = document.getElementById('assignment-evidence').value;
    var donor = selectedDonor();
    var programmeId = document.getElementById('assignment-programme').value;
    var indicatorId = document.getElementById('assignment-indicator').value;
    var programme = donor && programmeById(donor, programmeId);
    var indicator = donor && indicatorById(donor, programme, indicatorId);
    var evidence = EVIDENCE_DATA.find(function (feature, index) {
      return evidenceId(feature, index) === evidenceIdValue;
    });
    var feedback = document.getElementById('assignment-feedback');

    if (!evidence || !donor || !programme || !indicator) {
      feedback.textContent = 'Lengkapi pilihan evidence, donor, program/fase, dan capaian.';
      return;
    }

    var now = new Date();
    var rows = assignments();
    rows.push({
      assignmentId: 'ASN-LOCAL-' + now.getTime(),
      evidenceId: evidenceIdValue,
      evidenceTitle: evidenceLabel(evidence),
      evidenceUrl: (evidence.properties || {}).documentUrl || '',
      evidenceType: (evidence.properties || {}).reportType || '',
      donorId: donor.id || idFrom(donor.name),
      donorName: donor.name,
      programmeId: programmeId,
      programmeName: programmeDisplayName(programme),
      indicatorId: indicatorId,
      indicatorLabel: indicator.label,
      note: document.getElementById('assignment-note').value.trim(),
      verifiedAt: now.toISOString(),
      verifiedAtLabel: now.toLocaleString('id-ID')
    });
    feedback.textContent = REMOTE_AVAILABLE ? 'Menyimpan assignment ke database pusat...' : 'Menyimpan assignment sementara di browser...';
    try {
      if (REMOTE_AVAILABLE) saveAssignments(await postAdmin('donor-assignment-save', rows[rows.length - 1]));
      else saveAssignments(rows);
      event.target.reset();
      renderProgrammes();
      renderHistory();
      feedback.textContent = REMOTE_AVAILABLE
        ? 'Assignment berhasil disimpan ke database pusat.'
        : 'Assignment lokal berhasil disimpan; akan tetap tersedia pada browser ini.';
    } catch (error) {
      feedback.textContent = error.message;
    }
  }

  function renderProgrammeAdmin() {
    var donorSelect = document.getElementById('programme-admin-donor');
    var currentDonorId = donorSelect.value;
    donorSelect.innerHTML = '<option value="">Pilih donor</option>' + DONOR_DATA.map(function (donor) {
      var id = donor.id || idFrom(donor.name);
      return '<option value="' + esc(id) + '">' + esc(donor.name) + '</option>';
    }).join('');
    if (currentDonorId) donorSelect.value = currentDonorId;
    renderProgrammeRecords();

    document.getElementById('programme-register').innerHTML = DONOR_DATA.map(function (donor) {
      var activeCount = activeProgrammes(donor).length;
      var programmes = (donor.programs || []).map(function (programme) {
        var framework = (programme.outputs || []).length
          ? '<div class="programme-framework">' +
              '<p><b>Goal</b>' + esc(programme.goal || '—') + '</p>' +
              '<p><b>Outcome</b>' + esc(programme.outcome || '—') + '</p>' +
              '<div class="programme-output-list">' + programme.outputs.map(function (output) {
                return '<details><summary>' + esc(output.name) + '<small>' +
                  (output.activities || []).length + ' aktivitas</small></summary><ul>' +
                  (output.activities || []).map(function (activity) {
                    return '<li><span>' + esc(activity.name) + '</span><small>' +
                      esc(activity.indicator) + '</small></li>';
                  }).join('') + '</ul></details>';
              }).join('') + '</div></div>'
          : '';
        return '<article class="programme-register-card"><header><div><strong>' + esc(programmeDisplayName(programme)) +
          '</strong><small>' + esc([programme.duration, programme.period].filter(Boolean).join(' · ')) + '</small></div><b class="' +
          (isAssignable(programme) ? 'is-active' : 'is-complete') + '">' +
          esc(isAssignable(programme) ? 'Aktif' : programme.status || 'Selesai') + '</b></header>' +
          (programme.detailsPending ? '<small class="programme-needs-detail">Judul dan keterangan belum diisi</small>' : '') +
          framework + '</article>';
      }).join('');
      return '<section class="donor-register-group"><div class="donor-register-head"><h3>' + esc(donor.name) +
        '</h3><span class="' + (activeCount ? 'is-active' : 'is-complete') + '">' +
        (activeCount ? 'DONOR AKTIF' : 'TIDAK AKTIF') + '</span></div>' + programmes + '</section>';
    }).join('');
  }

  function renderProgrammeRecords() {
    var donorId = document.getElementById('programme-admin-donor').value;
    var donor = DONOR_DATA.find(function (item) {
      return String(item.id || idFrom(item.name)) === donorId;
    });
    var select = document.getElementById('programme-admin-record');
    select.innerHTML = '<option value="">Tambah program/project baru</option>' + ((donor && donor.programs) || []).map(function (programme) {
      var id = programme.id || ('PRG-' + idFrom(donor.name + '-' + programme.name));
      return '<option value="' + esc(id) + '">' + esc(programmeDisplayName(programme) + ' · ' + (programme.period || '')) + '</option>';
    }).join('');
  }

  function addLogframeRow(value) {
    value = value || {};
    var row = document.createElement('div');
    row.className = 'logframe-row';
    row.innerHTML =
      '<label>Outcome<textarea class="logframe-outcome" rows="2" placeholder="Outcome">' + esc(value.outcome || '') + '</textarea></label>' +
      '<label>Output<textarea class="logframe-output" rows="2" placeholder="Output">' + esc(value.output || '') + '</textarea></label>' +
      '<label>Activity<textarea class="logframe-activity" rows="2" placeholder="Activity">' + esc(value.activity || '') + '</textarea></label>' +
      '<label>Indicator<textarea class="logframe-indicator" rows="2" placeholder="Indicator">' + esc(value.indicator || '') + '</textarea></label>' +
      '<button class="remove-logframe-row" type="button" aria-label="Hapus baris logframe">×</button>';
    document.getElementById('logframe-rows').appendChild(row);
  }

  function populateLogframe(programme) {
    var container = document.getElementById('logframe-rows');
    container.innerHTML = '';
    if (programme && (programme.outputs || []).length) {
      programme.outputs.forEach(function (output) {
        (output.activities || []).forEach(function (activity) {
          addLogframeRow({
            outcome: output.outcome || programme.outcome || '',
            output: output.name || '',
            activity: activity.name || '',
            indicator: activity.indicator || ''
          });
        });
      });
    }
    if (!container.children.length) addLogframeRow();
  }

  function collectLogframe() {
    var groups = {};
    Array.from(document.querySelectorAll('.logframe-row')).forEach(function (row) {
      var outcome = row.querySelector('.logframe-outcome').value.trim();
      var output = row.querySelector('.logframe-output').value.trim();
      var activity = row.querySelector('.logframe-activity').value.trim();
      var indicator = row.querySelector('.logframe-indicator').value.trim();
      if (!outcome && !output && !activity && !indicator) return;
      var key = outcome + '\u001f' + output;
      if (!groups[key]) {
        groups[key] = {
          id: 'OUT-LOCAL-' + idFrom(output || key) + '-' + Object.keys(groups).length,
          name: output,
          outcome: outcome,
          activities: []
        };
      }
      groups[key].activities.push({
        id: 'ACT-LOCAL-' + idFrom(activity || indicator) + '-' + groups[key].activities.length,
        name: activity,
        indicator: indicator
      });
    });
    return Object.keys(groups).map(function (key) { return groups[key]; });
  }

  function loadProgrammeRecord() {
    var donorId = document.getElementById('programme-admin-donor').value;
    var recordId = document.getElementById('programme-admin-record').value;
    var donor = DONOR_DATA.find(function (item) { return String(item.id || idFrom(item.name)) === donorId; });
    var programme = donor && (donor.programs || []).find(function (item) { return String(item.id || '') === recordId; });
    document.getElementById('programme-admin-phase').value = programme ? (programme.phase || '') : '';
    document.getElementById('programme-admin-name').value = programme ? (programme.name || '') : '';
    document.getElementById('programme-admin-period').value = programme ? (programme.period || '') : '';
    document.getElementById('programme-admin-status').value = programme ? (programme.status || 'Aktif') : 'Aktif';
    document.getElementById('programme-admin-organization').value = programme ? (programme.implementingOrganization || '') : '';
    document.getElementById('programme-admin-locations').value = programme ? ((programme.locations || []).join(', ')) : '';
    document.getElementById('programme-admin-summary').value = programme ? (programme.summary || '') : '';
    document.getElementById('programme-admin-goal').value = programme ? (programme.goal || '') : '';
    populateLogframe(programme);
  }

  async function saveProgrammeConfig(event) {
    event.preventDefault();
    var donorId = document.getElementById('programme-admin-donor').value;
    var recordId = document.getElementById('programme-admin-record').value;
    var phase = document.getElementById('programme-admin-phase').value.trim();
    var name = document.getElementById('programme-admin-name').value.trim();
    var period = document.getElementById('programme-admin-period').value.trim();
    var status = document.getElementById('programme-admin-status').value;
    var organization = document.getElementById('programme-admin-organization').value.trim();
    var locations = document.getElementById('programme-admin-locations').value.split(',').map(function (item) { return item.trim(); }).filter(Boolean);
    var summary = document.getElementById('programme-admin-summary').value.trim();
    var goal = document.getElementById('programme-admin-goal').value.trim();
    var outputs = collectLogframe();
    var feedback = document.getElementById('programme-admin-feedback');
    if (!donorId || !name || !period) {
      feedback.textContent = 'Lengkapi donor, judul resmi, dan periode program/project.';
      return;
    }
    var savedId = recordId || ('PRG-LOCAL-' + Date.now());
    var entry = {
      donorId: donorId,
      recordId: savedId,
      record: {
        id: savedId,
        phase: phase,
        name: name,
        period: period,
        status: status,
        implementingOrganization: organization,
        locations: locations,
        goal: goal,
        outcome: outputs.length ? outputs[0].outcome : '',
        summary: summary,
        outputs: outputs,
        detailsPending: false
      }
    };
    feedback.textContent = REMOTE_AVAILABLE ? 'Menyimpan ke database pusat...' : 'Menyimpan sementara di browser...';
    try {
      if (REMOTE_AVAILABLE) {
        PROGRAMME_CONFIG = await postAdmin('donor-programme-save', entry);
      } else {
        PROGRAMME_CONFIG = PROGRAMME_CONFIG.filter(function (item) {
          return !(item.donorId === donorId && String(item.recordId) === String(savedId));
        });
        PROGRAMME_CONFIG.push(entry);
        localStorage.setItem(PROGRAMME_CONFIG_KEY, JSON.stringify(PROGRAMME_CONFIG));
      }
      var donor = DONOR_DATA.find(function (item) { return String(item.id || idFrom(item.name)) === donorId; });
      donor.programs = donor.programs || [];
      var existingIndex = donor.programs.findIndex(function (item) { return String(item.id || '') === String(savedId); });
      if (existingIndex > -1) donor.programs[existingIndex] = Object.assign({}, donor.programs[existingIndex], entry.record);
      else donor.programs.push(entry.record);
      event.target.reset();
      populateLogframe(null);
      renderDonors();
      renderProgrammeAdmin();
      renderProgrammes();
      feedback.textContent = REMOTE_AVAILABLE
        ? 'Program/project berhasil diperbarui di database pusat.'
        : 'Konfigurasi tersimpan sementara di browser; backend pusat belum aktif.';
    } catch (error) {
      feedback.textContent = error.message;
    }
  }

  function bind() {
    document.getElementById('refresh-ps-inbox').addEventListener('click', loadPsInbox);
    document.getElementById('ps-inbox-list').addEventListener('click', async function (event) {
      var button = event.target.closest('[data-ps-review]');
      if (!button) return;
      var feedback = document.getElementById('ps-inbox-feedback');
      if (button.dataset.psReview === 'approve') {
        openPsReviewPreview(button);
        return;
      }
      try {
        button.disabled = true;
        await postAdmin('ps-inbox-review', { fileId: button.dataset.fileId, decision: 'revision' });
        feedback.textContent = 'Dokumen ditandai perlu perbaikan.';
        await loadPsInbox();
      } catch (error) {
        button.disabled = false;
        feedback.textContent = error.message;
      }
    });
    document.getElementById('ps-review-confirm').addEventListener('click', async function () {
      if (!PS_REVIEW_PENDING) return;
      var pending = PS_REVIEW_PENDING;
      var confirmButton = this;
      var message = document.getElementById('ps-review-message');
      var feedback = document.getElementById('ps-inbox-feedback');
      var profileWindow = window.open('about:blank', '_blank');
      if (profileWindow) {
        profileWindow.opener = null;
        profileWindow.document.title = 'Memproses persetujuan…';
        profileWindow.document.body.textContent = 'Dokumen sedang disetujui. Profil PS akan segera dibuka…';
      }
      try {
        confirmButton.disabled = true;
        message.className = 'ps-review-message';
        message.textContent = 'Menyimpan persetujuan dan menyiapkan profil PS…';
        var result = await postAdmin('ps-inbox-review', { fileId: pending.fileId, decision: 'approve' });
        var publication = result && result.publication;
        if (publication && publication.document) {
          sessionStorage.setItem('ygPsApprovedDocument:' + pending.profile.key, JSON.stringify(publication.document));
        }
        feedback.textContent = 'Dokumen disetujui untuk ' + pending.profile.displayName + '.';
        document.getElementById('ps-review-dialog').close();
        if (profileWindow && !profileWindow.closed) profileWindow.location.replace(pending.profileUrl + '&approved=' + Date.now());
        else window.location.assign(pending.profileUrl + '&approved=' + Date.now());
        PS_REVIEW_PENDING = null;
        await loadPsInbox();
      } catch (error) {
        if (profileWindow && !profileWindow.closed) profileWindow.close();
        confirmButton.disabled = false;
        message.className = 'ps-review-message is-error';
        message.textContent = error.message;
      }
    });
    document.getElementById('ps-review-dialog').addEventListener('close', function () {
      if (this.returnValue === 'cancel') PS_REVIEW_PENDING = null;
    });
    document.getElementById('nonspatial-evidence-form').addEventListener('submit', saveNonspatialEvidence);
    document.getElementById('nonspatial-evidence-list').addEventListener('click', async function (event) {
      var button = event.target.closest('[data-remove-nonspatial-evidence]');
      if (!button || button.disabled) return;
      var evidenceIdValue = button.dataset.removeNonspatialEvidence;
      var feedback = document.getElementById('nonspatial-evidence-feedback');
      try {
        if (REMOTE_AVAILABLE) NONSPATIAL_EVIDENCE_DATA = await postAdmin('donor-evidence-delete', { evidenceId: evidenceIdValue });
        else {
          NONSPATIAL_EVIDENCE_DATA = NONSPATIAL_EVIDENCE_DATA.filter(function (row) { return row.id !== evidenceIdValue; });
          localStorage.setItem(NONSPATIAL_EVIDENCE_KEY, JSON.stringify(NONSPATIAL_EVIDENCE_DATA));
        }
        EVIDENCE_DATA = EVIDENCE_DATA.filter(function (feature, index) {
          return evidenceId(feature, index) !== evidenceIdValue;
        });
        renderNonspatialEvidence();
        renderEvidenceOptions();
        feedback.textContent = 'Evidence nonspasial dihapus.';
      } catch (error) {
        feedback.textContent = error.message;
      }
    });
    document.getElementById('assignment-donor').addEventListener('change', function () {
      renderProgrammes();
      renderDonorCards();
    });
    document.getElementById('admin-donor-card-grid').addEventListener('click', function (event) {
      var card = event.target.closest('[data-select-donor]');
      if (!card) return;
      var donorId = card.dataset.selectDonor;
      var assignmentDonor = document.getElementById('assignment-donor');
      var programmeDonor = document.getElementById('programme-admin-donor');
      assignmentDonor.value = donorId;
      renderProgrammes();
      renderDonorCards();
      if (programmeDonor) {
        programmeDonor.value = donorId;
        renderProgrammeRecords();
        loadProgrammeRecord();
      }
      document.getElementById('assignment-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('assignment-programme').addEventListener('change', renderIndicators);
    document.getElementById('evidence-assignment-form').addEventListener('submit', saveAssignment);
    document.getElementById('programme-admin-donor').addEventListener('change', function () {
      renderProgrammeRecords();
      loadProgrammeRecord();
    });
    document.getElementById('programme-admin-record').addEventListener('change', loadProgrammeRecord);
    document.getElementById('add-logframe-row').addEventListener('click', function () { addLogframeRow(); });
    document.getElementById('logframe-rows').addEventListener('click', function (event) {
      var button = event.target.closest('.remove-logframe-row');
      if (!button) return;
      button.closest('.logframe-row').remove();
      if (!document.querySelector('.logframe-row')) addLogframeRow();
    });
    document.getElementById('programme-admin-form').addEventListener('submit', saveProgrammeConfig);
    document.getElementById('reset-programme-config').addEventListener('click', function () {
      location.reload();
    });
    document.getElementById('assignment-history').addEventListener('click', async function (event) {
      var button = event.target.closest('[data-remove-assignment]');
      if (!button) return;
      try {
        if (REMOTE_AVAILABLE) {
          saveAssignments(await postAdmin('donor-assignment-delete', { assignmentId: button.dataset.removeAssignment }));
        } else {
          saveAssignments(assignments().filter(function (row) {
            return row.assignmentId !== button.dataset.removeAssignment;
          }));
        }
        renderHistory();
        document.getElementById('assignment-feedback').textContent = REMOTE_AVAILABLE
          ? 'Assignment dibatalkan di database pusat.'
          : 'Assignment lokal dibatalkan.';
      } catch (error) {
        document.getElementById('assignment-feedback').textContent = error.message;
      }
    });
  }

  function init() {
    bind();
    Promise.all([
      fetch('data/donors.json?v=20260808-penabulu-plan-evidence1', { cache: 'no-store' }).then(function (response) { return response.json(); }),
      jsonp(API + '?page=public-reports').catch(function () { return { features: [] }; }),
      loadDonorAdminData().catch(function () { return { unavailable: true }; }),
      fetch('data/capacity-building.json?v=20260727-admin-evidence1', { cache: 'no-store' })
        .then(function (response) { return response.ok ? response.json() : []; })
        .catch(function () { return []; }),
      loadLayerEvidence(),
      fetch('data/PERHUTANAN_SOSIAL_RIAU.geojson?v=20260824-kth-alam-hijau-pelalawan1', { cache: 'no-store' })
        .then(function (response) { return response.ok ? response.json() : { features: [] }; })
        .catch(function () { return { features: [] }; })
    ]).then(function (results) {
      DONOR_DATA = results[0] || [];
      REMOTE_AVAILABLE = Array.isArray(results[2] && results[2].programmes) &&
        Array.isArray(results[2] && results[2].assignments);
      PROGRAMME_CONFIG = REMOTE_AVAILABLE ? results[2].programmes : localRows(PROGRAMME_CONFIG_KEY);
      ASSIGNMENT_DATA = REMOTE_AVAILABLE ? results[2].assignments : localRows(ASSIGNMENT_KEY);
      NONSPATIAL_EVIDENCE_DATA = REMOTE_AVAILABLE
        ? (results[2].evidence || [])
        : localRows(NONSPATIAL_EVIDENCE_KEY);
      applyProgrammeConfig(PROGRAMME_CONFIG);
      EVIDENCE_DATA = mergeEvidence(
        (results[1] && results[1].features) || [],
        results[3] || [],
        results[4] || [],
        NONSPATIAL_EVIDENCE_DATA
      );
      buildSocialForestryProfileIndex(results[5]);
      renderAuthState();
      renderDonors();
      renderProgrammeAdmin();
      populateLogframe(null);
      renderNonspatialEvidence();
      renderHistory();
      loadPsInbox();
      if (!EVIDENCE_DATA.length) {
        document.getElementById('assignment-feedback').textContent =
          'API evidence tidak tersedia; status donor tetap dapat diuji.';
      }
    }).catch(function (error) {
      document.getElementById('assignment-feedback').textContent = error.message;
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
