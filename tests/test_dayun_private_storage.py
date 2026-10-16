import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('storage',Path(__file__).parents[1]/'scripts/dayun_private_storage.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class StorageTests(unittest.TestCase):
    def test_only_missing_manifest_is_optional_not_permission_failure(self):
        for code in (404,403):
            with self.subTest(code=code),patch.object(mod,'require_private_bucket'),patch.object(mod.urllib.request,'urlopen',side_effect=mod.urllib.error.HTTPError('https://api.cloudflare.com',code,'test',{},None)):
                if code==404:self.assertFalse(mod.transfer('get','drone/analysis/dayun/requests/Agro_ABC.json','unused',required=False))
                else:
                    with self.assertRaisesRegex(RuntimeError,'read_denied'):mod.transfer('get','drone/analysis/dayun/requests/Agro_ABC.json','unused',required=False)
    def test_public_bucket_rejected_before_wranger_runs(self):
        with patch.object(mod,'verify',side_effect=RuntimeError('r2_managed_public_access_enabled_or_unknown')),patch.object(mod,'_privacy_checked',0),patch.object(mod.subprocess,'run') as command:
            with self.assertRaisesRegex(RuntimeError,'public_access'):
                mod.transfer('put','drone/analysis/dayun/test.txt','unused')
            command.assert_not_called()
    def test_keys_outside_approved_prefix_rejected(self):
        with patch.object(mod,'verify') as verify,patch.object(mod.subprocess,'run') as command:
            with self.assertRaisesRegex(RuntimeError,'invalid_key'):mod.transfer('put','drone/jobs/test.json','unused')
            verify.assert_not_called();command.assert_not_called()
    def test_completed_source_is_checkpointed_for_processing_retry(self):
        calls=[]
        def transfer(action,key,path,required=True):
            if action=='get':return False
            calls.append((key,Path(path).read_bytes()));return True
        with tempfile.TemporaryDirectory() as root,patch.object(mod,'transfer',side_effect=transfer):
            source=Path(root)/'source.tif';source.write_bytes(b'II*\x00complete')
            source.with_suffix('.tif.source.json').write_text('{"id":"test","size":"12"}')
            mod.checkpoint('Agro_DEF',source)
            self.assertEqual(calls[0][1],source.read_bytes())
            manifest=json.loads(calls[-1][1]);self.assertEqual(manifest['identity']['id'],'test')
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
