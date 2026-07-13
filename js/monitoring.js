(function(){
  'use strict';

  var form=document.getElementById('monitor-form');
  var layerSelect=document.getElementById('target-layer');
  var selectedBox=document.getElementById('selected-object');
  var clearButton=document.getElementById('clear-object');
  var imageInput=document.getElementById('images');
  var preview=document.getElementById('preview');
  var statusText=document.getElementById('submit-status');
  var submitButton=document.getElementById('submit-button');
  var submitFrame=document.getElementById('submit-frame');
  var success=document.getElementById('success');

  var selectedFeature=null;
  var dataLayer=null;
  var selectedLayer=null;
  var compressedImages=[];
  var submissionStarted=false;

  var map=L.map('monitor-map').setView([1.15,101.95],8);
  var street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
  var satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'});
  L.control.layers({'Peta Jalan':street,'Citra Satelit':satellite},null,{collapsed:true}).addTo(map);

  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function value(id){return (document.getElementById(id).value||'').trim();}
  function selectedCondition(){var item=document.querySelector('input[name="condition"]:checked');return item?item.value:'';}
  function checkedValues(containerId){return Array.prototype.slice.call(document.querySelectorAll('#'+containerId+' input:checked')).map(function(input){return input.value;});}
  function featureName(props){return props.Nama||props.nama||props.name||props.Name||props.Lokasi||props.lokasi||props.Desa||props.desa||props.Keterangan||props.keterangan||'Objek tanpa nama';}

  (window.YG_LAYER_CONFIG||[]).forEach(function(config){
    var option=document.createElement('option');option.value=config.id;option.textContent=config.label;layerSelect.appendChild(option);
  });

  layerSelect.addEventListener('change',function(){loadLayer(this.value);});

  async function loadLayer(layerId){
    clearSelection();
    if(dataLayer){map.removeLayer(dataLayer);dataLayer=null;}
    if(!layerId)return;
    var config=(window.YG_LAYER_CONFIG||[]).find(function(item){return item.id===layerId;});
    if(!config){selectedBox.textContent='Konfigurasi layer tidak ditemukan.';return;}
    selectedBox.textContent='Memuat '+config.label+'...';
    try{
      var response=await fetch(config.url+'?v='+Date.now());
      if(!response.ok)throw new Error('HTTP '+response.status);
      var geojson=await response.json();
      dataLayer=L.geoJSON(geojson,{
        style:function(){return {color:'#079cde',weight:3,fillColor:'#079cde',fillOpacity:.18};},
        pointToLayer:function(feature,latlng){return L.circleMarker(latlng,{radius:8,color:'#fff',weight:2,fillColor:'#079cde',fillOpacity:1});},
        onEachFeature:function(feature,layer){
          var props=feature.properties||{};
          layer.bindTooltip(featureName(props));
          layer.on('click',function(){selectFeature(config,feature,layer);});
        }
      }).addTo(map);
      if(dataLayer.getBounds().isValid())map.fitBounds(dataLayer.getBounds(),{padding:[25,25],maxZoom:15});
      selectedBox.textContent='Klik objek pada peta untuk memilih lokasi monitoring.';
    }catch(error){console.error(error);selectedBox.textContent='Layer gagal dimuat. Periksa nama file dan konfigurasi data.';}
  }

  function selectFeature(config,feature,layer){
    clearSelection(false);
    selectedFeature={layerId:config.id,layerLabel:config.label,feature:feature};
    selectedLayer=layer;
    if(layer.setStyle)layer.setStyle({color:'#4c1d0b',weight:5,fillColor:'#f6a623',fillOpacity:.35});
    if(layer.getLatLng)map.setView(layer.getLatLng(),Math.max(map.getZoom(),15));
    else if(layer.getBounds&&layer.getBounds().isValid())map.fitBounds(layer.getBounds(),{padding:[45,45],maxZoom:16});
    var props=feature.properties||{};
    selectedBox.className='selected-object active';
    selectedBox.innerHTML='<strong>'+esc(featureName(props))+'</strong><br><span>'+esc(config.label)+'</span>';
    clearButton.hidden=false;
  }

  function clearSelection(resetText){
    if(selectedLayer&&selectedLayer.setStyle)selectedLayer.setStyle({color:'#079cde',weight:3,fillColor:'#079cde',fillOpacity:.18});
    selectedFeature=null;selectedLayer=null;clearButton.hidden=true;selectedBox.className='selected-object';
    if(resetText!==false)selectedBox.textContent=layerSelect.value?'Klik objek pada peta untuk memilih lokasi monitoring.':'Belum ada objek dipilih.';
  }
  clearButton.addEventListener('click',function(){clearSelection();});

  document.getElementById('monitor-date').value=new Date().toISOString().slice(0,10);

  document.getElementById('get-location').addEventListener('click',function(){
    var locationStatus=document.getElementById('location-status');
    if(!navigator.geolocation){locationStatus.textContent='Perangkat tidak mendukung GPS.';return;}
    locationStatus.textContent='Mengambil lokasi...';
    navigator.geolocation.getCurrentPosition(function(position){
      document.getElementById('latitude').value=position.coords.latitude.toFixed(7);
      document.getElementById('longitude').value=position.coords.longitude.toFixed(7);
      locationStatus.textContent='Lokasi petugas berhasil direkam (akurasi ±'+Math.round(position.coords.accuracy)+' m).';
      map.setView([position.coords.latitude,position.coords.longitude],16);
    },function(){locationStatus.textContent='Lokasi gagal diperoleh. Pastikan izin lokasi aktif.';},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  });

  imageInput.addEventListener('change',async function(){
    var files=Array.prototype.slice.call(this.files||[]).slice(0,5);compressedImages=[];preview.innerHTML='';
    statusText.textContent=files.length?'Memproses foto...':'';
    for(var i=0;i<files.length;i++){
      try{
        var dataUrl=await compressImage(files[i],1600,.78);
        compressedImages.push({name:files[i].name,type:'image/jpeg',data:dataUrl});
        var figure=document.createElement('figure');figure.innerHTML='<img alt="Foto monitoring"><figcaption></figcaption>';
        figure.querySelector('img').src=dataUrl;figure.querySelector('figcaption').textContent=files[i].name;preview.appendChild(figure);
      }catch(error){console.error(error);}
    }
    statusText.textContent=compressedImages.length+' foto siap dikirim.';
  });

  function compressImage(file,maxSize,quality){
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onerror=reject;
      reader.onload=function(){
        var image=new Image();image.onerror=reject;
        image.onload=function(){
          var width=image.width,height=image.height,scale=Math.min(1,maxSize/Math.max(width,height));
          var canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
          canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',quality));
        };image.src=reader.result;
      };reader.readAsDataURL(file);
    });
  }

  form.addEventListener('submit',function(event){
    event.preventDefault();
    if(!selectedFeature){alert('Pilih objek WebGIS yang akan dimonitor.');return;}
    if(!compressedImages.length&&!confirm('Belum ada foto monitoring. Tetap kirim tanpa foto?'))return;

    var props=selectedFeature.feature.properties||{};
    var monitorData={
      condition:selectedCondition(),method:value('method'),survivalPercent:value('survival'),aliveCount:value('alive'),deadOrDamagedCount:value('dead'),monitoredAreaHa:value('area'),threats:checkedValues('threats'),notes:value('notes'),followUp:value('follow-up')
    };
    var summary='Kondisi: '+monitorData.condition+'.';
    if(monitorData.survivalPercent)summary+=' Survival/keberhasilan: '+monitorData.survivalPercent+'%.';
    if(monitorData.threats.length)summary+=' Ancaman: '+monitorData.threats.join(', ')+'.';
    summary+=' Temuan: '+monitorData.notes;
    if(monitorData.followUp)summary+=' Tindak lanjut: '+monitorData.followUp;

    var geometry=selectedFeature.feature.geometry||null;
    var payload={
      reportType:'Monitoring',name:value('name'),organization:value('organization'),email:value('email'),phone:value('phone'),province:props.Provinsi||props.province||'Riau',regency:props.Kabupaten||props.regency||'',district:props.Kecamatan||props.district||'',village:props.Desa||props.village||'',locationName:featureName(props),latitude:value('latitude'),longitude:value('longitude'),title:'Monitoring '+featureName(props),activityDate:value('monitor-date'),description:summary,oldInformation:'',proposedInformation:JSON.stringify(monitorData),documentUrl:value('document-url'),geometryType:geometry?geometry.type:'',geometryGeoJSON:geometry?JSON.stringify(geometry):'',targetLayerId:selectedFeature.layerId,targetLayerLabel:selectedFeature.layerLabel,targetFeatureProperties:JSON.stringify(props),proposedChanges:JSON.stringify({monitoring:monitorData}),images:compressedImages
    };
    document.getElementById('payload').value=JSON.stringify(payload);
    submitButton.disabled=true;submitButton.textContent='Mengirim...';statusText.textContent='Data dan foto sedang dikirim.';submissionStarted=true;form.submit();
  });

  submitFrame.addEventListener('load',function(){
    if(!submissionStarted)return;
    setTimeout(function(){form.hidden=true;success.hidden=false;success.scrollIntoView({behavior:'smooth',block:'start'});submissionStarted=false;},600);
  });
  document.getElementById('send-another').addEventListener('click',function(){window.location.reload();});
})();
