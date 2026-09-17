#!/usr/bin/env python3
"""Build staff-only Hansen tree-cover-loss analytics for Riau PBPH areas."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.getenv("PBPH_FOREST_SOURCE", ROOT / "data" / ".pbph-private-input.geojson"))
ADAPTED = ROOT / "data" / ".pbph-forest-analysis-input.geojson"
RAW_OUTPUT = ROOT / "data" / ".pbph-forest-analysis-output.json"
TARGET = Path(os.getenv("PBPH_FOREST_OUTPUT", ROOT / "data" / ".pbph-tree-cover-monitoring.json"))


def text(value: object) -> str:
    return str(value or "").strip()


def permit_id(properties: dict) -> str:
    return text(properties.get("PBPH_ID") or "|".join(filter(None, [text(properties.get("NAMOBJ")), text(properties.get("NO_SK"))])))


def main() -> None:
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    features = []
    metadata = {}
    for feature in source.get("features", []):
        props = feature.get("properties") or {}
        area_id = permit_id(props)
        if not area_id or not feature.get("geometry"):
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "Village_ID": area_id,
                "WADMKD": props.get("NAMOBJ") or area_id,
                "WADMKK": "Riau",
            },
            "geometry": feature["geometry"],
        })
        metadata[area_id.lower()] = {
            "pbphId": area_id,
            "name": props.get("NAMOBJ"),
            "sk": props.get("NO_SK"),
            "permitType": props.get("JENIS"),
            "activity": props.get("KEGIATAN"),
            "permitAreaHa": props.get("LSSK"),
        }

    ADAPTED.write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")
    env = os.environ.copy()
    env.update({
        "FOREST_VILLAGE_GEOJSON": str(ADAPTED.relative_to(ROOT)),
        "FOREST_INCLUDE_SOCIAL_FORESTRY": "0",
        "FOREST_INCLUDE_LEGACY_GAIN": "0",
        "FOREST_ANALYTICS_OUTPUT": str(RAW_OUTPUT.relative_to(ROOT)),
        "FOREST_LOSS_START_YEAR": "2001",
    })
    try:
        subprocess.run([sys.executable, str(ROOT / "scripts" / "build_forest_analytics.py")], cwd=ROOT, env=env, check=True)
        raw = json.loads(RAW_OUTPUT.read_text(encoding="utf-8"))
        areas = {}
        for area_id, record in (raw.get("villages") or {}).items():
            meta = metadata.get(area_id, {})
            stable_id = meta.get("pbphId") or area_id
            areas[stable_id] = {**meta, **record}
        result = {
            "schemaVersion": 1,
            "visibility": "staff-only",
            "generatedAt": raw.get("generatedAt"),
            "method": raw.get("method"),
            "disclaimer": "Kehilangan tutupan pohon berbasis satelit bukan bukti deforestasi ilegal, penyebab, atau tanggung jawab pemegang PBPH.",
            "areas": areas,
            "errors": raw.get("errors") or [],
        }
        TARGET.parent.mkdir(parents=True, exist_ok=True)
        TARGET.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    finally:
        ADAPTED.unlink(missing_ok=True)
        RAW_OUTPUT.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
