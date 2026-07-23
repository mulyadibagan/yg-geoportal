(function() {
  'use strict';

  /**
   * Data for Sustainable Development Goals (SDGs) contributions.
   * Each object contains the goal number, title, a brief description of the contribution,
   * and the path to its icon.
   */
  const sdgContributions = [
    {
      goal: 1,
      title: 'Tanpa Kemiskinan',
      contribution: 'Program peningkatan mata pencaharian berkelanjutan dan agroforestri kopi liberika untuk meningkatkan pendapatan masyarakat.',
      icon: 'assets/sdg-icons/sdg-1.png'
    },
    {
      goal: 2,
      title: 'Tanpa Kelaparan',
      contribution: 'Agroforestri dan kebun kopi mendukung ketahanan pangan lokal dan diversifikasi sumber makanan.',
      icon: 'assets/sdg-icons/sdg-2.png'
    },
    {
      goal: 6,
      title: 'Air Bersih dan Sanitasi Layak',
      contribution: 'Restorasi gambut dan pembangunan sekat kanal menjaga kualitas dan ketersediaan air bersih.',
      icon: 'assets/sdg-icons/sdg-6.png'
    },
    {
      goal: 8,
      title: 'Pekerjaan Layak dan Pertumbuhan Ekonomi',
      contribution: 'Menciptakan lapangan kerja hijau melalui kegiatan restorasi, pembibitan, dan pemantauan.',
      icon: 'assets/sdg-icons/sdg-8.png'
    },
    {
      goal: 11,
      title: 'Kota dan Permukiman Berkelanjutan',
      contribution: 'Infrastruktur pencegahan kebakaran dan abrasi (APO) melindungi permukiman pesisir dan desa.',
      icon: 'assets/sdg-icons/sdg-11.png'
    },
    {
      goal: 13,
      title: 'Penanganan Perubahan Iklim',
      contribution: 'Restorasi gambut dan mangrove menyerap karbon dalam jumlah besar dan mengurangi emisi gas rumah kaca.',
      icon: 'assets/sdg-icons/sdg-13.png'
    },
    {
      goal: 14,
      title: 'Ekosistem Lautan',
      contribution: 'Restorasi mangrove dan pembangunan APO melindungi garis pantai dan keanekaragaman hayati laut.',
      icon: 'assets/sdg-icons/sdg-14.png'
    },
    {
      goal: 15,
      title: 'Ekosistem Daratan',
      contribution: 'Restorasi hutan dan lahan gambut, serta perlindungan biodiversitas di area program.',
      icon: 'assets/sdg-icons/sdg-15.png'
    },
    {
      goal: 17,
      title: 'Kemitraan untuk Mencapai Tujuan',
      contribution: 'Berkolaborasi dengan mitra pendanaan, pemerintah, dan masyarakat untuk mencapai tujuan bersama.',
      icon: 'assets/sdg-icons/sdg-17.png'
    }
  ];

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

    const cardsHtml = sdgContributions.map(item => `
      <div class="sdg-card">
        <div class="sdg-card-icon" aria-hidden="true">
          <img src="${item.icon}" alt="" loading="lazy" decoding="async">
        </div>
        <div class="sdg-card-content">
          <h4 class="sdg-card-title"><span class="sdg-number">SDG ${item.goal}</span>${item.title}</h4>
          <p class="sdg-card-contribution">${item.contribution}</p>
        </div>
      </div>
    `).join('');

    container.innerHTML = `<div class="sdg-grid">${cardsHtml}</div>`;
  }

  document.addEventListener('DOMContentLoaded', () => renderSdgDashboard('sdg-dashboard-container'));
})();