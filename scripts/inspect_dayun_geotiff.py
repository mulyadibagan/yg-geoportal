"""Read existing Dayun orthomosaics; never edit census or publish map layers."""
import argparse, csv, json, math
from pathlib import Path
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.features import geometry_mask, geometry_window
from rasterio.warp import transform_geom
from rasterio.windows import Window
from PIL import Image
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union
from pyproj import CRS

def analyze(source, label, output, map_path):
    out = Path(output); out.mkdir(parents=True, exist_ok=True)
    features = json.loads(Path(map_path).read_text())["features"]
    rows = []; groups = {}
    for f in features:
        p=f.get("properties", {})
        if p.get("category") != "Gawangan Tanam": continue
        key=p.get("sourceGawanganId") or p.get("shortId")
        if key: groups.setdefault(key, []).append(f)
    with rasterio.open(source) as ds:
        if not ds.crs or ds.count < 3: raise ValueError("GeoTIFF requires CRS and at least 3 RGB bands")
        if any(t != "uint8" for t in ds.dtypes[:3]): raise ValueError("Expected uint8 RGB; do not silently rescale")
        crs=CRS(ds.crs)
        determinant=abs(ds.transform.a*ds.transform.e-ds.transform.b*ds.transform.d)
        meter_factor=crs.axis_info[0].unit_conversion_factor if crs.is_projected else None
        pixel_m2=determinant*meter_factor**2 if meter_factor else None
        summary={"label":label,"width":ds.width,"height":ds.height,"bands":ds.count,
          "crs":ds.crs.to_string(),"resolution_crs_units":list(ds.res),"bounds":list(ds.bounds),
          "pixel_area_m2":pixel_m2,"tags":ds.tags(),
          "note":"Vegetation includes weeds and trees. No pineapple count or health diagnosis inferred.",
          "capture_date":"unverified"}
        scale=min(1,2400/max(ds.width,ds.height))
        h=max(1,round(ds.height*scale)); w=max(1,round(ds.width*scale))
        rgb=ds.read([1,2,3],out_shape=(3,h,w),resampling=Resampling.average)
        Image.fromarray(np.moveaxis(rgb,0,-1)).save(out/"overview.jpg",quality=92)
        summary["gawangan"]=[]
        for key, fs in sorted(groups.items()):
            geom=unary_union([shape(transform_geom("EPSG:4326",ds.crs,f["geometry"])) for f in fs])
            clipped=geom.intersection(box(*ds.bounds))
            p=fs[0]["properties"]
            if clipped.is_empty: continue
            gj=mapping(clipped)
            try: win=geometry_window(ds,[gj])
            except rasterio.errors.WindowError: continue
            win=win.round_offsets().round_lengths()
            valid_total=green_total=polygon_total=0; parts=[]
            dest=out/key; dest.mkdir(exist_ok=True)
            # Every intersecting full-resolution pixel is visited in bounded windows.
            for y in range(int(win.row_off),int(win.row_off+win.height),2048):
                for x in range(int(win.col_off),int(win.col_off+win.width),2048):
                    tw=Window(x,y,min(2048,int(win.col_off+win.width)-x),min(2048,int(win.row_off+win.height)-y))
                    tr=ds.window_transform(tw)
                    inside=geometry_mask([gj],out_shape=(int(tw.height),int(tw.width)),transform=tr,invert=True)
                    if not inside.any(): continue
                    rgb=ds.read([1,2,3],window=tw)
                    valid=inside & (ds.dataset_mask(window=tw)>0)
                    polygon_total+=int(inside.sum())
                    if not valid.any(): continue
                    r,g,b=rgb.astype("float32")
                    # A visible greenness proxy, explicitly not a species classifier.
                    green=valid & (2*g-r-b>15) & (g>r*1.05) & (g>b*1.05)
                    valid_total+=int(valid.sum()); green_total+=int(green.sum())
                    name=f"x{x}_y{y}"
                    profile=dict(driver="GTiff",width=int(tw.width),height=int(tw.height),count=4,
                      dtype="uint8",crs=ds.crs,transform=tr,compress="deflate",tiled=True,
                      blockxsize=256,blockysize=256,photometric="RGB")
                    with rasterio.open(dest/(name+".tif"),"w",**profile) as dst:
                        dst.write(rgb,indexes=[1,2,3]); dst.write(valid.astype("uint8")*255,4)
                        dst.colorinterp=(rasterio.enums.ColorInterp.red,rasterio.enums.ColorInterp.green,rasterio.enums.ColorInterp.blue,rasterio.enums.ColorInterp.alpha)
                    preview=rgb.copy(); preview[:,~valid]=255
                    Image.fromarray(np.moveaxis(preview,0,-1)).save(dest/(name+".jpg"),quality=92)
                    parts.append({"file":str(Path(key)/(name+".tif")),"window":[x,y,int(tw.width),int(tw.height)]})
            row={"gawangan":key,"block":p.get("block"),"source":label,
                "polygon_pixels":polygon_total,"valid_pixels":valid_total,
                "valid_coverage_percent":round(100*valid_total/polygon_total,2) if polygon_total else 0,
                "green_proxy_percent":round(100*green_total/valid_total,2) if valid_total else None,
                "valid_area_ha":round(valid_total*pixel_m2/10000,5) if pixel_m2 else None,
                "pineapple_count":None,"status":"requires_visual_and_field_validation"}
            rows.append(row); summary["gawangan"].append(dict(row,tiles=parts))
            print(json.dumps(row),flush=True)
        (out/"metadata.json").write_text(json.dumps(summary,indent=2))
        if rows:
            with (out/"gawangan.csv").open("w",newline="") as f:
                writer=csv.DictWriter(f,fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
        (out/"README.txt").write_text("Analisis persiapan citra Dayun. Seluruh petak yang bertumpang tindih batas gawangan dipotong pada resolusi asli. Angka green_proxy adalah tutupan kehijauan termasuk gulma dan pohon, BUKAN luas nanas atau jumlah tanaman. Tanggal penerbangan belum terverifikasi. Tidak ada perubahan data sensus atau publikasi layer. Potongan berkoordinat di folder tiap gawangan; overview.jpg hanya pratinjau.\\n")
    return rows

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("source"); p.add_argument("label"); p.add_argument("output")
    p.add_argument("--map",default="data/dayun-map.geojson")
    a=p.parse_args(); analyze(a.source,a.label,a.output,a.map)
