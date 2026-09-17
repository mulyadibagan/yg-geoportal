(function(){
"use strict";
var worker="https://yg-webgis-public-data.yg-webgis-public-data-worker.workers.dev";
var session=window.YG_AUTH&&window.YG_AUTH.readStoredSession();
var returnTo=location.pathname.split("/").pop()+location.search;
if(!session||!session.token){window.YG_PRIVATE_DATA={json:function(){return Promise.reject(Error("Login staf diperlukan."))}};location.replace("staff-login.html?return="+encodeURIComponent(returnTo));return}
function endpoint(url){
  var clean=String(url||"").split("?")[0],match;
  if(clean.endsWith("data/PBPH_RIAU_052026.geojson"))return worker+"/api/staff/pbph-riau";
  if(clean.endsWith("data/pbph-tree-cover-monitoring.json"))return worker+"/api/staff/pbph-tree-cover-monitoring";
  if(clean.endsWith("data/pbph-documents.json"))return worker+"/api/staff/pbph-documents";
  if(clean.endsWith("data/fire-monthly/index.json"))return worker+"/api/staff/fire-monthly-index";
  if((match=clean.match(/data\/fire-monthly\/(20\d{2}-(?:0[1-9]|1[0-2]))\.json$/)))return worker+"/api/staff/fire-monthly-report?month="+match[1];
  if(clean.endsWith("data/phl-svlk-monthly/index.json"))return worker+"/api/staff/phl-svlk-monthly-index";
  if((match=clean.match(/data\/phl-svlk-monthly\/(20\d{2}-(?:0[1-9]|1[0-2]))\.json$/)))return worker+"/api/staff/phl-svlk-monthly-report?month="+match[1];
  throw Error("Jalur data internal tidak diizinkan.");
}
async function json(url){
  var response;
  try { response=await fetch(endpoint(url),{headers:{authorization:"Bearer "+session.token},cache:"no-store"}); }
  catch(error){showFailure("Koneksi data internal gagal. Silakan muat ulang.");throw error;}
  if(response.status===401){window.YG_AUTH.logout();location.replace("staff-login.html?return="+encodeURIComponent(returnTo));throw Error("Sesi admin berakhir.")}
  if(!response.ok){showFailure("Data internal belum dapat dimuat ("+response.status+").");throw Error("Data internal belum dapat dimuat ("+response.status+").");}
  document.body.classList.remove("staff-protected");document.body.style.visibility="visible";
  return response.json();
}
function showFailure(message){
  document.body.style.visibility="visible";
  var status=document.getElementById("private-load-error");
  if(!status){status=document.createElement("p");status.id="private-load-error";status.setAttribute("role","alert");document.body.prepend(status);}
  status.textContent=message;
}
window.YG_PRIVATE_DATA={json:json};
})();
