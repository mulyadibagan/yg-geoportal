(function () {
  'use strict';

  var API = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var PROGRAMS = window.YG_DAYUN_NANAS_FERTILIZER_PROGRAMS || {};
  var ACTIVITY_GROUPS = [
    { label: 'Penanaman dan penyisipan', activities: ['Penanaman', 'Penyisipan'] },
    { label: 'Pemeliharaan tanaman', activities: ['Pemupukan', 'Penyiangan', 'Pengendalian HPT'] },
    { label: 'Pembungaan dan produksi', activities: ['Ethrel', 'Panen'] },
    { label: 'Observasi lapangan', activities: ['Monitoring umum'] }
  ];
  var ACTIVITY_META = {
    'Penanaman': { cluster: 'Penanaman dan penyisipan', panel: 'dm-panel-establishment' },
    'Penyisipan': { cluster: 'Penanaman dan penyisipan', panel: 'dm-panel-establishment' },
    'Pemupukan': { cluster: 'Pemeliharaan tanaman' },
    'Penyiangan': { cluster: 'Pemeliharaan tanaman', panel: 'dm-panel-weeding' },
    'Pengendalian HPT': { cluster: 'Pemeliharaan tanaman', panel: 'dm-panel-hpt' },
    'Ethrel': { cluster: 'Pembungaan dan produksi', panel: 'dm-panel-ethrel', crop: 'NANAS' },
    'Panen': { cluster: 'Pembungaan dan produksi', panel: 'dm-panel-harvest' },
    'Monitoring umum': { cluster: 'Observasi lapangan', panel: 'dm-panel-observation' }
  };

  var form = document.getElementById('dm-form');
  var select = document.getElementById('dm-object');
  var crop = document.getElementById('dm-crop');
  var activity = document.getElementById('dm-activity');
  var feedback = document.getElementById('dm-feedback');
  var submit = document.getElementById('dm-submit');
  var photos = document.getElementById('dm-photos');
  var featuresById = {};
  var detailsById = {};
  var currentArea = 0;

  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }
  function numberValue(id) { return $(id).value === '' ? null : Number($(id).value); }
  function fmt(value, digits) {
    return Number(value).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: digits == null ? 2 : digits });
  }
  function today() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }); }
  function normalizeCrop(value) { return String(value || '').trim().toLocaleUpperCase('id-ID'); }
  function isNanasFertilizing() { return activity.value === 'Pemupukan' && normalizeCrop(crop.value) === 'NANAS'; }
  function isRiskWeather(value) { return ['Hujan lebat', 'Baru selesai hujan', 'Lahan tergenang', 'Angin kuat'].indexOf(value) >= 0; }
  function setFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = 'dm-feedback' + (type ? ' is-' + type : '');
  }
  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      var callback = 'ygDayunSubmit_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      var script = document.createElement('script');
      var timer = setTimeout(function () { cleanup(); reject(Error('Waktu konfirmasi server habis.')); }, 10000);
      function cleanup() {
        clearTimeout(timer);
        script.remove();
        try { delete window[callback]; } catch (_) {}
      }
      window[callback] = function (data) { cleanup(); resolve(data); };
      script.onerror = function () { cleanup(); reject(Error('Konfirmasi server tidak dapat dimuat.')); };
      script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + encodeURIComponent(callback) + '&t=' + Date.now();
      document.head.appendChild(script);
    });
  }
  function polygonGeometry(features) {
    var polygons = [];
    (features || []).forEach(function (feature) {
      var geometry = feature.geometry || {};
      if (geometry.type === 'Polygon') polygons.push(geometry.coordinates);
      if (geometry.type === 'MultiPolygon') polygons = polygons.concat(geometry.coordinates || []);
    });
    if (!polygons.length) return null;
    return polygons.length === 1 ? { type: 'Polygon', coordinates: polygons[0] } : { type: 'MultiPolygon', coordinates: polygons };
  }
  function selectedCropRecord() {
    var record = detailsById[select.value];
    return (record && record.crops || []).find(function (item) {
      return normalizeCrop(item.crop) === normalizeCrop(crop.value);
    }) || null;
  }
  function clearTechnicalFields() {
    Array.prototype.forEach.call(document.querySelectorAll('.dm-activity-panel input,.dm-activity-panel select,.dm-activity-panel textarea,.dm-sop-panel input,.dm-sop-panel select,.dm-sop-panel textarea'), function (field) {
      if (field.id === 'dm-fert-phase') field.value = 'base';
      else field.value = '';
    });
    $('dm-fert-materials').innerHTML = '';
    $('dm-fert-deviation-wrap').hidden = true;
  }
  function populateCrops() {
    var record = detailsById[select.value];
    var crops = record && record.crops || [];
    crop.disabled = !crops.length;
    if (!crops.length) {
      crop.innerHTML = '<option value="">Data komoditas belum tersedia</option>';
      $('dm-crop-note').textContent = 'Komoditas belum tercatat pada gawangan ini.';
    } else {
      crop.innerHTML = (crops.length > 1 ? '<option value="">Pilih komoditas pada gawangan</option>' : '') + crops.map(function (item) {
        return '<option value="' + esc(item.crop) + '">' + esc(item.crop) + '</option>';
      }).join('');
      if (crops.length === 1) crop.value = crops[0].crop;
      $('dm-crop-note').textContent = crops.length === 1
        ? 'Terisi otomatis dari data gawangan.'
        : crops.length + ' komoditas tercatat. Pilih komoditas yang sedang dikerjakan.';
    }
    populateActivities();
  }
  function activityAllowed(name) {
    var meta = ACTIVITY_META[name] || {};
    return !meta.crop || meta.crop === normalizeCrop(crop.value);
  }
  function populateActivities() {
    var previous = activity.value;
    var enabled = Boolean(crop.value);
    activity.disabled = !enabled;
    if (!enabled) {
      activity.innerHTML = '<option value="">Pilih komoditas terlebih dahulu</option>';
      syncActivityForm();
      return;
    }
    activity.innerHTML = '<option value="">Pilih jenis kegiatan</option>' + ACTIVITY_GROUPS.map(function (group) {
      var options = group.activities.filter(activityAllowed).map(function (name) {
        return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
      }).join('');
      return options ? '<optgroup label="' + esc(group.label) + '">' + options + '</optgroup>' : '';
    }).join('');
    if (previous && activityAllowed(previous)) activity.value = previous;
    $('dm-activity-note').textContent = normalizeCrop(crop.value) === 'NANAS'
      ? 'Kegiatan dikelompokkan menurut tahapan budidaya nanas.'
      : 'Ethrel hanya ditampilkan untuk komoditas nanas.';
    syncActivityForm();
  }
  function updateObject() {
    var id = select.value;
    var features = featuresById[id] || [];
    var record = detailsById[id];
    var properties = features[0] && features[0].properties || {};
    var block = String(properties.block || record && record.block || '-');
    if (block !== '-' && block.toLowerCase().indexOf('blok ') !== 0) block = 'Blok ' + block;
    currentArea = Number(properties.sourceGawanganAreaHa || properties.areaHa || 0);
    $('dm-object-note').textContent = id ? block + ' · luas ' + fmt(currentArea, 2) + ' ha' : 'Pilih polygon yang dikerjakan.';
    clearTechnicalFields();
    populateCrops();
  }

  function renderFertilizerMaterials(force) {
    var phase = PROGRAMS[$('dm-fert-phase').value];
    if (!phase) return;
    if (!force && $('dm-fert-materials').children.length) return;
    $('dm-fert-phase-note').textContent = phase.note + ' ' + phase.time + '.';
    $('dm-fert-materials').innerHTML = phase.materials.map(function (material) {
      var low = material.min * currentArea;
      var high = material.max * currentArea;
      var range = low === high ? fmt(low, 2) + ' kg' : fmt(low, 2) + '–' + fmt(high, 2) + ' kg';
      return '<article class="dm-fert-material" data-material="' + esc(material.id) + '" data-min="' + material.min + '" data-max="' + material.max + '">' +
        '<header><span>BAHAN SOP</span><strong>' + esc(material.name) + '</strong><small>' + fmt(material.min, 0) + (material.min === material.max ? '' : '–' + fmt(material.max, 0)) + ' kg/ha · kebutuhan gawangan ' + range + '</small></header>' +
        '<label>Realisasi aplikasi (kg) *<input class="dm-fert-actual" type="number" min="0" step="0.01" inputmode="decimal" required></label>' +
        '<label>Sisa bahan (kg)<input class="dm-fert-remaining" type="number" min="0" step="0.01" inputmode="decimal"></label>' +
        '<p class="dm-fert-status">Isi realisasi untuk membandingkan dengan SOP.</p></article>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('.dm-fert-actual,.dm-fert-remaining'), function (input) {
      input.addEventListener('input', updateFertilizerStatus);
    });
    updateFertilizerStatus();
  }
  function fertilizerSnapshot() {
    var phaseId = $('dm-fert-phase').value;
    var phase = PROGRAMS[phaseId];
    var population = Number($('dm-fert-population').value || 0);
    var materials = [];
    Array.prototype.forEach.call(document.querySelectorAll('.dm-fert-material'), function (card) {
      var actualInput = card.querySelector('.dm-fert-actual');
      var remainingInput = card.querySelector('.dm-fert-remaining');
      var actual = actualInput.value === '' ? null : Number(actualInput.value);
      var min = Number(card.dataset.min);
      var max = Number(card.dataset.max);
      var actualKgHa = actual == null || !currentArea ? null : actual / currentArea;
      var status = actualKgHa == null ? 'Belum diisi' : actualKgHa < min ? 'Di bawah SOP' : actualKgHa > max ? 'Di atas SOP' : 'Sesuai rentang SOP';
      var material = (phase.materials || []).find(function (item) { return item.id === card.dataset.material; }) || {};
      materials.push({ id: card.dataset.material, name: material.name || card.dataset.material, sopMinKgHa: min, sopMaxKgHa: max, sopMinTotalKg: min * currentArea, sopMaxTotalKg: max * currentArea, actualKg: actual, actualKgHa: actualKgHa, actualGramPerPlant: actual != null && population > 0 ? actual * 1000 / population : null, remainingKg: remainingInput.value === '' ? null : Number(remainingInput.value), status: status });
    });
    var phValue = numberValue('dm-fert-ph');
    var weather = $('dm-fert-weather').value;
    var deviation = materials.some(function (item) { return item.actualKg != null && item.status !== 'Sesuai rentang SOP'; }) || isRiskWeather(weather) || phValue != null && (phValue < 4.5 || phValue > 6.5);
    return { sopId: 'nanas-fertilizer-sop-2020-v1', phaseId: phaseId, phaseName: phase.name, phaseTime: phase.time, sopNote: phase.note, areaHa: currentArea, activePlantCount: population || null, soilPh: phValue, weather: weather, method: $('dm-fert-method').value, supervisor: $('dm-fert-supervisor').value.trim(), materials: materials, deviation: deviation, deviationReason: $('dm-fert-deviation').value.trim(), withinSop: !deviation };
  }
  function updateFertilizerStatus() {
    if (!isNanasFertilizing()) return;
    var snapshot = fertilizerSnapshot();
    snapshot.materials.forEach(function (item, index) {
      var status = document.querySelectorAll('.dm-fert-status')[index];
      if (!status) return;
      if (item.actualKg == null) { status.textContent = 'Isi realisasi untuk membandingkan dengan SOP.'; status.className = 'dm-fert-status'; return; }
      var perPlant = item.actualGramPerPlant == null ? 'populasi aktif belum diisi' : fmt(item.actualGramPerPlant, 2) + ' g/tanaman';
      status.textContent = item.status + ' · ' + fmt(item.actualKgHa, 2) + ' kg/ha · ' + perPlant;
      status.className = 'dm-fert-status ' + (item.status === 'Sesuai rentang SOP' ? 'is-ok' : 'is-warning');
    });
    $('dm-fert-deviation-wrap').hidden = !snapshot.deviation;
    $('dm-fert-deviation').required = snapshot.deviation;
    var completed = snapshot.materials.filter(function (item) { return item.actualKg != null; }).length;
    $('dm-fert-summary').textContent = completed === snapshot.materials.length ? (snapshot.deviation ? 'Ada dosis/kondisi di luar acuan. Alasan dan arahan pendamping wajib dicatat.' : 'Seluruh realisasi berada dalam rentang SOP. Data tetap menunggu pemeriksaan admin.') : 'Lengkapi realisasi setiap bahan untuk melihat kesesuaiannya dengan SOP.';
  }

  function setPanelRequired(activePanelId) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-required="true"]'), function (field) {
      field.required = Boolean(activePanelId && field.closest('#' + activePanelId));
    });
  }
  function suggestTechnicalValues() {
    var record = selectedCropRecord();
    var vegetation = record && Number(record.vegetationCount) > 0 ? Math.round(Number(record.vegetationCount)) : '';
    if (!$('dm-weed-area').value && currentArea) $('dm-weed-area').value = Number(currentArea.toFixed(2));
    if (!$('dm-generic-fert-area').value && currentArea) $('dm-generic-fert-area').value = Number(currentArea.toFixed(2));
    ['dm-fert-population', 'dm-generic-fert-count', 'dm-observation-count'].forEach(function (id) { if (!$(id).value && vegetation) $(id).value = vegetation; });
  }
  function syncActivityForm() {
    var name = activity.value;
    var meta = ACTIVITY_META[name] || {};
    var panelId = meta.panel || '';
    var nanasFertilizer = isNanasFertilizing();
    if (name === 'Pemupukan') panelId = nanasFertilizer ? 'dm-fertilizer-panel' : 'dm-panel-generic-fertilizer';
    Array.prototype.forEach.call(document.querySelectorAll('.dm-activity-panel,.dm-sop-panel'), function (panel) { panel.hidden = panel.id !== panelId; });
    $('dm-activity-intro').hidden = Boolean(panelId);
    setPanelRequired(panelId);
    ['dm-fert-phase', 'dm-fert-population', 'dm-fert-weather', 'dm-fert-method', 'dm-fert-supervisor'].forEach(function (id) { $(id).required = nanasFertilizer; });
    Array.prototype.forEach.call(document.querySelectorAll('.dm-fert-actual'), function (field) { field.required = nanasFertilizer; });
    if (!nanasFertilizer) $('dm-fert-deviation').required = false;
    var needsPhoto = ['Pemupukan', 'Pengendalian HPT', 'Ethrel', 'Panen'].indexOf(name) >= 0;
    photos.required = needsPhoto;
    $('dm-photo-label').textContent = needsPhoto ? '(wajib untuk kegiatan ini, maksimal 3)' : '(opsional, maksimal 3)';
    $('dm-fert-area').value = currentArea ? fmt(currentArea, 2) + ' ha' : '—';
    if (name === 'Penanaman' || name === 'Penyisipan') {
      var insertion = name === 'Penyisipan';
      $('dm-establishment-title').textContent = insertion ? 'Data penyisipan tanaman' : 'Data penanaman';
      $('dm-est-count-label').textContent = insertion ? 'Jumlah tanaman disisipkan *' : 'Jumlah ditanam *';
      $('dm-est-reason-wrap').hidden = !insertion;
      $('dm-est-spacing-wrap').hidden = insertion;
      $('dm-est-reason').required = insertion;
      if (!insertion) $('dm-planting-date').value = $('dm-date').value;
    }
    suggestTechnicalValues();
    if (nanasFertilizer) renderFertilizerMaterials(false);
  }

  function activitySnapshot() {
    var name = activity.value;
    if (name === 'Penanaman' || name === 'Penyisipan') return { plantingDate: $('dm-planting-date').value, plantCount: numberValue('dm-est-count'), spacing: $('dm-est-spacing').value.trim(), seedlingSource: $('dm-est-source').value.trim(), replacementReason: name === 'Penyisipan' ? $('dm-est-reason').value.trim() : '' };
    if (name === 'Penyiangan') return { treatedAreaHa: numberValue('dm-weed-area'), method: $('dm-weed-method').value, weedCondition: $('dm-weed-level').value, workerCount: numberValue('dm-weed-workers') };
    if (name === 'Pengendalian HPT') return { affectedPlantCount: numberValue('dm-hpt-count'), severity: $('dm-hpt-severity').value, symptoms: $('dm-hpt-symptom').value.trim(), controlAction: $('dm-hpt-control').value.trim(), material: $('dm-hpt-material').value.trim() };
    if (name === 'Ethrel') { var ethrelWeather=$('dm-ethrel-weather').value; return { pineappleVariety: 'Queen', treatedPlantCount: numberValue('dm-ethrel-count'), solutionLiters: numberValue('dm-ethrel-solution'), ethrelProductMl: numberValue('dm-ethrel-product'), method: $('dm-ethrel-method').value, plantReadiness: $('dm-ethrel-readiness').value, weather: ethrelWeather, weatherSuitability: ethrelWeather === 'Cerah' || ethrelWeather === 'Berawan' ? 'Perlu konfirmasi tajuk kering dan prakiraan per jam' : 'Perlu pemeriksaan ketidaksesuaian cuaca', requiresTechnicalReview: true }; }
    if (name === 'Panen') return { harvestCount: numberValue('dm-harvest-count'), unit: $('dm-harvest-unit').value, totalWeightKg: numberValue('dm-harvest-weight'), dominantGrade: $('dm-harvest-grade').value, destination: $('dm-harvest-destination').value.trim() };
    if (name === 'Monitoring umum') return { observedPlantCount: numberValue('dm-observation-count'), condition: $('dm-observation-condition').value, focus: $('dm-observation-focus').value.trim() };
    if (name === 'Pemupukan' && !isNanasFertilizing()) return { treatedAreaHa: numberValue('dm-generic-fert-area'), targetPlantCount: numberValue('dm-generic-fert-count'), material: $('dm-generic-fert-material').value.trim(), method: $('dm-generic-fert-method').value, supervisor: $('dm-generic-fert-supervisor').value.trim() };
    return {};
  }
  function compatibilityFields(details, fertilizer) {
    var name = activity.value;
    if (fertilizer) return { quantity: null, unit: '', material: fertilizer.materials.map(function (item) { return item.name + ' ' + fmt(item.actualKg, 2) + ' kg (' + item.status + ')'; }).join(' · '), condition: '' };
    if (name === 'Penanaman' || name === 'Penyisipan') return { quantity: details.plantCount, unit: 'batang', material: details.seedlingSource, condition: '' };
    if (name === 'Penyiangan') return { quantity: details.treatedAreaHa, unit: 'ha', material: details.method, condition: details.weedCondition };
    if (name === 'Pengendalian HPT') return { quantity: details.affectedPlantCount, unit: 'batang', material: details.material || details.controlAction, condition: details.severity };
    if (name === 'Ethrel') return { quantity: details.treatedPlantCount, unit: 'batang', material: 'Ethrel ' + details.ethrelProductMl + ' ml dalam ' + details.solutionLiters + ' liter larutan · nenas Queen', condition: details.plantReadiness };
    if (name === 'Panen') return { quantity: details.harvestCount, unit: details.unit, material: details.destination, condition: details.dominantGrade };
    if (name === 'Monitoring umum') return { quantity: details.observedPlantCount, unit: 'batang', material: details.focus, condition: details.condition };
    return { quantity: details.targetPlantCount, unit: 'batang', material: details.material, condition: '' };
  }
  function dateAfterDays(dateValue, days) {
    var date = new Date(dateValue + 'T00:00:00Z');
    if (Number.isNaN(date.getTime())) return '';
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  function followUpRecommendation(details, eventDate) {
    var name = activity.value;
    var recommendation = { source: 'system', requiresAdminConfirmation: true, action: '', windowDaysMin: 0, windowDaysMax: 0 };
    if (name === 'Penanaman') Object.assign(recommendation, { action: 'Periksa daya hidup dan kondisi awal tanaman baru.', windowDaysMin: 7, windowDaysMax: 14 });
    else if (name === 'Penyisipan') Object.assign(recommendation, { action: 'Periksa keberhasilan hidup tanaman sisipan dan kebutuhan penyisipan ulang.', windowDaysMin: 7, windowDaysMax: 14 });
    else if (name === 'Pemupukan') Object.assign(recommendation, { action: 'Periksa respons tanaman serta gejala kekurangan atau kelebihan unsur.', windowDaysMin: 14, windowDaysMax: 21 });
    else if (name === 'Penyiangan') Object.assign(recommendation, { action: 'Nilai kembali pertumbuhan gulma dan kebutuhan pemeliharaan lanjutan.', windowDaysMin: 21, windowDaysMax: 30 });
    else if (name === 'Pengendalian HPT') {
      var severe = details.severity === 'Berat';
      var medium = details.severity === 'Sedang';
      Object.assign(recommendation, { action: 'Evaluasi perkembangan serangan dan efektivitas tindakan pengendalian.', windowDaysMin: severe ? 2 : medium ? 5 : 7, windowDaysMax: severe ? 3 : medium ? 7 : 14 });
    } else if (name === 'Ethrel') Object.assign(recommendation, { action: 'Periksa keseragaman respons pembungaan setelah aplikasi ethrel.', windowDaysMin: 30, windowDaysMax: 45 });
    else if (name === 'Panen') Object.assign(recommendation, { action: 'Perbarui sisa buah siap panen dan rencana panen berikutnya.', windowDaysMin: 7, windowDaysMax: 14 });
    else Object.assign(recommendation, { action: 'Tinjau kembali temuan lapangan dan tentukan tindakan yang diperlukan.', windowDaysMin: 7, windowDaysMax: 14 });
    recommendation.windowStartDate = dateAfterDays(eventDate, recommendation.windowDaysMin);
    recommendation.windowEndDate = dateAfterDays(eventDate, recommendation.windowDaysMax);
    return recommendation;
  }
  function compressPhoto(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(Error('Foto gagal dibaca.')); };
      reader.onload = function () {
        var image = new Image();
        image.onerror = function () { reject(Error('Format foto tidak didukung.')); };
        image.onload = function () {
          var max = 1600;
          var scale = Math.min(1, max / Math.max(image.width, image.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve({ name: file.name.replace(/\.[^.]+$/, '.jpg'), dataUrl: canvas.toDataURL('image/jpeg', 0.82) });
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  async function pollSubmission(id) {
    for (var attempt = 0; attempt < 25; attempt += 1) {
      await new Promise(function (resolve) { setTimeout(resolve, attempt ? 1000 : 500); });
      var result = await jsonp(API + '?page=report-submission-status&clientSubmissionId=' + encodeURIComponent(id));
      if (result && result.pending) continue;
      return result;
    }
    throw Error('Penyimpanan belum terkonfirmasi. Periksa Antrean Laporan Tim.');
  }

  var currentDate = today();
  $('dm-date').value = currentDate;
  $('dm-date').max = currentDate;
  $('dm-planting-date').max = currentDate;
  Promise.all([
    fetch('data/dayun-map.geojson?v=20260916-objectid1').then(function (response) { if (!response.ok) throw Error('Peta gagal dimuat.'); return response.json(); }),
    fetch('data/dayun-gawangan-details.json?v=20260917-all-profiles2').then(function (response) { if (!response.ok) throw Error('Rincian gagal dimuat.'); return response.json(); })
  ]).then(function (results) {
    (results[0].features || []).forEach(function (feature) {
      var properties = feature.properties || {};
      if (properties.category !== 'Gawangan Tanam' || !properties.objectId) return;
      (featuresById[properties.objectId] || (featuresById[properties.objectId] = [])).push(feature);
    });
    (results[1].objects || []).forEach(function (item) { detailsById[item.objectId] = item; });
    var ids = Object.keys(featuresById).sort(function (a, b) { return a.localeCompare(b, 'id', { numeric: true }); });
    select.innerHTML = '<option value="">Pilih Blok–Gawangan</option>' + ids.map(function (id) {
      var record = detailsById[id];
      var label = id.replace('DAYUN-GT-', '');
      return '<option value="' + esc(id) + '">' + esc(label + (record && record.crops.length ? ' · ' + record.crops.map(function (item) { return item.crop; }).join(', ') : ' · data belum tersedia')) + '</option>';
    }).join('');
    var requested = new URLSearchParams(location.search).get('object');
    if (requested && featuresById[requested]) { select.value = requested; updateObject(); }
  }).catch(function (error) {
    select.innerHTML = '<option value="">Data gawangan gagal dimuat</option>';
    setFeedback(error.message, 'error');
  });

  select.addEventListener('change', updateObject);
  crop.addEventListener('change', function () { clearTechnicalFields(); activity.value = ''; populateActivities(); });
  activity.addEventListener('change', syncActivityForm);
  $('dm-fert-phase').addEventListener('change', function () { renderFertilizerMaterials(true); });
  ['dm-fert-population', 'dm-fert-ph', 'dm-fert-weather', 'dm-fert-method'].forEach(function (id) { $(id).addEventListener('input', updateFertilizerStatus); $(id).addEventListener('change', updateFertilizerStatus); });
  $('dm-date').addEventListener('change', function () { if (activity.value === 'Penanaman') $('dm-planting-date').value = this.value; });
  photos.addEventListener('change', function () { var count = this.files.length; $('dm-photo-note').textContent = count > 3 ? 'Terlalu banyak foto. Pilih maksimal 3 foto.' : count ? count + ' foto dipilih dan akan dikompresi.' : 'Foto dikompresi sebelum dikirim.'; });
  form.addEventListener('reset', function () { setTimeout(function () { $('dm-date').value = today(); select.value = ''; currentArea = 0; populateCrops(); setFeedback('Form dibersihkan.'); }, 0); });
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    var id = select.value;
    var eventDate = $('dm-date').value;
    var reporter = $('dm-reporter').value.trim();
    var organization = $('dm-organization').value.trim();
    var phone = $('dm-phone').value.trim();
    var email = $('dm-email').value.trim();
    if ($('dm-website').value) return;
    updateFertilizerStatus();
    if (!crop.value || !activity.value) { setFeedback('Pilih komoditas dan jenis kegiatan sebelum mengirim laporan.', 'error'); return; }
    if (!form.reportValidity()) return;
    if (!phone && !email) { setFeedback('Isi email atau nomor WhatsApp agar admin dapat menghubungi pelapor untuk verifikasi.', 'error'); $('dm-phone').focus(); return; }
    if (phone && phone.replace(/\D/g, '').length < 8) { setFeedback('Periksa nomor WhatsApp. Gunakan minimal 8 angka.', 'error'); $('dm-phone').focus(); return; }
    var details = activitySnapshot();
    if (details.plantingDate && details.plantingDate > eventDate) { setFeedback('Tanggal tanam tidak boleh lebih baru daripada tanggal kegiatan.', 'error'); $('dm-planting-date').focus(); return; }
    if (photos.files.length > 3) { setFeedback('Pilih maksimal 3 foto kegiatan.', 'error'); photos.focus(); return; }
    if (photos.required && photos.files.length < 1) { setFeedback('Minimal satu foto wajib untuk verifikasi kegiatan ini.', 'error'); photos.focus(); return; }
    var targetFeatures = featuresById[id] || [];
    var geometry = polygonGeometry(targetFeatures);
    var properties = targetFeatures[0] && targetFeatures[0].properties || {};
    if (!geometry) { setFeedback('Geometri gawangan tidak ditemukan.', 'error'); return; }
    submit.disabled = true;
    submit.textContent = 'Mengirim…';
    setFeedback('Menyiapkan data dan foto untuk dikirim.');
    try {
      var files = Array.from(photos.files || []);
      var images = await Promise.all(files.map(compressPhoto));
      var fertilizer = isNanasFertilizing() ? fertilizerSnapshot() : null;
      var compatible = compatibilityFields(details, fertilizer);
      var meta = ACTIVITY_META[activity.value] || {};
      var recommendation = followUpRecommendation(details, eventDate);
      var info = { schemaVersion: 'dayun-monitoring-v5', monitoringType: 'Agroforestri Dayun', activityCluster: meta.cluster || '', activityType: activity.value, crop: crop.value, eventDate: eventDate, plantingDate: details.plantingDate || '', condition: compatible.condition, quantity: compatible.quantity, unit: compatible.unit, material: compatible.material, activityDetails: details, followUpRecommendation: recommendation, notes: $('dm-notes').value.trim(), fertilizer: fertilizer };
      var clientId = 'dayun-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
      var payload = { clientSubmissionId: clientId, reportType: 'Monitoring', name: reporter, organization: organization, email: email, phone: phone, province: 'Riau', regency: 'Siak', district: 'Dayun', village: 'Dayun', locationName: 'Gawangan ' + id.replace('DAYUN-GT-', ''), title: activity.value + ' ' + info.crop + ' · ' + id.replace('DAYUN-GT-', ''), activityDate: eventDate, description: info.notes, oldInformation: JSON.stringify(detailsById[id] || {}), proposedInformation: JSON.stringify(info), geometryType: geometry.type, geometryGeoJSON: JSON.stringify(geometry), targetLayerId: 'dayun_gawangan', targetLayerLabel: 'Gawangan Agroforestri Dayun', targetSourceType: 'dayun_gawangan', targetObjectId: id, targetFeatureProperties: JSON.stringify(Object.assign({}, properties, { Object_ID: id, objectId: id })), proposedChanges: JSON.stringify({ monitoring: info }), images: images, documents: [] };
      await fetch(API, { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ payload: JSON.stringify(payload) }) });
      var result = await pollSubmission(clientId);
      if (!result || !result.ok) throw Error(result && result.message || 'Data gagal disimpan.');
      setFeedback('Tersimpan sebagai Menunggu Verifikasi. ID laporan: ' + result.reportId + '. Data belum tampil ke publik sampai disetujui admin.', 'success');
      form.reset();
      select.value = id;
      updateObject();
    } catch (error) {
      setFeedback(error.message || 'Pengiriman gagal.', 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Kirim untuk verifikasi';
    }
  });
}());
