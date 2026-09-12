#!/usr/bin/env python3
"""Build per-RSPO-area burned-area screening summaries from monthly archives."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from pyproj import Geod
from shapely.geometry import shape
from shapely.ops import unary_union
from shapely.validation import make_valid


ROOT = Path(__file__).resolve().parents[1]
AREA_PATH = ROOT / "data" / "PERUSAHAAN_SAWIT_RIAU_REFERENSI.geojson"
INDEX_PATH = ROOT / "data" / "burned-area-monthly" / "index.json"
OUTPUT_PATH = ROOT / "data" / "rspo-burned-area-monitoring.json"
GEOD = Geod(ellps="WGS84")


def area_hectares(geometry) -> float:
    if geometry.is_empty:
        return 0.0
    area_m2, _ = GEOD.geometry_area_perimeter(geometry)
    return abs(area_m2) / 10_000


def main() -> None:
    areas = json.loads(AREA_PATH.read_text(encoding="utf-8"))["features"]
    index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    reports = []
    for item in index.get("reports", []):
        path = ROOT / item["data"]
        reports.append((item, json.loads(path.read_text(encoding="utf-8"))))

    output = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "method": "Geodesic area of polygon intersections between RSPO reference areas and Sentinel-2 dNBR/NBR burned-area estimates",
        "disclaimer": "Satellite-derived screening estimate; not field verification and not evidence of fire cause or responsibility.",
        "sourceIndex": "data/burned-area-monthly/index.json",
        "areas": {},
    }

    for feature in areas:
        props = feature.get("properties", {})
        area_id = props.get("COMPANY_ID")
        if not area_id:
            continue
        boundary = make_valid(shape(feature["geometry"]))
        monthly = []
        for item, report in reports:
            intersections = []
            event_ids = []
            confidences = []
            for event in report.get("features", []):
                burn = make_valid(shape(event["geometry"]))
                if not boundary.intersects(burn):
                    continue
                overlap = boundary.intersection(burn)
                if overlap.is_empty:
                    continue
                intersections.append(overlap)
                event_ids.append(event.get("properties", {}).get("eventId"))
                confidences.append(event.get("properties", {}).get("confidence"))
            unioned = unary_union(intersections) if intersections else None
            estimate = area_hectares(unioned) if unioned is not None else 0.0
            monthly.append({
                "month": item["month"],
                "archiveStatus": item.get("status", "partial"),
                "estimatedAreaHa": round(estimate, 2),
                "eventCount": len(set(filter(None, event_ids))),
                "eventIds": sorted(set(filter(None, event_ids))),
                "confidenceLabels": sorted(set(filter(None, confidences))),
            })
        positive = [row for row in monthly if row["estimatedAreaHa"] > 0]
        output["areas"][area_id] = {
            "company": props.get("PO_COMPANY"),
            "group": props.get("RSPO_GROUP"),
            "supplyBase": props.get("SUPPLY_BASE"),
            "estimatedAreaHa": round(sum(row["estimatedAreaHa"] for row in positive), 2),
            "monthsWithEstimate": len(positive),
            "monthly": monthly,
        }

    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
