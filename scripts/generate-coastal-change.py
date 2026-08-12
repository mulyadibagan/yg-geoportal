#!/usr/bin/env python3
"""Generate auditable annual satellite-derived shoreline-change indicators.

The product is intentionally labelled an indication, not a surveyed shoreline.
It compares an April-September 2016 baseline with the latest complete year,
masks cloud/shadow with SCL, retains water connected to the image edge,
and measures only changes close to either extracted shoreline.
"""
from __future__ import annotations

import argparse, json, math, os, sys, warnings
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import planetary_computer as pc
import rasterio
from pystac_client import Client
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.features import geometry_mask, shapes
from rasterio.transform import from_origin
from rasterio.vrt import WarpedVRT
from scipy import ndimage
from shapely.geometry import Polygon, MultiPolygon, mapping, shape
from shapely.ops import transform as geom_transform
from skimage import measure, morphology

ROOT = Path(__file__).resolve().parents[1]
VILLAGES = ROOT / "data" / "desa_intervensi.geojson"
OUTPUT = ROOT / "data" / "coastal-change-annual.geojson"
SUMMARY = ROOT / "data" / "coastal-change-annual.json"
RESOLUTION = 10
CLOUD_LIMIT = 70
MAX_SCENES = 5
MIN_COMPONENT_PIXELS = 9
COASTAL_BAND_PIXELS = 30  # 300 m on each extracted shoreline
CLEAR_SCL = {2, 4, 5, 6, 7}
NON_VILLAGE_NAMES = {"area saling klaim"}


def annual_dates(year: int):
    return f"{year}-04-01", f"{year}-09-30"


def iter_coords(geom):
    if geom["type"] == "Polygon":
        rings = geom["coordinates"]
    elif geom["type"] == "MultiPolygon":
        rings = [r for poly in geom["coordinates"] for r in poly]
    else:
        return
    for ring in rings:
        for x, y in ring:
            yield x, y


def choose_utm(lon):
    return 32600 + int((lon + 180) // 6) + 1


def grid_for(feature, padding=1000):
    geom = shape(feature["geometry"])
    lon = geom.centroid.x
    epsg = choose_utm(lon)
    forward = Transformer.from_crs(4326, epsg, always_xy=True).transform
    projected = geom_transform(forward, geom)
    minx, miny, maxx, maxy = projected.bounds
    minx = math.floor((minx-padding)/RESOLUTION)*RESOLUTION
    miny = math.floor((miny-padding)/RESOLUTION)*RESOLUTION
    maxx = math.ceil((maxx+padding)/RESOLUTION)*RESOLUTION
    maxy = math.ceil((maxy+padding)/RESOLUTION)*RESOLUTION
    width, height = int((maxx-minx)/RESOLUTION), int((maxy-miny)/RESOLUTION)
    return epsg, projected, from_origin(minx, maxy, RESOLUTION, RESOLUTION), width, height


def search_items(catalog, bbox, start, end):
    search = catalog.search(collections=["sentinel-2-l2a"], bbox=bbox,
        datetime=f"{start}/{end}", query={"eo:cloud_cover":{"lt":CLOUD_LIMIT}})
    items = list(search.items())
    items.sort(key=lambda item: item.properties.get("eo:cloud_cover", 100))
    return items[:MAX_SCENES]


def read_asset(item, key, epsg, affine, width, height, resampling):
    href = item.assets[key].href
    with rasterio.open(href) as src, WarpedVRT(src, crs=f"EPSG:{epsg}", transform=affine,
        width=width, height=height, resampling=resampling) as vrt:
        return vrt.read(1, masked=True).astype("float32").filled(np.nan)


def composite(items, epsg, affine, width, height):
    observations=[]
    used=[]
    for item in items:
        try:
            scl=read_asset(item,"SCL",epsg,affine,width,height,Resampling.nearest)
            green=read_asset(item,"B03",epsg,affine,width,height,Resampling.bilinear)
            nir=read_asset(item,"B08",epsg,affine,width,height,Resampling.bilinear)
            swir=read_asset(item,"B11",epsg,affine,width,height,Resampling.bilinear)
            valid=np.isin(scl,list(CLEAR_SCL)) & np.isfinite(green+nir+swir)
            mndwi=(green-swir)/(green+swir+1e-6)
            ndwi=(green-nir)/(green+nir+1e-6)
            index=(mndwi*0.7+ndwi*0.3).astype("float32")
            index[~valid]=np.nan
            if np.isfinite(index).mean() < .10: continue
            observations.append(index); used.append(item)
        except Exception as exc:
            print(f"skip {item.id}: {exc}", file=sys.stderr)
    if not observations: return None
    with np.errstate(all="ignore"), warnings.catch_warnings():
        warnings.filterwarnings("ignore",message="All-NaN slice encountered")
        index=np.nanmedian(np.stack(observations),axis=0)
    clear=np.isfinite(np.stack(observations)).sum(axis=0)
    return index, clear, used


def edge_connected_water(index, clear):
    water=(index > .05) & (clear > 0)
    water=morphology.remove_small_objects(water,max_size=MIN_COMPONENT_PIXELS-1)
    water=morphology.closing(water,morphology.disk(1))
    labels,count=ndimage.label(water)
    edge=np.unique(np.concatenate([labels[0,:],labels[-1,:],labels[:,0],labels[:,-1]]))
    edge=edge[edge>0]
    if not edge.size: return np.zeros_like(water,dtype=bool)
    ocean=np.isin(labels,edge)
    return morphology.remove_small_holes(ocean,max_size=MIN_COMPONENT_PIXELS-1)


def clean_change(mask):
    mask=morphology.remove_small_objects(mask,max_size=MIN_COMPONENT_PIXELS-1)
    return morphology.opening(mask,morphology.disk(1))


def mask_to_features(mask, affine, inverse, properties):
    out=[]
    for geom,value in shapes(mask.astype("uint8"),mask=mask,transform=affine):
        if value != 1: continue
        projected=shape(geom)
        geographic=geom_transform(inverse,projected)
        out.append({"type":"Feature","properties":dict(properties),"geometry":mapping(geographic)})
    return out


def analyse_village(feature, catalog, current_year, baseline_year):
    props=feature.get("properties",{})
    name=props.get("WADMKD") or props.get("NAMOBJ") or "Tanpa nama"
    district=props.get("WADMKC")
    regency=props.get("WADMKK") or props.get("WIADKK")
    coords=list(iter_coords(feature["geometry"]))
    bbox=[min(x for x,y in coords),min(y for x,y in coords),max(x for x,y in coords),max(y for x,y in coords)]
    epsg,village,affine,width,height=grid_for(feature)
    village_mask=geometry_mask([mapping(village)],out_shape=(height,width),transform=affine,invert=True)
    periods=[]
    for year in [baseline_year,current_year]:
        start,end=annual_dates(year)
        items=search_items(catalog,bbox,start,end)
        result=composite(items,epsg,affine,width,height)
        if result is None:
            periods.append(None); continue
        index,clear,used=result
        periods.append({"year":year,"index":index,"clear":clear,
            "water":edge_connected_water(index,clear),"items":used})
    base,now=periods
    record={"village":name,"district":district,"regency":regency,"status":"insufficient-data",
        "baseline":str(baseline_year),"current":str(current_year)}
    if not base or not now:
        record["reason"]="Tidak tersedia komposit bebas awan yang memadai pada salah satu periode."
        return record,[]
    boundary=ndimage.binary_dilation(base["water"],iterations=1)^ndimage.binary_erosion(base["water"],iterations=1)
    boundary|=ndimage.binary_dilation(now["water"],iterations=1)^ndimage.binary_erosion(now["water"],iterations=1)
    near=ndimage.binary_dilation(boundary,iterations=COASTAL_BAND_PIXELS)
    analysis=village_mask & near & (base["clear"]>0) & (now["clear"]>0)
    coast_inside=boundary & ndimage.binary_dilation(village_mask,iterations=2)
    coast_length_m=float(coast_inside.sum()*RESOLUTION/2)
    if coast_length_m < 100:
        record.update(status="not-coastal",reason="Tidak ditemukan garis air laut yang memotong batas desa pada komposit.")
        return record,[]
    erosion=clean_change(base["water"]==False) & now["water"] & analysis
    accretion=clean_change(base["water"] & (now["water"]==False) & analysis)
    erosion_area=float(erosion.sum()*RESOLUTION*RESOLUTION)
    accretion_area=float(accretion.sum()*RESOLUTION*RESOLUTION)
    clear_fraction=float(((base["clear"]>0)&(now["clear"]>0)&village_mask).sum()/max(village_mask.sum(),1))
    retreat=erosion_area/max(coast_length_m,1)
    advance=accretion_area/max(coast_length_m,1)
    uncertainty=round(math.sqrt(2)*RESOLUTION,1)
    elapsed_years=max(1,current_year-baseline_year)
    confidence="tinggi" if clear_fraction>=.85 and len(base["items"])>=3 and len(now["items"])>=3 else "sedang" if clear_fraction>=.65 else "rendah"
    if max(retreat,advance)<uncertainty: confidence="rendah"
    record.update(status="analysed",coastlineLengthKm=round(coast_length_m/1000,2),
        erosionAreaHa=round(erosion_area/10000,2),accretionAreaHa=round(accretion_area/10000,2),
        indicativeMeanRetreatM=round(retreat,1),indicativeMeanAdvanceM=round(advance,1),
        netAreaChangeHa=round((accretion_area-erosion_area)/10000,2),elapsedYears=elapsed_years,
        indicativeRetreatRateMPerYear=round(retreat/elapsed_years,2),indicativeAdvanceRateMPerYear=round(advance/elapsed_years,2),
        clearCoveragePct=round(clear_fraction*100,1),
        baselineSceneCount=len(base["items"]),currentSceneCount=len(now["items"]),
        positionalUncertaintyM=uncertainty,confidence=confidence,
        baselineScenes=[i.id for i in base["items"]],currentScenes=[i.id for i in now["items"]])
    inverse=Transformer.from_crs(epsg,4326,always_xy=True).transform
    common={"village":name,"district":district,"regency":regency,"baseline":record["baseline"],
        "current":record["current"],"confidence":confidence,"resolutionM":RESOLUTION,"uncertaintyM":uncertainty}
    features=mask_to_features(erosion,affine,inverse,{**common,"change":"erosion"})
    features+=mask_to_features(accretion,affine,inverse,{**common,"change":"accretion"})
    print(name,record["status"],record.get("erosionAreaHa"),record.get("accretionAreaHa"),confidence)
    return record,features


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--year",type=int)
    parser.add_argument("--baseline-year",type=int,default=2016)
    parser.add_argument("--villages",nargs="*",help="Optional exact village names")
    parser.add_argument("--source",type=Path,default=VILLAGES,
        help="GeoJSON source; use coastal-villages-riau.geojson for all coastal candidates")
    parser.add_argument("--output",type=Path,default=OUTPUT,help="Output change-polygon GeoJSON")
    parser.add_argument("--summary",type=Path,default=SUMMARY,help="Output village summary JSON")
    parser.add_argument("--regencies",nargs="*",help="Optional exact regency names")
    parser.add_argument("--non-intervention",action="store_true",
        help="Exclude intervention villages (requires the Intervention property)")
    parser.add_argument("--append",action="store_true",help="Merge processed villages into an existing annual product")
    args=parser.parse_args()
    current_year=args.year or datetime.now(timezone.utc).year-1
    baseline_year=args.baseline_year
    if current_year <= baseline_year: parser.error("comparison year must be later than baseline year")
    output=args.output.resolve()
    summary_path=args.summary.resolve()
    source=json.loads(args.source.resolve().read_text(encoding="utf-8"))
    selected=source["features"]
    selected=[f for f in selected if str((f.get("properties") or {}).get("WADMKD") or
        (f.get("properties") or {}).get("NAMOBJ") or "").casefold() not in NON_VILLAGE_NAMES]
    if args.non_intervention:
        selected=[f for f in selected if not bool((f.get("properties") or {}).get("Intervention"))]
    if args.regencies:
        wanted_regencies={x.casefold() for x in args.regencies}
        selected=[f for f in selected if str((f.get("properties") or {}).get("WADMKK") or
            (f.get("properties") or {}).get("WIADKK") or "").casefold() in wanted_regencies]
    if args.villages:
        wanted={x.casefold() for x in args.villages}
        selected=[f for f in selected if str(f.get("properties",{}).get("WADMKD","")).casefold() in wanted]
    catalog=Client.open("https://planetarycomputer.microsoft.com/api/stac/v1",modifier=pc.sign_inplace)
    records=[]; features=[]
    for feature in selected:
        record,parts=analyse_village(feature,catalog,current_year,baseline_year)
        records.append(record); features.extend(parts)
    if args.append and output.exists() and summary_path.exists():
        previous_summary=json.loads(summary_path.read_text(encoding="utf-8"))
        previous_geo=json.loads(output.read_text(encoding="utf-8"))
        replaced={str(row["village"]).casefold() for row in records}
        records=[row for row in previous_summary.get("villages",[]) if str(row.get("village","")).casefold() not in replaced]+records
        features=[f for f in previous_geo.get("features",[]) if str((f.get("properties") or {}).get("village","")).casefold() not in replaced]+features
    generated=datetime.now(timezone.utc).isoformat()
    collection={"type":"FeatureCollection","name":"Indikasi perubahan garis pantai tahunan desa pesisir Riau",
        "generatedAt":generated,"methodVersion":"s2-annual-water-edge-v1","features":features}
    summary={"schemaVersion":1,"generatedAt":generated,"product":"Indikasi perubahan garis pantai berbasis Sentinel-2",
        "methodVersion":"s2-annual-water-edge-v1","baseline":str(baseline_year),
        "current":str(current_year),"compositeWindow":"April–September","updateFrequency":"annual",
        "resolutionM":RESOLUTION,"minimumMappingUnitM2":MIN_COMPONENT_PIXELS*100,
        "disclaimer":"Bukan hasil survei garis pantai atau penetapan batas. Perubahan di bawah ketidakpastian posisi tidak boleh ditafsirkan sebagai abrasi pasti.",
        "source":"Copernicus Sentinel-2 Level-2A via Microsoft Planetary Computer STAC","villages":records}
    output.parent.mkdir(parents=True,exist_ok=True)
    summary_path.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(collection,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    summary_path.write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"records":len(records),"features":len(features),"output":str(output)},ensure_ascii=False))

if __name__ == "__main__": main()
