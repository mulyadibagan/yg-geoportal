"""Process staff Drive-link requests with the existing downloader/inspector/R2 engine."""
import argparse
from datetime import datetime,timezone,timedelta
import json
from pathlib import Path
import shutil
import tempfile
import uuid

from dayun_private_storage import PREFIX,transfer,restore,checkpoint,publish
from download_drive_geotiff import check_access,download,DownloadError
from inspect_dayun_geotiff import analyze
from verify_dayun_r2_privacy import verify

SOURCES={'Agro_ABC':('11kWmzkdTWVuxrDJMOYk3JfN34xeoZNRx',13677790714),
         'Agro_DEF':('14d-Hui0iwSvHQtCbZJa3InBOlQ3OdGNo',3432485808)}

def process(label,run,mode='queued',work_root='.dayun-analysis-work'):
    if label not in SOURCES:raise ValueError('invalid_source')
    if mode not in ('queued','both',label):return
    root=Path(work_root);root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=label+'-',dir=root) as temp:
        work=Path(temp);record=work/'request.json';key=f'{PREFIX}/requests/{label}.json'
        found=transfer('get',key,record,required=False)
        job=json.loads(record.read_text()) if found else None
        expired=job and job.get('status')=='processing' and job.get('leaseExpiresAt','9999')<datetime.now(timezone.utc).isoformat()
        if job and job.get('status')=='processing' and not expired:return
        if mode=='queued' and (not job or (job.get('status')!='pending' and not expired)):return
        if mode!='queued' and (not job or job.get('status') not in ('pending','processing')):
            job={'id':str(uuid.uuid4()),'label':label,'status':'pending','createdAt':datetime.now(timezone.utc).isoformat()}
        file_id,expected=SOURCES[label]
        # Never use untrusted request fields as file paths, shell commands or URLs.
        source=work/'source.tif';out=work/'result';out.mkdir()
        def status(state,stage,**fields):
            job.update(status=state,stage=stage,updatedAt=datetime.now(timezone.utc).isoformat(),**fields)
            record.write_text(json.dumps(job));transfer('put',key,record)
        job.pop('error',None)
        try:
            verify()
            status('processing','verifying_access',leaseExpiresAt=(datetime.now(timezone.utc)+timedelta(minutes=190)).isoformat(),censusChanged=False,plantCountStatus='not_tested')
            check_access(file_id,expected)
            if shutil.disk_usage(work).free<expected+6_000_000_000:raise DownloadError('insufficient_runner_disk')
            status('processing','restoring_source')
            restore(label,source)
            status('processing','downloading')
            try:
                download(file_id,source,expected,require_auth=True)
            except DownloadError as error:
                if error.code not in ('drive_checksum_mismatch','drive_not_geotiff'):
                    checkpoint(label,source)
                raise
            (out/'download-status.json').write_text(json.dumps({'ok':True,'stage':'downloaded','bytes':expected}))
            status('processing','checkpointing')
            checkpoint(label,source)
            status('processing','cropping_and_measuring_coverage')
            analyze(source,label,out,'data/dayun-map.geojson')
            status('processing','saving_private_results')
            publish(label,out,run+'-'+job['id'])
            status('coverage_ready','coverage_ready',resultRun=run+'-'+job['id'],plantCountStatus='pending_original_sample_validation')
        except Exception as error:
            code=error.code if isinstance(error,DownloadError) else (str(error) if isinstance(error,RuntimeError) and str(error).startswith(('private_storage_','r2_')) else 'analysis_processing_failed')
            state='blocked' if code in ('drive_credentials_missing','drive_credentials_invalid','drive_authenticated_request_failed','drive_access_denied','drive_file_missing_or_not_shared','drive_scope_insufficient','drive_api_disabled','drive_download_disabled') else 'failed'
            (out/'download-status.json').write_text(json.dumps({'ok':source.exists(),'stage':'downloaded' if source.exists() else 'download_failed','error':code}))
            # Failure updates the request; it must not replace an older complete
            # result manifest with partial or unsuccessful analysis files.
            status(state,'blocked' if state=='blocked' else 'failed',error=code)
            raise SystemExit(code) from None

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--label',choices=SOURCES,required=True);p.add_argument('--run',required=True);p.add_argument('--mode',choices=['queued','both',*SOURCES],default='queued')
    args=p.parse_args();process(args.label,args.run,args.mode)
