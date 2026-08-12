"""Resumable mangrove-priority pipeline foundation.

The initial version creates/validates progress state only. Analysis stages will
write one completed village at a time; existing completed IDs are never rerun
unless --force is explicitly supplied.
"""
import argparse, json
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'data'/'mangrove-priority-intervention.json'
PROGRESS=ROOT/'data'/'mangrove-priority-progress.json'

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--village')
    parser.add_argument('--force',action='store_true')
    args=parser.parse_args()
    source=json.loads(SOURCE.read_text(encoding='utf-8'))
    progress=json.loads(PROGRESS.read_text(encoding='utf-8')) if PROGRESS.exists() else {
        'schemaVersion':1,'status':'foundation','completed':{},'failed':{},'nextVillage':source['villages'][0]['id']}
    ids={v['id'] for v in source['villages']}
    if args.village and args.village not in ids: parser.error('unknown village id')
    progress['updatedAt']=datetime.now(timezone.utc).isoformat()
    progress['totalVillages']=len(ids)
    progress['completedCount']=len(progress['completed'])
    progress['safeToResume']=True
    PROGRESS.write_text(json.dumps(progress,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(progress,ensure_ascii=False))

if __name__=='__main__': main()
