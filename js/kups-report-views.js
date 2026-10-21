(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YG_KUPS_REPORT_VIEWS=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function categories(rows){
    const groups={income:new Map(),expense:new Map()};
    for(const row of rows||[]){
      if(row.deleted_at||row._transfer||!groups[row.kind])continue;
      const category=String(row.category||'Belum dikategorikan');
      const item=groups[row.kind].get(category)||{category,amount:0,count:0};
      item.amount+=row.amount;item.count++;groups[row.kind].set(category,item);
    }
    return Object.fromEntries(Object.entries(groups).map(([kind,items])=>{
      const values=[...items.values()].sort((a,b)=>b.amount-a.amount||a.category.localeCompare(b.category));
      const total=values.reduce((sum,row)=>sum+row.amount,0);
      return [kind,values.map(row=>({...row,share:total?row.amount/total:0}))];
    }));
  }
  function closing(data,fmt,esc){
    const r=data.reconciliation;
    if(!r)return '<h2>Rekonsiliasi saldo akhir</h2><p class="muted">Saldo akhir kas tunai dan rekening belum direkonsiliasi untuk bulan pilihan.</p>';
    const total=r.cash_amount+r.bank_amount,delta=total-data.summary.closing;
    const changed=Math.abs(r.book_amount-data.summary.closing)>0.000001;
    const difference=delta===0?'Sesuai saldo buku':Math.abs(delta)<1?'Selisih pembulatan':'Selisih terhadap saldo buku';
    return '<h2>Rekonsiliasi saldo akhir</h2><p class="muted">Bulan '+esc(r.month)+'. Catatan saldo akhir, tidak mengubah saldo awal atau transaksi.</p><div class="table-wrap"><table><thead><tr><th>Akun</th><th class="number">Saldo akhir yang dicatat</th></tr></thead><tbody><tr><td>Rekening kelompok</td><td class="number">'+fmt(r.bank_amount)+'</td></tr><tr><td>Kas tunai</td><td class="number">'+fmt(r.cash_amount)+'</td></tr><tr><th>Total kas + rekening</th><td class="number">'+fmt(total)+'</td></tr><tr><td>'+difference+'</td><td class="number">'+fmt(delta)+'</td></tr></tbody></table></div>'+(changed?'<p class="error">Saldo buku berubah setelah rekonsiliasi dicatat. Periksa kembali catatan saldo akhir.</p>':'')+'<p class="muted">'+esc(r.note)+' · Dicatat oleh '+esc(r.updated_by)+' · '+esc(r.updated_at)+'</p>';
  }
  function forecast(accounts,kind,selected,amount){
    const paid=Number.isFinite(amount)&&amount>=0?amount:0;
    return ['cash','bank'].map(id=>{const before=accounts?.find(a=>a.id===id)?.balance??null;return {id,before,after:before===null?null:before+(id===selected?(kind==='income'?paid:-paid):0)};});
  }
  function entireTable(rows,fmt,esc){
    return '<div class="table-wrap"><table><thead><tr><th>Tanggal / referensi</th><th>Uraian / kategori</th><th>Akun</th><th class="number">Pemasukan</th><th class="number">Pengeluaran</th></tr></thead><tbody>'+rows.filter(r=>!r.deleted_at).map(r=>'<tr><td>'+esc(r.date)+'<br><small>'+esc(r.source_ref)+'</small></td><td>'+esc(r.description)+'<br><small>'+esc(r.category)+'</small></td><td>'+({cash:'Kas tunai',bank:'Rekening kelompok'}[r.account]||'Belum dipetakan')+'</td><td class="number">'+(r.kind==='income'?fmt(r.amount):'—')+'</td><td class="number">'+(r.kind==='expense'?fmt(r.amount):'—')+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function breakdown(rows,fmt,esc,all=false){
    const grouped=categories(rows);
    return '<h2>Rincian pemasukan dan pengeluaran '+(all?'seluruh periode':'bulan pilihan')+'</h2><p class="muted">Dikelompokkan berdasarkan kategori transaksi aktif. Transfer internal tidak dihitung sebagai pemasukan atau pengeluaran.</p><div class="two-col">'+['income','expense'].map(kind=>{
      const entries=grouped[kind],total=entries.reduce((sum,r)=>sum+r.amount,0);
      return '<article class="card category-chart"><h3>'+(kind==='income'?'Pemasukan dari apa saja':'Pengeluaran untuk apa saja')+'</h3><p>Total <strong>'+fmt(total)+'</strong></p>'+(entries.length?entries.map(r=>'<div class="category-chart-row"><div class="category-chart-label"><strong>'+esc(r.category)+'</strong><span>'+fmt(r.amount)+'</span></div><div class="category-chart-track" aria-hidden="true"><span class="'+kind+'" style="width:'+(r.share*100)+'%"></span></div><small>'+r.count+' transaksi · '+new Intl.NumberFormat('id-ID',{style:'percent',maximumFractionDigits:1}).format(r.share)+'</small></div>').join(''):'<p class="muted">Belum ada transaksi.</p>')+'</article>';
    }).join('')+'</div>';
  }
  return {categories,closing,breakdown,forecast,entireTable};
});
