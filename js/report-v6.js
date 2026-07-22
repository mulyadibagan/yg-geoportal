
(function(){
  'use strict';

  var COMMUNITY_LAYER_ID = 'community_reports';
  var COMMUNITY_LAYER_LABEL = 'Laporan Masyarakat Terverifikasi';
  var COMMUNITY_LAYER_COLOR = '#7b1fa2';
  var COMMUNITY_API = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=public-reports';
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
  var capacityDocumentInput = document.getElementById('capacity-documents');
  var capacityDocumentList = document.getElementById('capacity-document-list');
  var capacityDocuments = [];
  var capacityDocumentsProcessing = false;
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
  var deepLinkSelectionPending = Boolean(
    new URLSearchParams(window.location.search).get('object')
  );
  var reverseGeocodeTimer = null;
  var reverseGeocodeSequence = 0;

  var pointTypes = [
    'Titik Baru','Kebakaran','Abrasi','Biodiversitas','Capacity Building'
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
    'Monitoring',
    'Replanting/Penyulaman Mangrove',
    'Kebakaran',
    'Abrasi',
    'Biodiversitas',
    'Capacity Building'
  ];

  function setImagesProcessing(processing){
    imagesProcessing = Boolean(processing);
    if(imagesProcessing){
      submitButton.disabled = true;
      submitButton.textContent = 'Memproses foto...';
    }else if(!capacityDocumentsProcessing && !submissionStarted){
      submitButton.disabled = false;
      submitButton.textContent = 'Kirim Laporan';
    }
  }

  function setCapacityDocumentsProcessing(processing){
    capacityDocumentsProcessing = Boolean(processing);
    if(capacityDocumentsProcessing){
      submitButton.disabled = true;
      submitButton.textContent = 'Memproses PDF...';
    }else if(!imagesProcessing && !submissionStarted){
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
    var capacityFields = document.getElementById('capacity-building-fields');
    if(capacityFields) capacityFields.hidden = type !== 'Capacity Building';
    var documentLabel = document.getElementById('document-label');
    var documentHelp = document.getElementById('document-help');
    var documentUrl = document.getElementById('document-url');
    if(documentLabel) documentLabel.textContent =
      'Tautan dokumen pendukung (opsional)';
    if(documentHelp) documentHelp.textContent =
      'Gunakan jika dokumen sudah tersedia melalui tautan publik.';
    if(documentUrl) documentUrl.placeholder = type === 'Capacity Building'
      ? 'Tautan Google Drive atau PDF materi pelatihan'
      : 'Tautan Google Drive atau PDF';
    var newObjectDonorFields = document.getElementById('new-object-donor-fields');
    var donorInput = document.getElementById('donor');
    var needsNewObjectDonor =
      type === 'Titik Baru' || type === 'Area/Poligon Baru';
    if(newObjectDonorFields) newObjectDonorFields.hidden = !needsNewObjectDonor;
    if(donorInput) donorInput.required = needsNewObjectDonor;
    var replantingFields = document.getElementById('replanting-fields');
    if(replantingFields) replantingFields.hidden =
      type !== 'Replanting/Penyulaman Mangrove';
    var photoSection = document.getElementById('photo-section');
    var isNewArea = type === 'Area/Poligon Baru';
    if(photoSection) photoSection.hidden = isNewArea;
    if(isNewArea && compressedImages.length){
      compressedImages = [];
      imageInput.value = '';
      renderPhotoPreview();
      setImagesProcessing(false);
    }
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
        : type === 'Capacity Building'
          ? 'Tentukan titik lokasi pelatihan atau kegiatan peningkatan kapasitas.'
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
        ? 'Layer operasional tampil otomatis. Klik objek WebGIS yang akan menerima foto baru.'
        : type === 'Replanting/Penyulaman Mangrove'
          ? 'Area Penanaman Mangrove tampil otomatis. Klik polygon, isi data penyulaman, lalu unggah foto BEFORE dan AFTER.'
        : type === 'Monitoring'
          ? 'Area Penanaman Mangrove tampil otomatis. Klik polygon yang akan dimonitor.'
          : 'Layer operasional tampil otomatis. Klik titik, garis, atau poligon yang informasinya ingin diperbaiki.';

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
          if(this.value === '__all_operational__'){
            loadAllCorrectionLayers();
          }else{
            loadCorrectionLayer(this.value);
          }
        });

      document.getElementById('clear-selected-feature')
        .addEventListener('click',function(){
          clearSelectedCorrectionFeature();
        });

      document.getElementById('open-object-picker')
        .addEventListener('click',function(){
          if(
            selectedType === 'Monitoring' ||
            selectedType === 'Replanting/Penyulaman Mangrove'
          ){
            document.getElementById('correction-layer').value =
              'area_mangrove';
            loadCorrectionLayer('area_mangrove');
          }else{
            document.getElementById('correction-layer').value =
              '__all_operational__';
            loadAllCorrectionLayers();
          }
        });

      document.getElementById('load-layer-only')
        .addEventListener('click',function(){
          var selectedLayerId =
            document.getElementById('correction-layer').value;
          if(!selectedLayerId){
            alert('Pilih layer yang ingin dimuat.');
            return;
          }
          if(selectedLayerId === '__all_operational__'){
            loadAllCorrectionLayers();
          }else{
            loadCorrectionLayer(selectedLayerId);
          }
        });
    }

    if(deepLinkSelectionPending){
      setTimeout(function(){ map.invalidateSize(true); },180);
      return;
    }

    if(
      selectedType === 'Monitoring' ||
      selectedType === 'Replanting/Penyulaman Mangrove'
    ){
      document.getElementById('correction-layer').value = 'area_mangrove';
      loadCorrectionLayer('area_mangrove');
    }else{
      document.getElementById('correction-layer').value =
        '__all_operational__';
      loadAllCorrectionLayers();
    }

    setTimeout(function(){ map.invalidateSize(true); },180);
  }

  function populateCorrectionLayerOptions(){
    var select = document.getElementById('correction-layer');
    if(select.options.length > 1) return;

    var config = window.YG_LAYER_CONFIG || [];

    var allOption = document.createElement('option');
    allOption.value = '__all_operational__';
    allOption.textContent = 'Semua layer operasional';
    select.appendChild(allOption);

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

  async function loadCorrectionLayer(layerId, preferredObjectId){
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

      var preferredSelection = null;
      var normalizedPreferredObjectId = String(
        preferredObjectId || ''
      ).trim();

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
          var featureProperties = feature && feature.properties
            ? feature.properties
            : {};
          var directObjectId = String(
            featureProperties.Object_ID ||
            featureProperties.objectId ||
            featureProperties.OBJECTID ||
            featureProperties.ID ||
            ''
          ).trim();
          var generatedObjectId = makeObjectId(feature,config);

          if(
            normalizedPreferredObjectId &&
            (
              directObjectId === normalizedPreferredObjectId ||
              generatedObjectId === normalizedPreferredObjectId
            )
          ){
            preferredSelection = {
              feature:feature,
              layer:layer
            };
          }

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

      if(preferredSelection){
        selectExistingFeature(
          preferredSelection.feature,
          preferredSelection.layer,
          config
        );
      }

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

  function operationalCorrectionConfigs(){
    var excluded = [
      'desa_intervensi',
      'titik_desa',
      'kawasan_hutan_sk_903'
    ];
    var configs = (window.YG_LAYER_CONFIG || []).filter(function(config){
      return config.visible !== false &&
        excluded.indexOf(config.id) === -1;
    });

    configs.push({
      id:COMMUNITY_LAYER_ID,
      label:COMMUNITY_LAYER_LABEL,
      color:COMMUNITY_LAYER_COLOR,
      type:'mixed',
      sourceType:'community_report'
    });
    return configs;
  }

  async function loadAllCorrectionLayers(){
    clearSelectedCorrectionFeature();

    if(correctionLayerGroup){
      map.removeLayer(correctionLayerGroup);
      correctionLayerGroup = null;
    }

    var summary = document.getElementById('selected-feature-summary');
    var pickerStatus = document.getElementById('object-picker-status');
    summary.className = 'selected-feature-summary';
    summary.textContent = 'Memuat semua layer operasional...';
    if(pickerStatus){
      pickerStatus.textContent =
        'Memuat layer operasional. Setelah tampil, klik objek pada peta.';
    }

    correctionLayerGroup = L.featureGroup().addTo(map);
    var loadedCount = 0;
    var failedLabels = [];

    await Promise.all(
      operationalCorrectionConfigs().map(async function(config){
        try{
          var data;
          if(config.id === COMMUNITY_LAYER_ID){
            data = await loadCommunityReports();
            data = {
              type:'FeatureCollection',
              features:(data.features || []).filter(function(feature){
                var properties = feature && feature.properties || {};
                var reportType = String(
                  properties.reportType || properties.Jenis_Laporan || ''
                ).trim().toLowerCase();
                return [
                  'monitoring',
                  'perbaikan informasi',
                  'tambah foto kegiatan'
                ].indexOf(reportType) === -1;
              })
            };
          }else{
            var dataPath =
              config.url ||
              config.dataUrl ||
              config.file ||
              ('data/' + config.id + '.geojson');
            var response = await fetch(dataPath,{cache:'no-store'});
            if(!response.ok){
              throw new Error(
                'HTTP ' + response.status + ' untuk ' + dataPath
              );
            }
            data = await response.json();
          }

          var layerGroup = L.geoJSON(data,{
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
          });

          layerGroup.addTo(correctionLayerGroup);
          loadedCount += 1;
        }catch(error){
          console.warn('Layer gagal dimuat:',config.id,error);
          failedLabels.push(config.label);
        }
      })
    );

    var bounds = correctionLayerGroup.getBounds();
    if(bounds && bounds.isValid()){
      map.fitBounds(bounds,{padding:[24,24],maxZoom:12});
    }

    if(!loadedCount){
      summary.className = 'selected-feature-summary error';
      summary.textContent = 'Semua layer operasional gagal dimuat.';
      if(pickerStatus){
        pickerStatus.textContent =
          'Layer belum dapat dimuat. Periksa koneksi internet.';
      }
      return;
    }

    summary.textContent =
      loadedCount +
      ' layer operasional dimuat. Klik objek yang ingin dipilih.';
    if(pickerStatus){
      pickerStatus.textContent =
        'Layer sudah tampil. Klik titik, garis, atau poligon yang diinginkan.' +
        (
          failedLabels.length
            ? ' Gagal dimuat: ' + failedLabels.join(', ') + '.'
            : ''
        );
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
      buildEditableAttributes(feature.properties || {},config.id);
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

  var coffeeEditableFields = [
    {
      key:'Jumlah_Tanam',
      label:'Jumlah tanaman kopi',
      type:'number',
      min:'0',
      step:'1',
      placeholder:'Masukkan jumlah tanaman kopi'
    },
    {
      key:'Pemilik_Lahan',
      label:'Pemilik lahan',
      type:'text',
      placeholder:'Masukkan nama pemilik atau pengelola lahan'
    },
    {
      key:'Luas_Lahan_Ha',
      label:'Luas lahan (ha)',
      type:'number',
      min:'0',
      step:'0.01',
      placeholder:'Contoh: 1.25'
    },
    {
      key:'Tumpang_Sari',
      label:'Jenis tumpang sari',
      type:'select',
      options:[
        ['','Pilih jenis tumpang sari'],
        ['Tidak Ada','Tidak ada'],
        ['Kelapa Sawit','Kelapa sawit'],
        ['Karet','Karet'],
        ['Tanaman Lain','Tanaman lain'],
        ['Campuran','Campuran']
      ]
    },
    {
      key:'Tanaman_Lain',
      label:'Tanaman lain',
      type:'text',
      placeholder:'Isi jika memilih Tanaman Lain atau Campuran'
    }
  ];

  function appendEditableAttributeRow(container,definition,currentValue){
    var row = document.createElement('div');
    row.className = 'editable-attribute-row';

    var oldBox = document.createElement('div');
    oldBox.className = 'editable-old-value';

    var label = document.createElement('strong');
    label.textContent = definition.label || definition.key;

    var oldValue = document.createElement('span');
    oldValue.textContent =
      currentValue !== null &&
      currentValue !== undefined &&
      String(currentValue).trim() !== ''
        ? String(currentValue)
        : 'Belum diisi';

    oldBox.appendChild(label);
    oldBox.appendChild(oldValue);

    var input;
    if(definition.type === 'select'){
      input = document.createElement('select');
      (definition.options || []).forEach(function(optionDefinition){
        var option = document.createElement('option');
        option.value = optionDefinition[0];
        option.textContent = optionDefinition[1];
        input.appendChild(option);
      });
    }else{
      input = document.createElement('input');
      input.type = definition.type || 'text';
      if(definition.min !== undefined) input.min = definition.min;
      if(definition.step !== undefined) input.step = definition.step;
      input.placeholder =
        definition.placeholder ||
        'Nilai baru (biarkan kosong jika tidak diubah)';
    }

    input.className = 'editable-new-value';
    input.dataset.attributeKey = definition.key;

    row.appendChild(oldBox);
    row.appendChild(input);
    container.appendChild(row);
  }

  function buildEditableAttributes(properties,layerId){
    var container = document.getElementById('editable-attributes');
    container.innerHTML = '';
    var isCoffeeLayer =
      layerId === 'kopi' ||
      layerId === 'area_kopi';
    var coffeeKeys = coffeeEditableFields.map(function(field){
      return field.key;
    });

    var keys = Object.keys(properties).filter(function(key){
      return isEditableAttribute(key,properties[key]) &&
        (!isCoffeeLayer || coffeeKeys.indexOf(key) === -1);
    });

    if(!keys.length && !isCoffeeLayer){
      container.innerHTML =
        '<div class="no-editable-attributes">Tidak ada atribut yang dapat diedit.</div>';
      return;
    }

    keys.forEach(function(key){
      appendEditableAttributeRow(
        container,
        {key:key,label:key,type:'text'},
        properties[key]
      );
    });

    if(isCoffeeLayer){
      coffeeEditableFields.forEach(function(field){
        appendEditableAttributeRow(
          container,
          field,
          properties[field.key]
        );
      });
    }
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

  function cleanAdministrativeName(value,prefixPattern){
    var result = String(value || '').trim();
    return prefixPattern ? result.replace(prefixPattern,'').trim() : result;
  }

  function scheduleAdministrationLookup(lat,lng){
    var status = document.getElementById('admin-location-status');
    clearTimeout(reverseGeocodeTimer);
    var sequence = ++reverseGeocodeSequence;
    if(status) status.textContent = 'Mengenali administrasi lokasi dari titik peta...';
    reverseGeocodeTimer = setTimeout(function(){
      var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2' +
        '&lat=' + encodeURIComponent(lat) +
        '&lon=' + encodeURIComponent(lng) +
        '&zoom=18&addressdetails=1&accept-language=id';
      fetch(url,{headers:{'Accept':'application/json'}})
        .then(function(response){
          if(!response.ok) throw new Error('Lokasi tidak ditemukan');
          return response.json();
        })
        .then(function(result){
          if(sequence !== reverseGeocodeSequence) return;
          var address = result.address || {};
          var province = address.state || address.province || '';
          var regency = address.city || address.county || address.municipality || '';
          var district = address.city_district || address.district || address.suburb || '';
          var village = address.village || address.town || address.hamlet || address.quarter || '';
          regency = cleanAdministrativeName(regency,/^(Kabupaten|Kota)\s+/i);
          district = cleanAdministrativeName(district,/^Kecamatan\s+/i);
          village = cleanAdministrativeName(village,/^(Desa|Kelurahan)\s+/i);
          if(province) document.getElementById('province').value = province;
          if(regency) document.getElementById('regency').value = regency;
          if(district) document.getElementById('district').value = district;
          if(village) document.getElementById('village').value = village;
          if(status){
            status.textContent = (regency || district || village)
              ? 'Administrasi lokasi diperbarui otomatis. Silakan periksa sebelum mengirim.'
              : 'Koordinat tersimpan, tetapi administrasi belum dikenali. Silakan isi manual.';
          }
        })
        .catch(function(){
          if(sequence !== reverseGeocodeSequence) return;
          if(status) status.textContent = 'Koordinat tersimpan, tetapi administrasi belum dapat dikenali. Silakan isi manual.';
        });
    },400);
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
    scheduleAdministrationLookup(lat,lng);
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

    /* Sembunyikan hasil pengiriman sebelumnya ketika laporan baru diedit. */
    success.hidden = true;
    setImagesProcessing(true);

    try{
      for(var i=0;i<files.length;i++){
        statusText.textContent =
          'Memproses foto ' + (i + 1) + ' dari ' + files.length + '...';

        /* Beri browser kesempatan menggambar status sebelum pekerjaan foto. */
        await yieldToBrowser();

        try{
          var dataUrl = await compressImage(files[i],1280,0.7);

          compressedImages.push({
            name:files[i].name,
            type:'image/jpeg',
            dataUrl:dataUrl
          });

          /* Hindari beberapa foto besar diproses dalam satu frame panjang. */
          await yieldToBrowser();
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

  function formatFileSize(bytes){
    if(bytes < 1024 * 1024) return Math.ceil(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function readFileAsDataUrl(file){
    return new Promise(function(resolve,reject){
      var reader = new FileReader();
      reader.onload = function(){ resolve(reader.result); };
      reader.onerror = function(){ reject(new Error('PDF gagal dibaca.')); };
      reader.readAsDataURL(file);
    });
  }

  function renderCapacityDocuments(){
    if(!capacityDocumentList) return;
    capacityDocumentList.innerHTML = '';
    capacityDocuments.forEach(function(documentFile,index){
      var item = document.createElement('div');
      var name = document.createElement('strong');
      var remove = document.createElement('button');
      item.className = 'capacity-document-item';
      name.textContent = documentFile.name + ' · ' + formatFileSize(documentFile.size);
      remove.type = 'button';
      remove.textContent = 'Hapus';
      remove.addEventListener('click',function(){
        capacityDocuments.splice(index,1);
        renderCapacityDocuments();
      });
      item.appendChild(name);
      item.appendChild(remove);
      capacityDocumentList.appendChild(item);
    });
  }

  if(capacityDocumentInput){
    capacityDocumentInput.addEventListener('change',async function(){
      var files = Array.from(this.files || []);
      var accepted = [];
      var currentBytes = capacityDocuments.reduce(function(total,item){
        return total + Number(item.size || 0);
      },0);

      files.forEach(function(file){
        var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        if(!isPdf){ alert(file.name + ' bukan file PDF.'); return; }
        if(file.size > 8 * 1024 * 1024){
          alert(file.name + ' melebihi batas 8 MB.'); return;
        }
        if(capacityDocuments.length + accepted.length >= 10) return;
        if(currentBytes + file.size > 25 * 1024 * 1024){
          alert('Total PDF tidak boleh melebihi 25 MB.'); return;
        }
        currentBytes += file.size;
        accepted.push(file);
      });

      if(files.length > accepted.length && capacityDocuments.length + accepted.length >= 10){
        alert('Maksimal 10 PDF untuk satu kegiatan.');
      }
      if(!accepted.length){ this.value = ''; return; }

      setCapacityDocumentsProcessing(true);
      try{
        for(var i=0;i<accepted.length;i++){
          var file = accepted[i];
          var dataUrl = await readFileAsDataUrl(file);
          capacityDocuments.push({
            name:file.name,
            type:'application/pdf',
            mimeType:'application/pdf',
            size:file.size,
            dataUrl:dataUrl
          });
          renderCapacityDocuments();
          await yieldToBrowser();
        }
      }catch(error){
        alert(error.message || 'PDF gagal diproses.');
      }finally{
        setCapacityDocumentsProcessing(false);
        this.value = '';
      }
    });
  }

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

  function collectCapacityBuildingData(){
    var male = Number(monitoringValue('capacity-male') || 0);
    var female = Number(monitoringValue('capacity-female') || 0);
    var youthMale = Number(monitoringValue('capacity-youth-male') || 0);
    var youthFemale = Number(monitoringValue('capacity-youth-female') || 0);
    return {
      maleParticipants:male,
      femaleParticipants:female,
      totalParticipants:male + female,
      youthMale:youthMale,
      youthFemale:youthFemale,
      youthTotal:youthMale + youthFemale,
      youthAgeRange:monitoringValue('capacity-youth-age'),
      communityGroup:monitoringValue('capacity-group'),
      participantTarget:monitoringValue('capacity-target'),
      partnerOrResourcePerson:monitoringValue('capacity-partner'),
      topic:monitoringValue('capacity-topic'),
      youthRole:monitoringValue('capacity-youth-role')
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

    if(imagesProcessing || capacityDocumentsProcessing){
      alert('Foto atau PDF masih diproses. Tunggu sampai semua file siap dikirim.');
      (capacityDocumentsProcessing ? capacityDocumentInput : imageInput)
        .scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }

    if(!selectedType){
      alert('Pilih jenis laporan.');
      return;
    }

    var isNewObjectReport =
      selectedType === 'Titik Baru' ||
      selectedType === 'Area/Poligon Baru';
    var newObjectDonor = value('donor');
    if(isNewObjectReport && !newObjectDonor){
      alert('Isi mitra pendanaan/donor untuk objek baru.');
      document.getElementById('donor').scrollIntoView({
        behavior:'smooth',
        block:'center'
      });
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

      if(
        selectedCorrectionFeature &&
        (
          selectedCorrectionFeature.layerId === 'kopi' ||
          selectedCorrectionFeature.layerId === 'area_kopi'
        )
      ){
        if(
          proposedChanges.Jumlah_Tanam !== undefined &&
          (
            !Number.isInteger(Number(proposedChanges.Jumlah_Tanam)) ||
            Number(proposedChanges.Jumlah_Tanam) < 0
          )
        ){
          alert('Jumlah tanaman kopi harus berupa bilangan bulat 0 atau lebih.');
          return;
        }

        if(
          proposedChanges.Luas_Lahan_Ha !== undefined &&
          (
            !isFinite(Number(proposedChanges.Luas_Lahan_Ha)) ||
            Number(proposedChanges.Luas_Lahan_Ha) <= 0
          )
        ){
          alert('Luas lahan harus berupa angka lebih dari 0 hektare.');
          return;
        }

        if(
          ['Tanaman Lain','Campuran'].indexOf(
            proposedChanges.Tumpang_Sari
          ) !== -1
        ){
          var currentCoffeeProperties =
            selectedCorrectionFeature.feature.properties || {};
          var otherPlantName =
            proposedChanges.Tanaman_Lain ||
            currentCoffeeProperties.Tanaman_Lain ||
            '';
          if(!String(otherPlantName).trim()){
            alert(
              'Isi nama tanaman lain untuk jenis tumpang sari yang dipilih.'
            );
            return;
          }
        }
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
      if(!value('activity-date')){
        alert('Isi tanggal kegiatan replanting.');
        return;
      }
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

    if(selectedType === 'Capacity Building'){
      var capacityDataValidation = collectCapacityBuildingData();
      if(!value('activity-date')){
        alert('Isi tanggal kegiatan peningkatan kapasitas.');
        return;
      }
      if(capacityDataValidation.totalParticipants < 1){
        alert('Isi jumlah peserta laki-laki dan/atau perempuan.');
        return;
      }
      if(
        capacityDataValidation.youthMale > capacityDataValidation.maleParticipants ||
        capacityDataValidation.youthFemale > capacityDataValidation.femaleParticipants
      ){
        alert('Jumlah pemuda tidak boleh melebihi jumlah peserta menurut jenis kelamin.');
        return;
      }
      if(!capacityDataValidation.participantTarget || !capacityDataValidation.partnerOrResourcePerson || !capacityDataValidation.topic){
        alert('Isi sasaran peserta, mitra/narasumber, dan topik pelatihan.');
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
          : selectedType === 'Capacity Building'
            ? JSON.stringify(collectCapacityBuildingData())
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
        : isNewObjectReport
          ? JSON.stringify({
              Donor:newObjectDonor,
              Donor_Cluster:newObjectDonor,
              Nama_Donor:newObjectDonor
            })
          : '',
      proposedChanges:selectedType === 'Perbaikan Informasi'
        ? JSON.stringify(collectProposedChanges())
        : selectedType === 'Monitoring'
          ? JSON.stringify({monitoring:collectMonitoringData()})
          : selectedType === 'Replanting/Penyulaman Mangrove'
            ? JSON.stringify({replanting:collectReplantingData()})
            : selectedType === 'Capacity Building'
              ? JSON.stringify({capacityBuilding:collectCapacityBuildingData()})
            : isNewObjectReport
              ? JSON.stringify({
                  Donor:newObjectDonor,
                  Donor_Cluster:newObjectDonor,
                  Nama_Donor:newObjectDonor
                })
              : '',
      donor:isNewObjectReport ? newObjectDonor : '',
      images:compressedImages,
      documents:selectedType === 'Capacity Building' ? capacityDocuments : []
    };

    document.getElementById('payload').value = JSON.stringify(payload);
    success.hidden = true;
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

  var requestedParams = new URLSearchParams(window.location.search);
  var requestedType = requestedParams.get('type');
  if(requestedType && requestedType.toLowerCase() === 'monitoring'){
    var monitoringRadio = document.querySelector('input[name="reportTypeUI"][value="Monitoring"]');
    if(monitoringRadio){
      monitoringRadio.checked = true;
      selectedType = 'Monitoring';
      configureFormByType('Monitoring');

      var requestedLayer = requestedParams.get('layer');
      var requestedObject = requestedParams.get('object');
      if(requestedLayer && requestedObject){
        var correctionLayerSelect = document.getElementById('correction-layer');
        correctionLayerSelect.value = requestedLayer;
        loadCorrectionLayer(requestedLayer,requestedObject)
          .finally(function(){
            deepLinkSelectionPending = false;
          });
      }
    }
  }
  if(requestedType && ['capacity','capacity-building'].indexOf(requestedType.toLowerCase()) !== -1){
    var capacityRadio = document.querySelector('input[name="reportTypeUI"][value="Capacity Building"]');
    if(capacityRadio){
      capacityRadio.checked = true;
      selectedType = 'Capacity Building';
      configureFormByType('Capacity Building');
    }
  }

  document.getElementById('send-another').addEventListener('click',function(){
    form.reset();
    selectedType = '';
    geometryType = '';
    compressedImages = [];
    capacityDocuments = [];
    renderCapacityDocuments();
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
    if(typeof window.Worker === 'function'){
      /*
       * Jangan kembali ke kompresi halaman utama ketika worker gagal.
       * Kegagalan yang terlihat lebih aman daripada membekukan seluruh form.
       */
      return compressImageInWorker(file,maxDimension,quality);
    }

    return compressImageOnPage(file,maxDimension,quality);
  }

  function compressImageInWorker(file,maxDimension,quality){
    return new Promise(function(resolve,reject){
      var worker = new Worker(
        'js/report-image-worker.js?v=20260720-photo-worker2'
      );

      worker.onerror = function(event){
        worker.terminate();
        reject(new Error(event.message || 'Worker foto gagal dijalankan.'));
      };

      worker.onmessage = function(event){
        var result = event.data || {};
        worker.terminate();

        if(!result.ok || !result.blob){
          reject(new Error(result.error || 'Foto gagal diproses.'));
          return;
        }

        var reader = new FileReader();
        reader.onerror = reject;
        reader.onload = function(){
          resolve(reader.result);
        };
        reader.readAsDataURL(result.blob);
      };

      worker.postMessage({
        file:file,
        maxDimension:maxDimension,
        quality:quality
      });
    });
  }

  function compressImageOnPage(file,maxDimension,quality){
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
          var context = canvas.getContext('2d',{alpha:false});
          context.drawImage(image,0,0,canvas.width,canvas.height);

          /*
           * toDataURL memblokir halaman ketika foto kamera berukuran besar.
           * toBlob melakukan encoding secara asinkron agar form tetap responsif.
           */
          canvas.toBlob(function(blob){
            if(!blob){
              reject(new Error('Foto gagal dikompresi.'));
              return;
            }

            var blobReader = new FileReader();
            blobReader.onerror = reject;
            blobReader.onload = function(){
              resolve(blobReader.result);
              canvas.width = 1;
              canvas.height = 1;
              image.src = '';
            };
            blobReader.readAsDataURL(blob);
          },'image/jpeg',quality);
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function yieldToBrowser(){
    return new Promise(function(resolve){
      if(typeof window.requestAnimationFrame === 'function'){
        window.requestAnimationFrame(function(){
          window.setTimeout(resolve,0);
        });
      }else{
        window.setTimeout(resolve,0);
      }
    });
  }

  setTimeout(function(){ map.invalidateSize(true); },250);
})();
