
(function(){
  'use strict';

  var COMMUNITY_LAYER_ID = 'community_reports';
  var COMMUNITY_LAYER_LABEL = 'Laporan Masyarakat Terverifikasi';
  var COMMUNITY_LAYER_COLOR = '#7b1fa2';
  var COMMUNITY_API = 'https://script.google.com/macros/s/AKfycbxeGTDZXkR0DyLZmBHTq2M-52Iu4dTTGpH164S7sYHg8qPzvffobC6-r-TBLVHMT3HU-A/exec?page=public-reports';
  var communityDataCache = null;
  var communityDataPromise = null;

  var form = document.getElementById('report-form');
  var imageInput = document.getElementById('images');
  var preview = document.getElementById('preview');
  var statusText = document.getElementById('submit-status');
  var submitButton = document.getElementById('submit-button');
  var success = document.getElementById('success');
  var submitFrame = document.getElementById('submit-frame');

  var compressedImages = [];
  var imagesProcessing = false;
  var selectedType = '';
  var geometryType = '';
  var geometryGeoJSON = null;
  var marker = null;
  var polygonLayer = null;
  var polygonDrawer = null;
  var kmlLayer = null;
  var areaMethod = 'draw';
  var submissionStarted = false;
  var correctionLayerGroup = null;
  var correctionFeatureLayer = null;
  var selectedCorrectionFeature = null;
  var correctionLayersLoaded = false;

  var pointTypes = [
    'Titik Baru','Kebakaran','Abrasi','Biodiversitas'
  ];

  var existingFeatureTypes = [
    'Tambah Foto Kegiatan','Perbaikan Informasi','Monitoring',
    'Replanting/Penyulaman Mangrove'
  ];

  /*
   * Semua laporan lapangan wajib membawa bukti foto. Perbaikan Informasi
   * dikecualikan karena dapat berupa koreksi atribut administratif.
   */
  var photoRequiredTypes = [
    'Tambah Foto Kegiatan',
    'Titik Baru',
    'Area/Poligon Baru',
    'Monitoring',
    'Replanting/Penyulaman Mangrove',
    'Kebakaran',
    'Abrasi',
    'Biodiversitas'
  ];

  function setImagesProcessing(processing){
    imagesProcessing = Boolean(processing);
    if(imagesProcessing){
      submitButton.disabled = true;
      submitButton.textContent = 'Memproses foto...';
    }else if(!submissionStarted){
      submitButton.disabled = false;
      submitButton.textContent = 'Kirim Laporan';
    }
  }

  var map = L.map('location-map').setView([1.15,101.95],8);
  var street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'&copy; OpenStreetMap contributors'
  }).addTo(map);
  var satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {maxZoom:19,attribution:'Tiles &copy; Esri'}
  );
  L.control.layers({'Peta Jalan':street,'Citra Satelit':satellite},null,{collapsed:true}).addTo(map);

  document.querySelectorAll('input[name="reportTypeUI"]').forEach(function(input){
    input.addEventListener('change',function(){
      selectedType = this.value;
      configureFormByType(selectedType);
    });
  });

  function configureFormByType(type){
    resetGeometry();

    var geometrySection = document.getElementById('geometry-section');
    var pointTools = document.getElementById('point-tools');
    var polygonTools = document.getElementById('polygon-tools');
    var pointCoordinates = document.getElementById('point-coordinates');
    var existingFeatureFields = document.getElementById('existing-feature-fields');
    var oldInformation = document.getElementById('old-information');
    var proposedInformation = document.getElementById('proposed-information');
    var monitoringFields = document.getElementById('monitoring-fields');
    if(monitoringFields) monitoringFields.hidden = type !== 'Monitoring';
    var replantingFields = document.getElementById('replanting-fields');
    if(replantingFields) replantingFields.hidden =
      type !== 'Replanting/Penyulaman Mangrove';
    var guidance = document.getElementById('type-guidance');
    var geometryHelp = document.getElementById('geometry-help');

    existingFeatureFields.hidden = existingFeatureTypes.indexOf(type) === -1;

    if(type === 'Area/Poligon Baru'){
      geometrySection.hidden = false;
      pointTools.hidden = true;
      polygonTools.hidden = false;
      pointCoordinates.hidden = true;
      geometryType = 'Polygon';
      areaMethod = 'draw';
      document.getElementById('area-method-draw').checked = true;
      document.getElementById('draw-area-tools').hidden = false;
      document.getElementById('kml-area-tools').hidden = true;
      guidance.textContent = 'Pilih menggambar poligon langsung atau upload file KML.';
      geometryHelp.textContent = 'Area wajib berupa Polygon atau MultiPolygon yang valid.';
    }else if(pointTypes.indexOf(type) !== -1){
      geometrySection.hidden = false;
      pointTools.hidden = false;
      polygonTools.hidden = true;
      pointCoordinates.hidden = false;
      geometryType = 'Point';
      guidance.textContent = type === 'Titik Baru'
        ? 'Tempatkan satu titik baru dengan GPS atau klik peta.'
        : 'Tentukan titik lokasi kegiatan atau kejadian.';
      geometryHelp.textContent = 'Gunakan GPS atau klik satu titik pada peta. Marker dapat digeser.';
    }else if(existingFeatureTypes.indexOf(type) !== -1){
      geometrySection.hidden = false;
      pointTools.hidden = true;
      polygonTools.hidden = true;
      pointCoordinates.hidden = true;
      geometryType = 'ExistingFeature';

      document.getElementById('existing-feature-title').textContent =
        type === 'Tambah Foto Kegiatan'
          ? 'Pilih objek WebGIS untuk penambahan foto'
          : type === 'Replanting/Penyulaman Mangrove'
            ? 'Pilih area penanaman mangrove yang akan direplanting'
            : type === 'Monitoring'
              ? 'Pilih objek WebGIS yang akan dimonitor'
              : 'Pilih objek WebGIS yang akan diperbaiki';

      document.getElementById('correction-detail-fields').hidden =
        type !== 'Perbaikan Informasi';

      document.getElementById('photo-target-note').hidden =
        ['Tambah Foto Kegiatan','Replanting/Penyulaman Mangrove']
          .indexOf(type) === -1;

      guidance.textContent = type === 'Tambah Foto Kegiatan'
        ? 'Pilih layer dan objek WebGIS yang akan menerima foto baru.'
        : type === 'Replanting/Penyulaman Mangrove'
          ? 'Pilih polygon penanaman mangrove lama, isi data penyulaman, lalu unggah foto BEFORE dan AFTER.'
        : type === 'Monitoring'
          ? 'Pilih objek WebGIS yang sudah ada, lalu isi indikator monitoring sesuai jenisnya.'
          : 'Pilih layer, lalu klik titik atau poligon WebGIS yang informasinya ingin diperbaiki.';

      geometryHelp.textContent =
        'Objek yang dipilih akan disorot dan dikirim bersama laporan.';

      prepareCorrectionSelector();
    }

    setTimeout(function(){ map.invalidateSize(true); },150);
  }


  function prepareCorrectionSelector(){
    populateCorrectionLayerOptions();

    if(!correctionLayersLoaded){
      correctionLayersLoaded = true;
      document.getElementById('correction-layer')
        .addEventListener('change',function(){
          loadCorrectionLayer(this.value);
        });

      document.getElementById('clear-selected-feature')
        .addEventListener('click',function(){
          clearSelectedCorrectionFeature();
        });
    }

    setTimeout(function(){ map.invalidateSize(true); },180);
  }

  function populateCorrectionLayerOptions(){
    var select = document.getElementById('correction-layer');
    if(select.options.length > 1) return;

    var config = window.YG_LAYER_CONFIG || [];

    config.forEach(function(layerConfig){
      var option = document.createElement('option');
      option.value = layerConfig.id;
      option.textContent = layerConfig.label;
      select.appendChild(option);
    });

    var communityOption = document.createElement('option');
    communityOption.value = COMMUNITY_LAYER_ID;
    communityOption.textContent = COMMUNITY_LAYER_LABEL;
    select.appendChild(communityOption);
  }

  function loadCommunityReports(){
    if(communityDataCache) return Promise.resolve(communityDataCache);
    if(communityDataPromise) return communityDataPromise;

    communityDataPromise = new Promise(function(resolve,reject){
      var callbackName = 'ygReportCommunityCallback_' + Date.now();
      var script = document.createElement('script');
      var timer = window.setTimeout(function(){
        cleanup();
        reject(new Error('Waktu pemuatan laporan masyarakat habis.'));
      },15000);

      function cleanup(){
        window.clearTimeout(timer);
        try{ delete window[callbackName]; }catch(e){ window[callbackName] = undefined; }
        if(script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = function(data){
        cleanup();
        if(!data || data.type !== 'FeatureCollection'){
          reject(new Error('Format laporan masyarakat tidak valid.'));
          return;
        }
        communityDataCache = data;
        resolve(data);
      };

      script.onerror = function(){
        cleanup();
        reject(new Error('Laporan masyarakat gagal dimuat.'));
      };
      script.src = COMMUNITY_API + '&callback=' + callbackName + '&t=' + Date.now();
      script.async = true;
      document.head.appendChild(script);
    }).catch(function(error){
      communityDataPromise = null;
      throw error;
    });

    return communityDataPromise;
  }

  function makeObjectId(feature,config){
    var p = feature && feature.properties ? feature.properties : {};
    var direct = p.objectId || p.monitoringObjectId || p.reportId || p.id || p.ID || p.OBJECTID || p.FID;
    if(direct !== undefined && direct !== null && String(direct).trim() !== ''){
      return String(config.id) + ':' + String(direct).trim();
    }

    var name = getCorrectionFeatureName(feature,config.label).toLowerCase().trim();
    var geom = feature && feature.geometry ? JSON.stringify(feature.geometry) : '';
    var hash = 0;
    var raw = config.id + '|' + name + '|' + geom;
    for(var i=0;i<raw.length;i++) hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    return String(config.id) + ':auto:' + Math.abs(hash);
  }

  async function loadCorrectionLayer(layerId){
    clearSelectedCorrectionFeature();

    if(correctionLayerGroup){
      map.removeLayer(correctionLayerGroup);
      correctionLayerGroup = null;
    }

    if(!layerId){
      document.getElementById('selected-feature-summary').textContent =
        'Belum ada objek WebGIS dipilih.';
      return;
    }

    var config = (window.YG_LAYER_CONFIG || []).find(function(item){
      return item.id === layerId;
    });

    if(layerId === COMMUNITY_LAYER_ID){
      config = {
        id: COMMUNITY_LAYER_ID,
        label: COMMUNITY_LAYER_LABEL,
        color: COMMUNITY_LAYER_COLOR,
        type: 'mixed',
        sourceType: 'community_report'
      };
    }

    if(!config){
      alert('Konfigurasi layer tidak ditemukan. Pastikan layer baru sudah terdaftar di js/config.js.');
      return;
    }

    var summary = document.getElementById('selected-feature-summary');
    summary.className = 'selected-feature-summary';
    summary.textContent = 'Memuat layer ' + config.label + '...';

    try{
      var data;

      if(config.id === COMMUNITY_LAYER_ID){
        data = await loadCommunityReports();
      }else{
        var dataPath = config.url || config.dataUrl || config.file || ('data/' + config.id + '.geojson');
        var response = await fetch(dataPath, {cache:'no-store'});
        if(!response.ok) throw new Error('HTTP ' + response.status + ' untuk ' + dataPath);
        data = await response.json();
      }

      correctionLayerGroup = L.geoJSON(data,{
        style:function(){
          return {
            color:config.color,
            fillColor:config.color,
            fillOpacity:0.22,
            weight:3,
            opacity:0.95
          };
        },
        pointToLayer:function(feature,latlng){
          return L.circleMarker(latlng,{
            radius:9,
            fillColor:config.color,
            color:'#ffffff',
            weight:2,
            fillOpacity:0.96
          });
        },
        onEachFeature:function(feature,layer){
          layer.on('click',function(event){
            if(event && event.originalEvent){
              L.DomEvent.stopPropagation(event);
            }
            selectExistingFeature(feature,layer,config);
          });

          layer.bindTooltip(
            getCorrectionFeatureName(feature,config.label),
            {sticky:true,direction:'top'}
          );
        }
      }).addTo(map);

      var bounds = correctionLayerGroup.getBounds();
      if(bounds && bounds.isValid()){
        map.fitBounds(bounds,{padding:[24,24],maxZoom:14});
      }

      summary.textContent =
        'Layer dimuat. Klik salah satu titik atau poligon pada peta.';
    }catch(error){
      console.error(error);
      summary.className = 'selected-feature-summary error';
      summary.textContent = 'Layer gagal dimuat: ' + error.message;
    }
  }

  function selectExistingFeature(feature,layer,config){
    if(correctionFeatureLayer){
      restoreCorrectionFeatureStyle(correctionFeatureLayer);
    }

    correctionFeatureLayer = layer;
    selectedCorrectionFeature = {
      layerId:config.id,
      layerLabel:config.label,
      sourceType:config.sourceType || 'program_layer',
      objectId:makeObjectId(feature,config),
      feature:feature
    };

    if(typeof layer.setStyle === 'function'){
      layer.setStyle({
        color:'#ffb300',
        fillColor:'#ffca28',
        fillOpacity:0.45,
        weight:5
      });
    }

    if(typeof layer.setRadius === 'function'){
      layer.setStyle({
        fillColor:'#ffb300',
        color:'#ffffff',
        weight:3,
        fillOpacity:1
      });
      layer.setRadius(12);
    }

    geometryGeoJSON = JSON.parse(JSON.stringify(feature.geometry));
    geometryType = feature.geometry.type;

    var featureName = getCorrectionFeatureName(feature,config.label);
    var oldText = buildExistingInformationText(feature,config);

    document.getElementById('old-information').value = oldText;
    document.getElementById('location-name').value = featureName;

    var fp = feature.properties || {};
    var fieldMap = {
      province:['province','provinsi','Provinsi','PROVINSI'],
      regency:['regency','kabupaten','Kabupaten','kab_kota','KAB_KOTA'],
      district:['district','kecamatan','Kecamatan','KECAMATAN'],
      village:['village','desa','Desa','kelurahan','DESA_KELURAHAN']
    };
    Object.keys(fieldMap).forEach(function(id){
      var el = document.getElementById(id);
      if(!el || el.value.trim()) return;
      var keys = fieldMap[id];
      for(var k=0;k<keys.length;k++){
        if(fp[keys[k]]){ el.value = fp[keys[k]]; break; }
      }
    });

    if(selectedType === 'Perbaikan Informasi'){
      buildEditableAttributes(feature.properties || {});
    }

    var summary = document.getElementById('selected-feature-summary');
    summary.className = 'selected-feature-summary success';
    summary.innerHTML =
      '<strong>' + escapeCorrectionHtml(featureName) + '</strong>' +
      '<span>' + escapeCorrectionHtml(config.label) +
      ' • ' + escapeCorrectionHtml(feature.geometry.type) + '</span>';

    document.getElementById('clear-selected-feature').hidden = false;
    updateGeometrySummary();

    if(typeof layer.openPopup === 'function'){
      layer.openPopup();
    }
  }


  function isEditableAttribute(key,value){
    var blocked = [
      'OBJECTID','FID','FID_1','Id','ID','No',
      'X','Y','Foto','Foto_2','photos',
      'KODE_DESA','KODE_KEC','KODE_KAB','KODE_PROV',
      'SRS_ID','geometry'
    ];

    return blocked.indexOf(key) === -1 &&
      value !== null &&
      value !== undefined &&
      typeof value !== 'object';
  }

  function buildEditableAttributes(properties){
    var container = document.getElementById('editable-attributes');
    container.innerHTML = '';

    var keys = Object.keys(properties).filter(function(key){
      return isEditableAttribute(key,properties[key]);
    });

    if(!keys.length){
      container.innerHTML =
        '<div class="no-editable-attributes">Tidak ada atribut yang dapat diedit.</div>';
      return;
    }

    keys.forEach(function(key){
      var row = document.createElement('div');
      row.className = 'editable-attribute-row';

      var oldBox = document.createElement('div');
      oldBox.className = 'editable-old-value';

      var label = document.createElement('strong');
      label.textContent = key;

      var oldValue = document.createElement('span');
      oldValue.textContent = String(properties[key]);

      oldBox.appendChild(label);
      oldBox.appendChild(oldValue);

      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'editable-new-value';
      input.dataset.attributeKey = key;
      input.placeholder = 'Nilai baru (biarkan kosong jika tidak diubah)';

      row.appendChild(oldBox);
      row.appendChild(input);
      container.appendChild(row);
    });
  }

  function collectProposedChanges(){
    var changes = {};

    document.querySelectorAll('.editable-new-value').forEach(function(input){
      var value = input.value.trim();

      if(value !== ''){
        changes[input.dataset.attributeKey] = value;
      }
    });

    return changes;
  }

  function clearSelectedCorrectionFeature(){
    if(correctionFeatureLayer){
      restoreCorrectionFeatureStyle(correctionFeatureLayer);
    }

    correctionFeatureLayer = null;
    selectedCorrectionFeature = null;
    geometryGeoJSON = null;

    document.getElementById('old-information').value = '';
    document.getElementById('editable-attributes').innerHTML = '';
    document.getElementById('proposed-information').value = '';
    document.getElementById('selected-feature-summary').className =
      'selected-feature-summary';
    document.getElementById('selected-feature-summary').textContent =
      'Belum ada objek WebGIS dipilih.';
    document.getElementById('clear-selected-feature').hidden = true;

    updateGeometrySummary();
  }

  function restoreCorrectionFeatureStyle(layer){
    if(!correctionLayerGroup || !layer) return;

    if(typeof correctionLayerGroup.resetStyle === 'function'){
      correctionLayerGroup.resetStyle(layer);
    }

    if(typeof layer.setRadius === 'function'){
      layer.setRadius(9);
    }
  }

  function getCorrectionFeatureName(feature,fallback){
    var properties = feature && feature.properties
      ? feature.properties
      : {};

    var keys = [
      'NAMOBJ','NAMA_DESA','WADMKD','Desa','desa',
      'Nama','NAMA','Kegiatan','KEGIATAN',
      'title','locationName'
    ];

    for(var i=0;i<keys.length;i++){
      var value = properties[keys[i]];
      if(value !== null && value !== undefined && String(value).trim()){
        return String(value).trim();
      }
    }

    return fallback;
  }

  function buildExistingInformationText(feature,config){
    var properties = feature.properties || {};
    var lines = [
      'OBJEK WEBGIS YANG DIPILIH',
      'Layer: ' + config.label,
      'Layer ID: ' + config.id,
      'Jenis geometri: ' + feature.geometry.type,
      '',
      'ATRIBUT LAMA'
    ];

    Object.keys(properties).forEach(function(key){
      var value = properties[key];

      if(
        value === null ||
        value === undefined ||
        value === '' ||
        typeof value === 'object'
      ){
        return;
      }

      lines.push(key + ': ' + value);
    });

    return lines.join('\n');
  }

  function escapeCorrectionHtml(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function setPoint(lat,lng,zoom){
    if(polygonLayer){
      map.removeLayer(polygonLayer);
      polygonLayer = null;
    }

    if(marker){
      marker.setLatLng([lat,lng]);
    }else{
      marker = L.marker([lat,lng],{draggable:true}).addTo(map);
      marker.on('dragend',function(event){
        var p = event.target.getLatLng();
        setPoint(p.lat,p.lng,map.getZoom());
      });
    }

    geometryGeoJSON = {
      type:'Point',
      coordinates:[Number(lng),Number(lat)]
    };

    document.getElementById('latitude').value = Number(lat).toFixed(7);
    document.getElementById('longitude').value = Number(lng).toFixed(7);
    updateGeometrySummary();
    map.setView([lat,lng],zoom || 15);
  }

  map.on('click',function(event){
    if(geometryType === 'Point' || geometryType === 'OptionalPoint'){
      setPoint(event.latlng.lat,event.latlng.lng,Math.max(map.getZoom(),14));
    }
  });

  document.getElementById('get-location').addEventListener('click',function(){
    if(!navigator.geolocation){
      alert('Browser ini tidak mendukung GPS.');
      return;
    }

    var button = this;
    button.disabled = true;
    button.textContent = 'Mengambil lokasi...';

    navigator.geolocation.getCurrentPosition(
      function(position){
        setPoint(position.coords.latitude,position.coords.longitude,16);
        button.textContent = '✓ Lokasi Tersimpan';
      },
      function(){
        alert('Lokasi tidak dapat diambil. Pastikan izin lokasi aktif.');
        button.disabled = false;
        button.textContent = '📍 Ambil Lokasi Saya';
      },
      {enableHighAccuracy:true,timeout:15000,maximumAge:0}
    );
  });


  document.getElementById('apply-coordinate').addEventListener('click',function(){
    var latitudeInput = document.getElementById('latitude');
    var longitudeInput = document.getElementById('longitude');
    var message = document.getElementById('coordinate-message');

    var latitude = parseManualCoordinate(latitudeInput.value);
    var longitude = parseManualCoordinate(longitudeInput.value);

    latitudeInput.classList.remove('input-error','input-success');
    longitudeInput.classList.remove('input-error','input-success');
    message.classList.remove('message-error','message-success');

    if(!Number.isFinite(latitude) || latitude < -90 || latitude > 90){
      latitudeInput.classList.add('input-error');
      message.textContent = 'Latitude tidak valid. Gunakan nilai antara -90 dan 90.';
      message.classList.add('message-error');
      return;
    }

    if(!Number.isFinite(longitude) || longitude < -180 || longitude > 180){
      longitudeInput.classList.add('input-error');
      message.textContent = 'Longitude tidak valid. Gunakan nilai antara -180 dan 180.';
      message.classList.add('message-error');
      return;
    }

    setPoint(latitude,longitude,16);

    latitudeInput.classList.add('input-success');
    longitudeInput.classList.add('input-success');
    message.textContent = 'Koordinat berhasil diterapkan ke peta.';
    message.classList.add('message-success');
  });

  document.getElementById('latitude').addEventListener('keydown',function(event){
    if(event.key === 'Enter'){
      event.preventDefault();
      document.getElementById('apply-coordinate').click();
    }
  });

  document.getElementById('longitude').addEventListener('keydown',function(event){
    if(event.key === 'Enter'){
      event.preventDefault();
      document.getElementById('apply-coordinate').click();
    }
  });

  function parseManualCoordinate(value){
    if(value === null || value === undefined) return NaN;

    var text = String(value).trim().replace(/\s+/g,'');
    if(!text) return NaN;

    if(text.indexOf(',') !== -1 && text.indexOf('.') === -1){
      text = text.replace(',','.');
    }else{
      text = text.replace(/,/g,'');
    }

    var number = Number(text);
    return Number.isFinite(number) ? number : NaN;
  }


  document.querySelectorAll('input[name="areaMethod"]').forEach(function(input){
    input.addEventListener('change',function(){
      areaMethod = this.value;
      resetGeometry();
      document.getElementById('draw-area-tools').hidden = areaMethod !== 'draw';
      document.getElementById('kml-area-tools').hidden = areaMethod !== 'kml';
      document.getElementById('geometry-help').textContent =
        areaMethod === 'draw'
          ? 'Klik Mulai Gambar Poligon, lalu tentukan minimal tiga sudut area.'
          : 'Upload KML, KMZ, atau GeoJSON yang berisi Polygon atau MultiPolygon.';
      setTimeout(function(){ map.invalidateSize(true); },120);
    });
  });

  document.getElementById('spatial-file').addEventListener('change',async function(){
    var file = this.files && this.files[0];
    var fileStatus = document.getElementById('kml-status');
    var removeButton = document.getElementById('remove-spatial');

    if(!file){
      fileStatus.textContent = 'Belum ada file spasial dipilih.';
      removeButton.hidden = true;
      return;
    }

    var extension = file.name.split('.').pop().toLowerCase();

    if(['kml','kmz','geojson','json'].indexOf(extension) === -1){
      fileStatus.textContent = 'Format harus KML, KMZ, GeoJSON, atau JSON.';
      fileStatus.className = 'kml-status error';
      this.value = '';
      return;
    }

    fileStatus.textContent = 'Membaca file ' + file.name + '...';
    fileStatus.className = 'kml-status';
    removeButton.hidden = true;

    try{
      var geometry;

      if(extension === 'kml'){
        geometry = await readKmlFile(file);
      }else if(extension === 'kmz'){
        geometry = await readKmzFile(file);
      }else{
        geometry = await readGeoJsonFile(file);
      }

      if(!geometry){
        throw new Error('File tidak memiliki Polygon atau MultiPolygon.');
      }

      setAreaGeometry(geometry);

      var count = geometry.type === 'MultiPolygon'
        ? geometry.coordinates.length
        : 1;

      fileStatus.textContent =
        file.name + ' berhasil dibaca: ' + count + ' area.';
      fileStatus.className = 'kml-status success';
      removeButton.hidden = false;
    }catch(error){
      console.error(error);
      resetGeometry();
      fileStatus.textContent = error.message || 'File gagal diproses.';
      fileStatus.className = 'kml-status error';
      removeButton.hidden = true;
    }
  });

  function readFileAsText(file){
    return new Promise(function(resolve,reject){
      var reader = new FileReader();
      reader.onerror = function(){ reject(new Error('File tidak dapat dibaca.')); };
      reader.onload = function(event){ resolve(event.target.result); };
      reader.readAsText(file);
    });
  }

  function readFileAsArrayBuffer(file){
    return new Promise(function(resolve,reject){
      var reader = new FileReader();
      reader.onerror = function(){ reject(new Error('File tidak dapat dibaca.')); };
      reader.onload = function(event){ resolve(event.target.result); };
      reader.readAsArrayBuffer(file);
    });
  }

  async function readKmlFile(file){
    var text = await readFileAsText(file);
    return geometryFromKmlText(text);
  }

  async function readKmzFile(file){
    if(typeof JSZip === 'undefined'){
      throw new Error('Pustaka pembaca KMZ belum dimuat.');
    }

    var buffer = await readFileAsArrayBuffer(file);
    var zip = await JSZip.loadAsync(buffer);
    var kmlNames = Object.keys(zip.files).filter(function(name){
      return /\.kml$/i.test(name) && !zip.files[name].dir;
    });

    if(!kmlNames.length){
      throw new Error('KMZ tidak berisi file KML.');
    }

    var preferred = kmlNames.find(function(name){
      return /(^|\/)doc\.kml$/i.test(name);
    }) || kmlNames[0];

    var kmlText = await zip.files[preferred].async('text');
    return geometryFromKmlText(kmlText);
  }

  async function readGeoJsonFile(file){
    var text = await readFileAsText(file);
    var data;

    try{
      data = JSON.parse(text);
    }catch(error){
      throw new Error('GeoJSON/JSON tidak valid.');
    }

    return extractAreaGeometry(normalizeToFeatureCollection(data));
  }

  function geometryFromKmlText(text){
    if(typeof toGeoJSON === 'undefined' || !toGeoJSON.kml){
      throw new Error('Pustaka pembaca KML belum dimuat.');
    }

    var xml = new DOMParser().parseFromString(text,'text/xml');

    if(xml.querySelector('parsererror')){
      throw new Error('Struktur XML/KML tidak valid.');
    }

    return extractAreaGeometry(toGeoJSON.kml(xml));
  }

  function normalizeToFeatureCollection(data){
    if(!data) return null;

    if(data.type === 'FeatureCollection'){
      return data;
    }

    if(data.type === 'Feature'){
      return {
        type:'FeatureCollection',
        features:[data]
      };
    }

    if(data.type && data.coordinates){
      return {
        type:'FeatureCollection',
        features:[{
          type:'Feature',
          properties:{},
          geometry:data
        }]
      };
    }

    return null;
  }

  document.getElementById('remove-spatial').addEventListener('click',function(){
    document.getElementById('spatial-file').value = '';
    document.getElementById('kml-status').textContent = 'Belum ada file spasial dipilih.';
    document.getElementById('kml-status').className = 'kml-status';
    this.hidden = true;
    resetGeometry();
  });

  function extractAreaGeometry(featureCollection){
    if(!featureCollection || !Array.isArray(featureCollection.features)){
      return null;
    }

    var polygons = [];

    featureCollection.features.forEach(function(feature){
      if(!feature || !feature.geometry) return;
      var geometry = feature.geometry;

      if(geometry.type === 'Polygon'){
        polygons.push(geometry.coordinates);
      }else if(geometry.type === 'MultiPolygon'){
        geometry.coordinates.forEach(function(polygon){
          polygons.push(polygon);
        });
      }else if(geometry.type === 'GeometryCollection'){
        (geometry.geometries || []).forEach(function(child){
          if(child.type === 'Polygon'){
            polygons.push(child.coordinates);
          }else if(child.type === 'MultiPolygon'){
            child.coordinates.forEach(function(polygon){
              polygons.push(polygon);
            });
          }
        });
      }
    });

    if(!polygons.length) return null;

    return polygons.length === 1
      ? {type:'Polygon',coordinates:polygons[0]}
      : {type:'MultiPolygon',coordinates:polygons};
  }

  function setAreaGeometry(geometry){
    resetGeometry();
    geometryGeoJSON = geometry;
    geometryType = geometry.type;

    kmlLayer = L.geoJSON({
      type:'Feature',
      properties:{},
      geometry:geometry
    },{
      style:{
        color:'#7b1fa2',
        weight:3,
        fillColor:'#9c4dcc',
        fillOpacity:0.25
      }
    }).addTo(map);

    var bounds = kmlLayer.getBounds();
    if(bounds && bounds.isValid()){
      map.fitBounds(bounds,{padding:[24,24],maxZoom:16});
    }

    updateGeometrySummary();
  }

  document.getElementById('start-polygon').addEventListener('click',function(){
    if(areaMethod !== 'draw') return;
    resetGeometry();

    polygonDrawer = new L.Draw.Polygon(map,{
      allowIntersection:false,
      showArea:true,
      shapeOptions:{
        color:'#7b1fa2',
        weight:3,
        fillColor:'#9c4dcc',
        fillOpacity:0.25
      }
    });
    polygonDrawer.enable();
  });

  document.getElementById('clear-geometry').addEventListener('click',resetGeometry);

  map.on(L.Draw.Event.CREATED,function(event){
    resetGeometry();
    polygonLayer = event.layer.addTo(map);
    geometryGeoJSON = polygonLayer.toGeoJSON().geometry;
    geometryType = geometryGeoJSON.type;
    updateGeometrySummary();
    map.fitBounds(polygonLayer.getBounds(),{padding:[24,24]});
  });

  function resetGeometry(){
    if(marker){
      map.removeLayer(marker);
      marker = null;
    }
    if(polygonLayer){
      map.removeLayer(polygonLayer);
      polygonLayer = null;
    }
    if(kmlLayer){
      map.removeLayer(kmlLayer);
      kmlLayer = null;
    }
    geometryGeoJSON = null;
    document.getElementById('latitude').value = '';
    document.getElementById('longitude').value = '';
    updateGeometrySummary();
  }

  function updateGeometrySummary(){
    var el = document.getElementById('geometry-summary');
    el.className = 'geometry-summary';

    if(!geometryGeoJSON){
      if(geometryType === 'Polygon'){
        el.textContent = 'Belum ada poligon digambar.';
      }else if(geometryType === 'ExistingFeature'){
        el.textContent = 'Belum ada objek WebGIS dipilih.';
      }else{
        el.textContent = 'Belum ada titik dipilih.';
      }
      return;
    }

    if(geometryGeoJSON.type === 'Point'){
      el.textContent = 'Titik tersimpan: ' +
        geometryGeoJSON.coordinates[1].toFixed(7) + ', ' +
        geometryGeoJSON.coordinates[0].toFixed(7);
      el.classList.add('valid');
    }else if(geometryGeoJSON.type === 'Polygon'){
      var vertices = geometryGeoJSON.coordinates[0].length - 1;
      el.textContent = 'Poligon tersimpan dengan ' + vertices + ' sudut.';
      el.classList.add('valid');
    }else if(geometryGeoJSON.type === 'MultiPolygon'){
      el.textContent = 'MultiPolygon tersimpan dengan ' +
        geometryGeoJSON.coordinates.length + ' area.';
      el.classList.add('valid');
    }else if(geometryType === 'ExistingFeature' || selectedCorrectionFeature){
      el.textContent = 'Objek WebGIS tersimpan: ' + geometryGeoJSON.type + '.';
      el.classList.add('valid');
    }
  }

  function renderPhotoPreview(){
    preview.innerHTML = '';

    compressedImages.forEach(function(photo,index){
      var figure = document.createElement('figure');
      var image = document.createElement('img');
      var caption = document.createElement('small');
      var removeButton = document.createElement('button');

      image.src = photo.dataUrl;
      image.alt = photo.name || ('Foto ' + (index + 1));

      caption.textContent =
        'Foto ' + (index + 1) +
        (photo.name ? ' · ' + photo.name : '');

      removeButton.type = 'button';
      removeButton.className = 'remove-preview-photo';
      removeButton.setAttribute('aria-label','Hapus foto ' + (index + 1));
      removeButton.textContent = '×';

      removeButton.addEventListener('click',function(){
        compressedImages.splice(index,1);
        renderPhotoPreview();
      });

      figure.appendChild(image);
      figure.appendChild(caption);
      figure.appendChild(removeButton);
      preview.appendChild(figure);
    });

    if(compressedImages.length){
      statusText.textContent =
        compressedImages.length +
        ' dari 5 foto siap dikirim. Anda dapat memilih foto lagi.';
    }else{
      statusText.textContent = '';
    }
  }

  imageInput.addEventListener('change',async function(){
    var selectedFiles = Array.from(this.files || []);
    var availableSlots = Math.max(0,5 - compressedImages.length);
    var files = selectedFiles.slice(0,availableSlots);

    if(!availableSlots){
      statusText.textContent =
        'Maksimal 5 foto. Hapus salah satu foto untuk menggantinya.';
      this.value = '';
      return;
    }

    if(!files.length){
      this.value = '';
      return;
    }

    setImagesProcessing(true);
    statusText.textContent =
      'Memproses ' + files.length + ' foto...';

    try{
      for(var i=0;i<files.length;i++){
        try{
          var dataUrl = await compressImage(files[i],1400,0.72);

          compressedImages.push({
            name:files[i].name,
            type:'image/jpeg',
            dataUrl:dataUrl
          });
        }catch(error){
          console.error(error);
          statusText.textContent =
            'Salah satu foto gagal diproses. Silakan pilih ulang.';
        }
      }
    }finally{
      setImagesProcessing(false);
    }

    /*
      Kosongkan input agar pengguna smartphone bisa menekan
      "Pilih Foto" lagi dan menambahkan foto berikutnya.
      Foto yang sudah diproses tetap tersimpan di compressedImages.
    */
    this.value = '';

    if(selectedFiles.length > availableSlots){
      statusText.textContent =
        'Hanya ' + availableSlots +
        ' foto yang ditambahkan karena batas maksimal 5 foto.';
    }else{
      renderPhotoPreview();
    }
  });

  function monitoringValue(id){
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function collectMonitoringData(){
    return {
      monitoringType:monitoringValue('monitoring-type'),
      condition:monitoringValue('monitoring-condition'),
      survivalPercent:monitoringValue('monitoring-survival'),
      aliveCount:monitoringValue('monitoring-alive'),
      deadOrDamagedCount:monitoringValue('monitoring-dead'),
      monitoredAreaHa:monitoringValue('monitoring-area'),
      averageHeightCm:monitoringValue('monitoring-height'),
      averageDiameterCm:monitoringValue('monitoring-diameter'),
      sedimentationCm:monitoringValue('monitoring-sediment'),
      waterTableCm:monitoringValue('monitoring-water-table'),
      floatCondition:monitoringValue('monitoring-float-condition'),
      weather:monitoringValue('monitoring-weather'),
      rainLast24Hours:monitoringValue('monitoring-rain'),
      siteWetness:monitoringValue('monitoring-site-wetness'),
      fireRisk:monitoringValue('monitoring-fire-risk'),
      functionStatus:monitoringValue('monitoring-function'),
      monitoredLength:monitoringValue('monitoring-length'),
      threats:monitoringValue('monitoring-threats'),
      notes:monitoringValue('monitoring-notes'),
      followUp:monitoringValue('monitoring-follow-up')
    };
  }

  function collectReplantingData(){
    return {
      activityType:'Replanting/Penyulaman Mangrove',
      replantedCount:monitoringValue('replanting-count'),
      species:monitoringValue('replanting-species'),
      replantedAreaHa:monitoringValue('replanting-area'),
      reason:monitoringValue('replanting-reason'),
      notes:monitoringValue('replanting-notes'),
      photoStages:['BEFORE','AFTER']
    };
  }

  function updateMonitoringPanels(){
    var type = monitoringValue('monitoring-type');
    var mangrove = document.getElementById('monitoring-mangrove-fields');
    var fdrs = document.getElementById('monitoring-fdrs-fields');
    var infra = document.getElementById('monitoring-infrastructure-fields');
    if(mangrove) mangrove.hidden = ['Penanaman Mangrove','Hutan Mangrove','Restorasi Hutan','Restorasi Gambut','Pembibitan','Agroforestri/Kopi'].indexOf(type) === -1;
    if(fdrs) fdrs.hidden = type !== 'Tinggi Muka Air/FDRS';
    if(infra) infra.hidden = ['Sekat Kanal','APO'].indexOf(type) === -1;
  }

  var monitoringTypeSelect = document.getElementById('monitoring-type');
  if(monitoringTypeSelect){
    monitoringTypeSelect.addEventListener('change',updateMonitoringPanels);
  }

  var waterTableInput = document.getElementById('monitoring-water-table');
  if(waterTableInput){
    waterTableInput.addEventListener('input',function(){
      var preview = document.getElementById('water-table-preview');
      var n = Number(this.value);
      preview.className = 'water-table-preview';
      if(this.value === '' || !isFinite(n)){
        preview.textContent = 'Masukkan tinggi muka air untuk melihat status otomatis.';
      }else if(n >= -20){
        preview.textContent = 'Status otomatis: Sangat basah.';
        preview.classList.add('wet');
      }else if(n >= -40){
        preview.textContent = 'Status otomatis: Perlu dipantau.';
        preview.classList.add('normal');
      }else{
        preview.textContent = 'Status otomatis: Waspada kering.';
        preview.classList.add('dry');
      }
    });
  }

  form.addEventListener('submit',function(event){
    event.preventDefault();

    if(imagesProcessing){
      alert('Foto masih diproses. Tunggu sampai muncul tulisan foto siap dikirim.');
      imageInput.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }

    if(!selectedType){
      alert('Pilih jenis laporan.');
      return;
    }

    if(selectedType === 'Area/Poligon Baru'){
      if(
        !geometryGeoJSON ||
        ['Polygon','MultiPolygon'].indexOf(geometryGeoJSON.type) === -1
      ){
        alert('Gambar poligon atau upload KML/KMZ/GeoJSON area terlebih dahulu.');
        return;
      }
    }else if(pointTypes.indexOf(selectedType) !== -1){
      if(!geometryGeoJSON || geometryGeoJSON.type !== 'Point'){
        alert('Tentukan titik lokasi terlebih dahulu.');
        return;
      }
    }

    if(existingFeatureTypes.indexOf(selectedType) !== -1){
      if(!selectedCorrectionFeature || !geometryGeoJSON){
        alert('Pilih titik atau poligon WebGIS terlebih dahulu.');
        return;
      }
    }

    if(selectedType === 'Perbaikan Informasi'){
      var proposedChanges = collectProposedChanges();

      if(!Object.keys(proposedChanges).length){
        alert('Isi minimal satu nilai atribut baru.');
        return;
      }

      if(!document.getElementById('proposed-information').value.trim()){
        alert('Isi catatan atau alasan perbaikan.');
        return;
      }
    }

    if(selectedType === 'Monitoring'){
      var monitorDataValidation = collectMonitoringData();
      if(!monitorDataValidation.monitoringType){
        alert('Pilih jenis monitoring.');
        return;
      }
      if(!monitorDataValidation.condition){
        alert('Pilih kondisi umum objek.');
        return;
      }
      if(!monitorDataValidation.notes){
        alert('Isi temuan monitoring.');
        return;
      }
      if(monitorDataValidation.monitoringType === 'Tinggi Muka Air/FDRS'){
        if(monitorDataValidation.waterTableCm === ''){
          alert('Isi tinggi muka air hasil pembacaan water table pelampung.');
          return;
        }
        if(!monitorDataValidation.floatCondition){
          alert('Pilih kondisi water table pelampung.');
          return;
        }
      }
    }

    if(selectedType === 'Replanting/Penyulaman Mangrove'){
      var replantingDataValidation = collectReplantingData();
      if(
        !replantingDataValidation.replantedCount ||
        Number(replantingDataValidation.replantedCount) < 1
      ){
        alert('Isi jumlah bibit replanting minimal 1 bibit.');
        return;
      }
      if(!replantingDataValidation.species){
        alert('Isi jenis mangrove atau bibit yang digunakan.');
        return;
      }
      if(
        !replantingDataValidation.replantedAreaHa ||
        Number(replantingDataValidation.replantedAreaHa) <= 0
      ){
        alert('Isi luas area replanting lebih dari 0 ha.');
        return;
      }
      if(!replantingDataValidation.reason){
        alert('Pilih penyebab replanting.');
        return;
      }
      if(!replantingDataValidation.notes){
        alert('Isi catatan pelaksanaan replanting.');
        return;
      }
      if(
        !selectedCorrectionFeature ||
        selectedCorrectionFeature.layerId !== 'area_mangrove'
      ){
        alert('Replanting harus terhubung ke objek pada layer Area Penanaman Mangrove.');
        return;
      }
      if(compressedImages.length < 2){
        alert('Replanting wajib memiliki minimal dua foto: BEFORE (sebelum) dan AFTER (sesudah).');
        imageInput.scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }
    }

    if(
      photoRequiredTypes.indexOf(selectedType) !== -1 &&
      compressedImages.length < 1
    ){
      alert(
        'Jenis laporan ' + selectedType +
        ' wajib memiliki minimal satu foto yang sudah siap dikirim.'
      );
      imageInput.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }

    if(
      selectedType === 'Tambah Foto Kegiatan' &&
      selectedCorrectionFeature &&
      selectedCorrectionFeature.layerId === 'area_mangrove' &&
      compressedImages.length < 2
    ){
      alert(
        'Tambah Foto Area Penanaman Mangrove wajib memiliki minimal dua foto: ' +
        'BEFORE (sebelum) dan AFTER (sesudah).'
      );
      imageInput.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }

    var payload = {
      reportType:selectedType,
      name:value('name'),
      organization:value('organization'),
      email:value('email'),
      phone:value('phone'),
      province:value('province'),
      regency:value('regency'),
      district:value('district'),
      village:value('village'),
      locationName:value('location-name'),
      latitude:value('latitude'),
      longitude:value('longitude'),
      title:value('title'),
      activityDate:value('activity-date'),
      description:value('description'),
      oldInformation:value('old-information'),
      proposedInformation:selectedType === 'Monitoring'
        ? JSON.stringify(collectMonitoringData())
        : selectedType === 'Replanting/Penyulaman Mangrove'
          ? JSON.stringify(collectReplantingData())
          : value('proposed-information'),
      documentUrl:value('document-url'),
      geometryType:geometryGeoJSON ? geometryGeoJSON.type : '',
      geometryGeoJSON:geometryGeoJSON ? JSON.stringify(geometryGeoJSON) : '',
      targetLayerId:selectedCorrectionFeature
        ? selectedCorrectionFeature.layerId
        : '',
      targetLayerLabel:selectedCorrectionFeature
        ? selectedCorrectionFeature.layerLabel
        : '',
      targetSourceType:selectedCorrectionFeature
        ? selectedCorrectionFeature.sourceType
        : '',
      targetObjectId:selectedCorrectionFeature
        ? selectedCorrectionFeature.objectId
        : '',
      targetFeatureProperties:selectedCorrectionFeature
        ? JSON.stringify(selectedCorrectionFeature.feature.properties || {})
        : '',
      proposedChanges:selectedType === 'Perbaikan Informasi'
        ? JSON.stringify(collectProposedChanges())
        : selectedType === 'Monitoring'
          ? JSON.stringify({monitoring:collectMonitoringData()})
          : selectedType === 'Replanting/Penyulaman Mangrove'
            ? JSON.stringify({replanting:collectReplantingData()})
            : '',
      images:compressedImages
    };

    document.getElementById('payload').value = JSON.stringify(payload);
    submitButton.disabled = true;
    submitButton.textContent = 'Mengirim...';
    statusText.textContent = 'Mohon tunggu. Data dan foto sedang dikirim.';
    submissionStarted = true;
    form.submit();
  });

  submitFrame.addEventListener('load',function(){
    if(!submissionStarted) return;

    setTimeout(function(){
      form.hidden = true;
      success.hidden = false;
      success.scrollIntoView({behavior:'smooth',block:'start'});
      submissionStarted = false;
    },600);
  });

  var requestedType = new URLSearchParams(window.location.search).get('type');
  if(requestedType && requestedType.toLowerCase() === 'monitoring'){
    var monitoringRadio = document.querySelector('input[name="reportTypeUI"][value="Monitoring"]');
    if(monitoringRadio){
      monitoringRadio.checked = true;
      selectedType = 'Monitoring';
      configureFormByType('Monitoring');
    }
  }

  document.getElementById('send-another').addEventListener('click',function(){
    form.reset();
    selectedType = '';
    geometryType = '';
    compressedImages = [];
    preview.innerHTML = '';
    resetGeometry();
    document.getElementById('geometry-section').hidden = true;
    document.getElementById('existing-feature-fields').hidden = true;
    clearSelectedCorrectionFeature();
    if(correctionLayerGroup){
      map.removeLayer(correctionLayerGroup);
      correctionLayerGroup = null;
    }
    document.getElementById('correction-layer').value = '';
    document.getElementById('spatial-file').value = '';
    document.getElementById('kml-status').textContent =
      'Belum ada file spasial dipilih.';
    document.getElementById('kml-status').className = 'kml-status';
    document.getElementById('remove-spatial').hidden = true;
    document.getElementById('type-guidance').textContent =
      'Pilih jenis laporan untuk menampilkan isian yang sesuai.';
    statusText.textContent = '';
    submitButton.disabled = false;
    submitButton.textContent = 'Kirim Laporan';
    form.hidden = false;
    success.hidden = true;
    window.scrollTo({top:0,behavior:'smooth'});
  });

  function value(id){
    return document.getElementById(id).value.trim();
  }

  function compressImage(file,maxDimension,quality){
    return new Promise(function(resolve,reject){
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function(){
        var image = new Image();
        image.onerror = reject;
        image.onload = function(){
          var scale = Math.min(1,maxDimension/Math.max(image.width,image.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(image.width*scale);
          canvas.height = Math.round(image.height*scale);
          canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
          resolve(canvas.toDataURL('image/jpeg',quality));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  setTimeout(function(){ map.invalidateSize(true); },250);
})();
