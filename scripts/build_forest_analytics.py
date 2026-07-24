import concurrent.futures
import datetime
import json
import math
import os
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Geod
from rasterio.mask import mask
from shapely import force_2d
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEOSTORE_URL = "https://production-api.globalforestwatch.org/geostore"
ANALYSIS_URL = "https://production-api.globalforestwatch.org/umd-loss-gain"
GFW_DATASET_URL = "https://data-api.globalforestwatch.org/dataset/umd_tree_cover_loss"
LOSS_WINDOW_YEARS = 10
LOSS_DATASET_VERSION = None
LOSS_END_YEAR = None
HANSEN_TILE_FILES = {}
GEOD = Geod(ellps="WGS84")
VILLAGE_GEOJSON_FILES = [
    Path(path.strip())
    for path in (
        os.getenv("FOREST_VILLAGE_GEOJSON")
        or os.getenv("FIRMS_VILLAGE_GEOJSON")
        or "data/desa_intervensi.geojson"
    ).split(",")
    if path.strip()
]


def request_json(url, payload=None, attempts=4, extra_headers=None):
    body = None
    headers = {"Accept": "application/json", "User-Agent": "YG-GeoPortal/1.0"}
    if extra_headers:
        headers.update(extra_headers)
    if payload is not None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, data=body, headers=headers)
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            if attempt == attempts - 1:
                raise
            time.sleep(2 ** attempt)


def tile_name(latitude, longitude):
    lat_suffix = "N" if latitude >= 0 else "S"
    lon_suffix = "E" if longitude >= 0 else "W"
    return f"{abs(latitude):02d}{lat_suffix}_{abs(longitude):03d}{lon_suffix}"


def geometry_tiles(geometry):
    min_x, min_y, max_x, max_y = shape(geometry).bounds
    lon_start = math.floor(min_x / 10) * 10
    lon_end = math.floor((max_x - 1e-10) / 10) * 10
    lat_top = math.ceil(max_y / 10) * 10
    lat_bottom = math.ceil((min_y + 1e-10) / 10) * 10
    return [
        tile_name(latitude, longitude)
        for latitude in range(lat_top, lat_bottom - 1, -10)
        for longitude in range(lon_start, lon_end + 1, 10)
    ]


def pixel_area_ha(transform, row):
    left = transform.c
    right = left + transform.a
    top = transform.f + row * transform.e
    bottom = top + transform.e
    area, _ = GEOD.polygon_area_perimeter(
        [left, right, right, left],
        [top, top, bottom, bottom],
    )
    return abs(area) / 10000


def analyze_hansen_rasters(geometry):
    window_end_year = datetime.datetime.now(datetime.timezone.utc).year
    loss_start_year = window_end_year - LOSS_WINDOW_YEARS + 1
    annual = {
        str(year): (0.0 if year <= LOSS_END_YEAR else None)
        for year in range(loss_start_year, window_end_year + 1)
    }
    baseline = 0.0
    total_loss = 0.0
    for tile in geometry_tiles(geometry):
        files = HANSEN_TILE_FILES.get(tile)
        if not files:
            continue
        with rasterio.open(files["treecover2000"]) as cover_source:
            cover, transform = mask(
                cover_source,
                [geometry],
                crop=True,
                filled=True,
                nodata=0,
            )
        with rasterio.open(files["lossyear"]) as loss_source:
            loss, loss_transform = mask(
                loss_source,
                [geometry],
                crop=True,
                filled=True,
                nodata=0,
            )
        if cover.shape != loss.shape or transform != loss_transform:
            raise RuntimeError(f"Grid Hansen tidak sejajar untuk tile {tile}.")
        cover = cover[0]
        loss = loss[0]
        forest_mask = cover >= 30
        for row in range(cover.shape[0]):
            area_ha = pixel_area_ha(transform, row)
            baseline += int(np.count_nonzero(forest_mask[row])) * area_ha
            row_loss = loss[row][forest_mask[row]]
            total_loss += int(np.count_nonzero(row_loss > 0)) * area_ha
            for year in range(loss_start_year, min(LOSS_END_YEAR, window_end_year) + 1):
                year_code = year - 2000
                count = int(np.count_nonzero(row_loss == year_code))
                annual[str(year)] += count * area_ha
    annual = {
        year: (round(value, 2) if value is not None else None)
        for year, value in annual.items()
    }
    return round(baseline, 2), round(total_loss, 2), annual


def latest_loss_dataset():
    dataset = request_json(GFW_DATASET_URL).get("data") or {}
    versions = dataset.get("versions") or []

    def version_parts(value):
        try:
            return tuple(int(part) for part in value.lstrip("v").split("."))
        except ValueError:
            return ()

    version = max(versions, key=version_parts)
    fields = request_json(f"{GFW_DATASET_URL}/{version}/fields").get("data") or []
    year_field = next(
        (
            field
            for field in fields
            if field.get("pixel_meaning") == "umd_tree_cover_loss__year"
        ),
        None,
    )
    rows = ((year_field or {}).get("values_table") or {}).get("rows") or []
    years = [
        int(row["meaning"])
        for row in rows
        if str(row.get("meaning", "")).isdigit()
    ]
    if not years:
        raise RuntimeError("Tahun terbaru dataset GFW tidak dapat diidentifikasi.")
    return version, max(years)


def download_hansen_tiles(items, target_dir):
    needed_tiles = sorted(
        {
            tile
            for item in items
            for tile in geometry_tiles(mapping(force_2d(shape(item[3]["geometry"]))))
        }
    )
    dataset_tag = f"GFC-{LOSS_END_YEAR}-{LOSS_DATASET_VERSION}"
    base_url = (
        "https://storage.googleapis.com/earthenginepartners-hansen/"
        f"{dataset_tag}"
    )
    for tile in needed_tiles:
        HANSEN_TILE_FILES[tile] = {}
        for layer in ("treecover2000", "lossyear"):
            filename = f"Hansen_{dataset_tag}_{layer}_{tile}.tif"
            target = Path(target_dir) / filename
            print(f"Download {layer} {tile}", flush=True)
            urllib.request.urlretrieve(f"{base_url}/{filename}", target)
            HANSEN_TILE_FILES[tile][layer] = target
    return needed_tiles


def text(value):
    return str(value or "").strip()


def village_key(properties):
    stable = (
        properties.get("Village_ID")
        or properties.get("VILLAGE_ID")
        or properties.get("Kode_Desa")
        or properties.get("KODE_DESA")
    )
    if stable:
        return text(stable).lower()
    return "|".join(
        filter(
            None,
            [
                text(properties.get("WADMKD") or properties.get("Desa")),
                text(properties.get("WADMKC") or properties.get("Kecamatan")),
                text(properties.get("WADMKK") or properties.get("Kabupaten")),
            ],
        )
    ).lower()


def social_forestry_key(properties):
    stable = (
        properties.get("OBJECTID")
        or properties.get("ID")
        or properties.get("NO_IUPHKM")
        or properties.get("SK")
    )
    if stable:
        return text(stable).lower()
    return "|".join(
        filter(
            None,
            [
                text(properties.get("NAMA_HKM")),
                text(properties.get("NAMA_DESA")),
                text(properties.get("NAMA_KAB")),
            ],
        )
    ).lower()


def analyze(item):
    collection, key, name, feature = item
    geometry_2d = mapping(force_2d(shape(feature["geometry"])))
    geostore = request_json(
        GEOSTORE_URL,
        {"geojson": {"type": "Feature", "properties": {}, "geometry": geometry_2d}},
    )
    geostore_id = geostore["data"]["id"]
    query = urllib.parse.urlencode(
        {
            "period": "2001-01-01,2025-12-31",
            "geostore": geostore_id,
            "aggregate_values": "false",
            "thresh": "30",
        }
    )
    result = request_json(f"{ANALYSIS_URL}?{query}")
    values = result["data"]["attributes"]
    raster_baseline, total_loss, annual = analyze_hansen_rasters(geometry_2d)
    baseline = raster_baseline
    gain = round(float(values.get("gain") or 0), 2)
    current = round(max(0, baseline - total_loss + gain), 2)
    return collection, key, {
        "name": name,
        "geostoreId": geostore_id,
        "baselineForestHa": baseline,
        "currentForestHa": current,
        "totalLossHa": total_loss,
        "gainHa": gain,
        "annualLossHa": annual,
    }


def load_items():
    items = []
    seen_village_keys = set()
    for relative_path in VILLAGE_GEOJSON_FILES:
        with (ROOT / relative_path).open(encoding="utf-8") as source:
            villages = json.load(source)
        for feature in villages.get("features", []):
            properties = feature.get("properties") or {}
            key = village_key(properties)
            if not key or key in seen_village_keys:
                continue
            seen_village_keys.add(key)
            name = text(properties.get("WADMKD") or properties.get("Desa") or properties.get("NAMOBJ"))
            items.append(("villages", key, name, feature))

    with (ROOT / "data" / "PERHUTANAN_SOSIAL_RIAU.geojson").open(encoding="utf-8") as source:
        social_forestry = json.load(source)
    grouped = {}
    for feature in social_forestry.get("features", []):
        properties = feature.get("properties") or {}
        name = text(properties.get("NAMA_HKM") or properties.get("NAMA_DESA") or properties.get("NAMA_KEC"))
        key = social_forestry_key(properties)
        grouped.setdefault(key, {"name": name, "geometries": []})["geometries"].append(
            shape(feature["geometry"])
        )
    for key, group in grouped.items():
        merged = unary_union(group["geometries"])
        items.append(
            (
                "socialForestry",
                key,
                group["name"],
                {"type": "Feature", "properties": {}, "geometry": mapping(merged)},
            )
        )
    return items


def main():
    global LOSS_DATASET_VERSION, LOSS_END_YEAR
    LOSS_DATASET_VERSION, LOSS_END_YEAR = latest_loss_dataset()
    window_end_year = datetime.datetime.now(datetime.timezone.utc).year
    loss_start_year = window_end_year - LOSS_WINDOW_YEARS + 1
    print(
        f"GFW tree-cover loss {LOSS_DATASET_VERSION}; "
        f"rolling window {loss_start_year}-{window_end_year}; "
        f"data through {LOSS_END_YEAR}",
        flush=True,
    )
    items = load_items()
    with tempfile.TemporaryDirectory(prefix="yg-hansen-") as raster_dir:
        tiles = download_hansen_tiles(items, raster_dir)
        print(f"Hansen tiles: {', '.join(tiles)}", flush=True)
        output = {
            "schemaVersion": 2,
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "method": {
                "forestDefinition": "Hansen tree cover extent with canopy density at or above 30 percent",
                "baselineYear": 2000,
                "lossPeriod": f"{loss_start_year}-{window_end_year}",
                "lossWindowYears": LOSS_WINDOW_YEARS,
                "lossWindowEndYear": window_end_year,
                "lossDataThroughYear": LOSS_END_YEAR,
                "lossDatasetVersion": f"umd_tree_cover_loss {LOSS_DATASET_VERSION}",
                "currentForestFormula": "baselineForestHa - totalLossHa + gainHa",
                "areaUnit": "ha",
                "source": "Hansen/UMD/Google/USGS/NASA public raster download",
            },
            "villages": {},
            "socialForestry": {},
            "errors": [],
        }
        completed = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            future_map = {executor.submit(analyze, item): item for item in items}
            for future in concurrent.futures.as_completed(future_map):
                item = future_map[future]
                try:
                    collection, key, record = future.result()
                    output[collection][key] = record
                except Exception as error:
                    output["errors"].append(
                        {"collection": item[0], "key": item[1], "name": item[2], "error": str(error)}
                    )
                completed += 1
                print(f"{completed}/{len(items)} {item[0]} {item[2]}", flush=True)

        target = ROOT / "data" / "village-forest-analytics.json"
        target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {len(output['villages'])} villages and "
        f"{len(output['socialForestry'])} social-forestry areas; "
        f"errors={len(output['errors'])}"
    )


if __name__ == "__main__":
    main()
