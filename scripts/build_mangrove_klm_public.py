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
    parser.add_argument("--boundaries-only", action="store_true")
    return parser.parse_args()


ARGS = parse_args()
ROOT = ARGS.analysis_root.resolve()
SITE = ARGS.site_root.resolve()
sys.path[:0] = [str(ROOT / "vendor_model"), str(ROOT / "vendor")]

import shapefile  # noqa: E402
from pyproj import CRS, Transformer  # noqa: E402
from shapely import make_valid  # noqa: E402
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, shape  # noqa: E402
from shapely.ops import transform, unary_union  # noqa: E402
from shapely.prepared import prep  # noqa: E402
from shapely.strtree import STRtree  # noqa: E402


KLM_PATH = ROOT / "02_Working_Analysis" / "klm" / "Peta_Indikatif_Kesatuan_Lanskap_Mangrove.shp"
UNIT_PATH = ROOT / "02_Working_Analysis" / "statewide_outputs_not_for_publication" / "riau_mangrove_regulatory_review_units.geojson"
RPPEM_PATH = ROOT / "02_Working_Analysis" / "rppem" / "Rencana_Perlindungan_Dan_Pengelolaan_Ekosistem_Mangrove.shp"
STATEWIDE_SUMMARY_PATH = ROOT / "04_Methodology_Metadata" / "statewide_modelled_overlay_summary.json"
ADMIN_PATH = SITE / "data" / "batas_administrasi_desa_riau.geojson"
SUMMARY_PATH = SITE / "data" / "mangrove-klm-summary.json"
IMAGE_PATH = SITE / "assets" / "mangrove-klm-boundaries.png"
FUNCTION_IMAGE_PATHS = {
    "analysis_lindung": SITE / "assets" / "mangrove-function-analysis-lindung.png",
    "analysis_budidaya": SITE / "assets" / "mangrove-function-analysis-budidaya.png",
}

WGS84 = CRS.from_epsg(4326)
AREA_CRS = CRS.from_epsg(6933)
TO_AREA = Transformer.from_crs(WGS84, AREA_CRS, always_xy=True).transform
COLORS = {
    "14.01": (15, 126, 107, 80),
    "14.02": (22, 113, 173, 80),
    "14.03": (221, 132, 45, 82),
}
RIAU_MANGROVE_REGENCIES = {
    "Bengkalis", "Indragiri Hilir", "Kepulauan Meranti", "Kota Dumai",
    "Pelalawan", "Rokan Hilir", "Siak",
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


def normalize_initial(value):
    text = str(value or "").upper()
    if "LINDUNG" in text:
        return "LINDUNG"
    if "BUDIDAYA" in text:
        return "BUDIDAYA"
    return None


def add_metrics(bucket, area, properties, budidaya_area):
    initial_lindung = properties.get("initial_rppem_function") == "LINDUNG"
    scenario = properties.get("scenario_state")
    is_true = scenario == "INDICATIVE_PROTECTION_TRUE"
    is_review = scenario == "REVIEW_PROTECTION_SCENARIO"
    bucket["mangrove_area_ha"] += area
    if initial_lindung:
        bucket["initial_lindung_ha"] += area
    if is_true:
        bucket["validated_true_ha"] += area
        if not initial_lindung:
            bucket["additional_true_beyond_initial_ha"] += area
    elif is_review:
        bucket["review_increment_ha"] += area
        if not initial_lindung:
            bucket["review_beyond_initial_ha"] += area
    else:
        bucket["unresolved_ha"] += area
    bucket["initial_budidaya_ha"] += budidaya_area
    if is_true:
        bucket["budidaya_reduction_true_ha"] += budidaya_area
    elif is_review:
        bucket["budidaya_review_exposure_ha"] += budidaya_area


def add_budidaya_metrics(bucket, area, properties):
    bucket["initial_budidaya_ha"] += area
    scenario = properties.get("scenario_state")
    if scenario == "INDICATIVE_PROTECTION_TRUE":
        bucket["budidaya_reduction_true_ha"] += area
    elif scenario == "REVIEW_PROTECTION_SCENARIO":
        bucket["budidaya_review_exposure_ha"] += area


def public_metrics(values):
    total = values["mangrove_area_ha"]
    true_plus_review = values["validated_true_ha"] + values["review_increment_ha"]
    budidaya_remaining = max(0.0, values["initial_budidaya_ha"] - values["budidaya_reduction_true_ha"])
    budidaya_scenario_remaining = max(0.0, budidaya_remaining - values["budidaya_review_exposure_ha"])
    initial_unclassified = max(0.0, total - values["initial_lindung_ha"] - values["initial_budidaya_ha"])
    budidaya_to_lindung = values["budidaya_reduction_true_ha"]
    additional_from_unclassified = max(0.0, values["additional_true_beyond_initial_ha"] - budidaya_to_lindung)
    pct = lambda number: round(number / total * 100, 6) if total else 0
    return {
        "mangrove_area_ha": round(total, 6),
        "initial_lindung_ha": round(values["initial_lindung_ha"], 6),
        "initial_percent": pct(values["initial_lindung_ha"]),
        "validated_true_ha": round(values["validated_true_ha"], 6),
        "validated_true_percent": pct(values["validated_true_ha"]),
        "additional_true_beyond_initial_ha": round(values["additional_true_beyond_initial_ha"], 6),
        "additional_true_beyond_initial_percent": pct(values["additional_true_beyond_initial_ha"]),
        "budidaya_to_lindung_true_ha": round(budidaya_to_lindung, 6),
        "additional_true_from_unclassified_ha": round(additional_from_unclassified, 6),
        "net_lindung_change_true_ha": round(values["validated_true_ha"] - values["initial_lindung_ha"], 6),
        "net_lindung_change_true_percentage_points": round(pct(values["validated_true_ha"]) - pct(values["initial_lindung_ha"]), 6),
        "review_increment_ha": round(values["review_increment_ha"], 6),
        "review_beyond_initial_ha": round(values["review_beyond_initial_ha"], 6),
        "true_plus_review_ha": round(true_plus_review, 6),
        "true_plus_review_percent": pct(true_plus_review),
        "unresolved_ha": round(values["unresolved_ha"], 6),
        "initial_budidaya_ha": round(values["initial_budidaya_ha"], 6),
        "initial_budidaya_percent": pct(values["initial_budidaya_ha"]),
        "budidaya_reduction_true_ha": round(values["budidaya_reduction_true_ha"], 6),
        "budidaya_reduction_true_percent_of_initial": round(values["budidaya_reduction_true_ha"] / values["initial_budidaya_ha"] * 100, 6) if values["initial_budidaya_ha"] else 0,
        "budidaya_remaining_after_true_ha": round(budidaya_remaining, 6),
        "budidaya_review_exposure_ha": round(values["budidaya_review_exposure_ha"], 6),
        "budidaya_remaining_true_plus_review_scenario_ha": round(budidaya_scenario_remaining, 6),
        "initial_unclassified_ha": round(initial_unclassified, 6),
    }


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


def render_geometry_layer(geometries, path: Path, projected_bounds, size, fill, outline, outline_width=2):
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    for geometry in geometries:
        polygons = geometry.geoms if isinstance(geometry, MultiPolygon) else [geometry]
        for polygon in polygons:
            if not isinstance(polygon, Polygon):
                continue
            exterior = pixel_ring(polygon.exterior.coords, projected_bounds, size)
            if len(exterior) >= 4:
                draw.polygon(exterior, fill=fill, outline=outline, width=outline_width)
            for interior in polygon.interiors:
                hole = pixel_ring(interior.coords, projected_bounds, size)
                if len(hole) >= 4:
                    draw.polygon(hole, fill=(0, 0, 0, 0))
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path, optimize=True)


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
        color = (7, 63, 59, 0)
        polygons = item["geometry"].geoms if isinstance(item["geometry"], MultiPolygon) else [item["geometry"]]
        for polygon in polygons:
            exterior = pixel_ring(polygon.exterior.coords, projected_bounds, (width, height))
            if len(exterior) >= 4:
                draw.polygon(exterior, fill=color, outline=(7, 63, 59, 235), width=3)
            for interior in polygon.interiors:
                hole = pixel_ring(interior.coords, projected_bounds, (width, height))
                if len(hole) >= 4:
                    draw.polygon(hole, fill=(0, 0, 0, 0))
        canvas = Image.alpha_composite(canvas, layer)
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path, optimize=True)
    image_bounds = [[round(south, 8), round(west, 8)], [round(north, 8), round(east, 8)]]
    return image_bounds, projected_bounds, (width, height)


def main():
    print("[1/5] Loading KLM source", flush=True)
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

    if ARGS.boundaries_only:
        print("[2/2] Rendering neutral KLM boundaries", flush=True)
        render_boundaries(klms, IMAGE_PATH)
        print(json.dumps({"image": str(IMAGE_PATH), "style": "single neutral outline, transparent fill"}, ensure_ascii=False))
        return

    with UNIT_PATH.open(encoding="utf-8") as stream:
        units = json.load(stream)["features"]

    print("[2/5] Indexing RPPEM cultivation baseline", flush=True)
    rppem_reader = shapefile.Reader(str(RPPEM_PATH), encoding="utf-8", encodingErrors="replace")
    budidaya_records = []
    for record in rppem_reader.iterShapeRecords():
        properties = record.record.as_dict()
        if normalize_initial(properties.get("Fng_mngrve")) == "BUDIDAYA":
            geometry = polygonal(shape(record.shape.__geo_interface__))
            if not geometry.is_empty:
                budidaya_records.append((geometry, properties))

    admin_payload = json.loads(ADMIN_PATH.read_text(encoding="utf-8"))
    regency_parts = defaultdict(list)
    for feature in admin_payload.get("features", []):
        if not feature.get("geometry"):
            continue
        name = str((feature.get("properties") or {}).get("WADMKK") or "UNKNOWN")
        if name not in RIAU_MANGROVE_REGENCIES:
            continue
        geometry = polygonal(shape(feature["geometry"]))
        if not geometry.is_empty:
            regency_parts[name].append(geometry)
    regency_names = sorted(regency_parts)
    regency_geometries = [polygonal(unary_union(regency_parts[name])) for name in regency_names]
    regency_prepared = [prep(geometry) for geometry in regency_geometries]
    regency_tree = STRtree(regency_geometries)

    print(f"[3/5] Overlaying {len(units)} units across {len(klms)} KLM", flush=True)

    klm_summaries = defaultdict(lambda: defaultdict(float))
    regency_summaries = defaultdict(lambda: defaultdict(float))
    klm_counts = defaultdict(set)
    regency_counts = defaultdict(set)
    statewide = defaultdict(float)
    parsed_units = []
    analysis_lindung_display_parts = []

    for unit_index, feature in enumerate(units, start=1):
        unit_geometry = polygonal(shape(feature["geometry"]))
        properties = feature["properties"]
        if unit_geometry.is_empty:
            continue
        unit_area = float(properties.get("area_ha") or area_ha(unit_geometry))
        parsed_units.append((unit_geometry, properties, unit_area))
        if properties.get("scenario_state") == "INDICATIVE_PROTECTION_TRUE":
            analysis_lindung_display_parts.append(unit_geometry)
        add_metrics(statewide, unit_area, properties, 0.0)
        regency = str(properties.get("kabupaten_kota") or "UNKNOWN")
        if regency in RIAU_MANGROVE_REGENCIES:
            regency_counts[regency].add(properties.get("unit_id"))
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
            add_metrics(klm_summaries[code], overlap_area, properties, 0.0)
            klm_counts[code].add(properties.get("unit_id"))
        if unit_index % 500 == 0:
            print(f"  processed {unit_index}/{len(units)} units", flush=True)

    print(f"  intersecting {len(budidaya_records)} RPPEM cultivation polygons with analysis units", flush=True)
    unit_geometries = [item[0] for item in parsed_units]
    unit_tree = STRtree(unit_geometries)
    analysis_budidaya_display_parts = []
    klm_code_by_name = {item["name"]: item["code"] for item in klms}
    for record_index, (budidaya_geometry, source_properties) in enumerate(budidaya_records, start=1):
        prepared_budidaya = prep(budidaya_geometry)
        klm_code = klm_code_by_name.get(str(source_properties.get("KLM") or ""))
        for unit_index in unit_tree.query(budidaya_geometry):
            unit_geometry, unit_properties, unit_area = parsed_units[int(unit_index)]
            if prepared_budidaya.covers(unit_geometry):
                overlap_geometry = unit_geometry
                overlap_area = unit_area
            elif prepared_budidaya.intersects(unit_geometry):
                overlap_geometry = polygonal(unit_geometry.intersection(budidaya_geometry))
                overlap_area = area_ha(overlap_geometry)
            else:
                continue
            if overlap_area <= 0:
                continue
            if unit_properties.get("scenario_state") != "INDICATIVE_PROTECTION_TRUE":
                analysis_budidaya_display_parts.append(overlap_geometry)
            add_budidaya_metrics(statewide, overlap_area, unit_properties)
            if klm_code:
                add_budidaya_metrics(klm_summaries[klm_code], overlap_area, unit_properties)
            for regency_index in regency_tree.query(overlap_geometry):
                index = int(regency_index)
                if regency_prepared[index].covers(overlap_geometry):
                    regency_overlap_area = overlap_area
                elif regency_prepared[index].intersects(overlap_geometry):
                    regency_overlap_area = area_ha(polygonal(overlap_geometry.intersection(regency_geometries[index])))
                else:
                    continue
                if regency_overlap_area > 0:
                    add_budidaya_metrics(regency_summaries[regency_names[index]], regency_overlap_area, unit_properties)
        if record_index % 25 == 0:
            print(f"  processed {record_index}/{len(budidaya_records)} cultivation polygons", flush=True)

    print("[4/5] Rendering source boundaries and function polygons", flush=True)
    image_bounds, projected_bounds, image_size = render_boundaries(klms, IMAGE_PATH)
    render_geometry_layer(analysis_lindung_display_parts, FUNCTION_IMAGE_PATHS["analysis_lindung"], projected_bounds, image_size, (25, 128, 90, 145), (12, 91, 62, 245), 3)
    render_geometry_layer(analysis_budidaya_display_parts, FUNCTION_IMAGE_PATHS["analysis_budidaya"], projected_bounds, image_size, (224, 151, 35, 112), (175, 105, 10, 225), 2)
    public_klms = []
    for klm in sorted(klms, key=lambda item: item["code"]):
        code = klm["code"]
        values = public_metrics(klm_summaries[code])
        public_klms.append({**values,
            "code": code,
            "name": klm["name"],
            "source_area_ha": round(klm["source_area_ha"], 6),
            "unit_count": len(klm_counts[code]),
            "bbox": klm["bbox"],
            "label_point": klm["label_point"],
            "color": "#%02x%02x%02x" % COLORS[code][:3],
        })

    statewide_source = json.loads(STATEWIDE_SUMMARY_PATH.read_text(encoding="utf-8"))
    public_regencies = []
    for source_row in sorted(statewide_source["by_regency"], key=lambda item: item["kabupaten_kota"]):
        name = source_row["kabupaten_kota"]
        values = regency_summaries[name]
        values["mangrove_area_ha"] = float(source_row["mangrove_area_ha"])
        values["initial_lindung_ha"] = float(source_row["initial_rppem_lindung_ha"])
        values["validated_true_ha"] = float(source_row["validated_true_union_ha"])
        values["additional_true_beyond_initial_ha"] = max(0.0, values["validated_true_ha"] - values["initial_lindung_ha"])
        values["review_increment_ha"] = float(source_row["review_increment_ha"])
        values["unresolved_ha"] = max(0.0, values["mangrove_area_ha"] - values["validated_true_ha"] - values["review_increment_ha"])
        public_regencies.append({**public_metrics(values), "name": name, "unit_count": len(regency_counts[name])})

    payload = {
        "generated_at": str(date.today()),
        "scope": "Tiga poligon KLM sumber untuk Provinsi Riau",
        "boundary_policy": "Irisan analitis menggunakan geometri KLM sumber secara penuh tanpa perubahan. Peta web memakai raster yang dibuat dari geometri yang sama pada resolusi tampilan.",
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
        "function_layers": [
            {"id": "analysis_lindung", "label": "Indikasi fungsi lindung — TRUE", "path": "assets/mangrove-function-analysis-lindung.png", "color": "#19805a", "visible": True},
            {"id": "analysis_budidaya", "label": "Baseline budidaya tersisa setelah overlay TRUE", "path": "assets/mangrove-function-analysis-budidaya.png", "color": "#e09723", "visible": True},
        ],
        "totals": {**public_metrics(statewide),
            "klm_source_total_area_ha": round(sum(item["source_area_ha"] for item in public_klms), 6),
            "statewide_mangrove_area_ha": round(statewide["mangrove_area_ha"], 6),
            "inside_source_klm_area_ha": round(sum(item["mangrove_area_ha"] for item in public_klms), 6),
            "outside_source_klm_area_ha": round(statewide["mangrove_area_ha"] - sum(item["mangrove_area_ha"] for item in public_klms), 6),
            "inside_source_klm_percent": round(sum(item["mangrove_area_ha"] for item in public_klms) / statewide["mangrove_area_ha"] * 100, 6),
        },
        "klms": public_klms,
        "regencies": public_regencies,
    }
    SUMMARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print("[5/5] Public summary complete", flush=True)
    print(json.dumps({"summary": str(SUMMARY_PATH), "image": str(IMAGE_PATH), "klms": public_klms, "regencies": public_regencies}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
