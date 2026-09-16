(function(){'use strict';
document.documentElement.style.visibility='hidden';
var KEY='ygEditorSessionV1',WORKER='https://yg-webgis-public-data.yg-webgis-public-data-worker.workers.dev',NEXT='js/rspo-criteria-learning-internal.js?v=20260916-internal1';
function read(){try{var s=JSON.parse(localStorage.getItem(KEY)||sessionStorage.getItem(KEY)||'null');if(!s||!s.token||Number(s.expiresAt||0)<=Date.now())return null;return s}catch(e){return null}}
function back(){return location.pathname.split('/').pop()+location.search+location.hash}
function login(){location.replace('staff-login.html?return='+encodeURIComponent(back()))}
var s=read();if(!s){login();return}
fetch(WORKER+'/api/staff/rspo-groups',{method:'HEAD',headers:{authorization:'Bearer '+s.token},cache:'no-store'}).then(function(r){if(!r.ok)throw Error('unauthorized');document.documentElement.style.visibility='';var eye=document.querySelector('.guide-eyebrow');if(eye)eye.textContent='PANDUAN INTERNAL STAF';var script=document.createElement('script');script.src=NEXT;document.body.appendChild(script)}).catch(function(){try{localStorage.removeItem(KEY);sessionStorage.removeItem(KEY)}catch(e){}login()});
})();