(()=>{
'use strict';

const exact = new Map([
  ['Tools publik · tanpa login','Siap digunakan'],
  ['Menunggu processor','Menunggu diproses'],
  ['Warning','Perlu diperiksa'],
  ['Excluded','Tidak digunakan'],
  ['Valid','Siap'],
  ['QC','Pemeriksaan'],
  ['Generate Mission','Buat Jalur Misi'],
  ['Reset','Bersihkan'],
  ['Preview area & jalur','Pratinjau area & jalur'],
  ['Membaca Cloud Optimized GeoTIFF…','Menampilkan orthomosaic…'],
  ['Upload selesai. Menambahkan ke antrean orthomosaic…','Upload selesai. Menyiapkan pemrosesan orthomosaic…'],
  ['Dataset masuk antrean pemrosesan. Status akan diperbarui otomatis.','Foto telah diterima. Status pemrosesan akan diperbarui otomatis.']
]);

const phrases = [
  ['server akan memeriksa ulang.','akan diperiksa kembali saat pemrosesan.'],
  ['Siap untuk QC fotogrametri','Siap untuk diproses'],
  ['COG dibaca per bagian sesuai tampilan peta.','Peta menampilkan hasil sesuai area yang sedang dilihat.'],
  ['Orthomosaic tersedia, tetapi viewer belum dapat membacanya:','Orthomosaic tersedia, tetapi peta belum dapat menampilkannya:'],
  ['Riwayat job yang pernah dibuat dari browser ini.','Riwayat pemrosesan yang tersimpan pada perangkat ini.'],
  ['Cloud Optimized GeoTIFF','hasil orthomosaic'],
  ['processor','proses'],
  ['job','proses']
];

function cleanText(text){
  let out = exact.get(text) || text;
  for(const [from,to] of phrases) out = out.split(from).join(to);
  return out;
}

function normalizeNode(root=document.body){
  if(!root) return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode()) nodes.push(walker.currentNode);
  for(const node of nodes){
    const before=node.nodeValue;
    const after=cleanText(before);
    if(after!==before) node.nodeValue=after;
  }
  const auth=document.getElementById('authStatus');
  if(auth && auth.textContent!=='Siap digunakan') auth.textContent='Siap digunakan';
}

const errorCopy={
  queue_full:'Kapasitas pemrosesan sedang penuh. Silakan coba lagi beberapa saat lagi.',
  invalid_drive_folder_url:'Link folder Google Drive tidak valid.',
  jpeg_only:'Gunakan foto berformat JPG atau JPEG.',
  content_length_required:'Ukuran file tidak dapat dibaca. Pilih ulang foto dan coba lagi.',
  file_too_large:'Ukuran salah satu foto melebihi batas yang diizinkan.',
  too_many_files:'Jumlah foto melebihi batas pemrosesan.',
  dataset_too_large:'Total ukuran foto melebihi batas pemrosesan.',
  minimum_three_photos:'Pilih minimal tiga foto untuk membuat orthomosaic.',
  unauthorized:'Akses hasil pemrosesan ini tidak tersedia pada perangkat ini.',
  job_not_found:'Riwayat pemrosesan tidak ditemukan.',
  orthomosaic_not_ready:'Orthomosaic masih diproses.',
  origin_not_allowed:'Permintaan hanya dapat dilakukan melalui YG GeoPortal.'
};

const nativeAlert=window.alert.bind(window);
window.alert=(message)=>{
  let text=String(message??'');
  for(const [code,copy] of Object.entries(errorCopy)) text=text.split(code).join(copy);
  text=cleanText(text);
  nativeAlert(text);
};

const style=document.createElement('style');
style.textContent=`
#jobActions[hidden]{display:none!important}
.yg-process-progress{margin-top:14px;padding:14px;border:1px solid #d7e3dc;border-radius:12px;background:#fff}
.yg-process-progress[hidden]{display:none!important}
.yg-progress-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.yg-progress-head strong{font-size:14px;color:#17332a}.yg-progress-head span{font-size:13px;font-weight:700;color:#08724a}
.yg-progress-track{height:10px;border-radius:999px;background:#e8efeb;overflow:hidden}.yg-progress-track i{display:block;height:100%;border-radius:inherit;background:#08724a;transition:width .45s ease}
.yg-progress-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:9px;color:#667a72;font-size:12px}
.yg-survey-meta{margin-top:11px;padding:10px 12px;border-radius:9px;background:#f5f9f7;color:#365d4e;font-size:12px;line-height:1.55}.yg-survey-meta strong{color:#17332a}
.yg-progress-steps{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-top:12px}.yg-progress-step{font-size:10px;line-height:1.25;text-align:center;color:#829189;padding-top:7px;border-top:3px solid #dde6e1}.yg-progress-step.done{color:#285747;border-color:#51a37d}.yg-progress-step.active{color:#08724a;font-weight:700;border-color:#08724a}
@media(max-width:760px){.yg-progress-steps{grid-template-columns:repeat(3,1fr)}}`;
document.head.appendChild(style);

function progressBox(){
  let box=document.getElementById('ygProcessProgress');
  if(box) return box;
  const state=document.getElementById('jobState');
  if(!state) return null;
  box=document.createElement('div');
  box.id='ygProcessProgress';
  box.className='yg-process-progress';
  box.hidden=true;
  state.insertAdjacentElement('afterend',box);
  return box;
}

const stepDefs=[
  ['downloading','Mengambil foto'],
  ['checking','Pemeriksaan'],
  ['preparing','Menyiapkan foto'],
  ['reconstructing','Menyusun foto'],
  ['orthomosaic','Orthomosaic'],
  ['saving','Menyiapkan hasil']
];

function formatSurveyDate(value){
  const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return '';
  const months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${Number(m[3])} ${months[Number(m[2])-1]} ${m[1]}`;
}
function formatSurveyTime(value){
  const m=String(value||'').match(/T(\d{2}):(\d{2})/);
  return m?`${m[1]}:${m[2]}`:'';
}
function surveyMetaHtml(job){
  if(!job.surveyDate){
    if(job.status==='pending'||job.status==='uploading'||job.stage==='downloading') return '<div class="yg-survey-meta">Tanggal survei akan dibaca dari metadata foto setelah foto diperiksa.</div>';
    return '';
  }
  const date=formatSurveyDate(job.surveyDate);
  const start=formatSurveyTime(job.surveyStartAt), end=formatSurveyTime(job.surveyEndAt);
  const time=start?(end&&end!==start?`${start}–${end}`:start):'';
  const cameras=Array.isArray(job.cameraModels)?job.cameraModels.filter(Boolean).join(', '):'';
  const parts=[`<strong>Tanggal survei:</strong> ${date}`];
  if(time) parts.push(`<strong>Waktu:</strong> ${time}`);
  if(cameras) parts.push(`<strong>Kamera:</strong> ${cameras}`);
  return `<div class="yg-survey-meta">${parts.join(' · ')}</div>`;
}

function renderProgress(job){
  if(!job) return;
  const box=progressBox();
  if(!box) return;
  let progress=Number(job.progress||0);
  let label=job.stageLabel||'';
  if(job.status==='pending'){
    progress=0;
    label=job.queuePosition?`Menunggu giliran · antrean ${job.queuePosition}${job.queueSize?` dari ${job.queueSize}`:''}`:'Menunggu giliran pemrosesan';
  }else if(job.status==='uploading'){
    progress=0; label='Menyiapkan foto';
  }else if(job.status==='ready'){
    progress=100; label='Selesai';
  }else if(job.status==='failed'){
    label='Pemrosesan terhenti';
  }
  box.hidden=false;
  const stage=job.stage||'';
  const stageOrder=['downloading','checking','preparing','reconstructing','orthomosaic','saving'];
  const currentIndex=stageOrder.indexOf(stage);
  const steps=stepDefs.map(([key,text],idx)=>{
    let cls='';
    if(job.status==='ready'||idx<currentIndex) cls='done';
    else if(idx===currentIndex) cls='active';
    return `<div class="yg-progress-step ${cls}">${text}</div>`;
  }).join('');
  const counts=[];
  if(job.downloadedPhotos!=null && job.expectedPhotos) counts.push(`${job.downloadedPhotos}/${job.expectedPhotos} foto diterima`);
  if(job.validPhotos!=null) counts.push(`${job.validPhotos} foto digunakan`);
  if(job.excludedPhotos!=null) counts.push(`${job.excludedPhotos} foto tidak digunakan`);
  if(job.status==='pending'&&job.queuePosition) counts.push(`Antrean ${job.queuePosition}${job.queueSize?`/${job.queueSize}`:''}`);
  box.innerHTML=`<div class="yg-progress-head"><strong>${cleanText(label||'Memproses orthomosaic')}</strong><span>${Math.round(progress)}%</span></div><div class="yg-progress-track"><i style="width:${Math.max(0,Math.min(100,progress))}%"></i></div>${counts.length?`<div class="yg-progress-meta">${counts.map(x=>`<span>${x}</span>`).join('')}</div>`:''}${surveyMetaHtml(job)}<div class="yg-progress-steps">${steps}</div>`;
  const action=document.getElementById('jobActions');
  if(action) action.hidden=job.status!=='ready';
}

const startButton=document.getElementById('startOrthomosaic');
if(startButton){
  startButton.addEventListener('click',()=>{
    const title=document.getElementById('processTitle');
    if(title && !title.value.trim()) title.value='Survei drone';
  },true);
}

const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init){
  const response=await nativeFetch(input,init);
  try{
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(/\/api\/drone\/jobs(?:\/drn-[A-Za-z0-9-]+)?(?:\?|$)/.test(url)){
      const clone=response.clone();
      clone.json().then(data=>{if(data&&data.job) renderProgress(data.job)}).catch(()=>{});
    }
  }catch{}
  return response;
};

normalizeNode();
progressBox();
new MutationObserver(records=>{
  for(const record of records){
    if(record.type==='characterData' && record.target?.parentNode) normalizeNode(record.target.parentNode);
    for(const node of record.addedNodes||[]) if(node.nodeType===1||node.nodeType===3) normalizeNode(node.nodeType===3?node.parentNode:node);
  }
}).observe(document.body,{subtree:true,childList:true,characterData:true});
})();
