import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");
const BBOX = { south: 2.02919, west: 100.77819, north: 2.19169, east: 101.02419 };
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];
const USER_AGENT = "Yayasan-Gambut-RDTR-internal-evidence/1.0";

function facilityCategory(tags = {}) {
  const amenity = tags.amenity || "";
  if (tags.healthcare || ["hospital", "clinic", "doctors", "pharmacy"].includes(amenity)) return "health";
  if (["school", "college", "university", "kindergarten", "library"].includes(amenity)) return "education";
  if (["fire_station", "police", "ranger_station", "shelter"].includes(amenity) || tags.emergency) return "emergency_security";
  if (["townhall", "courthouse", "public_building", "post_office"].includes(amenity) || tags.office === "government") return "government";
  if (["marketplace", "community_centre", "social_facility"].includes(amenity)) return "community_market";
  if (["place_of_worship"].includes(amenity)) return "worship";
  if (tags.public_transport === "ferry_terminal" || tags.man_made === "pier" || amenity === "ferry_terminal") return "transport_waterfront";
  if (["drinking_water", "water_point", "wastewater_plant"].includes(amenity) || tags.man_made === "water_works") return "water_sanitation";
  if (["waste_transfer_station", "recycling"].includes(amenity) || tags.landuse === "landfill") return "waste";
  return "other_public";
}

function isCritical(tags = {}) {
  const amenity = tags.amenity || "";
  return Boolean(tags.healthcare || tags.emergency || [
    "hospital", "clinic", "doctors", "fire_station", "police", "shelter", "townhall", "ferry_terminal"
  ].includes(amenity) || tags.public_transport === "ferry_terminal");
}

function centerOf(element) {
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) return [element.lon, element.lat];
  if (Number.isFinite(element.center?.lat) && Number.isFinite(element.center?.lon)) return [element.center.lon, element.center.lat];
  const geometry = element.geometry || [];
  if (!geometry.length) return null;
  const totals = geometry.reduce((sum, point) => [sum[0] + point.lon, sum[1] + point.lat], [0, 0]);
  return [totals[0] / geometry.length, totals[1] / geometry.length];
}

async function overpass(query) {
  let lastError;
  for (const endpoint of ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": USER_AGENT },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = await response.json();
      if (!Array.isArray(data.elements)) throw new Error("Overpass response has no elements array");
      return { data, endpoint };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`All Overpass endpoints failed: ${lastError?.message || "unknown error"}`);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

export async function fetchEvidence({ facilitiesOutput, hydrologyOutput, fetcher = overpass } = {}) {
  const bbox = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
  const facilityQuery = `[out:json][timeout:120];(nwr["amenity"](${bbox});nwr["healthcare"](${bbox});nwr["emergency"](${bbox});nwr["office"="government"](${bbox});nwr["public_transport"="ferry_terminal"](${bbox});nwr["man_made"="pier"](${bbox});nwr["man_made"="water_works"](${bbox});nwr["landuse"="landfill"](${bbox}););out center tags;`;
  const hydrologyQuery = `[out:json][timeout:120];(way["waterway"](${bbox});way["tunnel"="culvert"](${bbox});way["water"](${bbox}););out geom tags;`;
  const [facilitiesResult, hydrologyResult] = await Promise.all([fetcher(facilityQuery), fetcher(hydrologyQuery)]);
  if (facilitiesResult.data.elements.length > 10000 || hydrologyResult.data.elements.length > 10000) {
    throw new Error("OSM evidence exceeded 10,000 feature safety cap");
  }
  const seenFacilities = new Set();
  const facilities = facilitiesResult.data.elements.flatMap(element => {
    const key = `${element.type}/${element.id}`;
    if (seenFacilities.has(key)) return [];
    seenFacilities.add(key);
    const coordinates = centerOf(element);
    if (!coordinates) return [];
    const tags = element.tags || {};
    return [{
      type: "Feature",
      properties: {
        id: `OSM-${String(element.type).toUpperCase()}-${element.id}`,
        osmType: element.type,
        osmId: element.id,
        name: tags.name || "Fasilitas tanpa nama pada OSM",
        category: facilityCategory(tags),
        critical: isCritical(tags),
        amenity: tags.amenity || "",
        healthcare: tags.healthcare || "",
        emergency: tags.emergency || "",
        publicTransport: tags.public_transport || "",
        manMade: tags.man_made || "",
        source: "OpenStreetMap contributors via Overpass",
        evidenceStatus: "open_data_screening_needs_verification",
        legalEffect: "none"
      },
      geometry: { type: "Point", coordinates }
    }];
  });
  const hydrology = hydrologyResult.data.elements.flatMap(element => {
    const coordinates = (element.geometry || []).map(point => [point.lon, point.lat]);
    if (coordinates.length < 2) return [];
    const tags = element.tags || {};
    return [{
      type: "Feature",
      properties: {
        id: `OSM-WAY-${element.id}`,
        osmId: element.id,
        name: tags.name || "Alur tanpa nama pada OSM",
        waterway: tags.waterway || "",
        water: tags.water || "",
        tunnel: tags.tunnel || "",
        intermittent: tags.intermittent || "",
        source: "OpenStreetMap contributors via Overpass",
        evidenceStatus: "open_data_screening_needs_hydrological_verification",
        legalEffect: "none"
      },
      geometry: { type: "LineString", coordinates }
    }];
  });
  const generatedAt = new Date().toISOString();
  const common = {
    access: "staff_only",
    generatedAt,
    bbox: [BBOX.west, BBOX.south, BBOX.east, BBOX.north],
    source: "OpenStreetMap contributors via Overpass",
    disclaimer: "Bukti terbuka untuk penyaringan internal; bukan data fasilitas, jaringan, kewenangan, kapasitas, atau hidrologi resmi."
  };
  const facilityCollection = { type: "FeatureCollection", name: "Fasilitas OSM Bagansiapiapi untuk RDTR YG", metadata: { ...common, endpoint: facilitiesResult.endpoint }, features: facilities };
  const hydrologyCollection = { type: "FeatureCollection", name: "Hidrologi OSM Bagansiapiapi untuk RDTR YG", metadata: { ...common, endpoint: hydrologyResult.endpoint }, features: hydrology };
  if (facilitiesOutput) writeJson(facilitiesOutput, facilityCollection);
  if (hydrologyOutput) writeJson(hydrologyOutput, hydrologyCollection);
  return { facilities: facilityCollection, hydrology: hydrologyCollection };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const facilitiesOutput = process.argv[2] || path.join(REPO_ROOT, "data/rdtr-bagansiapiapi-facilities-osm.geojson");
  const hydrologyOutput = process.argv[3] || path.join(REPO_ROOT, "data/rdtr-bagansiapiapi-hydrology-osm.geojson");
  const result = await fetchEvidence({ facilitiesOutput, hydrologyOutput });
  console.log(JSON.stringify({ facilities: result.facilities.features.length, hydrology: result.hydrology.features.length, facilitiesOutput, hydrologyOutput }));
}
