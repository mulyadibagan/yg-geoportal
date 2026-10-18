import copy,sys,unittest
from pathlib import Path
import numpy as np
from affine import Affine
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from retrain_dayun_suggestions import spatial_split,exclude_near,native_window

class RetrainTests(unittest.TestCase):
    def test_spatial_cells_and_buffer_keep_related_positive_views_out_of_holdout_training(self):
        points=[np.array([x*600+j*20,y*600],float) for x in range(8) for y in range(6) for j in range(3)]
        split=spatial_split(points,np.array([.01,.01]));train,held=split['train'],split['heldout']
        self.assertGreaterEqual(len(train),20);self.assertGreaterEqual(len(held),10)
        for i in train:
            self.assertTrue(all(np.linalg.norm((points[i]-points[j])*.01)>=4 for j in held))
            self.assertTrue(all(tuple(np.floor(points[i]*.01/5))!=tuple(np.floor(points[j]*.01/5)) for j in held))
        self.assertEqual(set(sum(split.values(),[])),set(range(len(points))))

    def test_duplicate_exclusion_preserves_inputs_and_existing_decisions(self):
        def f(x,y):return {'geometry':{'coordinates':[x,y]},'properties':{'id':str(x)}}
        features=[f(1,1),f(1.1,1),f(2,2)];before=copy.deepcopy(features)
        kept=exclude_near(features,[[1,1]],[1,1],Affine.identity(),.22)
        self.assertEqual(kept,[features[2]]);self.assertEqual(features,before)

    def test_sparse_feedback_is_not_silently_declared_trainable(self):
        self.assertRaises(ValueError,spatial_split,[np.array([1,1])]*5,np.array([.01,.01]))

    def test_native_core_halos_join_real_pixels_and_leave_missing_context_invalid(self):
        class Reader:
            tiles=[(0,0,'one'),(2048,0,'two')]
            def read(self,file):return np.full((128,2048,3),10 if file=='one' else 20,'uint8'),np.ones((128,2048),bool)
        rgb,valid=native_window(Reader(),2040,120,20,20)
        self.assertTrue((rgb[:8,:8]==10).all());self.assertTrue((rgb[:8,8:]==20).all());self.assertTrue(valid[:8].all());self.assertFalse(valid[8:].any())

if __name__=='__main__':unittest.main()
