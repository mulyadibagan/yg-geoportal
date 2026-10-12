(function (root) {
  'use strict';
  function summarize(features) {
    var byGawangan = {}, seen = new Set(), unassigned = {Petai:0, Jengkol:0}, total = {Petai:0, Jengkol:0};
    (features || []).forEach(function (feature) {
      var p = feature.properties || {}, key = p.pointId;
      if (!key || seen.has(key)) return;
      seen.add(key);
      var ids = Array.from(new Set((p.spatialMatches || []).filter(function (id) { return /^DAYUN-GT-[A-F]-\d{2}$/.test(id); })));
      var row = ids.length === 1 ? (byGawangan[ids[0]] || (byGawangan[ids[0]] = {objectId:ids[0], observed:0, Petai:0, Jengkol:0})) : null;
      if (row) row.observed++;
      if (p.condition !== 'Mati' || !Object.prototype.hasOwnProperty.call(total, p.species)) return;
      total[p.species]++;
      (row || unassigned)[p.species]++;
    });
    return {rows:Object.keys(byGawangan).sort().map(function (id) { return byGawangan[id]; }), byGawangan:byGawangan, unassigned:unassigned, total:total};
  }
  var api = {summarize:summarize};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DayunMptsSummary = api;
})(typeof window !== 'undefined' ? window : this);
