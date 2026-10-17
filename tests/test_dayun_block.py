import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from dayun_checkpoint_reader import CheckpointReader
from analyze_dayun_block import block_zones, analyze
from shapely.geometry import box, mapping
import rasterio
from rasterio.transform import from_origin
import numpy as np


class BlockTests(unittest.TestCase):
    def test_checkpoint_seek_cross_chunk_and_hash_guard(self):
        chunks = [b'abcdefgh', b'ijklmnop']
        manifest = {'identity': {'id': 'fixture'}, 'parts': [{'key': f'drone/analysis/dayun/checkpoints/Agro_ABC/{i}.bin', 'bytes': len(v), 'sha256': hashlib.sha256(v).hexdigest()} for i, v in enumerate(chunks)]}
        def transfer(action, key, path):
            self.assertEqual(action, 'get')
            Path(path).write_bytes(json.dumps(manifest).encode() if key.endswith('index.json') else chunks[int(key.split('/')[-1][0])])
        with tempfile.TemporaryDirectory() as root, patch('dayun_checkpoint_reader.transfer', transfer):
            reader = CheckpointReader('Agro_ABC', root)
            reader.seek(6)
            self.assertEqual(reader.read(5), b'ghijk')
            self.assertEqual(reader.seek(-3, 2), 13)
            self.assertEqual(reader.read(), b'nop')
            self.assertEqual(reader.read(1), b'')
            self.assertRaises(FileNotFoundError, reader.opener, 'source.tif.aux.xml')
            child = reader.opener('source.tif')
            self.assertEqual(child.read(2), b'ab')
            bad = Path(root) / (manifest['parts'][0]['sha256'] + '.bin')
            bad.write_bytes(b'badbytes')
            reader.verified.clear()
            reader.seek(0)
            self.assertRaisesRegex(ValueError, 'invalid_checkpoint_chunk', reader.read, 1)

    def features(self):
        def feature(key, geom, category='Gawangan Tanam', block='Blok A'):
            return {'type': 'Feature', 'geometry': mapping(geom), 'properties': {'category': category, 'sourceGawanganId': key, 'block': block}}
        return [feature('GT-A-01', box(102, .58, 102.00004, .58008)), feature('GT-A-01', box(102.00004, .58, 102.00008, .58008)), feature('GT-B-01', box(102.001, .58, 102.00108, .58008), block='Blok B'), feature(None, box(102.00006, .58, 102.0001, .58008), 'Gawangan mati')]

    def test_union_original_ids_and_inferred_dead_assignment_and_overlap(self):
        features = self.features()
        before = json.dumps(features)
        zones, audit = block_zones(features, 'A')
        self.assertEqual(sum(z['kind'] == 'active_source' for z in zones), 1)
        self.assertEqual(len(zones), 2)
        self.assertEqual(zones[1]['assignment'], 'nearest_centroid_block_inferred')
        self.assertEqual(len(audit), 1)
        self.assertEqual(json.dumps(features), before)

    def test_native_block_outputs_are_exploratory_and_resumable(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            source = root / 'source.tif'
            transform = from_origin(102, .5801, .000001, .000001)
            data = np.random.default_rng(7).integers(20, 230, size=(4, 120, 140), dtype='uint8')
            data[3] = 255
            with rasterio.open(source, 'w', driver='GTiff', width=140, height=120, count=4, crs=4326, transform=transform, dtype='uint8') as ds:
                ds.write(data)
            config = root / 'config.json'
            config.write_text(json.dumps({'source_run': 'fixture-run', 'samples': [{'id': 'sample', 'local_tif': str(source), 'window': [0, 0, 100, 100]}], 'templates': [{'sample': 'sample', 'center': [40, 40], 'size': 21}]}))
            geo = root / 'map.json'
            geo.write_text(json.dumps({'features': self.features()}))
            out = root / 'out'
            result = analyze(source, config, out, geo)
            self.assertFalse(result['census_changed'])
            self.assertIsNone(result['pineapple_count_validated'])
            self.assertEqual(len(result['zones']), 2)
            with rasterio.open(out / result['native_tiles'][0]['file']) as ds:
                self.assertEqual(ds.res, (.000001, .000001))
                self.assertEqual(ds.crs.to_epsg(), 4326)
            candidates = json.loads((out / 'candidates.geojson').read_text())['features']
            self.assertEqual(len(candidates), len({f['properties']['id'] for f in candidates}))
            self.assertEqual(analyze(source, config, out, geo)['candidate_count'], result['candidate_count'])
            config.write_text(config.read_text() + ' ')
            self.assertRaisesRegex(ValueError, 'provenance_mismatch', analyze, source, config, out, geo)


if __name__ == '__main__':
    unittest.main()
