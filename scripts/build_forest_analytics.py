import concurrent.futures
import datetime
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from shapely import force_2d
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEOSTORE_URL = "https://production-api.globalforestwatch.org/geostore"
ANALYSIS_URL = "https://production-api.globalforestwatch.org/umd-loss-gain"
GFW_DATASET_URL = "https://data-api.globalforestwatch.org/dataset/umd_tree_cover_loss"
GFW_API_KEY = os.getenv("GFW_API_KEY", "").strip()
LOSS_WINDOW_YEARS = 10
LOSS_DATASET_VERSION = None
LOSS_END_YEAR = None
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


def analyze_annual_loss(geometry):
    window_end_year = datetime.datetime.now(datetime.timezone.utc).year
    loss_start_year = window_end_year - LOSS_WINDOW_YEARS + 1
    sql = (
        "SELECT umd_tree_cover_loss__year, "
        "SUM(area__ha) AS loss_ha "
        "FROM results "
        "WHERE umd_tree_cover_density_2000__threshold = 30 "
        f"AND umd_tree_cover_loss__year BETWEEN {loss_start_year} AND {LOSS_END_YEAR} "
        "GROUP BY umd_tree_cover_loss__year "
        "ORDER BY umd_tree_cover_loss__year"
    )
    result = request_json(
        f"{GFW_DATASET_URL}/{LOSS_DATASET_VERSION}/query/json",
        {"sql": sql, "geometry": geometry},
        extra_headers={"x-api-key": GFW_API_KEY},
    )
    rows = result.get("data") or []
    annual = {
        str(year): (0.0 if year <= LOSS_END_YEAR else None)
        for year in range(loss_start_year, window_end_year + 1)
    }
    for row in rows:
        year = row.get("umd_tree_cover_loss__year")
        if year is None:
            continue
        year = str(int(year))
        if year in annual:
            annual[year] = round(float(row.get("loss_ha") or 0), 2)
    return annual


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
    annual = analyze_annual_loss(geometry_2d)
    total_loss = round(sum(float(value or 0) for value in annual.values()), 2)
    baseline = round(float(values.get("treeExtent") or 0), 2)
    gain = round(float(values.get("gain") or 0), 2)
    current = round(max(0, baseline - total_loss + gain), 2)
    return collection, key, {
        "name": name,
        "geostoreId": geostore_id,
        "baselineForestHa": baseline,
        "currentForestHa": current,
        "totalLossHa": total_loss,
        "gainHa": gain,
        "annualLossHa": {year: round(float(value or 0), 2) for year, value in annual.items()},
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
    if not GFW_API_KEY:
        raise RuntimeError(
            "GFW_API_KEY belum diset. Builder menolak menghasilkan nilai 0 palsu "
            "untuk tahun yang belum tersedia dari sumber resmi."
        )
    LOSS_DATASET_VERSION, LOSS_END_YEAR = latest_loss_dataset()
    window_end_year = datetime.datetime.now(datetime.timezone.utc).year
    loss_start_year = window_end_year - LOSS_WINDOW_YEARS + 1
    print(
        f"GFW tree-cover loss {LOSS_DATASET_VERSION}; "
        f"rolling window {loss_start_year}-{window_end_year}; "
        f"data through {LOSS_END_YEAR}",
        flush=True,
    )
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
            "source": "Global Forest Watch / Hansen Global Forest Change",
        },
        "villages": {},
        "socialForestry": {},
        "errors": [],
    }
    items = load_items()
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
