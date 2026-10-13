(function(){
'use strict';
const broker='https://staff.yayasangambut.org';
const button=document.getElementById('staff-google-login'),status=document.getElementById('staff-login-status');
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
button.addEventListener('click',async()=>{
 try{button.disabled=true;const verifier=random(),state=random();sessionStorage.setItem('ygGoogleRequest',JSON.stringify({verifier,state,created:Date.now()}));
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));const challenge=btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 location.assign(broker+'/auth/webgis?'+new URLSearchParams({state,challenge}));
 }catch{button.disabled=false;status.textContent='Login Google belum dapat dimulai. Coba kembali.';}
});
const params=new URLSearchParams(location.hash.slice(1)),code=params.get('googleCode');
if(code){history.replaceState(null,'',location.pathname+location.search);(async()=>{
 try{const pending=JSON.parse(sessionStorage.getItem('ygGoogleRequest')||'null');sessionStorage.removeItem('ygGoogleRequest');
 if(!pending||pending.state!==params.get('state')||Date.now()-pending.created>600000)throw Error('Permintaan login tidak cocok. Mulai kembali.');
 status.textContent='Menyelesaikan login Google…';button.disabled=true;
 const r=await fetch(broker+'/api/webgis/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,state:pending.state,verifier:pending.verifier})});const data=await r.json();
 if(!r.ok||data.ok!==true||!data.sessionToken||!['webgis-staff','kups-finance'].includes(data.scope))throw Error(data.error||'Login belum berhasil.');
 const s={token:data.sessionToken,username:data.username,name:data.name,email:data.email,role:data.role,scope:data.scope,expiresAt:data.expiresAt};localStorage.setItem('ygEditorSessionV1',JSON.stringify(s));
 location.replace(data.scope==='kups-finance'||pending.target==='kups-finance.html'?'kups-finance.html':'admin-dashboard.html');
 }catch(e){status.textContent=e.message;button.disabled=false;}
})();}
})();

