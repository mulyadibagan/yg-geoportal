
(function(){
  'use strict';

  var form = document.getElementById('report-form');
  var imageInput = document.getElementById('images');
  var preview = document.getElementById('preview');
  var statusText = document.getElementById('submit-status');
  var submitButton = document.getElementById('submit-button');
  var success = document.getElementById('success');
  var submitFrame = document.getElementById('submit-frame');

  var compressedImages = [];
  var selectedType = '';
  var geometryType = '';
  var geometryGeoJSON = null;
  var marker = null;
  var polygonLayer = null;
  var polygonDrawer = null;
  var kmlLayer = null;
  var areaMethod = 'draw';
  var submissionStarted = false;

  var pointTypes = [
    'Tambah Foto Kegiatan','Titik Baru','Monitoring',
    'Kebakaran','Abrasi','Biodiversitas'
  ];

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
    var correctionFields = document.getElementById('correction-fields');
    var oldInformation = document.getElementById('old-information');
    var proposedInformation = document.getElementById('proposed-information');
    var guidance = document.getElementById('type-guidance');
    var geometryHelp = document.getElementById('geometry-help');

    correctionFields.hidden = type !== 'Perbaikan Informasi';
    oldInformation.required = type === 'Perbaikan Informasi';
    proposedInformation.required = type === 'Perbaikan Informasi';

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
    }else if(type === 'Perbaikan Informasi'){
      geometrySection.hidden = false;
      pointTools.hidden = false;
      polygonTools.hidden = true;
      pointCoordinates.hidden = false;
      geometryType = 'OptionalPoint';
      guidance.textContent = 'Isi informasi lama dan usulan perbaikan. Titik lokasi bersifat opsional.';
      geometryHelp.textContent = 'Lokasi tidak wajib, tetapi membantu tim Yayasan Gambut melakukan verifikasi.';
    }

    setTimeout(function(){ map.invalidateSize(true); },150);
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
      el.textContent = geometryType === 'Polygon'
        ? 'Belum ada poligon digambar.'
        : 'Belum ada titik dipilih.';
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
    }
  }

  imageInput.addEventListener('change',async function(){
    var files = Array.from(this.files || []).slice(0,5);
    compressedImages = [];
    preview.innerHTML = '';
    statusText.textContent = files.length ? 'Memproses foto...' : '';

    for(var i=0;i<files.length;i++){
      try{
        var dataUrl = await compressImage(files[i],1400,0.72);
        compressedImages.push({
          name:files[i].name,
          type:'image/jpeg',
          dataUrl:dataUrl
        });

        var figure = document.createElement('figure');
        var image = document.createElement('img');
        var caption = document.createElement('small');
        image.src = dataUrl;
        image.alt = files[i].name;
        caption.textContent = files[i].name;
        figure.appendChild(image);
        figure.appendChild(caption);
        preview.appendChild(figure);
      }catch(error){
        console.error(error);
      }
    }

    statusText.textContent = compressedImages.length + ' foto siap dikirim.';
  });

  form.addEventListener('submit',function(event){
    event.preventDefault();

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

    if(selectedType === 'Perbaikan Informasi'){
      if(!document.getElementById('old-information').value.trim() ||
         !document.getElementById('proposed-information').value.trim()){
        alert('Isi informasi lama dan usulan perbaikan.');
        return;
      }
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
      proposedInformation:value('proposed-information'),
      documentUrl:value('document-url'),
      geometryType:geometryGeoJSON ? geometryGeoJSON.type : '',
      geometryGeoJSON:geometryGeoJSON ? JSON.stringify(geometryGeoJSON) : '',
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

  document.getElementById('send-another').addEventListener('click',function(){
    form.reset();
    selectedType = '';
    geometryType = '';
    compressedImages = [];
    preview.innerHTML = '';
    resetGeometry();
    document.getElementById('geometry-section').hidden = true;
    document.getElementById('correction-fields').hidden = true;
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
