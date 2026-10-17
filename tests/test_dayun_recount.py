import argparse
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import numpy as np
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import box, mapping

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from recount_dayun_revised import transfer_model, run, measure_native_coverage
from count_dayun_block import count_block


class RecountTests(unittest.TestCase):
    def test_physical_transfer_keeps_threshold_and_training_identity(self):
        model = dict(source_run='abc-original', model_signature='frozen', radii_native_pixels=[14,18,22],
                     suppression_native_pixels=24, matching_tolerance_native_pixels=12, threshold=.393)
        before = copy.deepcopy(model)
        result = transfer_model(model, [.00921675]*2, [.01869803]*2, 'def-original', 'D')
        self.assertEqual(model, before)
        self.assertEqual(result['radii_native_pixels'], [7,9,11])
        self.assertEqual(result['suppression_native_pixels'], 12)
        self.assertEqual(result['matching_tolerance_native_pixels'], 6)
        self.assertEqual(result['threshold'], .393)
        self.assertEqual(result['training_source_run'], 'abc-original')
        self.assertEqual(result['source_run'], 'def-original')
        self.assertTrue(result['historical_metrics_only'])
        self.assertFalse(result['evaluated_on_target_block'])

    def test_wrong_block_source_fails_before_opening_imagery(self):
        with self.assertRaisesRegex(ValueError, 'block_source_mismatch'):
            run(argparse.Namespace(label='Agro_ABC', block='D'))

    def test_current_staff_points_override_training_exclusions_and_guard_resume(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); (root/'native').mkdir()
            transform = from_origin(102, .58, .000001, .000001)
            data = np.full((4,96,96), 90, dtype='uint8'); data[3] = 255; data[3,:16] = 0
            path = root/'native/x0_y0.tif'
            with rasterio.open(path, 'w', driver='GTiff', width=96, height=96, count=4, dtype='uint8', crs=4326, transform=transform) as ds:
                ds.write(data)
            analysis = dict(block='A', source_run='fixture', native_tiles=[dict(file='native/x0_y0.tif')], resolution_crs_units=[.000001,.000001])
            (root/'analysis.json').write_text(json.dumps(analysis))
            zones = dict(type='FeatureCollection', features=[dict(type='Feature', geometry=mapping(box(102,.579904,102.000096,.58)), properties=dict(id='GT-A-01', kind='active_source'))])
            (root/'zones.geojson').write_text(json.dumps(zones))
            point = lambda x: dict(type='Feature', geometry=dict(type='Point', coordinates=list(transform*(x+.5,x+.5))), properties={})
            model = dict(schema='dayun-positive-radial-calibration-v1', source_run='fixture', model_signature='frozen', training_review_version='training-1', labels=[point(10)],
                         threshold=.393, radii_native_pixels=[3,4,5], suppression_native_pixels=4, matching_tolerance_native_pixels=3, limitations=[])
            before = path.read_bytes()
            with rasterio.open(path) as ds, patch('count_dayun_block.radial_propose', return_value=[(.8,32,32),(.8,64,64)]):
                result = count_block(root, root/'count', ds, calibration=model, manual_points=[point(32)], review_version='revision-13')
                self.assertEqual(result['candidate_count'], 1)
                points = json.loads((root/'count/candidates.geojson').read_text())['features']
                self.assertEqual(points[0]['properties']['source_pixel'], [64,64])
                with self.assertRaisesRegex(ValueError, 'provenance_mismatch'):
                    count_block(root, root/'count', ds, calibration=model, manual_points=[], review_version='revision-14')
            self.assertEqual(path.read_bytes(), before)
            coverage = measure_native_coverage(root, zones)[0]
            self.assertEqual(coverage['polygon_pixels'], 96*96)
            self.assertEqual(coverage['valid_pixels'], 80*96)
            self.assertGreater(coverage['nodata_area_ha'], 0)


class ReviewGridTests(unittest.TestCase):
    def test_compact_index_preserves_pixel_identity_and_membership(self):
        from recount_dayun_revised import review_grid
        analysis = dict(block='F', source_run='def', zones=[dict(id='GT-F-01'), dict(id='GM-F-P001')])
        candidates = dict(features=[dict(properties=dict(id='F-radial-x7-y8', source_pixel=[7,8], zones=['GT-F-01','GM-F-P001']))])
        result = review_grid(analysis, candidates, dict(width=10, height=20, transform=[1,0,100,0,-1,10,0,0,1]))
        self.assertEqual(result['points'], [[7,8,[0,1]]])
        self.assertEqual(result['source_run'], 'def')
        candidates['features'][0]['properties']['id'] = 'wrong'
        with self.assertRaisesRegex(ValueError, 'invalid_native_candidate_identity'):
            review_grid(analysis, candidates, dict(width=10, height=20, transform=[]))


if __name__ == '__main__':
    unittest.main()
