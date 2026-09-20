import assert from "node:assert/strict";
import test from "node:test";
import { fetchEvidence } from "../scripts/fetch-rdtr-bagansiapiapi-osm-evidence.mjs";

test("normalizes bounded OSM facilities and hydrology without claiming official status", async () => {
  const responses = [
    { data: { elements: [
      { type: "node", id: 1, lat: 2.1, lon: 100.8, tags: { amenity: "hospital", name: "RS Uji" } },
      { type: "way", id: 2, center: { lat: 2.11, lon: 100.81 }, tags: { amenity: "school", name: "Sekolah Uji" } },
      { type: "node", id: 1, lat: 2.1, lon: 100.8, tags: { amenity: "hospital", name: "Duplikat" } }
    ] }, endpoint: "fixture://facilities" },
    { data: { elements: [
      { type: "way", id: 3, geometry: [{ lat: 2.09, lon: 100.79 }, { lat: 2.12, lon: 100.82 }], tags: { waterway: "river", name: "Sungai Uji" } }
    ] }, endpoint: "fixture://hydrology" }
  ];
  const result = await fetchEvidence({ fetcher: async () => responses.shift() });
  assert.equal(result.facilities.features.length, 2);
  assert.equal(result.hydrology.features.length, 1);
  assert.equal(result.facilities.features[0].properties.category, "health");
  assert.equal(result.facilities.features[0].properties.critical, true);
  assert.equal(result.facilities.features[1].properties.category, "education");
  assert.equal(result.hydrology.features[0].properties.waterway, "river");
  assert.ok(result.facilities.features.every(feature => feature.properties.legalEffect === "none"));
  assert.match(result.facilities.metadata.disclaimer, /bukan data fasilitas/);
});
