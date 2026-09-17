(()=>{
'use strict';

const exact = new Map([
  ['Tools publik · tanpa login','Siap digunakan'],
  ['Menunggu processor','Menunggu diproses'],
  ['Warning','Perlu diperiksa'],
  ['Excluded','Tidak digunakan'],
  ['Valid','Siap'],
  ['QC','Pemeriksaan'],
  ['Generate Mission','Buat Jalur Misi'],
  ['Reset','Bersihkan'],
  ['Preview area & jalur','Pratinjau area & jalur'],
  ['Membaca Cloud Optimized GeoTIFF…','Menampilkan orthomosaic…'],
  ['Upload selesai. Menambahkan ke antrean orthomosaic…','Upload selesai. Menyiapkan pemrosesan orthomosaic…'],
  ['Dataset masuk antrean pemrosesan. Status akan diperbarui otomatis.','Foto telah diterima. Status pemrosesan akan diperbarui otomatis.']
]);

const phrases = [
  ['server akan memeriksa ulang.','akan diperiksa kembali saat pemrosesan.'],
  ['Siap untuk QC fotogrametri','Siap untuk diproses'],
  ['COG dibaca per bagian sesuai tampilan peta.','Peta menampilkan hasil sesuai area yang sedang dilihat.'],
  ['Orthomosaic tersedia, tetapi viewer belum dapat membacanya:','Orthomosaic tersedia, tetapi peta belum dapat menampilkannya:'],
  ['Riwayat job yang pernah dibuat dari browser ini.','Riwayat pemrosesan yang tersimpan pada perangkat ini.'],
  ['Cloud Optimized GeoTIFF','hasil orthomosaic'],
  ['processor','proses'],
  ['job','proses']
];

function cleanText(text){
  let out = exact.get(text) || text;
  for(const [from,to] of phrases) out = out.split(from).join(to);
  return out;
}

function normalizeNode(root=document.body){
  if(!root) return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode()) nodes.push(walker.currentNode);
  for(const node of nodes){
    const before=node.nodeValue;
    const after=cleanText(before);
    if(after!==before) node.nodeValue=after;
  }
  const auth=document.getElementById('authStatus');
  if(auth && auth.textContent!=='Siap digunakan') auth.textContent='Siap digunakan';
}

const errorCopy={
  queue_full:'Kapasitas pemrosesan sedang penuh. Silakan coba lagi beberapa saat lagi.',
  invalid_drive_folder_url:'Link folder Google Drive tidak valid.',
  jpeg_only:'Gunakan foto berformat JPG atau JPEG.',
  content_length_required:'Ukuran file tidak dapat dibaca. Pilih ulang foto dan coba lagi.',
  file_too_large:'Ukuran salah satu foto melebihi batas yang diizinkan.',
  too_many_files:'Jumlah foto melebihi batas pemrosesan.',
  dataset_too_large:'Total ukuran foto melebihi batas pemrosesan.',
  minimum_three_photos:'Pilih minimal tiga foto untuk membuat orthomosaic.',
  unauthorized:'Akses hasil pemrosesan ini tidak tersedia pada perangkat ini.',
  job_not_found:'Riwayat pemrosesan tidak ditemukan.',
  orthomosaic_not_ready:'Orthomosaic masih diproses.',
  origin_not_allowed:'Permintaan hanya dapat dilakukan melalui YG GeoPortal.'
};

const nativeAlert=window.alert.bind(window);
window.alert=(message)=>{
  let text=String(message??'');
  for(const [code,copy] of Object.entries(errorCopy)) text=text.split(code).join(copy);
  text=cleanText(text);
  nativeAlert(text);
};

normalizeNode();
new MutationObserver(records=>{
  for(const record of records){
    if(record.type==='characterData' && record.target?.parentNode) normalizeNode(record.target.parentNode);
    for(const node of record.addedNodes||[]) if(node.nodeType===1||node.nodeType===3) normalizeNode(node.nodeType===3?node.parentNode:node);
  }
}).observe(document.body,{subtree:true,childList:true,characterData:true});
})();
