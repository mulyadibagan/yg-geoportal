#!/usr/bin/env python3
"""Build public KLM summaries and a raster display from unmodified source geometry.

The source KLM polygons are never rewritten. Spatial intersections use the full
source geometry. The PNG is a cartographic rendering at display resolution so
the website can show the source boundaries without shipping a very large
polygon file to every visitor.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--analysis-root", type=Path, required=True)
    parser.add_argument("--site-root", type=Path, required=True)
    return parser.parse_args()


ARGS = parse_args()
ROOT = ARGS.analysis_root.resolve()
SITE = ARGS.site_root.resolve()
sys.path[:0] = [str(ROOT / "vendor_model"), str(ROOT / "vendor")]

import shapefile  # noqa: E402
from pyproj import CRS, Transformer  # noqa: E402
from shapely import make_valid  # noqa: E402
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, shape  # noqa: E402
from shapely.ops import transform  # noqa: E402
from shapely.prepared import prep  # noqa: E402


KLM_PATH = ROOT / "02_Working_Analysis" / "klm" / "Peta_Indikatif_Kesatuan_Lanskap_Mangrove.shp"
UNIT_PATH = ROOT / "02_Working_Analysis" / "statewide_outputs_not_for_publication" / "riau_mangrove_regulatory_review_units.geojson"
SUMMARY_PATH = SITE / "data" / "mangrove-klm-summary.json"
IMAGE_PATH = SITE / "assets" / "mangrove-klm-boundaries.png"

WGS84 = CRS.from_epsg(4326)
AREA_CRS = CRS.from_epsg(6933)
TO_AREA = Transformer.from_crs(WGS84, AREA_CRS, always_xy=True).transform
COLORS = {
    "14.01": (15, 126, 107, 80),
    "14.02": (22, 113, 173, 80),
    "14.03": (221, 132, 45, 82),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def polygonal(geometry):
    if geometry is None or geometry.is_empty:
        return GeometryCollection()
    if not geometry.is_valid:
        geometry = make_valid(geometry)
    if isinstance(geometry, (Polygon, MultiPolygon)):
        return geometry
    parts = [part for part in getattr(geometry, "geoms", []) if isinstance(part, (Polygon, MultiPolygon))]
    return MultiPolygon(parts) if parts else GeometryCollection()


def area_ha(geometry) -> float:
    return transform(TO_AREA, geometry).area / 10_000 if geometry and not geometry.is_empty else 0.0


def web_mercator(lon: float, lat: float):
    radius = 6_378_137.0
    bounded_lat = max(-85.05112878, min(85.05112878, lat))
    return radius * math.radians(lon), radius * math.log(math.tan(math.pi / 4 + math.radians(bounded_lat) / 2))


def inverse_web_mercator(x: float, y: float):
    radius = 6_378_137.0
    lon = math.degrees(x / radius)
    lat = math.degrees(2 * math.atan(math.exp(y / radius)) - math.pi / 2)
    return lon, lat


def pixel_ring(coordinates, bounds, size):
    min_x, min_y, max_x, max_y = bounds
    width, height = size
    points = []
    previous = None
    for lon, lat, *_ in coordinates:
        x, y = web_mercator(lon, lat)
        pixel = (round((x - min_x) / (max_x - min_x) * (width - 1)), round((max_y - y) / (max_y - min_y) * (height - 1)))
        if pixel != previous:
            points.append(pixel)
            previous = pixel
    if len(points) >= 3 and points[0] != points[-1]:
        points.append(points[0])
    return points


def render_boundaries(records, path: Path):
    width, height = 1800, 1500
    all_bounds = [item["geometry"].bounds for item in records]
    lon_min = min(bounds[0] for bounds in all_bounds)
    lat_min = min(bounds[1] for bounds in all_bounds)
    lon_max = max(bounds[2] for bounds in all_bounds)
    lat_max = max(bounds[3] for bounds in all_bounds)
    min_x, min_y = web_mercator(lon_min, lat_min)
    max_x, max_y = web_mercator(lon_max, lat_max)
    pad_x = (max_x - min_x) * 0.018
    pad_y = (max_y - min_y) * 0.018
    projected_bounds = (min_x - pad_x, min_y - pad_y, max_x + pad_x, max_y + pad_y)
    west, south = inverse_web_mercator(projected_bounds[0], projected_bounds[1])
    east, north = inverse_web_mercator(projected_bounds[2], projected_bounds[3])

    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for item in records:
        layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        color = COLORS[item["code"]]
        polygons = item["geometry"].geoms if isinstance(item["geometry"], MultiPolygon) else [item["geometry"]]
        for polygon in polygons:
            exterior = pixel_ring(polygon.exterior.coords, projected_bounds, (width, height))
            if len(exterior) >= 4:
                draw.polygon(exterior, fill=color, outline=(color[0], color[1], color[2], 245), width=3)
            for interior in polygon.interiors:
                hole = pixel_ring(interior.coords, projected_bounds, (width, height))
                if len(hole) >= 4:
                    draw.polygon(hole, fill=(0, 0, 0, 0))
        canvas = Image.alpha_composite(canvas, layer)
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path, optimize=True)
    return [[round(south, 8), round(west, 8)], [round(north, 8), round(east, 8)]]


def main():
    reader = shapefile.Reader(str(KLM_PATH), encoding="utf-8", encodingErrors="replace")
    klms = []
    for record in reader.iterShapeRecords():
        properties = record.record.as_dict()
        geometry = polygonal(shape(record.shape.__geo_interface__))
        point = geometry.representative_point()
        klms.append({
            "code": properties["KLM"],
            "name": properties["KLM_ID2"],
            "source_area_ha": float(properties["Luas"]),
            "geometry": geometry,
            "bbox": [round(value, 8) for value in geometry.bounds],
            "label_point": [round(point.y, 8), round(point.x, 8)],
            "prepared": prep(geometry),
        })

    with UNIT_PATH.open(encoding="utf-8") as stream:
        units = json.load(stream)["features"]

    summaries = defaultdict(lambda: defaultdict(float))
    counts = defaultdict(set)
    statewide = defaultdict(float)
    categories = {
        "initial_lindung_ha": lambda props: props.get("initial_rppem_function") == "LINDUNG",
        "validated_true_ha": lambda props: props.get("scenario_state") == "INDICATIVE_PROTECTION_TRUE",
        "review_increment_ha": lambda props: props.get("scenario_state") == "REVIEW_PROTECTION_SCENARIO",
        "unresolved_ha": lambda props: props.get("scenario_state") == "UNRESOLVED",
    }

    for feature in units:
        unit_geometry = polygonal(shape(feature["geometry"]))
        properties = feature["properties"]
        if unit_geometry.is_empty:
            continue
        unit_area = float(properties.get("area_ha") or area_ha(unit_geometry))
        statewide["mangrove_area_ha"] += unit_area
        for key, predicate in categories.items():
            if predicate(properties):
                statewide[key] += unit_area
        unit_bounds = unit_geometry.bounds
        for klm in klms:
            bounds = klm["geometry"].bounds
            if unit_bounds[2] < bounds[0] or unit_bounds[0] > bounds[2] or unit_bounds[3] < bounds[1] or unit_bounds[1] > bounds[3]:
                continue
            if not klm["prepared"].intersects(unit_geometry):
                continue
            if klm["prepared"].covers(unit_geometry):
                overlap_area = unit_area
            else:
                overlap = polygonal(unit_geometry.intersection(klm["geometry"]))
                if overlap.is_empty:
                    continue
                overlap_area = area_ha(overlap)
            if overlap_area <= 0:
                continue
            code = klm["code"]
            summaries[code]["mangrove_area_ha"] += overlap_area
            counts[code].add(properties.get("unit_id"))
            for key, predicate in categories.items():
                if predicate(properties):
                    summaries[code][key] += overlap_area

    image_bounds = render_boundaries(klms, IMAGE_PATH)
    public_klms = []
    for klm in sorted(klms, key=lambda item: item["code"]):
        code = klm["code"]
        values = summaries[code]
        total = values["mangrove_area_ha"]
        true_plus_review = values["validated_true_ha"] + values["review_increment_ha"]
        public_klms.append({
            "code": code,
            "name": klm["name"],
            "source_area_ha": round(klm["source_area_ha"], 6),
            "mangrove_area_ha": round(total, 6),
            "unit_count": len(counts[code]),
            "initial_lindung_ha": round(values["initial_lindung_ha"], 6),
            "initial_percent": round(values["initial_lindung_ha"] / total * 100, 6) if total else 0,
            "validated_true_ha": round(values["validated_true_ha"], 6),
            "validated_true_percent": round(values["validated_true_ha"] / total * 100, 6) if total else 0,
            "review_increment_ha": round(values["review_increment_ha"], 6),
            "true_plus_review_ha": round(true_plus_review, 6),
            "true_plus_review_percent": round(true_plus_review / total * 100, 6) if total else 0,
            "unresolved_ha": round(values["unresolved_ha"], 6),
            "bbox": klm["bbox"],
            "label_point": klm["label_point"],
            "color": "#%02x%02x%02x" % COLORS[code][:3],
        })

    payload = {
        "generated_at": str(date.today()),
        "scope": "Three source KLM polygons for Riau",
        "boundary_policy": "Analytical intersections use the full unmodified source KLM geometry. The website map uses a raster rendering generated from that same geometry at display resolution.",
        "source": {
            "dataset": "Peta Indikatif Kesatuan Lanskap Mangrove",
            "feature_count": len(klms),
            "sha256_shp": sha256(KLM_PATH),
            "sha256_dbf": sha256(KLM_PATH.with_suffix(".dbf")),
        },
        "image": {
            "path": "assets/mangrove-klm-boundaries.png",
            "bounds": image_bounds,
            "width": 1800,
            "height": 1500,
        },
        "totals": {
            "statewide_mangrove_area_ha": round(statewide["mangrove_area_ha"], 6),
            "inside_source_klm_area_ha": round(sum(item["mangrove_area_ha"] for item in public_klms), 6),
            "outside_source_klm_area_ha": round(statewide["mangrove_area_ha"] - sum(item["mangrove_area_ha"] for item in public_klms), 6),
            "inside_source_klm_percent": round(sum(item["mangrove_area_ha"] for item in public_klms) / statewide["mangrove_area_ha"] * 100, 6),
        },
        "klms": public_klms,
    }
    SUMMARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"summary": str(SUMMARY_PATH), "image": str(IMAGE_PATH), "klms": public_klms}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
