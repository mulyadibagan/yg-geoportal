(()=>{
'use strict';
const API_BASE='https://yg-webgis-public-data.yg-webgis-public-data-worker.workers.dev';
const $=s=>document.querySelector(s);

function accessFor(id){
  try{return String((JSON.parse(localStorage.getItem('ygDroneJobAccess')||'{}')||{})[id]||'')}catch{return ''}
}
function currentId(){return localStorage.getItem('ygDroneCurrentJob')||''}
function userError(code){
  return ({
    drive_download_incomplete:'Sebagian foto dari Google Drive belum berhasil diambil. Foto yang sudah tersedia tetap aman dan proses dapat dicoba kembali.',
    insufficient_valid_photos:'Foto yang dapat digunakan belum cukup untuk membuat orthomosaic.',
    photogrammetry_failed:'Penyusunan foto belum berhasil. Periksa kualitas dan tumpang tindih foto, lalu coba kembali.',
    orthomosaic_not_created:'Penyusunan foto selesai, tetapi orthomosaic belum berhasil dibuat.',
    processing_failed:'Pemrosesan belum berhasil diselesaikan. Silakan coba kembali.',
  })[code]||'Pemrosesan belum berhasil diselesaikan. Silakan coba kembali.';
}
function progressBox(){return $('#ygProcessProgress')}
function ensureRetryButton(job){
  let holder=$('#ygRetryActions');
  if(!holder){
    holder=document.createElement('div');
    holder.id='ygRetryActions';
    holder.className='actions';
    const state=$('#jobState');
    (progressBox()||state)?.insertAdjacentElement('afterend',holder);
  }
  holder.innerHTML='';
  if(job?.status!=='failed'){holder.hidden=true;return}
  holder.hidden=false;
  const btn=document.createElement('button');
  btn.type='button';
  btn.className='primary';
  btn.textContent='Coba lagi';
  btn.addEventListener('click',()=>retry(job.id,btn));
  holder.appendChild(btn);
}
function renderFailure(job){
  if(!job||job.status!=='failed')return;
  const box=progressBox();
  if(box){
    box.hidden=false;
    box.innerHTML=`<div class="yg-progress-head"><strong>Pemrosesan terhenti</strong><span>Perlu diulang</span></div><p style="margin:8px 0 0;color:#667a72;font-size:12px">${userError(job.error)}</p>`;
  }
  const info=$('#resultInfo');
  if(info)info.textContent=userError(job.error);
  ensureRetryButton(job);
}
function handleJob(job){
  if(!job)return;
  if(job.status==='failed')renderFailure(job);else ensureRetryButton(job);
}
async function retry(id,btn){
  const token=accessFor(id);if(!token)return;
  const old=btn.textContent;btn.disabled=true;btn.textContent='Menyiapkan…';
  try{
    const r=await fetch(`${API_BASE}/api/drone/jobs/${encodeURIComponent(id)}/retry`,{method:'POST',headers:{'x-job-token':token}});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||'retry_failed');
    ensureRetryButton(data.job);
    const box=progressBox();
    if(box)box.innerHTML='<div class="yg-progress-head"><strong>Menunggu giliran pemrosesan</strong><span>0%</span></div><div class="yg-progress-track"><i style="width:0%"></i></div>';
    $('#refreshJob')?.click();
  }catch(e){
    btn.disabled=false;btn.textContent=old;
    alert('Belum dapat mencoba kembali. Silakan tunggu sebentar lalu coba lagi.');
  }
}

// Make a blank title neutral; survey date comes from image metadata, not today.
const start=$('#startOrthomosaic');
if(start)start.addEventListener('click',()=>{const input=$('#processTitle');if(input&&!input.value.trim())input.value='Survei drone';},true);

// Give visible feedback when status is refreshed.
const refresh=$('#refreshJob');
if(refresh){
  refresh.addEventListener('click',()=>{
    const previous=refresh.textContent;refresh.textContent='Memeriksa…';refresh.disabled=true;
    setTimeout(()=>{refresh.textContent=previous;refresh.disabled=false;},1200);
  },true);
}

// Observe API responses after the existing page logic has processed them.
const previousFetch=window.fetch.bind(window);
window.fetch=async function(input,init){
  const response=await previousFetch(input,init);
  try{
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(/\/api\/drone\/jobs\/drn-[A-Za-z0-9-]+(?:\?|$)/.test(url)){
      response.clone().json().then(data=>handleJob(data?.job)).catch(()=>{});
    }
  }catch{}
  return response;
};

// If the page has an active process, force one fresh status read on load.
setTimeout(()=>{if(currentId()&&accessFor(currentId()))$('#refreshJob')?.click();},700);
})();
