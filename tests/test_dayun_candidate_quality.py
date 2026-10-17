import json,sys,unittest
from pathlib import Path
import cv2,numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from dayun_candidate_quality import angular_descriptor,training_examples,scaled_radii,fit_angular_guard,filter_proposals


class CandidateQualityTests(unittest.TestCase):
    def test_rejections_are_not_silently_relabelled_as_other_species(self):
        rows=[{'properties':{'status':s,**({'rejection_reason':r} if r else {})}} for s,r in [('accepted',None),('rejected',None),('rejected','duplicate'),('rejected','misplaced'),('rejected','unclear'),('rejected','not_pineapple')]]
        review={'changes':rows};before=json.dumps(review);d=training_examples(review)
        self.assertEqual(len(d['positive']),1);self.assertEqual(len(d['negative']),1);self.assertEqual(len(d['unclassified_rejections']),4);self.assertEqual(json.dumps(review),before)

    def test_physical_scales_transfer_with_verified_metric_gsd_not_degrees(self):
        self.assertEqual(scaled_radii([14,18,22],[.0092,.0092],[.0187,.0187]),[7,9,11])
        for target in ([0,.01],[float('nan'),.01],[.01,.02]):self.assertRaises(ValueError,scaled_radii,[14,18], [.01,.01],target)

    def test_radial_leaf_edges_have_support_around_more_sectors_than_a_cross(self):
        rgb=np.full((225,225,3),70,dtype=np.uint8);cross=rgb.copy()
        for a in np.linspace(0,2*np.pi,18,endpoint=False):cv2.line(rgb,(112,112),(round(112+60*np.cos(a)),round(112+60*np.sin(a))),(120,180,120),3)
        cv2.line(cross,(52,112),(172,112),(120,180,120),3);cv2.line(cross,(112,52),(112,172),(120,180,120),3)
        valid=np.ones((225,225),bool);before=rgb.tobytes();a=angular_descriptor(rgb,valid);b=angular_descriptor(cross,valid)
        self.assertGreater(a['score'],b['score']);self.assertIsNone(a['species_probability']);self.assertEqual(rgb.tobytes(),before)
        valid[112,112]=False;self.assertIsNone(angular_descriptor(rgb,valid));self.assertRaises(ValueError,angular_descriptor,rgb[:20,:20],valid[:20,:20])

    def test_fit_uses_only_supplied_training_positives_and_cannot_claim_species_validation(self):
        samples=[{'score':x} for x in np.linspace(.1,.9,17)];before=json.dumps(samples);m=fit_angular_guard(samples,source_run='run',review_version='private/revision',radii=[14,18,22],gsd_m=[.01,.01])
        self.assertAlmostEqual(m['threshold'],.18);self.assertFalse(m['production_species_validated']);self.assertIsNone(m['validated_pineapple_total']);self.assertEqual(json.dumps(samples),before)
        self.assertRaises(ValueError,fit_angular_guard,samples[:3],source_run='run',review_version='v',radii=[14],gsd_m=[.01,.01])

    def test_optional_guard_keeps_coordinates_and_refuses_another_resolution(self):
        rgb=np.full((225,225,3),70,np.uint8);valid=np.ones((225,225),bool)
        for a in np.linspace(0,2*np.pi,18,endpoint=False):cv2.line(rgb,(112,112),(round(112+60*np.cos(a)),round(112+60*np.sin(a))),(120,180,120),3)
        d=angular_descriptor(rgb,valid);m=fit_angular_guard([d]*10,source_run='run',review_version='v',radii=[10,14,18,22,28,36,44,56,72],gsd_m=[.01,.01]);proposal=(.4,112,112)
        self.assertEqual(filter_proposals(rgb,valid,[proposal,(.8,2,2)],m,[.01,.01]),[proposal]);self.assertRaisesRegex(ValueError,'gsd_mismatch',filter_proposals,rgb,valid,[proposal],m,[.02,.02]);valid[112,112]=False;self.assertEqual(filter_proposals(rgb,valid,[proposal],m,[.01,.01]),[])


if __name__=='__main__':unittest.main()
