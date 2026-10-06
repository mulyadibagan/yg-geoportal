"""Verify source XYZ tiles around known hits; never paint the coarse discovery cells."""
import argparse, concurrent.futures, datetime, importlib.util, json, math, os
from pathlib import Path
from shapely.geometry import shape, box
from shapely.ops import unary_union

spec=importlib.util.spec_from_file_location('scanner',Path(__file__).with_name('build-meritech-index.py'))
scanner=importlib.util.module_from_spec(spec);spec.loader.exec_module(scanner)

def bounds(z,x,y):
    n=2**z
    lat=lambda t:math.degrees(math.atan(math.sinh(math.pi*(1-2*t/n))))
    return [x/n*360-180,lat(y+1),(x+1)/n*360-180,lat(y)]

def center(z,x,y):
    n=2**z
    return ((x+.5)/n*360-180,math.degrees(math.atan(math.sinh(math.pi*(1-2*(y+.5)/n)))))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--seed',default='data/meritech-riau-index.json')
    ap.add_argument('--output',default='data/meritech-riau-tiles.json')
    ap.add_argument('--workers',type=int,default=8)
    ap.add_argument('--radius',type=int,default=2)
    a=ap.parse_args()
    seeds=json.load(open(a.seed))
    boundary=unary_union([shape(f['geometry']) for f in json.load(open('data/batas_provinsi_riau_dissolve.geojson'))['features']])
    jobs={};locations={}
    for f in seeds['features']:
        p=f['properties']
        if p['state']!='imagery':continue
        sample=next(s for s in p['samples'] if s['state']=='imagery')
        z,x,y=sample['tile'];locations[p['id']]={'id':p['id'],'target':p['target']}
        for dx in range(-a.radius,a.radius+1):
            for dy in range(-a.radius,a.radius+1):
                xx,yy=x+dx,y+dy
                if not boundary.intersects(box(*bounds(z,xx,yy))):continue
                jobs.setdefault(f'{z}/{xx}/{yy}',{'tile':[z,xx,yy],'locationId':p['id']})
    results={}
    checkpoint=a.output+'.checkpoint.json'
    if os.path.exists(checkpoint):results={k:v for k,v in json.load(open(checkpoint)).items() if k in jobs}
    def probe(item):
        key,row=item;lon,lat=center(*row['tile']);return key,{**row,**scanner.probe(lon,lat)}
    pending=[(k,v) for k,v in jobs.items() if k not in results or results[k]['state']=='error']
    def save():
        with open(checkpoint+'.tmp','w') as f:json.dump(results,f)
        os.replace(checkpoint+'.tmp',checkpoint)
        counts={k:sum(r['state']==k for r in results.values()) for k in ['imagery','blank','missing','error']}
        print({'checked':len(results),'total':len(jobs),**counts},flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(a.workers,24))) as pool:
        for n,f in enumerate(concurrent.futures.as_completed([pool.submit(probe,j) for j in pending]),1):
            key,row=f.result();results[key]=row
            if n%40==0:save()
    save()
    features=[];groups={}
    for key,r in sorted(results.items()):
        if key not in jobs or r['state']!='imagery':continue
        z,x,y=r['tile'];w,s,e,n=bounds(z,x,y)
        target=[r['lat'],r['lon']]
        features.append({'type':'Feature','geometry':{'type':'Polygon','coordinates':[[[w,s],[e,s],[e,n],[w,n],[w,s]]]},
                         'properties':{'id':key,'state':'imagery','locationId':r['locationId'],'target':target}})
        groups.setdefault(r['locationId'],[]).append(target)
    markers=[]
    for key,points in groups.items():
        expected=locations[key]['target']
        target=min(points,key=lambda p:(p[0]-expected[0])**2+(p[1]-expected[1])**2)
        markers.append({'id':key,'target':target,'tileCount':len(points)})
    data={'type':'FeatureCollection','metadata':{'kind':'verified-xyz-tiles','updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'source':scanner.SOURCE,'zoom':17,'tileWidthApproxM':306,'seedLocations':len(locations),'locations':markers,
          'counts':{'checked':len(results),'total':len(jobs),**{k:sum(r['state']==k for r in results.values()) for k in ['imagery','blank','missing','error']}},
          'radius':a.radius,'method':'Check a square neighbourhood around each known imagery seed. Polygon is the exact XYZ tile extent with nonblank imagery, not an official survey footprint. Coverage outside the checked neighbourhoods is not assessed.'},'features':features}
    with open(a.output,'w') as f:json.dump(data,f,separators=(',',':'))
    print('Saved',len(features),'verified tile extents and',len(markers),'locators.',flush=True)

if __name__=='__main__':main()
