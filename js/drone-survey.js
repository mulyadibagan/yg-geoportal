(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DEFAULT_CENTER=[0.72,101.45];
const baseLayer=()=>L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'&copy; OpenStreetMap'});

function activateTab(name){
  $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  $$('.panel').forEach(p=>p.classList.toggle('active',p.id===`panel-${name}`));
  setTimeout(()=>{missionMap?.invalidateSize();orthoMap?.invalidateSize();},80);
}
$$('.tab').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
$$('[data-tab-target]').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tabTarget)));

let missionMap,orthoMap,drawnItems,gridLayer,currentOrthoLayer,catalog=[];
function initMissionMap(){
  missionMap=L.map('missionMap',{preferCanvas:true}).setView(DEFAULT_CENTER,10);baseLayer().addTo(missionMap);
  drawnItems=new L.FeatureGroup().addTo(missionMap);gridLayer=new L.FeatureGroup().addTo(missionMap);
  const draw=new L.Control.Draw({position:'topleft',draw:{polyline:false,rectangle:true,circle:false,circlemarker:false,marker:false,polygon:{allowIntersection:false,showArea:true}},edit:{featureGroup:drawnItems,remove:true}});missionMap.addControl(draw);
  missionMap.on(L.Draw.Event.CREATED,e=>{drawnItems.clearLayers();drawnItems.addLayer(e.layer);gridLayer.clearLayers();$('#missionStatus').textContent='Area siap';$('#missionStatus').className='status good';});
  missionMap.on(L.Draw.Event.DELETED,()=>{gridLayer.clearLayers();$('#missionStatus').textContent='Belum dibuat';$('#missionStatus').className='status neutral';});
}
function polygonLatLngs(){const layers=drawnItems.getLayers();if(!layers.length)return null;const ll=layers[0].getLatLngs();return Array.isArray(ll[0])?ll[0]:ll;}
function intersectionsAtY(poly,y){const xs=[];for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[j],b=poly[i];if((a.lat>y)!==(b.lat>y)){const x=a.lng+(y-a.lat)*(b.lng-a.lng)/(b.lat-a.lat);xs.push(x);}
 }return xs.sort((a,b)=>a-b);
}
function generateGrid(){
  const poly=polygonLatLngs();if(!poly){alert('Gambar polygon area survei terlebih dahulu.');return;}
  gridLayer.clearLayers();
  const altitude=Number($('#altitude').value)||35, side=Number($('#sideOverlap').value)||80;
  const lat0=poly.reduce((s,p)=>s+p.lat,0)/poly.length;
  const footprintWidth=altitude*1.45; // conservative planning approximation; final camera model belongs in mission backend
  const spacingM=Math.max(3,footprintWidth*(1-side/100));
  const dLat=spacingM/111320;
  const minLat=Math.min(...poly.map(p=>p.lat)),maxLat=Math.max(...poly.map(p=>p.lat));
  let lineNo=0;
  for(let y=minLat+dLat/2;y<maxLat;y+=dLat){const xs=intersectionsAtY(poly,y);for(let k=0;k+1<xs.length;k+=2){let a=[y,xs[k]],b=[y,xs[k+1]];if(lineNo%2){[a,b]=[b,a];}L.polyline([a,b],{weight:2,opacity:.8,dashArray:'6 4'}).addTo(gridLayer);lineNo++;}}
  const mission={id:`DRN-${new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14)}`,area:$('#areaName').value.trim()||'Area survei',surveyType:$('#surveyType').value,drone:$('#droneModel').value,altitude,frontOverlap:Number($('#frontOverlap').value),sideOverlap:side,speed:Number($('#speed').value),gimbal:Number($('#gimbal').value),lines:lineNo,polygon:poly.map(p=>[p.lat,p.lng]),createdAt:new Date().toISOString()};
  localStorage.setItem('ygDroneLastMission',JSON.stringify(mission));
  $('#missionStatus').textContent=`${lineNo} jalur`;$('#missionStatus').className='status good';
  const bounds=L.latLngBounds(poly);missionMap.fitBounds(bounds.pad(.12));renderArchive();
}
$('#generateMission').addEventListener('click',generateGrid);
$('#clearMission').addEventListener('click',()=>{drawnItems.clearLayers();gridLayer.clearLayers();$('#missionStatus').textContent='Belum dibuat';$('#missionStatus').className='status neutral';});

function extractDjiMetadata(buffer){
  const bytes=new Uint8Array(buffer);let text='';
  // XMP blocks are ASCII/UTF-8 inside JPEG; decode bounded chunks to avoid large-string issues.
  const decoder=new TextDecoder('utf-8',{fatal:false});
  for(let i=0;i<bytes.length;i+=262144)text+=decoder.decode(bytes.slice(i,Math.min(bytes.length,i+262144)));
  const pick=(keys)=>{for(const key of keys){const patterns=[new RegExp(`${key}=["']?(-?\\d+(?:\\.\\d+)?)`,`i`),new RegExp(`<${key}>(-?\\d+(?:\\.\\d+)?)<\\/${key}>`,`i`)];for(const r of patterns){const m=text.match(r);if(m)return Number(m[1]);}}return null;};
  return {pitch:pick(['drone-dji:GimbalPitchDegree','GimbalPitchDegree']),yaw:pick(['drone-dji:GimbalYawDegree','GimbalYawDegree']),roll:pick(['drone-dji:GimbalRollDegree','GimbalRollDegree']),relativeAltitude:pick(['drone-dji:RelativeAltitude','RelativeAltitude'])};
}
async function inspectPhotos(files){
  const rows=[];let valid=0,warn=0,excluded=0;
  for(const file of files){let status='Valid',note='Siap untuk QC fotogrametri',cls='good';try{
    const meta=extractDjiMetadata(await file.arrayBuffer());
    if(meta.pitch==null){status='Warning';note='Gimbal pitch tidak ditemukan di metadata; perlu pemeriksaan visual.';cls='warn';warn++;}
    else if(meta.pitch>-85){status='Excluded';note=`Non-nadir: gimbal pitch ${meta.pitch.toFixed(1)}°. Tidak dimasukkan ke orthomosaic nadir.`;cls='bad';excluded++;}
    else if(meta.pitch>-88){status='Warning';note=`Sedikit miring: ${meta.pitch.toFixed(1)}°. Periksa overlap/alignment.`;cls='warn';warn++;}
    else{note=`Nadir ${meta.pitch.toFixed(1)}°${meta.relativeAltitude!=null?` · alt ${meta.relativeAltitude.toFixed(1)} m`:''}`;valid++;}
  }catch(e){status='Excluded';note='File tidak dapat dibaca.';cls='bad';excluded++;}
    rows.push(`<tr><td>${escapeHtml(file.name)}</td><td>${(file.size/1048576).toFixed(1)} MB</td><td><span class="status ${cls}">${status}</span></td><td>${escapeHtml(note)}</td></tr>`);
  }
  $('#qcRows').innerHTML=rows.join('')||'<tr><td colspan="4" class="empty">Belum ada foto diperiksa.</td></tr>';
  $('#qcSummary').hidden=false;$('#qcSummary').innerHTML=`<div><span>Valid</span><strong>${valid}</strong></div><div><span>Warning</span><strong>${warn}</strong></div><div><span>Excluded</span><strong>${excluded}</strong></div>`;
}
$('#photoInput').addEventListener('change',e=>inspectPhotos([...e.target.files]));
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function initOrthoMap(){orthoMap=L.map('orthoMap',{preferCanvas:true}).setView(DEFAULT_CENTER,8);baseLayer().addTo(orthoMap);}
async function loadCatalog(){
  const list=$('#orthoList');list.innerHTML='<div class="empty">Memuat katalog…</div>';
  try{const r=await fetch(`data/drone-orthomosaics.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();catalog=Array.isArray(data)?data:(data.items||[]);renderCatalog();renderArchive();}
  catch(e){list.innerHTML='<div class="empty">Katalog belum tersedia. Struktur viewer sudah siap; layer akan muncul setelah tiles orthomosaic dipublikasikan.</div>';}
}
function renderCatalog(){const list=$('#orthoList');if(!catalog.length){list.innerHTML='<div class="empty">Belum ada orthomosaic aktif.</div>';return;}list.innerHTML=catalog.map(x=>`<div class="ortho-item" data-id="${escapeHtml(x.id)}"><h3>${escapeHtml(x.title||x.id)}</h3><div class="ortho-meta"><span>${escapeHtml(x.project||'Survei drone')}</span><span>${escapeHtml(x.date||'')}</span>${x.gsdCm?`<span>GSD ${escapeHtml(x.gsdCm)} cm</span>`:''}</div><div class="actions"><button class="primary" data-show-ortho="${escapeHtml(x.id)}">Tampilkan</button>${x.driveUrl?`<a class="button-link" href="${escapeHtml(x.driveUrl)}" target="_blank" rel="noopener">Master Drive</a>`:''}</div></div>`).join('');$$('[data-show-ortho]').forEach(b=>b.addEventListener('click',()=>showOrtho(b.dataset.showOrtho)));}
function showOrtho(id){const x=catalog.find(i=>String(i.id)===String(id));if(!x||!x.tilesUrl)return;if(currentOrthoLayer)orthoMap.removeLayer(currentOrthoLayer);currentOrthoLayer=L.tileLayer(x.tilesUrl,{minZoom:x.minZoom||10,maxZoom:x.maxZoom||22,maxNativeZoom:x.maxNativeZoom||20,opacity:Number($('#orthoOpacity').value),tms:!!x.tms,crossOrigin:true,updateWhenIdle:true,keepBuffer:2});currentOrthoLayer.addTo(orthoMap);if(Array.isArray(x.bounds)&&x.bounds.length===2)orthoMap.fitBounds(x.bounds);$('#orthoInfo').textContent=`${x.title||x.id}${x.gsdCm?` · GSD ${x.gsdCm} cm`:''}. Tiles dimuat hanya untuk area yang terlihat.`;$$('.ortho-item').forEach(n=>n.classList.toggle('active',n.dataset.id===String(id)));}
$('#orthoOpacity').addEventListener('input',e=>currentOrthoLayer?.setOpacity(Number(e.target.value)));
$('#refreshCatalog').addEventListener('click',loadCatalog);
function renderArchive(){const local=JSON.parse(localStorage.getItem('ygDroneLastMission')||'null');const parts=[];if(local)parts.push(`<div class="ortho-item"><h3>${escapeHtml(local.area)}</h3><div class="ortho-meta"><span>${escapeHtml(local.id)}</span><span>${escapeHtml(local.drone)}</span><span>${local.altitude} m</span><span>${local.lines} jalur</span></div></div>`);for(const x of catalog)parts.push(`<div class="ortho-item"><h3>${escapeHtml(x.title||x.id)}</h3><div class="ortho-meta"><span>${escapeHtml(x.project||'')}</span><span>${escapeHtml(x.date||'')}</span><span>Orthomosaic tersedia</span></div></div>`);$('#missionArchive').innerHTML=parts.join('')||'Belum ada arsip yang dipublikasikan ke katalog.';}

initMissionMap();initOrthoMap();loadCatalog();renderArchive();
})();
