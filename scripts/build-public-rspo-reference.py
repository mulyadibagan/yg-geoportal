#!/usr/bin/env python3
"""Build the compact public RSPO grower-area reference used by the WebGIS."""

import json
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

from shapely import make_valid
from shapely import make_valid
from shapely.geometry import mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree


ROOT = Path(__file__).resolve().parents[1]
ENDPOINT = (
    "https://services3.arcgis.com/mKcWKyEU5Tl36xeT/arcgis/rest/services/"
    "RSPO_Concessions_Master_Data_v1_view/FeatureServer/0/query"
)
VERSION = "georspo-riau-growers-20260912-v1"
EXCLUDED_PARENTS = {"Permata Group Pte. Ltd."}


def request_json(params):
    body = urllib.parse.urlencode(params).encode("utf-8")
    request = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={"Accept": "application/geo+json", "Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)


def fetch_features():
    id_data = request_json({
        "where": "Province='Riau' AND MemberCat='Grower'",
        "returnIdsOnly": "true",
        "f": "json",
    })
    object_ids = sorted(id_data.get("objectIds", []))
    rows = []
    for offset in range(0, len(object_ids), 1000):
        batch_ids = object_ids[offset:offset + 1000]
        data = request_json({
            "objectIds": ",".join(map(str, batch_ids)),
            "outFields": "FID,Parent,Subsidiary,ManageUnit,SupplyBase,MemberCat",
            "returnGeometry": "true",
            "outSR": "4326",
            "orderByFields": "FID",
            "geometryPrecision": "6",
            "f": "geojson",
        })
        if data.get("error"):
            raise RuntimeError(data["error"])
        batch = data.get("features", [])
        rows.extend(feature for feature in batch if feature.get("geometry"))
        print(f"fetched {len(rows)}", flush=True)
    missing_geometry = len(object_ids) - len(rows)
    if missing_geometry > 1:
        raise RuntimeError(f"Expected {len(object_ids)} source features, received {len(rows)}")
    return rows


def clean(value):
    return " ".join(str(value or "").split()).strip()


def company_name(parent, subsidiaries):
    names = sorted(name for name in subsidiaries if name and name != "PT. PHI")
    return names[0] if len(names) == 1 else parent


def main():
    villages = json.loads((ROOT / "data/batas_administrasi_desa_riau.geojson").read_text())
    village_geometries = [shape(feature["geometry"]) for feature in villages["features"]]
    village_names = [clean(feature.get("properties", {}).get("WADMKK")) for feature in villages["features"]]
    village_tree = STRtree(village_geometries)

    groups = defaultdict(lambda: {"geometries": [], "subsidiaries": set(), "units": set()})
    cache = ROOT / "tmp/rspo-riau-growers-raw.geojson"
    if cache.exists():
        raw = json.loads(cache.read_text())["features"]
    else:
        raw = fetch_features()
        cache.parent.mkdir(exist_ok=True)
        cache.write_text(json.dumps({"type": "FeatureCollection", "features": raw}, separators=(",", ":")))
    for feature in raw:
        props = feature.get("properties", {})
        parent = clean(props.get("Parent"))
        if not parent or parent in EXCLUDED_PARENTS:
            continue
        supply_base = clean(props.get("SupplyBase")) or clean(props.get("ManageUnit")) or "Unit tidak tercantum"
        record = groups[(parent, supply_base)]
        source_geometry = shape(feature["geometry"])
        record["geometries"].append(make_valid(source_geometry) if not source_geometry.is_valid else source_geometry)
        record["subsidiaries"].add(clean(props.get("Subsidiary")))
        record["units"].add(clean(props.get("ManageUnit")))

    output = []
    for index, ((parent, supply_base), record) in enumerate(sorted(groups.items()), 1):
        geometry = unary_union(record["geometries"]).buffer(0).simplify(0.00008, preserve_topology=True)
        regencies = sorted({
            village_names[int(candidate)]
            for candidate in village_tree.query(geometry)
            if village_names[int(candidate)] and village_geometries[int(candidate)].intersects(geometry)
        })
        output.append({
            "type": "Feature",
            "properties": {
                "COMPANY_ID": f"RSPO-{index:03d}",
                "PO_COMPANY": company_name(parent, record["subsidiaries"]),
                "RSPO_GROUP": parent,
                "SUPPLY_BASE": supply_base,
                "REFERENCE_DISTRICTS": ", ".join(filter(None, regencies)),
                "REFERENCE_UPDATED": "2026-07-14",
                "NAME_SOURCE": "GeoRSPO / RSPO",
                "REFERENCE_TYPE": "Area perkebunan anggota RSPO",
            },
            "geometry": mapping(geometry),
        })

    collection = {
        "type": "FeatureCollection",
        "referenceVersion": VERSION,
        "name": "Area Perkebunan Anggota RSPO di Riau",
        "source": "GeoRSPO / RSPO",
        "updated": "2026-07-14",
        "features": output,
    }
    target = ROOT / "data/PERUSAHAAN_SAWIT_RIAU_REFERENSI.geojson"
    target.write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")))
    print(json.dumps({
        "source_features": len(raw),
        "public_units": len(output),
        "public_groups": len({f["properties"]["RSPO_GROUP"] for f in output}),
        "public_companies": len({f["properties"]["PO_COMPANY"] for f in output}),
        "bytes": target.stat().st_size,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
