const test=require('node:test');
const assert=require('node:assert/strict');
const views=require('../js/kups-report-views.js');
test('category breakdown reconciles cash totals and excludes trash, transfers and invoice totals',()=>{
 const rows=[{kind:'income',category:'Penjualan nanas',amount:30,total_amount:100},{kind:'income',category:'Penjualan nanas',amount:20},{kind:'income',category:'Modal / dukungan',amount:50},{kind:'expense',category:'Upah',amount:40},{kind:'expense',category:'BBM',amount:10},{kind:'expense',category:'Upah',amount:99,deleted_at:'deleted'},{kind:'expense',category:'BBM',amount:88,_transfer:true},{kind:'transfer',amount:100}];
 const g=views.categories(rows);
 assert.equal(g.income.reduce((n,r)=>n+r.amount,0),100);assert.equal(g.expense.reduce((n,r)=>n+r.amount,0),50);
 assert.equal(g.income.find(r=>r.category==='Penjualan nanas').count,2);
 assert.equal(g.expense[0].category,'Upah');assert.equal(g.expense[0].share,0.8);
 assert.deepEqual(views.categories([]),{income:[],expense:[]});
});
test('closing displays reported bank and cash, explicit rounding, and a changed-book warning',()=>{
 const fmt=n=>String(Number(n.toFixed(2))),esc=s=>String(s).replace(/</g,'&lt;');
 const data={summary:{closing:10000.855265},reconciliation:{month:'2026-08',cash_amount:5001,bank_amount:5000,book_amount:10000.855265,note:'<test>',updated_by:'admin',updated_at:'date'}};
 const html=views.closing(data,fmt,esc);
 assert.match(html,/Rekening kelompok/);assert.match(html,/Kas tunai/);assert.match(html,/Selisih pembulatan/);assert.match(html,/0.14/);assert.doesNotMatch(html,/<test>/);
 assert.doesNotMatch(html,/Saldo buku berubah/);
 assert.match(views.closing({...data,summary:{closing:9000}},fmt,esc),/Saldo buku berubah/);
 assert.match(views.closing({summary:{}},fmt,esc),/belum direkonsiliasi/);
});
