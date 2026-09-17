(function(){'use strict';
const WORKER='https://yg-webgis-public-data.yg-webgis-public-data-worker.workers.dev';
const $=id=>document.getElementById(id);
let session,map,layer,overview=[],companies=null,companyRequest=null,version=0,verified=false;
const colors=['#1b7837','#2b8cbe','#88419d','#d95f0e','#238b45','#756bb1','#cb181d','#008080'];
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function color(name){let h=0;for(const c of String(name||''))h=(h*31+c.charCodeAt(0))>>>0;return colors[h%colors.length]}
function login(){location.replace('staff-login.html?return='+encodeURIComponent('staff-rspo-riau.html'+location.search))}
function clearData(){version++;companies=null;overview=[];if(layer)layer.clearLayers();$('staff-rspo-table').innerHTML='';$('rspo-internal-content').hidden=true;verified=false}
async function api(path){
 session=window.YG_AUTH&&window.YG_AUTH.readStoredSession();
 if(!session||!session.token){clearData();login();throw Error('Silakan login staf.')}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
 try{
  const r=await fetch(WORKER+path,{headers:{authorization:'Bearer '+session.token},cache:'no-store',signal:controller.signal});
  if(r.status===401||r.status===403){clearData();localStorage.removeItem('ygEditorSessionV1');sessionStorage.removeItem('ygEditorSessionV1');login();throw Error('Sesi staf berakhir.')}
  if(!r.ok)throw Error('Data internal belum tersedia (HTTP '+r.status+'). Silakan coba lagi.');
  const data=await r.json();
  if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('Format data polygon belum sesuai.');
  return data.features.filter(f=>f.properties&&f.geometry&&['Polygon','MultiPolygon'].includes(f.geometry.type));
 }catch(e){if(e.name==='AbortError')throw Error('Waktu pemuatan habis. Silakan coba lagi.');throw e}finally{clearTimeout(timer)}
}
function ringArea(ring){let sum=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];sum+=(b[0]-a[0])*Math.PI/180*(2+Math.sin(a[1]*Math.PI/180)+Math.sin(b[1]*Math.PI/180))}return Math.abs(sum*6378137*6378137/2)/10000}
function polygonArea(rings){return Math.max(0,ringArea(rings[0]||[])-rings.slice(1).reduce((a,r)=>a+ringArea(r),0))}
function area(f){const g=f.geometry;return g.type==='Polygon'?polygonArea(g.coordinates):g.coordinates.reduce((a,r)=>a+polygonArea(r),0)}
function options(select,values,label){select.innerHTML='';const add=(value,text)=>{const o=document.createElement('option');o.value=value;o.textContent=text;select.appendChild(o)};add('',label);values.forEach(v=>add(v.value,v.text))}
function parents(){const names=[...new Set(overview.concat(companies||[]).map(f=>f.properties.Parent||f.properties.RSPO_GROUP).filter(Boolean))].sort();const old=$('staff-rspo-parent').value;options($('staff-rspo-parent'),names.map(n=>({value:n,text:n})),'Semua grup');$('staff-rspo-parent').value=old}
function companyOptions(){const group=$('staff-rspo-parent').value,rows=new Map();for(const f of companies||[]){const p=f.properties;if(!group||p.Parent===group)rows.set(p.COMPANY_ID,p.PO_COMPANY)}options($('staff-rspo-company'),[...rows].map(([value,text])=>({value,text})).sort((a,b)=>a.text.localeCompare(b.text)),'Semua perusahaan pada grup');$('staff-rspo-company').disabled=false}
async function getCompanies(){if(companies)return companies;if(!companyRequest)companyRequest=api('/api/staff/rspo-companies').then(rows=>{companies=rows;return rows}).finally(()=>{companyRequest=null});return companyRequest}
function resetSummary(){for(const id of ['features','area','units','supply'])$('staff-rspo-'+id).textContent='—';$('staff-rspo-legend').innerHTML='';$('staff-rspo-table').innerHTML='<tr><td colspan="6">Pilih grup atau perusahaan untuk memeriksa rincian.</td></tr>'}
function popup(f,isOverview){const p=f.properties;if(isOverview)return '<strong>'+esc(p.Parent)+'</strong><p>Ringkasan grup; pilih grup untuk membuka nama perusahaan dan polygon rinci.</p>';return '<strong>'+esc(p.PO_COMPANY)+'</strong><br>Grup: '+esc(p.Parent)+'<br>Unit pengelola perusahaan: '+esc(p.MANAGEMENT_UNITS||'Belum tercantum')+'<br>Basis pasok perusahaan: '+esc(p.SUPPLY_BASE||'Belum tercantum')+'<br>ID petak sumber: '+esc(p.SOURCE_FID)+'<br>Luas geometri: '+area(f).toLocaleString('id-ID',{maximumFractionDigits:2})+' ha'}
async function draw(rows,isOverview,ticket){
 layer.clearLayers();resetSummary();
 for(let i=0;i<rows.length;i+=250){
  if(ticket!==version)return;
  L.geoJSON({type:'FeatureCollection',features:rows.slice(i,i+250)},{renderer:L.canvas({padding:.5}),style:f=>({color:color(f.properties.Parent),weight:isOverview?1:1.5,fillOpacity:.28}),onEachFeature:(f,l)=>{l.bindPopup(popup(f,isOverview));if(isOverview)l.on('click',()=>{$('staff-rspo-parent').value=f.properties.Parent;loadSelection(true)})}}).eachLayer(l=>layer.addLayer(l));
  if(i+250<rows.length)await new Promise(resolve=>setTimeout(resolve,0));
 }
 if(ticket!==version)return;
 if(layer.getLayers().length)map.fitBounds(layer.getBounds(),{padding:[20,20],maxZoom:14});
 $('staff-rspo-feature-label').textContent=isOverview?'Grup ditampilkan':'Petak ditampilkan';
 $('staff-rspo-features').textContent=rows.length.toLocaleString('id-ID');
 if(!isOverview){
  $('staff-rspo-area').textContent=rows.reduce((n,f)=>n+area(f),0).toLocaleString('id-ID',{maximumFractionDigits:2});
  const distinct=key=>new Set(rows.flatMap(f=>String(f.properties[key]||'').split(' · ').filter(Boolean))).size;
  $('staff-rspo-units').textContent=distinct('MANAGEMENT_UNITS');$('staff-rspo-supply').textContent=distinct('SUPPLY_BASE');
  $('staff-rspo-table').innerHTML=rows.slice(0,1000).map(f=>{const p=f.properties;return '<tr><td>'+esc(p.SOURCE_FID)+'</td><td>'+esc(p.Parent)+'</td><td><strong>'+esc(p.PO_COMPANY)+'</strong></td><td>'+esc(p.MANAGEMENT_UNITS||'—')+'</td><td>'+esc(p.SUPPLY_BASE||'—')+'</td><td>'+area(f).toLocaleString('id-ID',{maximumFractionDigits:2})+'</td></tr>'}).join('')||'<tr><td colspan="6">Tidak ada petak pada pilihan ini.</td></tr>';
  if(rows.length>1000)$('staff-rspo-table').innerHTML+='<tr><td colspan="6">Tabel menampilkan 1.000 petak pertama; seluruh petak pilihan tampil di peta.</td></tr>';
 }
 $('staff-rspo-legend').hidden=false;$('staff-rspo-legend').innerHTML=[...new Set(rows.map(f=>f.properties.Parent))].map(n=>'<span><i style="background:'+color(n)+'"></i>'+esc(n)+'</span>').join('');
 $('staff-rspo-status').textContent=isOverview?rows.length+' grup ditampilkan. Pilih grup atau klik polygon untuk membuka rincian perusahaan.':rows.length.toLocaleString('id-ID')+' petak ditampilkan. Luas dihitung dari geometri; unit dan basis pasok dicatat pada tingkat perusahaan.';
}
async function showOverview(){const ticket=++version;$('staff-rspo-parent').value='';options($('staff-rspo-company'),[],'Pilih grup terlebih dahulu');$('staff-rspo-company').disabled=true;await draw(overview,true,ticket)}
async function loadSelection(groupChanged){const ticket=++version,group=$('staff-rspo-parent').value;if(!group){await showOverview();return}const selected=groupChanged?'':$('staff-rspo-company').value;
 if(groupChanged){options($('staff-rspo-company'),[],'Memuat perusahaan…');$('staff-rspo-company').disabled=true}
 layer.clearLayers();resetSummary();$('staff-rspo-status').textContent='Memuat rincian perusahaan dan polygon internal…';
 try{const rows=await getCompanies();if(ticket!==version)return;parents();companyOptions();$('staff-rspo-company').value=selected;await draw(rows.filter(f=>f.properties.Parent===group&&(!selected||f.properties.COMPANY_ID===selected)),false,ticket)}catch(e){if(ticket===version){$('staff-rspo-status').textContent=e.message+' Gunakan tombol Muat pilihan untuk mencoba kembali.'}}
}
function createMap(){if(map)return;map=L.map('staff-rspo-map',{preferCanvas:true}).setView([.55,101.7],7);const street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}),satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'© Esri'});street.addTo(map);L.control.layers({'Peta jalan':street,'Citra satelit':satellite},null,{collapsed:false}).addTo(map);layer=L.featureGroup().addTo(map)}
async function start(){
 $('rspo-access-status').textContent='Memeriksa sesi dan memuat peta internal…';$('rspo-retry').hidden=true;
 try{overview=await api('/api/staff/rspo-groups');$('rspo-access').hidden=true;$('rspo-internal-content').hidden=false;createMap();verified=true;parents();$('staff-rspo-parent').disabled=false;$('staff-rspo-load').disabled=false;$('staff-rspo-all').disabled=false;await showOverview();setTimeout(()=>map.invalidateSize(),0)}catch(e){if(!verified){$('rspo-internal-content').hidden=true;$('rspo-access').hidden=false;$('rspo-access-status').textContent=e.message;$('rspo-retry').hidden=false}}
}
$('rspo-retry').addEventListener('click',start);
$('rspo-logout').addEventListener('click',()=>{clearData();window.YG_AUTH.logout();login()});
$('staff-rspo-parent').addEventListener('change',()=>loadSelection(true));
$('staff-rspo-company').addEventListener('change',()=>loadSelection(false));
$('staff-rspo-load').addEventListener('click',()=>loadSelection(false));
$('staff-rspo-all').addEventListener('click',showOverview);
$('rspo-clear-map').addEventListener('click',()=>{version++;if(layer)layer.clearLayers();resetSummary();$('staff-rspo-status').textContent='Peta dibersihkan. Pilih grup atau tampilkan semua grup.'});
start();
})();
