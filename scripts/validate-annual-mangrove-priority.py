#!/usr/bin/env python3
"""Validate annual mangrove-priority packages before publication."""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
REGIONS = (
    "bengkalis",
    "siak",
    "dumai",
    "rokan-hilir",
    "kepulauan-meranti",
    "indragiri-hilir",
    "pelalawan",
)


def load(name: str) -> dict:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def validate_package(prefix: str, baseline: str, comparison: str) -> dict:
    if prefix == "mangrove-priority":
        foundation_name = "mangrove-priority-intervention.json"
    else:
        foundation_name = f"{prefix}-villages.json"
    foundation = load(foundation_name)
    summary = load(f"{prefix}-results.json")
    geo = load(f"{prefix}-candidates.geojson")
    expected = {row["id"] for row in foundation.get("villages", [])}
    records = {row["id"]: row for row in summary.get("villages", [])}
    if set(records) != expected:
        raise SystemExit(
            f"{prefix}: village mismatch; missing={sorted(expected-set(records))} "
            f"extra={sorted(set(records)-expected)}"
        )
    if str(summary.get("baseline")) != baseline or str(summary.get("current")) != comparison:
        raise SystemExit(f"{prefix}: summary year mismatch")
    if summary.get("status") != "complete":
        raise SystemExit(f"{prefix}: summary is not complete")
    allowed_status = {"analysed", "insufficient-data"}
    invalid = [key for key, row in records.items() if row.get("status") not in allowed_status]
    if invalid:
        raise SystemExit(f"{prefix}: invalid village statuses: {invalid}")
    method = f"mangrove-priority-{baseline}-{comparison}-v0.1"
    features = geo.get("features", [])
    for feature in features:
        props = feature.get("properties", {})
        if props.get("id") not in expected:
            raise SystemExit(f"{prefix}: polygon references unknown village")
        if props.get("methodVersion") != method:
            raise SystemExit(f"{prefix}: polygon method version mismatch")
        if not props.get("polygonId") or props.get("priorityClass") not in {
            "P1",
            "P2",
            "P3",
            "P4",
            "P5",
            "X",
            "U",
        }:
            raise SystemExit(f"{prefix}: polygon classification is incomplete")
    return {"villages": len(expected), "polygons": len(features)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline-year", default=2016, type=int)
    parser.add_argument("--comparison-year", required=True, type=int)
    args = parser.parse_args()
    baseline, comparison = str(args.baseline_year), str(args.comparison_year)

    packages = {
        "intervention": validate_package("mangrove-priority", baseline, comparison)
    }
    for region in REGIONS:
        packages[region] = validate_package(
            f"mangrove-priority-{region}", baseline, comparison
        )
    province = validate_package("mangrove-priority-riau", baseline, comparison)
    if province["villages"] != sum(packages[r]["villages"] for r in REGIONS):
        raise SystemExit("province package village count does not equal regional total")

    generated_at = datetime.now(timezone.utc).isoformat()
    status = {
        "status": "complete",
        "baseline": args.baseline_year,
        "comparison": args.comparison_year,
        "generatedAt": generated_at,
        "publishedAt": generated_at,
        "updateFrequency": "annual",
        "schedule": "10 January",
        "nextScheduledUpdate": f"{args.comparison_year + 2}-01-10",
        "packages": packages,
    }
    (DATA / "mangrove-priority-update-status.json").write_text(
        json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(status, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
