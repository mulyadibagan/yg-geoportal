(function(){
  'use strict';
  var SOURCE='https://drive.google.com/file/d/1gwiTpEieu3N9waJ_fEQO1gM3O0jFFnXP/view?usp=sharing';
  var GALLERY_COUNTS={'rhizophora-apiculata':6,'rhizophora-mucronata':6,'sonneratia-alba':6,'sonneratia-ovata':6,'sonneratia-caseolaris':6,'avicennia-alba':6,'avicennia-lanata':6,'bruguiera-cylindrica':6,'bruguiera-gymnorhiza':6,'bruguiera-sexangula':6,'bruguiera-parviflora':6,'ceriops-tagal':6,'lumnitzera-littorea':6,'lumnitzera-racemosa':6,'excoecaria-agallocha':6,'scyphiphora-hydrophylacea':6,'nypa-fruticans':6,'xylocarpus-granatum':6,'xylocarpus-moluccensis':6,'heritiera-littoralis':6,'acanthus-ilicifolius':4,'acrostichum-speciosum':2,'acrostichum-aureum':2,'hibiscus-tiliaceus':2,'rotan-nasi':3,'oncosperma-tigillarium':1,'morinda-citrifolia':2,'terminalia-catappa':1,'teki-laut':2};
  var both=['Buruk Bakul','Kelapa Pati'];
  var floraData=[
    ['Bakau minyak/putih','Rhizophora apiculata','rhizophora-apiculata','Mangrove sejati','Least Concern',both],
    ['Blukap / bakau merah','Rhizophora mucronata','rhizophora-mucronata','Mangrove sejati','Least Concern',both],
    ['Prepat','Sonneratia alba','sonneratia-alba','Mangrove sejati','Least Concern',both],
    ['Kedabu','Sonneratia ovata','sonneratia-ovata','Mangrove sejati','Near Threatened',both],
    ['Berembang','Sonneratia caseolaris','sonneratia-caseolaris','Mangrove sejati','Least Concern',both,'Nama genus pada tabel Buruk Bakul berbeda dengan keterangan foto; katalog mengikuti keterangan foto.'],
    ['Api-api putih','Avicennia alba','avicennia-alba','Mangrove sejati','Least Concern',both],
    ['Api-api jambu','Avicennia lanata','avicennia-lanata','Mangrove sejati','Perlu verifikasi',both,'Laporan mencatat status Vulnerable di Buruk Bakul tetapi Least Concern di Kelapa Pati; status perlu diverifikasi kembali.'],
    ['Boseng','Bruguiera cylindrica','bruguiera-cylindrica','Mangrove sejati','Least Concern',both],
    ['Tumu merah','Bruguiera gymnorhiza','bruguiera-gymnorhiza','Mangrove sejati','Least Concern',both],
    ['Tumu putih','Bruguiera sexangula','bruguiera-sexangula','Mangrove sejati','Least Concern',both],
    ['Lenggadai','Bruguiera parviflora','bruguiera-parviflora','Mangrove sejati','Least Concern',both],
    ['Tengar','Ceriops tagal','ceriops-tagal','Mangrove sejati','Least Concern',both],
    ['Sesop merah','Lumnitzera littorea','lumnitzera-littorea','Mangrove sejati','Least Concern',both],
    ['Sesop putih','Lumnitzera racemosa','lumnitzera-racemosa','Mangrove sejati','Least Concern',both],
    ['Bebetak','Excoecaria agallocha','excoecaria-agallocha','Mangrove sejati','Least Concern',both],
    ['Cingam','Scyphiphora hydrophylacea','scyphiphora-hydrophylacea','Mangrove sejati','Least Concern',both],
    ['Nipah','Nypa fruticans','nypa-fruticans','Mangrove sejati','Least Concern',both],
    ['Nyirih bunga','Xylocarpus granatum','xylocarpus-granatum','Mangrove sejati','Least Concern',both],
    ['Nyirih batu','Xylocarpus moluccensis','xylocarpus-moluccensis','Mangrove sejati','Least Concern',['Buruk Bakul']],
    ['Dungun','Heritiera littoralis','heritiera-littoralis','Mangrove sejati','Least Concern',['Buruk Bakul']],
    ['Jeruju','Acanthus ilicifolius','acanthus-ilicifolius','Mangrove sejati','Least Concern',both],
    ['Piai lasa','Acrostichum speciosum','acrostichum-speciosum','Mangrove sejati','Least Concern',['Buruk Bakul']],
    ['Piai raya','Acrostichum aureum','acrostichum-aureum','Mangrove sejati','Least Concern',both],
    ['Bebaghu','Hibiscus tiliaceus','hibiscus-tiliaceus','Mangrove asosiasi','Belum tercantum',both],
    ['Rotan nasi','Belum dicantumkan dalam laporan','rotan-nasi','Mangrove asosiasi','Belum tercantum',both,'Nama ilmiah tidak dicantumkan dalam laporan baseline.'],
    ['Nibung','Oncosperma tigillarium','oncosperma-tigillarium','Mangrove asosiasi','Belum tercantum',both],
    ['Mengkudu','Morinda citrifolia','morinda-citrifolia','Mangrove asosiasi','Belum tercantum',both],
    ['Ketapang','Terminalia catappa','terminalia-catappa','Mangrove asosiasi','Belum tercantum',both],
    ['Teki laut','Belum dicantumkan dalam laporan','teki-laut','Mangrove asosiasi','Belum tercantum',both,'Nama ilmiah tidak dicantumkan dalam laporan baseline.']
  ].map(function(item,index){return {id:index+1,local:item[0],scientific:item[1],slug:item[2],category:item[3],status:item[4],locations:item[5],note:item[6]||'',group:'Flora',ecosystem:'Mangrove',evidence:'Terverifikasi YG',source:'Final Baseline Mangrove 2024'};});

  var faunaRows=[
    ['Sepetang','Pharella acutidens','sepetang','Bivalvia',both,'Foto baseline tersedia dari Buruk Bakul dan Kelapa Pati.'],
    ['Bongan','Nama ilmiah belum dicantumkan','bongan','Gastropoda',both,'Nama lokal dapat merujuk pada lebih dari satu siput mangrove; validasi memerlukan ciri cangkang dan operkulum.'],
    ['Siput merah','Nama ilmiah belum dicantumkan','siput-merah','Gastropoda',['Buruk Bakul'],'Identifikasi pada baseline masih memakai nama lokal.'],
    ['Tembakul','Periophthalmus sp.','tembakul','Ikan',['Buruk Bakul'],'Identifikasi baru aman pada tingkat genus; foto lateral dan sirip diperlukan untuk menentukan spesies.'],
    ['Belangkas','Nama ilmiah perlu diverifikasi','belangkas','Chelicerata',['Buruk Bakul'],'Laporan menulis “Blankas”. Spesies belum dapat ditentukan hanya dari foto baseline.'],
    ['Rama-rama','Thalassina anomala','rama-rama','Crustacea',['Buruk Bakul'],'Ejaan ilmiah pada laporan dinormalisasi dari “Thalasina anoma”; konfirmasi morfologi tetap disarankan.'],
    ['Lokan','Geloina expansa','lokan','Bivalvia',['Kelapa Pati'],'Baseline menulis “Polimesoda expansa”; WoRMS menerima nama Geloina expansa.'],
    ['Siput babi / belongkeng','Telescopium telescopium','siput-babi','Gastropoda',['Kelapa Pati'],'Nama ilmiah sesuai dengan keterangan foto baseline.'],
    ['Siput bintang','Nama ilmiah belum dicantumkan','siput-bintang','Gastropoda',['Kelapa Pati'],'Identifikasi pada baseline masih memakai nama lokal.'],
    ['Siput pinang','Nama ilmiah belum dicantumkan','siput-pinang','Gastropoda',['Kelapa Pati'],'Identifikasi pada baseline masih memakai nama lokal.'],
    ['Siput mata merah','Nama ilmiah belum dicantumkan','siput-mata-merah','Gastropoda',['Kelapa Pati'],'Identifikasi pada baseline masih memakai nama lokal.']
  ];
  var faunaData=faunaRows.map(function(item,index){return {id:floraData.length+index+1,local:item[0],scientific:item[1],slug:item[2],category:item[3],status:'Belum tercantum',locations:item[4],note:item[5]||'',group:'Fauna',ecosystem:'Mangrove',evidence:'Terverifikasi YG',source:'Final Baseline Mangrove 2024',icon:item[3]==='Ikan'?'🐟':(item[3]==='Crustacea'||item[3]==='Chelicerata'?'🦀':'🐚')};});
  var data=floraData.concat(faunaData);
  var REF={fao:['FAO — Mangrove Guidebook for Southeast Asia','https://www.fao.org/4/ag132e/ag132e00.pdf'],field:['Field Guide to Philippine Mangroves','https://repository.seafdec.org.ph/handle/10862/3053'],kew:['Kew — Plants of the World Online','https://powo.science.kew.org/'],iucn:['IUCN Red List','https://www.iucnredlist.org/'],gbif:['GBIF','https://www.gbif.org/'],fish:['FishBase','https://www.fishbase.se/'],worms:['WoRMS — World Register of Marine Species','https://www.marinespecies.org/']};
  var FAUNA_PHOTO_COUNTS={sepetang:2,bongan:2,'siput-merah':1,tembakul:1,belangkas:1,'rama-rama':1,lokan:1,'siput-babi':1,'siput-bintang':1,'siput-pinang':1,'siput-mata-merah':1};
  var FAUNA_PHOTO_LOCATIONS={sepetang:['Buruk Bakul','Kelapa Pati'],bongan:['Buruk Bakul','Kelapa Pati'],'siput-merah':['Buruk Bakul'],tembakul:['Buruk Bakul'],belangkas:['Buruk Bakul'],'rama-rama':['Buruk Bakul'],lokan:['Kelapa Pati'],'siput-babi':['Kelapa Pati'],'siput-bintang':['Kelapa Pati'],'siput-pinang':['Kelapa Pati'],'siput-mata-merah':['Kelapa Pati']};
  var GENUS={
    Rhizophora:['Daun berhadapan, akar tunjang, dan propagul vivipar memanjang.','Zona depan–tengah yang terlindung, tepi sungai, dan lumpur pasang surut.','Menahan sedimen dan erosi serta menyediakan habitat juvenil ikan dan krustasea.','Propagul lokal dapat ditanam pada elevasi dan hidrologi yang sesuai; hindari monokultur luas.'],
    Sonneratia:['Daun berhadapan, bunga dengan banyak benang sari, buah bulat, dan akar napas kerucut.','Tepi laut atau sungai pasang; zonasi tepat berbeda antarspesies dan tingkat salinitas.','Pionir penangkap sedimen, pakan fauna, dan habitat bentik.','Biji dari buah matang; cocokkan spesies dengan salinitas, substrat, dan energi gelombang.'],
    Avicennia:['Daun berhadapan dengan bagian bawah pucat dan pneumatofor seperti pensil.','Dataran lumpur pionir, muara, serta zona depan–tengah yang sering tergenang.','Memerangkap lumpur, membantu suksesi, dan mengaerasi sedimen di sekitar akar.','Buah semi-vivipar cepat berkecambah; lindungi pneumatofor dari injakan dan sampah.'],
    Bruguiera:['Daun berhadapan, akar lutut, bunga berkelopak mencolok, dan propagul vivipar.','Zona tengah–belakang yang lebih stabil dan terlindung.','Menambah struktur hutan, biomassa, serasah, dan kestabilan substrat.','Gunakan propagul lokal pada tapak terlindung setelah aliran pasang dipulihkan.'],
    Ceriops:['Pohon kecil–sedang, akar lutut/banir, daun berhadapan, dan propagul ramping beralur.','Zona tengah–belakang yang lebih tinggi dan tergenang berkala.','Menstabilkan substrat dalam dan memperkaya zona transisi.','Propagul vivipar; memerlukan tapak terlindung dan elevasi yang tepat.'],
    Lumnitzera:['Daun kecil berdaging, tanpa akar tunjang besar; warna bunga membedakan spesies.','Zona belakang pada tanah lebih padat yang jarang tergenang.','Menahan batas darat dan menyediakan bunga bagi penyerbuk.','Utamakan perlindungan pohon induk dan regenerasi alami.'],
    Xylocarpus:['Pohon berbanir, daun majemuk, buah bulat besar, dan biji bersudut.','Zona tengah–belakang dan tepi sungai pada substrat stabil.','Penyimpan biomassa besar dan pembentuk struktur hutan matang.','Biji besar cepat kehilangan viabilitas; tanam segera di tapak terlindung.'],
    Acrostichum:['Paku besar berumpun; bagian bawah daun fertil berwarna cokelat.','Belakang mangrove, rawa payau, kanal, dan bukaan kanopi.','Penutup tanah dan mikrohabitat; dominasi tinggi dapat menandai gangguan.','Menyebar dengan spora/rimpang; bukan pengganti keragaman pohon.']
  };
  var SPECIFIC={
    'excoecaria-agallocha':['Daun berseling dan getah putih yang dapat mengiritasi; buah berlobus tiga.','Mangrove belakang dan tepi sungai yang tergenang berkala.','Penyusun kanopi belakang dan penghasil serasah.','Hindari kontak getah; pulihkan regenerasi alami.'],
    'scyphiphora-hydrophylacea':['Semak/pohon kecil berdaun mengilap; bunga kecil dan buah beralur.','Zona belakang pada pasir berlumpur yang jarang tergenang.','Pengikat tanah dan sumber naungan/pakan pada batas mangrove.','Jaga zona belakang dari penimbunan dan konversi.'],
    'nypa-fruticans':['Palem berdaun menyirip panjang dengan tandan buah bulat besar.','Tepi sungai pasang bagian hulu dengan pengaruh air tawar kuat.','Menahan tebing, menghasilkan detritus, serta bahan pangan lokal.','Biji dari buah matang; aliran sungai dan pasang harus tetap terbuka.'],
    'heritiera-littoralis':['Daun berseling dengan bagian bawah keperakan, batang berbanir, dan buah berkayu.','Zona belakang di atas batas genangan harian.','Memperkuat batas darat dan membentuk kanopi besar.','Pertahankan pohon induk karena pertumbuhan awal relatif lambat.'],
    'acanthus-ilicifolius':['Semak berduri dengan daun berlekuk dan bunga ungu kebiruan.','Tepi kanal, bukaan, dan zona belakang berlumpur.','Penutup alami dan sumber bunga bagi serangga.','Mudah tumbuh vegetatif; jangan dibersihkan tanpa alasan ekologis.'],
    'hibiscus-tiliaceus':['Daun lebar berbentuk jantung; bunga kuning berubah jingga sebelum gugur.','Pantai dan zona transisi belakang mangrove.','Penahan tanah, peneduh, dan sumber bunga.','Biji atau stek; bukan untuk zona pasang harian.'],
    'oncosperma-tigillarium':['Palem berumpun dengan batang berduri hitam dan daun menyirip.','Rawa payau serta zona belakang mangrove.','Memperkuat tanah rawa dan memberi struktur vertikal.','Lindungi rumpun induk dari penebangan dan kebakaran.'],
    'morinda-citrifolia':['Daun besar mengilap dan buah majemuk putih kekuningan berbau khas.','Daratan pesisir di belakang batas pasang.','Pakan fauna dan penutup tepian.','Biji atau stek; bukan jenis zona tergenang.'],
    'terminalia-catappa':['Tajuk bertingkat, daun lebar yang memerah sebelum gugur, dan buah keras.','Hutan pantai di atas batas pasang rutin.','Peneduh, penahan angin, serasah, dan pakan fauna.','Biji; sesuai untuk sabuk darat pesisir.'],
    'rotan-nasi':['Rotan memanjat; spesies memerlukan foto pelepah, duri, bunga, dan buah.','Hutan rawa atau zona belakang yang tidak tergenang terus-menerus.','Menambah struktur vertikal dan tempat berlindung fauna.','Jaga rumpun induk sampai nama ilmiah terverifikasi.'],
    'teki-laut':['Herba mirip rumput/teki; identifikasi membutuhkan bunga, buah, dan bentuk batang.','Bukaan pesisir atau rawa asin di belakang mangrove.','Menutup tanah dan memerangkap sedimen halus.','Pertahankan tutupan; rekomendasi menunggu identifikasi ilmiah.']
  };
  var FAUNA_INFO={
    Bivalvia:['Cangkang berpasangan; bentuk, engsel, dan garis tumbuh penting untuk identifikasi.','Sedimen lunak intertidal di sekitar akar mangrove.','Penyaring air dan bagian rantai makanan bentik.'],
    Gastropoda:['Siput bercangkang tunggal; foto cangkang, mulut, operkulum, dan habitat diperlukan.','Lumpur, akar, atau batang mangrove sesuai spesies.','Pemakan detritus/mikroalga dan mangsa bagi fauna lain.'],
    Ikan:['Ikan amfibi bermata menonjol dan bersirip dada kuat; baseline baru memastikan genus.','Dataran lumpur, akar, dan tepi kanal saat surut.','Predator invertebrata kecil dan indikator konektivitas air–darat.'],
    Crustacea:['Krustasea penggali dengan capit kuat yang membentuk liang atau gundukan.','Mangrove belakang dan tanah lembap di batas darat.','Bioturbasi membantu aerasi dan percampuran bahan organik.'],
    Chelicerata:['Artropoda laut berkarapas seperti tapal kuda; spesies perlu dikonfirmasi dari karapas dan ekor.','Dataran lumpur/pasir estuari dan perairan dangkal.','Mengaduk sedimen dan mendukung rantai makanan pesisir.']
  };
  var FAUNA_SPECIFIC={
    sepetang:{identification:'Kerang memanjang dan agak pipih dengan dua cangkang tipis berwarna putih-krem; ujung cangkang menyempit. Identifikasi diperkuat oleh bentuk engsel, garis pertumbuhan, dan sifon.',habitat:'Membenamkan diri pada lumpur intertidal di sekitar akar mangrove dan tepian estuari yang tenang.',diet:'Filter feeder: menyaring fitoplankton, partikel organik, dan bahan tersuspensi dari air.',behavior:'Lebih banyak hidup terbenam; aktivitas makan mengikuti genangan pasang dan kondisi air.',ecology:'Membantu penyaringan air, menghubungkan plankton dengan pemangsa bentik, dan menjadi indikator kondisi sedimen.',threats:'Pencemaran, perubahan kualitas air, pengerukan sedimen, hilangnya mangrove, dan pemanenan berlebih.'},
    bongan:{identification:'Siput kecil–sedang bercangkang spiral. Foto baseline menunjukkan variasi bentuk antara dua desa, sehingga nama ilmiah belum boleh disimpulkan dari nama lokal saja.',habitat:'Permukaan lumpur, serasah, dan sekitar akar mangrove pada zona intertidal.',diet:'Kemungkinan memakan biofilm, mikroalga, dan detritus; pola makan harus dikonfirmasi setelah identifikasi taksonomi.',behavior:'Aktif merayap pada kondisi lembap dan sering berlindung saat substrat mengering.',ecology:'Mendaur ulang serasah dan menjadi mangsa ikan, kepiting, serta burung pesisir.',threats:'Sampah, pestisida, perubahan kelembapan substrat, dan hilangnya mikrohabitat serasah.'},
    'siput-merah':{identification:'Siput kecil dengan warna tubuh/cangkang kemerahan pada foto baseline. Nama ilmiah belum dipastikan; dokumentasi bagian mulut cangkang dan operkulum diperlukan.',habitat:'Lumpur lembap dan zona akar mangrove Buruk Bakul.',diet:'Diduga grazer-detritivor yang memakan lapisan mikroalga dan bahan organik pada permukaan substrat.',behavior:'Aktivitas permukaan dipengaruhi pasang, suhu, dan kelembapan.',ecology:'Membantu penguraian bahan organik dan menjadi bagian rantai makanan bentik.',threats:'Pencemaran, pengeringan substrat, injakan, dan perubahan aliran pasang.'},
    tembakul:{identification:'Mata menonjol di atas kepala, tubuh memanjang, dan sirip dada kuat untuk bergerak di lumpur. Baseline mengidentifikasi genus Periophthalmus, belum spesies.',habitat:'Dataran lumpur terbuka, tepi kanal pasang, dan sekitar akar mangrove saat air surut.',diet:'Memangsa serangga, krustasea kecil, cacing, dan organisme bentik; beberapa jenis juga mengambil alga.',behavior:'Ikan amfibi yang bernapas melalui kulit dan rongga insang lembap, menjaga liang, serta aktif ketika surut.',ecology:'Menghubungkan rantai makanan perairan dan daratan serta menunjukkan konektivitas pasang-surut yang masih berfungsi.',threats:'Penimbunan dataran lumpur, pencemaran air, rusaknya liang, dan hilangnya vegetasi tepi.'},
    belangkas:{identification:'Karapas lebar berbentuk tapal kuda, bagian perut bersegmen, dan ekor panjang (telson). Spesies Indonesia perlu dibedakan memakai bentuk karapas dan duri.',habitat:'Perairan dangkal, dataran lumpur atau pasir estuari, serta tepian mangrove.',diet:'Memakan cacing, moluska kecil, krustasea, dan bahan organik pada sedimen.',behavior:'Bergerak di dasar perairan dan menggunakan area pesisir dangkal untuk mencari makan atau berkembang biak.',ecology:'Mengaduk sedimen, memangsa invertebrata kecil, dan telur/juvenilnya mendukung jejaring makanan pesisir.',threats:'Tangkapan sampingan, pengambilan, pencemaran, reklamasi, dan hilangnya dataran pasang.'},
    'rama-rama':{identification:'Krustasea penggali bertubuh memanjang, karapas keras, capit besar, dan warna jingga-cokelat. Foto baseline memperlihatkan bentuk khas mud lobster.',habitat:'Tanah lembap zona tengah–belakang mangrove dan batas darat; membangun liang dalam serta gundukan lumpur.',diet:'Omnivor-detritivor yang memanfaatkan bahan tumbuhan, akar, dan organisme kecil di dalam tanah.',behavior:'Sebagian besar hidup di liang; aktivitas menggali memindahkan sedimen dari lapisan bawah ke permukaan.',ecology:'Bioturbasi meningkatkan aerasi, drainase mikro, dan pencampuran bahan organik; gundukannya menciptakan mikrohabitat baru.',threats:'Penimbunan, pemadatan tanah, perubahan hidrologi, pestisida, dan konversi zona belakang mangrove.'},
    lokan:{identification:'Kerang tebal berbentuk membulat-segitiga, berwarna cokelat kekuningan dengan garis pertumbuhan jelas. Nama diterima WoRMS: Geloina expansa.',habitat:'Lumpur payau zona belakang dan sekitar akar mangrove, sering pada bagian yang tergenang berkala.',diet:'Filter feeder yang menyaring fitoplankton dan partikel organik dari air.',behavior:'Hidup tertanam sebagian dalam sedimen; bukaan cangkang dan penyaringan meningkat ketika kondisi tergenang sesuai.',ecology:'Menyaring air, menyimpan biomassa bentik, dan memiliki nilai pangan/ekonomi lokal.',threats:'Pemanenan berlebih, logam berat dan pencemaran, perubahan salinitas, serta hilangnya habitat.'},
    'siput-babi':{identification:'Cangkang besar, panjang, berbentuk kerucut dengan banyak ulir; warna cokelat gelap hingga kehitaman. Nama ilmiah Telescopium telescopium terkonfirmasi dalam baseline.',habitat:'Dataran lumpur mangrove dan estuari, terutama area tenang kaya bahan organik.',diet:'Detritivor dan grazer yang memakan diatom, mikroalga, dan bahan organik permukaan.',behavior:'Merayap di lumpur saat kondisi lembap atau surut dan dapat berkumpul pada habitat yang sesuai.',ecology:'Memproses detritus, mempercepat siklus nutrien, dan menjadi sumber pangan lokal di beberapa wilayah.',threats:'Pemanenan, pencemaran sedimen, sampah, dan konversi dataran lumpur.'},
    'siput-bintang':{identification:'Foto baseline menunjukkan cangkang berornamen/rusuk menyerupai pola bintang. Nama lokal belum cukup untuk menetapkan spesies.',habitat:'Permukaan lumpur dan area akar mangrove Kelapa Pati.',diet:'Kemungkinan grazer atau detritivor; perlu konfirmasi setelah identifikasi spesies.',behavior:'Bergerak pada permukaan substrat lembap mengikuti siklus pasang.',ecology:'Membantu konsumsi biofilm dan menjadi mangsa fauna pesisir lain.',threats:'Kerusakan substrat, pencemaran, sampah, serta pengambilan tanpa data populasi.'},
    'siput-pinang':{identification:'Siput bercangkang oval-memanjang berwarna pucat pada foto baseline. Foto apertur, operkulum, dan pola ulir diperlukan untuk identifikasi.',habitat:'Lumpur/serasah mangrove Kelapa Pati pada zona tergenang berkala.',diet:'Diduga memanfaatkan detritus dan mikroalga di permukaan lumpur.',behavior:'Mencari makan saat substrat lembap dan berlindung ketika kondisi panas atau kering.',ecology:'Berperan dalam penguraian serasah dan aliran energi menuju predator bentik.',threats:'Kehilangan serasah, perubahan genangan, pencemaran, dan injakan.'},
    'siput-mata-merah':{identification:'Siput kecil dengan ciri kemerahan di sekitar kepala/mata menurut nama lokal dan foto baseline; nama ilmiah masih memerlukan pemeriksaan spesimen.',habitat:'Lumpur dan serasah di sekitar akar mangrove Kelapa Pati.',diet:'Kemungkinan grazer-detritivor; informasi spesifik belum dapat dipastikan tanpa identifikasi taksonomi.',behavior:'Aktif pada mikrohabitat lembap dan mengikuti perubahan pasang.',ecology:'Bagian komunitas makrobentos yang membantu pemrosesan bahan organik dan menjadi pakan fauna lain.',threats:'Pencemaran, hilangnya tutupan mangrove, perubahan pasang, dan berkurangnya serasah.'}
  };
  data.forEach(function(item){
    var p;
    if(item.group==='Flora'){
      var genus=item.scientific.split(' ')[0]; p=SPECIFIC[item.slug]||GENUS[genus]||['Identifikasi spesies memerlukan foto daun, batang, bunga/buah, dan habitat.','Zona transisi pesisir; posisi genangan perlu dicatat.','Menambah keragaman struktur dan fungsi vegetasi pesisir.','Utamakan regenerasi alami dan sumber benih lokal.'];
      item.identification=p[0];item.habitat=p[1];item.ecology=p[2];item.regeneration=p[3];item.threats='Konversi habitat, perubahan hidrologi/pasang, pencemaran, abrasi, kebakaran, atau pemanenan yang tidak berkelanjutan.';item.references=[REF.fao,REF.field,REF.kew,REF.iucn];
    }else{
      p=FAUNA_SPECIFIC[item.slug]||{};var generic=FAUNA_INFO[item.category];item.identification=p.identification||generic[0];item.habitat=p.habitat||generic[1];item.ecology=p.ecology||generic[2];item.diet=p.diet||'Informasi pakan menunggu identifikasi lebih lanjut.';item.behavior=p.behavior||'Perilaku lapangan perlu dicatat pada survei berikutnya.';item.threats=p.threats||'Kehilangan mikrohabitat, pencemaran, perubahan sedimen/pasang, dan pengambilan berlebih.';item.references=[REF.worms,REF.gbif,item.category==='Ikan'?REF.fish:REF.fao];
    }
  });

  var grid=document.getElementById('flora-grid');
  var search=document.getElementById('flora-search');
  var ecosystemFilter=document.getElementById('ecosystem-filter');
  var groupFilter=document.getElementById('group-filter');
  var locationFilter=document.getElementById('location-filter');
  var statusFilter=document.getElementById('status-filter');
  var evidenceFilter=document.getElementById('evidence-filter');
  var summary=document.getElementById('result-summary');
  var empty=document.getElementById('empty-state');
  var emptyTitle=document.getElementById('empty-title');
  var emptyDescription=document.getElementById('empty-description');
  var catalogEyebrow=document.getElementById('catalog-eyebrow');
  var catalogTitle=document.getElementById('catalog-title');
  var catalogIntro=document.getElementById('catalog-intro');
  var ecosystemCards=Array.from(document.querySelectorAll('[data-ecosystem]'));
  var dialog=document.getElementById('flora-dialog');
  var dialogContent=document.getElementById('dialog-content');

  function escapeHtml(value){return String(value||'').replace(/[&<>'"]/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char];});}
  function statusClass(status){if(status==='Near Threatened')return 'status-nt';if(status==='Vulnerable')return 'status-vu';if(status==='Perlu verifikasi')return 'status-verify';return '';}
  function imagePath(item){return 'assets/flora-mangrove/'+item.slug+'.webp';}
  function galleryPath(item,index){return 'assets/flora-mangrove/gallery/'+item.slug+'/'+index+'.webp';}
  function faunaPhotoPath(item,index){return 'assets/fauna-mangrove/'+item.slug+'/'+index+'.webp';}
  var SPECIAL_GALLERY_LABELS={
    'sonneratia-alba':['F. AKAR','B. DAUN','C. BUNGA/PUTIK','A. POHON','E. BATANG','D. BUAH']
  };
  function galleryLabel(item,count,index){
    var complete=['A. POHON','B. DAUN','C. BUNGA/PUTIK','D. BUAH','E. BATANG','F. AKAR'];
    if(SPECIAL_GALLERY_LABELS[item.slug])return SPECIAL_GALLERY_LABELS[item.slug][index-1];
    if(count===6)return complete[index-1];
    return 'DOKUMENTASI '+index;
  }
  function galleryHtml(item){
    var count=GALLERY_COUNTS[item.slug]||1;
    var thumbs='';
    for(var index=1;index<=count;index++){
      thumbs+='<button type="button" class="dialog-gallery-thumb'+(index===1?' is-active':'')+'" data-gallery-index="'+index+'" data-gallery-label="'+escapeHtml(galleryLabel(item,count,index))+'" aria-label="'+escapeHtml(galleryLabel(item,count,index))+'"><img src="'+galleryPath(item,index)+'" alt="'+escapeHtml(galleryLabel(item,count,index))+' '+escapeHtml(item.local)+'" loading="lazy"><span>'+escapeHtml(galleryLabel(item,count,index))+'</span></button>';
    }
    return '<div class="dialog-gallery" data-gallery-slug="'+escapeHtml(item.slug)+'"><div class="dialog-gallery-stage"><img src="'+galleryPath(item,1)+'" alt="'+escapeHtml(galleryLabel(item,count,1))+' '+escapeHtml(item.local)+'"><div class="dialog-gallery-caption"><strong>'+escapeHtml(galleryLabel(item,count,1))+'</strong><span>1 / '+count+'</span></div></div><div class="dialog-gallery-thumbs">'+thumbs+'</div><p>Seluruh foto identifikasi yang tersedia pada laporan baseline.</p></div>';
  }
  function faunaGalleryHtml(item){
    var count=FAUNA_PHOTO_COUNTS[item.slug]||1;var thumbs='';
    for(var index=1;index<=count;index++){var locationName=(FAUNA_PHOTO_LOCATIONS[item.slug]||item.locations)[index-1]||item.locations[0];thumbs+='<button type="button" class="dialog-gallery-thumb'+(index===1?' is-active':'')+'" data-fauna-gallery-index="'+index+'" data-gallery-label="'+escapeHtml(locationName)+'" aria-label="Foto baseline '+escapeHtml(item.local)+' di '+escapeHtml(locationName)+'"><img src="'+faunaPhotoPath(item,index)+'" alt="Dokumentasi baseline '+escapeHtml(item.local)+' di '+escapeHtml(locationName)+'" loading="lazy"><span>'+escapeHtml(locationName)+'</span></button>';}
    var firstLocation=(FAUNA_PHOTO_LOCATIONS[item.slug]||item.locations)[0]||item.locations[0];
    return '<div class="dialog-gallery fauna-baseline-gallery" data-fauna-gallery-slug="'+escapeHtml(item.slug)+'"><div class="dialog-gallery-stage"><img src="'+faunaPhotoPath(item,1)+'" alt="Dokumentasi baseline '+escapeHtml(item.local)+' di '+escapeHtml(firstLocation)+'"><div class="dialog-gallery-caption"><strong>'+escapeHtml(firstLocation)+'</strong><span>1 / '+count+'</span></div></div><div class="dialog-gallery-thumbs">'+thumbs+'</div><p><strong>Dokumentasi baseline YG</strong> · Survei lapangan Juni 2023, dimuat dalam Final Baseline Mangrove 2024.</p></div>';
  }
  function canUseExternalPhoto(item){return item.group==='Fauna'&&item.scientific&&!/belum|perlu|sp\./i.test(item.scientific);}
  function faunaVisual(item){
    if(!canUseExternalPhoto(item))return '<div class="dialog-fauna-visual"><span>'+item.icon+'</span><strong>Foto identifikasi belum tersedia</strong><small>Nama ilmiah belum cukup pasti. Foto eksternal tidak ditampilkan agar tidak menyesatkan; diperlukan dokumentasi cangkang/tubuh dan habitat untuk validasi.</small></div>';
    return '<div class="dialog-fauna-visual external-photo" data-external-photo="'+escapeHtml(item.scientific)+'"><span>'+item.icon+'</span><strong>Mencari foto rujukan terverifikasi…</strong><small>Foto eksternal akan diberi kredit dan tidak dianggap sebagai dokumentasi lokasi YG.</small></div>';
  }
  function loadExternalPhoto(item){
    var box=dialogContent.querySelector('[data-external-photo]');if(!box)return;
    fetch('https://api.gbif.org/v1/occurrence/search?scientific_name='+encodeURIComponent(item.scientific)+'&media_type=StillImage&limit=20').then(function(r){return r.json();}).then(function(payload){
      var row=(payload.results||[]).find(function(record){return record.media&&record.media.some(function(media){return media.identifier&&/^https?:/i.test(media.identifier);});});
      if(!row)throw new Error('no-media');var media=row.media.find(function(m){return m.identifier&&/^https?:/i.test(m.identifier);});
      box.innerHTML='<img src="'+escapeHtml(media.identifier)+'" alt="Foto referensi '+escapeHtml(item.scientific)+'" referrerpolicy="no-referrer"><div class="external-photo-credit"><strong>Foto referensi eksternal · bukan bukti lokasi YG</strong><span>'+escapeHtml(media.creator||row.institutionCode||'Kontributor GBIF')+(media.license?' · '+escapeHtml(media.license):'')+'</span><a href="https://www.gbif.org/occurrence/'+escapeHtml(row.key)+'" target="_blank" rel="noopener">Data dan kredit foto di GBIF ↗</a></div>';
    }).catch(function(){box.innerHTML='<span>'+item.icon+'</span><strong>Foto rujukan belum dapat dimuat</strong><small>Buka tautan GBIF pada bagian referensi untuk meninjau dokumentasi eksternal.</small>';});
  }
  function card(item){
    return '<article class="flora-card"><button type="button" data-flora-id="'+item.id+'" aria-label="Lihat detail '+escapeHtml(item.local)+'">'+
      (item.group==='Flora'?'<div class="flora-image"><img src="'+imagePath(item)+'" alt="Dokumentasi '+escapeHtml(item.local)+'" loading="lazy"><span>'+escapeHtml(item.locations.length===2?'2 lokasi':item.locations[0])+'</span></div>':'<div class="flora-image fauna-image"><img src="'+faunaPhotoPath(item,1)+'" alt="Dokumentasi baseline '+escapeHtml(item.local)+'" loading="lazy"><span>'+escapeHtml(item.locations.length===2?'2 lokasi':item.locations[0])+'</span></div>')+
      '<div class="flora-card-body"><div class="evidence-label">'+escapeHtml(item.evidence)+'</div><h3>'+escapeHtml(item.local)+'</h3><p class="scientific">'+escapeHtml(item.scientific)+'</p><div class="card-meta"><span class="tag">'+escapeHtml(item.group)+'</span><span class="tag">'+escapeHtml(item.category)+'</span></div></div></button></article>';
  }
  function filtered(){
    var term=search.value.trim().toLocaleLowerCase('id');
    return data.filter(function(item){
      return (!term||item.local.toLocaleLowerCase('id').includes(term)||item.scientific.toLocaleLowerCase('id').includes(term))&&
        (ecosystemFilter.value==='all'||item.ecosystem===ecosystemFilter.value)&&
        (groupFilter.value==='all'||item.group===groupFilter.value)&&
        (locationFilter.value==='all'||item.locations.includes(locationFilter.value))&&
        (statusFilter.value==='all'||item.status===statusFilter.value)&&
        (evidenceFilter.value==='all'||item.evidence===evidenceFilter.value);
    });
  }
  function render(){
    var rows=filtered();
    var activeEcosystem=ecosystemFilter.value;
    var ecosystemTotal=data.filter(function(item){return item.ecosystem===activeEcosystem;}).length;
    grid.innerHTML=rows.map(card).join('');
    summary.textContent=rows.length+' dari '+ecosystemTotal+' taksa/jenis '+activeEcosystem.toLowerCase()+' ditampilkan';
    empty.hidden=rows.length>0;
    ecosystemCards.forEach(function(card){var active=card.dataset.ecosystem===activeEcosystem;card.classList.toggle('is-active',active);card.setAttribute('aria-pressed',String(active));});
    catalogEyebrow.textContent='EKOSISTEM '+activeEcosystem.toUpperCase();
    if(activeEcosystem==='Mangrove'){
      catalogTitle.textContent='Flora dan fauna mangrove';
      catalogIntro.textContent='Inventaris baseline YG dari Buruk Bakul dan Kelapa Pati, mencakup mangrove sejati, flora asosiasi, serta fauna dan biota perairan di sekitarnya.';
    }else{
      catalogTitle.textContent='Biodiversitas '+activeEcosystem.toLowerCase();
      catalogIntro.textContent='Ruang inventaris khusus ekosistem '+activeEcosystem.toLowerCase()+'. Data jenis akan ditambahkan setelah observasi lapangan dan validasi teknis.';
    }
    if(rows.length===0){
      var hasEcosystemData=ecosystemTotal>0;
      emptyTitle.textContent=hasEcosystemData?'Tidak ada jenis yang sesuai dengan filter.':'Inventaris '+activeEcosystem.toLowerCase()+' belum tersedia.';
      emptyDescription.textContent=hasEcosystemData?'Atur ulang pencarian, kelompok, lokasi, status, atau sumber bukti untuk melihat data lainnya.':'Data tidak diisi berdasarkan asumsi. Inventaris akan ditambahkan melalui observasi masyarakat, dokumentasi foto/video, dan validasi teknis.';
    }
  }
  function openDetail(item){
    var visual=item.group==='Flora'?galleryHtml(item):faunaGalleryHtml(item);
    dialogContent.innerHTML='<div class="dialog-layout">'+visual+'<div class="dialog-copy">'+
      '<p class="eyebrow">'+escapeHtml(item.ecosystem.toUpperCase()+' • '+item.group.toUpperCase())+'</p><h2>'+escapeHtml(item.local)+'</h2><p class="scientific">'+escapeHtml(item.scientific)+'</p>'+
      '<dl class="dialog-details"><div><dt>Kelompok</dt><dd>'+escapeHtml(item.category)+'</dd></div><div><dt>Status konservasi</dt><dd><span class="tag '+statusClass(item.status)+'">'+escapeHtml(item.status)+'</span></dd></div><div><dt>Lokasi ditemukan</dt><dd>'+escapeHtml(item.locations.join(' dan '))+'</dd></div><div><dt>Bukti</dt><dd>'+escapeHtml(item.evidence)+'</dd></div><div><dt>Sumber</dt><dd>'+escapeHtml(item.source)+'</dd></div></dl>'+
      '<section class="species-profile"><h3>Profil identifikasi dan ekologi</h3><div class="species-profile-grid"><article><span>Ciri identifikasi</span><p>'+escapeHtml(item.identification)+'</p></article><article><span>Habitat dan zonasi</span><p>'+escapeHtml(item.habitat)+'</p></article>'+(item.diet?'<article><span>Pakan</span><p>'+escapeHtml(item.diet)+'</p></article>':'')+(item.behavior?'<article><span>Perilaku</span><p>'+escapeHtml(item.behavior)+'</p></article>':'')+'<article><span>Peran ekologis</span><p>'+escapeHtml(item.ecology)+'</p></article>'+(item.regeneration?'<article><span>Regenerasi / rehabilitasi</span><p>'+escapeHtml(item.regeneration)+'</p></article>':'')+'<article><span>Ancaman utama</span><p>'+escapeHtml(item.threats)+'</p></article></div></section>'+
      (item.note?'<p class="dialog-note"><strong>Catatan data:</strong> '+escapeHtml(item.note)+'</p>':'')+
      '<div class="reference-list"><strong>Referensi pendukung</strong>'+item.references.map(function(ref){return '<a href="'+ref[1]+'" target="_blank" rel="noopener">'+escapeHtml(ref[0])+' ↗</a>';}).join('')+'</div><a class="dialog-source" href="'+SOURCE+'" target="_blank" rel="noopener">Buka laporan baseline →</a></div></div>';
    dialog.showModal();
    if(canUseExternalPhoto(item))loadExternalPhoto(item);
  }
  [search,ecosystemFilter,groupFilter,locationFilter,statusFilter,evidenceFilter].forEach(function(control){control.addEventListener(control===search?'input':'change',render);});
  ecosystemCards.forEach(function(card){card.addEventListener('click',function(){ecosystemFilter.value=card.dataset.ecosystem;search.value='';groupFilter.value='all';locationFilter.value='all';statusFilter.value='all';evidenceFilter.value='all';render();document.getElementById('katalog').scrollIntoView({behavior:'smooth',block:'start'});});});
  grid.addEventListener('click',function(event){var button=event.target.closest('[data-flora-id]');if(!button)return;var item=data.find(function(row){return row.id===Number(button.dataset.floraId)});if(item)openDetail(item);});
  document.getElementById('dialog-close').addEventListener('click',function(){dialog.close();});
  dialog.addEventListener('click',function(event){if(event.target===dialog)dialog.close();});
  dialogContent.addEventListener('click',function(event){
    var faunaThumb=event.target.closest('[data-fauna-gallery-index]');
    if(faunaThumb){var faunaGallery=faunaThumb.closest('.fauna-baseline-gallery');var faunaIndex=Number(faunaThumb.dataset.faunaGalleryIndex);var faunaItem=data.find(function(row){return row.slug===faunaGallery.dataset.faunaGallerySlug;});if(!faunaItem)return;var faunaStage=faunaGallery.querySelector('.dialog-gallery-stage');faunaStage.querySelector('img').src=faunaPhotoPath(faunaItem,faunaIndex);faunaStage.querySelector('img').alt='Dokumentasi baseline '+faunaItem.local+' di '+faunaThumb.dataset.galleryLabel;faunaStage.querySelector('.dialog-gallery-caption strong').textContent=faunaThumb.dataset.galleryLabel;faunaStage.querySelector('.dialog-gallery-caption span').textContent=faunaIndex+' / '+(FAUNA_PHOTO_COUNTS[faunaItem.slug]||1);faunaGallery.querySelectorAll('.dialog-gallery-thumb').forEach(function(button){button.classList.toggle('is-active',button===faunaThumb);});return;}
    var thumb=event.target.closest('[data-gallery-index]');
    if(!thumb)return;
    var gallery=thumb.closest('.dialog-gallery');
    var index=Number(thumb.dataset.galleryIndex);
    var item=data.find(function(row){return row.slug===gallery.dataset.gallerySlug;});
    if(!item)return;
    var stage=gallery.querySelector('.dialog-gallery-stage');
    stage.querySelector('img').src=galleryPath(item,index);
    stage.querySelector('img').alt=thumb.dataset.galleryLabel+' '+item.local;
    stage.querySelector('.dialog-gallery-caption strong').textContent=thumb.dataset.galleryLabel;
    stage.querySelector('.dialog-gallery-caption span').textContent=index+' / '+(GALLERY_COUNTS[item.slug]||1);
    gallery.querySelectorAll('.dialog-gallery-thumb').forEach(function(button){button.classList.toggle('is-active',button===thumb);});
  });
  var requested=new URLSearchParams(location.search).get('location');
  if(requested&&Array.from(locationFilter.options).some(function(option){return option.value===requested;}))locationFilter.value=requested;
  var requestedEcosystem=new URLSearchParams(location.search).get('ecosystem');
  if(requestedEcosystem&&Array.from(ecosystemFilter.options).some(function(option){return option.value===requestedEcosystem;}))ecosystemFilter.value=requestedEcosystem;
  else ecosystemFilter.value='Mangrove';
  document.getElementById('stat-species').textContent=data.length;
  document.getElementById('stat-flora').textContent=floraData.length;
  document.getElementById('stat-fauna').textContent=faunaData.length;
  render();
})();
