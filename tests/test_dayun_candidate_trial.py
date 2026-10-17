import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
try:
    import numpy as np
    from propose_dayun_candidates import propose,suppress
except ImportError:
    propose=None

@unittest.skipIf(propose is None,'Optional OpenCV trial dependency is not installed')
class CandidateTrialTests(unittest.TestCase):
    def test_nearby_duplicate_matches_are_not_counted_twice(self):
        self.assertEqual(suppress([(.8,10,10),(.9,11,11),(.7,90,90)]),[(.9,11,11),(.7,90,90)])
    def test_uniform_rgb_does_not_become_a_plant_count(self):
        rng=np.random.default_rng(1);template=rng.integers(0,255,(21,21),dtype=np.uint8)
        self.assertEqual(propose(np.full((80,80,3),100,np.uint8),np.ones((80,80),bool),[template]),[])
    def test_template_on_nodata_is_excluded(self):
        rng=np.random.default_rng(2);template=rng.integers(0,255,(21,21),dtype=np.uint8)
        rgb=np.full((80,80,3),100,np.uint8);rgb[30:51,30:51]=template[:,:,None]
        self.assertTrue(propose(rgb,np.ones((80,80),bool),[template],.9))
        self.assertEqual(propose(rgb,np.zeros((80,80),bool),[template],.9),[])

if __name__=='__main__':unittest.main()
