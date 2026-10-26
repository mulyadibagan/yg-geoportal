(function(){
'use strict';
var key='ygEditorSessionV1',session=null,returnTo=location.pathname.split('/').pop()+location.search+location.hash;
try{session=window.YG_AUTH?window.YG_AUTH.readStoredSession():JSON.parse(localStorage.getItem(key)||sessionStorage.getItem(key)||'null')}catch(ignore){}
function login(){location.replace('staff-login.html?return='+encodeURIComponent(returnTo))}
if(!session||!session.token||Number(session.expiresAt||0)<=Date.now()){login();return}
function failure(message){
 function show(){
  var style=document.createElement('style');style.textContent='body>*{display:none!important}body>#ps-access-error{display:block!important;max-width:560px;margin:60px auto;padding:24px;font:16px/1.6 system-ui;background:white;color:#173d32}';document.head.appendChild(style);
  var panel=document.createElement('section'),text=document.createElement('p'),retry=document.createElement('button'),link=document.createElement('a');panel.id='ps-access-error';panel.setAttribute('role','alert');text.textContent=message;retry.textContent='Coba kembali';retry.onclick=function(){location.reload()};link.textContent='Login staf';link.href='staff-login.html?return='+encodeURIComponent(returnTo);link.style.marginLeft='16px';panel.append(text,retry,link);document.body.append(panel);document.documentElement.style.visibility='visible';
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
}
var controller=new AbortController(),timer=setTimeout(function(){controller.abort()},15000);
fetch('https://webgis-api.yayasangambut.org/api/staff/social-forestry-details',{headers:{authorization:"Bearer "+session.token},cache:'no-store',signal:controller.signal}).then(function(response){
 if(response.status===401){login();return}
 if(response.status===403){failure('Akun ini belum memiliki akses Direktori PS. Hubungi administrator.');return}
 if(!response.ok)throw Error('Data PS belum tersedia ('+response.status+').');
 document.documentElement.style.visibility='visible';
}).catch(function(){failure('Direktori PS belum dapat dihubungi. Sesi Anda tetap tersimpan; silakan coba kembali.');}).finally(function(){clearTimeout(timer)});
})();
