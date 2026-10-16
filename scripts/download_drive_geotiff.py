"""Download a large existing GeoTIFF without changing Drive permissions or census.

DRIVE_CREDENTIALS_JSON accepts service-account or authorized-user Google credentials.
The credential must already have read access to the selected file.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import time

class DownloadError(RuntimeError):
    def __init__(self, code):
        super().__init__(code)
        self.code = code

def authenticated_session():
    raw = os.environ.get('DRIVE_CREDENTIALS_JSON', '').strip()
    federated=os.environ.get('GOOGLE_APPLICATION_CREDENTIALS','').strip()
    if not raw and not federated:
        return None
    try:
        import google.auth
        from google.auth.transport.requests import AuthorizedSession
        scopes=['https://www.googleapis.com/auth/drive.readonly']
        if raw:
            info = json.loads(raw)
            if info.get('type') not in ('service_account', 'authorized_user'):
                raise ValueError('unsupported credential type')
            credentials, _ = google.auth.load_credentials_from_dict(info,scopes=scopes)
        else:
            # The runner's Google auth action creates this short-lived WIF file.
            # No exported service-account key is required or accepted from a job.
            credentials, _ = google.auth.load_credentials_from_file(federated,scopes=scopes)
        return AuthorizedSession(credentials)
    except Exception:
        raise DownloadError('drive_credentials_invalid') from None

def check_response(response):
    if response.status_code < 400:
        return
    reasons = []
    try:
        reasons = [e.get('reason') for e in response.json().get('error', {}).get('errors', [])]
    except (ValueError, AttributeError, TypeError):
        pass
    if response.status_code == 429 or any(r in ('downloadQuotaExceeded', 'rateLimitExceeded', 'userRateLimitExceeded') for r in reasons):
        raise DownloadError('drive_rate_limited')
    if any(r in ('accessNotConfigured','serviceDisabled') for r in reasons):
        raise DownloadError('drive_api_disabled')
    if 'insufficientPermissions' in reasons:
        raise DownloadError('drive_scope_insufficient')
    if response.status_code in (401, 403):
        raise DownloadError('drive_access_denied')
    if response.status_code == 404:
        raise DownloadError('drive_file_missing_or_not_shared')
    raise DownloadError('drive_http_error')

def check_access(file_id,expected,session=None):
    if not re.fullmatch(r'[A-Za-z0-9_-]+',file_id): raise DownloadError('drive_invalid_file_id')
    session=session or authenticated_session()
    if session is None: raise DownloadError('drive_credentials_missing')
    endpoint='https://www.googleapis.com/drive/v3/files/'+file_id
    try:
        response=session.get(endpoint,params={'supportsAllDrives':'true','fields':'id,size,md5Checksum,version,mimeType,capabilities(canDownload)'},timeout=30)
    except Exception:
        raise DownloadError('drive_authenticated_request_failed') from None
    check_response(response);meta=response.json()
    if not meta.get('capabilities',{}).get('canDownload',True): raise DownloadError('drive_download_disabled')
    if int(meta.get('size',0))!=expected: raise DownloadError('drive_source_size_changed')
    return meta

def validate_file(path, expected, md5=None):
    if path.stat().st_size != expected:
        raise DownloadError('drive_incomplete_download')
    digest = hashlib.md5()
    with path.open('rb') as f:
        if f.read(4) not in (b'II*\x00', b'MM\x00*', b'II+\x00', b'MM\x00+'):
            raise DownloadError('drive_not_geotiff')
        if md5:
            f.seek(0)
            for chunk in iter(lambda: f.read(8*1024*1024), b''):
                digest.update(chunk)
    if md5 and digest.hexdigest() != md5:
        raise DownloadError('drive_checksum_mismatch')

def download(file_id, target, expected, session=None, require_auth=False):
    if not re.fullmatch(r'[A-Za-z0-9_-]+', file_id):
        raise DownloadError('drive_invalid_file_id')
    target=Path(target); target.parent.mkdir(parents=True, exist_ok=True)
    partial=target.with_suffix(target.suffix+'.part')
    marker=target.with_suffix(target.suffix+'.part.json')
    if session is None:
        session=authenticated_session()
    if session is None and require_auth:
        raise DownloadError('drive_credentials_missing')
    if session is None:
        import requests
        # Diagnose sign-in before the public downloader obscures the HTTP error.
        with requests.get('https://drive.google.com/file/d/'+file_id+'/view', timeout=30, stream=True) as probe:
            check_response(probe)
            text=next(probe.iter_content(65536), b'').decode('utf-8', errors='ignore').lower()
            if 'accounts.google.com/servicelogin' in probe.url.lower() or ('<title>google drive: sign-in' in text):
                raise DownloadError('drive_authentication_required')
        import gdown
        try:
            result=gdown.download(id=file_id, output=str(partial), quiet=True, resume=True)
        except Exception:
            raise DownloadError('drive_public_download_unavailable') from None
        if not result:
            raise DownloadError('drive_public_download_unavailable')
        validate_file(partial, expected)
    else:
        endpoint='https://www.googleapis.com/drive/v3/files/'+file_id
        meta=check_access(file_id,expected,session)
        identity={k:meta.get(k) for k in ('id','size','version','md5Checksum')}
        try:
            previous=json.loads(marker.read_text()) if marker.exists() else None
        except (ValueError, OSError):
            previous=None
        if previous != identity and partial.exists():
            partial.unlink()
        marker.write_text(json.dumps(identity))
        if target.exists():
            try:
                validate_file(target, expected, meta.get('md5Checksum'))
                target.with_suffix(target.suffix+'.source.json').write_text(json.dumps(identity))
                marker.unlink(missing_ok=True)
                return target
            except DownloadError:
                pass
        for attempt in range(3):
            offset=partial.stat().st_size if partial.exists() else 0
            if offset == expected:
                break
            if offset > expected:
                raise DownloadError('drive_invalid_partial_size')
            headers={'Range':f'bytes={offset}-'} if offset else {}
            try:
                with session.get(endpoint, params={'alt':'media','supportsAllDrives':'true'}, headers=headers, stream=True, timeout=(30,120)) as response:
                    check_response(response)
                    if offset and response.status_code == 206:
                        content_range=re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)', response.headers.get('Content-Range', ''))
                        if not content_range or tuple(map(int,content_range.groups())) != (offset,expected-1,expected):
                            raise DownloadError('drive_invalid_content_range')
                    elif offset and response.status_code == 200:
                        offset=0  # Range ignored: replace, never append duplicate bytes.
                    elif response.status_code != 200:
                        raise DownloadError('drive_invalid_download_response')
                    with partial.open('ab' if offset else 'wb') as f:
                        for chunk in response.iter_content(8*1024*1024):
                            if chunk: f.write(chunk)
                if partial.stat().st_size == expected:
                    break
            except DownloadError:
                raise
            except Exception:
                if attempt == 2:
                    raise DownloadError('drive_network_error') from None
            time.sleep(attempt+1)
        validate_file(partial, expected, meta.get('md5Checksum'))
        target.with_suffix(target.suffix+'.source.json').write_text(json.dumps(identity))
    partial.replace(target)
    marker.unlink(missing_ok=True)
    return target

def main():
    p=argparse.ArgumentParser(); p.add_argument('file_id'); p.add_argument('target')
    p.add_argument('--expected-bytes', type=int, required=True); p.add_argument('--status', required=True)
    p.add_argument('--require-auth', action='store_true')
    p.add_argument('--check-access',action='store_true',help='Verify authenticated metadata access without downloading imagery')
    a=p.parse_args(); status=Path(a.status); status.parent.mkdir(parents=True, exist_ok=True)
    try:
        if a.check_access:
            check_access(a.file_id,a.expected_bytes)
            result={'ok':True,'stage':'access_verified','bytes':a.expected_bytes}
        else:
            download(a.file_id,a.target,a.expected_bytes,require_auth=a.require_auth)
            result={'ok':True,'stage':'downloaded','bytes':a.expected_bytes}
    except DownloadError as e:
        result={'ok':False,'stage':'download_failed','error':e.code}
    except Exception:
        result={'ok':False,'stage':'download_failed','error':'drive_unexpected_error'}
    status.write_text(json.dumps(result,indent=2))
    print(json.dumps(result), flush=True)
    return 0 if result['ok'] else 1

if __name__ == '__main__':
    raise SystemExit(main())
