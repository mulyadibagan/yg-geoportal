#!/usr/bin/env python3
"""Build conservative, satellite-derived burned-area indications for Riau.

Hotspots only define candidate event areas. Sentinel-2 NBR change defines the
published polygons. Results are estimates, not field-verified fire perimeters.
The script keeps the previous public snapshot when no newer usable imagery is
available, so a temporary catalogue/scene failure cannot erase public data.
"""
from __future__ import annotations

import json, math, os, sys, time, warnings
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import certifi
import planetary_computer as pc
import rasterio
from pyproj import Transformer
from pystac_client import Client
from rasterio.enums import Resampling
from rasterio.features import geometry_mask, shapes
from rasterio.transform import from_origin
from rasterio.vrt import WarpedVRT
from scipy import ndimage
from shapely.geometry import Point, mapping, shape
from shapely.ops import transform as geom_transform, unary_union
from skimage import morphology
from burned_area_geography import RiauGeography, apply_geography

ROOT = Path(__file__).resolve().parents[1]
HOTSPOTS = ROOT / "data" / "hotspot-high-confidence.geojson"
OUTPUT = ROOT / "data" / "burned-area-estimates.geojson"
SUMMARY = ROOT / "data" / "burned-area-summary.json"
RESOLUTION = 20
MAX_SCENES = 4
CLOUD_LIMIT = 80
CLEAR_SCL = {2, 4, 5, 6, 7}
MIN_PIXELS = 6
RI_BBOX = (100.0, -1.3, 104.95, 2.9)
os.environ.setdefault("CURL_CA_BUNDLE", certifi.where())


def point_time(feature):
    p = feature.get("properties", {})
    value = f"{p.get('acq_date', '')}T{str(p.get('acq_time', '0000')).zfill(4)[:2]}:{str(p.get('acq_time', '0000')).zfill(4)[2:4]}:00+00:00"
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def choose_utm(lon):
    return 32600 + int((lon + 180) // 6) + 1


def cluster_hotspots(features, geography):
    """Connect detections whose 1.5 km buffers touch, then retain recent events."""
    rows = []
    for feature in features:
        when = point_time(feature)
        coords = feature.get("geometry", {}).get("coordinates", [])
        if when and len(coords) >= 2 and geography.boundary.covers(Point(coords)):
            rows.append((feature, when, Point(coords)))
    if not rows:
        return []
    epsg = 32647
    forward = Transformer.from_crs(4326, epsg, always_xy=True).transform
    projected = [(f, t, geom_transform(forward, p)) for f, t, p in rows]
    union = unary_union([p.buffer(1500) for _, _, p in projected])
    parts = list(union.geoms) if hasattr(union, "geoms") else [union]
    result = []
    for part in parts:
        matched = [(f, t, p) for f, t, p in projected if part.intersects(p)]
        days = {t.date() for _, t, _ in matched}
        satellites = {str(f.get("properties", {}).get("satellite") or "") for f, _, _ in matched}
        if len(matched) < 2 and len(days) < 2:
            continue
        result.append({"features": [x[0] for x in matched], "times": [x[1] for x in matched], "projected": part, "days": days, "satellites": satellites})
    result.sort(key=lambda x: max(x["times"]), reverse=True)
    return result[:40]


def grid_for(projected):
    minx, miny, maxx, maxy = projected.buffer(1000).bounds
    minx = math.floor(minx / RESOLUTION) * RESOLUTION
    miny = math.floor(miny / RESOLUTION) * RESOLUTION
    maxx = math.ceil(maxx / RESOLUTION) * RESOLUTION
    maxy = math.ceil(maxy / RESOLUTION) * RESOLUTION
    return from_origin(minx, maxy, RESOLUTION, RESOLUTION), int((maxx-minx)/RESOLUTION), int((maxy-miny)/RESOLUTION)


def search(catalog, bbox, start, end):
    for attempt in range(3):
        try:
            items = list(catalog.search(collections=["sentinel-2-l2a"], bbox=bbox,
                datetime=f"{start.date().isoformat()}/{end.date().isoformat()}",
                query={"eo:cloud_cover": {"lt": CLOUD_LIMIT}}).items())
            return sorted(items, key=lambda x: x.properties.get("eo:cloud_cover", 100))[:MAX_SCENES]
        except Exception:
            if attempt == 2:
                raise
            time.sleep(3 * (attempt + 1))


def read_asset(item, key, epsg, affine, width, height, resampling):
    with rasterio.Env(GDAL_HTTP_TIMEOUT="35", GDAL_HTTP_MAX_RETRY="2", GDAL_HTTP_RETRY_DELAY="2"):
        with rasterio.open(item.assets[key].href) as src, WarpedVRT(src, crs=f"EPSG:{epsg}", transform=affine,
                width=width, height=height, resampling=resampling) as vrt:
            return vrt.read(1, masked=True).astype("float32").filled(np.nan)


def composite(items, epsg, affine, width, height):
    observations, used = [], []
    for item in items:
        try:
            item = pc.sign(item)
            scl = read_asset(item, "SCL", epsg, affine, width, height, Resampling.nearest)
            red = read_asset(item, "B04", epsg, affine, width, height, Resampling.bilinear)
            nir = read_asset(item, "B08", epsg, affine, width, height, Resampling.bilinear)
            swir = read_asset(item, "B12", epsg, affine, width, height, Resampling.bilinear)
            valid = np.isin(scl, list(CLEAR_SCL)) & np.isfinite(red + nir + swir)
            nbr = (nir-swir)/(nir+swir+1e-6)
            ndvi = (nir-red)/(nir+red+1e-6)
            nbr[~valid] = np.nan; ndvi[~valid] = np.nan
            if valid.mean() >= .08:
                observations.append(np.stack([nbr, ndvi])); used.append(item)
        except Exception as exc:
            print(f"skip scene {item.id}: {exc}", file=sys.stderr)
    if not observations:
        return None
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", message="All-NaN slice encountered")
        median = np.nanmedian(np.stack(observations), axis=0)
    return {"nbr": median[0], "ndvi": median[1], "clear": np.isfinite(np.stack(observations)[:, 0]).sum(axis=0), "items": used}


def event_names(features, key):
    return sorted({str(f.get("properties", {}).get(key) or "").strip() for f in features if f.get("properties", {}).get(key)})


def analyse_event(event, catalog, index):
    first, last = min(event["times"]), max(event["times"])
    # A post-fire image needs time to become available; very recent events wait.
    if datetime.now(timezone.utc) - last < timedelta(days=3):
        return None, {"status": "waiting-post-image", "lastDetection": last.isoformat()}
    epsg = 32647
    inverse = Transformer.from_crs(epsg, 4326, always_xy=True).transform
    aoi = event["projected"].buffer(1800)
    geographic = geom_transform(inverse, aoi)
    bbox = geographic.bounds
    affine, width, height = grid_for(aoi)
    if width * height > 3_000_000:
        return None, {"status": "withheld", "reason": "candidate area too large"}
    pre_items = search(catalog, bbox, first-timedelta(days=60), first-timedelta(days=5))
    post_items = search(catalog, bbox, last+timedelta(days=1), min(last+timedelta(days=35), datetime.now(timezone.utc)))
    pre = composite(pre_items, epsg, affine, width, height)
    post = composite(post_items, epsg, affine, width, height)
    if not pre or not post:
        return None, {"status": "waiting-clear-image", "lastDetection": last.isoformat()}
    aoi_mask = geometry_mask([mapping(aoi)], out_shape=(height, width), transform=affine, invert=True)
    valid = aoi_mask & (pre["clear"] > 0) & (post["clear"] > 0)
    dnbr = pre["nbr"] - post["nbr"]
    mask = valid & (dnbr >= .10) & (post["nbr"] < .42) & (pre["ndvi"] > .18) & ((pre["ndvi"]-post["ndvi"]) > .08)
    mask = morphology.remove_small_objects(mask, max_size=MIN_PIXELS-1)
    mask = morphology.closing(mask, morphology.disk(1))
    mask = ndimage.binary_fill_holes(mask)
    area_ha = float(mask.sum()) * RESOLUTION * RESOLUTION / 10000
    if area_ha < .5:
        return None, {"status": "no-publishable-indication", "lastDetection": last.isoformat()}
    clear_pct = float(valid.sum()) / max(1, int(aoi_mask.sum())) * 100
    confidence = "tinggi" if clear_pct >= 80 and len(event["days"]) >= 2 and len(event["features"]) >= 4 else "sedang" if clear_pct >= 60 else "rendah"
    props = {
        "eventId": f"RIAU-{first:%Y%m%d}-{index:03d}", "firstDetection": first.isoformat(), "lastDetection": last.isoformat(),
        "estimatedAreaHa": round(area_ha, 2), "confidence": confidence, "hotspotCount": len(event["features"]),
        "detectionDays": len(event["days"]), "villages": event_names(event["features"], "village"),
        "districts": event_names(event["features"], "district"), "regencies": event_names(event["features"], "regency"),
        "method": "Sentinel-2 dNBR/NBR indication", "resolutionM": RESOLUTION, "clearCoveragePct": round(clear_pct, 1),
        "preSceneDates": sorted({x.datetime.date().isoformat() for x in pre["items"] if x.datetime}),
        "postSceneDates": sorted({x.datetime.date().isoformat() for x in post["items"] if x.datetime}),
        "status": "estimate", "disclaimer": "Estimasi berbasis citra satelit; bukan hasil verifikasi lapangan."
    }
    features = []
    for geom, value in shapes(mask.astype("uint8"), mask=mask, transform=affine):
        if value == 1:
            features.append({"type": "Feature", "properties": dict(props), "geometry": mapping(geom_transform(inverse, shape(geom)))})
    return features, {"status": "published", "areaHa": round(area_ha, 2), "confidence": confidence}


def main():
    geography = RiauGeography()
    source = json.loads(HOTSPOTS.read_text(encoding="utf-8"))
    cutoff = datetime.now(timezone.utc) - timedelta(days=75)
    candidates = [f for f in source.get("features", []) if point_time(f) and point_time(f) >= cutoff]
    events = cluster_hotspots(candidates, geography)
    catalog = Client.open("https://planetarycomputer.microsoft.com/api/stac/v1")
    output, states = [], []
    for index, event in enumerate(events, 1):
        try:
            features, state = analyse_event(event, catalog, index)
            if features:
                output.extend(features)
            states.append(state)
        except Exception as exc:
            print(f"event {index} failed: {exc}", file=sys.stderr)
            states.append({"status": "processing-error", "reason": str(exc)[:180]})
    now = datetime.now(timezone.utc).isoformat()
    published_events = {f["properties"]["eventId"] for f in output}
    total = sum(next(f["properties"]["estimatedAreaHa"] for f in output if f["properties"]["eventId"] == event_id) for event_id in published_events)
    payload = {"type": "FeatureCollection", "schemaVersion": 1, "generatedAt": now,
        "title": "Estimasi Area Terindikasi Terbakar Riau", "method": "Sentinel-2 dNBR/NBR with FIRMS candidate events",
        "disclaimer": "Estimasi berbasis citra satelit; bukan hasil pengukuran atau verifikasi lapangan.", "features": output}
    summary = {"schemaVersion": 1, "generatedAt": now, "status": "ready", "eventCount": len(published_events),
        "estimatedAreaHa": round(total, 2), "candidateEventCount": len(events), "processing": dict(Counter(x["status"] for x in states)),
        "latestDetection": max((max(e["times"]) for e in events), default=None).isoformat() if events else None,
        "method": payload["method"], "disclaimer": payload["disclaimer"]}
    # Do not replace an established result with an empty snapshot caused only by transient processing errors.
    if not output and any(x["status"] == "processing-error" for x in states) and OUTPUT.exists():
        print("processing errors produced no replacement; preserving previous public snapshot")
        return
    payload, summary = apply_geography(payload, summary, geography)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
