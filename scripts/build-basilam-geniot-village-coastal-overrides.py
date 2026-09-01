"""Clip image-derived Basilam–Geniot coastal changes to the 2025 village boundaries.

The change classification is not recomputed inside an administrative mask. Existing
Sentinel-2 change polygons are intersected after classification so the output can be
reported per kelurahan without copying a shared total to both profiles.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

from shapely.geometry import GeometryCollection, MultiPolygon, mapping, shape
from shapely.ops import transform, unary_union


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SOURCE_CHANGE = DATA / "basilam-geniot-physical-coastal-change.geojson"
SOURCE_COVERAGE = DATA / "basilam-geniot-physical-coastal-coverage.geojson"
SOURCE_LANDSCAPE = DATA / "basilam-geniot-physical-landscape.json"
ADMINISTRATIVE = DATA / "batas_administrasi_desa_riau.geojson"
OUTPUT_SUMMARY = DATA / "basilam-geniot-village-coastal-overrides.json"
OUTPUT_GEOJSON = DATA / "basilam-geniot-village-coastal-overrides.geojson"
TARGETS = {
    "14.72.04.1004": "kota-dumai-sungai-sembilan-kelurahan-basilam-baru",
    "14.72.04.1006": "kota-dumai-sungai-sembilan-kelurahan-sungai-geniot",
}


def polygonal(geometry):
    if geometry.is_empty:
        return None
    if geometry.geom_type in {"Polygon", "MultiPolygon"}:
        return geometry
    if isinstance(geometry, GeometryCollection):
        polygons = [part for part in geometry.geoms if part.geom_type in {"Polygon", "MultiPolygon"}]
        if not polygons:
            return None
        parts = []
        for polygon in polygons:
            parts.extend(polygon.geoms if isinstance(polygon, MultiPolygon) else [polygon])
        return MultiPolygon(parts) if len(parts) > 1 else parts[0]
    return None


source = json.loads(SOURCE_CHANGE.read_text(encoding="utf-8"))
coverage = json.loads(SOURCE_COVERAGE.read_text(encoding="utf-8"))
landscape = json.loads(SOURCE_LANDSCAPE.read_text(encoding="utf-8"))
administrative = json.loads(ADMINISTRATIVE.read_text(encoding="utf-8"))
earth_radius_m = 6378137.0
reference_latitude_rad = math.radians(1.9)


def forward(lon, lat, z=None):
    return (
        earth_radius_m * math.radians(lon) * math.cos(reference_latitude_rad),
        earth_radius_m * math.radians(lat),
    )


def inverse(x, y, z=None):
    return (
        math.degrees(x / (earth_radius_m * math.cos(reference_latitude_rad))),
        math.degrees(y / earth_radius_m),
    )

boundaries = {}
for feature in administrative["features"]:
    properties = feature.get("properties") or {}
    code = str(properties.get("KODE_DESA") or "")
    if code not in TARGETS:
        continue
    projected = transform(forward, shape(feature["geometry"]))
    if not projected.is_valid:
        projected = projected.buffer(0)
    boundaries[code] = (projected, properties)

if set(boundaries) != set(TARGETS):
    raise RuntimeError(f"Missing target boundaries: {set(TARGETS) - set(boundaries)}")

codes = list(TARGETS)
overlap_area = boundaries[codes[0]][0].intersection(boundaries[codes[1]][0]).area
if overlap_area > 1:
    raise RuntimeError(f"Village boundaries overlap by {overlap_area:.2f} m²")

features = []
stats = {code: {"erosion": 0.0, "accretion": 0.0, "features": 0} for code in TARGETS}
source_areas = {"erosion": 0.0, "accretion": 0.0}
coastal_support_parts = []

for feature in source["features"]:
    change = feature.get("properties", {}).get("change")
    if change not in source_areas:
        continue
    projected_change = transform(forward, shape(feature["geometry"]))
    if not projected_change.is_valid:
        projected_change = projected_change.buffer(0)
    coastal_support_parts.append(projected_change)
    source_areas[change] += projected_change.area
    for code, (boundary, properties) in boundaries.items():
        clipped = polygonal(projected_change.intersection(boundary))
        if clipped is None or clipped.area <= 1:
            continue
        stats[code][change] += clipped.area
        stats[code]["features"] += 1
        features.append({
            "type": "Feature",
            "properties": {
                "id": TARGETS[code],
                "village": properties["WADMKD"],
                "district": properties["WADMKC"],
                "regency": properties["WADMKK"],
                "administrativeCode": code,
                "boundarySource": properties["UUPP"],
                "change": change,
                "baseline": "2016",
                "current": "2025",
                "confidence": "rendah",
                "resolutionM": 10,
                "uncertaintyM": 14.1,
                "imageDerivedBeforeBoundaryClip": True,
                "administrativeBoundaryUsedForAttribution": True,
            },
            "geometry": mapping(transform(inverse, clipped)),
        })

for feature in coverage["features"]:
    projected_coverage = transform(forward, shape(feature["geometry"]))
    if not projected_coverage.is_valid:
        projected_coverage = projected_coverage.buffer(0)
    coastal_support_parts.append(projected_coverage)

source_coastal = landscape["coastal"]
coastal_support = unary_union(coastal_support_parts)
coastline_proxy_total_km = coastal_support.length / 2000
source_coastline_km = float(source_coastal["coastlineLengthKm"])
coastline_calibration_factor = source_coastline_km / coastline_proxy_total_km
for code, (boundary, _) in boundaries.items():
    clipped_support = coastal_support.intersection(boundary)
    stats[code]["coastlineProxyKm"] = clipped_support.length / 2000
    stats[code]["coastlineLengthKm"] = stats[code]["coastlineProxyKm"] * coastline_calibration_factor

villages = []
for code, (_, properties) in boundaries.items():
    item = stats[code]
    erosion_ha = round(item["erosion"] / 10000, 2)
    accretion_ha = round(item["accretion"] / 10000, 2)
    coastline_m = item["coastlineLengthKm"] * 1000
    elapsed_years = 9
    mean_retreat_m = item["erosion"] / coastline_m if coastline_m else None
    mean_advance_m = item["accretion"] / coastline_m if coastline_m else None
    villages.append({
        "id": TARGETS[code],
        "village": properties["WADMKD"],
        "district": properties["WADMKC"],
        "regency": properties["WADMKK"],
        "status": "analysed",
        "baseline": "2016",
        "current": "2025",
        "erosionAreaHa": erosion_ha,
        "accretionAreaHa": accretion_ha,
        "netAreaChangeHa": round(accretion_ha - erosion_ha, 2),
        "coastlineLengthKm": round(item["coastlineLengthKm"], 2),
        "coastlineProxyKm": round(item["coastlineProxyKm"], 3),
        "coastlineCalibrationFactor": round(coastline_calibration_factor, 6),
        "coastlineLengthMethod": "Calibrated half-perimeter of image-derived change and stable-shoreline support clipped to the village boundary",
        "indicativeMeanRetreatM": round(mean_retreat_m, 1) if mean_retreat_m is not None else None,
        "indicativeMeanAdvanceM": round(mean_advance_m, 1) if mean_advance_m is not None else None,
        "elapsedYears": elapsed_years,
        "indicativeRetreatRateMPerYear": round(mean_retreat_m / elapsed_years, 2) if mean_retreat_m is not None else None,
        "indicativeAdvanceRateMPerYear": round(mean_advance_m / elapsed_years, 2) if mean_advance_m is not None else None,
        "clearCoveragePct": source_coastal.get("clearCoveragePct"),
        "baselineSceneCount": source_coastal.get("baselineSceneCount"),
        "currentSceneCount": source_coastal.get("currentSceneCount"),
        "baselineScenes": source_coastal.get("baselineScenes", []),
        "currentScenes": source_coastal.get("currentScenes", []),
        "positionalUncertaintyM": source_coastal.get("positionalUncertaintyM", 14.1),
        "confidence": "rendah",
        "intervention": False,
        "programmeStatus": "regional",
        "administrativeCode": code,
        "boundarySource": properties["UUPP"],
        "analysisMethod": "Image-derived change polygons clipped after classification to the 2025 village boundary",
        "imageDerivedBeforeBoundaryClip": True,
        "administrativeBoundaryUsedForAttribution": True,
        "featureCount": item["features"],
    })

assigned = {
    change: sum(stats[code][change] for code in TARGETS)
    for change in source_areas
}
metadata = {
    "schemaVersion": 1,
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "sourceScopeId": landscape["scopeId"],
    "method": "Sentinel-2 change polygons classified on the physical coast, then intersected with official village boundaries",
    "coastlineLengthMethod": "Calibrated half-perimeter of the vectorized image-derived change and stable-shoreline support",
    "sourceCoastlineLengthKm": source_coastline_km,
    "coastlineProxyTotalKm": round(coastline_proxy_total_km, 6),
    "coastlineCalibrationFactor": round(coastline_calibration_factor, 6),
    "boundarySources": [boundaries[code][1]["UUPP"] for code in TARGETS],
    "sourceAreaHa": {change: round(area / 10000, 2) for change, area in source_areas.items()},
    "assignedAreaHa": {change: round(area / 10000, 2) for change, area in assigned.items()},
    "outsideTargetBoundariesHa": {
        change: round(max(0, source_areas[change] - assigned[change]) / 10000, 2)
        for change in source_areas
    },
    "boundaryOverlapAreaM2": round(overlap_area, 2),
}

OUTPUT_SUMMARY.write_text(json.dumps({"metadata": metadata, "villages": villages}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
OUTPUT_GEOJSON.write_text(json.dumps({"type": "FeatureCollection", "metadata": metadata, "features": features}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

print(json.dumps({"metadata": metadata, "villages": villages, "features": len(features)}, ensure_ascii=False, indent=2))
