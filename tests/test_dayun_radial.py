import json
from pathlib import Path
import sys
import tempfile
import unittest
import cv2
import numpy as np
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import box, mapping
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from propose_dayun_candidates import radial_propose
from propose_dayun_radial_trial import build


class RadialTests(unittest.TestCase):
    def image(self):
        rgb=np.full((512,512,3),90,dtype='uint8')
        for angle in np.linspace(0,2*np.pi,18,endpoint=False):
            cv2.line(rgb,(256,256),(round(256+100*np.cos(angle)),round(256+100*np.sin(angle))),(40,150,40),5)
        return rgb

    def test_radial_shape_survives_brightness_change_and_blank_is_not_plant(self):
        valid=np.ones((512,512),bool)
        for rgb in [self.image(),self.image()+30]:
            proposals=radial_propose(rgb,valid)
            self.assertTrue(any(np.hypot(x-256,y-256)<12 for _,x,y in proposals))
        self.assertEqual(radial_propose(np.full((512,512,3),90,dtype='uint8'),valid),[])

    def test_nodata_and_zone_centres_are_excluded(self):
        rgb=self.image();valid=np.ones((512,512),bool)
        self.assertEqual(radial_propose(rgb,valid,zone=np.zeros_like(valid)),[])
        valid[250:260,250:260]=False
        self.assertFalse(any(np.hypot(x-256,y-256)<40 for _,x,y in radial_propose(rgb,valid)))

    def test_build_preserves_source_and_native_coordinates_and_records_no_census(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);data=np.moveaxis(self.image(),-1,0);data=np.concatenate([data,np.full((1,512,512),255,dtype='uint8')])
            source=root/'source.tif';trans=from_origin(102,.58,.000001,.000001)
            with rasterio.open(source,'w',driver='GTiff',width=512,height=512,count=4,dtype='uint8',crs=4326,transform=trans) as ds:ds.write(data)
            before=source.read_bytes()
            sample={'zone_id':'GT-A-01','stratum':'median','native_tile':'source.tif','pixel_window':[0,0,512,512]}
            (root/'detail-analysis.json').write_text(json.dumps({'source_run':'run','samples':[sample]}))
            (root/'detail-provenance.json').write_text('{}')
            (root/'zones.geojson').write_text(json.dumps({'features':[{'properties':{'id':'GT-A-01'},'geometry':mapping(box(102,.579488,102.000512,.58))}]}))
            config=root/'config.json';config.write_text(json.dumps({'source_run':'run','samples':[{'id':'A01-R01','zone_id':'GT-A-01','stratum':'median','role':'heldout_unlabelled'}]}))
            result=build(root,config,root/'output')
            self.assertFalse(result['census_changed']);self.assertIsNone(result['pineapple_count_validated'])
            sample=result['samples'][0];self.assertTrue(sample['features'])
            with rasterio.open(root/'output/native/A01-R01.tif') as ds:
                self.assertEqual(ds.transform,trans);self.assertEqual(ds.res,(.000001,.000001));self.assertTrue(np.array_equal(ds.read(),data))
            self.assertEqual(source.read_bytes(),before)
            for f in sample['features']:
                x,y=f['properties']['pixel'];self.assertEqual(f['geometry']['coordinates'],list(trans*(x+.5,y+.5)));self.assertFalse(f['properties']['species_confirmed'])
            config.write_text(json.dumps({'source_run':'wrong'}));self.assertRaisesRegex(ValueError,'source_run_mismatch',build,root,config,root/'other')
