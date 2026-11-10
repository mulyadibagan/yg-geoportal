(function () {
  'use strict';
  const A = window.YG_RESTORATION;
  const C = window.YG_RESTORATION_CATALOG;
  const I = window.YG_RESTORATION_INVENTORY;
  const $ = id => document.getElementById(id);
  const BASE = 'https://webgis-api.yayasangambut.org';
  const state = { map: null, peat: [], boundary: null, filtered: [], cache: new Map(), layers: new Map(), session: null };
  state.khgCandidates = []; state.khgFeatures = []; state.khgLayer = null; state.khgMode = null; state.fegGroups = null;
  state.pendingData = new Map();
  const definitions = [
    { id: 'peat', label: 'Gambut BBSDLP 2019', path: 'data/Gambut_BBSDLP_2019.geojson', color: '#7e8982', note: 'Unit referensi analisis, bukan hasil prioritas' },
    { id: 'khg', label: 'KHG', note: 'Data belum tersedia · batas dan relasi spasial belum terverifikasi' },
    { id: 'feg', label: 'Fungsi ekosistem gambut SK.130', path: 'data/FEG_SK130_RIAU.geojson', color: '#905ead', private: true, note: 'Endpoint staf eksisting · konteks seluruh Riau' },
    { id: 'canals', label: 'Jaringan kanal', note: 'Data belum tersedia · titik sekat bukan jaringan kanal' },
    { id: 'blocks', label: 'Sekat kanal · inventaris database', path: BASE + '/snapshots/current/objects.json', inventory: true, color: '#147e94', note: 'Titik aktif dari snapshot database YG · konteks kesiapan, bukan jaringan kanal/skor' },
    { id: 'fdrs', label: 'FDRS / Water Table · inventaris database', path: BASE + '/snapshots/current/objects.json', inventory: true, color: '#4262a3', note: 'Titik alat aktif dari snapshot database YG · bukan nilai pengukuran TMAT' },
    { id: 'landcover', label: 'Tutupan lahan', note: 'Data belum tersedia · belum ada poligon/raster menyeluruh yang terverifikasi' },
    { id: 'hotspots', label: 'Hotspot FIRMS confidence tinggi', path: 'data/hotspot-high-confidence.geojson', color: '#d46026', note: 'Hanya titik di dalam gambut tersaring · bukan bukti kebakaran terverifikasi' },
    { id: 'burned', label: 'Area terindikasi terbakar', path: 'data/burned-area-estimates.geojson', color: '#a64139', note: 'Estimasi Sentinel-2 dNBR/NBR, bukan validasi lapangan' }
  ];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const number = n => n === null ? 'Data belum tersedia' : n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  function status(message) { $('access-status').textContent = message; }
  async function fetchJSON(path, privateData = false, captureSource = false) {
    const response = privateData ? await window.YG_STAFF_DATA.privateFetch(path) : await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error('Data belum tersedia (HTTP ' + response.status + ')');
    if(captureSource){const bytes=await response.arrayBuffer();state.peatSourceHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');return JSON.parse(new TextDecoder().decode(bytes));}
    return response.json();
  }
  function collection(data) {
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('GeoJSON FeatureCollection tidak valid');
    return data;
  }
  async function layerData(def) {
    if (state.cache.has(def.id)) return state.cache.get(def.id);
    if (def.catalog) {
      if (!state.pendingData.has(def.id)) state.pendingData.set(def.id, (async () => {
        const current = window.YG_AUTH?.readStoredSession();
        if (!current || current.token !== state.session.token) { $('workspace').hidden = true; status('Akses ditolak. Login staf ulang diperlukan.'); throw Error('Sesi staf berubah atau berakhir'); }
        const response = await fetch(def.path, {headers:{authorization:'Bearer '+current.token},cache:'no-store',signal:AbortSignal.timeout(45000)});
        if (response.status === 401 || response.status === 403) { $('workspace').hidden = true; status('Akses ditolak. Login staf ulang diperlukan.'); }
        const data = await C.readDisplay(response, def.catalog, crypto, C.validatePoints);
        state.cache.set(def.id,data); return data;
      })().finally(()=>state.pendingData.delete(def.id)));
      return state.pendingData.get(def.id);
    }
    if (def.inventory) {
      if (!state.pendingData.has('inventory')) state.pendingData.set('inventory',
        fetch(def.path, {cache:'no-store',signal:AbortSignal.timeout(15000)}).then(I.read).then(result => {
          state.cache.set('blocks',result.blocks); state.cache.set('fdrs',result.fdrs);
          const skipped=Object.values(result.excluded).reduce((sum,value)=>sum+value,0);
          for(const key of ['blocks','fdrs'])state.cache.get(key).inventoryExcluded=skipped;
        }).finally(()=>state.pendingData.delete('inventory')));
      await state.pendingData.get('inventory'); return state.cache.get(def.id);
    }
    if (!state.pendingData.has(def.id)) state.pendingData.set(def.id,
      fetchJSON(def.path, def.private).then(collection).then(data => { state.cache.set(def.id, data); return data; }).finally(() => state.pendingData.delete(def.id)));
    return state.pendingData.get(def.id);
  }
  function popup(feature, title) {
    const p = feature.properties || {};
    const content = document.createElement('div');
    const heading = document.createElement('strong'); heading.textContent = title; content.appendChild(heading);
    Object.entries(p).filter(([key, value]) => typeof value !== 'object' && !/foto|photo|url/i.test(key)).slice(0, 22).forEach(([key, value]) => {
      const row = document.createElement('p'); row.textContent = key + ': ' + (value ?? 'Data belum tersedia'); content.appendChild(row);
    });
    if (title === 'Gambut BBSDLP 2019') {
      const result = A.assessPressures(p.restorationPressures);
      const row = document.createElement('p'); row.textContent = 'Prioritas tiga tekanan: ' + result.category + (result.complete ? ' · ' + result.pressureCount + ' tekanan terverifikasi' : ' · bukti tiga tekanan belum lengkap/valid'); content.appendChild(row);
    }
    return content;
  }
  function scoped(def, data) {
    const regency = $('regency').value;
    if (def.catalog) return C.scopePoints(data.features, state.filtered, A.contains);
    if (def.id === 'peat') return state.filtered;
    if (def.id === 'hotspots') return data.features.filter(f => f.geometry?.type === 'Point' &&
      state.filtered.some(peat => {
        const b = peat._restorationBounds, p = f.geometry.coordinates;
        return p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3] && A.contains(p, peat.geometry);
      }));
    if (!regency || def.id === 'feg') return data.features;
    if (def.inventory) return data.features.filter(f => A.district(f.properties?.Kabupaten) === A.district(regency));
    if (def.id === 'burned') return data.features.filter(f => (f.properties?.regencies || []).some(v => A.district(v) === A.district(regency)));
    return data.features;
  }
  function draw(def) {
    if (state.layers.has(def.id)) state.map.removeLayer(state.layers.get(def.id));
    const data = state.cache.get(def.id);
    if (!data || !$('layer-' + def.id).checked) return;
    const features = scoped(def, data);
    const layer = L.geoJSON({ type: 'FeatureCollection', features }, {
      style: f => ({ color: def.color, weight: 1, fillOpacity: def.id === 'peat' ? .36 : .15,
        fillColor: def.id === 'peat' ? ({ Tinggi: '#b43b38', Sedang: '#d89a32', Rendah: '#4a9661' }[A.assessPressures(f.properties?.restorationPressures).category] || '#adb7b3') : def.color }),
      pointToLayer: (f, ll) => L.circleMarker(ll, { radius: def.id === 'hotspots' ? 4 : 6, color: def.color, weight: 1, fillOpacity: .8 }),
      onEachFeature: (f, l) => l.bindPopup(() => popup(f, def.label))
    }).addTo(state.map);
    state.layers.set(def.id, layer);
    $('state-' + def.id).textContent = features.length.toLocaleString('id-ID') + ' objek ditampilkan · ' + def.note;
  }
  function recordLayerSource(def, data) {
    const sourceId = 'runtime-source-' + def.id;
    let source = document.getElementById(sourceId);
    if (!source) { source = document.createElement('p'); source.id = sourceId; $('sources').appendChild(source); }
    source.textContent = def.label + ' · metadata runtime · versi generatedAt: ' + (data.generatedAt || 'belum tersedia') +
      ' · periode: ' + (data.coverageStart || 'belum tersedia') + ' sampai ' + (data.coverageEnd || 'belum tersedia') +
      ' · objek sumber: ' + data.features.length + ' · jalur: ' + (def.private ? 'endpoint staf eksisting' : def.path) + ' · belum tervalidasi untuk scoring';
    if (def.inventory) source.textContent += ' · data snapshot, bukan pembacaan langsung Sheets · record dikecualikan: ' + data.inventoryExcluded + ' · hitungan objek bukan jumlah aset fisik terverifikasi';
    if (def.catalog) source.textContent += ' · judul asli: ' + def.catalog.title + ' · penerbit: ' + def.catalog.publisher + ' · tahun metadata: ' + (def.catalog.year ?? 'belum diketahui') + ' · UUID: ' + def.catalog.uuid + ' · versi SHA-256: ' + def.catalog.sha256 + ' · catatan metadata: ' + def.catalog.metadataConflictCount + ' · titik kejadian bukan luas terbakar/jumlah kejadian unik';
  }
  async function toggle(def, input) {
    if (!input.checked) {
      if (state.layers.has(def.id)) state.map.removeLayer(state.layers.get(def.id));
      if (def.id === 'feg' && state.khgMode === 'feg') { $('khg').value = ''; focusKHG(); }
      $('state-' + def.id).textContent = 'Tidak ditampilkan · ' + def.note;
      return;
    }
    input.disabled = true; $('state-' + def.id).textContent = 'Memuat data asli…';
    try {
      const data = await layerData(def);
      recordLayerSource(def, data);
      draw(def);
      if (def.id === 'feg' && !state.khgMode) useFEGGroups(data);
    } catch (error) {
      input.checked = false; $('state-' + def.id).textContent = 'Data belum tersedia · ' + error.message;
    } finally { input.disabled = false; }
  }
  function fit() {
    const peat = state.layers.get('peat');
    const bounds = peat && $('layer-peat').checked && peat.getBounds();
    if (bounds?.isValid()) state.map.fitBounds(bounds, { padding: [18, 18], maxZoom: 12 });
    else if (state.boundary) state.map.fitBounds(L.geoJSON(state.boundary).getBounds());
  }
  function filter() {
    state.filtered = A.select(state.peat, $('regency').value, '');
    const summary = A.summarize(state.filtered, 'pressures');
    $('area').textContent = summary.sourceAreaHa === null ? 'Data belum tersedia' : number(summary.sourceAreaHa) + ' ha';
    $('polygon-count').textContent = number(summary.count);
    $('unassessed').textContent = number(summary.unassessed) + ' poligon belum dinilai';
    $('priority-count').textContent = summary.assessed ? number(summary.priorityCount) : 'Belum dinilai';
    $('region-status').textContent = summary.assessed
      ? number(summary.assessed) + ' dari ' + number(summary.count) + ' poligon telah dinilai. Poligon lain tetap memerlukan validasi.'
      : 'Wilayah prioritas belum dapat ditetapkan: bukti kebakaran, bukaan hutan gambut, dan kanal belum lengkap atau tervalidasi. Daftar berikut adalah wilayah kajian dari data gambut asli.';
    $('regions').replaceChildren();
    A.regions(state.filtered, 'pressures').forEach(region => {
      const row = document.createElement('tr');
      [region.name, number(region.sourceAreaHa), number(region.count), region.assessed ? number(region.priorityCount) : 'Belum dinilai', number(region.unassessed)].forEach(value => {
        const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
      });
      $('regions').appendChild(row);
    });
    definitions.filter(def => def.path && state.cache.has(def.id)).forEach(draw);
    drawReview();
    fit();
  }
  function clearReview(){
    if(state.reviewLayer)state.map.removeLayer(state.reviewLayer);state.reviewLayer=null;state.reviewData=null;
    $('review-data').value='';$('review-manifest').value='';$('review-clear').disabled=true;$('review-status').textContent='Belum ada paket kandidat dimuat.';
  }
  function drawReview(){
    if(state.reviewLayer)state.map.removeLayer(state.reviewLayer);state.reviewLayer=null;if(!state.reviewData)return;
    const features=A.select(state.reviewData.features,$('regency').value,'');
    state.reviewLayer=L.geoJSON({type:'FeatureCollection',features},{style:{color:'#7043a4',weight:3,fillColor:'#adb7b3',fillOpacity:.15},onEachFeature:(f,l)=>l.bindPopup(()=>{
      const box=popup(f,'Kandidat telaah · bukan prioritas final');const note=document.createElement('p');note.textContent='Bukti GFC 2018–2025 dalam irisan hutan rawa arsip BRG. Tahun baseline/kanal belum pasti; jumlah bagian kanal bukan jumlah kanal unik. Prioritas: Belum dinilai.';box.appendChild(note);return box;
    })}).addTo(state.map);
    $('review-status').textContent=features.length+' dari '+state.reviewData.features.length+' kandidat telaah ditampilkan menurut kabupaten · semua Belum dinilai · hanya tersimpan dalam memori halaman.';
  }
  async function loadReview(){
    $('review-load').disabled=true;
    try{
      const session=window.YG_AUTH?.readStoredSession();if(!session||session.token!==state.session?.token){$('workspace').hidden=true;throw Error('Sesi staf berubah; login ulang diperlukan');}
      const response=await fetch(BASE+'/api/staff/riau-geoportal/catalog',{headers:{authorization:'Bearer '+session.token},cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!response.ok||(await response.json()).access!=='staff_only'){$('workspace').hidden=true;clearReview();throw Error('Akses staf ditolak');}
      const data=$('review-data').files?.[0],manifest=$('review-manifest').files?.[0];
      if(!data||!manifest||data.size>window.YG_RESTORATION_REVIEW.MAX_BYTES||manifest.size>65536)throw Error('Pilih GeoJSON maksimal 12 MiB dan manifest maksimal 64 KiB');
      const decoded=await window.YG_RESTORATION_REVIEW.decode(new Uint8Array(await data.arrayBuffer()),new Uint8Array(await manifest.arrayBuffer()),state.originalPeat,state.peatSourceHash,crypto);
      if(window.YG_AUTH?.readStoredSession()?.token!==session.token){$('workspace').hidden=true;throw Error('Sesi staf berubah saat membaca paket');}
      state.reviewData=decoded;drawReview();$('review-clear').disabled=false;
    }catch(e){clearReview();$('review-status').textContent='Paket tidak dimuat: '+e.message;}
    finally{$('review-load').disabled=false;}
  }
  function renderControls() {
    definitions.forEach(def => {
      const label = document.createElement('label'), input = document.createElement('input'), note = document.createElement('small');
      input.type = 'checkbox'; input.id = 'layer-' + def.id; input.disabled = !def.path;
      input.addEventListener('change', () => toggle(def, input));
      note.id = 'state-' + def.id; note.textContent = def.note;
      label.append(input, ' ' + def.label, note); $('layers').appendChild(label);
    });
    $('indicators').innerHTML = A.PRESSURES.map(i => '<tr><td>' + esc(i.label) + '</td><td>Bukti spasial</td><td>Belum dinilai · sumber dan overlay perlu diperiksa</td></tr>').join('');
    $('regency').addEventListener('change', filter); $('khg').addEventListener('change', focusKHG); $('fit').addEventListener('click', fit);
    $('load-khg').addEventListener('click', loadKHG);
    $('use-feg-khg').addEventListener('click', loadFEGGroups);
  }
  function useFEGGroups(data) {
    const result = C.groupFEG(data);
    state.fegGroups = result;
    const messages = [result.groups.length + ' kode KHG dari atribut FEG',
      result.missingCode + ' fitur tanpa kode', result.invalidGeometry + ' geometri tidak lolos struktur',
      result.missingName + ' fitur tanpa nama', result.groups.filter(g => g.nameConflict).length + ' kode dengan nama berbeda'];
    $('feg-khg-status').textContent = messages.join(' · ') + '. Bukan batas KHG mandiri; tidak mengubah luas/ringkasan atau skor ekologis.';
    if (!result.groups.length) return;
    state.khgMode = 'feg';
    state.khgFeatures = result.groups.map(g => ({ type: 'FeatureCollection', features: g.features }));
    const select = $('khg'); select.replaceChildren();
    const none = document.createElement('option'); none.value = ''; none.textContent = 'Tanpa fokus kelompok FEG'; select.appendChild(none);
    result.groups.forEach((g,index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = g.label; select.appendChild(option); });
    select.disabled = false; focusKHG();
    $('state-khg').textContent = 'Sumber fokus: kelompok bagian FEG menurut kode KHG · bukan batas KHG mandiri';
    $('khg-focus-source').textContent = 'Sumber fokus aktif: bagian FEG SK.130 menurut atribut kode_khg/nama_khg. Bukan batas KHG mandiri.';
  }
  async function loadFEGGroups() {
    const button = $('use-feg-khg'), def = definitions.find(d => d.id === 'feg');
    button.disabled = true;
    $('feg-khg-status').textContent = 'Memuat FEG asli melalui endpoint staf…';
    try {
      const data = await layerData(def);
      recordLayerSource(def, data);
      $('layer-feg').checked = true; draw(def);
      useFEGGroups(data);
    } catch (error) { $('feg-khg-status').textContent = 'Data belum tersedia · ' + error.message; }
    finally { button.disabled = false; }
  }
  function catalogKHG(catalog) {
    state.khgCandidates = C.candidates(catalog);
    if (!state.khgCandidates.length) { $('khg-status').textContent = 'Data belum tersedia · tidak ada kandidat KHG siap-peta dengan metadata lengkap di katalog sesi ini.'; return; }
    const select = $('khg-dataset'); select.replaceChildren();
    state.khgCandidates.forEach(item => { const option = document.createElement('option'); option.value = item.uuid; option.textContent = item.title; select.appendChild(option); });
    select.disabled = false; $('load-khg').disabled = false;
    $('khg-status').textContent = state.khgCandidates.length + ' kandidat siap-peta. Geometri dimuat hanya setelah dipilih; belum tervalidasi untuk scoring.';
  }
  function focusKHG() {
    if (state.khgLayer) state.map.removeLayer(state.khgLayer);
    state.khgLayer = null;
    const selected = $('khg').value;
    if (selected === '') { fit(); return; }
    const feature = state.khgFeatures[Number(selected)]; if (!feature) return;
    if (state.khgMode === 'feg' && !$('layer-feg').checked) { $('layer-feg').checked = true; draw(definitions.find(d => d.id === 'feg')); }
    const title = state.khgMode === 'feg' ? 'Bagian FEG pada ' + state.fegGroups.groups[Number(selected)].code + ' · bukan batas KHG mandiri' : 'KHG · referensi peta, belum dinilai';
    state.khgLayer = L.geoJSON(feature, { style: { color: '#375bb1', weight: 3, fillOpacity: .08 }, onEachFeature: (f,l) => l.bindPopup(() => popup(f, title)) }).addTo(state.map);
    state.map.fitBounds(state.khgLayer.getBounds(), { padding: [20,20], maxZoom: 12 });
  }
  async function loadKHG() {
    const item = state.khgCandidates.find(r => r.uuid === $('khg-dataset').value); if (!item || !state.map) return;
    $('load-khg').disabled = true; $('khg-dataset').disabled = true;
    $('khg-status').textContent = 'Memuat geometri privat dan memeriksa checksum…';
    try {
      const current = window.YG_AUTH?.readStoredSession(); if (!current || current.token !== state.session.token) throw Error('Sesi staf berubah atau berakhir');
      const response = await fetch(BASE + '/api/staff/riau-geoportal/datasets/' + item.uuid + '/display', {
        headers: { authorization: 'Bearer ' + current.token }, cache: 'no-store', signal: AbortSignal.timeout(45000)
      });
      if (response.status === 401 || response.status === 403) { $('workspace').hidden = true; status('Akses ditolak. Sesi/otorisasi staf tidak berlaku; login ulang diperlukan.'); }
      const data = await C.readDisplay(response, item, crypto);
      state.khgMode = 'catalog';
      state.khgFeatures = data.features;
      const select = $('khg'); select.replaceChildren();
      const all = document.createElement('option'); all.value = ''; all.textContent = 'Tanpa fokus KHG'; select.appendChild(all);
      data.features.forEach((f,index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = C.label(f,index); select.appendChild(option); });
      select.disabled = false; focusKHG();
      $('state-khg').textContent = 'Referensi tersedia melalui pemilih fokus KHG di atas · belum ada overlay analisis';
      $('khg-focus-source').textContent = 'Sumber fokus aktif: ' + item.title + ' · UUID ' + item.uuid + ' · katalog staf, belum dinilai.';
      $('khg-status').textContent = item.title + ' · ' + data.features.length + ' poligon · UUID ' + item.uuid + ' · sumber: ' + item.source + ' · tahun: ' + (item.year ?? 'belum diketahui') + ' · versi SHA-256: ' + item.sha256 + '. Lolos pemeriksaan struktur/checksum, belum QA topologi atau scoring. Ringkasan tidak difilter KHG.';
    } catch (error) {
      state.khgMode = null; state.khgFeatures = []; $('khg').replaceChildren(); $('khg').disabled = true; focusKHG();
      $('state-khg').textContent = 'Data belum tersedia · pemuatan KHG gagal';
      $('khg-focus-source').textContent = 'Sumber fokus belum tersedia; pemuatan katalog gagal.';
      $('khg-status').textContent = 'Data belum tersedia · ' + error.message;
    } finally { $('load-khg').disabled = false; $('khg-dataset').disabled = false; }
  }
  async function loadLeaflet() {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='; css.crossOrigin = 'anonymous'; document.head.appendChild(css);
    await new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='; script.crossOrigin = 'anonymous';
      const timer = setTimeout(() => reject(new Error('Leaflet belum termuat dalam 20 detik')), 20000);
      script.onload = () => { clearTimeout(timer); resolve(); }; script.onerror = () => { clearTimeout(timer); reject(new Error('Leaflet gagal dimuat')); }; document.head.appendChild(script);
    });
  }
  async function boot() {
    if (window.top !== window.self) return;
    // Use the origin already authorized by the staff API and SSO callback.
    // A stored token alone never unlocks the workspace.
    if (location.hostname !== 'webgisyg.id' || location.protocol !== 'https:') return status('Origin belum diizinkan untuk akses staf. Modul ini ditujukan untuk WebGIS HTTPS dengan verifikasi backend.');
    state.session = window.YG_AUTH?.readStoredSession();
    if (!state.session) {
      status('Akses ditolak. Login staf diperlukan.');
      const link = document.createElement('a'); link.href = 'staff-login.html?return=restoration-priority.html'; link.textContent = 'Login staf'; $('access-status').append(' ', link); return;
    }
    try {
      // Do not trust localStorage alone: this existing endpoint verifies the token on the backend.
      const response = await fetch(BASE + '/api/staff/riau-geoportal/catalog', {
        headers: { authorization: 'Bearer ' + state.session.token }, cache: 'no-store', signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error('Sesi/otorisasi belum terverifikasi (HTTP ' + response.status + ')');
      const catalog = await response.json();
      if (catalog.access !== 'staff_only' || !Array.isArray(catalog.datasets)) throw new Error('Respons verifikasi katalog tidak valid');
      status('Sesi staf diverifikasi backend · pengembangan internal · analisis belum dinilai');
      C.candidates(catalog,'fire').forEach(item => definitions.push({id:'bpbd-'+item.uuid,label:'Lokasi kebakaran BPBD · '+item.title.match(/_(\d{4})_/)[1]+' (judul sumber)',path:BASE+'/api/staff/riau-geoportal/datasets/'+item.uuid+'/display',catalog:item,color:'#a54b38',note:'Titik asli dalam gambut tersaring · bukan luas terbakar/skor · '+item.metadataConflictCount+' catatan metadata'}));
      renderControls(); $('workspace').hidden = false;
      const manifest = await fetchJSON('data/restoration-priority-sources.json');
      manifest.sources.forEach(s => {
        const p = document.createElement('p'); p.textContent = s.title + ' — ' + s.source + ' · tahun: ' + (s.year ?? 'belum diketahui') + ' · versi: ' + s.version + ' · ' + s.note; $('sources').appendChild(p);
      });
      await loadLeaflet();
      state.map = L.map('map').setView([.6, 101.8], 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(state.map);
      L.control.scale({ imperial: false }).addTo(state.map);
      window.addEventListener('resize', () => state.map.invalidateSize());
      const boundary = await fetchJSON('data/batas_provinsi_riau_dissolve.geojson'); state.boundary = collection(boundary);
      L.geoJSON(boundary, { style: { color: '#235a46', weight: 2, fill: false }, interactive: false }).addTo(state.map); fit();
      const peat = collection(await fetchJSON(definitions[0].path,false,true));
      state.originalPeat=structuredClone(peat.features);
      state.peat = peat.features;
      state.peat.forEach(f => {
        const bounds = L.geoJSON(f).getBounds(); f._restorationBounds = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      });
      state.cache.set('peat', peat);
      const districts = new Map(); state.peat.forEach(f => { const name = f.properties?.KABKOT; if (name) districts.set(A.district(name), name); });
      [...districts].sort(([a], [b]) => a.localeCompare(b)).forEach(([key, name]) => { const o = document.createElement('option'); o.value = name; o.textContent = key === 'SIAK' ? 'Siak' : name; $('regency').appendChild(o); });
      $('regency').disabled = false; $('layers').disabled = false; $('fit').disabled = false; $('use-feg-khg').disabled = false; $('layer-peat').checked = true; filter();
      catalogKHG(catalog);
      ['review-data','review-manifest','review-load'].forEach(id=>$(id).disabled=false);
      $('review-load').addEventListener('click',loadReview);$('review-clear').addEventListener('click',clearReview);
      $('layer-status').textContent = 'Data asli dimuat. Poligon abu-abu belum dinilai; pilih layer tambahan sesuai kebutuhan.';
    } catch (error) {
      status('Modul belum siap: ' + error.message + '. Tidak ada skor yang dihitung.');
      if (!state.map) $('workspace').hidden = true;
    }
  }
  boot();
})();
