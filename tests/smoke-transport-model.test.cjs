const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../js/smoke-transport-model.js");

function feature({ lat, lon, time, satellite, frp = 1, type = "" }) {
  const date = new Date(time);
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: {
      acq_date: date.toISOString().slice(0, 10),
      acq_time: date.toISOString().slice(11, 16).replace(":", ""),
      satellite,
      frp,
      type
    }
  };
}

function windRow(lat, lon, times, speedByLevel, directionByLevel) {
  const levels = {};
  ["950", "925", "850"].forEach((level) => {
    levels[level] = {
      speeds: speedByLevel[level],
      directions: directionByLevel[level]
    };
  });
  return { gridLat: lat, gridLon: lon, times, levels };
}

test("groups only close detections from different satellites", () => {
  const start = Date.parse("2026-08-11T00:00:00Z");
  const sources = model.clusterSources([
    feature({ lat: 1, lon: 102, time: start, satellite: "N20", frp: 8 }),
    feature({ lat: 1.004, lon: 102.004, time: start + 30 * 60000, satellite: "N21", frp: 12 }),
    feature({ lat: 1.005, lon: 102.005, time: start + 40 * 60000, satellite: "N20", frp: 6 }),
    feature({ lat: 1, lon: 102, time: start, satellite: "MODIS", type: "1" })
  ]);

  assert.equal(sources.length, 2);
  assert.deepEqual(
    sources.map((source) => source.properties.source_count).sort(),
    [1, 2]
  );
  const merged = sources.find((source) => source.properties.source_count === 2);
  assert.deepEqual(merged.properties.satellites, ["N20", "N21"]);
  assert.equal(merged.properties.frp, 12);
});

test("withholds a lone unclassified hotspot from transport modelling", () => {
  const result = model.screenSourceComplex({count:1,satelliteCount:1,passCount:1,frp:25,types:{}});
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(" "), /single unclassified/);
});

test("accepts corroborated unclassified sources and rejects built-up land cover", () => {
  const source = {count:2,satelliteCount:2,passCount:2,frp:18,types:{}};
  assert.equal(model.screenSourceComplex(source).eligible, true);
  const builtUp = model.screenSourceComplex({...source,landCoverClass:50});
  assert.equal(builtUp.eligible, false);
  assert.match(builtUp.reasons.join(" "), /built-up/);
});

test("accepts an explicit FIRMS vegetation-fire type", () => {
  const result = model.screenSourceComplex({count:1,satelliteCount:1,passCount:1,frp:2,types:{"0":true}});
  assert.equal(result.eligible, true);
  assert.match(result.evidence, /vegetation-fire/);
});
test("converts meteorological wind-from direction to travel direction", () => {
  const vector = model.travelVector(10, 0);
  assert.ok(Math.abs(vector.east) < 1e-9);
  assert.ok(Math.abs(vector.north + 10) < 1e-9);
});

test("interpolates wind as vector components in space and time", () => {
  const t0 = Date.parse("2026-08-11T00:00:00Z");
  const t1 = t0 + 3600000;
  const rows = [];
  [0, 1].forEach((lat) => [100, 101].forEach((lon) => {
    rows.push(windRow(
      lat,
      lon,
      [t0, t1],
      { "950": [10, 20], "925": [10, 20], "850": [10, 20] },
      { "950": [0, 0], "925": [0, 0], "850": [0, 0] }
    ));
  }));
  const index = model.buildWindIndex(rows, 1);
  const sample = model.sampleWind(index, 0.5, 100.5, t0 + 1800000, "925");

  assert.ok(Math.abs(sample.speed - 15) < 1e-9);
  assert.ok(Math.abs(sample.travelDirection - 180) < 1e-9);
});

test("builds one trajectory per configured pressure level", () => {
  const t0 = Date.parse("2026-08-11T00:00:00Z");
  const t1 = t0 + 3600000;
  const rows = [];
  [-1, 0, 1].forEach((lat) => [100, 101, 102].forEach((lon) => {
    rows.push(windRow(
      lat,
      lon,
      [t0, t1],
      { "950": [10, 10], "925": [10, 10], "850": [10, 10] },
      { "950": [0, 0], "925": [0, 0], "850": [0, 0] }
    ));
  }));
  const index = model.buildWindIndex(rows, 1);
  const source = feature({ lat: 0, lon: 101, time: t0, satellite: "N20" });
  const trajectories = model.buildTrajectories([source], index, t1, { maxHours: 1 });

  assert.equal(trajectories.length, 3);
  trajectories.forEach((trajectory) => {
    assert.ok(Math.abs(trajectory.travelKm - 10) < 0.05);
    assert.deepEqual(trajectory.agesHours, [0, 1]);
    const last = trajectory.path[trajectory.path.length - 1];
    assert.ok(last[1] < 0);
  });
});

test("marks boundary-truncated paths and completes them after northward expansion", () => {
  const t0 = Date.parse("2026-08-11T00:00:00Z");
  const times = [t0, t0 + 3600000, t0 + 7200000];
  function rowsFor(latitudes) {
    const rows = [];
    latitudes.forEach((lat) => [100, 101, 102].forEach((lon) => {
      rows.push(windRow(
        lat,
        lon,
        times,
        { "950": [100, 100, 100], "925": [100, 100, 100], "850": [100, 100, 100] },
        { "950": [180, 180, 180], "925": [180, 180, 180], "850": [180, 180, 180] }
      ));
    }));
    return rows;
  }
  const source = feature({ lat: 0.5, lon: 101, time: t0, satellite: "N20" });
  const limited = model.buildTrajectories(
    [source],
    model.buildWindIndex(rowsFor([0, 1, 2]), 1),
    times[2],
    { maxHours: 2 }
  );
  const limitedSides = model.boundarySides(limited);

  assert.equal(limitedSides.count, 3);
  assert.equal(limitedSides.north, true);
  assert.ok(limited.every((trajectory) => trajectory.terminationReason === "boundary"));

  const expanded = model.buildTrajectories(
    [source],
    model.buildWindIndex(rowsFor([0, 1, 2, 3, 4]), 1),
    times[2],
    { maxHours: 2 }
  );
  assert.equal(model.boundarySides(expanded).count, 0);
  assert.ok(expanded.every((trajectory) => trajectory.complete));
});

test("builds and expands a source-driven cross-border domain within hard limits", () => {
  const source = feature({
    lat: 5.5,
    lon: 95.3,
    time: Date.parse("2026-08-11T00:00:00Z"),
    satellite: "N20"
  });
  const limits = { minLat: -35, maxLat: 15, minLon: 70, maxLon: 170 };
  const initial = model.boundsForSources([source], { paddingDegrees: 6, limits });

  assert.deepEqual(initial, { minLat: -0.5, maxLat: 11.5, minLon: 89.3, maxLon: 101.3 });
  assert.deepEqual(
    model.expandBounds(initial, { north: true }, { degrees: 7.5, limits }),
    { minLat: -0.5, maxLat: 15, minLon: 89.3, maxLon: 101.3 }
  );
});

test("ties the contour smoothing bandwidth to sampled wind-grid spacing", () => {
  assert.ok(Math.abs(model.contourBandwidthKm({ windGridStepDegrees: 1.5 }) - 49.95) < 1e-9);
  assert.equal(model.contourBandwidthKm({ windGridStepDegrees: 0.1 }), 25);
});

test("gives every clustered source equal total contour weight", () => {
  const trajectories = [];
  [0, 1].forEach((sourceIndex) => {
    [950, 925, 850].forEach((pressure, levelIndex) => {
      trajectories.push({
        sourceIndex,
        level: { pressure },
        path: [[101, levelIndex * 0.01], [101.1, levelIndex * 0.01], [101.2, levelIndex * 0.01]],
        agesHours: [0, 1, 2]
      });
    });
  });
  const puffs = model.buildSupportPuffs(trajectories, { windGridStepDegrees: 1.5 });
  const sourceWeights = puffs.reduce((weights, puff) => {
    weights[puff.sourceIndex] = (weights[puff.sourceIndex] || 0) + puff.weight;
    return weights;
  }, {});

  assert.equal(puffs.length, 18);
  assert.ok(Math.abs(sourceWeights[0] - 1) < 1e-12);
  assert.ok(Math.abs(sourceWeights[1] - 1) < 1e-12);
  assert.ok(puffs.every((puff) => Math.abs(puff.sigmaKm - 49.95) < 1e-9));
});

test("builds a rectangular normalized support grid with ordered isoband breaks", () => {
  function trajectoriesFor(sourceIndex) {
    return [950, 925, 850].map((pressure, levelIndex) => ({
      sourceIndex,
      level: { pressure },
      path: [[101, levelIndex * 0.02], [101.2, levelIndex * 0.02], [101.4, levelIndex * 0.02]],
      agesHours: [0, 1, 2]
    }));
  }
  const oneSourcePuffs = model.buildSupportPuffs(trajectoriesFor(0), { windGridStepDegrees: 1 });
  const twoSourcePuffs = model.buildSupportPuffs(
    trajectoriesFor(0).concat(trajectoriesFor(1)),
    { windGridStepDegrees: 1 }
  );
  const domain = { minLat: -2, maxLat: 2, minLon: 99, maxLon: 103 };
  const oneSource = model.buildSupportGrid(oneSourcePuffs, domain, { gridStepDegrees: 0.2 });
  const twoSources = model.buildSupportGrid(twoSourcePuffs, domain, { gridStepDegrees: 0.2 });
  const values = twoSources.grid.features.map((item) => item.properties.support);

  assert.equal(twoSources.pointCount, twoSources.rowCount * twoSources.columnCount);
  assert.equal(twoSources.breaks.length, 5);
  assert.ok(twoSources.breaks.every((value, index, all) => index === 0 || value > all[index - 1]));
  assert.ok(Math.abs(Math.max(...values) - 1) < 1e-12);
  assert.ok(Math.min(...values) >= 0);
  assert.ok(twoSources.rawMax > oneSource.rawMax * 1.99);
  assert.equal(twoSources.gridStepDegrees, 0.2);
});

test("lets the support grid close naturally beyond the former Indonesia ceiling", () => {
  const puffs = [{
    lat: 6.1,
    lon: 95.4,
    sigmaKm: 50,
    weight: 1,
    sourceIndex: 0,
    ageHours: 0,
    pressureHpa: 925
  }];
  const natural = model.buildSupportGrid(puffs, null, { gridStepDegrees: 0.25 });
  const clipped = model.buildSupportGrid(
    puffs,
    { minLat: -11.2, maxLat: 6.2, minLon: 94.5, maxLon: 141.5 },
    { gridStepDegrees: 0.25 }
  );
  const northEdge = natural.grid.features.filter((point) => point.geometry.coordinates[1] === natural.bounds.maxLat);

  assert.ok(natural.bounds.maxLat > 6.2);
  assert.equal(natural.clipped, false);
  assert.equal(clipped.clipped, true);
  assert.ok(northEdge.length > 0);
  assert.ok(northEdge.every((point) => point.properties.support === 0));
});

test("uses a materially denser national sampling grid", () => {
  const grid = model.buildGrid(
    { minLat: -11.2, maxLat: 6.2, minLon: 94.5, maxLon: 141.5 },
    1.5
  );
  assert.ok(grid.length > 400);
  assert.ok(grid.length < 600);
});
