(() => {
  'use strict';
  const API = 'https://webgis-api.yayasangambut.org';
  const $ = id => document.getElementById(id);
  const requestedSample=(()=>{
    if(typeof URLSearchParams==='undefined')return null;
    const q=new URLSearchParams(window.location?.search||'');
    const source=q.get('source'),trial=q.get('trial'),sample=q.get('sample'),point=q.get('point');
    if(source==='Agro_ABC'&&['A','B'].includes(q.get('block')))return{source,block:q.get('block')};
    if(!['Agro_ABC','Agro_DEF'].includes(source)||!trial||!/^[\w-]{1,64}$/.test(trial)||!sample||!/^[\w-]{1,100}$/.test(sample)||(point&&!/^[\w-]{1,100}$/.test(point)))return null;
    return{source,trial,sample,point};
  })();
  if(requestedSample){const q=new URLSearchParams(requestedSample.block?{source:requestedSample.source,block:requestedSample.block}:{source:requestedSample.source,trial:requestedSample.trial,sample:requestedSample.sample});if(requestedSample.point)q.set('point',requestedSample.point);$('sampleLogin').href='staff-login.html?return='+encodeURIComponent('orthomosaic-internal.html?'+q.toString());}
  let initialLinkOpened=false;
  let session, map, areas, rasterLayer, rasterBounds, tileLayer, jobs = [], source = null, rasterContext = null, sequence = 0;
  let disposeMeritechExport = null, disposeCandidateReview=null, disposeBlockReview=null, dayunLayer = null, dayunUrls = [], dayunRequest=0;
  const nativeRasters=new Set();
  function clearNativeRasters(){for(const raster of [...nativeRasters])raster.dispose();}
  function clearDayun() {
    dayunRequest++;clearNativeRasters();
    if(rasterContext?.nativeReview||rasterContext?.dayunReview){sequence++;activeController?.abort();if(rasterLayer&&map)map.removeLayer(rasterLayer);rasterLayer=null;rasterBounds=null;source=null;rasterContext=null;$('metadata').replaceChildren();$('fitRaster').disabled=true;$('downloadTiff').disabled=true;}
    disposeCandidateReview?.();disposeCandidateReview=null;
    disposeBlockReview?.();disposeBlockReview=null;
    dayunUrls.forEach(url=>URL.revokeObjectURL(url)); dayunUrls=[];
    if(dayunLayer && map)map.removeLayer(dayunLayer);dayunLayer=null;
    $('dayunResults').replaceChildren();
    $('blockComparison').replaceChildren();$('blockComparison').hidden=true;
  }
  let activeController = null, downloadController = null;
  const number = (v, digits = 2) => Number(v).toLocaleString('id-ID', {maximumFractionDigits: digits});
  function validSession() {
    const current = window.YG_AUTH?.readStoredSession();
    return current && current.token === session?.token && Number(current.expiresAt) > Date.now();
  }
  function lock(message) {
    document.querySelector?.('.map-card')?.classList.remove('map-expanded');
    document.body?.classList.remove('map-expanded-open');
    $('focusMap').textContent='Perbesar ruang peta';
    $('focusMap').setAttribute?.('aria-pressed','false');
    clearDayun();
    $('dayunRequests').replaceChildren();
    sequence++;
    disposeMeritechExport?.(); disposeMeritechExport = null;
    activeController?.abort(); downloadController?.abort();
    $('workspace').hidden = true;
    $('gate').hidden = false;
    $('gateStatus').textContent = message;
    if (map) { map.remove(); map = null; }
    rasterLayer = null; source = null; jobs = [];
    $('job').replaceChildren(new Option('Pilih hasil yang sudah selesai', ''));
    $('metadata').replaceChildren();
    $('measurements').replaceChildren();
    $('localTiff').value = '';
  }
  async function api(path, options = {}) {
    if (!validSession()) { lock('Sesi berakhir. Silakan masuk kembali.'); throw Error('Sesi staf tidak aktif.'); }
    const response = await fetch(API + path, {...options, headers: {...options.headers, Authorization: `Bearer ${session.token}`}, cache: 'no-store', signal: options.signal || AbortSignal.timeout(30000)});
    if (response.status === 401 || response.status === 403) { lock('Akses staf tidak valid. Silakan masuk kembali.'); throw Error('Akses ditolak.'); }
    if (!response.ok) {const error=Error(`Layanan mengembalikan HTTP ${response.status}.`);error.status=response.status;try{error.details=await response.json();}catch{}throw error;}
    return response;
  }
  async function authorize() {
    session = window.YG_AUTH?.readStoredSession();
    if (!session) { lock('Masuk sebagai staf untuk membuka analisis internal.'); return; }
    $('gateStatus').textContent = 'Memeriksa akses staf…';
    try {
      const data = await (await api('/api/staff/drone/jobs')).json();
      if (!validSession()) return lock('Sesi berakhir. Silakan masuk kembali.');
      jobs = Array.isArray(data.jobs) ? data.jobs : [];
      if (!window.L || !window.GeoTIFF || !window.GeoRasterLayer || !window.turf) throw Error('Pustaka peta belum termuat. Muat ulang halaman.');
      $('gate').hidden = true; $('workspace').hidden = false;
      if (!map) initMap();
      renderJobs();
      refreshDayunRequests();
      if(requestedSample&&!initialLinkOpened){initialLinkOpened=true;$('dayunSource').value=requestedSample.source;if(requestedSample.block)$('dayunBlock').value=requestedSample.block;await $('openDayun').onclick();}
    } catch (error) { $('gateStatus').textContent = `Analisis belum dapat dibuka: ${error.message}`; }
  }
  function renderJobs() {
    const selected = $('job').value;
    $('job').replaceChildren(new Option('Pilih hasil yang sudah selesai', ''));
    const ready = jobs.filter(job => job.status === 'ready' && job.cogKey);
    ready.forEach(job => $('job').add(new Option(job.title || job.id, job.id)));
    $('job').value = selected;
    $('openJob').disabled = !$('job').value;
    $('catalogStatus').textContent = `${ready.length} hasil siap dibuka dari ${jobs.length} proses terbaru. Proses yang gagal atau belum selesai dapat diperiksa di halaman Survei drone.`;
  }
  function initMap() {
    map = L.map('map', {preferCanvas: true,maxZoom:26}).setView([1.48,102.25], 10);
    const imageryPane=map.createPane('ortho-imagery');imageryPane.style.zIndex='300';imageryPane.style.pointerEvents='none';
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 26, maxNativeZoom: 19, referrerPolicy: 'origin', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(map);
    areas = L.featureGroup().addTo(map);
    map.addControl(new L.Control.Draw({draw:{polygon:{allowIntersection:false},polyline:true,rectangle:true,circle:false,circlemarker:false,marker:false}, edit:{featureGroup:areas}}));
    map.on(L.Draw.Event.CREATED, event => { event.layer.feature={type:'Feature',properties:{source:source?.title || 'Peta referensi',sourceId:source?.id || null},geometry:event.layer.toGeoJSON().geometry}; areas.addLayer(event.layer); updateMeasurements(); });
    map.on('draw:edited draw:deleted', updateMeasurements);
    map.on('mousemove', event => { $('coordinate').textContent = `${event.latlng.lat.toFixed(6)}, ${event.latlng.lng.toFixed(6)}`; });
    $('focusMap').onclick=()=>{
      const card=document.querySelector('.map-card'),expanded=card.classList.toggle('map-expanded');
      document.body.classList.toggle('map-expanded-open',expanded);
      $('focusMap').textContent=expanded?'Kembali ke halaman':'Perbesar ruang peta';
      $('focusMap').setAttribute('aria-pressed',String(expanded));
      requestAnimationFrame(()=>map?.invalidateSize());
    };
    $('meritech').checked = false;
    disposeMeritechExport = window.YG_MERITECH_EXPORT?.mount($('meritechDownload'), map, () => validSession() ? session : null);
  }
  function features() {
    return areas.getLayers().map((layer,index) => {
      const feature = layer.toGeoJSON();
      const polygon = /Polygon/.test(feature.geometry.type);
      feature.properties = {name: `${polygon?'Area':'Garis'} ${index+1}`, source: feature.properties.source || 'Peta referensi', sourceId: feature.properties.sourceId || null, measuredAt: new Date().toISOString(), method:'digitasi_manual', ...(polygon ? {areaHa:turf.area(feature)/10000} : {lengthM:turf.length(feature,{units:'kilometers'})*1000})};
      return feature;
    });
  }
  function updateMeasurements() {
    const list = features(); $('measurements').replaceChildren();
    list.forEach((feature,index) => {
      const p=feature.properties, result=p.areaHa !== undefined ? `${number(p.areaHa,4)} ha` : `${number(p.lengthM)} m`;
      const tr=document.createElement('tr'); [p.name,result].forEach(value => {const td=document.createElement('td');td.textContent=value;tr.append(td);}); $('measurements').append(tr);
      areas.getLayers()[index].bindTooltip(`${p.name}: ${result}`);
    });
    if (!list.length) { const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=2;td.textContent='Belum ada geometri analisis.';tr.append(td);$('measurements').append(tr); }
    $('exportAreas').disabled = $('clearAreas').disabled = !list.length;
  }
  function save(blob, name) {
    const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  function metadata(entries) {
    $('metadata').replaceChildren();
    for (const [label,value] of entries) { const dt=document.createElement('dt'), dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('metadata').append(dt,dd); }
  }
  async function readRasterLayer(input,details,signal){
      const tiff = input instanceof Blob ? await GeoTIFF.fromBlob(input) : await GeoTIFF.fromUrl(input, {headers:{Authorization:`Bearer ${session.token}`}, allowFullFile:false, cacheSize:32}, signal);
      const image = await tiff.getImage(), keys=image.getGeoKeys(), directory=image.getFileDirectory();
      const projection=keys.ProjectedCSTypeGeoKey || keys.GeographicTypeGeoKey;
      if (!projection || projection===32767) throw Error('Sistem koordinat EPSG tidak ditemukan. Gunakan GeoTIFF dengan CRS yang terdefinisi.');
      if (directory.ModelTransformation) throw Error('GeoTIFF dengan transformasi rotasi belum didukung. Ekspor ulang sebagai raster north-up.');
      if (![2,6].includes(directory.PhotometricInterpretation) || image.getSamplesPerPixel()<3 || [...directory.BitsPerSample].some(v=>v!==8)) throw Error('Viewer ini mendukung orthomosaic RGB/YCbCr 8-bit. Dataset ini memerlukan viewer khusus.');
      const [xmin,ymin,xmax,ymax]=image.getBoundingBox(), [rx,ry]=image.getResolution();
      if (!(rx>0 && ry<0)) throw Error('Orientasi raster belum didukung. Gunakan GeoTIFF north-up.');
      const noData=image.getGDALNoData(), ycbcr=directory.PhotometricInterpretation===6;
      const hasAlpha=Array.from(directory.ExtraSamples || []).some(value=>value===1 || value===2);
      const georaster={projection,xmin,ymin,xmax,ymax,width:image.getWidth(),height:image.getHeight(),pixelWidth:Math.abs(rx),pixelHeight:Math.abs(ry),numberOfRasters:image.getSamplesPerPixel(),noDataValue:noData,sourceType:'url',rasterType:'geotiff',_geotiff:tiff,
        getValues: async ({left,top,right,bottom,width,height}) => {
          if (!validSession() || signal.aborted) throw Error('Sesi atau pembacaan telah berakhir.');
          const values=await tiff.readRasters({window:[left,top,right,bottom],width,height,resampleMethod:'nearest',signal});
          return Array.from(values,band=>Array.from({length:height},(_,row)=>band.subarray(row*width,(row+1)*width)));
        }};
      const layer=new GeoRasterLayer({georaster,pane:'ortho-imagery',debugLevel:0,resolution:details.nativeReview?256:128,maxZoom:26,opacity:Number($('opacity').value),updateWhenZooming:false,updateWhenIdle:true,keepBuffer:1,pixelValuesToColorFn:values=>{
        if (!values.slice(0,3).every(Number.isFinite) || (hasAlpha && values[3]===0) || (noData!==null && values.slice(0,3).every(v=>v===noData))) return null;
        let [r,g,b]=values;
        if(ycbcr){r=values[0]+1.402*(values[2]-128);g=values[0]-.34414*(values[1]-128)-.71414*(values[2]-128);b=values[0]+1.772*(values[1]-128);}
        return `rgb(${[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v)))).join(',')})`;
      }});
      return {layer,image,projection,rx,ry};
  }
  async function openNativeRaster(input,details){
    if(!validSession()||details.signal?.aborted)return false;
    if(!source?.nativeViewport){sequence++;activeController?.abort();clearNativeRasters();if(rasterLayer&&map)map.removeLayer(rasterLayer);rasterLayer=null;}
    const epoch=sequence,controller=new AbortController();
    source={title:details.title,nativeViewport:true};rasterContext={dayunReview:true};
    let layer;
    const state={ready:false,error:null,disposed:false,dispose(){if(state.disposed)return;state.disposed=true;state.ready=false;controller.abort();if(layer&&map)map.removeLayer(layer);nativeRasters.delete(state);details.signal?.removeEventListener('abort',cancel);}};
    const cancel=()=>state.dispose();
    details.signal?.addEventListener('abort',cancel,{once:true});
    nativeRasters.add(state);if(details.signal?.aborted)state.dispose();
    const alive=()=>!state.disposed&&epoch===sequence&&validSession();
    const changed=()=>{if(alive())details.onState?.(state);};
    try{
      const raster=await readRasterLayer(input.startsWith('/api/staff/drone/analysis/')?API+input:input,{...details,nativeReview:true},controller.signal);
      if(!alive()){state.dispose();return false;}layer=raster.layer;
      layer.on('loading',()=>{state.ready=false;state.error=null;changed();});
      layer.on('tileerror',()=>{state.ready=false;state.error='Piksel TIFF gagal dimuat';changed();});
      layer.on('load',()=>{state.ready=!state.error;changed();});
      state.setOpacity=value=>layer.setOpacity(value);
      layer.addTo(map);
      rasterBounds=details.blockBounds||layer.getBounds();$('fitRaster').disabled=false;$('downloadTiff').disabled=true;
      metadata([['Sumber',details.title],['Sistem koordinat',`EPSG:${raster.projection}`],['Ukuran piksel (satuan CRS)',`${number(Math.abs(raster.rx),8)}  x  ${number(Math.abs(raster.ry),8)}`],['Akses','Internal staf; pembacaan TIFF bertahap']]);
      return state;
    }catch(error){state.dispose();if(epoch===sequence&&validSession())throw error;return false;}
  }
  async function openRaster(input, details) {
    if (!validSession()) {lock('Sesi berakhir. Silakan masuk kembali.');return false;}
    disposeBlockReview?.suspendNative?.();
    const request = ++sequence;clearNativeRasters();
    rasterContext=details;
    activeController?.abort(); activeController = new AbortController();
    const signal = activeController.signal;
    if (rasterLayer) {map.removeLayer(rasterLayer);rasterLayer=null;}
    source=null; $('downloadTiff').disabled=true; $('fitRaster').disabled=true;
    $('mapStatus').textContent='Membaca metadata GeoTIFF…';metadata([['Sumber',details.title],['Status','Sedang dibaca']]);
    try {
      const {layer,image,projection,rx,ry}=await readRasterLayer(input,details,signal);
      if (request!==sequence || !validSession()) return false;
      layer.options.updateWhenZooming=false;
      let rendered=false,tileFailed=false;
      layer.on('loading',()=>{rendered=false;tileFailed=false;if(request===sequence){if(source){source.ready=false;source.renderError=false;}$('mapStatus').textContent=details.nativeReview?'Memuat piksel TIFF asli…':'Memuat piksel citra…';}});
      layer.on('tileerror',()=>{tileFailed=true;rendered=false;if(request===sequence){if(source){source.ready=false;source.renderError=true;}$('mapStatus').textContent='Sebagian citra gagal dibaca. Coba buka ulang hasil atau periksa koneksi.';}});
      layer.on('load',()=>{rendered=!tileFailed;if(request===sequence){if(source)source.ready=rendered;$('mapStatus').textContent=rendered?(details.nativeReview?'TIFF asli siap diperiksa. Area di luar potongan aktif masih pratinjau; geser peta untuk memuat potongan berikutnya.':'Citra siap ditinjau.'): 'Sebagian piksel citra gagal dimuat; jangan menempatkan titik pada area yang belum jelas.';}});
      layer.addTo(map);rasterLayer=layer;rasterBounds=layer.getBounds();if(!details.preserveView)map.fitBounds(rasterBounds);
      source={...details,input,ready:rendered,renderError:tileFailed};$('fitRaster').disabled=false;$('downloadTiff').disabled=input instanceof Blob;
      metadata([['Sumber',details.title],['Tanggal survei',details.surveyDate || 'Belum tersedia'],['Sistem koordinat',`EPSG:${projection}`],['Dimensi',`${number(image.getWidth(),0)} × ${number(image.getHeight(),0)} piksel`],['Ukuran piksel (satuan CRS)',`${number(Math.abs(rx),8)} × ${number(Math.abs(ry),8)}`],['Foto digunakan',details.validPhotos ?? 'Tidak tersedia'],['Akses','Internal staf']]);
      if(!rendered)$('mapStatus').textContent=details.nativeReview?'Memuat TIFF asli; tunggu sampai piksel siap diperiksa…':'Citra siap ditinjau. Pembacaan mengikuti area peta dan tingkat pembesaran.';
      return true;
    } catch(error) { if(request!==sequence)return false;metadata([['Sumber',details.title],['Status','Gagal dibaca']]);$('mapStatus').textContent=`GeoTIFF belum dapat dibuka: ${error.message}`;return false; }
  }
  $('retryGate').onclick=authorize;
  const analysisStages={pending:'Menunggu mesin',processing:'Sedang diproses',coverage_ready:'Cakupan dan potongan siap; hitungan nanas belum tervalidasi',blocked:'Terhambat akses atau konfigurasi mesin',failed:'Pemrosesan gagal'};
  const analysisSteps={verifying_access:'Memeriksa izin baca Drive',restoring_source:'Memulihkan unduhan sebelumnya',downloading:'Mengunduh dan memverifikasi TIFF',checkpointing:'Unduhan terverifikasi; menyimpan sumber privat',cropping_and_measuring_coverage:'Memotong citra asli dan mengukur cakupan gawangan',saving_private_results:'Menyimpan potongan, peta, dan tabel privat'};
  const analysisErrors={drive_credentials_missing:'Sambungan Google Drive mesin belum aktif',drive_credentials_invalid:'Sambungan Google Drive perlu diperiksa admin',drive_authenticated_request_failed:'Mesin belum dapat mengakses Google Drive',drive_access_denied:'Akun mesin belum mendapat akses baca',drive_file_missing_or_not_shared:'Citra belum dibagikan kepada akun mesin',drive_api_disabled:'Layanan Drive mesin belum aktif',drive_scope_insufficient:'Izin baca Drive belum sesuai',insufficient_runner_disk:'Ruang pemrosesan tidak mencukupi'};
  async function refreshDayunRequests(){
    if(!validSession())return;
    try{
      const data=await(await api('/api/staff/drone/analysis/requests')).json();
      if(!validSession())return;
      $('dayunRequests').replaceChildren();
      for(const job of data.jobs||[]){
        if(!['Agro_ABC','Agro_DEF'].includes(job.label))continue;
        const row=document.createElement('p');row.textContent=`${job.label}: ${job.status==='processing'&&analysisSteps[job.stage]?analysisSteps[job.stage]:(analysisStages[job.status]||'Status belum tersedia')}${job.error?' — '+(analysisErrors[job.error]||'Admin perlu memeriksa proses ini'):''}`;
        $('dayunRequests').append(row);
        if(job.status==='coverage_ready'){
          const button=document.createElement('button');button.textContent=`Buka hasil ${job.label}`;
          button.onclick=()=>{$('dayunSource').value=job.label;$('openDayun').onclick();};$('dayunRequests').append(button);
        }
      }
    }catch(error){$('dayunQueueStatus').textContent=`Status belum dapat dimuat: ${error.message}`;}
  }
  $('refreshDayunRequests').onclick=refreshDayunRequests;
  $('submitDayun').onclick=async()=>{
    if(!validSession())return;
    const driveUrl=$('dayunDriveUrl').value.trim();
    if(!driveUrl){$('dayunQueueStatus').textContent='Tempel link berkas GeoTIFF terlebih dahulu.';return;}
    $('submitDayun').disabled=true;
    try{
      const data=await(await api('/api/staff/drone/analysis/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({driveUrl})})).json();
      if(!validSession())return;
      $('dayunQueueStatus').textContent=`${data.job.label} ${data.reused?'sudah ada dalam proses':'masuk antrean'}. Mesin akan memeriksa akses dan mengunduh citra; analisis belum selesai.`;
      await refreshDayunRequests();
    }catch(error){$('dayunQueueStatus').textContent=`Permintaan belum berhasil: ${error.message}`;}
    finally{$('submitDayun').disabled=false;}
  };
  setInterval(refreshDayunRequests,30000);
  let displayedBlock='A';
  $('dayunBlock').onchange=()=>{if(disposeBlockReview?.canLeave&&!disposeBlockReview.canLeave()){$('dayunBlock').value=displayedBlock;$('dayunStatus').textContent='Simpan atau ekspor koreksi sebelum mengganti blok.';return;}$('openDayun').onclick();};
  $('openDayun').onclick=async()=>{
    if(disposeBlockReview?.canLeave&&!disposeBlockReview.canLeave()){$('dayunStatus').textContent='Simpan atau ekspor koreksi titik sebelum mengganti hasil.';return;}
    clearDayun();
    const request=dayunRequest;
    const current=()=>validSession() && request===dayunRequest;
    const selected=$('dayunSource').value;
    const target=requestedSample?.source===selected&&requestedSample.sample?requestedSample:null;
    const block=['A','B'].includes($('dayunBlock').value)?$('dayunBlock').value:'A';displayedBlock=block;
    const blockTarget=selected==='Agro_ABC'&&!requestedSample?.sample;
    if(!['Agro_ABC','Agro_DEF'].includes(selected))return;
    const base=`/api/staff/drone/analysis/${selected}`;
    $('dayunStatus').textContent='Memeriksa hasil…';
    try {
      const manifest=await(await api(base)).json();
      if(!current())return;
      if(!manifest.download?.ok){$('dayunStatus').textContent=`Belum diunduh: ${manifest.download?.error||'status tidak tersedia'}`;return;}
      if(!manifest.analysis?.ok || !manifest.files?.includes('metadata.json')){$('dayunStatus').textContent='Unduhan selesai; analisis belum tersedia atau belum lengkap.';return;}
      const meta=await(await api(base+'/files/metadata.json')).json();
      if(!current())return;
      $('dayunStatus').textContent='Cakupan citra tersedia. Luas tanam, celah barisan, dan jumlah nanas masih memerlukan pemeriksaan visual. Tanggal penerbangan belum terverifikasi.';
      const details=document.createElement('p');details.textContent=`CRS: ${meta.crs||'belum diketahui'}. Ukuran piksel: ${Array.isArray(meta.gsd_m)?meta.gsd_m.map(v=>number(v*100,2)).join(' × ')+' cm':'belum tersedia dalam meter'}. Tanggal penerbangan: ${['verified','owner_reported'].includes(meta.capture_date_status)&&meta.capture_date?meta.capture_date+(meta.capture_date_status==='owner_reported'?' (keterangan pemilik data)':''):'belum terverifikasi'}.`;$('dayunResults').append(details);
      const table=document.createElement('table'),head=document.createElement('tr');
      ['Gawangan','Cakupan seluruh polygon','Luas citra valid (ha)'].forEach(value=>{const th=document.createElement('th');th.textContent=value;head.append(th);});table.append(head);
      for(const row of meta.gawangan||[]){const tr=document.createElement('tr');[row.gawangan,row.valid_coverage_percent===null?'Belum tersedia':`${row.valid_coverage_percent}%`,row.valid_area_ha??'Belum tersedia'].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});table.append(tr);}
      $('dayunResults').append(table);
      if(!target&&manifest.files.includes('coverage.geojson')){
        const geo=await(await api(base+'/files/coverage.geojson')).json();
        if(!current())return;
        dayunLayer=L.geoJSON(geo,{style:f=>({color:(f.properties.valid_coverage_percent??0)<95?'#d97706':'#137f63',weight:2,fillOpacity:.12}),onEachFeature:(f,l)=>l.bindTooltip(String(f.properties.gawangan))}).addTo(map);
        map.fitBounds(dayunLayer.getBounds());
      }
      if(!target&&manifest.files.includes('overview.jpg')){
        const blob=await(await api(base+'/files/overview.jpg')).blob();if(!current())return;
        const url=URL.createObjectURL(blob);dayunUrls.push(url);const img=document.createElement('img');img.src=url;img.alt='Pratinjau orthomosaic Dayun';img.style.width='100%';$('dayunResults').append(img);
      }
      const label=document.createElement('p');label.textContent='Unduh laporan, tabel, atau potongan asli:';$('dayunResults').append(label);
      const select=document.createElement('select');
      for(const file of manifest.files){select.add(new Option(file,file));}
      const button=document.createElement('button');button.textContent='Unduh hasil terpilih';
      button.onclick=async()=>{try{const response=await api(base+'/files/'+select.value);const blob=await response.blob();if(current())save(blob,select.value.split('/').pop());}catch(e){if(current())$('dayunStatus').textContent=e.message;}};
      const inspect=document.createElement('button');inspect.textContent='Buka potongan terpilih di peta';
      inspect.onclick=async()=>{
        const file=select.value;
        if(!file.endsWith('.tif')){$('dayunStatus').textContent='Pilih potongan .tif untuk memeriksa citra berkoordinat di peta.';return;}
        try{const blob=await(await api(base+'/files/'+file)).blob();if(current())await openRaster(blob,{title:`${selected} / ${file}`,dayunReview:true});}catch(e){if(current())$('dayunStatus').textContent=e.message;}
      };
      $('dayunResults').append(select);$('dayunResults').append(inspect);$('dayunResults').append(button);
      if(!target&&window.YG_DAYUN_BLOCK){
        try{const expand=()=>{if(current()){const card=document.querySelector?.('.map-card');if(card&&!card.classList.contains('map-expanded'))$('focusMap').onclick?.();}};const dispose=await window.YG_DAYUN_BLOCK.mount({host:$('blockReview'),comparisonHost:$('blockComparison'),map,api,base,manifest,block,openRaster,openNativeRaster,getRasterSource:()=>source||(rasterContext?{...rasterContext,pending:true}:null),onNativeStatus:text=>{$('mapStatus').textContent=text;},save,current,autoOpen:blockTarget,onAutoOpen:expand,onEditMap:expand,onShowComparison:()=>{const card=document.querySelector?.('.map-card');if(card?.classList.contains('map-expanded'))$('focusMap').onclick?.();}});if(current()){disposeBlockReview=dispose;if(manifest.block_analyses?.[block])$('sampleReviewPanel').open=Boolean(manifest.preferred_candidate_trial)&&!blockTarget;}else dispose();}
        catch(error){if(current())$('dayunStatus').textContent+=' Analisis blok belum dapat dimuat: '+error.message;}
      }
      if(window.YG_DAYUN_CANDIDATES){
        try{const dispose=await window.YG_DAYUN_CANDIDATES.mount({host:$('candidateReview'),map,api,base,manifest,openRaster,save,current,
          initialTrial:target?.trial,initialSample:target?.sample,initialPoint:target?.point,autoOpen:Boolean(target),
          onAutoOpen:()=>{if(current()){$('sampleReviewPanel').open=true;const card=document.querySelector?.('.map-card');if(card&&!card.classList.contains('map-expanded'))$('focusMap').onclick?.();}}
        });if(current())disposeCandidateReview=dispose;else dispose();}
        catch(error){if(current())$('dayunStatus').textContent+=' Uji kandidat belum dapat dimuat: '+error.message;}
      }
    }catch(e){if(current())$('dayunStatus').textContent=`Hasil privat belum tersedia: ${e.message}`;}
  };
  $('refreshJobs').onclick=async()=>{try{jobs=(await (await api('/api/staff/drone/jobs')).json()).jobs || [];renderJobs();}catch(e){$('catalogStatus').textContent=e.message;}};
  $('job').onchange=()=>{$('openJob').disabled=!$('job').value;};
  $('openJob').onclick=()=>{const job=jobs.find(j=>j.id===$('job').value);if(job)openRaster(`${API}/api/drone/jobs/${encodeURIComponent(job.id)}/cog`,job);};
  $('localTiff').onchange=event=>{const file=event.target.files[0];if(file)openRaster(file,{title:file.name});};
  $('opacity').oninput=()=>{const opacity=Number($('opacity').value);rasterLayer?.setOpacity(opacity);for(const raster of nativeRasters)raster.setOpacity?.(opacity);};
  $('fitRaster').onclick=()=>{if(rasterBounds)map.fitBounds(rasterBounds);};
  $('bengkalis').onclick=()=>map.fitBounds([[1.40,102.00],[1.65,102.52]]);
  $('meritech').onchange=()=>{
    if(tileLayer){map.removeLayer(tileLayer);tileLayer=null;}
    if(!$('meritech').checked){$('tileStatus').textContent='Tile Meritech disembunyikan.';return;}
    $('tileStatus').textContent='Mencoba memuat tile Meritech. Sumber dan tanggal belum terverifikasi.';
    let errors=0;
    tileLayer=L.tileLayer('https://petadasar.meritech.cloud/tile/{z}/{x}/{y}.jpg',{maxZoom:22,maxNativeZoom:19,attribution:'Meritech · metadata belum terverifikasi'});
    tileLayer.on('tileerror',()=>{if(++errors>=3){$('tileStatus').textContent='Tile tidak dapat dimuat (akses, jaringan, atau cakupan). GeoTIFF asli belum tersedia.';if(tileLayer)map.removeLayer(tileLayer);tileLayer=null;$('meritech').checked=false;}});
    tileLayer.on('tileload',()=>{if(tileLayer)$('tileStatus').textContent='Tile JPG tampil. Tanggal, cakupan penuh, dan resolusi sumber belum terverifikasi.';});
    tileLayer.addTo(map);if(rasterLayer)rasterLayer.bringToFront();
  };
  $('exportAreas').onclick=()=>{if(validSession())save(new Blob([JSON.stringify({type:'FeatureCollection',features:features()},null,2)],{type:'application/geo+json'}),'analisis-orthomosaic.geojson');};
  $('clearAreas').onclick=()=>{if(confirm('Hapus seluruh geometri yang belum diekspor?')){areas.clearLayers();updateMeasurements();}};
  $('downloadTiff').onclick=async()=>{
    const selected=source;if(!selected || selected.input instanceof Blob)return;
    $('downloadTiff').disabled=true;$('mapStatus').textContent='Menyiapkan unduhan GeoTIFF sumber…';
    try {
      const path=`/api/drone/jobs/${encodeURIComponent(selected.id)}/cog`;
      // File System Access writes directly to disk, avoiding a full-raster memory copy.
      let handle=null;if(window.showSaveFilePicker)handle=await window.showSaveFilePicker({suggestedName:`${selected.id}.tif`,types:[{description:'GeoTIFF',accept:{'image/tiff':['.tif']}}]});
      downloadController=new AbortController();
      const response=await api(path,{signal:downloadController.signal});
      if(handle){const writable=await handle.createWritable();await response.body.pipeTo(writable);}
      else {const size=Number(response.headers.get('content-length'));if(!size || size>256*1024*1024){await response.body.cancel();throw Error('Untuk unduhan besar, gunakan Chrome atau Edge yang mendukung penyimpanan langsung ke disk.');}save(await response.blob(),`${selected.id}.tif`);}
      $('mapStatus').textContent='Unduhan GeoTIFF sumber selesai.';
    }catch(e){$('mapStatus').textContent=e.name==='AbortError'?'Unduhan dibatalkan.':`Unduhan belum selesai: ${e.message}`;}
    finally{downloadController=null;$('downloadTiff').disabled=!source || source.input instanceof Blob;}
  };
  setInterval(()=>{if(session && !validSession())lock('Sesi berakhir. Silakan masuk kembali.');},15000);
  window.addEventListener('pagehide',()=>activeController?.abort());
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.querySelector?.('.map-expanded'))$('focusMap').onclick?.();});
  window.addEventListener('beforeunload',event=>{if(areas?.getLayers().length){event.preventDefault();event.returnValue='';}});
  authorize();
})();

