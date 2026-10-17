import json
from pathlib import Path
import sys
import tempfile
import unittest
import cv2
import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.windows import Window
from shapely.geometry import box,mapping
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from count_dayun_block import count_block,deduplicate


class WholeBlockTests(unittest.TestCase):
    def test_global_seam_duplicates_are_removed_by_score(self):
        f=lambda x,score:{'properties':{'source_pixel':[x,100],'similarity':score}}
        result=deduplicate([f(250,.4),f(260,.8),f(400,.5)])
        self.assertEqual([p['properties']['source_pixel'][0] for p in result],[260,400])

    def test_whole_native_coverage_halo_coordinates_rejection_and_resume(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'native').mkdir();source=root/'source.tif'
            data=np.full((4,512,512),90,dtype='uint8');data[3]=255
            rgb=np.moveaxis(data[:3],0,-1).copy()
            for angle in np.linspace(0,2*np.pi,18,endpoint=False):cv2.line(rgb,(256,256),(round(256+100*np.cos(angle)),round(256+100*np.sin(angle))),(40,150,40),5)
            data[:3]=np.moveaxis(rgb,-1,0);trans=from_origin(102,.58,.000001,.000001)
            profile=dict(driver='GTiff',width=512,height=512,count=4,dtype='uint8',crs=4326,transform=trans)
            with rasterio.open(source,'w',**profile) as dst:dst.write(data)
            before=source.read_bytes();tiles=[]
            for x in (0,256):
                win=Window(x,0,256,512);path=f'native/x{x}_y0.tif';p={**profile,'width':256,'transform':rasterio.windows.transform(win,trans)}
                with rasterio.open(root/path,'w',**p) as dst:dst.write(data[:,:,x:x+256])
                tiles.append({'file':path})
            (root/'analysis.json').write_text(json.dumps({'schema':'dayun-block-analysis-v1','block':'A','source_run':'fixture','native_tiles':tiles}))
            (root/'zones.geojson').write_text(json.dumps({'type':'FeatureCollection','features':[{'type':'Feature','geometry':mapping(box(102,.579488,102.000512,.58)),'properties':{'id':'GT-A-01','kind':'active_source'}}]}))
            with rasterio.open(source) as ds:
                result=count_block(root,root/'out',ds)
                self.assertEqual(result['full_block_count']['processed_tiles'],2)
                self.assertFalse(result['census_changed']);self.assertIsNone(result['pineapple_count_validated'])
                points=json.loads((root/'out/candidates.geojson').read_text())['features']
                self.assertEqual(sum(np.hypot(f['properties']['source_pixel'][0]-256,f['properties']['source_pixel'][1]-256)<12 for f in points),1)
                self.assertEqual(result['candidate_count'],len(points));self.assertEqual(len({f['properties']['id'] for f in points}),len(points))
                resumed=count_block(root,root/'out',ds);self.assertEqual(result['candidate_count'],resumed['candidate_count'])
                rejected=count_block(root,root/'rejected',ds,rejected=[list(trans*(256.5,256.5))]);self.assertGreaterEqual(rejected['full_block_count']['excluded_candidates'],1)
                self.assertRaisesRegex(ValueError,'provenance_mismatch',count_block,root,root/'out',ds,threshold=.4)
            self.assertEqual(source.read_bytes(),before)


if __name__=='__main__':unittest.main()
