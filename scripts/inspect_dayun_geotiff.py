"""Read existing Dayun orthomosaics; never edit census or publish map layers."""
import argparse, csv, json, re
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
    rows = []; groups = {}; coverage_features=[]
    for f in features:
        p=f.get("properties", {})
        if p.get("category") != "Gawangan Tanam": continue
        key=p.get("sourceGawanganId") or p.get("shortId")
        if key:
            if not re.fullmatch(r'[A-Za-z0-9_-]+',key): raise ValueError('Unsafe gawangan ID')
            groups.setdefault(key, []).append(f)
    with rasterio.open(source) as ds:
        if not ds.crs or ds.count < 3: raise ValueError("GeoTIFF requires CRS and at least 3 RGB bands")
        if any(t != "uint8" for t in ds.dtypes[:3]): raise ValueError("Expected uint8 RGB; do not silently rescale")
        crs=CRS(ds.crs)
        determinant=abs(ds.transform.a*ds.transform.e-ds.transform.b*ds.transform.d)
        meter_factor=crs.axis_info[0].unit_conversion_factor if crs.is_projected else None
        pixel_m2=determinant*meter_factor**2 if meter_factor else None
        summary={"schema":"dayun-ortho-v2","label":label,"width":ds.width,"height":ds.height,"bands":ds.count,
          "crs":ds.crs.to_string(),"resolution_crs_units":list(ds.res),"bounds":list(ds.bounds),
          "pixel_area_m2":pixel_m2,"tags":ds.tags(),
          "note":"Vegetation includes weeds and trees. No pineapple count or health diagnosis inferred.",
          "capture_date":None,"capture_date_status":"unverified",
          "gsd_m": [v*meter_factor for v in ds.res] if meter_factor else None,
          "nodata":ds.nodata,"mask_flags":[[v.name for v in flags] for flags in ds.mask_flag_enums],
          "analysis_status":"coverage_only_pending_visual_review",
          "pineapple_count_status":"not_tested_on_original_samples",
          "pineapple_count_reason":"Inspect native-resolution samples and validate against independent manual counts before estimating plants. Greenness is not a species classifier.",
          "date_evidence":[{"namespace":ns,"tags":ds.tags(ns=ns)} for ns in [None]+ds.tag_namespaces() if ds.tags(ns=ns)]}
        scale=min(1,2400/max(ds.width,ds.height))
        h=max(1,round(ds.height*scale)); w=max(1,round(ds.width*scale))
        rgb=ds.read([1,2,3],out_shape=(3,h,w),resampling=Resampling.average)
        overview_mask=ds.dataset_mask(out_shape=(h,w),resampling=Resampling.nearest)
        rgb[:,overview_mask==0]=255
        Image.fromarray(np.moveaxis(rgb,0,-1)).save(out/"overview.jpg",quality=92)
        summary["gawangan"]=[]
        for key, fs in sorted(groups.items()):
            geom=unary_union([shape(transform_geom("EPSG:4326",ds.crs,f["geometry"])) for f in fs])
            clipped=geom.intersection(box(*ds.bounds))
            p=fs[0]["properties"]
            # Keep every gawangan, including those outside this source. Coverage
            # denominator is the whole dissolved polygon, not its raster overlap.
            total_area=geom.area*meter_factor**2 if meter_factor else None
            if clipped.is_empty:
                row={"gawangan":key,"block":p.get("block"),"source":label,
                     "polygon_pixels":0,"valid_pixels":0,"valid_coverage_percent":0,
                     "green_proxy_percent":None,"valid_area_ha":0 if meter_factor else None,
                     "polygon_area_ha":total_area/10000 if total_area else None,
                     "within_raster_valid_percent":None,"nodata_area_ha":0 if meter_factor else None,
                     "outside_raster_area_ha":total_area/10000 if total_area else None,
                     "recognizable_planted_area_ha":None,"row_gap_area_ha":None,
                     "pineapple_count":None,"status":"outside_source"}
                rows.append(row); summary["gawangan"].append(dict(row,tiles=[]))
                coverage_features.append({"type":"Feature","geometry":transform_geom(ds.crs,"EPSG:4326",mapping(geom)),"properties":row})
                continue
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
                "valid_coverage_percent":round(min(100,100*valid_total*pixel_m2/total_area),2) if total_area else None,
                "green_proxy_percent":round(100*green_total/valid_total,2) if valid_total else None,
                "valid_area_ha":round(valid_total*pixel_m2/10000,5) if pixel_m2 else None,
                "polygon_area_ha":total_area/10000 if total_area else None,
                "within_raster_valid_percent":round(100*valid_total/polygon_total,2) if polygon_total else 0,
                "nodata_area_ha":max(0,polygon_total-valid_total)*pixel_m2/10000 if pixel_m2 else None,
                "outside_raster_area_ha":max(0,geom.area-clipped.area)*meter_factor**2/10000 if meter_factor else None,
                "recognizable_planted_area_ha":None,"row_gap_area_ha":None,
                "pineapple_count":None,"status":"requires_visual_and_field_validation"}
            rows.append(row); summary["gawangan"].append(dict(row,tiles=parts))
            coverage_features.append({"type":"Feature","geometry":transform_geom(ds.crs,"EPSG:4326",mapping(geom)),"properties":row})
            # Per-gawangan results belong in the private output, not Actions logs.
        (out/"metadata.json").write_text(json.dumps(summary,indent=2))
        (out/"coverage.geojson").write_text(json.dumps({"type":"FeatureCollection","features":coverage_features}))
        (out/"review.json").write_text(json.dumps({"status":"pending_original_image_review","samples":[{"gawangan":g["gawangan"],"file":g["tiles"][0]["file"],"method":"manual native-resolution identification followed by independent count validation","count":None,"confidence":None} for g in summary["gawangan"] if g["tiles"]],"field_checks":[{"gawangan":r["gawangan"],"reason":"Missing coverage or nodata; verify source extent and field position","geometry_type":"whole_gawangan_not_a_detected_gap"} for r in rows if r["valid_coverage_percent"] is None or r["valid_coverage_percent"]<95]},indent=2))
        (out/"report.txt").write_text(
            f"Sumber: {label}\nCRS: {ds.crs}\nUkuran piksel dalam satuan CRS: {ds.res}\n"
            f"Gawangan unik: {len(rows)}\nTanggal penerbangan: belum terverifikasi. Tag waktu hanya bukti metadata, bukan tanggal penerbangan otomatis.\n"
            "Metode: union polygon berdasarkan ID, mask piksel asli, potongan RGBA berkoordinat. Cakupan valid dibandingkan seluruh luas gawangan; area di luar raster dan nodata dipisahkan. Batas piksel memakai pusat piksel sehingga batas polygon memiliki toleransi satu piksel.\n"
            "Hasil otomatis baru cakupan dan proxy kehijauan. Luas tanam yang dapat dikenali, celah barisan, serta jumlah nanas belum dinilai.\n"
            "Pemeriksaan berikutnya: buka sampel pada review.json di resolusi asli, identifikasi mahkota nanas terhadap gulma/pohon/bayangan, bandingkan hitungan independen, lalu catat metode dan keyakinan. Jangan memakai luas hijau atau kapasitas jarak tanam sebagai jumlah aktual.\n"
            "Peta coverage.geojson menunjukkan cakupan tiap gawangan; lokasi pemeriksaan adalah seluruh gawangan dengan cakupan rendah, bukan deteksi tanaman hilang. Dua sumber belum digabung menjadi estimasi tunggal; jangan menjumlahkan area yang saling tumpang tindih. Data sensus tidak diubah.\n")
        if rows:
            with (out/"gawangan.csv").open("w",newline="") as f:
                writer=csv.DictWriter(f,fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
        (out/"README.txt").write_text("Analisis persiapan citra Dayun. Seluruh petak yang bertumpang tindih batas gawangan dipotong pada resolusi asli. Angka green_proxy adalah tutupan kehijauan termasuk gulma dan pohon, BUKAN luas nanas atau jumlah tanaman. Tanggal penerbangan belum terverifikasi. Tidak ada perubahan data sensus atau publikasi layer. Potongan berkoordinat di folder tiap gawangan; overview.jpg hanya pratinjau.\\n")
    (out/"analysis-status.json").write_text(json.dumps({"ok":True,"stage":"coverage_ready","visual_analysis":"pending","plant_count":"not_tested"}))
    return rows

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("source"); p.add_argument("label"); p.add_argument("output")
    p.add_argument("--map",default="data/dayun-map.geojson")
    a=p.parse_args(); analyze(a.source,a.label,a.output,a.map)
