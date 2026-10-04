"""Archive Open-Meteo modelled sea levels; no interpolation of missing hours."""
import json,re,urllib.request,urllib.parse,datetime,math,pathlib,concurrent.futures
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=(ROOT/'js/coastal-monitoring.js').read_text()
locations=[dict(id=m[0],name=m[1],regency=m[2],lat=float(m[3]),lon=float(m[4])) for m in re.findall(r"id:'([^']+)',name:'([^']+)',regency:'([^']+)',lat:([\d.]+),lon:([\d.]+)",s)]
START='2025-10-01'; END='2026-09-30'
def distance(a,b,c,d):
 p,q=map(math.radians,[a,c]);return 6371*2*math.asin(math.sqrt(math.sin((q-p)/2)**2+math.cos(p)*math.cos(q)*math.sin(math.radians(d-b)/2)**2))
def build(loc):
 params=dict(latitude=loc['lat'],longitude=loc['lon'],hourly='sea_level_height_msl',start_date=START,end_date=END,timezone='Asia/Jakarta',cell_selection='sea')
 url='https://marine-api.open-meteo.com/v1/marine?'+urllib.parse.urlencode(params)
 with urllib.request.urlopen(url,timeout=90) as r: data=json.load(r)
 fallback=False
 if loc['id']=='tanjung-kuras' and not any(isinstance(v,(int,float)) for v in data['hourly']['sea_level_height_msl']):
  params.update(latitude=1.36,longitude=102.18)
  url='https://marine-api.open-meteo.com/v1/marine?'+urllib.parse.urlencode(params)
  with urllib.request.urlopen(url,timeout=90) as r: data=json.load(r)
  fallback=True
 h=data['hourly'];times=h['time'];values=h['sea_level_height_msl'];assert len(times)==8760 and len(values)==8760
 assert times[0]==START+'T00:00' and times[-1]==END+'T23:00'
 values=[v if isinstance(v,(int,float)) and math.isfinite(v) else None for v in values]
 days=[];months=[]
 for i in range(0,len(times),24):
  v=values[i:i+24];valid=[x for x in v if x is not None];complete=len(valid)==24
  days.append(dict(date=times[i][:10],hours=len(valid),min=min(valid) if complete else None,max=max(valid) if complete else None,mean=round(sum(valid)/24,4) if complete else None))
 for month in sorted(set(t[:7] for t in times)):
  ix=[i for i,t in enumerate(times) if t.startswith(month)];valid=[i for i in ix if values[i] is not None];ds=[d for d in days if d['date'].startswith(month) and d['hours']==24]
  hi=max(valid,key=lambda i:values[i]) if valid else None;lo=min(valid,key=lambda i:values[i]) if valid else None
  months.append(dict(month=month,hours=len(valid),expectedHours=len(ix),completeDays=len(ds),max=values[hi] if hi is not None else None,maxTime=times[hi] if hi is not None else None,min=values[lo] if lo is not None else None,minTime=times[lo] if lo is not None else None,mean=round(sum(values[i] for i in valid)/len(valid),4) if valid else None,meanDailyRange=round(sum(d['max']-d['min'] for d in ds)/len(ds),4) if ds else None))
 valid=[i for i,v in enumerate(values) if v is not None];hi=max(valid,key=lambda i:values[i]) if valid else None;lo=min(valid,key=lambda i:values[i]) if valid else None
 result=dict(schemaVersion=1,regionalFallback=fallback,location=loc,startDate=START,endDate=END,timezone='Asia/Jakarta',source='Open-Meteo Marine / MeteoFrance SMOC',sourceUrl=url,sourceDocs='https://open-meteo.com/en/docs/marine-weather-api',dataKind='Arsip model muka laut termasuk pasang surut; bukan pengukuran lapangan',datum='Global mean sea level (MSL)',retrievedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),grid=dict(lat=data['latitude'],lon=data['longitude'],distanceKm=round(distance(loc['lat'],loc['lon'],data['latitude'],data['longitude']),2)),summary=dict(validHours=len(valid),expectedHours=len(times),completeDays=sum(d['hours']==24 for d in days),max=values[hi] if hi is not None else None,maxTime=times[hi] if hi is not None else None,min=values[lo] if lo is not None else None,minTime=times[lo] if lo is not None else None),hourly=dict(start=times[0],stepHours=1,values=values),daily=days,monthly=months)
 (ROOT/'data/coastal-tides'/f"{loc['id']}.json").write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False)+'\n')
 return dict(id=loc['id'],name=loc['name'],summary=result['summary'],grid=result['grid'])
import sys
if len(sys.argv)>1: locations=[l for l in locations if l['id']==sys.argv[1]]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for result in pool.map(build,locations): print(json.dumps(result),flush=True)
