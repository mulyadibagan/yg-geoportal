import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('storage',Path(__file__).parents[1]/'scripts/dayun_private_storage.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class StorageTests(unittest.TestCase):
    def test_checkpoint_roundtrip_and_integrity_without_remote_io(self):
        objects={}
        def transfer(action,key,path,required=True):
            if action=='put':objects[key]=Path(path).read_bytes();return True
            if key not in objects:
                if required:raise RuntimeError('missing')
                return False
            Path(path).write_bytes(objects[key]);return True
        with tempfile.TemporaryDirectory() as root,patch.object(mod,'transfer',side_effect=transfer),patch.object(mod,'CHUNK',4):
            root=Path(root); source=root/'source.tif'
            partial=source.with_suffix('.tif.part'); marker=source.with_suffix('.tif.part.json')
            partial.write_bytes(b'II*\x00abcdef');marker.write_text(json.dumps({'id':'test','size':'20','version':'1'}))
            mod.checkpoint('Agro_ABC',source)
            dest=root/'restored.tif';mod.restore('Agro_ABC',dest)
            self.assertEqual(dest.with_suffix('.tif.part').read_bytes(),partial.read_bytes())
            self.assertEqual(json.loads(dest.with_suffix('.tif.part.json').read_text()),json.loads(marker.read_text()))
            key=next(k for k in objects if k.endswith('.bin'));objects[key]=b'corrupt'
            with self.assertRaisesRegex(RuntimeError,'invalid_checkpoint_chunk'):mod.restore('Agro_ABC',root/'bad.tif')
            self.assertFalse((root/'bad.tif.part').exists())
    def test_failed_publish_does_not_advertise_new_manifest(self):
        calls=[]
        def fail(action,key,path,required=True):calls.append(key);raise RuntimeError('transfer failed')
        with tempfile.TemporaryDirectory() as root,patch.object(mod,'transfer',side_effect=fail):
            (Path(root)/'download-status.json').write_text('{"ok":true}')
            with self.assertRaises(RuntimeError):mod.publish('Agro_ABC',root,'123-1')
            self.assertFalse(any(k.endswith('/index.json') for k in calls))

if __name__=='__main__':unittest.main()
