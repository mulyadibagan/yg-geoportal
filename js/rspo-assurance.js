/* Editorial learning guide. Evidence examples are not an exhaustive audit checklist. */
(function () {
  'use strict';
  const evidence = {
    '1.1':['Daftar informasi publik, permintaan informasi, tanggapan dan catatan konsultasi.','Bandingkan informasi yang disediakan dengan pengalaman pihak yang meminta informasi.'],
    '1.2':['Kebijakan etika, sosialisasi, laporan pelanggaran dan tindak lanjut.','Telusuri bagaimana kebijakan dipahami dan diterapkan pada transaksi.'],
    '1.3':['Kajian risiko HAM, masukan pihak terdampak dan rencana penanganan.','Uji apakah risiko yang ditemukan ditangani dan hasilnya dipantau.'],
    '2.1':['Dokumen legal, peta batas, daftar kewajiban dan pembaruan peraturan.','Cocokkan cakupan dokumen dengan lokasi dan kegiatan aktual.'],
    '2.2':['Daftar kontraktor, kontrak dan evaluasi kepatuhan.','Periksa penerapan kewajiban kontraktor, bukan hanya bunyi kontraknya.'],
    '2.3':['Identitas pemasok, lokasi kebun asal, legalitas dan catatan penerimaan TBS.','Telusuri sampel pengiriman kembali ke sumber buah.'],
    '2.4':['Kebijakan HAM, komunikasi kepada keamanan, pekerja dan masyarakat.','Konfirmasi apakah pihak terdampak dapat menyampaikan keberatan dengan aman.'],
    '2.5':['Saluran keluhan, catatan penanganan dan komunikasi hasil.','Bandingkan catatan penyelesaian dengan keterangan pengadu secara aman.'],
    '3.1':['Rencana usaha, peremajaan, pembiayaan dan hasil tinjauan manajemen.','Periksa hubungan antara rencana, risiko usaha dan tindakan aktual.'],
    '3.2':['SOP, catatan pelaksanaan dan pemantauan operasi.','Amati pekerjaan dan cocokkan dengan prosedur yang berlaku.'],
    '3.3':['Kajian dampak, konsultasi dan rencana pengelolaan serta pemantauan.','Periksa apakah hasil kajian memengaruhi keputusan dan pelaksanaan kegiatan.'],
    '3.4':['Catatan tanah, hara, pemupukan dan hasil produksi.','Hubungkan keputusan budidaya dengan kondisi kebun dan hasil pemantauan.'],
    '3.5':['Penerimaan TBS, produksi, stok, penjualan dan klaim rantai pasok.','Rekonsiliasi volume dan telusuri transaksi sesuai model rantai pasok.'],
    '4.1':['Catatan sengketa, proses yang disepakati dan perkembangan penyelesaian.','Dengarkan para pihak; penyelesaian sepihak tidak cukup.'],
    '4.2':['Hasil konsultasi kebutuhan desa dan pelaksanaan kontribusi.','Konfirmasi manfaat serta kesepakatan dengan masyarakat.'],
    '4.3':['Riwayat hak, pemetaan partisipatif dan kesepakatan PADIATAPA.','Periksa proses persetujuan dan pemahaman pemegang hak.'],
    '4.4':['Rencana tanam baru, identifikasi pemegang hak dan proses persetujuan.','Bandingkan waktu persetujuan dengan waktu dimulainya kegiatan.'],
    '4.5':['Mandat perwakilan, catatan perundingan dan kesepakatan.','Konfirmasi bahwa perwakilan dipilih oleh pihak yang diwakili.'],
    '4.6':['Dasar kompensasi, penerima, kesepakatan dan bukti pembayaran.','Cocokkan pembayaran dengan kesepakatan serta keterangan pemegang hak.'],
    '4.7':['Bukti penggunaan lahan, peta sengketa dan proses penyelesaiannya.','Periksa klaim yang ada, termasuk pada kebun yang baru diakuisisi.'],
    '5.1':['Kontrak petani, harga, timbang, potongan dan pembayaran.','Telusuri transaksi dan konfirmasi pemahaman petani.'],
    '5.2':['Rencana dukungan, pelatihan dan hasil evaluasi bersama petani.','Konfirmasi kebutuhan, partisipasi dan penerapan hasil pendampingan.'],
    '6.1':['Proses rekrutmen, akses pelatihan dan promosi.','Bandingkan perlakuan antarpekerja tanpa membuka data pribadi kepada publik.'],
    '6.2':['Kontrak, jam kerja, slip upah dan kondisi fasilitas.','Cocokkan catatan dengan keterangan pekerja dan kondisi lapangan.'],
    '6.3':['Perhitungan upah yang berlaku dan rencana penanganan kesenjangan.','Periksa komponen perhitungan serta perkembangan pemenuhan upah layak.'],
    '6.4':['Kebijakan berserikat, catatan perundingan dan tindak lanjut.','Konfirmasi kebebasan memilih perwakilan melalui wawancara pekerja.'],
    '6.5':['Verifikasi usia, jenis pekerjaan dan penanganan kasus anak.','Periksa praktik aktual dan perlindungan pekerja muda.'],
    '6.6':['Kebijakan pencegahan pelecehan, saluran laporan dan penanganan.','Gunakan wawancara yang aman; lindungi kerahasiaan dan pelapor.'],
    '6.7':['Perlindungan hak perempuan dan mekanisme pemulihan.','Konfirmasi akses perlindungan dengan pekerja perempuan secara aman.'],
    '6.8':['Proses rekrutmen, biaya, kontrak dan penguasaan dokumen identitas.','Telusuri kondisi perekrutan dan kebebasan pekerja melalui wawancara.'],
    '6.9':['Penilaian bahaya, pelatihan, perlindungan dan catatan kecelakaan.','Amati pekerjaan, fasilitas dan tindak lanjut insiden.'],
    '7.1':['Pemantauan hama, rencana pengendalian dan penggunaan pestisida.','Cocokkan alasan penggunaan bahan dengan keadaan lapangan.'],
    '7.2':['Aliran limbah, penyimpanan, pemanfaatan dan pembuangan.','Telusuri penanganan bahan sejak dihasilkan sampai tujuan akhirnya.'],
    '7.3':['Peta tanah, kemiringan dan rencana penanaman.','Bandingkan rencana dengan karakter lahan dan konservasi tanah.'],
    '7.4':['Peta gambut, riwayat tanam, pemantauan air dan kajian drainabilitas.','Periksa kondisi gambut serta keputusan pengelolaan dan peremajaan.'],
    '7.5':['Penggunaan air, hasil uji kualitas dan pengelolaan sempadan.','Bandingkan data pemantauan dengan sumber dampak serta kondisi sungai.'],
    '7.6':['Inventaris sumber emisi, perhitungan dan rencana pengurangan.','Uji dasar data dan konsistensi pelaporan emisi.'],
    '7.7':['Riwayat pembukaan, kajian HCV/HCS dan pengelolaan konservasi.','Cocokkan peta, riwayat tutupan lahan dan kondisi lapangan.']
  };
  const ish = [
    ['Produktivitas dan penghidupan', [
      ['1.1','Kemampuan mengelola kebun','Catatan produksi dan penjualan; kemampuan anggota menjelaskan pengelolaan kebunnya.'],
      ['1.2','Praktik pengelolaan yang baik','Kegiatan budidaya, pendampingan dan perubahan praktik di kebun.']]],
    ['Legalitas dan hak atas lahan', [
      ['2.1','Hak penggunaan lahan','Dokumen hak, koordinat dan batas kebun.'],['2.2','Persetujuan dalam perolehan lahan','Riwayat perolehan dan keterangan pemegang hak.'],['2.3','Penyelesaian konflik','Sengketa yang dinyatakan dan proses penanganannya.'],['2.4','Lokasi di luar kawasan terlarang','Lokasi kebun dibandingkan dengan status kawasan.'],['2.5','Persetujuan sebelum tanam baru','Rencana perluasan dan proses persetujuan masyarakat terdampak.']]],
    ['HAM dan kondisi kerja', [
      ['3.1','Pencegahan kerja paksa','Rekrutmen, biaya dan kebebasan pekerja.'],['3.2','Perlindungan anak','Usia, pekerjaan dan akses pendidikan.'],['3.3','Pembayaran upah minimum','Pembayaran, jam kerja dan keterangan pekerja.'],['3.4','Hak dan keluhan pekerja','Pemahaman hak dan akses pengaduan.'],['3.5','Keselamatan kerja','Bahaya pekerjaan, fasilitas dan perlindungan.'],['3.6','Pencegahan diskriminasi dan kekerasan','Perlakuan terhadap pekerja dan penanganan laporan.']]],
    ['Lingkungan dan sumber daya alam', [
      ['4.1','Perlindungan HCV dan HCS','Identifikasi kawasan penting dan pengelolaannya.'],['4.2','Remediasi dan kompensasi','Riwayat perubahan lahan serta rencana pemulihan yang berlaku.'],['4.3','Persyaratan tanam baru','Rencana tanam dan identifikasi risiko lokasi.'],['4.4','Pengelolaan gambut eksisting','Keadaan gambut, air dan pelaksanaan rencana pengelolaan.'],['4.5','Risiko peremajaan di gambut','Kajian banjir dan intrusi air asin sebelum peremajaan.'],['4.6','Pencegahan penggunaan api','Riwayat pembukaan dan praktik pencegahan kebakaran.'],['4.7','Perlindungan sempadan','Lokasi sungai dan pengelolaan sempadan.'],['4.8','Penggunaan pestisida','Jenis bahan, penyimpanan dan perlindungan pengguna.'],['4.9','Pengendalian hama terpadu','Pemantauan hama dan pilihan pengendalian.']]]
  ];
  // Concise learning summaries of the Indonesia NI; not full indicators.
  const stages = {
    '1.1':['Komitmen belajar.','Pelatihan pencatatan.','Kelola; catat produksi/penjualan.'],
    '1.2':['Komitmen budidaya baik.','Pelatihan budidaya.','Terapkan.'],
    '2.1':['Bukti/proses pengakuan hak.','Lanjutkan pembuktian.','Hak/batas terbukti.'],
    '2.2':['Perolehan menghormati PADIATAPA.','Tetap dipenuhi.','Tetap dipenuhi.'],
    '2.3':['Nyatakan sengketa.','Pelatihan konflik.','Kelola konflik.'],
    '2.4':['Di luar kawasan terlarang.','Tetap dipenuhi.','Tetap dipenuhi.'],
    '2.5':['Komitmen PADIATAPA.','Pelatihan.','Laksanakan proses.'],
    '3.1':['Hentikan kerja paksa.','Pelatihan pencegahan.','Tanpa kerja paksa.'],
    '3.2':['Hentikan pekerja anak.','Pelatihan perlindungan.','Perlindungan diterapkan.'],
    '3.3':['Komitmen upah minimum.','Bayar minimum.','Pertahankan.'],
    '3.4':['Komitmen hak pengaduan.','Sosialisasi hak.','Pengaduan dapat diakses.'],
    '3.5':['Kenali risiko.','Pelatihan keselamatan.','Kondisi aman.'],
    '3.6':['Komitmen tanpa kekerasan/diskriminasi.','Pelatihan.','Akses pengaduan.'],
    '4.1':['Komitmen perlindungan.','Pelatihan konservasi.','Lindungi kawasan/spesies.'],
    '4.2':['Riwayat pembukaan.','Rencana pemulihan.','Laksanakan rencana.'],
    '4.3':['Nyatakan rencana.','Rencana pengelolaan partisipatif.','Terapkan sebelum pembukaan.'],
    '4.4':['Nyatakan gambut.','Pelatihan/rencana pengelolaan.','Terapkan/pantau.'],
    '4.5':['Nyatakan rencana peremajaan.','Pelatihan risiko.','Kajian menentukan peremajaan/alternatif.'],
    '4.6':['Komitmen tanpa api.','Tanpa pembakaran; pelatihan.','Pertahankan tanpa api.'],
    '4.7':['Komitmen perlindungan sempadan.','Pelatihan/rencana.','Terapkan rencana.'],
    '4.8':['Hentikan pembelian terlarang.','Pelatihan penggunaan aman.','Terapkan pembatasan.'],
    '4.9':['Komitmen pengendalian terpadu.','Pelatihan.','Terapkan.']
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { evidence, ish, stages };
  if (typeof document === 'undefined') return;
  function el(tag, text, cls) { const node=document.createElement(tag); if(text)node.textContent=text; if(cls)node.className=cls; return node; }
  function paragraph(parent,title,text) { parent.append(el('h4',title),el('p',text)); }
  document.querySelectorAll('.learning-criterion').forEach(detail => {
    const code=detail.id.replace('kriteria-','').replace('-', '.');
    if(!evidence[code])return;
    const box=el('div',null,'assurance-evidence');
    paragraph(box,'Bukti yang dapat diperiksa',evidence[code][0]);
    paragraph(box,'Cara menilai penerapan',evidence[code][1]);
    box.append(el('p','Contoh bukti dan cara verifikasi ini membantu memahami audit; bukan daftar bukti wajib yang lengkap. Auditor mengacu pada indikator, cakupan dan edisi standar yang berlaku.','learning-note'));
    detail.querySelector('.learning-body').prepend(box);
  });
  const ishRoot=document.getElementById('standar-ish');
  if(ishRoot){
    const list=el('section',null,'ish-principles');
    list.append(el('h3','Empat prinsip ISH'),el('p','Pilih prinsip, lalu buka kriteria. Pokok kriteria merujuk Interpretasi Nasional Indonesia ISH 2024. Persyaratan tiap tahap harus dibaca bersama indikator E, MS A, dan MS B dalam standar.'));
    ish.forEach(([title,criteria],i)=>{
      const principle=el('details',null,'assurance-principle'); principle.id='ish-p'+(i+1);
      principle.append(el('summary',`${i+1}. ${title} · ${criteria.length} kriteria`));
      criteria.forEach(([code,name,proof])=>{
        const d=el('details',null,'assurance-criterion');d.id='ish-kriteria-'+code.replace('.','-');d.append(el('summary',`${code} · ${name}`));
        const body=el('div',null,'learning-body');
        paragraph(body,'Fokus pembelajaran',name+'.');
        const table=el('table',null,'ish-stage-table');
        table.append(el('caption','Ringkasan tahapan · '+code));
        const rows=el('tbody');
        ['Eligibility · E','Milestone A · MS A','Milestone B · MS B'].forEach((label,index)=>{
          const row=el('tr');const heading=el('th',label);heading.scope='row';
          row.append(heading,el('td',stages[code][index]));rows.append(row);
        });
        table.append(rows);body.append(table);
        body.append(el('p','Ringkasan singkat, bukan seluruh indikator. Penerapan dan pengecualian mengikuti kondisi kebun serta ketentuan resmi pada tahap yang diaudit.','learning-note'));
        paragraph(body,'Contoh bukti untuk dibahas saat audit',proof);
        paragraph(body,'Cara verifikasi','Auditor membandingkan catatan kelompok, keterangan anggota atau pekerja, dan keadaan kebun pada sampel audit. Bukti dinilai terhadap indikator tahap yang sedang diaudit; tidak semua persyaratan boleh ditunda ke tahap berikutnya.');
        body.append(el('p','Penjelasan bukti adalah panduan pembelajaran, bukan pengganti indikator resmi.','learning-note'));
        d.append(body);principle.append(d);
      });list.append(principle);
    });
    const internal=el('details',null,'assurance-principle');internal.append(el('summary','Pengendalian internal kelompok · ICS'));
    const body=el('div',null,'learning-body');paragraph(body,'Kelompok juga menjadi objek penilaian','Audit ISH tidak hanya memeriksa kebun anggota. Tata kelola kelompok, data anggota, pemeriksaan internal, penanganan ketidaksesuaian dan pencatatan penjualan turut dipelajari. Pengelola kelompok bukan pengganti lembaga sertifikasi independen.');internal.append(body);list.append(internal);
    const ref=el('a','Rujukan resmi: ISH 2024 Indonesia');ref.href='https://rspo.org/wp-content/uploads/2024-RSPO-ISH-Standard-Indonesia-National-Interpretation.pdf';ref.target='_blank';ref.rel='noopener';list.append(ref);
    ishRoot.insertBefore(list,ishRoot.querySelector('details'));
  }
  const cert=document.querySelector('.guide-certification');
  if(cert){
    cert.replaceChildren(el('span','PROSES PENILAIAN','guide-label'),el('h2','Bagaimana lembaga sertifikasi bekerja?'));
    cert.append(el('p','Lembaga sertifikasi menilai pemenuhan standar secara independen. Persiapan atau pendampingan tidak menjamin sertifikat diterbitkan.'));
    const steps=[
      ['Cakupan dan standar','Tetapkan unit atau kelompok yang dinilai, standar, edisi, dan interpretasi nasional yang berlaku.'],
      ['Perencanaan audit','Lembaga sertifikasi menyiapkan tim, cakupan pemeriksaan dan pengumpulan masukan pemangku kepentingan.'],
      ['Pemeriksaan bukti','Dokumen, wawancara dan kunjungan lapangan dibandingkan dengan indikator. Catatan yang lengkap belum membuktikan praktiknya sesuai.'],
      ['Temuan dan perbaikan','Ketidaksesuaian dicatat terhadap persyaratan. Pemohon melakukan perbaikan dan lembaga sertifikasi memverifikasi penyelesaiannya sesuai ketentuan.'],
      ['Tinjauan dan keputusan','Keputusan sertifikasi dilakukan oleh personel yang tidak ikut melaksanakan audit tersebut.'],
      ['Pengawasan','Setelah sertifikat terbit, kepatuhan tetap diperiksa melalui audit pengawasan dan sertifikasi ulang.']
    ];
    const timeline=el('div',null,'assurance-timeline');steps.forEach(([title,desc],i)=>{const d=el('details');d.append(el('summary',`${String(i+1).padStart(2,'0')} · ${title}`),el('p',desc));timeline.append(d);});cert.append(timeline);
    const phased=el('details',null,'assurance-principle');phased.append(el('summary','Jalur ISH: Eligibility → Milestone A → Milestone B'));
    phased.append(el('p','ISH menggunakan tahapan kelayakan dan pencapaian. Auditor memeriksa indikator sesuai tahap serta pengendalian internal kelompok. Tahap awal tidak berarti semua persyaratan hanya berupa janji; beberapa perlindungan sudah harus dipenuhi sejak awal.'));
    cert.append(phased);
    const link=el('a','Rujukan resmi: Sistem Sertifikasi RSPO 2025 v4.0');link.href='https://rspo.org/2025-rspo-certification-systems-for-rspo-principles-and-criteria-and-independent-smallholder-standard-v4-0/';link.target='_blank';link.rel='noopener';cert.append(link);
    cert.id='proses-sertifikasi';
    document.querySelector('main').append(cert);
  }
  const nav=document.querySelector('.standard-nav');
  if(nav && ishRoot){
    const heading=document.getElementById('standar-pnc');
    const layout=document.querySelector('.guide-layout');
    if(!heading || !layout || heading.parentNode!==layout.parentNode)return;
    const company=el('section',null,'standard-panel');company.id='panel-pnc';
    heading.before(company);
    let next=heading;
    while(next){const after=next.nextElementSibling;company.append(next);if(next===layout)break;next=after;}
    ishRoot.classList.add('standard-panel');
    function fold(node,label){
      if(!node)return;
      const wrapper=el('details',null,'guide-fold');
      wrapper.append(el('summary',label));node.before(wrapper);wrapper.append(node);return wrapper;
    }
    fold(company.querySelector('.guide-intro'),'Tiga tema P&C: kemakmuran, manusia, lingkungan');
    fold(company.querySelector('.guide-glossary'),'Istilah penting');
    const scope=fold(document.querySelector('.standard-scope'),'Perbedaan perusahaan, plasma, dan pekebun swadaya');
    if(scope){scope.classList.add('guide-fold-shared');nav.after(scope);}
    const process=fold(cert,'Bagaimana proses audit dan sertifikasi?');
    if(process)process.classList.add('guide-fold-shared');
    nav.setAttribute('role','tablist');
    const panels=[company,ishRoot];
    const labels=[['Perusahaan & Plasma','P&C · 7 prinsip · 38 kriteria'],['Pekebun Swadaya','ISH · 4 prinsip · 22 kriteria']];
    const buttons=labels.map(([title,desc],i)=>{
      const button=el('button',null,'standard-tab');button.type='button';button.id='standard-tab-'+i;
      button.setAttribute('role','tab');button.setAttribute('aria-controls',panels[i].id);
      button.append(el('strong',title),el('span',desc));
      panels[i].setAttribute('role','tabpanel');panels[i].setAttribute('aria-labelledby',button.id);
      return button;
    });
    nav.replaceChildren(...buttons);
    company.querySelectorAll('.guide-principle[open]').forEach(detail=>{detail.open=false;});
    function select(index){
      panels.forEach((panel,i)=>{panel.hidden=i!==index;buttons[i].setAttribute('aria-selected',String(i===index));buttons[i].tabIndex=i===index?0:-1;});
    }
    buttons.forEach((button,i)=>{
      button.addEventListener('click',()=>{select(i);history.replaceState(null,'',i?'#standar-ish':'#standar-pnc');});
      button.addEventListener('keydown',event=>{
        let index;
        if(event.key==='ArrowRight'||event.key==='ArrowLeft')index=1-i;
        if(event.key==='Home')index=0;if(event.key==='End')index=1;
        if(index!==undefined){event.preventDefault();buttons[index].click();buttons[index].focus();}
      });
    });
    function revealHash(){
      const id=location.hash.slice(1);const target=document.getElementById(id);
      select(target && ishRoot.contains(target)?1:0);
      if(target){let parent=target;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}}
    }
    revealHash();window.addEventListener('hashchange',revealHash);
  }
})();
