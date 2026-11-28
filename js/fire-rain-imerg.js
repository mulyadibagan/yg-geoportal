(function () {
  'use strict';

  const base = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/all/IMERG_Precipitation_Rate_30min_v7_NRT/default/';
  const coverage = 'https://tilecache.rainviewer.com/v2/coverage/0/256/';
  const halfHour = 1800000;
  const maxAge = 12 * 3600000;
  const format = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short'
  });

  function tileUrl(frame, { x, y, z }) {
    return base + new Date(frame).toISOString().replace('.000', '') +
      '/GoogleMapsCompatible_Level6/' + z + '/' + y + '/' + x + '.png';
  }

  function image(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => reject(Error('Waktu muat tile habis')), 8000);
      img.crossOrigin = 'anonymous';
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); reject(Error('Tile tidak tersedia')); };
      img.src = url;
    });
  }

  async function latestFrame(cancelled) {
    const now = Date.now();
    const start = Math.floor((now - 3 * 3600000) / halfHour) * halfHour;
    for (let time = start; now - time <= maxAge && !cancelled(); time -= 4 * halfHour) {
      const candidates = [0, 1, 2, 3].map(offset => time - offset * halfHour)
        .filter(frame => now - frame <= maxAge);
      const available = await Promise.all(candidates.map(frame =>
        image(tileUrl(frame, {x: 0, y: 0, z: 0})).then(() => frame, () => null)
      ));
      const newest = available.find(Boolean);
      if (newest) return newest;
    }
    throw Error('Frame IMERG tidak tersedia');
  }

  window.createFireRainImerg = function (map) {
    const note = document.getElementById('rain-imerg-status');
    let revision = 0;
    let layer = null;
    let frame = null;
    let masked = true;
    let refreshTimer = null;

    const Tiles = L.GridLayer.extend({
      createTile(coords, done) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const maskUrl = coverage + coords.z + '/' + coords.x + '/' + coords.y + '/0/0_0.png';
        const mask = masked ? image(maskUrl) : Promise.resolve(null);
        Promise.all([image(tileUrl(frame, coords)), mask]).then(([rain, radarMask]) => {
          ctx.drawImage(rain, 0, 0, 256, 256);
          if (radarMask) {
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(radarMask, 0, 0, 256, 256);
          }
          done(null, canvas);
        }).catch(error => done(error, canvas));
        return canvas;
      }
    });

    function clear() {
      revision++;
      clearTimeout(refreshTimer);
      if (layer) map.removeLayer(layer);
      layer = null;
      frame = null;
      note.hidden = true;
    }

    const pane = map.createPane('imergRainPane');
    pane.style.zIndex = 409;
    pane.style.pointerEvents = 'none';

    async function show(useMask) {
      const changed = masked !== useMask;
      masked = useMask;
      if (layer && changed) layer.redraw();
      const id = ++revision;
      clearTimeout(refreshTimer);
      note.hidden = false;
      if (!layer) note.textContent = 'Memuat estimasi hujan satelit NASA IMERG…';
      try {
        const next = await latestFrame(() => id !== revision);
        if (id !== revision) return;
        const timestamp = format.format(new Date(next)) + ' WIB';
        const description = 'Estimasi hujan satelit NASA IMERG (mm/jam) · ' + timestamp +
          (masked ? ' · hanya di luar cakupan radar.' : ' · radar tidak tersedia.');
        note.textContent = description;
        if (!layer || frame !== next) {
          if (layer) map.removeLayer(layer);
          frame = next;
          layer = new Tiles({
            pane: 'imergRainPane', opacity: 0.72, maxNativeZoom: 6, maxZoom: 18,
            noWrap: true, updateWhenIdle: true, keepBuffer: 1,
            attribution: '<a href="https://gpm.nasa.gov/data/imerg">NASA GPM IMERG Early</a> · mm/jam'
          }).addTo(map);
        }
      } catch (error) {
        if (id !== revision) return;
        if (!frame || Date.now() - frame > maxAge) {
          if (layer) map.removeLayer(layer);
          layer = null;
          frame = null;
          note.textContent = 'Estimasi hujan satelit NASA IMERG sementara tidak tersedia.';
        }
      } finally {
        if (id === revision) refreshTimer = setTimeout(() => show(masked), 10 * 60000);
      }
    }

    return { show, clear };
  };
}());
