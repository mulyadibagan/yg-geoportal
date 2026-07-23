(function() {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    .sdg-card-contribution ul {
      margin: 8px 0 0;
      padding-left: 19px;
      font-size: 13px;
      line-height: 1.55;
      color: #37474f;
    }
    .sdg-card-contribution li + li {
      margin-top: 6px;
    }
  `;
  document.head.appendChild(style);

  /**
   * Data for Sustainable Development Goals (SDGs) contributions.
   * Each object contains the goal number, title, a brief description of the contribution,
   * and the path to its icon.
   */
  const sdgContributions = [
    {
      goal: 1,
      title: 'Tanpa Kemiskinan',
      contribution: '<ul><li>Peningkatan pendapatan melalui agroforestri kopi Liberika.</li><li>Pengembangan mata pencaharian alternatif berbasis sumber daya lokal.</li><li>Menciptakan lapangan kerja hijau (restorasi, pembibitan, pemantauan).</li></ul>',
      icon: 'assets/sdg-icons/sdg-1.png'
    },
    {
      goal: 2,
      title: 'Tanpa Kelaparan',
      contribution: '<ul><li>Mendukung ketahanan pangan melalui kebun kopi dan tanaman tumpang sari.</li><li>Pelatihan pertanian berkelanjutan tanpa bakar.</li><li>Diversifikasi sumber pangan dan gizi keluarga.</li></ul>',
      icon: 'assets/sdg-icons/sdg-2.png'
    },
    {
      goal: 5,
      title: 'Kesetaraan Gender',
      contribution: '<ul><li>Mendorong partisipasi perempuan dalam pengambilan keputusan di tingkat desa.</li><li>Mendukung kewirausahaan perempuan melalui kelompok tani kopi Liberika.</li><li>Memastikan keterlibatan perempuan dalam semua sesi pelatihan dan kegiatan.</li></ul>',
      icon: 'https://www.un.org/sustainabledevelopment/wp-content/uploads/sites/3/2016/01/S_SDG_Icons-01-05.jpg'
    },
    {
      goal: 6,
      title: 'Air Bersih dan Sanitasi Layak',
      contribution: '<ul><li>Menjaga kualitas air melalui restorasi ekosistem gambut.</li><li>Membangun sekat kanal untuk menaikkan muka air tanah.</li><li>Pemasangan unit FDRS untuk pemantauan tinggi muka air.</li></ul>',
      icon: 'assets/sdg-icons/sdg-6.png'
    },
    {
      goal: 8,
      title: 'Pekerjaan Layak dan Pertumbuhan Ekonomi',
      contribution: '<ul><li>Menciptakan green jobs di tingkat desa (pembibitan, penanaman, pemantauan).</li><li>Mendukung wirausaha perempuan melalui kelompok tani kopi.</li><li>Membangun kemitraan pasar untuk produk kopi Liberika.</li></ul>',
      icon: 'assets/sdg-icons/sdg-8.png'
    },
    {
      goal: 11,
      title: 'Kota dan Permukiman Berkelanjutan',
      contribution: '<ul><li>Pembangunan hybrid engineering (APO) untuk melindungi garis pantai dan permukiman.</li><li>Pemasangan sistem peringatan dini kebakaran (FDRS).</li><li>Peningkatan kapasitas masyarakat dalam pencegahan kebakaran lahan.</li></ul>',
      icon: 'assets/sdg-icons/sdg-11.png'
    },
    {
      goal: 13,
      title: 'Penanganan Perubahan Iklim',
      contribution: '<ul><li>Menyerap dan menyimpan karbon melalui restorasi hutan mangrove.</li><li>Mengurangi emisi gas rumah kaca dengan mencegah dekomposisi gambut melalui pembasahan kembali (rewetting).</li><li>Mempromosikan pertanian tanpa bakar.</li></ul>',
      icon: 'assets/sdg-icons/sdg-13.png'
    },
    {
      goal: 14,
      title: 'Ekosistem Lautan',
      contribution: '<ul><li>Restorasi habitat pesisir melalui penanaman mangrove.</li><li>Melindungi biodiversitas laut dengan mengurangi abrasi melalui APO.</li><li>Peningkatan kesadaran masyarakat tentang pentingnya ekosistem mangrove.</li></ul>',
      icon: 'assets/sdg-icons/sdg-14.png'
    },
    {
      goal: 15,
      title: 'Ekosistem Daratan',
      contribution: '<ul><li>Restorasi ekosistem gambut hidrologis melalui pembangunan sekat kanal.</li><li>Rehabilitasi lahan dengan penanaman pohon hutan dan MPTS.</li><li>Perlindungan keanekaragaman hayati di Hutan Adat Imbo Putui.</li></ul>',
      icon: 'assets/sdg-icons/sdg-15.png'
    },
    {
      goal: 17,
      title: 'Kemitraan untuk Mencapai Tujuan',
      contribution: '<ul><li>Kemitraan dengan donor internasional (Aramco, PPCF, GEC).</li><li>Kolaborasi dengan pemerintah daerah (kabupaten dan desa).</li><li>Pemberdayaan kelompok masyarakat dan lembaga adat lokal.</li></ul>',
      icon: 'assets/sdg-icons/sdg-17.png'
    }
  ];

  function formatNumber(value, digits = 0) {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits })
      .format(Number(value || 0));
  }

  function showSdgModal(sdg) {
    const modalContainer = document.getElementById('sdg-modal-container');
    if (!modalContainer || !sdg) return;

    const modalHtml = `
      <div class="sdg-modal" role="dialog" aria-modal="true" aria-labelledby="sdg-modal-title">
        <div class="sdg-modal-overlay"></div>
        <div class="sdg-modal-content">
          <button class="sdg-modal-close" aria-label="Tutup">×</button>
          <div class="sdg-modal-header">
            <img src="${sdg.icon}" alt="" loading="lazy" decoding="async">
            <h3 id="sdg-modal-title"><span class="sdg-number">SDG ${sdg.goal}</span>${sdg.title}</h3>
          </div>
          <div class="sdg-modal-body">
            ${sdg.contribution}
          </div>
        </div>
      </div>
    `;
    modalContainer.innerHTML = modalHtml;
    document.body.classList.add('sdg-modal-open');

    const close = () => {
      modalContainer.innerHTML = '';
      document.body.classList.remove('sdg-modal-open');
    };

    modalContainer.querySelector('.sdg-modal-close').addEventListener('click', close);
    modalContainer.querySelector('.sdg-modal-overlay').addEventListener('click', close);
    document.addEventListener('keydown', function onKeydown(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onKeydown);
      }
    });
  }

  /**
   * Renders the SDG contribution cards into the specified container.
   * @param {string} containerId - The ID of the HTML element to render the cards in.
   */
  function renderSdgDashboard(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`Element with ID "${containerId}" not found for SDG dashboard.`);
      return;
    }

    const stats = window.YG_DASHBOARD_STATS;
    if (stats) {
      const sdg6 = sdgContributions.find(s => s.goal === 6);
      if (sdg6) {
        sdg6.contribution = `<ul><li>Menjaga kualitas air melalui restorasi ekosistem gambut.</li><li>Membangun sekat kanal untuk menaikkan muka air tanah (estimasi <strong>${formatNumber(stats.rewettingArea, 0)} ha</strong> area terbasahkan).</li><li>Pemasangan unit FDRS untuk pemantauan tinggi muka air.</li></ul>`;
      }
      const sdg13 = sdgContributions.find(s => s.goal === 13);
      if (sdg13) {
        sdg13.contribution = `<ul><li>Menyerap dan menyimpan karbon melalui restorasi <strong>${formatNumber(stats.totalRestorationArea, 2)} ha</strong> lahan.</li><li>Mengurangi emisi dengan mencegah dekomposisi gambut melalui pembasahan kembali (estimasi <strong>${formatNumber(stats.rewettingArea, 0)} ha</strong>).</li><li>Mempromosikan pertanian tanpa bakar.</li></ul>`;
      }
      const sdg15 = sdgContributions.find(s => s.goal === 15);
      if (sdg15) {
        sdg15.contribution = `<ul><li>Restorasi ekosistem gambut dan mangrove seluas <strong>${formatNumber(stats.totalRestorationArea, 2)} ha</strong>.</li><li>Rehabilitasi lahan dengan menanam <strong>${formatNumber(stats.totalPlantedSeedlings)} bibit</strong> pohon.</li><li>Perlindungan keanekaragaman hayati di Hutan Adat Imbo Putui.</li></ul>`;
      }
    }

    const cardsHtml = sdgContributions.map(item => `
      <button type="button" class="sdg-card" data-sdg-goal="${item.goal}">
        <div class="sdg-card-icon" aria-hidden="true">
          <img src="${item.icon}" alt="" loading="lazy" decoding="async">
        </div>
        <div class="sdg-card-content">
          <h4 class="sdg-card-title"><span class="sdg-number">SDG ${item.goal}</span>${item.title}</h4>
        </div>
      </button>
    `).join('');

    container.innerHTML = `<div class="sdg-grid">${cardsHtml}</div><div id="sdg-modal-container"></div>`;

    container.addEventListener('click', function(event) {
      const card = event.target.closest('[data-sdg-goal]');
      if (card) {
        const goal = parseInt(card.dataset.sdgGoal, 10);
        const sdg = sdgContributions.find(s => s.goal === goal);
        showSdgModal(sdg);
      }
    });

    if (window.YG_I18N && typeof window.YG_I18N.translateElement === 'function') {
      window.YG_I18N.translateElement(container);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Give dashboard-v3.js a moment to calculate and expose the stats
    setTimeout(() => renderSdgDashboard('sdg-dashboard-container'), 200);
  });
})();