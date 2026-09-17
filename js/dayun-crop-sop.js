(function(){
  'use strict';
  var configs={
    'asam-kandis':{
      code:'ASAM KANDIS',title:'Asam kandis',category:'MPTS',unit:'pohon',
      intro:'Panduan operasional asam kandis sebagai pohon buah dan MPTS pada gawangan agroforestri Dayun. Fokusnya adalah pohon hidup, pembentukan tajuk, kesehatan batang, pembungaan, dan mutu buah.',
      safety:'Jaga ruang tumbuh dan tata air gambut. Asam kandis adalah pohon jangka panjang; hindari luka akar, pemangkasan berat, dan aplikasi bahan tanpa diagnosis.',
      material:'Gunakan bibit sehat dengan asal yang dapat ditelusuri; catat sumber dan keseragaman bahan tanam.',
      planting:'Tetapkan titik pohon sesuai rencana gawangan dan ruang tajuk dewasa; verifikasi jarak terdata terhadap posisi lapangan.',
      canopy:'Bentuk batang dan cabang utama yang seimbang; lakukan sanitasi cabang mati, patah, saling bergesekan, atau bergejala secara bertahap.',
      hpt:'Amati daun, pucuk, kulit batang, bunga, dan buah; tandai getah/luka tidak normal, mati pucuk, bercak, busuk, serta kerusakan serangga.',
      harvest:'Catat awal bunga dan buah per pohon. Panen berdasarkan kematangan dan tujuan pengolahan; hindari merusak ranting produktif.',
      source:'https://repository.pertanian.go.id/',sourceCopy:'Panduan kerja asam kandis menggunakan prinsip budidaya pohon buah Kementerian Pertanian dan pengendalian spesifik kondisi Dayun; dosis ditetapkan dari pemeriksaan tapak.',
      phases:[
        ['0–12 bulan','Setelah tanam, lalu sekurangnya tiap 3 bulan','Pohon hidup, ajir, mulsa, piringan, air, dan batang awal','pH, kelembapan, vigor, warna daun, dan riwayat bahan'],
        ['13–36 bulan','Evaluasi 2–3 kali per tahun','Pembentukan batang/cabang utama, ruang cahaya, dan sanitasi','Umur, pertumbuhan, tajuk, tanah/daun bila tersedia'],
        ['Menjelang berbunga','Sebelum periode pembungaan setempat','Kesehatan tajuk, stres air, dan kesiapan cabang produktif','Riwayat bunga, cuaca, pH, dan kondisi daun'],
        ['Setelah panen','Segera setelah panen dan sanitasi','Pemulihan pohon dan rencana musim berikutnya','Hasil per pohon, kondisi tajuk, pH, dan riwayat aplikasi']
      ]
    },
    'nangka':{
      code:'NANGKA',title:'Nangka',category:'MPTS',unit:'pohon',
      intro:'Panduan operasional nangka pada gawangan agroforestri Dayun, meliputi pembentukan tajuk, pengaturan buah, sanitasi, panen aman, dan pencatatan hasil per pohon.',
      safety:'Jaga ruang tajuk dan jalur kerja. Buah yang membesar perlu diperiksa penyangganya; pemangkasan dan panen tidak boleh membahayakan pekerja atau merusak komoditas bawah.',
      material:'Gunakan bibit sehat, seragam, dan jelas asal/varietasnya; periksa sambungan bila memakai bibit vegetatif.',
      planting:'Tempatkan pohon sesuai rencana blok dan ruang tajuk dewasa; leher akar tidak ditimbun dan mulsa tidak menyentuh batang.',
      canopy:'Bentuk tajuk yang mudah dipantau dan dipanen. Buang cabang sakit, patah, bersilang, atau terlalu rendah secara bertahap dengan alat bersih.',
      hpt:'Amati penggerek batang, luka/getah, lalat atau penggerek buah, busuk buah, bercak daun, dan mati pucuk. Buah rusak dipisahkan dan kebun disanitasi.',
      harvest:'Nilai kematangan dari perubahan warna, aroma, bunyi/tekstur yang sesuai varietas, dan tujuan pasar. Gunakan alat bersih, penyangga buah, dan hindari benturan.',
      source:'https://repository.pertanian.go.id/',sourceCopy:'Panduan kerja nangka menggunakan prinsip budidaya tanaman buah Kementerian Pertanian dan disesuaikan dengan sistem agroforestri Dayun.',
      phases:[
        ['0–12 bulan','Setelah tanam dan tiap 3 bulan','Pohon hidup, ajir, piringan, air, dan batang awal','pH, kelembapan, vigor, dan riwayat bahan'],
        ['13–36 bulan','Evaluasi 2–3 kali per tahun','Pembentukan tajuk dan cabang utama','Umur, pertumbuhan, kesehatan batang, tanah/daun'],
        ['Berbunga–berbuah','Pemeriksaan rutin saat bunga dan buah berkembang','Bunga, bakal buah, beban cabang, sanitasi, dan perlindungan buah','Jumlah buah/pohon, kondisi tajuk, cuaca, dan gangguan'],
        ['Setelah panen','Segera setelah panen','Sanitasi, pemangkasan ringan, dan pemulihan','Hasil/mutu buah, luka panen, pH, dan respons pohon']
      ]
    },
    'petai':{
      code:'PETAI',title:'Petai',category:'MPTS',unit:'pohon',
      intro:'Panduan operasional petai pada gawangan Dayun dengan perhatian pada pembentukan batang kuat, tinggi tajuk yang aman, kesehatan cabang, pembungaan, polong, dan panen.',
      safety:'Petai dapat membentuk tajuk tinggi. Pengaturan cabang dan rencana panen harus dilakukan sejak muda; pekerjaan di ketinggian memerlukan alat dan prosedur keselamatan.',
      material:'Gunakan bibit sehat dan asal bahan tanam yang tercatat; tandai varietas atau sumber untuk evaluasi produksi.',
      planting:'Posisi pohon mengikuti ruang tajuk dewasa dan jalur kerja; hindari titik yang mengganggu akses atau terlalu rapat dengan pohon MPTS lain.',
      canopy:'Bentuk batang/cabang utama sejak muda untuk membatasi risiko tajuk terlalu tinggi, cabang sempit, patah, dan sulit dipanen. Pangkas bertahap.',
      hpt:'Periksa batang dan cabang dari lubang/serbuk penggerek, luka, jamur, mati pucuk, kerusakan bunga, serta polong berlubang atau membusuk.',
      harvest:'Catat bunga dan polong per pohon. Panen polong sesuai kematangan pasar menggunakan alat yang tidak merusak cabang produktif.',
      source:'https://repository.pertanian.go.id/',sourceCopy:'Panduan kerja petai menggunakan prinsip budidaya pohon MPTS/tanaman buah dan keselamatan panen; keputusan bahan tetap spesifik kondisi Dayun.',
      phases:[
        ['0–12 bulan','Setelah tanam dan tiap 3 bulan','Pohon hidup, ajir, piringan, air, dan batang awal','pH, kelembapan, vigor, dan riwayat bahan'],
        ['13–36 bulan','Evaluasi 2–3 kali per tahun','Batang kuat, cabang utama, tinggi tajuk, dan ruang cahaya','Umur, tinggi, diameter, tajuk, dan kesehatan batang'],
        ['Transisi produktif','Sebelum dan selama pembungaan','Tajuk produktif, bunga, stres air, dan gangguan','Riwayat bunga, cuaca, pH, daun, dan pertumbuhan'],
        ['Panen–pemulihan','Saat polong berkembang dan setelah panen','Mutu polong, keselamatan panen, sanitasi, dan pemulihan','Hasil/pohon, cabang rusak, dan respons aplikasi']
      ]
    },
    'jengkol':{
      code:'JENGKOL',title:'Jengkol',category:'MPTS',unit:'pohon',
      intro:'Panduan operasional jengkol pada gawangan agroforestri Dayun, dari pembentukan pohon hingga pengamatan bunga, buah, panen, dan pemulihan.',
      safety:'Atur tinggi dan keseimbangan tajuk sejak muda. Hindari pemangkasan berat, kerusakan akar, dan panen yang mematahkan cabang produktif.',
      material:'Gunakan bibit sehat dengan asal tercatat; periksa batang, perakaran, dan sambungan bila bibit diperbanyak secara vegetatif.',
      planting:'Titik tanam mempertimbangkan ruang tajuk dewasa, jalur kerja, cahaya komoditas bawah, dan tata air gawangan.',
      canopy:'Pilih batang/cabang utama sehat dan seimbang. Buang tunas liar, cabang patah, saling bergesekan, atau bergejala secara bertahap.',
      hpt:'Amati lubang/serbuk pada batang, luka, mati pucuk, bercak daun, kerusakan bunga, buah berlubang, dan busuk; tandai pohon untuk pemeriksaan ulang.',
      harvest:'Catat bunga dan buah per pohon. Panen sesuai kematangan tujuan pasar dengan alat bersih dan cara yang melindungi cabang produktif.',
      source:'https://repository.pertanian.go.id/',sourceCopy:'Panduan kerja jengkol menggunakan prinsip budidaya pohon MPTS/tanaman buah dan disesuaikan dengan kondisi agroforestri Dayun.',
      phases:[
        ['0–12 bulan','Setelah tanam dan tiap 3 bulan','Pohon hidup, ajir, mulsa, piringan, dan air','pH, kelembapan, vigor, dan riwayat bahan'],
        ['13–36 bulan','Evaluasi 2–3 kali per tahun','Pembentukan batang dan tajuk, ruang cahaya, sanitasi','Umur, tinggi/diameter, tajuk, tanah/daun'],
        ['Transisi produktif','Sebelum dan selama pembungaan','Kesehatan tajuk, bunga, buah muda, dan stres air','Riwayat bunga, cuaca, pH, dan kondisi daun'],
        ['Panen–pemulihan','Saat buah berkembang dan setelah panen','Mutu hasil, sanitasi, tajuk, dan pemulihan','Hasil/pohon, gangguan, dan respons aplikasi']
      ]
    },
    'terong':{
      code:'TERONG',title:'Terong',category:'Hortikultura',unit:'tanaman',
      intro:'Panduan operasional terong pada gawangan hortikultura Dayun, mulai dari benih/persemaian, bedengan, pindah tanam, pemeliharaan, perlindungan tanaman, hingga panen berulang.',
      safety:'Terong memerlukan zona akar yang tidak tergenang. Bedengan dan saluran dangkal diarahkan untuk menjaga media, bukan mengeringkan gambut atau merusak tata air kawasan.',
      material:'Gunakan benih bermutu dan bibit sehat, seragam, tidak etiolasi, bebas gejala virus, layu, atau kerusakan akar.',
      planting:'Siapkan bedengan dengan drainase permukaan yang terkendali. Pindah tanam saat bibit sehat dan media lembap; ganti tanaman mati setelah penyebabnya diperiksa.',
      canopy:'Pasang ajir bila diperlukan dan ikat longgar. Penjarangan tunas/daun mengikuti varietas dan kondisi; jangan membuka tajuk berlebihan.',
      hpt:'Amati kutu-kutuan, tungau, ulat, kumbang, layu, bercak, virus, serta busuk buah. Sanitasi buah dan tanaman sakit, gunakan perangkap/pengendalian berdasarkan hasil pengamatan.',
      harvest:'Panen buah pada ukuran, warna, kilap, dan kekerasan yang sesuai varietas serta pasar. Potong tangkai dengan alat bersih dan hindari luka buah.',
      source:'https://repository.pertanian.go.id/bitstreams/4bd76941-1f35-4212-bd92-7e237ec858d7/download',sourceCopy:'Tahapan dirangkum dari bahan budidaya terong pada repositori Kementerian Pertanian dan disesuaikan untuk pencatatan serta tata air Dayun.',
      phases:[
        ['Persemaian','Setiap hari sampai bibit siap pindah','Kecambah, media, air, cahaya, dan bibit sehat','Daya tumbuh, keseragaman, akar, dan gejala gangguan'],
        ['Awal tanam','Hari tanam sampai tanaman mapan','Tanaman hidup, air, ajir, sulam, dan gulma','Populasi hidup, cuaca, kelembapan, dan kondisi akar'],
        ['Vegetatif–berbunga','Pemeriksaan sekurangnya mingguan','Tajuk, bunga, air, nutrisi, dan OPT','Pertumbuhan, warna daun, bunga, pH, dan riwayat aplikasi'],
        ['Berbuah–panen','Pemeriksaan dan panen berkala','Mutu buah, sanitasi, hasil, dan kesehatan tanaman','Jumlah/berat panen, buah ditolak, dan gangguan']
      ]
    },
    'cabai':{
      code:'CABAI',title:'Cabai',category:'Hortikultura',unit:'tanaman',
      intro:'Panduan operasional cabai pada gawangan hortikultura Dayun, dengan persemaian sehat, pengelolaan air, ajir, nutrisi berbasis kondisi, PHT, panen, dan sanitasi.',
      safety:'Cabai peka terhadap genangan dan penyebaran penyakit. Atur bedengan/drainase permukaan tanpa mengeringkan gambut; tanaman bergejala berat ditandai dan ditangani agar tidak menjadi sumber penularan.',
      material:'Gunakan benih bermutu dan persemaian sehat. Singkirkan bibit kerdil, rusak, atau menunjukkan gejala virus, layu, dan penyakit pangkal.',
      planting:'Pindah tanam saat bibit sehat dan cuaca mendukung. Gunakan pola/jarak rencana blok, pasang ajir tanpa merusak akar, lalu catat sulaman.',
      canopy:'Ajir dan ikatan diperiksa rutin. Pemangkasan tunas mengikuti varietas/sistem budidaya dan dilakukan dengan alat/tangan bersih tanpa melukai batang.',
      hpt:'Pantau trips, kutu daun/kebul, tungau, ulat, lalat buah, virus, layu, bercak, dan antraknosa. Utamakan benih sehat, sanitasi, perangkap, pengamatan, dan pengendalian sesuai diagnosis.',
      harvest:'Panen berdasarkan warna dan kematangan tujuan pasar. Petik dengan tangkai secara hati-hati, teduhkan, sortir buah rusak, dan catat hasil setiap kali panen.',
      source:'https://hortikultura.pertanian.go.id/wp-content/uploads/2024/11/Standar-Operasional-Prosedur-Budidaya-Cabai-Rawit0001_watermark.pdf',sourceCopy:'Tahapan dirangkum dari SOP Budidaya Cabai Rawit Direktorat Jenderal Hortikultura, Kementerian Pertanian, dan disesuaikan untuk kondisi Dayun.',
      phases:[
        ['Persemaian','Setiap hari sampai bibit siap pindah','Kecambah, media, air, cahaya, dan bibit sehat','Daya tumbuh, keseragaman, akar, dan gejala virus/layu'],
        ['Awal tanam','Hari tanam sampai tanaman mapan','Tanaman hidup, air, ajir, sulam, dan gulma','Populasi hidup, cuaca, kelembapan, dan akar'],
        ['Vegetatif–berbunga','Pemeriksaan sekurangnya mingguan','Tajuk, bunga, air, nutrisi, dan OPT','Pertumbuhan, warna daun, bunga, pH, dan riwayat aplikasi'],
        ['Berbuah–panen','Pemeriksaan dan panen berkala','Mutu buah, sanitasi, hasil, dan kesehatan tanaman','Jumlah/berat panen, buah ditolak, dan serangan']
      ]
    }
  };

  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function number(value,digits){return Number(value).toLocaleString('id-ID',{maximumFractionDigits:digits==null?2:digits});}
  function parsePlanting(value){
    if(!value)return null;
    var text=String(value).trim().toLowerCase();
    if(/^\d{4}-\d{2}-\d{2}$/.test(text))return new Date(text+'T00:00:00');
    var months={jan:0,feb:1,mar:2,apr:3,mei:4,jun:5,jul:6,agu:7,ags:7,aug:7,sep:8,okt:9,oct:9,nov:10,des:11,dec:11};
    var match=text.match(/(?:(\d{1,2})\s+)?([a-z]+)\s+(\d{2,4})/);
    if(!match)return null;
    var key=match[2].slice(0,3),month=months[key],year=Number(match[3]);
    if(month==null)return null;if(year<100)year+=2000;
    return new Date(year,month,Number(match[1]||1));
  }
  function ageMonths(value,fallback){
    var start=parsePlanting(value);
    if(!start)return Number.isFinite(Number(fallback))?Math.max(0,Math.round(Number(fallback))):null;
    var now=new Date(),months=(now.getFullYear()-start.getFullYear())*12+(now.getMonth()-start.getMonth());
    if(now.getDate()<start.getDate())months--;return Math.max(0,months);
  }
  function stageFor(config,months){
    if(months==null)return{label:'Umur belum tersedia',note:'Periksa periode tanam dan kondisi tanaman.'};
    if(config.category==='MPTS'){
      if(months<12)return{label:'Pembentukan awal',note:'Fokus tanaman hidup, ajir, air, piringan, dan batang awal.'};
      if(months<36)return{label:'Pembentukan tajuk',note:'Evaluasi 2–3 kali per tahun; bentuk cabang utama dan ruang cahaya.'};
      return{label:'Transisi produktif / produktif',note:'Periksa riwayat bunga/panen, tajuk, air, dan pemulihan.'};
    }
    if(months<1)return{label:'Awal tanam',note:'Periksa tanaman hidup, air, ajir, sulaman, dan akar.'};
    if(months<3)return{label:'Vegetatif–berbunga',note:'Pantau pertumbuhan, nutrisi, air, bunga, dan OPT setiap minggu.'};
    return{label:'Berbuah / panen / evaluasi siklus',note:'Cocokkan status aktual tanaman, hasil panen, sanitasi, dan rencana siklus berikutnya.'};
  }
  function recordLine(label){return '<div class="dy-sop-record"><strong>Catat:</strong> '+label+'</div>';}
  function step(no,title,sub,items,record,open){
    return '<details class="dy-sop-step"'+(open?' open':'')+'><summary><span class="dy-sop-no">'+no+'</span><span><strong>'+esc(title)+'</strong><small>'+esc(sub)+'</small></span></summary><div class="dy-sop-body"><h4>Langkah kerja</h4><ul>'+items.map(function(item){return'<li>'+item+'</li>';}).join('')+'</ul>'+recordLine(record)+'</div></details>';
  }
  function buildSteps(c){
    var isTree=c.category==='MPTS',u=c.unit;
    if(isTree)return[
      step('01','Inventarisasi dan keselamatan','Peta, pohon hidup, air, akses, dan alat',[
        'Pastikan kode gawangan dan batas kerja sesuai peta; hindari kegiatan di luar areal.',
        'Hitung '+u+' hidup, mati, sakit, dan kosong sebagai bilangan utuh; angka teoritis desimal tidak dipakai sebagai hasil sensus.',
        'Periksa genangan, kekeringan, akses, saluran yang ada, cabang berbahaya, dan komoditas lain dalam gawangan.',
        'Gunakan alat layak dan APD; bersihkan vegetasi selektif tanpa membakar.'
      ],'tanggal, gawangan, '+u+' hidup/mati, kondisi air, cuaca, petugas, dan foto awal.',true),
      step('02','Bahan tanam dan penelusuran','Bibit sehat, asal jelas, dan mudah dievaluasi',[
        c.material,'Periksa akar, batang, pucuk, daun, luka, dan gejala organisme pengganggu sebelum tanam.',
        'Lindungi akar dari kering dan kerusakan selama angkut; pisahkan bibit yang meragukan.',
        'Siapkan bibit sulaman sekelas setelah penyebab kematian pada titik lama diperiksa.'
      ],'asal/varietas, jumlah diterima, ditolak, ditanam, dan disulam.'),
      step('03','Penataan dan penanaman','Titik pohon, lubang, leher akar, ajir, dan mulsa',[
        c.planting,'Tanam saat media lembap dan tidak tergenang; sesuaikan lubang dengan perakaran.',
        'Posisikan leher akar setara permukaan, padatkan ringan, dan pasang ajir bila diperlukan.',
        'Mulsa tidak menyentuh batang; jangan membuat drainase dalam pada gambut.'
      ],'titik/jarak, jumlah tanam, kondisi bibit, ajir, mulsa, dan tanggal.'),
      step('04','Air, piringan, dan gulma','Zona akar terlindungi tanpa kompetisi berat',[
        'Periksa kelembapan dan genangan terutama setelah tanam dan cuaca ekstrem.',
        'Jaga piringan secukupnya tanpa melukai akar dangkal atau membuka tanah berlebihan.',
        'Kendalikan gulma sebelum menutup bibit; pertahankan penutup tanah aman di antara jalur.',
        'Perbaiki ajir, pohon miring, mulsa menempel batang, atau kerusakan mekanis.'
      ],'kondisi air, tingkat gulma, pohon miring/rusak, dan tindakan.'),
      step('05','Nutrisi berbasis pohon','Umur, pH, tajuk, tanah/daun, dan riwayat',[
        'Gunakan umur aktual, jumlah '+u+' hidup, pH, kondisi tajuk, pertumbuhan, hasil tanah/daun bila tersedia, dan riwayat aplikasi.',
        'Gunakan jadwal evaluasi fase sebagai waktu mengambil keputusan, bukan dosis tetap semua gawangan.',
        'Aplikasikan bahan merata di zona akar aktif, tidak menempel batang, sesuai dosis kerja yang disahkan.',
        'Tunda saat hujan lebat, tergenang, angin kuat, atau tanaman stres; ukur respons sebelum mengulang.'
      ],'pH, bahan, dosis/'+u+', sasaran, total, tanggal, cuaca, petugas, dan sisa.'),
      step('06','Pembentukan dan pemangkasan tajuk','Cabang kuat, cahaya cukup, dan jalur aman',[
        c.canopy,'Gunakan alat tajam dan bersih; buat potongan rapi tanpa menyobek kulit.',
        'Jaga ruang cahaya dan akses untuk komoditas bawah tanpa merusak struktur pohon.',
        'Sanitasi alat antar pohon bergejala dan keluarkan bahan sakit sesuai arahan teknis.'
      ],u+' dipangkas, jenis cabang, alasan, alat, kondisi luka, dan foto sesudah.'),
      step('07','Hama, penyakit, dan sanitasi','Temukan dini, tandai pohon, dan periksa ulang',[
        c.hpt,'Tandai lokasi, hitung '+u+' terdampak, foto gejala dan bagian sehat pembanding.',
        'Perbaiki sanitasi, air, luka, dan kondisi kebun sesuai diagnosis sebelum memilih bahan.',
        'Pestisida hanya digunakan setelah penyebab dikenali, mengikuti label, APD, dan arahan teknis.'
      ],'nomor/titik pohon, gejala, jumlah terdampak, foto, tindakan, bahan, dan hasil ulang.'),
      step('08','Pembungaan, panen, dan evaluasi','Mutu hasil, keamanan, dan pemulihan',[
        c.harvest,'Pisahkan hasil rusak atau bergejala; teduhkan dan tangani sesuai tujuan pasar/pengolahan.',
        'Setelah panen lakukan sanitasi, pemangkasan ringan yang perlu, dan nilai pemulihan.',
        'Bandingkan hasil per '+u+', mutu, gangguan, serta penggunaan bahan antargawangan.'
      ],'tanggal, '+u+' dipanen, jumlah/berat, mutu, hasil ditolak, tujuan, dan tindak lanjut.')
    ].join('');
    return[
      step('01','Rencana siklus dan keselamatan','Gawangan, varietas, musim, air, alat, dan target',[
        'Pastikan kode gawangan, komoditas, varietas, periode tanam, dan target panen tercatat.',
        'Hitung populasi hidup sebagai tanaman utuh; pisahkan angka rencana dari hasil sensus.',
        'Periksa hujan, genangan, sumber air, jalur kerja, komoditas lain, dan riwayat gangguan.',
        'Siapkan alat layak, APD, tempat cuci alat, dan pengelolaan kemasan bahan.'
      ],'tanggal, gawangan, varietas, target, kondisi air/cuaca, petugas, dan foto awal.',true),
      step('02','Benih dan persemaian sehat','Asal jelas, media bersih, bibit seragam',[
        c.material,'Gunakan media dan wadah bersih, air secukupnya, cahaya bertahap, serta label varietas/tanggal.',
        'Pisahkan bibit bergejala; jangan memindahkan bibit sakit ke gawangan.',
        'Hitung daya tumbuh, bibit layak, bibit ditolak, dan kebutuhan sulaman.'
      ],'sumber/lot benih, tanggal semai, daya tumbuh, bibit layak/ditolak, dan foto.'),
      step('03','Bedengan dan penataan','Drainase permukaan, media, jarak, dan mulsa',[
        c.planting,'Bedengan dan saluran permukaan menjaga zona akar tanpa mengeringkan gambut.',
        'Gunakan jarak/pola dalam rencana blok dan tandai baris agar populasi dapat diverifikasi.',
        'Bahan organik harus matang; pembenah/pupuk dasar mengikuti hasil pemeriksaan dan keputusan kerja.'
      ],'dimensi bedengan, pola/jarak, bahan dasar, pH, kondisi media, dan tanggal.'),
      step('04','Pindah tanam dan penyulaman','Bibit sehat, akar utuh, tanaman tegak',[
        'Pindah tanam pada media lembap dan cuaca mendukung; hindari akar terlipat atau batang tertimbun.',
        'Padatkan ringan, siram secukupnya, dan lindungi bibit dari stres awal.',
        'Periksa tanaman mati/rebah/layu dan sulam setelah penyebabnya dinilai.',
        'Pasang ajir dengan posisi yang tidak merusak akar.'
      ],'jumlah tanam, hidup, mati, sulam, cuaca, air, dan foto.'),
      step('05','Air, gulma, dan nutrisi','Tepat fase, kondisi, bahan, dan catatan',[
        'Periksa kelembapan, genangan, pertumbuhan, warna daun, pH, gulma, dan riwayat aplikasi.',
        'Gunakan fase tanaman sebagai waktu evaluasi; dosis kerja tidak disamaratakan semua gawangan.',
        'Aplikasikan bahan di zona akar sesuai label dan keputusan, tidak mengenai batang/daun bila tidak diperuntukkan.',
        'Tunda saat hujan lebat, tergenang, angin kuat, atau tanaman stres.'
      ],'pH, bahan, dosis/tanaman, populasi sasaran, total, cuaca, petugas, dan sisa.'),
      step('06','Ajir dan pemeliharaan tajuk','Tanaman tegak, sirkulasi baik, luka minimum',[
        c.canopy,'Periksa ikatan agar tidak mencekik batang dan ganti ajir rusak.',
        'Buang bagian rusak/berpenyakit dengan alat bersih; hindari pekerjaan saat tanaman basah bila meningkatkan penularan.',
        'Jaga jalur panen dan sirkulasi tanpa membuka tajuk berlebihan.'
      ],'tanaman diberi ajir/dipelihara, bagian dibuang, alasan, dan kondisi sesudah.'),
      step('07','PHT dan sanitasi','Pengamatan rutin sebelum pengendalian',[
        c.hpt,'Amati contoh tanaman secara menyebar, hitung jumlah/proporsi terdampak, dan foto gejala.',
        'Utamakan benih sehat, sanitasi, gulma/inang, perangkap, musuh alami, serta perbaikan air dan tajuk.',
        'Gunakan pestisida hanya sesuai diagnosis, label, ambang/keputusan kerja, APD, interval, dan masa tunggu.'
      ],'gejala/OPT, tanaman terdampak, foto, tindakan, bahan, interval, dan hasil ulang.'),
      step('08','Panen, sortasi, dan akhir siklus','Mutu, hasil, keamanan pangan, dan sanitasi',[
        c.harvest,'Gunakan wadah bersih, hindari sinar/panas berlebih, dan pisahkan hasil rusak atau bergejala.',
        'Patuhi interval aplikasi dan masa tunggu bahan sebelum panen.',
        'Catat hasil setiap kali panen; pada akhir siklus bersihkan sisa sakit dan evaluasi bedengan.'
      ],'tanggal/kali panen, tanaman produktif, jumlah/berat, mutu, hasil ditolak, dan tujuan.')
    ].join('');
  }

  var params=new URLSearchParams(location.search),slug=String(params.get('crop')||'').toLowerCase(),config=configs[slug];
  var page=document.getElementById('crop-page'),pageError=document.getElementById('crop-page-error');
  if(!config){page.hidden=true;pageError.hidden=false;pageError.textContent='Komoditas tidak dikenali. Buka katalog panduan dan pilih komoditas yang tersedia.';return;}

  document.title='SOP Budidaya '+config.title+' Dayun | YG GeoPortal';
  document.getElementById('crop-breadcrumb').textContent=config.title;
  document.getElementById('crop-category').textContent='PANDUAN '+config.category.toUpperCase();
  document.getElementById('crop-title').textContent='Budidaya '+config.title.toLowerCase();
  document.getElementById('crop-intro').textContent=config.intro;
  document.getElementById('crop-unit-note').textContent='Satuan: '+config.unit+' utuh';
  document.getElementById('population-rule').textContent=config.unit.charAt(0).toUpperCase()+config.unit.slice(1)+' utuh';
  document.getElementById('parameter-title').textContent='Parameter kerja '+config.title.toLowerCase();
  document.getElementById('parameter-copy').textContent='Data gawangan memilih sasaran; kondisi '+config.unit+' yang diperiksa di lapangan tetap menjadi dasar tindakan.';
  document.getElementById('crop-safety-note').innerHTML='<strong>Kontrol Dayun.</strong> '+esc(config.safety);
  document.getElementById('phase-title').textContent='Program pemeliharaan '+config.title.toLowerCase();
  document.getElementById('phase-table').innerHTML=config.phases.map(function(row){return'<tr>'+row.map(function(cell,i){return'<td>'+(i===0?'<strong>'+esc(cell)+'</strong>':esc(cell))+'</td>';}).join('')+'</tr>';}).join('');
  document.getElementById('calculator-title').textContent='Kalkulator kebutuhan '+config.title.toLowerCase();
  document.getElementById('calculator-copy').textContent='Pilih gawangan '+config.title.toLowerCase()+'. Sistem membaca periode tanam dan populasi, lalu menghitung kebutuhan dari dosis kerja per '+config.unit+'.';
  document.getElementById('crop-count-label').textContent=config.unit.charAt(0).toUpperCase()+config.unit.slice(1)+' sasaran';
  document.getElementById('crop-dose-label').textContent='Dosis kerja per '+config.unit;
  Array.prototype.forEach.call(document.getElementById('crop-dose-unit').options,function(option){option.textContent=option.value+'/'+config.unit;});
  document.getElementById('result-label').textContent=config.title.toUpperCase();
  document.getElementById('steps-title').textContent='Tahapan budidaya '+config.title.toLowerCase();
  document.getElementById('crop-flow').innerHTML='<span><b>01–02</b>Rencana &amp; bahan tanam</span><span><b>03–04</b>Tanam &amp; pelihara</span><span><b>05–06</b>Nutrisi &amp; tajuk</span><span><b>07–08</b>Lindungi &amp; panen</span>';
  document.getElementById('crop-alert').innerHTML='<strong>Kondisi Dayun</strong>'+esc(config.safety);
  document.getElementById('crop-steps').innerHTML=buildSteps(config);
  document.getElementById('source-copy').textContent=config.sourceCopy;
  document.getElementById('source-link').href=config.source;

  var form=document.getElementById('crop-calculator'),gawangan=document.getElementById('crop-gawangan'),phase=document.getElementById('crop-phase'),ageNote=document.getElementById('crop-age-note'),count=document.getElementById('crop-count'),material=document.getElementById('crop-material'),dose=document.getElementById('crop-dose'),doseUnit=document.getElementById('crop-dose-unit'),reserve=document.getElementById('crop-reserve'),pack=document.getElementById('crop-package'),calcError=document.getElementById('crop-calc-error'),result=document.getElementById('crop-result'),records=[];
  function selected(){return records.find(function(row){return row.objectId===gawangan.value;})||null;}
  function updateSelection(){
    var row=selected();if(!row){phase.value='—';ageNote.textContent='Pilih gawangan.';count.value='';return;}
    var months=ageMonths(row.crop.plantingDate||row.crop.plantingPeriod,row.crop.ageMonths),stage=stageFor(config,months),n=Math.max(0,Math.round(Number(row.crop.vegetationCount)||0));
    phase.value=stage.label;ageNote.textContent=(months==null?'Umur belum tersedia':number(months,0)+' bulan')+' · '+stage.note;count.value=n||'';result.hidden=true;calcError.hidden=true;
  }
  function setError(message){calcError.textContent=message;calcError.hidden=false;result.hidden=true;}
  function init(data){
    (data.objects||[]).forEach(function(object){(object.crops||[]).forEach(function(crop){if(String(crop.crop||'').toUpperCase()===config.code)records.push({objectId:object.objectId,crop:crop});});});
    records.sort(function(a,b){return a.objectId.localeCompare(b.objectId,'id',{numeric:true});});
    if(!records.length)throw Error('Data komoditas tidak ditemukan.');
    var total=records.reduce(function(sum,row){return sum+Math.round(Number(row.crop.vegetationCount)||0);},0);
    document.getElementById('crop-data-summary').textContent=records.length+' gawangan · '+number(total,0)+' '+config.unit+' tercatat · jumlah ditampilkan tanpa desimal.';
    gawangan.innerHTML=records.map(function(row){return'<option value="'+esc(row.objectId)+'">'+esc(row.objectId.replace('DAYUN-GT-',''))+' · '+number(Math.round(Number(row.crop.vegetationCount)||0),0)+' '+config.unit+'</option>';}).join('');
    var query=params.get('object');if(query&&records.some(function(row){return row.objectId===query;}))gawangan.value=query;
    gawangan.disabled=false;updateSelection();
  }
  gawangan.addEventListener('change',updateSelection);
  form.addEventListener('submit',function(event){
    event.preventDefault();calcError.hidden=true;
    var row=selected(),n=Math.round(Number(count.value)),d=Number(dose.value),r=Number(reserve.value),p=Number(pack.value);
    if(!row)return setError('Pilih gawangan.');
    if(!Number.isFinite(n)||n<1)return setError('Jumlah sasaran harus bilangan bulat minimal 1.');
    if(!Number.isFinite(d)||d<=0)return setError('Masukkan dosis kerja yang telah disahkan.');
    if(!Number.isFinite(r)||r<0||r>25)return setError('Cadangan operasional harus 0–25%.');
    if(!Number.isFinite(p)||p<=0)return setError('Isi kemasan harus lebih dari 0.');
    count.value=n;
    var baseStandard=doseUnit.value==='g'?n*d/1000:doseUnit.value==='ml'?n*d/1000:n*d,total=baseStandard*(1+r/100),standard=doseUnit.value==='ml'?'liter':'kg',packages=Math.ceil(total/p),months=ageMonths(row.crop.plantingDate||row.crop.plantingPeriod,row.crop.ageMonths),stage=stageFor(config,months),planting=row.crop.plantingDate||row.crop.plantingPeriod||'periode belum tersedia';
    document.getElementById('result-title').textContent=material.value+' · '+row.objectId.replace('DAYUN-GT-','');
    document.getElementById('result-context').textContent=stage.label+' · tanam '+planting;
    document.getElementById('result-count').textContent=number(n,0)+' '+config.unit;
    document.getElementById('result-dose').textContent=number(d,2)+' '+doseUnit.value+'/'+config.unit;
    document.getElementById('result-base').textContent=number(baseStandard,baseStandard<10?2:1)+' '+standard;
    document.getElementById('result-total').textContent=number(total,total<10?2:1)+' '+standard;
    document.getElementById('result-packages').textContent=number(packages,0)+' kemasan';
    document.getElementById('result-formula').textContent=number(n,0)+' '+config.unit+' × '+number(d,2)+' '+doseUnit.value+'/'+config.unit+(r?' + '+number(r,1)+'% cadangan':'')+' = '+number(total,total<10?2:1)+' '+standard+'. Kemasan dibulatkan ke atas; sisa wajib dicatat.';
    result.hidden=false;result.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
  form.addEventListener('reset',function(){setTimeout(function(){dose.value='';reserve.value='0';pack.value='1';material.value='Pupuk organik';doseUnit.value='g';updateSelection();},0);});
  fetch('data/dayun-gawangan-details.json?v=20260917-all-profile1',{cache:'force-cache'}).then(function(response){if(!response.ok)throw Error('Data tidak dapat dimuat.');return response.json();}).then(init).catch(function(error){console.error(error);gawangan.innerHTML='<option value="">Data belum dapat dimuat</option>';setError('Data gawangan belum dapat dimuat. Silakan coba lagi.');});
})();
