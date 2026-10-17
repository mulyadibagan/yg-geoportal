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
    }return value;
  }
  function counts(features){return Object.fromEntries(statuses.map(s=>[s,features.filter(f=>f.properties.status===s).length]));}
  async function mount({host,map,api,base,manifest,openRaster,save,current}){
    if(!manifest.files.includes('candidate-trial.json'))return()=>{};
    const trial=await(await api(base+'/files/candidate-trial.json')).json();if(!current())return()=>{};
    if(trial.schema!=='dayun-candidate-trial-v1'||trial.source_run!==manifest.run||trial.samples.some(s=>!manifest.files.includes(s.sourceCrop)))throw Error('Sumber uji kandidat tidak cocok dengan citra.');
    const original=JSON.parse(JSON.stringify(trial));let sample=trial.samples[0],selected=null,adding=false,disposed=false,busy=false,loadSequence=0,dirty=false;
    const alive=()=>!disposed&&current();const layers=L.layerGroup().addTo(map);host.hidden=false;host.replaceChildren();
    const make=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
    const title=make('h3','Uji kandidat nanas — perlu koreksi');
    const note=make('p','Titik adalah usulan tajuk visual, bukan jumlah nanas tervalidasi. Uji otomatis belum andal. Geser titik untuk memperbaiki posisi. Terima/tolak memakai penilaian Anda; ini tidak mengubah sensus.');note.className='note';
    const select=make('select');select.setAttribute('aria-label','Sampel uji kandidat');trial.samples.forEach(s=>select.add(new Option(s.gawangan+' · '+s.features.length+' kandidat visual',s.id)));
    const open=make('button','Buka sampel dan penanda'),summary=make('p'),status=make('p','Koreksi berada di halaman ini. Ekspor sebelum menutup; belum disimpan di server.');status.setAttribute('role','status');
    const details=make('p','Klik titik untuk memeriksa.'),decision=make('select');decision.setAttribute('aria-label','Keputusan kandidat');[['candidate','Belum diperiksa'],['accepted','Terima sebagai nanas menurut pemeriksa'],['rejected','Tolak kandidat']].forEach(([v,t])=>decision.add(new Option(t,v)));
    const memo=make('input');memo.type='text';memo.maxLength=1000;memo.setAttribute('aria-label','Catatan kandidat');
    const apply=make('button','Terapkan keputusan'),add=make('button','Tambah kandidat di peta'),exportButton=make('button','Ekspor koreksi'),file=make('input');file.type='file';file.accept='.json,.geojson';file.setAttribute('aria-label','Muat kembali koreksi kandidat');
    host.append(title,note,select,open,summary,details,decision,memo,apply,add,exportButton,file,status);
    function changed(){dirty=true;status.textContent='Ada koreksi belum diekspor. Koreksi tidak disimpan di server dan tidak mengubah sensus.';}
    function update(){const c=counts(sample.features);summary.textContent=`${sample.gawangan}: ${c.candidate} belum diperiksa · ${c.accepted} diterima pemeriksa · ${c.rejected} ditolak. Hanya jendela 512 × 512 piksel; bukan total gawangan.`;}
    function pick(feature){selected=feature;const p=feature.properties;details.textContent=p.id+' · '+(p.method==='manual_addition'?'ditambah pemeriksa':'kandidat tajuk visual');decision.value=p.status;memo.value=p.note;apply.disabled=false;}
    function render(){layers.clearLayers();selected=null;apply.disabled=true;details.textContent='Klik titik untuk memeriksa.';update();
      sample.features.forEach((f,index)=>{const p=f.properties,color={candidate:'#d88c00',accepted:'#137f63',rejected:'#a51d36'}[p.status];
        const icon=L.divIcon({className:'dayun-candidate-marker',html:`<span style="background:${color}">${index+1}</span>`,iconSize:[24,24],iconAnchor:[12,12]});
        const marker=L.marker([f.geometry.coordinates[1],f.geometry.coordinates[0]],{icon,draggable:true,title:p.id});marker.addTo(layers);marker.bindTooltip(p.id+' · '+p.status);marker.on('click',()=>{if(alive())pick(f);});
        marker.on('dragend',()=>{if(!alive())return;const point=marker.getLatLng(),coords=[point.lng,point.lat];if(!inside(coords,sample.bounds)){marker.setLatLng([f.geometry.coordinates[1],f.geometry.coordinates[0]]);status.textContent='Posisi harus berada di dalam jendela sampel.';return;}f.geometry.coordinates=coords;p.position_corrected=true;changed();pick(f);});
      });
    }
    async function show(){if(!alive()||busy)return;busy=true;open.disabled=true;const request=++loadSequence;const active=sample;status.textContent='Membuka TIFF privat dan penanda…';
      try{const blob=await(await api(base+'/files/'+active.sourceCrop)).blob();if(!alive()||request!==loadSequence)return;await openRaster(blob,{title:trial.label+' / '+active.sourceCrop,nativeReview:true});if(!alive()||request!==loadSequence)return;
        render();const b=active.bounds;map.fitBounds([[b[1],b[0]],[b[3],b[2]]],{padding:[25,25]});status.textContent=dirty?'Ada koreksi belum diekspor.':'Kandidat visual berwarna jingga; diterima hijau, ditolak merah. Koreksi belum disimpan di server.';
      }catch(error){if(alive())status.textContent='Sampel belum dapat dibuka: '+error.message;}finally{busy=false;if(alive())open.disabled=false;}
    }
    open.onclick=show;select.onchange=()=>{if(!alive())return;loadSequence++;sample=trial.samples.find(s=>s.id===select.value);adding=false;add.textContent='Tambah kandidat di peta';layers.clearLayers();selected=null;apply.disabled=true;update();status.textContent='Klik Buka sampel dan penanda untuk memeriksa citra ini.';};
    apply.onclick=()=>{if(!alive()||!selected)return;selected.properties.status=decision.value;selected.properties.note=memo.value.slice(0,1000);selected.properties.species_confirmed=false;selected.properties.reviewed_at=new Date().toISOString();changed();render();};
    add.onclick=()=>{if(!alive())return;adding=!adding;add.textContent=adding?'Selesai menambah titik':'Tambah kandidat di peta';status.textContent=adding?'Klik pusat tanaman di dalam jendela sampel.':'Mode tambah titik dimatikan.';};
    const onMapClick=event=>{if(!alive()||!adding||busy)return;const coordinates=[event.latlng.lng,event.latlng.lat];if(!inside(coordinates,sample.bounds)){status.textContent='Titik harus berada di jendela sampel yang dipilih.';return;}
      if(sample.features.length>=1000)return;const feature={type:'Feature',geometry:{type:'Point',coordinates},properties:{id:sample.id+'-manual-'+crypto.randomUUID(),sample_id:sample.id,gawangan:sample.gawangan,status:'candidate',method:'manual_addition',species_confirmed:false,note:''}};sample.features.push(feature);changed();render();pick(feature);};map.on('click',onMapClick);
    exportButton.onclick=()=>{if(!alive())return;const value={schema:'dayun-candidate-corrections-v1',dataset_id:trial.dataset_id,source_run:trial.source_run,exported_at:new Date().toISOString(),census_changed:false,not_a_validated_plant_count:true,samples:trial.samples.map(s=>({id:s.id,features:s.features}))};validateReview(value,original);save(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),'dayun-candidate-corrections.json');dirty=false;status.textContent='Koreksi diekspor. Simpan berkas dan gunakan Muat kembali untuk melanjutkan pemeriksaan.';};
    file.onchange=async()=>{if(!alive()||!file.files?.[0])return;try{if(file.files[0].size>2*1024*1024)throw Error('Berkas melebihi 2 MB.');const imported=validateReview(JSON.parse(await file.files[0].text()),original);if(!alive())return;for(const row of imported.samples)trial.samples.find(s=>s.id===row.id).features=JSON.parse(JSON.stringify(row.features));render();dirty=false;status.textContent='Koreksi dimuat untuk uji dan citra yang sama. Tidak ada perubahan pada sensus.';}catch(error){if(alive())status.textContent=error.message;}finally{file.value='';}};
    update();apply.disabled=true;
    return()=>{disposed=true;loadSequence++;map.off('click',onMapClick);map.removeLayer(layers);host.replaceChildren();host.hidden=true;};
  }
  return{mount,validateReview,counts};
});
