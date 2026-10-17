import json
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import box, mapping
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from detail_dayun_block import detail, colour_masks
from trial_dayun_block_samples import trial


class DetailTests(unittest.TestCase):
    def test_colour_proxy_separates_dark_without_identifying_species(self):
        rgb = np.array([[[40, 130, 40], [25, 30, 25], [130, 90, 50], [250, 250, 250]]], dtype='uint8')
        vegetation, dark = colour_masks(rgb)
        self.assertEqual(vegetation.tolist(), [[True, False, False, False]])
        self.assertEqual(dark.tolist(), [[False, True, False, False]])

    def test_real_raster_mask_area_strata_provenance_and_no_census_estimate(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); (root/'native').mkdir()
            transform = from_origin(102, .58, .000001, .000001)
            data = np.zeros((4, 512, 512), dtype='uint8'); data[:3] = 90; data[3] = 255
            data[0, :, :256] = 40; data[1, :, :256] = 130; data[2, :, :256] = 40
            data[3, :256, 256:] = 0
            with rasterio.open(root/'native/one.tif', 'w', driver='GTiff', width=512, height=512, count=4, dtype='uint8', crs=4326, transform=transform) as ds:
                ds.write(data)
            source = {'block':'A','source_run':'fixture','native_tiles':[{'file':'native/one.tif'}]}
            (root/'analysis.json').write_text(json.dumps(source))
            geometry = mapping(box(102, .58-.000512, 102.000512, .58))
            (root/'zones.geojson').write_text(json.dumps({'features':[{'properties':{'id':'GT-A-01'},'geometry':geometry}]}))
            before = (root/'analysis.json').read_bytes()
            result = detail(root)
            self.assertEqual(result['cell_count'], 4)
            row = result['zones'][0]
            self.assertAlmostEqual(row['coverage_fraction'], .75)
            self.assertAlmostEqual(row['vegetation_proxy_fraction'], 2/3, places=4)
            self.assertIsNone(row['pineapple_count_validated'])
            self.assertIsNone(row['row_gap_area_validated_m2'])
            self.assertFalse(result['census_changed'])
            self.assertEqual((root/'analysis.json').read_bytes(), before)
            self.assertTrue((root/row['sample_sheet']).exists())
            self.assertTrue(all(s['species_validated'] is False for s in result['samples']))
            cells = json.loads((root/'detail-cells.geojson').read_text())['features']
            self.assertTrue(any('incomplete_image' in c['properties']['flags'] for c in cells))
            self.assertTrue(any('low_visible_vegetation_review' in c['properties']['flags'] for c in cells))
            provenance = json.loads((root/'detail-provenance.json').read_text())
            self.assertEqual(len(provenance['native_tiles'][0]['sha256']), 64)
            config = root/'local-config.json'
            config.write_text(json.dumps({'source_run':'different','templates':[]}))
            self.assertRaisesRegex(ValueError,'source_run_mismatch',trial,root,config)


if __name__ == '__main__':
    unittest.main()
