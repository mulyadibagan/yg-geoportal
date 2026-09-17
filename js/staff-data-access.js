(function () {
  'use strict';
  const base = 'https://yg-webgis-public-data.yg-webgis-public-data-worker.workers.dev';
  const routes = {
    'data/rspo-company-boundaries.geojson': '/api/staff/rspo-companies',
    'data/PBPH_RIAU_052026.geojson': '/api/staff/pbph-riau',
    'data/PERHUTANAN_SOSIAL_RIAU.geojson': '/api/staff/social-forestry-riau',
    'data/faperta-ur.json': '/api/staff/faperta-ur-data',
    'data/faperta-ur-site.geojson': '/api/staff/faperta-ur-site',
    'data/pbph-documents.json': '/api/staff/pbph-documents',
    'data/fire-monthly/index.json': '/api/staff/fire-monthly-index',
    'data/phl-svlk-monthly/index.json': '/api/staff/phl-svlk-monthly-index',
    'data/PERUSAHAAN_SAWIT_RIAU_REFERENSI.geojson': '/api/staff/rspo-groups'
  };
  const STAFF_ONLY_PUBLIC_PATHS = new Set([
    '/data/rspo-company-boundaries.geojson',
    '/data/PERUSAHAAN_SAWIT_RIAU_REFERENSI.geojson'
  ]);
  const session = () => window.YG_AUTH && window.YG_AUTH.readStoredSession();
  let geometry;
  function route(url) {
    const parsed = new URL(url, location.href);
    if (parsed.origin !== location.origin) return null;
    const path = parsed.pathname.replace(/^\//, '');
    if (routes[path]) return routes[path];
    const match = path.match(/^data\/(fire-monthly|phl-svlk-monthly)\/(20\d{2}-(?:0[1-9]|1[0-2]))\.json$/);
    return match ? '/api/staff/' + match[1] + '-report?month=' + match[2] : null;
  }
  async function privateFetch(url) {
    const target = route(url), current = session();
    if (!target || !current) throw Error('Login staf diperlukan untuk data internal.');
    const response = await window.fetch(base + target, {
      headers: { authorization: 'Bearer ' + current.token }, cache: 'no-store'
    });
    if (!response.ok) throw Error(response.status === 401 ? 'Sesi staf tidak valid. Silakan login kembali.' : 'Data internal belum dapat dimuat (' + response.status + ').');
    return response;
  }
  async function pbph() {
    if (!geometry) geometry = privateFetch('data/PBPH_RIAU_052026.geojson').then(r => r.json()).catch(e => { geometry = null; throw e; });
    const data = await geometry;
    const count = document.getElementById('kpi-hotspots-iuphhk');
    if (count) {
      const card = count.closest('article'); card.hidden = false; card.removeAttribute('aria-hidden');
      if (!card.querySelector('a')) { const link = document.createElement('a'); link.href = 'hotspot-analysis.html?scope=pbph'; link.textContent = 'Hotspot PBPH · analisis internal →'; card.prepend(link); }
      const list = document.getElementById('iuphhk-source-list');
      if (list) { list.parentElement.hidden = false; list.parentElement.removeAttribute('aria-hidden'); }
    }
    return data;
  }
  function ringContains(p, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  async function enrich(data) {
    for (const feature of data.features || []) if (feature.properties) delete feature.properties.pbph052026;
    if (!session()) return data;
    const geo = await pbph();
    const polygons = (geo.features || []).flatMap(f => {
      const g = f.geometry, p = f.properties || {};
      return (g && g.type === 'MultiPolygon' ? g.coordinates : g && g.type === 'Polygon' ? [g.coordinates] : []).map(rings => {
        const outer = rings[0];
        return { rings, p, minX: Math.min(...outer.map(x => x[0])), maxX: Math.max(...outer.map(x => x[0])), minY: Math.min(...outer.map(x => x[1])), maxY: Math.max(...outer.map(x => x[1])) };
      });
    });
    for (const f of data.features || []) {
      if (!f.geometry || f.geometry.type !== 'Point') continue;
      const point = f.geometry.coordinates, matches = new Map();
      for (const row of polygons) {
        if (point[0] < row.minX || point[0] > row.maxX || point[1] < row.minY || point[1] > row.maxY) continue;
        if (ringContains(point, row.rings[0]) && !row.rings.slice(1).some(r => ringContains(point, r))) {
          const p = row.p; matches.set(p.PBPH_ID || p.NAMOBJ + '|' + p.NO_SK, { name: p.NAMOBJ, sk: p.NO_SK, areaHa: p.LSSK });
        }
      }
      f.properties ||= {};
      f.properties.pbph052026 = Array.from(matches.values());
    }
    return data;
  }
  async function fetchData(url, options) {
    const parsed = new URL(url, location.href);
    if (STAFF_ONLY_PUBLIC_PATHS.has(parsed.pathname) && !session()) {
      return new Response(JSON.stringify({ error: 'staff_login_required' }), {
        status: 403,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
      });
    }
    if (route(url) && session()) return privateFetch(url);
    const response = await window.fetch(url, options);
    if (parsed.pathname === '/data/hotspot-high-confidence.geojson' && response.ok) {
      return new Response(JSON.stringify(await enrich(await response.json())), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }
    return response;
  }
  window.YG_STAFF_DATA = { session, fetch: fetchData, privateFetch, pbph };
})();

