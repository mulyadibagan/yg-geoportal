import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('drive_geotiff',Path(__file__).parents[1]/'scripts/download_drive_geotiff.py')
mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)

class Response:
    def __init__(self, data=None, body=b'', status=200, headers=None):
        self.data=data; self.body=body; self.status_code=status; self.headers=headers or {}
    def json(self): return self.data
    def __enter__(self): return self
    def __exit__(self,*args): pass
    def iter_content(self,*args): yield self.body

class Session:
    def __init__(self,responses): self.responses=iter(responses); self.calls=[]
    def get(self,*args,**kwargs): self.calls.append(kwargs); return next(self.responses)

class DriveGeoTIFFTests(unittest.TestCase):
    body=b'II*\x00'+b'example-raster-bytes'
    def metadata(self):
        return dict(id='example',size=str(len(self.body)),version='1',md5Checksum=hashlib.md5(self.body).hexdigest())
    def test_private_mode_never_falls_back_to_public_download(self):
        with tempfile.TemporaryDirectory() as root, patch.object(mod,'authenticated_session',return_value=None):
            with self.assertRaisesRegex(mod.DownloadError,'drive_credentials_missing'):
                mod.download('example',Path(root)/'source',len(self.body),require_auth=True)
    def test_wrong_range_total_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'source.tif'; path.with_suffix('.tif.part').write_bytes(self.body[:8])
            path.with_suffix('.tif.part.json').write_text(json.dumps(self.metadata()))
            session=Session([Response(self.metadata()),Response(body=self.body[8:],status=206,headers={'Content-Range':'bytes 8-22/999'})])
            with self.assertRaisesRegex(mod.DownloadError,'drive_invalid_content_range'):
                mod.download('example',path,len(self.body),session)
            self.assertEqual(path.with_suffix('.tif.part').read_bytes(),self.body[:8])
    def test_full_download_verified(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'source.tif'
            session=Session([Response(self.metadata()),Response(body=self.body)])
            mod.download('example',path,len(self.body),session)
            self.assertEqual(path.read_bytes(),self.body)
            self.assertFalse(path.with_suffix('.tif.part').exists())
    def test_ignored_range_restarts_instead_of_appending(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'source.tif'; path.with_suffix('.tif.part').write_bytes(self.body[:8])
            path.with_suffix('.tif.part.json').write_text(json.dumps(self.metadata()))
            session=Session([Response(self.metadata()),Response(body=self.body,status=200)])
            mod.download('example',path,len(self.body),session)
            self.assertEqual(session.calls[1]['headers'],{'Range':'bytes=8-'})
            self.assertEqual(path.read_bytes(),self.body)
    def test_resume_with_valid_content_range(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'source.tif'; path.with_suffix('.tif.part').write_bytes(self.body[:8])
            path.with_suffix('.tif.part.json').write_text(json.dumps(self.metadata()))
            session=Session([Response(self.metadata()),Response(body=self.body[8:],status=206,headers={'Content-Range':f'bytes 8-{len(self.body)-1}/{len(self.body)}'})])
            mod.download('example',path,len(self.body),session)
            self.assertEqual(path.read_bytes(),self.body)
    def test_checksum_failure_preserves_existing_target(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'source.tif'; path.write_bytes(b'existing')
            session=Session([Response(self.metadata()),Response(body=self.body[:-1]+b'!')])
            with self.assertRaisesRegex(mod.DownloadError,'drive_checksum_mismatch'):
                mod.download('example',path,len(self.body),session)
            self.assertEqual(path.read_bytes(),b'existing')
    def test_html_is_never_accepted_as_raster(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'source'; path.write_bytes(b'<html>login</html>')
            with self.assertRaisesRegex(mod.DownloadError,'drive_not_geotiff'):
                mod.validate_file(path,path.stat().st_size)
    def test_access_and_quota_are_distinct(self):
        for response,code in [(Response(status=401),'drive_access_denied'),(Response(status=404),'drive_file_missing_or_not_shared'),(Response(data={'error':{'errors':[{'reason':'downloadQuotaExceeded'}]}},status=403),'drive_rate_limited')]:
            with self.subTest(code=code),self.assertRaisesRegex(mod.DownloadError,code):
                mod.check_response(response)

if __name__=='__main__': unittest.main()
