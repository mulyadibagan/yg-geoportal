(function(){
 'use strict';
 const $=id=>document.getElementById(id),base='https://staff.yayasangambut.org',rosterUrl='https://webgis-api.yayasangambut.org/api/staff/dayun-member-roster';
 const labels={present:'Hadir',planned:'Belum dikonfirmasi',permission:'Izin',sick:'Sakit',absent:'Tidak hadir'};
 let token='',rows=[],turn=0;
 function session(){for(const [storage,key] of [[localStorage,'ygDayunAttendanceSession'],[sessionStorage,'ygDayunAttendanceSession'],[localStorage,'ygEditorSessionV1'],[sessionStorage,'ygEditorSessionV1']]){try{const s=JSON.parse(storage.getItem(key)||'null');if(s?.token?.startsWith('yg-google-')&&Number(s.expiresAt)>Date.now())return s;}catch{}}return null;}
 function text(tag,value,parent){const node=document.createElement(tag);node.textContent=value;parent.appendChild(node);return node;}
 function status(value,error=false){$('member-status').textContent=value;$('member-status').classList.toggle('error',error);}
 function clear(){++turn;rows=[];token='';$('member-list').replaceChildren();$('member-kpis').replaceChildren();$('member-app').hidden=true;$('member-login-panel').hidden=false;}
 function date(value){return new Date(value+'T12:00:00+07:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});}
 function render(){
  const q=YGDayunMemberModel.nameKey($('member-search').value),group=$('member-group').value,presence=$('member-presence').value;
  const selected=rows.filter(row=>(!q||YGDayunMemberModel.nameKey(row.name).includes(q))&&(!group||(group==='registered'?row.registered:!row.registered))&&(!presence||(presence==='present'?row.present>0:row.present===0)));
  $('member-count').textContent=selected.length+' nama ditampilkan';const host=$('member-list');host.replaceChildren();
  selected.forEach(row=>{
   const card=document.createElement('details');card.className='member-row';const summary=document.createElement('summary');const identity=document.createElement('span');text('strong',row.name,identity);text('small',row.organisation+' · '+row.role,identity);summary.append(identity);text('span',row.present+' kali hadir · '+row.history.length+' kegiatan tercatat',summary);card.append(summary);
   const body=document.createElement('div');body.className='member-history';text('p',row.registered?'Terdaftar sebagai anggota KWT. Status anggota resmi KUPS belum dikonfirmasi.':'Nama peserta belum cocok dengan daftar anggota sumber. Nama singkat atau ejaan berbeda perlu diverifikasi.',body);
   if(!row.history.length)text('p','Belum ada riwayat absensi yang cocok. Ini tidak berarti anggota tidak pernah mengikuti kegiatan.',body);
   else{const table=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');['Tanggal','Kegiatan','Kehadiran'].forEach(label=>text('th',label,tr));head.append(tr);table.append(head);const tbody=document.createElement('tbody');row.history.forEach(item=>{const tr=document.createElement('tr');text('td',date(item.date),tr);const td=document.createElement('td'),link=text('a',item.title,td);link.href='dayun-kegiatan.html?event='+encodeURIComponent(item.eventId);tr.append(td);text('td',labels[item.status]||'Belum dikonfirmasi',tr);tbody.append(tr);});table.append(tbody);body.append(table);}
   card.append(body);host.append(card);
  });if(!selected.length)text('p','Tidak ada nama yang cocok dengan filter.',host);
 }
 async function request(url,requestToken){const r=await fetch(url,{headers:{Authorization:'Bearer '+requestToken},credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(r.status===401?'Sesi berakhir atau akun belum memiliki akses kelompok. Masuk kembali.':'Data anggota belum dapat dimuat. Coba muat ulang.');return r.json();}
 async function load(){const s=session();if(!s){clear();status('Masuk untuk melihat anggota dan riwayat kehadiran.');return;}const run=++turn;token=s.token;status('Memuat daftar anggota dan absensi…');try{
   const result=await Promise.all([request(rosterUrl,token),request(base+'/api/kups/activities?group=dayun-rimba-sejahtera',token)]);if(run!==turn)return;if(session()?.token!==s.token){clear();return;}
   const [roster,attendance]=result;if(roster.groupId!=='dayun-rimba-sejahtera'||!Array.isArray(roster.members)||!attendance.user||!Array.isArray(attendance.events))throw Error('Data kelompok belum sesuai.');
   rows=YGDayunMemberModel.directory(roster,attendance.events);$('member-login-panel').hidden=true;$('member-app').hidden=false;$('member-identity').textContent=attendance.user.name||'Akun kelompok';
   const stats=[['Anggota KWT',roster.members.length],['Pengurus KWT',roster.members.filter(m=>m.role!=='Anggota').length],['Kegiatan berabsensi',attendance.events.length]];$('member-kpis').replaceChildren();stats.forEach(([label,n])=>{const card=document.createElement('article');text('strong',String(n),card);text('span',label,card);$('member-kpis').append(card);});
   $('member-source').textContent='Sumber daftar: '+roster.source.file+' · '+roster.source.sheet+' '+roster.source.range+'. Pencocokan absensi memakai nama yang sama, tanpa menebak nama singkat.';render();status('Daftar anggota terhubung dengan absensi.');
  }catch(e){if(run!==turn)return;clear();status(e.message,true);}}
 $('member-login').addEventListener('click',async()=>{try{$('member-login').disabled=true;const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join(''),verifier=random(),state=random();sessionStorage.setItem('ygGoogleRequest',JSON.stringify({verifier,state,created:Date.now(),target:'dayun-anggota.html'}));const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))),challenge=btoa(String.fromCharCode(...digest)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');location.assign(base+'/auth/kups?'+new URLSearchParams({state,challenge}));}catch{$('member-login').disabled=false;status('Login belum dapat dimulai. Coba kembali.',true);}});
 $('member-refresh').addEventListener('click',load);$('member-search').addEventListener('input',render);['member-group','member-presence'].forEach(id=>$(id).addEventListener('change',render));
 $('member-logout').addEventListener('click',async()=>{const old=token;for(const storage of [localStorage,sessionStorage])for(const key of ['ygDayunAttendanceSession','ygEditorSessionV1'])try{if(JSON.parse(storage.getItem(key)||'null')?.token===old)storage.removeItem(key);}catch{}clear();status('Anda telah keluar.');try{await fetch(base+'/api/webgis/logout',{method:'POST',headers:{Authorization:'Bearer '+old},signal:AbortSignal.timeout(10000)});}catch{}});
 window.addEventListener('storage',()=>{if(session()?.token!==token)load();});window.addEventListener('pageshow',()=>{if(session()?.token!==token)load();});setInterval(()=>{if(token&&session()?.token!==token){clear();status('Sesi berakhir. Masuk kembali.');}},10000);load();
})();

