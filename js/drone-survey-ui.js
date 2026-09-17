(()=>{
'use strict';

const TEXT_REPLACEMENTS = [
  ['Tools publik · tanpa login','Siap digunakan'],
  ['Menunggu processor','Menunggu diproses'],
  ['Menunggu processor','Menunggu diproses'],
  ['Dataset masuk antrean pemrosesan. Status akan diperbarui otomatis.','Foto telah diterima dan akan diproses. Status diperbarui otomatis.'],
  ['Upload selesai. Menambahkan ke antrean orthomosaic…','Foto selesai diunggah. Menyiapkan proses orthomosaic…'],
  ['Membaca Cloud Optimized GeoTIFF…','Menampilkan hasil orthomosaic…'],
  ['COG dibaca per bagian sesuai tampilan peta.','Peta memuat hasil sesuai area yang sedang dilihat.'],
  ['Orthomosaic tersedia, tetapi viewer belum dapat membacanya:','Hasil orthomosaic tersedia, tetapi belum dapat ditampilkan:'],
  ['Gimbal pitch tidak ditemukan; server akan memeriksa ulang.','Sudut kamera belum terbaca dan akan diperiksa kembali.'],
  ['Siap untuk QC fotogrametri','Siap diperiksa'],
  ['Warning','Perlu diperiksa'],
  ['Excluded','Tidak digunakan'],
  ['Valid','Sesuai'],
  ['QC','Pemeriksaan']
];

function cleanText(value){
  let text=String(value||'');
  for(const [from,to] of TEXT_REPLACEMENTS) text=text.split(from).join(to);
  return text;
}

function cleanVisibleCopy(root=document){
  const status=root.querySelector?.('#authStatus');
  if(status) status.textContent='Siap digunakan';

  root.querySelectorAll?.('*').forEach(el=>{
    if(el.children.length===0 && el.textContent){
      const next=cleanText(el.textContent);
      if(next!==el.textContent) el.textContent=next;
    }
  });
}

cleanVisibleCopy();

let scheduled=false;
const observer=new MutationObserver(()=>{
  if(scheduled) return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    cleanVisibleCopy();
  });
});
observer.observe(document.body,{childList:true,subtree:true,characterData:true});
})();
