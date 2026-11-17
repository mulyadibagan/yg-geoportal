import datetime as dt, json, pathlib, subprocess, tempfile
script=pathlib.Path(__file__).resolve().parents[1]/'scripts/recover_fire_monthly_archive.py'
with tempfile.TemporaryDirectory(dir=script.parents[1]) as directory:
 root=pathlib.Path(directory); data=root/'data'; data.mkdir()
 subprocess.run(['git','init','-q',str(root)],check=True)
 for lo,hi in [('2026-09-20','2026-10-19'),('2026-10-19','2026-11-17')]:
  (data/'hotspot-high-confidence.geojson').write_text(json.dumps(dict(sourceStatus='complete',coverageStart=lo,coverageEnd=hi,features=[],providers=['VIIRS'])))
  subprocess.run(['git','-C',str(root),'add','.'],check=True)
  import os
  env={**os.environ,'GIT_AUTHOR_DATE':hi+'T12:00:00Z','GIT_COMMITTER_DATE':hi+'T12:00:00Z'}
  subprocess.run(['git','-C',str(root),'-c','user.name=Test','-c','user.email=test@example.org','commit','-qm',hi],check=True,env=env)
 result=subprocess.run([__import__('sys').executable,str(script),'--month','2026-10','--output',str(root/'out.json')],cwd=root,capture_output=True,text=True)
 assert result.returncode==0,result.stderr+result.stdout
 output=json.loads((root/'out.json').read_text())
 assert output['coverageStart']=='2026-10-01' and output['coverageEnd']=='2026-10-31'
 assert len(output['provenance'])==2
 print('PASS: recover full 31-day October from complete rolling snapshots')
