#!/usr/bin/env python3
"""Resilient public Google Drive folder downloader for drone datasets.

The folder is enumerated first, then gdown is run in resumable passes. Existing
complete files are skipped between passes. We only return success when every
listed JPG/JPEG has been downloaded, so photogrammetry never silently uses an
incomplete flight dataset.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time


def run(cmd, check=False, capture=False):
    return subprocess.run(
        cmd,
        text=True,
        check=check,
        capture_output=capture,
    )


def list_manifest(url: str):
    proc = run(["gdown", "--json", url], capture=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "Folder Google Drive tidak dapat dibaca")
    try:
        entries = json.loads(proc.stdout)
    except Exception as exc:
        raise RuntimeError("Daftar foto Google Drive tidak dapat dibaca") from exc
    photos = []
    for item in entries if isinstance(entries, list) else []:
        path = str(item.get("path") or "")
        if path.lower().endswith((".jpg", ".jpeg")):
            photos.append(path)
    if len(photos) < 3:
        raise RuntimeError("Folder tidak berisi cukup foto JPG/JPEG")
    return photos


def resolve_downloaded(output: Path):
    return [p for p in output.rglob("*") if p.is_file() and p.suffix.lower() in (".jpg", ".jpeg") and p.stat().st_size > 0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("output")
    parser.add_argument("summary")
    parser.add_argument("--passes", type=int, default=4)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--timeout", type=int, default=60)
    args = parser.parse_args()

    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    expected = list_manifest(args.url)
    expected_count = len(expected)
    pass_history = []

    for attempt in range(1, max(1, args.passes) + 1):
        cmd = [
            "gdown",
            "--continue",
            "--retries", str(max(0, args.retries)),
            "--timeout", str(max(10, args.timeout)),
            args.url,
            "-O", str(output),
        ]
        proc = run(cmd)
        downloaded = resolve_downloaded(output)
        count = len(downloaded)
        pass_history.append({"attempt": attempt, "downloaded": count, "expected": expected_count, "returnCode": proc.returncode})
        print(f"Drive pass {attempt}: {count}/{expected_count} photo files available", flush=True)
        if count >= expected_count:
            summary = {
                "ok": True,
                "expectedPhotos": expected_count,
                "downloadedPhotos": count,
                "attempts": attempt,
                "history": pass_history,
            }
            Path(args.summary).write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
            return 0
        if attempt < args.passes:
            wait = min(120, 20 * (2 ** (attempt - 1)))
            print(f"Waiting {wait}s before retrying missing Drive files...", flush=True)
            time.sleep(wait)

    downloaded = resolve_downloaded(output)
    summary = {
        "ok": False,
        "expectedPhotos": expected_count,
        "downloadedPhotos": len(downloaded),
        "missingPhotos": max(0, expected_count - len(downloaded)),
        "attempts": args.passes,
        "history": pass_history,
    }
    Path(args.summary).write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"Drive dataset incomplete: {len(downloaded)}/{expected_count} photos downloaded",
        file=sys.stderr,
    )
    return 42


if __name__ == "__main__":
    raise SystemExit(main())
