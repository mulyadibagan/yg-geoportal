import copy
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union, transform
from update_dayun_boundaries import revise, block_display_outline, PROJECT, UNPROJECT
from analyze_dayun_block import block_zones
from rebase_dayun_analysis import rebase, coverage_metadata


def feature(geom, properties):
    return dict(type='Feature', geometry=mapping(geom), properties=properties)


class BoundaryTests(unittest.TestCase):
    def test_official_dead_block_overrides_nearest_geometry(self):
        a = feature(box(102, .58, 102.001, .581), dict(category='Gawangan Tanam', sourceGawanganId='GT-A-01', block='Blok A'))
        b = feature(box(102.01, .58, 102.011, .581), dict(category='Gawangan Tanam', sourceGawanganId='GT-B-01', block='Blok B'))
        dead = feature(box(102.0001, .58, 102.0002, .581), dict(category='Gawangan mati', block='Blok B', sourceZoneId='GM-B-P001'))
        self.assertEqual(len(block_zones([a, b, dead], 'A')[0]), 1)
        zones, _ = block_zones([a, b, dead], 'B')
        self.assertEqual(zones[-1]['assignment'], 'source_block')
        self.assertEqual(zones[-1]['id'], 'GM-B-P001')

    def test_rebase_preserves_points_and_marks_new_detection_area(self):
        old = box(102, .58, 102.001, .581)
        new = box(102.0005, .58, 102.0015, .581)
        revised = dict(boundaryRevision=dict(id='revision'), features=[feature(new, dict(category='Gawangan Tanam', sourceGawanganId='GT-A-01', block='Blok A'))])
        candidates = dict(features=[feature(shape({'type': 'Point', 'coordinates': [x, .5805]}), dict(id=str(i), zones=['GT-A-01'])) for i, x in enumerate([102.0001, 102.0008])])
        before = copy.deepcopy(candidates)
        analysis = dict(block='A', candidate_count=2, native_tiles=[dict(bounds=list(old.bounds))])
        result, points, zones, _ = rebase(analysis, candidates, dict(features=[feature(old, {})]), revised)
        self.assertEqual(candidates, before)
        self.assertEqual(len(points['features']), 2)
        self.assertEqual(points['features'][0]['properties']['zones'], [])
        self.assertEqual(points['features'][1]['properties']['zones'], ['GT-A-01'])
        self.assertGreater(result['boundary_rebase']['newly_included_detection_area_m2'], 0)
        self.assertFalse(result['boundary_rebase']['detector_rerun'])
        self.assertEqual(zones['features'][0]['properties']['candidate_crowns'], 1)
        self.assertIsNone(result['full_block_count'])

    def test_new_metadata_does_not_reuse_old_mask_or_crop_measurements(self):
        revised = dict(boundaryRevision=dict(id='revision'), features=[feature(box(102, .58, 102.001, .581), dict(category='Gawangan Tanam', sourceGawanganId='GT-A-01'))])
        old = dict(label='Agro_ABC', bounds=[102, .58, 102.002, .582], gawangan=[dict(valid_coverage_percent=100, tiles=['old.tif'])])
        result, geo = coverage_metadata(old, revised)
        self.assertEqual(len(geo['features']), 1)
        self.assertEqual(result['gawangan'][0]['tiles'], [])
        self.assertIsNone(result['gawangan'][0]['valid_coverage_percent'])
        self.assertAlmostEqual(result['gawangan'][0]['geometric_extent_coverage_percent'], 100)

    def test_published_revision_preserves_sixty_unique_join_ids(self):
        root = Path(__file__).resolve().parents[1]
        geo = json.loads((root/'data/dayun-map.geojson').read_text(encoding='utf-8'))
        active = [f for f in geo['features'] if f['properties']['category'] == 'Gawangan Tanam']
        self.assertEqual(len(active), 86)
        self.assertEqual(len(set(f['properties']['sourceGawanganId'] for f in active)), 60)
        self.assertEqual(len(set(f['properties']['featureId'] for f in geo['features'])), len(geo['features']))
        self.assertTrue(all(shape(f['geometry']).is_valid for f in geo['features']))
        blocks = json.loads((root/'data/dayun-blocks.geojson').read_text(encoding='utf-8'))
        for block in blocks['features']:
            actual = unary_union([shape(f['geometry']) for f in geo['features'] if f['properties']['block'] == block['properties']['name']])
            self.assertTrue(actual.equals(shape(block['geometry'])))

    def test_display_closes_narrow_open_cracks_without_mutating_measurement_geometry(self):
        measured = box(168000, 64000, 168100, 64100).difference(box(168049.99, 64050, 168050.01, 64101))
        source = transform(UNPROJECT, measured)
        before = source.wkb
        display = transform(PROJECT, shape(block_display_outline(source)))
        self.assertEqual(source.wkb, before)
        self.assertEqual(len(display.interiors), 0)
        self.assertLess(display.length, measured.length - 90)
        self.assertLess(abs(display.area - measured.area), 2)

    def test_renumbering_fails_before_any_output_write(self):
        old = dict(features=[feature(box(102, .58, 102.001, .581), dict(category='Gawangan Tanam', sourceGawanganId='GT-A-01'))])
        new = dict(features=[feature(box(102, .58, 102.001, .581), dict(Informasi='Gawangan Tanam', Blok='Blok A', Gawangan='2'))])
        with self.assertRaisesRegex(ValueError, 'census_join_ids_changed'):
            revise(old, new, dict(features=[]), {})


if __name__ == '__main__':
    unittest.main()
