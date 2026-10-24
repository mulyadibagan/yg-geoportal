(function(root){
 'use strict';
 const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 function validate(data){
  if(data?.schema!=='dayun-live-work-counts-v1'||data.live!==true||!Array.isArray(data.rows)||data.rows.length!==40||new Set(data.rows.map(r=>r.zone)).size!==40||!Number.isFinite(Date.parse(data.checkedAt)))throw Error('Rekap terbaru belum lengkap. Coba lagi.');
  for(const r of data.rows){if(!/^GT-[ABC]-\d{2}$/.test(r.zone)||r.block!==r.zone.split('-')[1]||['plants','fruits','newPlants','allocated'].some(k=>!Number.isSafeInteger(r[k])||r[k]<0)||r.newPlants>r.plants||r.allocated>r.plants)throw Error('Angka rekap belum valid. Coba lagi.');}
 }
 function stamp(value){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(value));}
 function workbook(ExcelJS,data){
  validate(data);const w=new ExcelJS.Workbook();w.creator='YG GeoPortal';w.created=new Date(data.checkedAt);w.calcProperties.fullCalcOnLoad=true;
  const s=w.addWorksheet('Rekap nanas dan buah',{views:[{state:'frozen',xSplit:2,ySplit:5,showGridLines:false}]});
  s.columns=[{width:9},{width:19},{width:20},{width:17},{width:21},{width:22},{width:31},{width:29}];
  const line=(n,text)=>{s.mergeCells(n,1,n,8);s.getCell(n,1).value=text;};
  line(1,'Rekap nanas dan buah per gawangan A–C');s.getRow(1).font={name:'Arial',size:16,bold:true};s.getRow(1).height=28;
  line(2,'Data tersimpan diperiksa '+stamp(data.checkedAt)+' WIB. Diambil langsung saat tombol unduh diklik.');
  line(3,'Titik di luar batas masuk GT terdekat. Nanas baru merupakan bagian dari jumlah nanas.');
  s.getRow(5).values=['Blok','Gawangan','Jumlah nanas','Buah tim','Nanas baru','Dari luar batas GT','Bulan tanam lama','Bulan tanam baru'];
  const rows=[...data.rows].sort((a,b)=>a.zone.localeCompare(b.zone));
  for(const r of rows)s.addRow([r.block,r.zone,r.plants,r.fruits,r.newPlants,r.allocated,r.plantingMonth||'Belum tercatat',r.newPlantingMonth||'—']);
  const end=5+rows.length,n=end+1,total=s.getRow(n);total.getCell(2).value='TOTAL';for(const [c,key]of [[3,'plants'],[4,'fruits'],[5,'newPlants'],[6,'allocated']])total.getCell(c).value={formula:`SUM(${String.fromCharCode(64+c)}6:${String.fromCharCode(64+c)}${end})`,result:rows.reduce((sum,r)=>sum+r[key],0)};
  s.autoFilter={from:'A5',to:'H'+end};
  s.eachRow(row=>{row.height=row.height||23;row.eachCell(cell=>{cell.font={name:'Arial',size:11,...cell.font};cell.alignment={vertical:'middle',horizontal:typeof cell.value==='number'?'right':'left'};if(cell.col>=3&&cell.col<=6&&cell.row>=6){cell.numFmt='#,##0';cell.alignment.horizontal='right';}});});
  for(const row of [s.getRow(5),total]){row.height=30;row.eachCell(cell=>{cell.font={name:'Arial',size:11,bold:true,color:{argb:row.number===5?'FFFFFFFF':'FF163C2F'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:row.number===5?'FF244A64':'FFE7EEF3'}};});}
  line(n+2,'Buah terhubung mengikuti tanaman induk; buah lain mengikuti posisi penandanya. Setiap titik dihitung sekali.');
  line(n+3,'Revisi sumber: '+Object.entries(data.revisions||{}).map(([b,r])=>`${b}: titik ${r.plants}, buah ${r.fruits}`).join(' · '));
  line(n+4,'Sumber: https://webgisyg.id — rekap otomatis titik kerja, bukan penggantian sensus lapangan.');
  line(n+5,'Posisi tambahan penyesuaian sensus merupakan perkiraan. Bulan tanam mengikuti data tanaman tercatat.');
  return w;
 }
 let library;
 function load(){if(root.ExcelJS)return Promise.resolve(root.ExcelJS);if(library)return library;library=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='assets/vendor/exceljs/exceljs-4.4.0.min.js';script.onload=()=>root.ExcelJS?resolve(root.ExcelJS):reject(Error('Pustaka Excel tidak tersedia'));script.onerror=()=>{script.remove();library=null;reject(Error('Pustaka Excel gagal dimuat. Coba lagi.'));};document.head.append(script);});return library;}
 async function download(data){validate(data);const ExcelJS=await load(),buffer=await workbook(ExcelJS,data).xlsx.writeBuffer(),blob=new Blob([buffer],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Rekap_Nanas_Buah_ABC_'+stamp(data.checkedAt).replace(/[ :]/g,'-')+'.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 const api={validate,workbook,download,mime};if(typeof module==='object'&&module.exports)module.exports=api;root.YG_DAYUN_WORK_EXCEL=api;
})(typeof window!=='undefined'?window:globalThis);
