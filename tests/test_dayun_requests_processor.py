import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[1]/'scripts'))
spec=importlib.util.spec_from_file_location('processor',Path(__file__).parents[1]/'scripts/process_dayun_analysis_requests.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class ProcessorTests(unittest.TestCase):
    def test_manual_rerun_does_not_duplicate_an_active_source(self):
        def transfer(action,key,path,required=True):
            self.assertEqual(action,'get');Path(path).write_text('{"id":"active","label":"Agro_DEF","status":"processing","leaseExpiresAt":"9999"}');return True
        with tempfile.TemporaryDirectory() as root,patch.object(mod,'transfer',side_effect=transfer),patch.object(mod,'check_access') as access:
            mod.process('Agro_DEF','123',mode='both',work_root=root)
        access.assert_not_called()
    def test_missing_drive_identity_is_blocked_not_finished(self):
        job={'id':'test','label':'Agro_ABC','status':'pending'};states=[]
        def transfer(action,key,path,required=True):
            if action=='get':Path(path).write_text(json.dumps(job));return True
            states.append(json.loads(Path(path).read_text()));return True
        with tempfile.TemporaryDirectory() as root,patch.object(mod,'transfer',side_effect=transfer),patch.object(mod,'verify'),patch.object(mod,'check_access',side_effect=mod.DownloadError('drive_credentials_missing')),patch.object(mod,'download') as download,patch.object(mod,'analyze') as analyze:
            with self.assertRaises(SystemExit):mod.process('Agro_ABC','123',work_root=root)
        self.assertEqual(states[-1]['status'],'blocked');self.assertEqual(states[-1]['error'],'drive_credentials_missing');download.assert_not_called();analyze.assert_not_called()
    def test_no_pending_request_does_not_download(self):
        with tempfile.TemporaryDirectory() as root,patch.object(mod,'transfer',return_value=False),patch.object(mod,'check_access') as access:
            mod.process('Agro_DEF','123',work_root=root)
        access.assert_not_called()
    def test_success_only_marks_coverage_ready_after_private_publication(self):
        states=[];order=[]
        def transfer(action,key,path,required=True):
            if action=='get':Path(path).write_text('{"id":"test","label":"Agro_DEF","status":"pending"}');return True
            states.append(json.loads(Path(path).read_text()));return True
        def download(file_id,path,expected,require_auth):Path(path).write_bytes(b'II*\x00test');order.append('download')
        with tempfile.TemporaryDirectory() as root,patch.object(mod,'transfer',side_effect=transfer),patch.object(mod,'verify'),patch.object(mod,'check_access'),patch.object(mod.shutil,'disk_usage',return_value=type('Disk',(),{'free':100_000_000_000})()),patch.object(mod,'restore'),patch.object(mod,'checkpoint'),patch.object(mod,'download',side_effect=download),patch.object(mod,'analyze',side_effect=lambda *args:order.append('analyze')),patch.object(mod,'publish',side_effect=lambda *args:order.append('publish')):
            mod.process('Agro_DEF','123',work_root=root)
        self.assertEqual(order,['download','analyze','publish']);self.assertEqual(states[-1]['status'],'coverage_ready');self.assertEqual(states[-1]['plantCountStatus'],'pending_original_sample_validation');self.assertFalse(states[-1]['censusChanged'])

if __name__=='__main__':unittest.main()
