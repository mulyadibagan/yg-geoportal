import concurrent.futures
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
VILLAGE_GEOJSON_FILES = [
    Path(path.strip())
    for path in (
        os.getenv("FOREST_VILLAGE_GEOJSON")
        or os.getenv("FIRMS_VILLAGE_GEOJSON")
        or "data/desa_intervensi.geojson"
    ).split(",")
    if path.strip()
]


def request_json(url, payload=None, attempts=4):
    body = None
    headers = {"Accept": "application/json", "User-Agent": "YG-GeoPortal/1.0"}
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
    annual = values.get("loss") or {}
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
    output = {
        "schemaVersion": 2,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "method": {
            "forestDefinition": "Hansen tree cover extent with canopy density at or above 30 percent",
            "baselineYear": 2000,
            "lossPeriod": "2001-2025",
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
