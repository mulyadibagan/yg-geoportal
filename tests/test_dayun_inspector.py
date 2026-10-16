import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import sys
sys.path.insert(0,str(Path(__file__).parents[1]/'scripts'))
import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import transform_geom
from shapely.geometry import box, mapping

spec=importlib.util.spec_from_file_location('inspector',Path(__file__).parents[1]/'scripts/inspect_dayun_geotiff.py')
mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)

class InspectorTests(unittest.TestCase):
    def test_wgs84_native_pixels_have_geodesic_area_and_gsd(self):
        with tempfile.TemporaryDirectory() as root:
            root=Path(root);source=root/'source.tif';polygons=root/'map.json';output=root/'result'
            tr=from_origin(102,.584,1e-6,1e-6)
            with rasterio.open(source,'w',driver='GTiff',width=10,height=10,count=3,dtype='uint8',crs='EPSG:4326',transform=tr) as dst:
                dst.write(np.full((3,10,10),100,dtype='uint8'));mask=np.full((10,10),255,dtype='uint8');mask[:,0]=0;dst.write_mask(mask)
            feature={'type':'Feature','properties':{'category':'Gawangan Tanam','sourceGawanganId':'D-01'},'geometry':mapping(box(102,.58399,102.00002,.584))}
            polygons.write_text(json.dumps({'features':[feature,feature]}))
            rows=mod.analyze(source,'test',output,polygons);meta=json.loads((output/'metadata.json').read_text())
            self.assertEqual(len(rows),1);self.assertAlmostEqual(rows[0]['valid_coverage_percent'],45,delta=.001)
            self.assertGreater(rows[0]['outside_raster_area_ha'],0);self.assertGreater(rows[0]['nodata_area_ha'],0)
            self.assertTrue(.11<meta['gsd_m'][0]<.112);self.assertTrue(.11<meta['gsd_m'][1]<.112)
            self.assertLess(rows[0]['pixel_area_variation_percent'],.001)
            with rasterio.open(output/meta['gawangan'][0]['tiles'][0]['file']) as crop:self.assertEqual(crop.transform,tr);self.assertEqual(crop.crs.to_epsg(),4326)
    def test_full_polygon_denominator_dissolve_nodata_and_native_crops(self):
        with tempfile.TemporaryDirectory() as root:
            root=Path(root); source=root/'source.tif'; polygons=root/'map.json'; output=root/'result'
            tr=from_origin(500000,100,1,1)
            rgb=np.full((3,10,10),100,dtype='uint8')
            with rasterio.open(source,'w',driver='GTiff',width=10,height=10,count=3,dtype='uint8',crs='EPSG:32648',transform=tr) as dst:
                dst.write(rgb); mask=np.full((10,10),255,dtype='uint8');mask[:,0]=0;dst.write_mask(mask)
                dst.update_tags(TIFFTAG_DATETIME='2025:01:01 12:00:00')
            def feature(key,geom):
                return {'type':'Feature','properties':{'category':'Gawangan Tanam','sourceGawanganId':key,'block':key[0]},'geometry':transform_geom('EPSG:32648','EPSG:4326',mapping(geom))}
            a=feature('A-01',box(500000,90,500020,100)); outside=feature('F-01',box(500100,90,500110,100))
            polygons.write_text(json.dumps({'features':[a,a,outside]}))
            rows=mod.analyze(source,'test',output,polygons)
            self.assertEqual(len(rows),2)
            self.assertEqual(rows[0]['valid_pixels'],90)
            self.assertAlmostEqual(rows[0]['valid_coverage_percent'],45,places=2)
            self.assertAlmostEqual(rows[0]['within_raster_valid_percent'],90,places=2)
            self.assertEqual(rows[1]['status'],'outside_source')
            meta=json.loads((output/'metadata.json').read_text())
            self.assertIsNone(meta['capture_date'])
            self.assertIsNone(rows[0]['pineapple_count'])
            with rasterio.open(output/meta['gawangan'][0]['tiles'][0]['file']) as crop:
                self.assertEqual(crop.res,(1,1));self.assertEqual(crop.crs.to_epsg(),32648)
                self.assertEqual(crop.transform,tr)
                self.assertEqual(int((crop.read(4)>0).sum()),90)
            self.assertEqual(len(json.loads((output/'coverage.geojson').read_text())['features']),2)

if __name__=='__main__':unittest.main()
