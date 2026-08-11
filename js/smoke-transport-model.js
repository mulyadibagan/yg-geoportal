(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.YG_SMOKE_TRANSPORT = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEFAULT_LEVELS = [
    { id: "950", pressure: 950, altitude: 500, color: "#167c80", dashArray: null },
    { id: "925", pressure: 925, altitude: 800, color: "#d18200", dashArray: "8 5" },
    { id: "850", pressure: 850, altitude: 1500, color: "#7b4cc2", dashArray: "3 6" }
  ];

  /*
   * These parameters describe a relative trajectory-support surface, not
   * atmospheric concentration. NOAA HYSPLIT derives puff growth from
   * meteorological turbulence (d sigma_h / dt = sigma_u). This browser model
   * does not load stability, PBL, or turbulent velocity variance, so it must
   * not invent a universal physical growth rate. Instead, a Gaussian kernel
   * is used only to smooth the three-height trajectory ensemble at a bandwidth
   * tied to the sampled wind-grid spacing. Each clustered source contributes
   * equal total weight regardless of age, FRP, satellite count, or path length.
   */
  var DEFAULT_CONTOURS = {
    gridStepDegrees: 0.25,
    windGridStepDegrees: 1.5,
    bandwidthFraction: 0.30,
    minimumBandwidthKm: 25,
    kernelCutoffSigma: 3,
    paddingSigma: 3.5,
    quantiles: [0.20, 0.50, 0.75, 0.90]
  };

  function finite(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function roundGrid(value) {
    return Math.round(value * 1000000) / 1000000;
  }

  function distanceKm(a, b) {
    var dy = (a[0] - b[0]) * 111;
    var dx = (a[1] - b[1]) * 111 * Math.cos((a[0] + b[0]) * Math.PI / 360);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function destination(lat, lon, bearing, km) {
    var radius = 6371;
    var br = bearing * Math.PI / 180;
    var p1 = lat * Math.PI / 180;
    var l1 = lon * Math.PI / 180;
    var angular = km / radius;
    var p2 = Math.asin(
      Math.sin(p1) * Math.cos(angular) +
      Math.cos(p1) * Math.sin(angular) * Math.cos(br)
    );
    var l2 = l1 + Math.atan2(
      Math.sin(br) * Math.sin(angular) * Math.cos(p1),
      Math.cos(angular) - Math.sin(p1) * Math.sin(p2)
    );
    return [p2 * 180 / Math.PI, l2 * 180 / Math.PI];
  }

  function quantile(sortedValues, probability) {
    if (!sortedValues.length) return 0;
    var index = Math.max(0, Math.min(1, Number(probability) || 0)) * (sortedValues.length - 1);
    var lower = Math.floor(index);
    var upper = Math.ceil(index);
    var ratio = index - lower;
    return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * ratio;
  }

  function contourBandwidthKm(options) {
    options = options || {};
    var windStep = finite(options.windGridStepDegrees);
    var fraction = finite(options.bandwidthFraction);
    var minimum = finite(options.minimumBandwidthKm);
    if (windStep == null) windStep = DEFAULT_CONTOURS.windGridStepDegrees;
    if (fraction == null) fraction = DEFAULT_CONTOURS.bandwidthFraction;
    if (minimum == null) minimum = DEFAULT_CONTOURS.minimumBandwidthKm;
    return Math.max(Math.max(0, minimum), Math.max(0, windStep) * 111 * Math.max(0, fraction));
  }

  function buildSupportPuffs(trajectories, options) {
    options = options || {};
    var bandwidthKm = contourBandwidthKm(options);
    var sources = {};
    (trajectories || []).forEach(function (trajectory) {
      var sourceIndex = Number(trajectory && trajectory.sourceIndex);
      var path = trajectory && trajectory.path || [];
      if (!Number.isFinite(sourceIndex) || !path.length) return;
      var ages = Array.isArray(trajectory.agesHours) && trajectory.agesHours.length === path.length
        ? trajectory.agesHours
        : path.map(function (_, index) { return index; });
      if (!sources[sourceIndex]) sources[sourceIndex] = {};
      path.forEach(function (coordinate, pathIndex) {
        var lon = Number(coordinate && coordinate[0]);
        var lat = Number(coordinate && coordinate[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        var ageHours = Math.max(0, Number(ages[pathIndex]) || 0);
        var ageKey = Math.round(ageHours * 1000) / 1000;
        if (!sources[sourceIndex][ageKey]) sources[sourceIndex][ageKey] = [];
        sources[sourceIndex][ageKey].push({
          lon: lon,
          lat: lat,
          ageHours: ageHours,
          pressureHpa: trajectory.level && trajectory.level.pressure
        });
      });
    });

    var puffs = [];
    Object.keys(sources).forEach(function (sourceKey) {
      var ages = sources[sourceKey];
      var ageKeys = Object.keys(ages);
      var ageWeight = ageKeys.length ? 1 / ageKeys.length : 0;
      ageKeys.forEach(function (ageKey) {
        var members = ages[ageKey];
        var memberWeight = members.length ? ageWeight / members.length : 0;
        members.forEach(function (member) {
          puffs.push({
            lon: member.lon,
            lat: member.lat,
            ageHours: member.ageHours,
            sourceIndex: Number(sourceKey),
            pressureHpa: member.pressureHpa,
            sigmaKm: bandwidthKm,
            weight: memberWeight
          });
        });
      });
    });
    return puffs;
  }

  function buildSupportGrid(puffs, domain, options) {
    options = options || {};
    domain = domain || { minLat: -11.2, maxLat: 6.2, minLon: 94.5, maxLon: 141.5 };
    var valid = (puffs || []).filter(function (puff) {
      return puff && Number.isFinite(Number(puff.lat)) && Number.isFinite(Number(puff.lon)) &&
        Number.isFinite(Number(puff.sigmaKm)) && Number(puff.sigmaKm) > 0 &&
        Number.isFinite(Number(puff.weight)) && Number(puff.weight) > 0;
    });
    if (!valid.length) return null;

    var step = finite(options.gridStepDegrees) || DEFAULT_CONTOURS.gridStepDegrees;
    var cutoff = finite(options.kernelCutoffSigma) || DEFAULT_CONTOURS.kernelCutoffSigma;
    var padding = finite(options.paddingSigma) || DEFAULT_CONTOURS.paddingSigma;
    var maxSigma = Math.max.apply(null, valid.map(function (puff) { return Number(puff.sigmaKm); }));
    var latPad = padding * maxSigma / 111;
    var meanLat = valid.reduce(function (sum, puff) { return sum + Number(puff.lat); }, 0) / valid.length;
    var lonScale = Math.max(0.2, Math.cos(meanLat * Math.PI / 180));
    var lonPad = padding * maxSigma / (111 * lonScale);
    var minLat = Math.max(Number(domain.minLat), Math.min.apply(null, valid.map(function (puff) { return Number(puff.lat); })) - latPad);
    var maxLat = Math.min(Number(domain.maxLat), Math.max.apply(null, valid.map(function (puff) { return Number(puff.lat); })) + latPad);
    var minLon = Math.max(Number(domain.minLon), Math.min.apply(null, valid.map(function (puff) { return Number(puff.lon); })) - lonPad);
    var maxLon = Math.min(Number(domain.maxLon), Math.max.apply(null, valid.map(function (puff) { return Number(puff.lon); })) + lonPad);
    minLat = Math.floor(minLat / step) * step;
    maxLat = Math.ceil(maxLat / step) * step;
    minLon = Math.floor(minLon / step) * step;
    maxLon = Math.ceil(maxLon / step) * step;

    var rowCount = Math.max(2, Math.round((maxLat - minLat) / step) + 1);
    var columnCount = Math.max(2, Math.round((maxLon - minLon) / step) + 1);
    var values = new Float64Array(rowCount * columnCount);
    valid.forEach(function (puff) {
      var sigma = Number(puff.sigmaKm);
      var sigmaSquared = sigma * sigma;
      var latRadius = cutoff * sigma / 111;
      var localLonScale = Math.max(0.2, Math.cos(Number(puff.lat) * Math.PI / 180));
      var lonRadius = cutoff * sigma / (111 * localLonScale);
      var firstRow = Math.max(0, Math.floor((Number(puff.lat) - latRadius - minLat) / step));
      var lastRow = Math.min(rowCount - 1, Math.ceil((Number(puff.lat) + latRadius - minLat) / step));
      var firstColumn = Math.max(0, Math.floor((Number(puff.lon) - lonRadius - minLon) / step));
      var lastColumn = Math.min(columnCount - 1, Math.ceil((Number(puff.lon) + lonRadius - minLon) / step));
      var normalizer = Number(puff.weight) / (2 * Math.PI * sigmaSquared);
      for (var row = firstRow; row <= lastRow; row += 1) {
        var lat = minLat + row * step;
        var dy = (lat - Number(puff.lat)) * 111;
        for (var column = firstColumn; column <= lastColumn; column += 1) {
          var lon = minLon + column * step;
          var dx = (lon - Number(puff.lon)) * 111 * Math.cos((lat + Number(puff.lat)) * Math.PI / 360);
          var distanceSquared = dx * dx + dy * dy;
          if (distanceSquared > cutoff * cutoff * sigmaSquared) continue;
          values[row * columnCount + column] += normalizer * Math.exp(-0.5 * distanceSquared / sigmaSquared);
        }
      }
    });

    var rawMax = Math.max.apply(null, Array.from(values));
    if (!(rawMax > 0)) return null;
    var normalizedPositive = Array.from(values).filter(function (value) { return value > 0; }).map(function (value) {
      return value / rawMax;
    }).sort(function (a, b) { return a - b; });
    var probabilities = options.quantiles || DEFAULT_CONTOURS.quantiles;
    var thresholds = probabilities.map(function (probability) {
      return quantile(normalizedPositive, probability);
    });
    for (var thresholdIndex = 1; thresholdIndex < thresholds.length; thresholdIndex += 1) {
      if (thresholds[thresholdIndex] <= thresholds[thresholdIndex - 1]) {
        thresholds[thresholdIndex] = Math.min(0.999999, thresholds[thresholdIndex - 1] + 0.000001);
      }
    }

    var features = [];
    for (var outputRow = 0; outputRow < rowCount; outputRow += 1) {
      for (var outputColumn = 0; outputColumn < columnCount; outputColumn += 1) {
        var value = values[outputRow * columnCount + outputColumn] / rawMax;
        features.push({
          type: "Feature",
          properties: { support: value },
          geometry: {
            type: "Point",
            coordinates: [
              roundGrid(minLon + outputColumn * step),
              roundGrid(minLat + outputRow * step)
            ]
          }
        });
      }
    }
    return {
      grid: { type: "FeatureCollection", features: features },
      breaks: thresholds.concat([1.000001]),
      thresholds: thresholds,
      quantiles: probabilities.slice(),
      rawMax: rawMax,
      pointCount: features.length,
      puffCount: valid.length,
      rowCount: rowCount,
      columnCount: columnCount,
      gridStepDegrees: step,
      bandwidthKm: maxSigma,
      bounds: { minLat: minLat, maxLat: maxLat, minLon: minLon, maxLon: maxLon }
    };
  }

  function featureTime(feature) {
    var properties = feature && feature.properties || {};
    if (properties.model_time) {
      var modelTime = new Date(properties.model_time).getTime();
      if (Number.isFinite(modelTime)) return modelTime;
    }
    var date = String(properties.acq_date || "");
    var time = String(properties.acq_time || "0000").padStart(4, "0");
    var parsed = new Date(date + "T" + time.slice(0, 2) + ":" + time.slice(2, 4) + ":00Z").getTime();
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function isVegetationOrUnclassified(feature) {
    var value = feature && feature.properties && feature.properties.type;
    return value == null || String(value).trim() === "" || String(value).trim() === "0";
  }

  function clusterSources(features, options) {
    options = options || {};
    var spatialKm = finite(options.spatialKm) || 1.5;
    var temporalMinutes = finite(options.temporalMinutes) || 90;
    var temporalMs = temporalMinutes * 60000;
    var items = (features || []).filter(function (feature) {
      return feature && feature.geometry && feature.geometry.type === "Point" &&
        Array.isArray(feature.geometry.coordinates) &&
        Number.isFinite(featureTime(feature)) &&
        isVegetationOrUnclassified(feature);
    }).map(function (feature, index) {
      var properties = feature.properties || {};
      var coordinates = feature.geometry.coordinates;
      return {
        feature: feature,
        index: index,
        lat: Number(coordinates[1]),
        lon: Number(coordinates[0]),
        time: featureTime(feature),
        satellite: String(properties.satellite || "").trim(),
        frp: Math.max(0, finite(properties.frp) || 0)
      };
    }).filter(function (item) {
      return Number.isFinite(item.lat) && Number.isFinite(item.lon);
    }).sort(function (a, b) {
      return a.time - b.time || b.frp - a.frp;
    });

    var clusters = [];
    items.forEach(function (item) {
      var best = null;
      var bestDistance = Infinity;
      if (item.satellite) {
        clusters.forEach(function (cluster) {
          if (cluster.hasUnknown || cluster.satellites[item.satellite]) return;
          if (Math.abs(item.time - cluster.meanTime) > temporalMs) return;
          var distance = distanceKm([item.lat, item.lon], [cluster.lat, cluster.lon]);
          if (distance <= spatialKm && distance < bestDistance) {
            best = cluster;
            bestDistance = distance;
          }
        });
      }

      if (!best) {
        best = {
          items: [],
          lat: item.lat,
          lon: item.lon,
          meanTime: item.time,
          satellites: {},
          hasUnknown: !item.satellite
        };
        clusters.push(best);
      }
      best.items.push(item);
      if (item.satellite) best.satellites[item.satellite] = true;
      best.hasUnknown = best.hasUnknown || !item.satellite;
      best.lat = best.items.reduce(function (sum, row) { return sum + row.lat; }, 0) / best.items.length;
      best.lon = best.items.reduce(function (sum, row) { return sum + row.lon; }, 0) / best.items.length;
      best.meanTime = best.items.reduce(function (sum, row) { return sum + row.time; }, 0) / best.items.length;
    });

    return clusters.map(function (cluster) {
      var representative = cluster.items.slice().sort(function (a, b) {
        return b.frp - a.frp || b.time - a.time;
      })[0];
      var properties = Object.assign({}, representative.feature.properties || {});
      properties.model_time = new Date(cluster.meanTime).toISOString();
      properties.source_count = cluster.items.length;
      properties.satellites = Object.keys(cluster.satellites).sort();
      properties.frp = representative.frp || null;
      properties.source_cluster_method = "different-satellite detections within 1.5 km and 90 minutes";
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [cluster.lon, cluster.lat] },
        properties: properties
      };
    });
  }

  function buildGrid(bounds, step) {
    var size = finite(step) || 1.5;
    var minLat = Math.floor(Number(bounds.minLat) / size) * size;
    var maxLat = Math.ceil(Number(bounds.maxLat) / size) * size;
    var minLon = Math.floor(Number(bounds.minLon) / size) * size;
    var maxLon = Math.ceil(Number(bounds.maxLon) / size) * size;
    var points = [];
    for (var lat = minLat; lat <= maxLat + size / 10; lat += size) {
      for (var lon = minLon; lon <= maxLon + size / 10; lon += size) {
        points.push([roundGrid(lat), roundGrid(lon)]);
      }
    }
    return points;
  }

  function travelVector(speed, directionFrom) {
    var validSpeed = finite(speed);
    var validDirection = finite(directionFrom);
    if (validSpeed == null || validDirection == null) return null;
    var travel = (validDirection + 180) % 360;
    var radians = travel * Math.PI / 180;
    return {
      east: validSpeed * Math.sin(radians),
      north: validSpeed * Math.cos(radians)
    };
  }

  function vectorAtTime(row, timeMs, levelId) {
    var level = row && row.levels && row.levels[levelId];
    var times = row && row.times || [];
    if (!level || !times.length) return null;
    if (timeMs < times[0] || timeMs > times[times.length - 1]) return null;

    var upper = 0;
    while (upper < times.length && times[upper] < timeMs) upper += 1;
    if (upper >= times.length) upper = times.length - 1;
    var lower = Math.max(0, upper - 1);
    if (times[upper] === timeMs) lower = upper;

    var first = travelVector(level.speeds[lower], level.directions[lower]);
    var second = travelVector(level.speeds[upper], level.directions[upper]);
    if (!first && !second) return null;
    if (!first) return second;
    if (!second || lower === upper) return first;

    var span = times[upper] - times[lower];
    var ratio = span > 0 ? (timeMs - times[lower]) / span : 0;
    return {
      east: first.east + (second.east - first.east) * ratio,
      north: first.north + (second.north - first.north) * ratio
    };
  }

  function gridKey(lat, lon) {
    return roundGrid(lat).toFixed(6) + "|" + roundGrid(lon).toFixed(6);
  }

  function buildWindIndex(readings, step) {
    var rows = (readings || []).filter(function (row) {
      return row && Number.isFinite(Number(row.gridLat)) && Number.isFinite(Number(row.gridLon));
    });
    var byKey = {};
    rows.forEach(function (row) {
      byKey[gridKey(Number(row.gridLat), Number(row.gridLon))] = row;
    });
    return {
      rows: rows,
      byKey: byKey,
      step: finite(step) || 1.5,
      minLat: Math.min.apply(null, rows.map(function (row) { return Number(row.gridLat); })),
      maxLat: Math.max.apply(null, rows.map(function (row) { return Number(row.gridLat); })),
      minLon: Math.min.apply(null, rows.map(function (row) { return Number(row.gridLon); })),
      maxLon: Math.max.apply(null, rows.map(function (row) { return Number(row.gridLon); }))
    };
  }

  function sampleWind(index, lat, lon, timeMs, levelId) {
    if (!index || !index.rows || !index.rows.length) return null;
    if (lat < index.minLat || lat > index.maxLat || lon < index.minLon || lon > index.maxLon) return null;
    var step = index.step;
    var lowLat = roundGrid(Math.floor((lat - index.minLat) / step) * step + index.minLat);
    var lowLon = roundGrid(Math.floor((lon - index.minLon) / step) * step + index.minLon);
    var highLat = roundGrid(Math.min(index.maxLat, lowLat + step));
    var highLon = roundGrid(Math.min(index.maxLon, lowLon + step));
    var latRatio = highLat === lowLat ? 0 : (lat - lowLat) / (highLat - lowLat);
    var lonRatio = highLon === lowLon ? 0 : (lon - lowLon) / (highLon - lowLon);
    var latOptions = highLat === lowLat
      ? [{ value: lowLat, weight: 1 }]
      : [{ value: lowLat, weight: 1 - latRatio }, { value: highLat, weight: latRatio }];
    var lonOptions = highLon === lowLon
      ? [{ value: lowLon, weight: 1 }]
      : [{ value: lowLon, weight: 1 - lonRatio }, { value: highLon, weight: lonRatio }];
    var corners = [];
    latOptions.forEach(function (latOption) {
      lonOptions.forEach(function (lonOption) {
        corners.push({
          lat: latOption.value,
          lon: lonOption.value,
          weight: latOption.weight * lonOption.weight
        });
      });
    });
    var east = 0;
    var north = 0;
    var totalWeight = 0;
    corners.forEach(function (corner) {
      var row = index.byKey[gridKey(corner.lat, corner.lon)];
      var vector = vectorAtTime(row, timeMs, String(levelId));
      if (!vector) return;
      east += vector.east * corner.weight;
      north += vector.north * corner.weight;
      totalWeight += corner.weight;
    });
    if (totalWeight <= 0) return null;
    east /= totalWeight;
    north /= totalWeight;
    var speed = Math.sqrt(east * east + north * north);
    var travelDirection = (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
    return { east: east, north: north, speed: speed, travelDirection: travelDirection };
  }

  function buildTrajectories(sources, windIndex, endTimeMs, options) {
    options = options || {};
    var levels = options.levels || DEFAULT_LEVELS;
    var maxHours = finite(options.maxHours) || 24;
    var trajectories = [];
    (sources || []).forEach(function (source, sourceIndex) {
      var coordinates = source.geometry && source.geometry.coordinates || [];
      var sourceTime = featureTime(source);
      if (!Number.isFinite(sourceTime) || sourceTime > endTimeMs) return;
      var startTime = Math.max(sourceTime, endTimeMs - maxHours * 3600000);
      levels.forEach(function (level) {
        var lat = Number(coordinates[1]);
        var lon = Number(coordinates[0]);
        var time = startTime;
        var path = [[lon, lat]];
        var agesHours = [0];
        var travelKm = 0;
        while (time < endTimeMs && path.length <= maxHours + 2) {
          var remainingHours = (endTimeMs - time) / 3600000;
          var stepHours = Math.min(1, remainingHours);
          var wind = sampleWind(windIndex, lat, lon, time, level.id);
          if (!wind || wind.speed <= 0) break;
          var next = destination(lat, lon, wind.travelDirection, wind.speed * stepHours);
          if (
            next[0] < windIndex.minLat || next[0] > windIndex.maxLat ||
            next[1] < windIndex.minLon || next[1] > windIndex.maxLon
          ) break;
          travelKm += distanceKm([lat, lon], next);
          lat = next[0];
          lon = next[1];
          time += stepHours * 3600000;
          path.push([lon, lat]);
          agesHours.push((time - startTime) / 3600000);
        }
        if (path.length > 1) {
          trajectories.push({
            source: source,
            sourceIndex: sourceIndex,
            level: level,
            path: path,
            agesHours: agesHours,
            startTime: startTime,
            endTime: time,
            durationHours: (time - startTime) / 3600000,
            travelKm: travelKm
          });
        }
      });
    });
    return trajectories;
  }

  return {
    DEFAULT_CONTOURS: DEFAULT_CONTOURS,
    DEFAULT_LEVELS: DEFAULT_LEVELS,
    buildGrid: buildGrid,
    buildSupportGrid: buildSupportGrid,
    buildSupportPuffs: buildSupportPuffs,
    buildTrajectories: buildTrajectories,
    buildWindIndex: buildWindIndex,
    clusterSources: clusterSources,
    contourBandwidthKm: contourBandwidthKm,
    destination: destination,
    distanceKm: distanceKm,
    featureTime: featureTime,
    isVegetationOrUnclassified: isVegetationOrUnclassified,
    quantile: quantile,
    sampleWind: sampleWind,
    travelVector: travelVector
  };
});
