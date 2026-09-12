(function(){
"use strict";
var box=document.getElementById("ps-archive-list");
if(!box)return;
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function monthLabel(v){return new Date(v+"-01T00:00:00Z").toLocaleDateString("id-ID",{month:"long",year:"numeric",timeZone:"UTC"})}
fetch("data/phl-svlk-monthly/index.json?v=20260912-1",{cache:"no-store"}).then(function(r){if(!r.ok)throw Error();return r.json()}).then(function(index){var reports=index.reports||[];if(!reports.length)throw Error();box.innerHTML=reports.map(function(row){var s=row.summary||{};return'<a class="ps-archive-card" href="'+esc(row.href)+'" target="_blank" rel="noopener noreferrer"><span>LAPORAN FINAL</span><strong>'+esc(monthLabel(row.month))+'</strong><b>'+Number(s.verified||0).toLocaleString("id-ID")+' terverifikasi</b><small>'+Number(s.pbph||0).toLocaleString("id-ID")+' PBPH · '+Number(s.followup||0).toLocaleString("id-ID")+' perlu penelusuran · '+Number(s.expired||0).toLocaleString("id-ID")+' berakhir</small></a>'}).join("")}).catch(function(){box.innerHTML='<p class="ps-empty">Arsip bulanan belum tersedia.</p>'});
})();
