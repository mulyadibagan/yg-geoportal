#!/usr/bin/env python3
"""Run the shared Hansen analysis for RSPO areas and publish a compact summary."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "PERUSAHAAN_SAWIT_RIAU_REFERENSI.geojson"
ADAPTED = ROOT / "data" / ".rspo-forest-analysis-input.geojson"
RAW_OUTPUT = ROOT / "data" / ".rspo-forest-analysis-output.json"
TARGET = ROOT / "data" / "rspo-tree-cover-monitoring.json"


def main() -> None:
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    features = []
    metadata = {}
    for feature in source.get("features", []):
        props = feature.get("properties") or {}
        area_id = props.get("COMPANY_ID")
        if not area_id:
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "Village_ID": area_id,
                "WADMKD": props.get("PO_COMPANY") or area_id,
                "WADMKK": props.get("REFERENCE_DISTRICTS") or "Riau",
            },
            "geometry": feature["geometry"],
        })
        metadata[area_id.lower()] = {
            "company": props.get("PO_COMPANY"),
            "group": props.get("RSPO_GROUP"),
            "supplyBase": props.get("SUPPLY_BASE"),
        }

    ADAPTED.write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")
    env = os.environ.copy()
    env.update({
        "FOREST_VILLAGE_GEOJSON": str(ADAPTED.relative_to(ROOT)),
        "FOREST_INCLUDE_SOCIAL_FORESTRY": "0",
        "FOREST_INCLUDE_LEGACY_GAIN": "0",
        "FOREST_ANALYTICS_OUTPUT": str(RAW_OUTPUT.relative_to(ROOT)),
    })
    try:
        subprocess.run([sys.executable, str(ROOT / "scripts" / "build_forest_analytics.py")], cwd=ROOT, env=env, check=True)
        raw = json.loads(RAW_OUTPUT.read_text(encoding="utf-8"))
        areas = {}
        for area_id, record in (raw.get("villages") or {}).items():
            areas[area_id.upper()] = {**metadata.get(area_id, {}), **record}
        result = {
            "schemaVersion": 1,
            "generatedAt": raw.get("generatedAt"),
            "method": raw.get("method"),
            "disclaimer": "Satellite-derived screening data; not a finding of non-compliance or illegality.",
            "areas": areas,
            "errors": raw.get("errors") or [],
        }
        TARGET.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    finally:
        ADAPTED.unlink(missing_ok=True)
        RAW_OUTPUT.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
