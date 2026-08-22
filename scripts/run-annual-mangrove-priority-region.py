#!/usr/bin/env python3
"""Run one annual mangrove-priority region in an isolated GitHub Actions job."""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
GENERIC = {
    "foundation": DATA / "mangrove-priority-intervention.json",
    "summary": DATA / "mangrove-priority-results.json",
    "geo": DATA / "mangrove-priority-candidates.geojson",
    "progress": DATA / "mangrove-priority-progress.json",
    "ranking": DATA / "mangrove-priority-ranking.csv",
    "roads": DATA / "mangrove-priority-roads-osm.geojson",
}
REGIONS = {
    "bengkalis",
    "siak",
    "dumai",
    "rokan-hilir",
    "kepulauan-meranti",
    "indragiri-hilir",
    "pelalawan",
    "intervention",
}


def run(*parts: str) -> None:
    print("+", " ".join(parts), flush=True)
    subprocess.run(parts, cwd=ROOT, check=True)


def regional_path(region: str, suffix: str) -> Path:
    if region == "intervention":
        return GENERIC[suffix]
    names = {
        "foundation": f"mangrove-priority-{region}-villages.json",
        "summary": f"mangrove-priority-{region}-results.json",
        "geo": f"mangrove-priority-{region}-candidates.geojson",
        "ranking": f"mangrove-priority-{region}-ranking.csv",
        "roads": f"mangrove-priority-{region}-roads-osm.geojson",
    }
    return DATA / names[suffix]


def write_json(path: Path, value: dict, compact: bool = False) -> None:
    path.write_text(
        json.dumps(
            value,
            ensure_ascii=False,
            indent=None if compact else 2,
            separators=(",", ":") if compact else None,
        ),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--region", required=True, choices=sorted(REGIONS))
    parser.add_argument("--comparison-year", required=True, type=int)
    parser.add_argument("--baseline-year", default=2016, type=int)
    parser.add_argument("--artifact-root", type=Path)
    args = parser.parse_args()

    if args.comparison_year <= args.baseline_year:
        raise SystemExit("comparison year must be later than baseline year")

    foundation_source = regional_path(args.region, "foundation")
    foundation = json.loads(foundation_source.read_text(encoding="utf-8"))
    expected_ids = {row["id"] for row in foundation.get("villages", [])}
    if not expected_ids:
        raise SystemExit(f"{args.region}: no villages in foundation")

    generated_at = datetime.now(timezone.utc).isoformat()
    foundation.update(
        baseline=str(args.baseline_year),
        comparison=str(args.comparison_year),
        generatedAt=generated_at,
        updateFrequency="annual",
        nextScheduledUpdate=f"{args.comparison_year + 1}-01-10",
    )
    write_json(GENERIC["foundation"], foundation)
    write_json(
        GENERIC["summary"],
        {
            "schemaVersion": 1,
            "product": f"Prioritas Rehabilitasi Mangrove {args.baseline_year}–{args.comparison_year}",
            "baseline": str(args.baseline_year),
            "current": str(args.comparison_year),
            "latest": str(args.comparison_year),
            "status": "processing",
            "villages": [],
        },
    )
    write_json(
        GENERIC["geo"],
        {
            "type": "FeatureCollection",
            "name": f"Prioritas Rehabilitasi Mangrove {args.baseline_year}–{args.comparison_year}",
            "features": [],
        },
        compact=True,
    )
    write_json(
        GENERIC["progress"],
        {
            "schemaVersion": 1,
            "completed": {},
            "failed": {},
            "status": "processing",
            "totalVillages": len(expected_ids),
            "completedCount": 0,
            "safeToResume": True,
        },
    )

    road_target = regional_path(args.region, "roads")
    if road_target != GENERIC["roads"]:
        if road_target.exists():
            shutil.copy2(road_target, GENERIC["roads"])
        elif GENERIC["roads"].exists():
            GENERIC["roads"].unlink()

    run(
        sys.executable,
        "scripts/generate-mangrove-priority.py",
        "--force",
        "--baseline-year",
        str(args.baseline_year),
        "--year",
        str(args.comparison_year),
        "--latest-year",
        str(args.comparison_year),
        "--batch-size",
        "4",
    )

    progress = json.loads(GENERIC["progress"].read_text(encoding="utf-8"))
    completed = set(progress.get("completed", {}))
    failed = progress.get("failed", {})
    missing = expected_ids - completed
    if failed or missing:
        raise SystemExit(
            f"{args.region}: analysis incomplete; failed={sorted(failed)} missing={sorted(missing)}"
        )

    run(
        sys.executable,
        "scripts/exclude-roads-mangrove-priority.py",
        "--fetch-mode",
        "district",
    )
    run(sys.executable, "scripts/classify-mangrove-priority.py")

    summary = json.loads(GENERIC["summary"].read_text(encoding="utf-8"))
    geo = json.loads(GENERIC["geo"].read_text(encoding="utf-8"))
    method = f"mangrove-priority-{args.baseline_year}-{args.comparison_year}-v0.1"
    summary.update(
        baseline=str(args.baseline_year),
        current=str(args.comparison_year),
        latest=str(args.comparison_year),
        generatedAt=generated_at,
        updateFrequency="annual",
        nextScheduledUpdate=f"{args.comparison_year + 1}-01-10",
        status="complete",
        methodVersion=method,
    )
    geo.update(
        baseline=str(args.baseline_year),
        current=str(args.comparison_year),
        latest=str(args.comparison_year),
        generatedAt=generated_at,
        updateFrequency="annual",
        methodVersion=method,
    )
    write_json(GENERIC["summary"], summary)
    write_json(GENERIC["geo"], geo, compact=True)

    records = {row.get("id") for row in summary.get("villages", [])}
    if records != expected_ids:
        raise SystemExit(
            f"{args.region}: record IDs differ from foundation; "
            f"missing={sorted(expected_ids-records)} extra={sorted(records-expected_ids)}"
        )

    outputs = {
        "foundation": regional_path(args.region, "foundation"),
        "summary": regional_path(args.region, "summary"),
        "geo": regional_path(args.region, "geo"),
        "ranking": regional_path(args.region, "ranking"),
        "roads": regional_path(args.region, "roads"),
    }
    for key, destination in outputs.items():
        source = GENERIC[key]
        if source != destination:
            shutil.copy2(source, destination)

    classes = {}
    for feature in geo.get("features", []):
        code = feature.get("properties", {}).get("priorityClass", "U")
        classes[code] = classes.get(code, 0) + 1
    report = {
        "region": args.region,
        "baseline": args.baseline_year,
        "comparison": args.comparison_year,
        "generatedAt": generated_at,
        "villages": len(expected_ids),
        "polygons": len(geo.get("features", [])),
        "classes": classes,
        "status": "complete",
    }
    report_path = DATA / f"mangrove-priority-{args.region}-annual-report.json"
    write_json(report_path, report)
    print(json.dumps(report, ensure_ascii=False), flush=True)

    if args.artifact_root:
        artifact_data = args.artifact_root / args.region / "data"
        artifact_data.mkdir(parents=True, exist_ok=True)
        for path in [*outputs.values(), report_path]:
            if path.exists():
                shutil.copy2(path, artifact_data / path.name)


if __name__ == "__main__":
    main()
