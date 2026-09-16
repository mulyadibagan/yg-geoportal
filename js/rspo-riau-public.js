(function(){'use strict';
document.documentElement.style.visibility='hidden';
var KEY='ygEditorSessionV1',WORKER='https://yg-webgis-public-data.yg-webgis-public-data-worker.workers.dev',NEXT='js/rspo-riau-staff-dashboard.js?v=20260916-internal3';
function read(){try{var s=JSON.parse(localStorage.getItem(KEY)||sessionStorage.getItem(KEY)||'null');if(!s||!s.token||Number(s.expiresAt||0)<=Date.now())return null;return s}catch(e){return null}}
function back(){return location.pathname.split('/').pop()+location.search+location.hash}
function login(){location.replace('staff-login.html?return='+encodeURIComponent(back()))}
function clear(){try{localStorage.removeItem(KEY);sessionStorage.removeItem(KEY)}catch(e){}}
function start(){document.documentElement.style.visibility='';document.querySelectorAll('.eyebrow,.rspo-label').forEach(function(el){if(/portal informasi publik/i.test(el.textContent||''))el.textContent='MODUL INTERNAL STAF'});var nav=document.querySelector('.yg-page-nav');if(nav){var loginLink=nav.querySelector('a[href*="staff-login"]');if(loginLink){loginLink.href='admin-dashboard.html';loginLink.textContent='Dashboard Staf'}}var script=document.createElement('script');script.src=NEXT;document.body.appendChild(script)}
var s=read();if(!s){login();return}
fetch(WORKER+'/api/staff/rspo-groups',{method:'GET',headers:{authorization:'Bearer '+s.token},cache:'no-store'}).then(function(r){if(r.status===401||r.status===403)throw Error('unauthorized');if(!r.ok)throw Error('service');start()}).catch(function(e){if(e&&e.message==='unauthorized'){clear();login();return}start()});
})();