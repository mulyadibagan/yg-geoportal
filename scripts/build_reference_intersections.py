import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
PROJECT = Transformer.from_crs("EPSG:4326", "EPSG:6933", always_xy=True).transform

REFERENCES = {
    "forestEstate": ("kawasan_hutan_sk_903.geojson", "Kawasan hutan SK 903"),
    "peat": ("Gambut_BBSDLP_2019.geojson", "Lahan gambut BBSDLP 2019"),
    "concession": ("IUPHHK_HT_2014.geojson", "IUPHHK-HT 2014"),
    "socialForestry": ("PERHUTANAN_SOSIAL_RIAU.geojson", "Perhutanan sosial"),
}


def load_geojson(name):
    with (ROOT / "data" / name).open(encoding="utf-8") as source:
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


def main():
    target = ROOT / "data" / "village-forest-analytics.json"
    analytics = json.loads(target.read_text(encoding="utf-8"))
    indexes = {}
    for key, (file_name, label) in REFERENCES.items():
        print(f"Indexing {label}", flush=True)
        indexes[key] = build_index(file_name)

    villages = process_units(
        "desa_intervensi.geojson", "villages", village_key, analytics, indexes
    )
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
    target.write_text(
        json.dumps(analytics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Updated intersections for {villages} villages and {social} PS areas")


if __name__ == "__main__":
    main()
