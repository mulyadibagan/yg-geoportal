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

from shapely.geometry import GeometryCollection, LineString, MultiLineString, MultiPolygon, mapping, shape
from shapely.ops import linemerge, split, transform, unary_union


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


def longest_line(geometry):
    if geometry.geom_type == "LineString":
        return geometry
    if isinstance(geometry, MultiLineString):
        return max(geometry.geoms, key=lambda part: part.length)
    raise RuntimeError(f"Expected a shared boundary line, got {geometry.geom_type}")


def extended_endpoint(origin, neighbour, distance):
    dx = origin[0] - neighbour[0]
    dy = origin[1] - neighbour[1]
    length = math.hypot(dx, dy)
    if not length:
        raise RuntimeError("Cannot extend a zero-length shared-boundary segment")
    return (origin[0] + dx / length * distance, origin[1] + dy / length * distance)


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

source_records = []
source_areas = {"erosion": 0.0, "accretion": 0.0}
coastal_support_parts = []
for feature in source["features"]:
    change = feature.get("properties", {}).get("change")
    if change not in source_areas:
        continue
    projected_change = transform(forward, shape(feature["geometry"]))
    if not projected_change.is_valid:
        projected_change = projected_change.buffer(0)
    source_records.append((feature, change, projected_change))
    coastal_support_parts.append(projected_change)
    source_areas[change] += projected_change.area

for feature in coverage["features"]:
    projected_coverage = transform(forward, shape(feature["geometry"]))
    if not projected_coverage.is_valid:
        projected_coverage = projected_coverage.buffer(0)
    coastal_support_parts.append(projected_coverage)

source_coastal = landscape["coastal"]
reported_area_totals_m2 = {
    "erosion": float(source_coastal["erosionAreaHa"]) * 10000,
    "accretion": float(source_coastal["accretionAreaHa"]) * 10000,
}
reported_area_scale = {
    change: reported_area_totals_m2[change] / source_areas[change]
    for change in source_areas
}
coastal_support = unary_union(coastal_support_parts)
physical_extent = coastal_support.envelope.buffer(1000)

# Only the official boundary shared by the two villages is locked. Its coastal
# endpoint is extended through the image-analysis extent so the administrative
# polygon's seaward cap never clips image-derived erosion or accretion.
shared_boundary = longest_line(linemerge(
    boundaries[codes[0]][0].boundary.intersection(boundaries[codes[1]][0].boundary)
))
shared_coords = list(shared_boundary.coords)
extension_m = math.hypot(
    physical_extent.bounds[2] - physical_extent.bounds[0],
    physical_extent.bounds[3] - physical_extent.bounds[1],
) * 2
extended_divider = LineString([
    extended_endpoint(shared_coords[0], shared_coords[1], extension_m),
    *shared_coords,
    extended_endpoint(shared_coords[-1], shared_coords[-2], extension_m),
])
partition_parts = [part for part in split(physical_extent, extended_divider).geoms if part.area > 1]
if len(partition_parts) < 2:
    raise RuntimeError("Shared village boundary did not divide the physical coastal extent")

attribution_parts = {code: [] for code in TARGETS}
for part in partition_parts:
    overlap_scores = {
        code: part.intersection(boundary).area
        for code, (boundary, _) in boundaries.items()
    }
    assigned_code = max(overlap_scores, key=overlap_scores.get)
    if overlap_scores[assigned_code] <= 1:
        sample = part.representative_point()
        assigned_code = min(boundaries, key=lambda code: sample.distance(boundaries[code][0]))
    attribution_parts[assigned_code].append(part)

attribution_masks = {
    code: unary_union(parts)
    for code, parts in attribution_parts.items()
}
if any(mask.is_empty for mask in attribution_masks.values()):
    raise RuntimeError("A village received no image-derived coastal attribution zone")
attribution_overlap_area = attribution_masks[codes[0]].intersection(attribution_masks[codes[1]]).area
if attribution_overlap_area > 1:
    raise RuntimeError(f"Coastal attribution zones overlap by {attribution_overlap_area:.2f} m²")

features = []
stats = {code: {"erosion": 0.0, "accretion": 0.0, "features": 0} for code in TARGETS}
for _, change, projected_change in source_records:
    for code, mask in attribution_masks.items():
        properties = boundaries[code][1]
        clipped = polygonal(projected_change.intersection(mask))
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
                "administrativeSeawardBoundaryUsedForClipping": False,
                "lockedInterVillageBoundary": True,
            },
            "geometry": mapping(transform(inverse, clipped)),
        })

coastline_proxy_total_km = coastal_support.length / 2000
source_coastline_km = float(source_coastal["coastlineLengthKm"])
coastline_calibration_factor = source_coastline_km / coastline_proxy_total_km
for code, mask in attribution_masks.items():
    # Measure only the original image-derived support boundary. Measuring the
    # clipped polygon perimeter would count the artificial village divider on
    # both sides and inflate the combined coastline length.
    attributed_support_boundary = coastal_support.boundary.intersection(mask)
    stats[code]["coastlineProxyKm"] = attributed_support_boundary.length / 2000
    stats[code]["coastlineLengthKm"] = stats[code]["coastlineProxyKm"] * coastline_calibration_factor

villages = []
for code, (_, properties) in boundaries.items():
    item = stats[code]
    erosion_area_m2 = item["erosion"] * reported_area_scale["erosion"]
    accretion_area_m2 = item["accretion"] * reported_area_scale["accretion"]
    erosion_ha = round(erosion_area_m2 / 10000, 2)
    accretion_ha = round(accretion_area_m2 / 10000, 2)
    coastline_m = item["coastlineLengthKm"] * 1000
    elapsed_years = 9
    mean_retreat_m = erosion_area_m2 / coastline_m if coastline_m else None
    mean_advance_m = accretion_area_m2 / coastline_m if coastline_m else None
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
        "coastlineLengthMethod": "Calibrated half-perimeter of image-derived coastal support attributed by the locked inter-village boundary; administrative seaward edges excluded",
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
        "analysisMethod": "Image-derived change polygons attributed using the locked 2025 inter-village boundary; the land-water edge remains image-derived",
        "imageDerivedBeforeBoundaryClip": True,
        "administrativeBoundaryUsedForAttribution": True,
        "administrativeSeawardBoundaryUsedForClipping": False,
        "lockedInterVillageBoundary": True,
        "featureCount": item["features"],
    })

assigned = {
    change: sum(stats[code][change] for code in TARGETS) * reported_area_scale[change]
    for change in source_areas
}
metadata = {
    "schemaVersion": 1,
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "sourceScopeId": landscape["scopeId"],
    "method": "Sentinel-2 change polygons classified on the physical coast and divided only by the locked official inter-village boundary",
    "coastlineLengthMethod": "Calibrated half-perimeter of image-derived coastal support divided by the extended inter-village boundary",
    "administrativeSeawardBoundaryUsedForClipping": False,
    "lockedInterVillageBoundary": True,
    "lockedInterVillageBoundaryLengthKm": round(shared_boundary.length / 1000, 3),
    "attributionZoneOverlapAreaM2": round(attribution_overlap_area, 2),
    "sourceCoastlineLengthKm": source_coastline_km,
    "coastlineProxyTotalKm": round(coastline_proxy_total_km, 6),
    "coastlineCalibrationFactor": round(coastline_calibration_factor, 6),
    "boundarySources": [boundaries[code][1]["UUPP"] for code in TARGETS],
    "sourceAreaHa": {change: round(area / 10000, 2) for change, area in reported_area_totals_m2.items()},
    "sourceVectorAreaHa": {change: round(area / 10000, 2) for change, area in source_areas.items()},
    "reportedAreaScale": {change: round(scale, 8) for change, scale in reported_area_scale.items()},
    "assignedAreaHa": {change: round(area / 10000, 2) for change, area in assigned.items()},
    "outsideTargetBoundariesHa": {
        change: round(max(0, reported_area_totals_m2[change] - assigned[change]) / 10000, 2)
        for change in source_areas
    },
    "boundaryOverlapAreaM2": round(overlap_area, 2),
}

OUTPUT_SUMMARY.write_text(json.dumps({"metadata": metadata, "villages": villages}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
OUTPUT_GEOJSON.write_text(json.dumps({"type": "FeatureCollection", "metadata": metadata, "features": features}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

print(json.dumps({"metadata": metadata, "villages": villages, "features": len(features)}, ensure_ascii=False, indent=2))
