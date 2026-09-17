(function(){
  'use strict';
  var form=document.getElementById('rambutan-calculator');
  if(!form)return;
  var gawangan=document.getElementById('ram-gawangan'),phase=document.getElementById('ram-phase'),ageNote=document.getElementById('ram-age-note'),trees=document.getElementById('ram-tree-count'),material=document.getElementById('ram-material'),dose=document.getElementById('ram-dose'),unit=document.getElementById('ram-unit'),reserve=document.getElementById('ram-reserve'),pack=document.getElementById('ram-package'),error=document.getElementById('ram-error'),result=document.getElementById('ram-result'),records=[];

  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function idNumber(value,digits){return Number(value).toLocaleString('id-ID',{minimumFractionDigits:0,maximumFractionDigits:digits==null?2:digits});}
  function parsePlanting(value){
    if(!value)return null;
    var text=String(value).trim(),months={jan:0,feb:1,mar:2,apr:3,mei:4,jun:5,jul:6,agu:7,sep:8,okt:9,nov:10,des:11};
    if(/^\d{4}-\d{2}-\d{2}$/.test(text))return new Date(text+'T00:00:00');
    var match=text.toLowerCase().match(/(?:(\d{1,2})\s+)?([a-z]{3,})\s+(\d{4})/);
    if(!match)return null;
    var key=match[2].slice(0,3),month=months[key];
    if(month==null)return null;
    return new Date(Number(match[3]),month,Number(match[1]||1));
  }
  function ageMonths(value,fallback){
    var start=parsePlanting(value);
    if(!start)return Number.isFinite(Number(fallback))?Math.max(0,Math.round(Number(fallback))):null;
    var now=new Date(),months=(now.getFullYear()-start.getFullYear())*12+(now.getMonth()-start.getMonth());
    if(now.getDate()<start.getDate())months--;
    return Math.max(0,months);
  }
  function phaseFor(months){
    if(months==null)return{label:'Umur belum tersedia',note:'Periksa periode tanam dan kondisi pohon sebelum menentukan fase.'};
    if(months<12)return{label:'Pembentukan awal',note:'Fokus pohon hidup, ajir, air, piringan, mulsa, dan pertumbuhan batang.'};
    if(months<36)return{label:'Pembentukan tajuk',note:'Evaluasi 2–3 kali per tahun; bentuk cabang utama dan jaga ruang cahaya.'};
    return{label:'Transisi produktif / produktif',note:'Periksa riwayat bunga/panen, tajuk, pH, air, dan pemulihan setelah panen.'};
  }
  function selected(){return records.find(function(item){return item.objectId===gawangan.value;})||null;}
  function updateSelection(){
    var row=selected();
    if(!row){phase.value='—';ageNote.textContent='Pilih gawangan rambutan.';trees.value='';return;}
    var months=ageMonths(row.crop.plantingDate||row.crop.plantingPeriod,row.crop.ageMonths),stage=phaseFor(months),count=Math.max(0,Math.round(Number(row.crop.vegetationCount)||0));
    phase.value=stage.label;
    ageNote.textContent=(months==null?'Umur belum tersedia':idNumber(months,0)+' bulan')+' · '+stage.note;
    trees.value=count||'';
    result.hidden=true;error.hidden=true;
  }
  function setError(message){error.textContent=message;error.hidden=false;result.hidden=true;}
  function formatKg(value){return idNumber(value,value<10?2:1)+' kg';}
  function init(data){
    records=[];
    (data.objects||[]).forEach(function(object){
      (object.crops||[]).forEach(function(crop){
        if(String(crop.crop||'').toUpperCase()==='RAMBUTAN')records.push({objectId:object.objectId,block:object.block,gawangan:object.gawangan,crop:crop});
      });
    });
    records.sort(function(a,b){return a.objectId.localeCompare(b.objectId,'id',{numeric:true});});
    if(!records.length)throw Error('Data rambutan tidak ditemukan.');
    gawangan.innerHTML=records.map(function(row){return '<option value="'+esc(row.objectId)+'">'+esc(row.objectId.replace('DAYUN-GT-',''))+' · '+Math.round(Number(row.crop.vegetationCount)||0).toLocaleString('id-ID')+' pohon</option>';}).join('');
    var query=new URLSearchParams(location.search).get('object');
    if(query&&records.some(function(row){return row.objectId===query;}))gawangan.value=query;
    gawangan.disabled=false;updateSelection();
  }
  gawangan.addEventListener('change',updateSelection);
  form.addEventListener('submit',function(event){
    event.preventDefault();error.hidden=true;
    var row=selected(),treeCount=Math.round(Number(trees.value)),doseValue=Number(dose.value),reserveValue=Number(reserve.value),packValue=Number(pack.value);
    if(!row)return setError('Pilih gawangan rambutan.');
    if(!Number.isFinite(treeCount)||treeCount<1)return setError('Jumlah pohon sasaran harus bilangan bulat minimal 1.');
    if(!Number.isFinite(doseValue)||doseValue<=0)return setError('Masukkan dosis kerja per pohon yang telah disahkan.');
    if(!Number.isFinite(reserveValue)||reserveValue<0||reserveValue>25)return setError('Cadangan operasional harus 0–25%.');
    if(!Number.isFinite(packValue)||packValue<=0)return setError('Berat kemasan harus lebih dari 0 kg.');
    trees.value=treeCount;
    var doseKg=unit.value==='kg'?doseValue:doseValue/1000,base=treeCount*doseKg,total=base*(1+reserveValue/100),packages=Math.ceil(total/packValue),months=ageMonths(row.crop.plantingDate||row.crop.plantingPeriod,row.crop.ageMonths),stage=phaseFor(months),planting=row.crop.plantingDate||row.crop.plantingPeriod||'periode belum tersedia';
    document.getElementById('ram-result-title').textContent=material.value+' · '+row.objectId.replace('DAYUN-GT-','');
    document.getElementById('ram-result-context').textContent=stage.label+' · tanam '+planting;
    document.getElementById('ram-result-trees').textContent=treeCount.toLocaleString('id-ID')+' pohon';
    document.getElementById('ram-result-dose').textContent=idNumber(doseValue,2)+' '+unit.value+'/pohon';
    document.getElementById('ram-result-base').textContent=formatKg(base);
    document.getElementById('ram-result-total').textContent=formatKg(total);
    document.getElementById('ram-result-packages').textContent=packages.toLocaleString('id-ID')+' kemasan';
    document.getElementById('ram-result-formula').textContent=treeCount.toLocaleString('id-ID')+' pohon × '+idNumber(doseValue,2)+' '+unit.value+'/pohon'+(reserveValue?' + '+idNumber(reserveValue,1)+'% cadangan':'')+' = '+formatKg(total)+'. Kemasan dibulatkan ke atas; sisa bahan wajib dicatat.';
    result.hidden=false;
    result.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
  form.addEventListener('reset',function(){setTimeout(function(){dose.value='';reserve.value='0';pack.value='50';material.value='Pupuk organik';unit.value='g';updateSelection();},0);});
  window.DayunDataSource.fetchJSON('data/dayun-gawangan-details.json?v=20260917-all-profile1').then(init).catch(function(err){console.error(err);gawangan.innerHTML='<option value="">Data rambutan belum dapat dimuat</option>';setError('Data gawangan rambutan belum dapat dimuat. Silakan coba lagi.');});
})();
