(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DayunPineappleAnalysis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var BLOCKS = ['A', 'B', 'C', 'D', 'E', 'F'];
  var MONTHS = {jan:0,feb:1,mar:2,apr:3,mei:4,jun:5,jul:6,agu:7,agust:7,sep:8,sept:8,okt:9,nov:10,des:11};

  function number(value) {
    value = Number(value);
    return Number.isFinite(value) ? value : 0;
  }

  function historyTotal(crop, field, fallback) {
    var rows = Array.isArray(crop[field]) ? crop[field] : [];
    if (rows.length) return rows.reduce(function (sum, row) { return sum + number(row.count); }, 0);
    return number(crop[fallback]);
  }

  function parsePlantingPeriod(value) {
    var text = String(value || '').trim().toLowerCase();
    var match = text.match(/([a-z]+)\s+(\d{4})/);
    if (!match) return null;
    var key = Object.keys(MONTHS).find(function (name) { return match[1].indexOf(name) === 0; });
    if (!key) return null;
    return new Date(Number(match[2]), MONTHS[key], 1);
  }

  function ageMonths(period, asOf) {
    var planted = parsePlantingPeriod(period);
    if (!planted) return null;
    var now = asOf instanceof Date ? asOf : new Date(asOf || Date.now());
    var months = (now.getFullYear() - planted.getFullYear()) * 12 + now.getMonth() - planted.getMonth();
    return Math.max(0, months);
  }

  function latestDate(values) {
    return values.filter(function (value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')); }).sort().pop() || null;
  }

  function monthStart(value) {
    var match = String(value || '').match(/^(\d{4})-(\d{2})(?:-\d{2})?/);
    var date = value instanceof Date ? value : match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : new Date(value || Date.now());
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function monthKey(value) {
    var date = monthStart(value);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-01';
  }

  function addMonths(value, amount) {
    var date = monthStart(value);
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
  }

  function monthDistance(from, to) {
    return (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
  }

  function recommendation(row) {
    if (row.plants <= 0) return {code:'data', label:'Lengkapi data', detail:'Populasi aktif dan luas operasional belum tercatat.'};
    if (!row.plantingPeriod) return {code:'data', label:'Verifikasi umur', detail:'Periode tanam belum tersedia; umur dan fase tidak dapat ditentukan.'};
    if (row.flowers > 0) return {code:'harvest', label:'Pantau kematangan', detail:'Bunga/buah tercatat; periksa warna kulit, bentuk mata, aroma, kondisi buah, dan kebutuhan pasar.'};
    if (row.ethrel > 0) return {code:'ethrel-followup', label:'Evaluasi hasil induksi', detail:'Ethrel pernah tercatat; verifikasi keseragaman bunga, buah, dan catatan panen pada kelompok yang sama.'};
    if (row.ageMonths != null && row.ageMonths >= 12) return {code:'ethrel-check', label:'Periksa kelayakan ethrel', detail:'Umur hanya saringan awal. Pastikan tanaman sehat, seragam, lebih dari 30 daun, tajuk membuka, dan cuaca sesuai.'};
    return {code:'maintenance', label:'Pemeliharaan vegetatif', detail:'Lanjutkan pemeriksaan populasi hidup, gulma, air, nutrisi, dan HPT.'};
  }

  function emptyBlock(code) {
    return {code:code, rows:0, activeGawangan:0, plants:0, areaHa:0, fertilized:0, harvest:0, ethrel:0, flowers:0, latestActivityDate:null};
  }

  function add(target, row) {
    target.rows += 1;
    if (row.plants > 0) target.activeGawangan += 1;
    ['plants','areaHa','fertilized','harvest','ethrel','flowers'].forEach(function (key) { target[key] += row[key]; });
  }

  function build(details, options) {
    options = options || {};
    var asOf = options.asOf instanceof Date ? options.asOf : new Date(options.asOf || Date.now());
    var blocks = {}, rows = [], harvestHistory = {}, activityDates = [];
    BLOCKS.forEach(function (code) { blocks[code] = emptyBlock(code); });

    (details && details.objects || []).forEach(function (object) {
      (object.crops || []).forEach(function (crop) {
        if (String(crop.crop || '').trim().toUpperCase() !== 'NANAS') return;
        var period = crop.plantingDate || crop.plantingPeriod || null;
        var dates = [];
        (crop.pineappleHarvest || []).forEach(function (item) {
          if (!item.period) return;
          harvestHistory[item.period] = (harvestHistory[item.period] || 0) + number(item.count);
          dates.push(item.period);
          activityDates.push(item.period);
        });
        (crop.ethrel || []).forEach(function (item) {
          if (!item.period) return;
          dates.push(item.period);
          activityDates.push(item.period);
        });
        var row = {
          objectId: object.objectId,
          shortId: String(object.objectId || '').replace('DAYUN-GT-', ''),
          block: object.block,
          variety: crop.variety || 'Belum diisi',
          plantingPeriod: period,
          ageMonths: ageMonths(period, asOf),
          plants: number(crop.vegetationCount),
          areaHa: number(crop.operationalAreaHa),
          fertilized: number(crop.fertilizedCount),
          harvest: historyTotal(crop, 'pineappleHarvest', 'pineappleHarvestTotal'),
          ethrel: historyTotal(crop, 'ethrel', 'ethrelTotal'),
          flowers: number(crop.pineappleFlowerCount),
          harvestHistory: (crop.pineappleHarvest || []).map(function (item) { return {period:item.period, count:number(item.count)}; }),
          ethrelHistory: (crop.ethrel || []).map(function (item) { return {period:item.period, count:number(item.count)}; }),
          latestActivityDate: latestDate(dates)
        };
        row.estimatedNotHarvested = Math.max(0, row.plants - row.harvest);
        row.recommendation = recommendation(row);
        rows.push(row);
        if (blocks[row.block]) {
          add(blocks[row.block], row);
          blocks[row.block].latestActivityDate = latestDate([blocks[row.block].latestActivityDate, row.latestActivityDate]);
        }
      });
    });

    var all = emptyBlock('ALL');
    rows.forEach(function (row) { add(all, row); });
    all.latestActivityDate = latestDate(activityDates);
    all.varieties = rows.reduce(function (result, row) {
      result[row.variety] = (result[row.variety] || 0) + 1;
      return result;
    }, {});
    all.estimatedNotHarvested = Math.max(0, all.plants - all.harvest);
    all.missingPlantingPeriod = rows.filter(function (row) { return !row.plantingPeriod; }).length;
    all.fertilizerDetailAvailable = false;
    all.recommendationCounts = rows.reduce(function (result, row) {
      result[row.recommendation.code] = (result[row.recommendation.code] || 0) + 1;
      return result;
    }, {});
    return {asOf:asOf.toISOString().slice(0, 10), all:all, blocks:blocks, rows:rows, blockCodes:BLOCKS.slice(), harvestHistory:harvestHistory};
  }

  function buildProjection(rows, options) {
    options = options || {};
    var asOf = options.asOf instanceof Date ? options.asOf : new Date(options.asOf || Date.now());
    var start = monthStart(asOf), horizon = Math.max(1, number(options.horizonMonths) || 6);
    var months = Array.from({length:horizon}, function (_, index) {
      return {
        period:monthKey(addMonths(start, index)),
        harvest:{low:0, base:0, high:0},
        ethrel:{gawangan:0, plants:0, objectIds:[]},
        fertilizer:{gawangan:0, objectIds:[], phases:{verification:0, phase2:0, phase3:0}, materials:{urea:{lowKg:0,highKg:0},npk:{lowKg:0,highKg:0}}}
      };
    });
    var byPeriod = {};
    months.forEach(function (item) { byPeriod[item.period] = item; });
    var totalEthrel = rows.reduce(function (sum, row) { return sum + row.ethrel; }, 0);
    var totalHarvest = rows.reduce(function (sum, row) { return sum + row.harvest; }, 0);
    var observedRate = totalEthrel > 0 ? Math.min(1, totalHarvest / totalEthrel) : null;
    var baseRate = observedRate == null ? 0.6 : observedRate;
    var lowRate = Math.max(0, baseRate * 0.8), highRate = Math.min(1, baseRate * 1.2);
    var datedEthrel = 0, undatedEthrel = 0, flowerRows = 0, flowerCount = 0;

    function addFertilizer(month, row, phase) {
      if (!month || month.fertilizer.objectIds.indexOf(row.objectId) >= 0 && phase === 'verification') return;
      if (month.fertilizer.objectIds.indexOf(row.objectId) < 0) {
        month.fertilizer.objectIds.push(row.objectId);
        month.fertilizer.gawangan += 1;
      }
      month.fertilizer.phases[phase] += 1;
      if (phase === 'phase2') {
        month.fertilizer.materials.urea.lowKg += row.areaHa * 300;
        month.fertilizer.materials.urea.highKg += row.areaHa * 300;
        month.fertilizer.materials.npk.lowKg += row.areaHa * 150;
        month.fertilizer.materials.npk.highKg += row.areaHa * 200;
      }
      if (phase === 'phase3') {
        month.fertilizer.materials.npk.lowKg += row.areaHa * 50;
        month.fertilizer.materials.npk.highKg += row.areaHa * 150;
      }
    }

    rows.forEach(function (row) {
      if (row.plants <= 0 || !row.plantingPeriod) return;
      var planted = parsePlantingPeriod(row.plantingPeriod);
      var eligible = planted ? addMonths(planted, 12) : null;
      var inspectionMonth = eligible && eligible > start ? eligible : start;
      var remainingEthrel = Math.max(0, row.plants - row.ethrel);
      if (remainingEthrel > 0 && row.flowers <= 0 && byPeriod[monthKey(inspectionMonth)]) {
        var ethrelMonth = byPeriod[monthKey(inspectionMonth)];
        ethrelMonth.ethrel.gawangan += 1;
        ethrelMonth.ethrel.plants += remainingEthrel;
        ethrelMonth.ethrel.objectIds.push(row.objectId);
        if (eligible && eligible > start) addFertilizer(byPeriod[monthKey(addMonths(eligible, -1))], row, 'phase2');
        else addFertilizer(byPeriod[monthKey(start)], row, 'verification');
      }
      if (row.flowers > 0) {
        flowerRows += 1;
        flowerCount += row.flowers;
        addFertilizer(byPeriod[monthKey(start)], row, 'phase3');
        [0.25,0.5,0.25].forEach(function (weight, index) {
          var target = byPeriod[monthKey(addMonths(start, index + 1))];
          if (!target) return;
          target.harvest.low += row.flowers * lowRate * weight;
          target.harvest.base += row.flowers * baseRate * weight;
          target.harvest.high += row.flowers * highRate * weight;
        });
      }
      (row.ethrelHistory || []).forEach(function (item) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(item.period || ''))) datedEthrel += item.count;
        else undatedEthrel += item.count;
      });
    });

    months.forEach(function (item) {
      ['low','base','high'].forEach(function (key) { item.harvest[key] = Math.round(item.harvest[key]); });
      item.ethrel.plants = Math.round(item.ethrel.plants);
      ['urea','npk'].forEach(function (material) {
        item.fertilizer.materials[material].lowKg = Math.round(item.fertilizer.materials[material].lowKg * 100) / 100;
        item.fertilizer.materials[material].highKg = Math.round(item.fertilizer.materials[material].highKg * 100) / 100;
      });
    });

    var lastActivity = latestDate(rows.map(function (row) { return row.latestActivityDate; }));
    var stalenessMonths = lastActivity ? monthDistance(monthStart(lastActivity), start) : null;
    return {
      asOf:monthKey(start),
      months:months,
      assumptions:{
        observedEthrelToHarvestRate:observedRate,
        lowRate:lowRate,
        baseRate:baseRate,
        highRate:highRate,
        flowerRows:flowerRows,
        flowerCount:Math.round(flowerCount),
        datedEthrel:Math.round(datedEthrel),
        undatedEthrel:Math.round(undatedEthrel),
        lastActivityDate:lastActivity,
        stalenessMonths:stalenessMonths,
        harvestConfidence:flowerCount > 0 && stalenessMonths != null && stalenessMonths <= 2 ? 'Sedang' : 'Rendah',
        ethrelConfidence:'Rendah',
        fertilizerConfidence:'Rendah'
      }
    };
  }

  return {build:build, buildProjection:buildProjection, ageMonths:ageMonths, recommendation:recommendation, BLOCKS:BLOCKS.slice()};
});
