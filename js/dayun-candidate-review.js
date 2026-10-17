(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.YG_DAYUN_CANDIDATES=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const statuses=['candidate','accepted','rejected'];
  function inside(coordinates,bounds){return Array.isArray(coordinates)&&coordinates.length===2&&coordinates.every(Number.isFinite)&&coordinates[0]>=bounds[0]&&coordinates[0]<=bounds[2]&&coordinates[1]>=bounds[1]&&coordinates[1]<=bounds[3];}
  function validateReview(value,trial){
    if(value?.schema!=='dayun-candidate-corrections-v1'||value.dataset_id!==trial.dataset_id||value.source_run!==trial.source_run||!Array.isArray(value.samples)||value.samples.length!==trial.samples.length)throw Error('Berkas koreksi bukan untuk citra dan uji ini.');
    const samples=new Set(),ids=new Set();
    for(const sample of value.samples){
      const original=trial.samples.find(s=>s.id===sample.id);
      if(!original||samples.has(sample.id)||!Array.isArray(sample.features)||sample.features.length>1000)throw Error('Sampel koreksi tidak valid.');samples.add(sample.id);
      for(const feature of sample.features){const p=feature?.properties;
        if(feature.type!=='Feature'||feature.geometry?.type!=='Point'||!inside(feature.geometry.coordinates,original.bounds)||typeof p?.id!=='string'||!/^[\w-]{1,100}$/.test(p.id)||ids.has(p.id)||p.sample_id!==sample.id||!statuses.includes(p.status)||typeof p.note!=='string'||p.note.length>1000)throw Error('Titik koreksi tidak valid atau di luar sampel.');
        ids.add(p.id);
      }
      if(sample.complete===true&&sample.features.some(f=>f.properties.status==='candidate'))throw Error('Sampel selesai masih memiliki kandidat belum diperiksa.');
    }return value;
  }
  function counts(features){return Object.fromEntries(statuses.map(s=>[s,features.filter(f=>f.properties.status===s).length]));}
  async function mount({host,map,api,base,manifest,openRaster,save,current}){
    if(!manifest.files.includes('candidate-trial.json'))return()=>{};
    const trial=await(await api(base+'/files/candidate-trial.json')).json();if(!current())return()=>{};
    if(trial.schema!=='dayun-candidate-trial-v1'||trial.source_run!==manifest.run||trial.samples.some(s=>!manifest.files.includes(s.sourceCrop)))throw Error('Sumber uji kandidat tidak cocok dengan citra.');
    const original=JSON.parse(JSON.stringify(trial));
    const stored=await(await api(base+'/review')).json();if(!current())return()=>{};
    let revision=stored.revision||0,model=stored.model||null,editVersion=0,exportedVersion=-1;
    if(stored.review){validateReview(stored.review,original);for(const row of stored.review.samples){const target=trial.samples.find(s=>s.id===row.id);target.features=row.features;target.complete=row.complete===true;}}
    let sample=trial.samples[0],selected=null,adding=false,disposed=false,busy=false,loadSequence=0,dirty=false;
    const alive=()=>!disposed&&current();const layers=L.layerGroup().addTo(map),feedbackLayer=L.layerGroup().addTo(map);host.hidden=false;host.replaceChildren();
    const make=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
    const title=make('h3','Uji kandidat nanas — perlu koreksi');
    const note=make('p','Titik adalah usulan tajuk visual, bukan jumlah nanas tervalidasi. Uji otomatis belum andal. Geser titik untuk memperbaiki posisi. Terima/tolak memakai penilaian Anda; ini tidak mengubah sensus.');note.className='note';
    const select=make('select');select.setAttribute('aria-label','Sampel uji kandidat');trial.samples.forEach(s=>select.add(new Option(s.gawangan+' · '+s.features.length+' kandidat visual',s.id)));
    const open=make('button','Buka sampel dan penanda'),summary=make('p'),status=make('p','Koreksi dimuat dari penyimpanan privat. Simpan setelah mengedit.');status.setAttribute('role','status');
    const details=make('p','Klik titik untuk memeriksa.'),decision=make('select');decision.setAttribute('aria-label','Keputusan kandidat');[['candidate','Belum diperiksa'],['accepted','Terima sebagai nanas menurut pemeriksa'],['rejected','Tolak kandidat']].forEach(([v,t])=>decision.add(new Option(t,v)));
    const memo=make('input');memo.type='text';memo.maxLength=1000;memo.setAttribute('aria-label','Catatan kandidat');
    const apply=make('button','Terapkan keputusan'),add=make('button','Tambah kandidat di peta'),exportButton=make('button','Ekspor koreksi'),file=make('input');file.type='file';file.accept='.json,.geojson';file.setAttribute('aria-label','Muat kembali koreksi kandidat');
    const analysisButton=make('button','Unduh evaluasi hitungan');
    const storeButton=make('button','Simpan privat & perbarui hitungan'),reloadButton=make('button','Muat koreksi server'),modelStatus=make('p');
    const complete=make('input');complete.type='checkbox';complete.checked=sample.complete===true;const completeLabel=make('label',' Sampel selesai diperiksa, termasuk tanaman terlewat');completeLabel.prepend(complete);
    const overlay=make('input');overlay.type='checkbox';const overlayLabel=make('label',' Tampilkan usulan mesin setelah koreksi (biru)');overlayLabel.prepend(overlay);
    host.append(title,note,select,open,summary,details,decision,memo,apply,add,completeLabel,storeButton,reloadButton,modelStatus,overlayLabel,analysisButton,exportButton,file,status);
    function changed(preserveComplete=false){editVersion++;dirty=true;if(!preserveComplete){sample.complete=false;complete.checked=false;}status.textContent='Ada koreksi belum disimpan. Klik Simpan privat & perbarui hitungan. Sensus tidak berubah.';}
    function update(){const c=counts(sample.features);summary.textContent=`${sample.gawangan}: ${c.candidate} belum diperiksa · ${c.accepted} diterima pemeriksa · ${c.rejected} ditolak. Hanya jendela 512 × 512 piksel; bukan total gawangan.`;}
    function pick(feature){selected=feature;const p=feature.properties;details.textContent=p.id+' · '+(p.method==='manual_addition'?'ditambah pemeriksa':'kandidat tajuk visual');decision.value=p.status;memo.value=p.note;apply.disabled=false;}
    function render(){layers.clearLayers();feedbackLayer.clearLayers();selected=null;apply.disabled=true;details.textContent='Klik titik untuk memeriksa.';memo.value='';decision.value='candidate';complete.checked=sample.complete===true;update();showModel();
      sample.features.forEach((f,index)=>{const p=f.properties,color={candidate:'#d88c00',accepted:'#137f63',rejected:'#a51d36'}[p.status];
        const icon=L.divIcon({className:'dayun-candidate-marker',html:`<span style="background:${color}">${index+1}</span>`,iconSize:[24,24],iconAnchor:[12,12]});
        const marker=L.marker([f.geometry.coordinates[1],f.geometry.coordinates[0]],{icon,draggable:true,title:p.id});marker.addTo(layers);marker.bindTooltip(p.id+' · '+p.status);marker.on('click',()=>{if(alive())pick(f);});
        marker.on('dragend',()=>{if(!alive())return;const point=marker.getLatLng(),coords=[point.lng,point.lat];if(!inside(coords,sample.bounds)){marker.setLatLng([f.geometry.coordinates[1],f.geometry.coordinates[0]]);status.textContent='Posisi harus berada di dalam jendela sampel.';return;}f.geometry.coordinates=coords;p.position_corrected=true;changed();pick(f);});
      });
    }
    async function show(){if(!alive()||busy)return;busy=true;open.disabled=true;const request=++loadSequence;const active=sample;status.textContent='Membuka TIFF privat dan penanda…';
      try{const blob=await(await api(base+'/files/'+active.sourceCrop)).blob();if(!alive()||request!==loadSequence)return;await openRaster(blob,{title:trial.label+' / '+active.sourceCrop,nativeReview:true});if(!alive()||request!==loadSequence)return;
        render();const b=active.bounds;map.fitBounds([[b[1],b[0]],[b[3],b[2]]],{padding:[25,25]});status.textContent=dirty?'Ada koreksi belum disimpan.':'Kandidat dimuat. Revisi privat '+revision+'. Jingga belum diperiksa, hijau diterima, merah ditolak.';
      }catch(error){if(alive())status.textContent='Sampel belum dapat dibuka: '+error.message;}finally{busy=false;if(alive())open.disabled=false;}
    }
    function showModel(){
      feedbackLayer.clearLayers();analysisButton.disabled=!model;const result=model?.samples?.find(s=>s.id===sample.id);
      modelStatus.textContent=`Revisi privat ${revision}. `+(model?.status==='calibrated_trial_not_independently_validated'?`Kalibrasi ambang ${model.threshold}; belum tervalidasi independen.`:'Kalibrasi menunggu sampel lengkap dengan minimal tiga tanaman diterima.');
      if(result)modelStatus.textContent+=` Sampel ini: ${result.automatic_count} usulan otomatis, ${result.feedback_candidate_count} usulan setelah koreksi; ${result.accepted_by_reviewer} diterima pemeriksa. Bukan jumlah total gawangan.`;
      if(overlay.checked&&result)for(const f of result.features){
        const circle=L.circleMarker([f.geometry.coordinates[1],f.geometry.coordinates[0]],{radius:9,color:f.properties.feedback_origin==='reviewer_label'?'#137f63':'#2563eb',weight:2,fillOpacity:.15,bubblingMouseEvents:false}).bindTooltip(f.properties.feedback_origin==='reviewer_label'?'Label pemeriksa':'Klik untuk meninjau usulan mesin').addTo(feedbackLayer);
        circle.on('click',()=>{if(!alive()||busy)return;let target=sample.features.find(x=>x.properties.id===f.properties.id||x.geometry.coordinates.every((v,i)=>Math.abs(v-f.geometry.coordinates[i])<1e-12));
          if(!target){if(sample.features.length>=1000)return;target={type:'Feature',geometry:JSON.parse(JSON.stringify(f.geometry)),properties:{id:sample.id+'-machine-review-'+crypto.randomUUID(),sample_id:sample.id,gawangan:sample.gawangan,status:'candidate',method:'manual_addition',note:'Ditambahkan dari usulan mesin untuk ditinjau',species_confirmed:false}};sample.features.push(target);changed();render();}pick(target);
        });
      }
    }
    complete.onchange=()=>{if(!alive())return;if(complete.checked&&sample.features.some(f=>f.properties.status==='candidate')){complete.checked=false;status.textContent='Putuskan semua kandidat dan tambahkan tanaman terlewat sebelum menandai selesai.';return;}sample.complete=complete.checked;changed(true);};
    overlay.onchange=()=>{if(alive())showModel();};
    analysisButton.onclick=()=>{if(alive()&&model)save(new Blob([JSON.stringify({source_run:trial.source_run,dataset_id:trial.dataset_id,review_revision:revision,model,census_changed:false},null,2)],{type:'application/json'}),'dayun-feedback-evaluation.json');};
    storeButton.onclick=async()=>{if(!alive()||storeButton.disabled)return;const snapshotVersion=editVersion;storeButton.disabled=true;
      try{const review={schema:'dayun-candidate-corrections-v1',dataset_id:trial.dataset_id,source_run:trial.source_run,samples:trial.samples.map(s=>({id:s.id,complete:s.complete===true,features:s.features}))};validateReview(review,original);
        const result=await(await api(base+'/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expected_revision:revision,review})})).json();if(!alive())return;
        revision=result.revision;model=result.model;if(snapshotVersion===editVersion){dirty=false;for(const row of result.review.samples){const target=trial.samples.find(s=>s.id===row.id);target.features=row.features;target.complete=row.complete;}render();}
        showModel();status.textContent=`Revisi ${revision} tersimpan privat. `+(dirty?'Ada perubahan baru yang belum disimpan.':'Koreksi dipakai untuk hitungan sampel. Sensus tidak berubah.');
      }catch(error){if(alive())status.textContent=String(error.message).includes('409')?'Konflik revisi. Ekspor salinan sebelum memuat koreksi server; jangan menimpa perubahan staf lain.':'Penyimpanan belum berhasil: '+error.message;}finally{if(alive())storeButton.disabled=false;}
    };
    reloadButton.onclick=async()=>{if(!alive())return;if(dirty&&exportedVersion!==editVersion){status.textContent='Ada perubahan lokal. Simpan atau ekspor salinan sebelum memuat ulang. Untuk konflik, buka kembali hasil setelah mengekspor.';return;}
      try{const value=await(await api(base+'/review')).json();if(!alive())return;if(value.review)validateReview(value.review,original);for(const row of (value.review||original).samples){const target=trial.samples.find(s=>s.id===row.id);target.features=JSON.parse(JSON.stringify(row.features));target.complete=row.complete===true;}dirty=false;revision=value.revision||0;model=value.model||null;render();status.textContent='Revisi privat '+revision+' dimuat dari server.';}catch(error){if(alive())status.textContent=error.message;}
    };
    open.onclick=show;select.onchange=()=>{if(!alive())return;loadSequence++;sample=trial.samples.find(s=>s.id===select.value);adding=false;add.textContent='Tambah kandidat di peta';layers.clearLayers();feedbackLayer.clearLayers();selected=null;apply.disabled=true;memo.value='';decision.value='candidate';complete.checked=sample.complete===true;update();showModel();status.textContent='Klik Buka sampel dan penanda untuk memeriksa citra ini.';};
    apply.onclick=()=>{if(!alive()||!selected)return;selected.properties.status=decision.value;selected.properties.note=memo.value.slice(0,1000);selected.properties.species_confirmed=false;selected.properties.reviewed_at=new Date().toISOString();changed();render();};
    add.onclick=()=>{if(!alive())return;adding=!adding;add.textContent=adding?'Selesai menambah titik':'Tambah kandidat di peta';status.textContent=adding?'Klik pusat tanaman di dalam jendela sampel.':'Mode tambah titik dimatikan.';};
    const onMapClick=event=>{if(!alive()||!adding||busy)return;const coordinates=[event.latlng.lng,event.latlng.lat];if(!inside(coordinates,sample.bounds)){status.textContent='Titik harus berada di jendela sampel yang dipilih.';return;}
      if(sample.features.length>=1000)return;const feature={type:'Feature',geometry:{type:'Point',coordinates},properties:{id:sample.id+'-manual-'+crypto.randomUUID(),sample_id:sample.id,gawangan:sample.gawangan,status:'candidate',method:'manual_addition',species_confirmed:false,note:''}};sample.features.push(feature);changed();render();pick(feature);};map.on('click',onMapClick);
    exportButton.onclick=()=>{if(!alive())return;const value={schema:'dayun-candidate-corrections-v1',dataset_id:trial.dataset_id,source_run:trial.source_run,exported_at:new Date().toISOString(),census_changed:false,not_a_validated_plant_count:true,samples:trial.samples.map(s=>({id:s.id,complete:s.complete===true,features:s.features}))};validateReview(value,original);save(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),'dayun-candidate-corrections.json');exportedVersion=editVersion;status.textContent='Salinan koreksi diekspor. '+(dirty?'Perubahan belum disimpan ke server.':'Revisi privat '+revision+' tetap tersimpan.');};
    file.onchange=async()=>{if(!alive()||!file.files?.[0])return;try{if(file.files[0].size>2*1024*1024)throw Error('Berkas melebihi 2 MB.');const imported=validateReview(JSON.parse(await file.files[0].text()),original);if(!alive())return;for(const row of imported.samples){const target=trial.samples.find(s=>s.id===row.id);target.features=JSON.parse(JSON.stringify(row.features));target.complete=row.complete===true;}changed(true);render();status.textContent='Salinan dimuat. Simpan privat untuk menerapkan ke server.';}catch(error){if(alive())status.textContent=error.message;}finally{file.value='';}};
    const beforeUnload=event=>{if(dirty){event.preventDefault();event.returnValue='';}};if(typeof window!=='undefined')window.addEventListener('beforeunload',beforeUnload);
    showModel();update();apply.disabled=true;
    return()=>{if(typeof window!=='undefined')window.removeEventListener('beforeunload',beforeUnload);disposed=true;loadSequence++;map.off('click',onMapClick);map.removeLayer(layers);map.removeLayer(feedbackLayer);host.replaceChildren();host.hidden=true;};
  }
  return{mount,validateReview,counts};
});
