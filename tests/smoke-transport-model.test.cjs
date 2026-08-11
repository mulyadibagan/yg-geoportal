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

test("grows the horizontal sensitivity radius with parcel age", () => {
  assert.equal(model.horizontalSpreadKm(0), 1.5);
  assert.ok(Math.abs(model.horizontalSpreadKm(6) - 12.618) < 1e-9);
  assert.ok(Math.abs(model.horizontalSpreadKm(6, { radiusFactor: 1.54 }) - 19.43172) < 1e-9);
});

test("builds closed variable-width polygon envelopes", () => {
  const trajectory = {
    sourceIndex: 2,
    level: { pressure: 925, altitude: 800 },
    path: [[101, 0], [101.1, 0], [101.2, 0.05]],
    agesHours: [0, 1, 2],
    durationHours: 2
  };
  const core = model.buildEnvelopePolygon(trajectory, { band: "core", radiusFactor: 1 });
  const outer = model.buildEnvelopePolygon(trajectory, { band: "outer", radiusFactor: 1.54 });

  assert.equal(core.geometry.type, "Polygon");
  assert.ok(core.geometry.coordinates[0].length > trajectory.path.length * 2);
  assert.deepEqual(
    core.geometry.coordinates[0][0],
    core.geometry.coordinates[0][core.geometry.coordinates[0].length - 1]
  );
  assert.equal(core.properties.source_index, 2);
  assert.equal(core.properties.pressure_hpa, 925);
  assert.ok(outer.properties.end_radius_km > core.properties.end_radius_km);
});

test("uses a materially denser national sampling grid", () => {
  const grid = model.buildGrid(
    { minLat: -11.2, maxLat: 6.2, minLon: 94.5, maxLon: 141.5 },
    1.5
  );
  assert.ok(grid.length > 400);
  assert.ok(grid.length < 600);
});
