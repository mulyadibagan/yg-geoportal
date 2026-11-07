(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.YGDayunMemberModel=factory();})(typeof window==='object'?window:this,function(){
 'use strict';
 function nameKey(value){return String(value||'').normalize('NFKC').trim().toLocaleLowerCase('id-ID').replace(/\s+/g,' ');}
 function directory(roster,events){
  const members=(roster.members||[]).map(row=>({id:row.id,name:row.name,organisation:row.organisation,role:row.role,kupsMembership:row.kupsMembership||'unconfirmed',registered:true,history:[]}));
  const index=new Map(),unknown=new Map();
  members.forEach(member=>{const key=nameKey(member.name);index.set(key,index.has(key)?null:member);});
  const seenEvents=new Set();
  (events||[]).forEach(event=>{
   if(seenEvents.has(event.id))return;seenEvents.add(event.id);
   const seenNames=new Set();
   (event.participants||[]).forEach(person=>{
    const key=nameKey(person.name);if(!key||seenNames.has(key))return;seenNames.add(key);
    let member=index.get(key);
    if(!member){if(!unknown.has(key))unknown.set(key,{id:'participant-'+unknown.size,name:person.name,organisation:'Belum dikonfirmasi',role:'Peserta kegiatan',kupsMembership:'unconfirmed',registered:false,history:[]});member=unknown.get(key);}
    member.history.push({eventId:event.id,title:event.title,date:event.date,status:person.status});
   });
  });
  const result=members.concat(Array.from(unknown.values()));
  result.forEach(member=>{member.history.sort((a,b)=>String(b.date).localeCompare(String(a.date)));member.present=member.history.filter(row=>row.status==='present').length;member.unconfirmed=member.history.filter(row=>row.status==='planned').length;});
  return result;
 }
 return{nameKey,directory};
});

