(function () {
  'use strict';

  var baselines = {
    snapshotDate: '22 Juli 2026',
    mangrove: { name: 'Restorasi Mangrove', icon: '🌊', value: 13.24, unit: 'ha', field: 'mangroveArea', map: 'webgis.html?layers=area_mangrove,nursery_mangrove,apo' },
    peat: { name: 'Restorasi Gambut', icon: '🌿', value: 13.75, unit: 'ha', field: 'peatArea', map: 'webgis.html?layers=area_kopi,kopi,sekat_kanal,fdrs' },
    mineral: { name: 'Restorasi Lahan Mineral', icon: '🌳', value: 11.44, unit: 'ha', field: 'mineralArea', map: 'webgis.html?layer=community_reports&search=Imbo+Putui' },
    engagement: { name: 'Pelibatan Masyarakat & Kapasitas', icon: '👥', value: 785, unit: 'orang', field: 'participants', map: 'community-engagement.html' }
  };
  var key = new URLSearchParams(location.search).get('programme') || 'mangrove';
  if (!baselines[key]) key = 'mangrove';

  function number(value, digits) {
    return Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  }
  function metric(label, value, unit) {
    return '<article><span>' + label + '</span><strong>' + number(value, unit === 'ha' ? 2 : 0) + (unit ? ' ' + unit : '') + '</strong></article>';
  }
  function readStats() {
    try { return JSON.parse(localStorage.getItem('ygProgrammeDetailStats_v1') || '{}'); } catch (error) { return {}; }
  }

  var cache = readStats();
  var stats = cache.stats || {};
  var item = baselines[key];
  var current = Number(stats[item.field]);
  if (!isFinite(current) || current <= 0) current = item.value;
  current = Math.max(item.value, current);
  var change = item.value > 0 ? ((current - item.value) / item.value) * 100 : 0;
  var changeLabel = Math.abs(change) < .05 ? 'Belum berubah' : (change > 0 ? '+' : '') + number(change, 1) + '%';
  var details = [];
  if (key === 'mangrove') details = [
    metric('Bibit/pohon tertanam', stats.totalPlantedSeedlings),
    metric('Total area restorasi', stats.totalRestorationArea, 'ha')
  ];
  if (key === 'peat') details = [
    metric('Area rewetting estimatif', stats.rewettingArea, 'ha'),
    metric('Sekat kanal', stats.canalBlocks),
    metric('FDRS', stats.fdrsUnits)
  ];
  if (key === 'mineral') details = [
    metric('Luas rehabilitasi', stats.mineralArea || item.value, 'ha')
  ];
  if (key === 'engagement') details = [
    metric('Peserta pelatihan', stats.trainingParticipants),
    metric('Peserta kegiatan lapangan', stats.activityParticipants || stats.plantingParticipants),
    metric('Sesi pelatihan', stats.trainingSessions),
    metric('Responden post-test', stats.postTestRespondents)
  ];

  document.querySelectorAll('[data-programme-tab]').forEach(function (tab) {
    tab.classList.toggle('active', tab.getAttribute('data-programme-tab') === key);
  });
  document.getElementById('detail-updated').textContent = cache.savedAt
    ? 'Data dashboard tersimpan: ' + new Date(cache.savedAt).toLocaleString('id-ID')
    : 'Data terkini belum tersimpan di perangkat ini; nilai baseline ditampilkan.';
  document.getElementById('programme-detail-card').innerHTML =
    '<div class="detail-title"><i>' + item.icon + '</i><h2>' + item.name + '</h2></div>' +
    '<div class="detail-comparison">' +
      '<div class="detail-value"><span>Baseline</span><strong>' + number(item.value, item.unit === 'ha' ? 2 : 0) + ' ' + item.unit + '</strong><small>Snapshot ' + baselines.snapshotDate + '</small></div>' +
      '<div class="detail-arrow">→</div>' +
      '<div class="detail-value current"><span>Data terkini</span><strong>' + number(current, item.unit === 'ha' ? 2 : 0) + ' ' + item.unit + '</strong><small>Data terverifikasi yang telah dimuat</small></div>' +
    '</div>' +
    '<div class="detail-change"><span>Perubahan dari baseline</span><strong class="' + (Math.abs(change) < .05 ? 'neutral' : '') + '">' + changeLabel + '</strong></div>' +
    '<div class="detail-metrics">' + details.join('') + '</div>' +
    '<div class="detail-actions"><a href="' + item.map + '">Buka data sumber</a><a class="secondary" href="index.html">Kembali ke dashboard</a></div>';
})();
