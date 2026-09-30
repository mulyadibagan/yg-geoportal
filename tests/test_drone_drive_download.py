import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('downloader', Path(__file__).parents[1] / 'scripts/download_drive_folder.py')
downloader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(downloader)


class DriveDownloadTests(unittest.TestCase):
    def run_manifest_failure(self, outcome, expected_error):
        with tempfile.TemporaryDirectory() as root:
            output = Path(root) / 'photos'
            output.mkdir()
            cached = output / 'cached.jpg'
            cached.write_bytes(b'existing-photo')
            summary = Path(root) / 'summary.json'
            def manifest(*args, **kwargs):
                self.assertEqual(json.loads(summary.read_text())['state'], 'listing')
                if isinstance(outcome, Exception):
                    raise outcome
                return outcome
            argv = ['download', 'https://drive.google.com/drive/folders/example', str(output), str(summary)]
            with patch.object(sys, 'argv', argv), patch.object(downloader, 'run', side_effect=manifest):
                self.assertEqual(downloader.main(), 43)
            state = json.loads(summary.read_text())
            self.assertEqual(state['error'], expected_error)
            self.assertEqual(state['state'], 'failed')
            self.assertEqual(state['downloadedPhotos'], 1)
            self.assertEqual(cached.read_bytes(), b'existing-photo')

    def test_observed_401_preserves_error_and_existing_photos(self):
        self.run_manifest_failure(subprocess.CompletedProcess([], 1, '', 'warning: --json is in beta\nFailed to retrieve folder contents (status code 401).'), 'drive_access_denied')

    def test_timeout_always_writes_summary(self):
        self.run_manifest_failure(subprocess.TimeoutExpired('gdown', 120), 'drive_manifest_failed')

    def test_quota_is_distinct_from_permissions(self):
        self.run_manifest_failure(subprocess.CompletedProcess([], 1, '', 'HTTP 429 too many requests'), 'drive_rate_limited')

    def test_invalid_manifest_is_not_mistaken_for_empty_folder(self):
        self.run_manifest_failure(subprocess.CompletedProcess([], 0, '{"unexpected": []}', ''), 'drive_manifest_invalid')

    def test_insufficient_photos(self):
        self.run_manifest_failure(subprocess.CompletedProcess([], 0, '[{"path":"one.jpg"}]', ''), 'drive_insufficient_photos')

    def test_complete_cache_succeeds(self):
        with tempfile.TemporaryDirectory() as root:
            output = Path(root) / 'photos'
            output.mkdir()
            for name in ['a.jpg', 'b.JPG', 'c.jpeg']:
                (output / name).write_bytes(b'existing-photo')
            summary = Path(root) / 'summary.json'
            with patch.object(sys, 'argv', ['download', 'url', str(output), str(summary)]), patch.object(downloader, 'list_manifest', return_value=['a.jpg', 'b.JPG', 'c.jpeg']):
                self.assertEqual(downloader.main(), 0)
            self.assertTrue(json.loads(summary.read_text())['ok'])


if __name__ == '__main__':
    unittest.main()
