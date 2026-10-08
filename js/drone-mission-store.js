(function (root) {
  'use strict';
  const KEY = 'ygDroneMissions';
  function read(storage) {
    try {
      const plans = JSON.parse(storage.getItem(KEY) || '[]');
      return Array.isArray(plans) ? plans.filter(plan => plan && plan.id && plan.options && (plan.targetGeometry || plan.geometry)) : [];
    } catch (_) { return []; }
  }
  function save(storage, mission) {
    const { footprints, ...compact } = mission;
    const plans = [compact, ...read(storage).filter(plan => plan.id !== mission.id)].slice(0, 3);
    let retained = plans;
    try { storage.setItem(KEY, JSON.stringify(plans)); }
    catch (_) {
      retained = [compact];
      try { storage.setItem(KEY, JSON.stringify(retained)); }
      catch (_) { return { saved: false, warning: 'Penyimpanan perangkat penuh. Ekspor rencana sebelum menutup halaman.' }; }
    }
    // The legacy archive only needs a summary, not a second copy of all photo positions.
    try {
      storage.setItem('ygDroneLastMission', JSON.stringify({ id: mission.id, area: mission.area, drone: mission.drone, altitude: mission.altitude, lines: mission.lines.length, createdAt: mission.createdAt }));
    } catch (_) {}
    return { saved: true, retained: retained.length, warning: retained.length < plans.length ? 'Penyimpanan terbatas; hanya rencana terbaru disimpan.' : '' };
  }
  const api = { read, save };
  if (typeof module !== 'undefined') module.exports = api;
  root.YGDronePlans = api;
})(typeof window === 'undefined' ? globalThis : window);
