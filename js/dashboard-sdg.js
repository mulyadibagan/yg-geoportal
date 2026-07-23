(function() {
  'use strict';
  window.YG_CLIMATE_DASHBOARD_READY = true;

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

  function isEnglish() {
    return window.YG_I18N && window.YG_I18N.language === 'en';
  }

  function formatNumber(value, digits = 0) {
    return new Intl.NumberFormat(isEnglish() ? 'en-US' : 'id-ID', { maximumFractionDigits: digits })
      .format(Number(value || 0));
  }

  function renderClimateImpactDashboard(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const stats = window.YG_DASHBOARD_STATS || {};
    const english = isEnglish();
    const cards = Array.from(document.querySelectorAll('#category-grid .programme-card'));

    function parseMetricNumber(value) {
      const raw = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
      if (!raw) return 0;
      const normalized = raw
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^0-9.-]/g, '');
      const number = Number(normalized);
      return Number.isFinite(number) ? number : 0;
    }

    function readCardMetric(cardIndex, labelText) {
      const card = cards[cardIndex];
      if (!card) return 0;
      const items = Array.from(card.querySelectorAll('li'));
      const match = items.find(item => item.textContent.toLowerCase().includes(labelText.toLowerCase()));
      if (!match) return 0;
      const strong = match.querySelector('strong');
      return parseMetricNumber(strong ? strong.textContent : match.textContent);
    }

    function readTextMetric(selector) {
      const element = document.querySelector(selector);
      return element ? parseMetricNumber(element.textContent) : 0;
    }

    const mangroveArea = Number(stats.mangroveArea || readCardMetric(0, english ? 'Restoration Area' : 'Luas Restorasi'));
    const peatArea = Number(stats.peatArea || readCardMetric(1, english ? 'Peatland / Agroforestry Area' : 'Luas Gambut / Agroforestri'));
    const mineralArea = Number(stats.mineralArea || readCardMetric(2, english ? 'Restoration Area' : 'Luas Restorasi'));
    const rewettingArea = Number(stats.rewettingArea || readCardMetric(1, english ? 'Estimated Rewetting Area' : 'Estimasi Area Rewetting') || 550);
    const methodology = english ? 'IPCC 2006 Guidelines + 2013 Wetlands Supplement (conservative proxy)' : 'IPCC 2006 Guidelines + 2013 Wetlands Supplement (proxy konservatif)';

    // Koefisien proxy konservatif untuk visualisasi kebijakan.
    // Jika tersedia faktor emisi resmi per lokasi, nilai ini dapat diganti.
    const factors = {
      mangroveAbsorption: 31.6,
      peatAbsorption: 20.0,
      mineralAbsorption: 5.0,
      rewettingReduction: 35.0
    };

    const absorptionEstimate = (mangroveArea * factors.mangroveAbsorption) +
      (peatArea * factors.peatAbsorption) +
      (mineralArea * factors.mineralAbsorption);
    const reductionEstimate = rewettingArea * factors.rewettingReduction;
    const totalEstimate = absorptionEstimate + reductionEstimate || 1;
    const absorptionShare = Math.round((absorptionEstimate / totalEstimate) * 100);
    const reductionShare = 100 - absorptionShare;

    const directSources = [
      {
        label: english ? 'Mangrove restoration area' : 'Area restorasi mangrove',
        value: mangroveArea,
        unit: "ha",
        note: english ? 'Direct activity input for removals' : 'Input aktivitas langsung untuk penyerapan',
        hint: english ? 'Polygon area plus coffee planting points converted at 3 × 3 m spacing' : 'Luas poligon ditambah titik tanam kopi dengan jarak 3 × 3 m',
        group: "penyerapan"
      },
      {
        label: english ? 'Peatland / agroforestry restoration' : 'Restorasi gambut / agroforestri',
        value: peatArea,
        unit: "ha",
        note: english ? 'Direct activity input for removals' : 'Input aktivitas langsung untuk penyerapan',
        hint: english ? 'Land area used in removals proxy' : 'Luas lahan untuk proxy penyerapan',
        group: "penyerapan"
      },
      {
        label: english ? 'Mineral land rehabilitation' : 'Rehabilitasi lahan mineral',
        value: mineralArea,
        unit: "ha",
        note: english ? 'Direct activity input for removals' : 'Input aktivitas langsung untuk penyerapan',
        hint: english ? 'Land area used in removals proxy' : 'Luas lahan untuk proxy penyerapan',
        group: "penyerapan"
      },
      {
        label: english ? 'Measured rewetting area' : 'Area rewetting terukur',
        value: rewettingArea,
        unit: "ha",
        note: english ? 'Consolidated outcome of canal-block interventions' : 'Hasil terkonsolidasi dari intervensi sekat kanal',
        hint: english ? 'Canal blocks and FDRS are not credited separately' : 'Sekat kanal dan FDRS tidak dikreditkan terpisah',
        group: "pengurangan"
      }
    ];

    const supportingSources = english
      ? [
          'Seedlings planted',
          'Field monitoring',
          'Community training',
          'Documentation',
          'Publications'
        ]
      : [
          'bibit tertanam',
          'monitoring lapangan',
          'pelatihan masyarakat',
          'dokumentasi kegiatan',
          'publikasi program'
        ];

    const renderRows = group => directSources
      .filter(item => item.group === group)
      .map(item => `
        <div class="climate-source-row">
          <div class="climate-source-label">
            <strong title="${item.hint}">${item.label}</strong>
            <small>${item.note}</small>
          </div>
          <div class="climate-source-value">${formatNumber(item.value, item.unit === 'ha' ? 2 : 0)} ${item.unit}</div>
        </div>
      `).join('');

    container.innerHTML = `
      <div class="climate-grid">
        <article class="climate-card climate-card-absorb">
          <div class="climate-card-head">
            <span>${english ? 'Gross removals / Carbon removals' : 'Penyerapan bruto / Gross removals'}</span>
            <strong title="${english ? 'Annual proxy estimate' : 'Estimasi proksi tahunan'}">${formatNumber(absorptionEstimate, 1)} tCO2e/yr*</strong>
          </div>
          <div class="climate-bar"><span style="width:${absorptionShare}%"></span></div>
          <p class="climate-card-caption">${english ? 'Conservative proxy estimate using international land-sector reporting guidance for mangrove restoration, peatland/agroforestry restoration, and mineral land rehabilitation.' : 'Estimasi proksi konservatif menggunakan panduan pelaporan sektor lahan internasional untuk restorasi mangrove, restorasi gambut/agroforestri, dan rehabilitasi lahan mineral.'}</p>
          <div class="climate-source-list">${renderRows('penyerapan')}</div>
        </article>
        <article class="climate-card climate-card-reduce">
          <div class="climate-card-head">
            <span>${english ? 'Avoided emissions / Emission reductions' : 'Emisi terhindar / Avoided emissions'}</span>
            <strong title="${english ? 'Annual proxy estimate' : 'Estimasi proksi tahunan'}">${formatNumber(reductionEstimate, 1)} tCO2e/yr*</strong>
          </div>
          <div class="climate-bar"><span style="width:${reductionShare}%"></span></div>
          <p class="climate-card-caption">${english ? 'Proxy estimate based only on measured rewetting area. The 550 ha outcome already represents canal-block interventions; canal blocks and FDRS receive no separate carbon credit.' : 'Estimasi proksi hanya berdasarkan luas rewetting terukur. Capaian 550 ha sudah mewakili intervensi sekat kanal; sekat kanal dan FDRS tidak memperoleh kredit karbon terpisah.'}</p>
          <div class="climate-source-list">${renderRows('pengurangan')}</div>
        </article>
      </div>
      <div class="climate-footnote"><strong>${english ? 'Methodology:' : 'Metodologi:'}</strong> ${methodology}. ${english ? 'Data contributors:' : 'Kontributor data:'} ${supportingSources.join(', ')}. ${english ? 'Replace the proxy coefficients with site-specific emission factors if/when those become available.' : 'Ganti koefisien proksi dengan faktor emisi spesifik lokasi jika/ketika tersedia.'}</div>
    `;
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

    const renderClimateWhenReady = (attempt = 0) => {
      const stats = window.YG_DASHBOARD_STATS || {};
      const cardsReady = document.querySelectorAll('#category-grid .programme-card li strong').length > 0;
      const statsReady = Object.prototype.hasOwnProperty.call(stats, 'mangroveArea') || cardsReady;
      if (!cardsReady && !statsReady && attempt < 30) {
        setTimeout(() => renderClimateWhenReady(attempt + 1), 150);
        return;
      }
      renderClimateImpactDashboard('climate-dashboard-container');
    };

    renderClimateWhenReady();
    window.addEventListener('yg:languagechange', () => renderClimateWhenReady());
  });

  window.addEventListener('yg:dashboardstatsready', () => {
    renderClimateImpactDashboard('climate-dashboard-container');
  });
})();
