(function(){
 'use strict';
 var key=String(new URLSearchParams(location.search).get('key')||'').trim().toLowerCase();
 if(!['2942','2942.0','sk.4281/menlhk-pskl/pkps/psl.0/7/2020'].includes(key))return;
 var anchor=document.getElementById('sf-spatial-analysis');if(!anchor)return;
 var section=document.createElement('section');section.id='sf-field-updates';section.className='vp-card';section.setAttribute('aria-label','Update internal lapangan');section.style.marginBottom='24px';
 section.innerHTML='<div class="vp-section-head"><div><span class="vp-kicker">CATATAN LAPANGAN</span><h2>Update internal lapangan</h2></div><span class="sf-internal-badge">INTERNAL · STAF YG</span></div><p role="status">Memuat laporan internal…</p>';
 anchor.before(section);
 var base='https://webgis-api.yayasangambut.org',urls=[],initial=window.YG_AUTH&&window.YG_AUTH.readStoredSession();
 function clear(){urls.forEach(function(url){URL.revokeObjectURL(url);});urls=[];section.replaceChildren();section.hidden=true;}
 function active(){var s=window.YG_AUTH&&window.YG_AUTH.readStoredSession();return s&&initial&&s.token===initial.token&&Number(s.expiresAt)>Date.now();}
 async function get(path){if(!active())throw Error('Login staf diperlukan.');var r=await fetch(base+path,{headers:{Authorization:'Bearer '+initial.token},cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);if(!active())throw Error('Sesi staf berubah.');return r;}
 function text(tag,value,parent){var node=document.createElement(tag);node.textContent=value;parent.appendChild(node);return node;}
 get('/api/staff/social-forestry-sungai-linau-field-updates').then(function(r){return r.json();}).then(async function(data){
  if(!active()||data.access!=='staff_only'||data.profileKey!=='2942.0')throw Error('Data tidak sesuai profil.');
  var status=section.querySelector('[role=status]');status.textContent='Laporan dan dokumentasi untuk peninjauan internal.';
  for(var update of data.updates||[]){
   var card=document.createElement('article');card.style.cssText='padding:20px 0;border-top:1px solid #dce7e0;overflow-wrap:anywhere';
   text('h3',update.title,card);
   text('p',new Date(update.observedAt).toLocaleString('id-ID',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Jakarta'})+' WIB · '+update.status,card);
   text('p',update.description,card);text('p',update.verificationNote,card);
   var location=update.location||{};
   text('p','Lokasi: '+[location.village,location.district,location.regency].filter(Boolean).join(' · '),card);
   text('p',location.coordinateSource||'',card);text('p',location.boundaryNote||'',card);
   text('p','Tindak lanjut: '+update.followup,card);section.appendChild(card);
   for(var photo of update.photos||[]){
    if(!/^\/api\/staff\/social-forestry-sungai-linau-photo-\d{8}$/.test(photo.path))continue;
    var figure=document.createElement('figure');figure.style.margin='18px 0';card.appendChild(figure);
    try{
     var blob=await(await get(photo.path)).blob();if(!active())throw Error('Sesi berakhir.');
     var url=URL.createObjectURL(blob);urls.push(url);
     var link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';
     var img=document.createElement('img');img.src=url;img.alt=update.title;img.style.cssText='display:block;width:100%;max-width:640px;max-height:620px;object-fit:contain;background:#edf3ef;border-radius:12px';link.appendChild(img);figure.appendChild(link);
     text('figcaption',photo.caption,figure);
    }catch(error){text('p','Foto internal belum dapat dimuat. Muat ulang halaman setelah memastikan sesi staf aktif.',figure);}
   }
  }
 }).catch(function(){if(!active()){clear();return;}section.querySelector('[role=status]').textContent='Update internal belum dapat dimuat. Silakan muat ulang halaman.';});
 window.addEventListener('storage',function(event){if(event.key==='ygEditorSessionV1'&&!active())clear();});
 window.addEventListener('unload',clear);
})();
