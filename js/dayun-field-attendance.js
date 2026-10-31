(function () {
 'use strict';
 var hosts=Array.from(document.querySelectorAll('[data-dayun-attendance]'));
 if(!hosts.length)return;
 fetch('https://staff.yayasangambut.org/api/kups/activities/summary?group=dayun-rimba-sejahtera',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)})
 .then(function(response){if(!response.ok)throw Error('HTTP '+response.status);return response.json();})
 .then(function(data){
  hosts.forEach(function(host){
   var event=data.events.find(function(row){return row.id===host.dataset.dayunAttendance;}),copy=host.querySelector('span');
   if(!event){copy.textContent='Absensi belum ditautkan.';return;}
   copy.replaceChildren();
   var strong=document.createElement('strong');strong.textContent=event.present+' hadir';copy.append(strong,document.createTextNode(' dari '+event.total+' peserta'));
   var note=document.createElement('small');note.textContent=event.total===0?'Peserta belum dicatat.':event.unconfirmed?event.unconfirmed+' peserta belum dikonfirmasi.':event.present===event.total?'Seluruh peserta telah dikonfirmasi hadir.':'Kehadiran telah dicatat; rincian tersedia pada absensi.';copy.appendChild(note);
  });
 }).catch(function(){hosts.forEach(function(host){host.querySelector('span').textContent='Ringkasan kehadiran belum dapat dimuat. Absensi tersedia melalui tautan login.';});});
})();
