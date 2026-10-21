const test=require('node:test');
const assert=require('node:assert/strict');
const views=require('../js/kups-report-views.js');
test('preview updates only the chosen account for income, expense, unpaid and unknown balances',()=>{
 const accounts=[{id:'cash',balance:13176516},{id:'bank',balance:9314784}];
 for(const kind of ['income','expense'])for(const selected of ['cash','bank']){
  const rows=views.forecast(accounts,kind,selected,100000);
  for(const r of rows)assert.equal(r.after,r.before+(r.id===selected?(kind==='income'?100000:-100000):0));
 }
 assert.deepEqual(views.forecast(accounts,'expense','',100000).map(r=>r.after),[13176516,9314784]);
 assert.equal(views.forecast(accounts,'expense','cash',14000000)[0].after,-823484);
 assert.equal(views.forecast([],'income','bank',100)[1].after,null);
 assert.equal(views.forecast(accounts,'income','bank',NaN)[1].after,9314784);
});
test('entire report keeps actual active payments, account names and escaped descriptions',()=>{
 const rows=[{date:'2026-09-01',kind:'income',amount:100,description:'<script>',source_ref:'ref',category:'Nanas',account:'bank'},{date:'2026-10-01',kind:'expense',amount:50,description:'Pupuk',account:'cash'},{deleted_at:'deleted',description:'Deleted'}];
 const html=views.entireTable(rows,String,s=>String(s??'').replace(/</g,'&lt;'));
 assert.match(html,/2026-09-01/);assert.match(html,/2026-10-01/);assert.match(html,/Rekening kelompok/);assert.doesNotMatch(html,/<script>|Deleted/);
 assert.match(views.breakdown([],String,String,true),/seluruh periode/);
});
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
