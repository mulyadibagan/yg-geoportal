import json
import math
import os
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta

import rasterio

INPUT = sys.argv[1] if len(sys.argv) > 1 else "data/hotspot-high-confidence.geojson"
OUTPUT = sys.argv[2] if len(sys.argv) > 2 else INPUT
MAX_AGE_HOURS = int(os.environ.get("WORLDCOVER_MAX_AGE_HOURS", "36"))
BASE = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map"
LABELS = {
    10: "tree cover", 20: "shrubland", 30: "grassland", 40: "cropland",
    50: "built-up", 60: "bare / sparse vegetation", 70: "snow and ice",
    80: "permanent water", 90: "herbaceous wetland", 95: "mangroves",
    100: "moss and lichen",
}


def observed_at(feature):
    props = feature.get("properties", {})
    value = str(props.get("acq_time") or "0000").zfill(4)
    return datetime.fromisoformat(f"{props.get('acq_date')}T{value[:2]}:{value[2:4]}:00+00:00")


def tile_origin(value):
    return math.floor(value / 3) * 3


def tile_url(lon, lat):
    south, west = tile_origin(lat), tile_origin(lon)
    ns = f"N{south:02d}" if south >= 0 else f"S{abs(south):02d}"
    ew = f"E{west:03d}" if west >= 0 else f"W{abs(west):03d}"
    name = f"ESA_WorldCover_10m_2021_v200_{ns}{ew}_Map.tif"
    return f"{BASE}/{name}"


def history_key(lon, lat):
    return round(lat * 200) / 200, round(lon * 200) / 200


with open(INPUT, encoding="utf-8") as handle:
    geojson = json.load(handle)

cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)
recent = []
history = defaultdict(set)
for feature in geojson.get("features", []):
    lon, lat = feature["geometry"]["coordinates"]
    history[history_key(lon, lat)].add(str(feature.get("properties", {}).get("acq_date") or ""))
    try:
        if observed_at(feature) >= cutoff:
            recent.append(feature)
    except (TypeError, ValueError):
        pass

by_tile = defaultdict(list)
for feature in recent:
    lon, lat = feature["geometry"]["coordinates"]
    by_tile[tile_url(lon, lat)].append(feature)

def sample_tile(item):
    url, features = item
    try:
        with rasterio.Env(GDAL_HTTP_TIMEOUT="30", GDAL_HTTP_MAX_RETRY="2"):
            with rasterio.open(url) as dataset:
                coordinates = [tuple(feature["geometry"]["coordinates"]) for feature in features]
                values = [int(sample[0]) for sample in dataset.sample(coordinates)]
        for feature, value in zip(features, values):
            lon, lat = feature["geometry"]["coordinates"]
            days = len(history[history_key(lon, lat)])
            feature["properties"].update({
                "land_cover_class": value if value in LABELS else None,
                "land_cover_label": LABELS.get(value, "unknown class"),
                "land_cover_source": "ESA WorldCover 2021 v200 COG",
                "land_cover_checked_at": datetime.now(timezone.utc).isoformat(),
                "persistent_thermal_candidate": days >= 5,
                "thermal_detection_days_30d": days,
            })
        return None
    except Exception as error:
        for feature in features:
            feature["properties"].update({
                "land_cover_class": None,
                "land_cover_label": "lookup unavailable",
                "land_cover_source": "ESA WorldCover 2021 v200 COG",
                "land_cover_checked_at": datetime.now(timezone.utc).isoformat(),
            })
        return {"tile": url.rsplit("/", 1)[-1], "error": str(error)}

workers = max(1, int(os.environ.get("WORLDCOVER_WORKERS", "8")))
with ThreadPoolExecutor(max_workers=workers) as executor:
    failures = [failure for failure in executor.map(sample_tile, by_tile.items()) if failure]
geojson["landCoverScreening"] = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "product": "ESA WorldCover 2021 v200",
    "access": "Direct public Cloud-Optimized GeoTIFF",
    "maxAgeHours": MAX_AGE_HOURS,
    "enrichedFeatures": len(recent),
    "queriedTiles": len(by_tile),
    "failedTiles": failures,
    "method": "Native categorical class sampled at each FIRMS point from the public 10 m COG.",
    "limitation": "WorldCover describes 2021 land cover and is a screening covariate, not fire verification.",
    "license": "CC BY 4.0",
    "attribution": "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium",
}

with open(OUTPUT, "w", encoding="utf-8", newline="\n") as handle:
    json.dump(geojson, handle, ensure_ascii=False, indent=2)
    handle.write("\n")

print(json.dumps(geojson["landCoverScreening"], ensure_ascii=False))
