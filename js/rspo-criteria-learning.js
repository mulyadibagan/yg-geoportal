/* Learning illustrations: hypothetical, not findings about any company. */
(function () {
  'use strict';
  const examples = {
    '1.1': 'Warga meminta informasi dampak kebun terhadap sungai. Pengelola menjelaskan informasi yang dapat dibuka dengan bahasa yang dipahami warga, mencatat permintaan, dan menyampaikan tindak lanjutnya.',
    '1.2': 'Petugas pembelian menerima tawaran hadiah dari pemasok. Ia melaporkannya melalui saluran organisasi dan keputusan pembelian tetap didasarkan pada proses yang dapat dipertanggungjawabkan.',
    '1.3': 'Pengelola menemukan risiko biaya perekrutan yang membebani pekerja pemasok. Risiko dibahas bersama pihak terkait, tindakan perbaikan direncanakan, dan hasilnya dipantau.',
    '2.1': 'Sebelum membuka blok kegiatan, tim mencocokkan dokumen legal dengan batas lapangan dan menindaklanjuti perbedaan yang ditemukan. Satu dokumen izin tidak dianggap menjawab seluruh kewajiban.',
    '2.2': 'Saat memilih kontraktor angkutan, pengelola memeriksa legalitas dan memasukkan kewajiban perlindungan pekerja ke dalam kontrak, lalu memantau pelaksanaannya.',
    '2.3': 'Buah datang melalui pengepul. Pabrik bekerja bersama pengepul untuk menelusuri kebun asal dan kelengkapan informasi legalitas, bukan hanya mencatat nama pengirim truk.',
    '2.4': 'Seorang warga mengadukan dampak operasional. Pengelola memastikan petugas keamanan memahami bahwa pengadu tidak boleh diintimidasi atau menerima tindakan balasan.',
    '2.5': 'Pekerja dapat menyampaikan keluhan melalui saluran yang aman. Identitasnya dilindungi sesuai permintaan, keluhan ditangani secara tidak memihak, dan perkembangan penyelesaian disampaikan.',
    '3.1': 'Pengelola menyusun rencana peremajaan, pembiayaan, dan produksi untuk beberapa tahun. Ketika biaya berubah, rencana ditinjau kembali agar kegiatan tetap layak.',
    '3.2': 'Dua tim panen menggunakan prosedur yang sama. Hasil pemantauan menunjukkan perbedaan kualitas, sehingga penyebabnya dibahas dan pelaksanaan prosedur diperbaiki.',
    '3.3': 'Sebelum pembangunan pabrik, kajian membahas lalu lintas, air, dan dampak sosial bersama masyarakat terdampak. Hasilnya digunakan untuk menyusun pengelolaan dan pemantauan.',
    '3.4': 'Tim kebun mengamati kesuburan tanah dan kondisi tanaman sebelum menentukan pemupukan. Peningkatan hasil dipertimbangkan bersama risiko kehilangan hara dan pencemaran.',
    '3.5': 'Pabrik membandingkan catatan penerimaan buah, produksi, stok, dan penjualan. Klaim produk mengikuti model rantai pasok yang digunakan, bukan sekadar keberadaan sertifikat.',
    '4.1': 'Desa dan pengelola menyepakati cara membahas sengketa akses lahan, waktu pertemuan, dan peran mediator. Para pihak menerima informasi perkembangan penyelesaian.',
    '4.2': 'Warga mengusulkan perbaikan sumber air sebagai prioritas. Program dukungan dibahas melalui konsultasi, bukan ditentukan hanya berdasarkan pilihan pengelola.',
    '4.3': 'Lahan yang direncanakan untuk operasi digunakan masyarakat secara adat. Pemetaan dan pembahasan hak dilakukan bersama, dengan menghormati keputusan masyarakat untuk memberi atau menolak persetujuan.',
    '4.4': 'Rencana penanaman baru dijelaskan sebelum kegiatan dimulai. Masyarakat memiliki waktu bermusyawarah dan memperoleh nasihat independen; daftar hadir tidak dianggap sebagai persetujuan.',
    '4.5': 'Masyarakat memilih sendiri perwakilannya untuk perundingan hak. Kesepakatan, proses negosiasi, dan hal yang belum disepakati dicatat serta dapat dipahami pihak terkait.',
    '4.6': 'Para pemegang hak dan pengelola membahas bentuk serta pembagian kompensasi. Pembayaran dilakukan berdasarkan kesepakatan, bukan dianggap menggantikan kebutuhan persetujuan.',
    '4.7': 'Dua pihak mengajukan klaim atas bagian lahan yang sama. Wilayah sengketa dipetakan secara partisipatif dan bukti hak dibahas melalui proses penyelesaian yang diterima para pihak.',
    '5.1': 'Petani menerima penjelasan harga buah, hasil timbang, potongan, dan jadwal pembayaran. Perbedaan perhitungan dapat ditanyakan melalui saluran yang jelas.',
    '5.2': 'Petani yang berminat mengikuti pendampingan budidaya dan pencatatan kebun. Dukungan disusun sesuai kebutuhan mereka, termasuk informasi lokasi dan legalitas asal buah.',
    '6.1': 'Kesempatan pelatihan diberikan berdasarkan kebutuhan pekerjaan dan kompetensi. Pengelola meninjau apakah kelompok tertentu tersisih dari akses tersebut.',
    '6.2': 'Pekerja menerima penjelasan kontrak sebelum menandatangani. Jam kerja, cuti, pembayaran, dan potongan dijelaskan dalam bahasa yang dipahaminya.',
    '6.3': 'Pengelola menghitung upah yang diterima pekerja dan mengidentifikasi kesenjangan terhadap upah layak. Hasilnya menjadi dasar rencana perbaikan bertahap.',
    '6.4': 'Pekerja memilih perwakilan untuk membahas kondisi kerja. Pertemuan berlangsung tanpa campur tangan dalam pemilihan wakil, dan hasil pembahasan ditindaklanjuti.',
    '6.5': 'Saat perekrutan, usia calon pekerja diverifikasi. Jika ditemukan anak bekerja, penanganannya mempertimbangkan keselamatan dan pendidikan anak, bukan sekadar mengeluarkannya dari lokasi.',
    '6.6': 'Pekerja melaporkan pelecehan oleh atasan. Laporan ditangani secara aman dan adil, dengan perlindungan terhadap pelapor dari tindakan balasan.',
    '6.7': 'Pekerja perempuan menyampaikan kebutuhan terkait kehamilan dan menyusui. Pengelola membahas penyesuaian kerja yang aman serta akses pengaduan dan pemulihan.',
    '6.8': 'Pekerja diminta agen menyerahkan paspor dan membayar biaya perekrutan. Pengelola menelusuri kejadian tersebut dan menyiapkan pemulihan agar pekerja tidak terikat oleh paksaan atau utang.',
    '6.9': 'Tim mengenali bahaya saat penyemprotan, memberi pelatihan, dan menyediakan perlindungan yang sesuai. Kejadian hampir celaka dibahas untuk mencegah kecelakaan berikutnya.',
    '7.1': 'Serangan hama dipantau sebelum menentukan tindakan. Tim mempertimbangkan pengendalian terpadu serta pembatasan bahan kimia, bukan menyemprot rutin tanpa menilai kebutuhan.',
    '7.2': 'Pabrik memisahkan limbah berdasarkan sifatnya, memanfaatkan kembali bahan yang sesuai, dan memastikan sisa yang tidak dapat dimanfaatkan ditangani secara bertanggung jawab.',
    '7.3': 'Survei menemukan lereng curam dan tanah rapuh pada calon lokasi tanam. Tim meninjau kembali rencana blok dan langkah konservasi tanah sebelum mengambil keputusan.',
    '7.4': 'Pada kebun gambut yang sudah ada, tim memantau kondisi air dan risiko penurunan tanah. Rencana peremajaan dikaji bersama kemampuan drainase dan pilihan pemulihan ekosistem.',
    '7.5': 'Warga melaporkan perubahan air sungai. Tim memeriksa penggunaan air dan sumber dampak, meninjau hasil pemantauan, lalu membahas tindakan penanganan.',
    '7.6': 'Pengelola mengidentifikasi sumber emisi dari bahan bakar dan pengolahan limbah. Pilihan pengurangan emisi diprioritaskan dan perkembangannya dicatat.',
    '7.7': 'Sebelum pembukaan lahan, kawasan penting bagi konservasi dan hutan diidentifikasi untuk dilindungi. Persiapan lahan direncanakan tanpa pembakaran.'
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = examples;
  if (typeof document === 'undefined') return;
  const source = document.querySelector('#daftar-kriteria');
  if (!source) return;
  const groups = [...source.querySelectorAll('.criteria-groups > article')];
  if (groups.length !== 7) return;
  // Validate before moving any content; retain the readable fallback on mismatch.
  if (groups.some((group, index) => !document.getElementById('p' + (index + 1)) ||
    [...group.querySelectorAll('li')].some(li => !examples[li.querySelector('b')?.textContent.trim()]))) return;
  groups.forEach((group, index) => {
    const container = document.createElement('section');
    container.className = 'learning-criteria';
    const heading = document.createElement('h3');
    heading.textContent = 'Kriteria Prinsip ' + (index + 1);
    container.append(heading);
    group.querySelectorAll('li').forEach(li => {
      const code = li.querySelector('b').textContent.trim();
      const meaning = li.querySelector('span').textContent.trim();
      const detail = document.createElement('details');
      detail.className = 'learning-criterion';
      detail.id = 'kriteria-' + code.replace('.', '-');
      const summary = document.createElement('summary');
      const badge = document.createElement('b');
      badge.textContent = code;
      const label = document.createElement('span');
      label.textContent = meaning;
      summary.append(badge, label);
      detail.append(summary);
      const body = document.createElement('div');
      body.className = 'learning-body';
      [['Makna kriteria', meaning], ['Ilustrasi penerapan', examples[code]]].forEach(([title, text]) => {
        const h = document.createElement('h4'); h.textContent = title;
        const p = document.createElement('p'); p.textContent = text;
        body.append(h, p);
      });
      detail.append(body);
      container.append(detail);
    });
    const note = document.createElement('p');
    note.className = 'learning-note';
    note.textContent = 'Ilustrasi bersifat hipotetis, bukan temuan pada perusahaan tertentu. Ringkasan ini tidak menggantikan indikator dan ketentuan dalam standar resmi.';
    container.append(note);
    document.getElementById('p' + (index + 1)).append(container);
  });
  source.hidden = true;
  function openTarget() {
    const target = document.getElementById(location.hash.slice(1));
    if (!target) return;
    const principle = target.closest('.guide-principle');
    if (principle) principle.open = true;
    if (target.matches('details')) target.open = true;
  }
  document.querySelectorAll('.guide-nav a').forEach(a => a.addEventListener('click', () => {
    const target = document.getElementById(a.hash.slice(1));
    if (target) target.open = true;
  }));
  window.addEventListener('hashchange', openTarget);
  openTarget();
})();
