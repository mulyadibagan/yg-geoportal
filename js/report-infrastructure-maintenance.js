(function(){
  'use strict';

  var form = document.getElementById('report-form');
  var choiceGrid = document.querySelector('.choice-grid');
  var monitoringRadio = document.querySelector('input[name="reportTypeUI"][value="Monitoring"]');
  var monitoringFields = document.getElementById('monitoring-fields');
  var existingFeatureFields = document.getElementById('existing-feature-fields');
  var geometrySection = document.getElementById('geometry-section');
  var geometryTitle = document.getElementById('geometry-title');
  var guidance = document.getElementById('type-guidance');
  var photoStatus = document.getElementById('photo-selection-status');
  var maintenanceMode = false;

  if(!form || !choiceGrid || !monitoringRadio) return;

  var maintenanceLabel = document.createElement('label');
  maintenanceLabel.innerHTML = '<input id="maintenance-report-radio" type="radio" name="reportTypeUI" value="Monitoring"><span><span class="choice-icon">🔧</span> Pemeliharaan Infrastruktur</span>';
  monitoringRadio.closest('label').insertAdjacentElement('afterend', maintenanceLabel);

  var maintenanceFields = document.createElement('div');
  maintenanceFields.id = 'infrastructure-maintenance-fields';
  maintenanceFields.className = 'conditional-subsection monitoring-fields';
  maintenanceFields.hidden = true;
  maintenanceFields.innerHTML = [
    '<h3>Data pemeliharaan infrastruktur</h3>',
    '<p class="help">Pilih objek infrastruktur yang sudah ada di WebGIS. Kegiatan ini disimpan sebagai riwayat intervensi baru dan tidak mengubah donor/pembangun awal objek.</p>',
    '<div class="form-grid">',
      '<label class="field"><span>Jenis infrastruktur *</span><select id="maintenance-infrastructure-type"><option value="">Pilih jenis...</option><option value="Sekat Kanal">Sekat Kanal</option><option value="FDRS">FDRS / Tinggi Muka Air</option><option value="APO">APO / Wave Breaker</option><option value="Rumah Bibit">Rumah Bibit</option><option value="Infrastruktur Pendukung">Infrastruktur Pendukung</option><option value="Lainnya">Lainnya</option></select></label>',
      '<label class="field"><span>Program/Donor pemeliharaan *</span><input id="maintenance-donor" list="maintenance-donor-options" placeholder="Contoh: Penabulu"><datalist id="maintenance-donor-options"><option value="Penabulu"></option><option value="Global Environment Centre"></option><option value="Aramco Asia Singapore"></option><option value="Pan Pacific Conservation Foundation (PPCF)"></option></datalist></label>',
      '<label class="field"><span>Jenis intervensi *</span><select id="maintenance-intervention"><option value="">Pilih intervensi...</option><option value="Pemeliharaan">Pemeliharaan</option><option value="Perbaikan">Perbaikan</option><option value="Pembaruan/Rehabilitasi">Pembaruan/Rehabilitasi</option><option value="Penggantian Bagian">Penggantian Bagian</option></select></label>',
      '<label class="field"><span>Pelaksana/Kelompok</span><input id="maintenance-implementer" placeholder="Nama kelompok/pelaksana"></label>',
      '<label class="field"><span>Kondisi sebelum *</span><select id="maintenance-before"><option value="">Pilih kondisi...</option><option value="Baik">Baik</option><option value="Perlu Pemeliharaan">Perlu Pemeliharaan</option><option value="Rusak Ringan">Rusak Ringan</option><option value="Rusak Berat">Rusak Berat</option><option value="Tidak Berfungsi">Tidak Berfungsi</option></select></label>',
      '<label class="field"><span>Kondisi setelah *</span><select id="maintenance-after"><option value="">Pilih kondisi...</option><option value="Baik">Baik</option><option value="Berfungsi dengan Catatan">Berfungsi dengan Catatan</option><option value="Belum Berfungsi">Belum Berfungsi</option></select></label>',
      '<label class="field"><span>Status fungsi setelah kegiatan *</span><select id="maintenance-function"><option value="">Pilih status...</option><option value="Berfungsi Baik">Berfungsi Baik</option><option value="Berfungsi Sebagian">Berfungsi Sebagian</option><option value="Tidak Berfungsi">Tidak Berfungsi</option></select></label>',
      '<label class="field span-2"><span>Pekerjaan yang dilakukan *</span><textarea id="maintenance-work" rows="4" placeholder="Contoh: penggantian papan, penguatan struktur, penambahan material, pembersihan saluran."></textarea></label>',
      '<label class="field span-2"><span>Catatan/tindak lanjut</span><textarea id="maintenance-follow-up" rows="3" placeholder="Catatan tambahan atau kebutuhan tindak lanjut."></textarea></label>',
    '</div>',
    '<div class="notice" style="margin-top:14px"><strong>Dokumentasi</strong><span>Untuk pemeliharaan infrastruktur wajib minimal 2 foto: sebelum dan sesudah kegiatan.</span></div>'
  ].join('');

  var replantingFields = document.getElementById('replanting-fields');
  if(replantingFields && replantingFields.parentNode){
    replantingFields.parentNode.insertBefore(maintenanceFields, replantingFields);
  }

  var maintenanceRadio = document.getElementById('maintenance-report-radio');

  function value(id){
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function syncHiddenMonitoringFields(){
    if(!maintenanceMode) return;
    var type = document.getElementById('maintenance-infrastructure-type');
    var monitorType = document.getElementById('monitoring-type');
    var monitorCondition = document.getElementById('monitoring-condition');
    var monitorNotes = document.getElementById('monitoring-notes');
    var canalUnits = document.getElementById('monitoring-canal-units');
    if(monitorType){
      monitorType.value = value('maintenance-infrastructure-type') === 'Sekat Kanal' ? 'Sekat Kanal' : 'Monitoring Umum';
    }
    if(monitorCondition){
      var after = value('maintenance-after');
      monitorCondition.value = after === 'Baik' ? 'Baik' : after === 'Belum Berfungsi' ? 'Rusak Berat' : 'Sedang';
    }
    if(monitorNotes) monitorNotes.value = value('maintenance-work') || 'Pemeliharaan infrastruktur';
    if(canalUnits && value('maintenance-infrastructure-type') === 'Sekat Kanal') canalUnits.value = '1';
  }

  function activateMaintenanceMode(){
    maintenanceMode = true;
    window.setTimeout(function(){
      if(monitoringFields) monitoringFields.hidden = true;
      maintenanceFields.hidden = false;
      if(geometrySection) geometrySection.hidden = false;
      if(existingFeatureFields) existingFeatureFields.hidden = false;
      if(geometryTitle) geometryTitle.textContent = '4. Pilih objek infrastruktur WebGIS';
      var title = document.getElementById('existing-feature-title');
      if(title) title.textContent = 'Pilih objek infrastruktur yang akan dipelihara';
      if(guidance) guidance.textContent = 'Pilih layer infrastruktur, muat layer, lalu klik objek existing yang menerima kegiatan pemeliharaan/perbaikan.';
      var layerSelect = document.getElementById('correction-layer');
      if(layerSelect){
        var canalOption = Array.prototype.slice.call(layerSelect.options).find(function(option){
          return /sekat kanal/i.test(option.textContent || '');
        });
        if(canalOption){
          layerSelect.value = canalOption.value;
          layerSelect.dispatchEvent(new Event('change',{bubbles:true}));
        }
      }
      syncHiddenMonitoringFields();
    },0);
  }

  maintenanceRadio.addEventListener('change',function(){
    if(this.checked) activateMaintenanceMode();
  });

  document.querySelectorAll('input[name="reportTypeUI"]').forEach(function(input){
    if(input === maintenanceRadio) return;
    input.addEventListener('change',function(){
      if(this.checked){
        maintenanceMode = false;
        maintenanceFields.hidden = true;
      }
    });
  });

  ['maintenance-infrastructure-type','maintenance-after','maintenance-work'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.addEventListener('change',syncHiddenMonitoringFields);
    if(el) el.addEventListener('input',syncHiddenMonitoringFields);
  });

  form.addEventListener('submit',function(event){
    if(!maintenanceMode) return;
    syncHiddenMonitoringFields();
    var required = [
      ['maintenance-infrastructure-type','Pilih jenis infrastruktur.'],
      ['maintenance-donor','Isi program/donor pemeliharaan.'],
      ['maintenance-intervention','Pilih jenis intervensi.'],
      ['maintenance-before','Pilih kondisi sebelum kegiatan.'],
      ['maintenance-after','Pilih kondisi setelah kegiatan.'],
      ['maintenance-function','Pilih status fungsi setelah kegiatan.'],
      ['maintenance-work','Isi pekerjaan yang dilakukan.']
    ];
    for(var i=0;i<required.length;i++){
      if(!value(required[i][0])){
        event.preventDefault();
        event.stopImmediatePropagation();
        alert(required[i][1]);
        document.getElementById(required[i][0]).focus();
        return;
      }
    }
    if(!value('activity-date')){
      event.preventDefault();
      event.stopImmediatePropagation();
      alert('Isi tanggal kegiatan pemeliharaan.');
      document.getElementById('activity-date').focus();
      return;
    }
    var photoCount = document.querySelectorAll('#preview figure').length;
    if(photoCount < 2){
      event.preventDefault();
      event.stopImmediatePropagation();
      alert('Tambahkan minimal 2 foto: sebelum dan sesudah kegiatan.');
      document.getElementById('photo-section').scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
  },true);

  var nativeSubmit = HTMLFormElement.prototype.submit;
  form.submit = function(){
    if(maintenanceMode){
      var payloadInput = document.getElementById('payload');
      if(payloadInput && payloadInput.value){
        try{
          var payload = JSON.parse(payloadInput.value);
          var maintenanceData = {
            activityType:'Pemeliharaan Infrastruktur',
            infrastructureType:value('maintenance-infrastructure-type'),
            donor:value('maintenance-donor'),
            interventionType:value('maintenance-intervention'),
            implementer:value('maintenance-implementer'),
            conditionBefore:value('maintenance-before'),
            conditionAfter:value('maintenance-after'),
            functionAfter:value('maintenance-function'),
            workPerformed:value('maintenance-work'),
            followUp:value('maintenance-follow-up'),
            photoStages:['BEFORE','AFTER']
          };
          payload.reportType = 'Pemeliharaan Infrastruktur';
          payload.proposedInformation = JSON.stringify(maintenanceData);
          payload.proposedChanges = JSON.stringify({maintenance:maintenanceData});
          payload.donor = maintenanceData.donor;
          payload.maintenance = maintenanceData;
          payloadInput.value = JSON.stringify(payload);
        }catch(error){
          console.error('Payload pemeliharaan gagal diperbarui.',error);
        }
      }
    }
    nativeSubmit.call(form);
  };

  var requestedType = new URLSearchParams(window.location.search).get('type');
  if(['maintenance','infrastructure-maintenance','pemeliharaan'].indexOf(String(requestedType || '').toLowerCase()) !== -1){
    maintenanceRadio.checked = true;
    monitoringRadio.checked = false;
    maintenanceRadio.dispatchEvent(new Event('change',{bubbles:true}));
  }
})();
