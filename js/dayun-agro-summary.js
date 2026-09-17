(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DayunAgroSummary = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MPTS = ['RAMBUTAN', 'ASAM KANDIS', 'NANGKA', 'PETAI', 'JENGKOL'];
  var HORTICULTURE = ['NANAS', 'TERONG', 'CABAI'];

  function number(value) {
    value = Number(value);
    return Number.isFinite(value) ? value : 0;
  }

  function latestDate(values) {
    return values.filter(Boolean).map(function (value) {
      var text = String(value);
      return /^\d{4}-\d{2}$/.test(text) ? text + '-01' : text;
    }).filter(function (value) { return /^\d{4}-\d{2}-\d{2}$/.test(value); })
      .sort().pop() || null;
  }

  function cropHistoryTotal(crop, field, fallback) {
    var rows = Array.isArray(crop[field]) ? crop[field] : [];
    if (rows.length) return rows.reduce(function (sum, row) { return sum + number(row.count); }, 0);
    return number(crop[fallback]);
  }

  function emptyCrop(name) {
    return {
      crop: name,
      vegetationCount: 0,
      operationalAreaHa: 0,
      operationalAreaKnownCount: 0,
      harvestCount: 0,
      ethrelCount: 0,
      flowerCount: 0,
      seedlingCount: 0,
      gawanganCount: 0,
      harvestHistory: {},
      gawanganIds: [],
      plantingPeriods: []
    };
  }

  function emptyBlock(code) {
    return {
      code: code,
      name: 'Blok ' + code,
      blockAreaHa: 0,
      gawanganAreaHa: 0,
      operationalAreaHa: 0,
      mappedGawangan: 0,
      gawanganWithData: 0,
      missingGawangan: [],
      cropTypes: 0,
      cropTotals: {},
      totalPlants: 0,
      pineapplePlants: 0,
      pineappleHarvest: 0,
      pineappleMainHarvest: 0,
      pineappleUnharvested: 0,
      pineappleEthrel: 0,
      pineappleFlowers: 0,
      pineappleSeedlings: 0,
      mptsPlants: 0,
      mptsTypes: 0,
      horticulturePlants: 0,
      horticultureTypes: 0,
      latestRecordDate: null,
      gawangan: []
    };
  }

  function build(details, map, blocks) {
    var records = {}, uniqueFeatures = {}, blockMap = {}, codes = ['A', 'B', 'C', 'D', 'E', 'F'];
    (details && details.objects || []).forEach(function (item) { records[item.objectId] = item; });
    (map && map.features || []).forEach(function (feature) {
      var p = feature.properties || {}, id = p.objectId;
      if (p.category === 'Gawangan Tanam' && id && !uniqueFeatures[id]) uniqueFeatures[id] = feature;
    });
    codes.forEach(function (code) { blockMap[code] = emptyBlock(code); });
    (blocks && blocks.features || []).forEach(function (feature) {
      var p = feature.properties || {}, code = p.blockCode || String(p.name || '').replace(/\D/g, '');
      if (blockMap[code]) blockMap[code].blockAreaHa = number(p.areaHa);
    });

    Object.keys(uniqueFeatures).sort(function (a, b) { return a.localeCompare(b, 'id', {numeric: true}); }).forEach(function (objectId) {
      var feature = uniqueFeatures[objectId], p = feature.properties || {};
      var code = String(p.block || '').replace(/^Blok\s+/i, '') || objectId.split('-')[2];
      var block = blockMap[code];
      if (!block) return;
      var record = records[objectId] || null, polygonArea = number(p.sourceGawanganAreaHa != null ? p.sourceGawanganAreaHa : p.areaHa);
      var item = {
        objectId: objectId,
        shortId: objectId.replace('DAYUN-GT-', ''),
        areaHa: polygonArea,
        operationalAreaHa: 0,
        hasData: Boolean(record),
        crops: [],
        totalPlants: 0,
        pineapplePlants: 0,
        pineappleHarvest: 0,
      pineappleMainHarvest: 0,
        pineappleUnharvested: 0,
        mptsPlants: 0,
        horticulturePlants: 0,
        latestRecordDate: null
      };
      block.mappedGawangan += 1;
      block.gawanganAreaHa += polygonArea;
      if (!record) {
        block.missingGawangan.push(objectId);
        block.gawangan.push(item);
        return;
      }

      block.gawanganWithData += 1;
      var operationalAreas = [], dateValues = [];
      (record.crops || []).forEach(function (crop) {
        var cropName = String(crop.crop || 'KOMODITAS').trim().toUpperCase();
        var total = block.cropTotals[cropName] || emptyCrop(cropName);
        var plants = number(crop.vegetationCount), operational = number(crop.operationalAreaHa);
        var harvest = cropHistoryTotal(crop, 'pineappleHarvest', 'pineappleHarvestTotal');
        var mainHarvest = Array.isArray(crop.pineappleHarvest) && crop.pineappleHarvest.length ? crop.pineappleHarvest.filter(function(row){return !/^ratoon/i.test(String(row.cycle||'').trim());}).reduce(function(sum,row){return sum+number(row.count);},0) : harvest;
        var ethrel = cropHistoryTotal(crop, 'ethrel', 'ethrelTotal');
        total.vegetationCount += plants;
        total.operationalAreaHa += operational;
        if (crop.operationalAreaHa != null && crop.operationalAreaHa !== '') total.operationalAreaKnownCount += 1;
        total.harvestCount += harvest;
        total.ethrelCount += ethrel;
        total.flowerCount += number(crop.pineappleFlowerCount);
        total.seedlingCount += number(crop.seedlingAvailability);
        total.gawanganCount += 1;
        if (total.gawanganIds.indexOf(objectId) < 0) total.gawanganIds.push(objectId);
        var plantingPeriod = crop.plantingDate || crop.plantingPeriod;
        if (plantingPeriod && total.plantingPeriods.indexOf(plantingPeriod) < 0) total.plantingPeriods.push(plantingPeriod);
        (crop.pineappleHarvest || []).forEach(function (row) {
          if (!row.period) return;
          total.harvestHistory[row.period] = (total.harvestHistory[row.period] || 0) + number(row.count);
          dateValues.push(row.period);
        });
        (crop.ethrel || []).forEach(function (row) { if (row.period) dateValues.push(row.period); });
        dateValues.push(crop.plantingDate || crop.plantingPeriod);
        block.cropTotals[cropName] = total;
        item.crops.push(cropName);
        item.totalPlants += plants;
        block.totalPlants += plants;
        if (operational > 0) operationalAreas.push(operational);
        if (cropName === 'NANAS') {
          item.pineapplePlants += plants;
          item.pineappleHarvest += harvest;
          item.pineappleMainHarvest += mainHarvest;
          block.pineappleMainHarvest += mainHarvest;
          block.pineapplePlants += plants;
          block.pineappleHarvest += harvest;
          block.pineappleEthrel += ethrel;
          block.pineappleFlowers += number(crop.pineappleFlowerCount);
          block.pineappleSeedlings += number(crop.seedlingAvailability);
        }
        if (MPTS.indexOf(cropName) >= 0) {
          item.mptsPlants += plants;
          block.mptsPlants += plants;
        }
        if (HORTICULTURE.indexOf(cropName) >= 0) block.horticulturePlants += plants;
        if (HORTICULTURE.indexOf(cropName) >= 0) item.horticulturePlants += plants;
      });
      item.operationalAreaHa = operationalAreas.length ? Math.max.apply(null, operationalAreas) : 0;
      item.pineappleUnharvested = Math.max(0, item.pineapplePlants - item.pineappleMainHarvest);
      item.latestRecordDate = latestDate(dateValues);
      block.operationalAreaHa += item.operationalAreaHa;
      block.gawangan.push(item);
    });

    codes.forEach(function (code) {
      var block = blockMap[code], dates = block.gawangan.map(function (item) { return item.latestRecordDate; });
      block.cropTypes = Object.keys(block.cropTotals).length;
      block.mptsTypes = MPTS.filter(function (name) { return block.cropTotals[name] && block.cropTotals[name].vegetationCount > 0; }).length;
      block.horticultureTypes = HORTICULTURE.filter(function (name) { return block.cropTotals[name] && block.cropTotals[name].vegetationCount > 0; }).length;
      block.pineappleUnharvested = Math.max(0, block.pineapplePlants - block.pineappleMainHarvest);
      block.latestRecordDate = latestDate(dates);
    });

    var all = emptyBlock('ALL');
    all.name = 'Seluruh blok';
    all.gawangan = [];
    codes.forEach(function (code) {
      var block = blockMap[code];
      ['blockAreaHa', 'gawanganAreaHa', 'operationalAreaHa', 'mappedGawangan', 'gawanganWithData', 'totalPlants', 'pineapplePlants', 'pineappleHarvest', 'pineappleMainHarvest', 'pineappleUnharvested', 'pineappleEthrel', 'pineappleFlowers', 'pineappleSeedlings', 'mptsPlants', 'horticulturePlants'].forEach(function (key) { all[key] += block[key]; });
      all.missingGawangan = all.missingGawangan.concat(block.missingGawangan);
      all.gawangan = all.gawangan.concat(block.gawangan);
      Object.keys(block.cropTotals).forEach(function (name) {
        var source = block.cropTotals[name], target = all.cropTotals[name] || emptyCrop(name);
        ['vegetationCount', 'operationalAreaHa', 'operationalAreaKnownCount', 'harvestCount', 'ethrelCount', 'flowerCount', 'seedlingCount', 'gawanganCount'].forEach(function (key) { target[key] += source[key]; });
        source.gawanganIds.forEach(function (id) { if (target.gawanganIds.indexOf(id) < 0) target.gawanganIds.push(id); });
        source.plantingPeriods.forEach(function (period) { if (target.plantingPeriods.indexOf(period) < 0) target.plantingPeriods.push(period); });
        Object.keys(source.harvestHistory).forEach(function (period) { target.harvestHistory[period] = (target.harvestHistory[period] || 0) + source.harvestHistory[period]; });
        all.cropTotals[name] = target;
      });
    });
    all.cropTypes = Object.keys(all.cropTotals).length;
    all.mptsTypes = MPTS.filter(function (name) { return all.cropTotals[name] && all.cropTotals[name].vegetationCount > 0; }).length;
    all.horticultureTypes = HORTICULTURE.filter(function (name) { return all.cropTotals[name] && all.cropTotals[name].vegetationCount > 0; }).length;
    all.latestRecordDate = latestDate(codes.map(function (code) { return blockMap[code].latestRecordDate; }));
    return {all: all, blocks: blockMap, codes: codes};
  }

  return {build: build, MPTS: MPTS.slice(), HORTICULTURE: HORTICULTURE.slice()};
});
