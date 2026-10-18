import json,sys,tempfile,unittest
from pathlib import Path
import cv2,numpy as np,rasterio
from rasterio.transform import from_origin
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from dayun_negative_filter import NativePatches,metric_patch,descriptor,fit,score,TARGET_GSD,HALF


class NegativeComparisonTests(unittest.TestCase):
    def test_physical_resampling_preserves_shape_between_source_grids(self):
        def scene(gsd):
            y,x=np.mgrid[:161,:161];r=np.hypot((x-80)*gsd,(y-80)*gsd);a=np.arctan2(y-80,x-80)
            leaf=(r<.32)&(np.cos(a*12)>.65)
            rgb=np.full((161,161,3),65,'uint8');rgb[leaf]=[100,150,100]
            return rgb
        coarse=metric_patch(scene(TARGET_GSD),np.ones((161,161),bool),80,80,[TARGET_GSD]*2)
        fine=metric_patch(scene(TARGET_GSD/2),np.ones((161,161),bool),80,80,[TARGET_GSD/2]*2)
        a,b=descriptor(coarse),descriptor(fine)
        self.assertEqual(len(a),35)
        self.assertLess(np.mean(np.abs(a-b)),.12)
        self.assertIsNone(metric_patch(scene(TARGET_GSD),np.zeros((161,161),bool),80,80,[TARGET_GSD]*2))
        self.assertRaises(ValueError,metric_patch,scene(TARGET_GSD),np.ones((161,161),bool),80,80,[.01,.04])

    def test_discriminant_is_fitted_only_to_supplied_training_not_species_probability(self):
        rng=np.random.default_rng(17);p=rng.normal(1,.1,(17,35));n=rng.normal(-1,.1,(200,35));before=p.copy()
        model=fit(p,n,{'negative_training_block':'D','negative_independent_test_block':'F'})
        self.assertGreater(float(score(p,model).min()),float(score(n,model).max()))
        self.assertAlmostEqual(model['threshold'],float(np.quantile(score(p,model),.05)))
        self.assertFalse(model['production_species_validated']);self.assertIsNone(model['validated_pineapple_total'])
        np.testing.assert_array_equal(p,before)
        self.assertRaises(ValueError,score,np.zeros(34),model)
        self.assertRaises(ValueError,fit,p[:3],n,{})

    def test_original_pixels_are_joined_across_artificial_native_tile_seams(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'native').mkdir();rgb=np.zeros((128,4096,3),'uint8');rgb[:]=[65,65,65]
            for angle in np.linspace(0,2*np.pi,12,endpoint=False):cv2.line(rgb,(2048,64),(int(2048+20*np.cos(angle)),int(64+20*np.sin(angle))),(100,160,100),2)
            tiles=[]
            for x in [0,2048]:
                name=f'native/x{x}_y0.tif';tiles.append({'file':name})
                with rasterio.open(root/name,'w',driver='GTiff',height=128,width=2048,count=4,dtype='uint8',crs=4326,transform=from_origin(x,128,1,1)) as ds:
                    ds.write(np.moveaxis(rgb[:,x:x+2048],-1,0),[1,2,3]);ds.write(np.full((128,2048),255,'uint8'),4)
            (root/'analysis.json').write_text(json.dumps({'native_tiles':tiles}))
            joined=NativePatches(root,[TARGET_GSD]*2).patch(2048,64)
            direct=metric_patch(rgb,np.ones(rgb.shape[:2],bool),2048,64,[TARGET_GSD]*2)
            self.assertIsNotNone(joined);np.testing.assert_array_equal(joined,direct)
            doubled=NativePatches(root,[TARGET_GSD]*2).patch(2048,64,2.)
            direct_double=metric_patch(rgb,np.ones(rgb.shape[:2],bool),2048,64,[TARGET_GSD/2]*2)
            np.testing.assert_array_equal(doubled,direct_double)
            self.assertIsNone(NativePatches(root,[TARGET_GSD]*2).patch(2048,64,3.))
            self.assertRaises(ValueError,NativePatches(root,[TARGET_GSD]*2).patch,2048,64,4.)


if __name__=='__main__':unittest.main()
