#!/usr/bin/env python3
"""Resilient Google Drive folder downloader for drone datasets.

The folder is enumerated first, then gdown is run in resumable passes. A small
JSON summary is updated while the download is running so the WebGIS can publish
real progress instead of leaving the user at a fixed percentage.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import time


def run(cmd, capture=False):
    return subprocess.run(cmd, text=True, capture_output=capture)


def list_manifest(url: str):
    proc = run(["gdown", "--json", url], capture=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "Folder Google Drive tidak dapat dibaca")
    try:
        entries = json.loads(proc.stdout)
    except Exception as exc:
        raise RuntimeError("Daftar foto Google Drive tidak dapat dibaca") from exc
    photos=[]
    for item in entries if isinstance(entries,list) else []:
        path=str(item.get("path") or "")
        if path.lower().endswith((".jpg",".jpeg")):
            photos.append(path)
    if len(photos) < 3:
        raise RuntimeError("Folder tidak berisi cukup foto JPG/JPEG")
    return photos


def resolve_downloaded(output: Path):
    return [p for p in output.rglob("*") if p.is_file() and p.suffix.lower() in (".jpg",".jpeg") and p.stat().st_size > 0]


def write_summary(path: Path, expected: int, downloaded: int, attempt: int, history, ok=False, state="downloading"):
    payload={
        "ok": bool(ok),
        "state": state,
        "expectedPhotos": expected,
        "downloadedPhotos": downloaded,
        "missingPhotos": max(0, expected-downloaded),
        "attempts": attempt,
        "history": history,
        "updatedAt": time.time(),
    }
    path.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding="utf-8")


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("output")
    parser.add_argument("summary")
    parser.add_argument("--passes",type=int,default=4)
    parser.add_argument("--retries",type=int,default=3)
    parser.add_argument("--timeout",type=int,default=60)
    parser.add_argument("--progress-interval",type=int,default=5)
    args=parser.parse_args()

    output=Path(args.output)
    output.mkdir(parents=True,exist_ok=True)
    summary_path=Path(args.summary)
    expected=list_manifest(args.url)
    expected_count=len(expected)
    pass_history=[]
    initial=len(resolve_downloaded(output))
    write_summary(summary_path,expected_count,initial,0,pass_history)

    for attempt in range(1,max(1,args.passes)+1):
        cmd=[
            "gdown","--continue",
            "--retries",str(max(0,args.retries)),
            "--timeout",str(max(10,args.timeout)),
            args.url,"-O",str(output),
        ]
        proc=subprocess.Popen(cmd)
        last_count=-1
        while proc.poll() is None:
            count=len(resolve_downloaded(output))
            if count != last_count:
                write_summary(summary_path,expected_count,count,attempt,pass_history)
                print(f"Drive download: {count}/{expected_count} photo files available",flush=True)
                last_count=count
            time.sleep(max(2,args.progress_interval))
        rc=proc.wait()
        count=len(resolve_downloaded(output))
        pass_history.append({"attempt":attempt,"downloaded":count,"expected":expected_count,"returnCode":rc})
        write_summary(summary_path,expected_count,count,attempt,pass_history,ok=count>=expected_count,state="complete" if count>=expected_count else "retrying")
        print(f"Drive pass {attempt}: {count}/{expected_count} photo files available",flush=True)
        if count >= expected_count:
            return 0
        if attempt < args.passes:
            wait=min(120,20*(2**(attempt-1)))
            print(f"Waiting {wait}s before retrying missing Drive files...",flush=True)
            time.sleep(wait)

    count=len(resolve_downloaded(output))
    write_summary(summary_path,expected_count,count,args.passes,pass_history,ok=False,state="failed")
    print(f"Drive dataset incomplete: {count}/{expected_count} photos downloaded",file=sys.stderr)
    return 42


if __name__ == "__main__":
    raise SystemExit(main())
