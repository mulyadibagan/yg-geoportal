(function(){'use strict';
document.documentElement.style.visibility='hidden';
var KEY='ygEditorSessionV1',WORKER='https://yg-webgis-public-data.yg-webgis-public-data-worker.workers.dev',NEXT='js/rspo-area-profile-internal.js?v=20260916-internal1';
function read(){try{var s=JSON.parse(localStorage.getItem(KEY)||sessionStorage.getItem(KEY)||'null');if(!s||!s.token||Number(s.expiresAt||0)<=Date.now())return null;return s}catch(e){return null}}
function back(){return location.pathname.split('/').pop()+location.search+location.hash}
function login(){location.replace('staff-login.html?return='+encodeURIComponent(back()))}
function clear(){try{localStorage.removeItem(KEY);sessionStorage.removeItem(KEY)}catch(e){}}
function start(){document.documentElement.style.visibility='';var type=document.getElementById('rap-type');if(type)type.textContent='PORTOFOLIO INTERNAL STAF';var aside=document.querySelector('.rap-hero aside span');if(aside)aside.textContent='REFERENSI INTERNAL';var script=document.createElement('script');script.src=NEXT;document.body.appendChild(script)}
var s=read();if(!s){login();return}
fetch(WORKER+'/api/staff/rspo-groups',{method:'GET',headers:{authorization:'Bearer '+s.token},cache:'no-store'}).then(function(r){if(r.status===401||r.status===403)throw Error('unauthorized');if(!r.ok)throw Error('service');start()}).catch(function(e){if(e&&e.message==='unauthorized'){clear();login();return}start()});
})();