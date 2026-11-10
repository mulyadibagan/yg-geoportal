(function(root){
'use strict';
let current=null,version=0,serial=0,loadedGroup='',config=null;
const $=id=>document.getElementById(id);
function reset(){++serial;current=null;version=0;loadedGroup='';config=null;$('source-review-content').replaceChildren();$('source-review-notice').hidden=true;$('source-review-import').hidden=true;$('source-review-json').value='';$('source-review-status').textContent='';}
async function load(options){
 config=options;if(loadedGroup===options.group)return;
 const seq=++serial;current=null;$('source-review-content').textContent='Memuat laporan sumber…';$('source-review-notice').hidden=true;$('source-review-import').hidden=!options.admin;
 try{const result=await options.api('/source-review?'+new URLSearchParams({group:options.group}));if(seq!==serial)return;current=result.review;version=result.version;loadedGroup=options.group;render();}
 catch(e){if(seq===serial){$('source-review-content').textContent='Laporan sumber belum tersedia: '+e.message;loadedGroup='';}}
}
function render(){
 const {fmt,esc}=config;
 if(!current){$('source-review-content').innerHTML='<p>Belum ada laporan sumber yang disimpan untuk kelompok ini.</p>';return;}
 const selected=$('source-review-month')?.value||'all';
 $('source-review-notice').hidden=false;
 $('source-review-content').innerHTML='<p class="badge">Sementara · belum terverifikasi</p><h2>'+esc(current.title)+'</h2><p>Ditinjau '+esc(current.reviewed_at)+'. Angka di bawah mengikuti buku kas sumber. Saldo belum dicocokkan dengan rekening dan kas fisik. Catatan yang belum cocok tidak menambah transaksi atau mengubah saldo aplikasi.</p><div class="filters"><label>Periode sumber<select id="source-review-month"><option value="all">Januari–September 2026</option>'+current.months.map(m=>'<option value="'+esc(m.month)+'">'+esc(m.month)+'</option>').join('')+'</select></label><button id="source-review-export">Unduh CSV laporan sumber</button></div><div id="source-review-monthly"></div><div id="source-review-notes"></div><details><summary id="source-review-row-count">Transaksi buku kas sumber</summary><div id="source-review-rows"></div></details>';
 const select=$('source-review-month');select.value=current.months.some(m=>m.month===selected)?selected:'all';select.addEventListener('change',renderPeriod);$('source-review-export').addEventListener('click',download);renderPeriod();
}
function renderPeriod(){
 const {fmt,esc}=config,period=$('source-review-month').value;
 const months=current.months.filter(m=>period==='all'||m.month===period),rows=current.rows.filter(r=>period==='all'||r[1]===period),notes=current.notes.filter(n=>period==='all'||!n[1]||n[1]===period);
 $('source-review-monthly').innerHTML='<div class="table-wrap"><table><thead><tr><th>Bulan</th><th>Saldo awal sumber</th><th>Pemasukan</th><th>Pengeluaran</th><th>Saldo akhir sumber</th><th>Sumber</th></tr></thead><tbody>'+months.map(m=>'<tr><td>'+esc(m.month)+'</td>'+[m.opening,m.income,m.expense,m.closing].map(n=>'<td class="number">'+fmt(n)+'</td>').join('')+'<td><a target="_blank" rel="noopener noreferrer" href="'+esc(m.source)+'">Buku kas</a></td></tr>').join('')+'</tbody><tfoot><tr><th>Total arus tercatat</th><td></td><td class="number">'+fmt(months.reduce((n,m)=>n+m.income,0))+'</td><td class="number">'+fmt(months.reduce((n,m)=>n+m.expense,0))+'</td><td colspan="2">Belum terverifikasi</td></tr></tfoot></table></div>';
 $('source-review-notes').innerHTML='<h3>Catatan rekonsiliasi · '+notes.length+'</h3><p>Pinjaman/piutang, talangan, upah tanam dan selisih versi yang belum jelas tetap menjadi catatan pemeriksaan. Nilai-nilai ini belum menjadi tagihan atau pembayaran baru di aplikasi.</p>'+notes.map(n=>'<details><summary>'+esc(n[2])+'</summary><p><strong>Referensi:</strong> '+esc(n[3])+'</p><p><strong>Perlu ditelusuri:</strong> '+esc(n[4])+'</p><small>'+esc(n[0])+'</small></details>').join('');
 $('source-review-row-count').textContent=rows.length+' transaksi buku kas sumber · belum terverifikasi';
 $('source-review-rows').innerHTML='<div class="table-wrap"><table><thead><tr><th>ID sumber</th><th>Tanggal sumber</th><th>Uraian</th><th>Jenis</th><th>Nominal</th><th>Keterangan sumber</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r[0])+'</td><td>'+esc(r[2]||'Tanggal belum jelas')+'</td><td>'+esc(r[3])+'</td><td>'+esc(r[4]==='income'?'Pemasukan':'Pengeluaran')+'</td><td class="number">'+fmt(r[5])+'</td><td>'+esc(r[6])+'</td></tr>').join('')+'</tbody></table></div>';
 const pending=(current.pending||[]).filter(r=>period==='all'||r[1]===period);
 let box=$('source-review-pending');if(!box){box=document.createElement('details');box.id='source-review-pending';$('source-review-rows').parentElement.after(box);}
 box.innerHTML='<summary>'+pending.length+' baris rincian pengeluaran · menunggu rekonsiliasi</summary><p>Daftar sumber tambahan, termasuk pengulangan dan kandidat transaksi yang sama. Jangan dijumlahkan lagi dengan buku kas. Baris tanpa bulan analisis berada di luar periode Januari–September.</p><div class="table-wrap"><table><thead><tr><th>ID</th><th>Periode / tanggal sumber</th><th>Uraian</th><th>Nominal sumber</th><th>Keterangan dana</th><th>Status</th></tr></thead><tbody>'+pending.map(r=>'<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1]||'Luar periode')+' / '+esc(r[2]||'Tanggal kosong')+'</td><td>'+esc(r[3])+'</td><td class="number">'+fmt(r[4])+'</td><td>'+esc(r[5])+'</td><td>'+esc(r[8])+(r[7]?' · '+esc(r[7]):'')+'</td></tr>').join('')+'</tbody></table></div>';
}
function download(){
 const period=$('source-review-month').value,cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
 const rows=[['LAPORAN SUMBER SEMENTARA - BELUM TERVERIFIKASI'],[current.title],['Tidak mengubah saldo atau transaksi aplikasi.'],[],['Bulan','Saldo awal sumber','Pemasukan','Pengeluaran','Saldo akhir sumber','Sumber']];
 for(const m of current.months.filter(m=>period==='all'||m.month===period))rows.push([m.month,m.opening,m.income,m.expense,m.closing,m.source]);
 rows.push([],['ID sumber','Bulan','Tanggal sumber','Uraian','Jenis','Nominal','Keterangan','Referensi']);
 rows.push(...current.rows.filter(r=>period==='all'||r[1]===period));rows.push([],['CATATAN REKONSILIASI'],['ID','Bulan','Temuan','Sumber','Tindak lanjut']);rows.push(...current.notes.filter(n=>period==='all'||!n[1]||n[1]===period));
 rows.push([],['RINCIAN TAMBAHAN - TIDAK MENAMBAH SALDO'],['ID','Bulan','Tanggal','Uraian','Nominal','Keterangan dana','Referensi','Kandidat BKU','Status']);rows.push(...(current.pending||[]).filter(r=>period==='all'||r[1]===period));
 const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='kups-laporan-sumber-sementara-'+period+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
document.getElementById('source-review-save').addEventListener('click',async()=>{
 if(!config?.admin)return;const button=$('source-review-save');button.disabled=true;
 try{const review=JSON.parse($('source-review-json').value),body={version,review};if(new TextEncoder().encode(JSON.stringify(body)).length>200000)throw Error('Laporan sumber maksimal 200 KB.');const result=await config.api('/source-review?'+new URLSearchParams({group:config.group}),{method:'POST',json:body});loadedGroup='';await load(config);$('source-review-json').value='';$('source-review-status').textContent=result.rows+' transaksi sumber disimpan privat dengan status belum terverifikasi. Saldo aplikasi tetap.';}
 catch(e){$('source-review-status').textContent=e.message;}
 finally{button.disabled=false;}
});
root.YG_KUPS_SOURCE_REVIEW={load,reset};
})(window);
