(() => {
  'use strict';
  const API = 'https://yg-webgis-public-data.yg-webgis-public-data-worker.workers.dev';
  const $ = id => document.getElementById(id);
  let session, map, areas, rasterLayer, rasterBounds, tileLayer, jobs = [], source = null, sequence = 0;
  let disposeMeritechExport = null;
  let activeController = null, downloadController = null;
  const number = (v, digits = 2) => Number(v).toLocaleString('id-ID', {maximumFractionDigits: digits});
  function validSession() {
    const current = window.YG_AUTH?.readStoredSession();
    return current && current.token === session?.token && Number(current.expiresAt) > Date.now();
  }
  function lock(message) {
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
    if (!response.ok) throw Error(`Layanan mengembalikan HTTP ${response.status}.`);
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
    map = L.map('map', {preferCanvas: true}).setView([1.48,102.25], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 22, maxNativeZoom: 19, attribution: '&copy; OpenStreetMap'}).addTo(map);
    areas = L.featureGroup().addTo(map);
    map.addControl(new L.Control.Draw({draw:{polygon:{allowIntersection:false},polyline:true,rectangle:true,circle:false,circlemarker:false,marker:false}, edit:{featureGroup:areas}}));
    map.on(L.Draw.Event.CREATED, event => { event.layer.feature={type:'Feature',properties:{source:source?.title || 'Peta referensi',sourceId:source?.id || null},geometry:event.layer.toGeoJSON().geometry}; areas.addLayer(event.layer); updateMeasurements(); });
    map.on('draw:edited draw:deleted', updateMeasurements);
    map.on('mousemove', event => { $('coordinate').textContent = `${event.latlng.lat.toFixed(6)}, ${event.latlng.lng.toFixed(6)}`; });
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
  async function openRaster(input, details) {
    if (!validSession()) return lock('Sesi berakhir. Silakan masuk kembali.');
    const request = ++sequence;
    activeController?.abort(); activeController = new AbortController();
    const signal = activeController.signal;
    if (rasterLayer) {map.removeLayer(rasterLayer);rasterLayer=null;}
    source=null; $('downloadTiff').disabled=true; $('fitRaster').disabled=true;
    $('mapStatus').textContent='Membaca metadata GeoTIFF…';metadata([['Sumber',details.title],['Status','Sedang dibaca']]);
    try {
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
      if (request!==sequence || !validSession()) return;
      const layer=new GeoRasterLayer({georaster,debugLevel:0,resolution:128,opacity:Number($('opacity').value),updateWhenZooming:false,updateWhenIdle:true,keepBuffer:1,pixelValuesToColorFn:values=>{
        if (!values.slice(0,3).every(Number.isFinite) || (hasAlpha && values[3]===0) || (noData!==null && values.slice(0,3).every(v=>v===noData))) return null;
        let [r,g,b]=values;
        if(ycbcr){r=values[0]+1.402*(values[2]-128);g=values[0]-.34414*(values[1]-128)-.71414*(values[2]-128);b=values[0]+1.772*(values[1]-128);}
        return `rgb(${[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v)))).join(',')})`;
      }});
      layer.options.updateWhenZooming=false;
      layer.on('tileerror',()=>{if(request===sequence)$('mapStatus').textContent='Sebagian citra gagal dibaca. Coba buka ulang hasil atau periksa koneksi.';});
      layer.addTo(map);rasterLayer=layer;rasterBounds=layer.getBounds();map.fitBounds(rasterBounds);
      source={...details,input};$('fitRaster').disabled=false;$('downloadTiff').disabled=input instanceof Blob;
      metadata([['Sumber',details.title],['Tanggal survei',details.surveyDate || 'Belum tersedia'],['Sistem koordinat',`EPSG:${projection}`],['Dimensi',`${number(image.getWidth(),0)} × ${number(image.getHeight(),0)} piksel`],['Ukuran piksel (satuan CRS)',`${number(Math.abs(rx),8)} × ${number(Math.abs(ry),8)}`],['Foto digunakan',details.validPhotos ?? 'Tidak tersedia'],['Akses','Internal staf']]);
      $('mapStatus').textContent='Citra siap ditinjau. Pembacaan mengikuti area peta dan tingkat pembesaran.';
    } catch(error) { if(request!==sequence)return;metadata([['Sumber',details.title],['Status','Gagal dibaca']]);$('mapStatus').textContent=`GeoTIFF belum dapat dibuka: ${error.message}`; }
  }
  $('retryGate').onclick=authorize;
  $('refreshJobs').onclick=async()=>{try{jobs=(await (await api('/api/staff/drone/jobs')).json()).jobs || [];renderJobs();}catch(e){$('catalogStatus').textContent=e.message;}};
  $('job').onchange=()=>{$('openJob').disabled=!$('job').value;};
  $('openJob').onclick=()=>{const job=jobs.find(j=>j.id===$('job').value);if(job)openRaster(`${API}/api/drone/jobs/${encodeURIComponent(job.id)}/cog`,job);};
  $('localTiff').onchange=event=>{const file=event.target.files[0];if(file)openRaster(file,{title:file.name});};
  $('opacity').oninput=()=>rasterLayer?.setOpacity(Number($('opacity').value));
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
  window.addEventListener('beforeunload',event=>{if(areas?.getLayers().length){event.preventDefault();event.returnValue='';}});
  authorize();
})();

