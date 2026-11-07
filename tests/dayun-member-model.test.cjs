const test=require('node:test'),assert=require('node:assert/strict');
const {directory}=require('../js/dayun-member-model.js');
const roster={members:[{id:'m1',name:'NAMA LENGKAP',organisation:'KWT Mandiri Sejahtera',role:'Ketua',kupsMembership:'unconfirmed'}]};
test('confirmed attendance links by full name without changing group membership',()=>{
 const rows=directory(roster,[{id:'event1',date:'2026-10-31',title:'Sensus',participants:[{name:' Nama  Lengkap ',status:'present'}]},{id:'event2',date:'2026-11-07',title:'Rencana',participants:[{name:'NAMA LENGKAP',status:'planned'}]}]);
 assert.equal(rows.length,1);assert.equal(rows[0].present,1);assert.equal(rows[0].history.length,2);assert.equal(rows[0].unconfirmed,1);assert.equal(rows[0].kupsMembership,'unconfirmed');
});
test('short names remain unmatched rather than being guessed',()=>{
 const rows=directory(roster,[{id:'e',participants:[{name:'Nama',status:'present'}]}]);assert.equal(rows[0].history.length,0);assert.equal(rows[1].registered,false);assert.equal(rows[1].present,1);
});
test('duplicate event payloads do not double attendance counts',()=>{
 const e={id:'e',participants:[{name:'NAMA LENGKAP',status:'present'},{name:'nama lengkap',status:'present'}]};assert.equal(directory(roster,[e,e])[0].present,1);
});
test('duplicate registry names require review and are not assigned to one person',()=>{
 const rows=directory({members:[...roster.members,{...roster.members[0],id:'m2'}]},[{id:'e',participants:[{name:'NAMA LENGKAP',status:'present'}]}]);assert.equal(rows[0].present,0);assert.equal(rows[1].present,0);assert.equal(rows[2].registered,false);
});

