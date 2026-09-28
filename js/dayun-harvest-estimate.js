(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DayunHarvestEstimate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function count(n) { return Math.max(0, Math.floor(Number(n) || 0)); }
  function period(value) {
    var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(value || ''));
    if (!m || +m[2] < 1 || +m[2] > 12) return null;
    if (m[3] && (+m[3] < 1 || +m[3] > new Date(+m[1], +m[2], 0).getDate())) return null;
    return +m[1] * 12 + +m[2] - 1;
  }
  function key(n) { return Math.floor(n / 12) + '-' + String(n % 12 + 1).padStart(2, '0') + '-01'; }
  function build(rows, options) {
    options = options || {};
    var now = options.asOf || new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Jakarta'});
    // Use explicit calendar parts; locale formatting differs between runtimes.
    if (!period(now)) {
      var parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
      var fields = {}; parts.forEach(function (p) { fields[p.type] = p.value; });
      now = fields.year + '-' + fields.month + '-' + fields.day;
    }
    var current = period(now);
    var items = rows.map(function (row) {
      var result = {objectId:row.objectId, shortId:row.shortId, status:'missing', start:null, end:null, pool:null, low:null, base:null, high:null, notes:[]};
      var entries = (row.ethrelHistory || []).filter(function (e) { return count(e.count) > 0; });
      var dated = entries.filter(function (e) { return period(e.period) !== null && period(e.period) <= current; });
      var months = Array.from(new Set(dated.map(function (e) { return period(e.period); }))).sort(function (a,b) { return a-b; });
      if (!months.length) { result.notes.push('Perlu bulan dan jumlah tanaman ethrel. Bunga/buah tanpa tanggal pengamatan belum dapat dijadwalkan.'); return result; }
      result.start = key(months[0] + 5); result.end = key(months[months.length - 1] + 6);
      result.status = period(result.end) < current ? 'overdue' : 'estimated';
      if (result.status === 'overdue') result.notes.push('Periode acuan sudah lewat; perbarui realisasi panen dan kondisi tanaman. Tidak masuk estimasi mendatang.');
      if (months.length !== 1 || dated.length !== entries.length || count(row.ethrel) !== entries.reduce(function (s,e) { return s+count(e.count); },0)) {
        result.notes.push('Jumlah belum dihitung: pisahkan kelompok ethrel dan lengkapi bulan seluruh catatan.'); return result;
      }
      if (row.ratoonHarvest > 0 || row.ratoonVerified) { result.notes.push('Pisahkan tanaman utama dan ratoon beserta kelompok ethrel sebelum menghitung jumlah.'); return result; }
      var harvest = row.harvestHistory || [];
      if (harvest.some(function (h) { return count(h.count) && (period(h.period) === null || period(h.period) > current); }) || count(row.plantCropHarvest) !== harvest.reduce(function (s,h) { return s+count(h.count); },0)) {
        result.notes.push('Lengkapi bulan dan rincian panen agar tidak menghitung ulang buah yang telah dipanen.'); return result;
      }
      if (!(row.plants > 0)) { result.notes.push('Populasi tanaman belum tersedia.'); return result; }
      var induced = dated.reduce(function (s,e) { return s+count(e.count); },0);
      var harvested = harvest.filter(function (h) { return period(h.period) >= months[0]; }).reduce(function (s,h) { return s+count(h.count); },0);
      result.pool = Math.min(count(row.plants), Math.max(0, induced-harvested));
      result.low = Math.floor(result.pool*0.6); result.base = Math.floor(result.pool*0.8); result.high = result.pool;
      result.notes.push('Skenario: '+induced+' tanaman ethrel − '+harvested+' buah panen sejak bulan ethrel, dibatasi populasi tercatat. Panen diasumsikan dari kelompok yang sama; perlu verifikasi.');
      if (harvested > induced) result.notes.push('Panen melebihi jumlah ethrel: periksa kesesuaian kelompok; sisa skenario dibatasi nol.');
      return result;
    });
    return {asOf:now, items:items, upcoming:items.filter(function (i) { return i.status==='estimated'; }), overdue:items.filter(function (i) { return i.status==='overdue'; }), missing:items.filter(function (i) { return i.status==='missing'; })};
  }
  return {build:build};
});
