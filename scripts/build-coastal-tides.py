"""Archive Open-Meteo modelled sea levels; no interpolation of missing hours."""
import subprocess,calendar,time,json,re,urllib.request,urllib.parse,datetime,math,pathlib,concurrent.futures
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=(ROOT/'js/coastal-monitoring.js').read_text()
locations=[dict(id=m[0],name=m[1],regency=m[2],lat=float(m[3]),lon=float(m[4])) for m in re.findall(r"id:'([^']+)',name:'([^']+)',regency:'([^']+)',lat:([\d.]+),lon:([\d.]+)",s)]
from zoneinfo import ZoneInfo
TODAY=datetime.datetime.now(ZoneInfo('Asia/Jakarta')).date()
END_DAY=TODAY-datetime.timedelta(days=1)
def rolling_start(end):
 try: prior=end.replace(year=end.year-1)
 except ValueError: prior=end.replace(year=end.year-1,day=28)
 return prior+datetime.timedelta(days=1)

def distance(a,b,c,d):
 p,q=map(math.radians,[a,c]);return 6371*2*math.asin(math.sqrt(math.sin((q-p)/2)**2+math.cos(p)*math.cos(q)*math.sin(math.radians(d-b)/2)**2))
def fetch(url):
 result=subprocess.run(['curl','--fail','--silent','--show-error','--max-time','90','--retry','3','--retry-delay','5',url],capture_output=True,text=True,check=True)
 return json.loads(result.stdout)
def build(loc,START,END,path):
 print('Retrieving',loc['id'],START,END,flush=True)
 params=dict(latitude=loc['lat'],longitude=loc['lon'],hourly='sea_level_height_msl',start_date=START,end_date=END,timezone='Asia/Jakarta',cell_selection='sea')
 url='https://marine-api.open-meteo.com/v1/marine?'+urllib.parse.urlencode(params)
 data=fetch(url)
 fallback=False
 if loc['id']=='tanjung-kuras' and not any(isinstance(v,(int,float)) for v in data['hourly']['sea_level_height_msl']):
  params.update(latitude=1.36,longitude=102.18)
  url='https://marine-api.open-meteo.com/v1/marine?'+urllib.parse.urlencode(params)
  data=fetch(url)
  fallback=True
 h=data['hourly'];times=h['time'];values=h['sea_level_height_msl'];expected=(datetime.date.fromisoformat(END)-datetime.date.fromisoformat(START)).days*24+24
 assert len(times)==expected and len(values)==expected
 assert times==[(datetime.datetime.fromisoformat(START)+datetime.timedelta(hours=i)).isoformat(timespec='minutes') for i in range(expected)]
 assert times[0]==START+'T00:00' and times[-1]==END+'T23:00'
 values=[v if isinstance(v,(int,float)) and math.isfinite(v) else None for v in values]
 days=[];months=[]
 for i in range(0,len(times),24):
  v=values[i:i+24];valid=[x for x in v if x is not None];complete=len(valid)==24
  days.append(dict(date=times[i][:10],hours=len(valid),min=min(valid) if complete else None,max=max(valid) if complete else None,mean=round(sum(valid)/24,4) if complete else None))
 for month in sorted(set(t[:7] for t in times)):
  ix=[i for i,t in enumerate(times) if t.startswith(month)];valid=[i for i in ix if values[i] is not None];ds=[d for d in days if d['date'].startswith(month) and d['hours']==24]
  hi=max(valid,key=lambda i:values[i]) if valid else None;lo=min(valid,key=lambda i:values[i]) if valid else None
  months.append(dict(month=month,calendarComplete=len(ix)==calendar.monthrange(int(month[:4]),int(month[5:]))[1]*24,hours=len(valid),expectedHours=len(ix),completeDays=len(ds),max=values[hi] if hi is not None else None,maxTime=times[hi] if hi is not None else None,min=values[lo] if lo is not None else None,minTime=times[lo] if lo is not None else None,mean=round(sum(values[i] for i in valid)/len(valid),4) if valid else None,meanDailyRange=round(sum(d['max']-d['min'] for d in ds)/len(ds),4) if ds else None))
 valid=[i for i,v in enumerate(values) if v is not None];hi=max(valid,key=lambda i:values[i]) if valid else None;lo=min(valid,key=lambda i:values[i]) if valid else None
 result=dict(schemaVersion=1,regionalFallback=fallback,location=loc,startDate=START,endDate=END,timezone='Asia/Jakarta',source='Open-Meteo Marine / MeteoFrance SMOC',sourceUrl=url,sourceDocs='https://open-meteo.com/en/docs/marine-weather-api',dataKind='Arsip model muka laut termasuk pasang surut; bukan pengukuran lapangan',datum='Global mean sea level (MSL)',retrievedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),grid=dict(lat=data['latitude'],lon=data['longitude'],distanceKm=round(distance(loc['lat'],loc['lon'],data['latitude'],data['longitude']),2)),summary=dict(validHours=len(valid),expectedHours=len(times),completeDays=sum(d['hours']==24 for d in days),max=values[hi] if hi is not None else None,maxTime=times[hi] if hi is not None else None,min=values[lo] if lo is not None else None,minTime=times[lo] if lo is not None else None),hourly=dict(start=times[0],stepHours=1,values=values),daily=days,monthly=months)
 assert valid, 'No usable sea-level data: '+loc['id']
 if path.exists():
  old=json.loads(path.read_text()); old_start=datetime.datetime.fromisoformat(old['hourly']['start']); new_start=datetime.datetime.fromisoformat(result['hourly']['start'])
  offset=int((old_start-new_start).total_seconds()/3600)
  for i,v in enumerate(old['hourly']['values']):
   j=i+offset
   if v is not None and 0<=j<len(values): assert values[j] is not None, 'Coverage regression: '+str(path)
 return path,result
def main():
 jobs=[]; root=ROOT/'data/coastal-tides'
 for loc in locations:
  for year in range(2025,END_DAY.year+1):
   start=datetime.date(year,1,1); end=min(datetime.date(year,12,31),END_DAY)
   path=root/str(year)/(loc['id']+'.json')
   if path.exists() and end.year<TODAY.year:
    old=json.loads(path.read_text())
    if old['endDate']==end.isoformat() and old['summary']['validHours']==old['summary']['expectedHours']: continue
   jobs.append((loc,start.isoformat(),end.isoformat(),path))
  jobs.append((loc,rolling_start(END_DAY).isoformat(),END_DAY.isoformat(),root/(loc['id']+'.json')))
 # Stage all results before writing: a failed source leaves the published archive intact.
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  results=list(pool.map(lambda args:build(*args),jobs))
 for path,data in results:
  path.parent.mkdir(parents=True,exist_ok=True)
  path.write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False)+'\n')
  print(path.relative_to(ROOT),data['summary']['validHours'],flush=True)
 manifest=dict(updatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),throughDate=END_DAY.isoformat(),years=list(range(2025,END_DAY.year+1)))
 (root/'index.json').write_text(json.dumps(manifest)+'\n')
if __name__=='__main__': main()
