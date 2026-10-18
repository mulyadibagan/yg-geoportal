import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import numpy as np
from dayun_fruiting_shortlist import pale_centre, resemblance, shortlist


class FruitingShortlistTest(unittest.TestCase):
    def test_same_zone_parts_do_not_duplicate_candidates_and_neighbours_are_not_double_selected(self):
        rows=[{'id':'one','zones':['GT-A-01','GT-A-01'],'source_pixel':[100,100],'similarity':.9},
              {'id':'near','zones':['GT-A-01'],'source_pixel':[110,100],'similarity':.8},
              {'id':'far','zones':['GT-A-01','GT-A-02'],'source_pixel':[200,100],'similarity':.7}]
        self.assertEqual({r['id'] for r in shortlist(rows,['GT-A-01','GT-A-01','GT-A-02'])},{'one','far'})

    def test_featureless_or_all_green_pixels_do_not_become_pale_fruit_evidence(self):
        for color in [(0,0,0),(40,100,40),(220,220,220)]:
            rgb=np.zeros((65,65,3),'uint8');rgb[:]=color
            self.assertFalse(pale_centre(rgb))

    def test_reference_matching_handles_orientation_without_a_probability_claim(self):
        import cv2
        rng=np.random.default_rng(7);crop=rng.integers(0,255,(25,25,3),dtype='uint8')
        template=cv2.cvtColor(crop[6:19,6:19],cv2.COLOR_RGB2GRAY).astype('float32')
        self.assertGreater(resemblance(crop,np.ascontiguousarray(np.rot90(template))),.999)


if __name__=='__main__':
    unittest.main()
