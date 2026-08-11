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
   * The browser product cannot solve atmospheric turbulence because the
   * required boundary-layer and stability fields are not available.  These
   * values therefore define a transparent sensitivity envelope, not a smoke
   * concentration model.  The 1.853 km h-1 horizontal sigma growth and 1.54
   * outer-radius factor follow the documented defaults in NOAA HYSPLIT's
   * legacy puff formulation.  They are kept explicit so they can be replaced
   * by calibrated parameters when observations become available.
   */
  var DEFAULT_ENVELOPE = {
    initialRadiusKm: 1.5,
    sigmaGrowthKmPerHour: 1.853,
    outerRadiusFactor: 1.54,
    capSegments: 8
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

  function bearingBetween(a, b) {
    var lon1 = Number(a && a[0]) * Math.PI / 180;
    var lat1 = Number(a && a[1]) * Math.PI / 180;
    var lon2 = Number(b && b[0]) * Math.PI / 180;
    var lat2 = Number(b && b[1]) * Math.PI / 180;
    var deltaLon = lon2 - lon1;
    var y = Math.sin(deltaLon) * Math.cos(lat2);
    var x = Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
    if (!Number.isFinite(x) || !Number.isFinite(y) || (Math.abs(x) + Math.abs(y) < 1e-12)) return 0;
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function meanBearing(first, second) {
    var a = Number(first) * Math.PI / 180;
    var b = Number(second) * Math.PI / 180;
    var east = Math.sin(a) + Math.sin(b);
    var north = Math.cos(a) + Math.cos(b);
    if (Math.abs(east) + Math.abs(north) < 1e-12) return Number(second) || 0;
    return (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
  }

  function pathBearing(path, index) {
    if (index <= 0) return bearingBetween(path[0], path[1]);
    if (index >= path.length - 1) return bearingBetween(path[path.length - 2], path[path.length - 1]);
    return meanBearing(
      bearingBetween(path[index - 1], path[index]),
      bearingBetween(path[index], path[index + 1])
    );
  }

  function horizontalSpreadKm(ageHours, options) {
    options = options || {};
    var initial = finite(options.initialRadiusKm);
    var growth = finite(options.sigmaGrowthKmPerHour);
    var factor = finite(options.radiusFactor);
    if (initial == null) initial = DEFAULT_ENVELOPE.initialRadiusKm;
    if (growth == null) growth = DEFAULT_ENVELOPE.sigmaGrowthKmPerHour;
    if (factor == null) factor = 1;
    return Math.max(0, (Math.max(0, initial) + Math.max(0, growth) * Math.max(0, Number(ageHours) || 0)) * Math.max(0, factor));
  }

  function pushCoordinate(ring, coordinate) {
    var previous = ring[ring.length - 1];
    if (!previous || distanceKm([previous[1], previous[0]], [coordinate[1], coordinate[0]]) > 0.001) {
      ring.push(coordinate);
    }
  }

  function offsetCoordinate(coordinate, bearing, radiusKm) {
    var point = destination(Number(coordinate[1]), Number(coordinate[0]), bearing, radiusKm);
    return [point[1], point[0]];
  }

  function buildEnvelopePolygon(trajectory, options) {
    options = options || {};
    var path = trajectory && trajectory.path || [];
    if (path.length < 2) return null;
    var duration = Math.max(0, finite(trajectory.durationHours) || 0);
    var ages = Array.isArray(trajectory.agesHours) && trajectory.agesHours.length === path.length
      ? trajectory.agesHours
      : path.map(function (_, index) {
        return path.length > 1 ? duration * index / (path.length - 1) : 0;
      });
    var factor = finite(options.radiusFactor);
    if (factor == null) factor = 1;
    var capSegments = Math.max(3, Math.round(finite(options.capSegments) || DEFAULT_ENVELOPE.capSegments));
    var tangents = path.map(function (_, index) { return pathBearing(path, index); });
    var radii = ages.map(function (age) {
      return horizontalSpreadKm(age, Object.assign({}, options, { radiusFactor: factor }));
    });
    var left = path.map(function (coordinate, index) {
      return offsetCoordinate(coordinate, tangents[index] - 90, radii[index]);
    });
    var right = path.map(function (coordinate, index) {
      return offsetCoordinate(coordinate, tangents[index] + 90, radii[index]);
    });
    var ring = [];
    left.forEach(function (coordinate) { pushCoordinate(ring, coordinate); });

    var endIndex = path.length - 1;
    for (var endStep = 1; endStep <= capSegments; endStep += 1) {
      pushCoordinate(
        ring,
        offsetCoordinate(
          path[endIndex],
          tangents[endIndex] - 90 + 180 * endStep / capSegments,
          radii[endIndex]
        )
      );
    }
    for (var rightIndex = right.length - 2; rightIndex >= 0; rightIndex -= 1) {
      pushCoordinate(ring, right[rightIndex]);
    }
    for (var startStep = 1; startStep <= capSegments; startStep += 1) {
      pushCoordinate(
        ring,
        offsetCoordinate(
          path[0],
          tangents[0] + 90 + 180 * startStep / capSegments,
          radii[0]
        )
      );
    }
    if (ring.length < 4) return null;
    pushCoordinate(ring, ring[0]);
    if (ring[ring.length - 1][0] !== ring[0][0] || ring[ring.length - 1][1] !== ring[0][1]) {
      ring.push(ring[0].slice());
    }

    var initialRadius = horizontalSpreadKm(0, Object.assign({}, options, { radiusFactor: factor }));
    var endRadius = horizontalSpreadKm(duration, Object.assign({}, options, { radiusFactor: factor }));
    return {
      type: "Feature",
      properties: {
        source_index: trajectory.sourceIndex,
        pressure_hpa: trajectory.level && trajectory.level.pressure,
        altitude_m: trajectory.level && trajectory.level.altitude,
        envelope_band: options.band || "core",
        radius_factor: factor,
        initial_radius_km: initialRadius,
        end_radius_km: endRadius,
        sigma_growth_km_per_hour: finite(options.sigmaGrowthKmPerHour) || DEFAULT_ENVELOPE.sigmaGrowthKmPerHour,
        duration_hours: duration
      },
      geometry: { type: "Polygon", coordinates: [ring] }
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
    DEFAULT_ENVELOPE: DEFAULT_ENVELOPE,
    DEFAULT_LEVELS: DEFAULT_LEVELS,
    bearingBetween: bearingBetween,
    buildEnvelopePolygon: buildEnvelopePolygon,
    buildGrid: buildGrid,
    buildTrajectories: buildTrajectories,
    buildWindIndex: buildWindIndex,
    clusterSources: clusterSources,
    destination: destination,
    distanceKm: distanceKm,
    featureTime: featureTime,
    horizontalSpreadKm: horizontalSpreadKm,
    isVegetationOrUnclassified: isVegetationOrUnclassified,
    sampleWind: sampleWind,
    travelVector: travelVector
  };
});

