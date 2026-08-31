import json
import os
from datetime import datetime, timezone
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
PROJECT = Transformer.from_crs("EPSG:4326", "EPSG:6933", always_xy=True).transform
VILLAGE_GEOJSON_FILES = [
    path.strip()
    for path in (
        os.getenv("FOREST_VILLAGE_GEOJSON")
        or os.getenv("FIRMS_VILLAGE_GEOJSON")
        or "data/desa_intervensi.geojson"
    ).split(",")
    if path.strip()
]
ANALYTICS_TARGET = ROOT / os.getenv(
    "FOREST_ANALYTICS_OUTPUT", "data/village-forest-analytics.json"
)
INCLUDE_SOCIAL_FORESTRY = os.getenv("FOREST_INCLUDE_SOCIAL_FORESTRY", "1") != "0"
GROUP_VILLAGE_PARTS = os.getenv("FOREST_GROUP_VILLAGE_PARTS", "0") == "1"

REFERENCES = {
    "peat": ("Gambut_BBSDLP_2019.geojson", "Lahan gambut BBSDLP 2019"),
    "concession": ("PBPH_RIAU_052026.geojson", "PBPH Riau pembaruan Mei 2026"),
    "socialForestry": ("PERHUTANAN_SOSIAL_RIAU.geojson", "Perhutanan sosial"),
}

FOREST_FUNCTIONS = {
    "apl": {"APL"},
    "productionForest": {"HP", "HPT", "HPK"},
    "protectionForest": {"HL"},
    "conservation": {"CA", "KSA/KPA", "TN", "SM", "SA", "TWA"},
}
FOREST_ESTATE_VALUES = set().union(
    FOREST_FUNCTIONS["productionForest"],
    FOREST_FUNCTIONS["protectionForest"],
    FOREST_FUNCTIONS["conservation"],
)
KNOWN_FOREST_VALUES = FOREST_ESTATE_VALUES | FOREST_FUNCTIONS["apl"]


def load_geojson(name):
    candidate = Path(name)
    if candidate.is_absolute():
        source_path = candidate
    elif candidate.parts and candidate.parts[0] == "data":
        source_path = ROOT / candidate
    else:
        source_path = ROOT / "data" / candidate
    with source_path.open(encoding="utf-8") as source:
        return json.load(source)


def projected_geometry(feature):
    geometry = shape(feature["geometry"])
    if not geometry.is_valid:
        geometry = geometry.buffer(0)
    return transform(PROJECT, geometry)


def build_index(file_name):
    data = load_geojson(file_name)
    geometries = []
    for feature in data.get("features", []):
        try:
            geometry = projected_geometry(feature)
            if not geometry.is_empty:
                geometries.append(geometry)
        except Exception:
            continue
    return geometries, STRtree(geometries)


def dissolved_index(geometries):
    if not geometries:
        return [], STRtree([])
    dissolved = unary_union(geometries)
    if not dissolved.is_valid:
        dissolved = dissolved.buffer(0)
    parts = [dissolved] if not dissolved.is_empty else []
    return parts, STRtree(parts)


def build_forest_function_indexes():
    data = load_geojson("kawasan_hutan_sk_903.geojson")
    grouped = {key: [] for key in FOREST_FUNCTIONS}
    grouped["forestEstate"] = []
    grouped["unclassifiedForestFunction"] = []
    for feature in data.get("features", []):
        try:
            geometry = projected_geometry(feature)
            if geometry.is_empty:
                continue
            value = str((feature.get("properties") or {}).get("fungsi") or "").strip()
            if value in FOREST_ESTATE_VALUES:
                grouped["forestEstate"].append(geometry)
            if value not in KNOWN_FOREST_VALUES:
                grouped["unclassifiedForestFunction"].append(geometry)
            for key, accepted_values in FOREST_FUNCTIONS.items():
                if value in accepted_values:
                    grouped[key].append(geometry)
                    break
        except Exception:
            continue
    return {
        key: dissolved_index(geometries)
        for key, geometries in grouped.items()
    }


def village_key(properties):
    stable = (
        properties.get("Village_ID")
        or properties.get("VILLAGE_ID")
        or properties.get("Kode_Desa")
        or properties.get("KODE_DESA")
    )
    if stable:
        return str(stable).strip().lower()
    return "|".join(
        filter(
            None,
            [
                str(properties.get("WADMKD") or properties.get("Desa") or "").strip(),
                str(properties.get("WADMKC") or properties.get("Kecamatan") or "").strip(),
                str(properties.get("WADMKK") or properties.get("Kabupaten") or "").strip(),
            ],
        )
    ).lower()


def social_key(properties):
    stable = (
        properties.get("OBJECTID")
        or properties.get("ID")
        or properties.get("NO_IUPHKM")
        or properties.get("SK")
    )
    if stable:
        return str(stable).strip().lower()
    return "|".join(
        filter(
            None,
            [
                str(properties.get("NAMA_HKM") or "").strip(),
                str(properties.get("NAMA_DESA") or "").strip(),
                str(properties.get("NAMA_KAB") or "").strip(),
            ],
        )
    ).lower()


def intersection_ha(unit, geometries, tree):
    total = 0.0
    for index in tree.query(unit):
        candidate = geometries[int(index)]
        if unit.intersects(candidate):
            total += unit.intersection(candidate).area
    return round(total / 10000, 2)


def process_units(file_name, collection, key_function, analytics, indexes, group_parts=False):
    data = load_geojson(file_name)
    features = data.get("features", [])
    if group_parts:
        grouped = {}
        for feature in features:
            key = key_function(feature.get("properties") or {})
            grouped.setdefault(key, []).append(feature)
        features = [
            {
                "type": "Feature",
                "properties": {"_analytics_key": key},
                "geometry": mapping(
                    unary_union([shape(feature["geometry"]) for feature in parts])
                ),
            }
            for key, parts in grouped.items()
        ]
    count = 0
    for feature in features:
        properties = feature.get("properties") or {}
        key = properties.get("_analytics_key") or key_function(properties)
        record = analytics.get(collection, {}).get(key)
        if record is None:
            continue
        unit = projected_geometry(feature)
        record["referenceAreasHa"] = {
            reference_key: intersection_ha(unit, geometries, tree)
            for reference_key, (geometries, tree) in indexes.items()
        }
        count += 1
    return count


def process_multiple_village_files(file_names, analytics, indexes):
    if GROUP_VILLAGE_PARTS:
        return process_units(
            file_names[0], "villages", village_key, analytics, indexes, group_parts=True
        )
    total = 0
    for file_name in file_names:
        total += process_units(file_name, "villages", village_key, analytics, indexes)
    return total


def main():
    target = ANALYTICS_TARGET
    analytics = json.loads(target.read_text(encoding="utf-8"))
    print("Indexing fungsi kawasan hutan SK 903", flush=True)
    indexes = build_forest_function_indexes()
    for key, (file_name, label) in REFERENCES.items():
        print(f"Indexing {label}", flush=True)
        indexes[key] = build_index(file_name)

    villages = process_multiple_village_files(
        VILLAGE_GEOJSON_FILES, analytics, indexes
    )
    social = 0
    if INCLUDE_SOCIAL_FORESTRY:
        social = process_units(
            "PERHUTANAN_SOSIAL_RIAU.geojson",
            "socialForestry",
            social_key,
            analytics,
            indexes,
            group_parts=True,
        )
    analytics["referenceLayers"] = {
        key: {"label": label, "file": file_name}
        for key, (file_name, label) in REFERENCES.items()
    }
    analytics["referenceLayers"]["forestEstate"] = {
        "label": "Kawasan hutan SK 903",
        "file": "kawasan_hutan_sk_903.geojson",
        "attribute": "fungsi",
        "groups": {
            "apl": sorted(FOREST_FUNCTIONS["apl"]),
            "productionForest": sorted(FOREST_FUNCTIONS["productionForest"]),
            "protectionForest": sorted(FOREST_FUNCTIONS["protectionForest"]),
            "conservation": sorted(FOREST_FUNCTIONS["conservation"]),
        },
    }
    analytics["generatedAt"] = datetime.now(timezone.utc).isoformat().replace(
        "+00:00", "Z"
    )
    target.write_text(
        json.dumps(analytics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Updated intersections for {villages} villages and {social} PS areas")


if __name__ == "__main__":
    main()
