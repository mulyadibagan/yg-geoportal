(()=>{
'use strict';
const legacyTitle=/^Survei drone\s+\d{1,2}[/-]\d{1,2}[/-]\d{4}$/i;
const idDate=new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric'});
const idTime=new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
let lastJob=null;

function cleanLegacyTitles(){
  document.querySelectorAll('#jobState strong,#missionArchive h3').forEach(el=>{
    if(legacyTitle.test((el.textContent||'').trim())) el.textContent='Survei drone';
  });
}

function parseLocalIso(v){
  if(!v)return null;
  const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if(!m)return null;
  return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]));
}

function ensureMetaBox(){
  let box=document.getElementById('surveyMetadata');
  if(box)return box;
  const state=document.getElementById('jobState');
  if(!state)return null;
  box=document.createElement('div');
  box.id='surveyMetadata';
  box.className='survey-metadata';
  state.insertAdjacentElement('afterend',box);
  return box;
}

function renderMetadata(job){
  if(!job)return;
  lastJob=job;
  cleanLegacyTitles();
  const box=ensureMetaBox();
  if(!box)return;
  const start=parseLocalIso(job.surveyStartAt);
  const end=parseLocalIso(job.surveyEndAt);
  const date=job.surveyDate?new Date(`${job.surveyDate}T00:00:00`):null;
  const cameras=Array.isArray(job.cameraModels)?job.cameraModels.filter(Boolean):[];
  if(date && !Number.isNaN(date.getTime())){
    const parts=[`<div><span>Tanggal survei</span><strong>${idDate.format(date)}</strong></div>`];
    if(start && end) parts.push(`<div><span>Waktu pengambilan</span><strong>${idTime.format(start)}–${idTime.format(end)}</strong></div>`);
    if(cameras.length) parts.push(`<div><span>Kamera</span><strong>${cameras.join(', ')}</strong></div>`);
    if(job.metadataPhotoCount!=null) parts.push(`<div><span>Metadata terbaca</span><strong>${job.metadataPhotoCount} foto</strong></div>`);
    box.innerHTML=parts.join('');
    box.hidden=false;
  }else if(job.status==='pending'||job.status==='processing'){
    box.innerHTML='<div class="survey-meta-note">Tanggal survei akan dibaca dari metadata foto setelah pemeriksaan.</div>';
    box.hidden=false;
  }else{
    box.hidden=true;
  }
}

const originalFetch=window.fetch.bind(window);
window.fetch=async(...args)=>{
  const response=await originalFetch(...args);
  try{
    const url=String(args[0]&&args[0].url?args[0].url:args[0]||'');
    if(url.includes('/api/drone/jobs')){
      response.clone().json().then(data=>{
        if(data&&data.job) setTimeout(()=>renderMetadata(data.job),0);
      }).catch(()=>{});
    }
  }catch{}
  return response;
};

document.addEventListener('click',e=>{
  const btn=e.target.closest&&e.target.closest('#startOrthomosaic');
  if(!btn)return;
  const input=document.getElementById('processTitle');
  if(input && !input.value.trim()) input.value='Survei drone';
},true);

const observer=new MutationObserver(()=>{cleanLegacyTitles(); if(lastJob) renderMetadata(lastJob);});
observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
cleanLegacyTitles();
})();
