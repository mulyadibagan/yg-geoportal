"""Build a sampled, reusable Riau imagery discovery grid, not survey footprints."""
import argparse, concurrent.futures, datetime, io, json, math, os, threading, time
import requests
from PIL import Image, ImageStat
from shapely.geometry import shape, box, mapping, Point
from shapely.ops import unary_union

SOURCE = 'https://petadasar.meritech.cloud/tile/{z}/{x}/{y}.jpg'
STEP = 0.18  # ~20 km near the equator; exact angular grid, clipped to Riau.
ZOOM = 17
_local = threading.local()

def tile(lon, lat):
    n = 2 ** ZOOM
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)

def classify_image(content):
    try:
        im = Image.open(io.BytesIO(content)).convert('RGBA')
        if im.size != (256, 256):
            return 'error'
        if im.getchannel('A').getextrema()[1] == 0:
            return 'blank'
        rgb = im.convert('RGB').resize((64, 64))
        # Uniform/near-uniform placeholders are not imagery hits.
        if max(ImageStat.Stat(rgb).stddev) < 2 or len(rgb.getcolors(4096) or []) < 16:
            return 'blank'
        return 'imagery'
    except Exception:
        return 'error'

def probe(lon, lat):
    x, y = tile(lon, lat)
    try:
        if not hasattr(_local, 'session'):
            _local.session = requests.Session()
        r = _local.session.get(SOURCE.format(z=ZOOM, x=x, y=y), timeout=(15, 45))
        if r.status_code == 404:
            state = 'missing'
        elif r.status_code == 200:
            state = classify_image(r.content)
        else:
            state = 'error'
    except requests.RequestException:
        state = 'error'
    return {'lon': round(lon, 7), 'lat': round(lat, 7), 'tile': [ZOOM, x, y], 'state': state}

def cells(boundary):
    west, south, east, north = boundary.bounds
    for ix in range(math.floor(west / STEP), math.ceil(east / STEP)):
        for iy in range(math.floor(south / STEP), math.ceil(north / STEP)):
            geom = boundary.intersection(box(ix * STEP, iy * STEP, (ix + 1) * STEP, (iy + 1) * STEP))
            if geom.is_empty or geom.area < 1e-9:
                continue
            candidates = [geom.representative_point()]
            for fx, fy in [(0.25,0.25),(0.75,0.25),(0.25,0.75),(0.75,0.75)]:
                p = Point((ix + fx)*STEP, (iy + fy)*STEP)
                if geom.covers(p):
                    candidates.append(p)
            # Include offshore/island components otherwise missed by mainland samples.
            for part in sorted(getattr(geom, 'geoms', [geom]), key=lambda p:p.area, reverse=True):
                if len(candidates) >= 9:
                    break
                p = part.representative_point()
                if all(p.distance(q) > 0.015 for q in candidates):
                    candidates.append(p)
            yield {'type':'Feature','geometry':mapping(geom.simplify(0.0003, preserve_topology=True)),
                   'properties':{'id':f'R{ix}-{iy}','state':'pending','samples':[]},
                   '_points':[(p.x,p.y) for p in candidates]}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--boundary', default='data/batas_provinsi_riau_dissolve.geojson')
    ap.add_argument('--output', default='data/meritech-riau-index.json')
    ap.add_argument('--workers',type=int,default=8)
    args = ap.parse_args()
    raw = json.load(open(args.boundary))
    boundary = unary_union([shape(f['geometry']) for f in raw['features']])
    rows = list(cells(boundary))
    old = {}
    if os.path.exists(args.output):
        old = {f['properties']['id']:f for f in json.load(open(args.output))['features']}
    for row in rows:
        prev=old.get(row['properties']['id'])
        if prev and prev['properties']['state'] not in ('pending','error'):
            row['properties']=prev['properties']
    def save():
        counts = {k:sum(f['properties']['state']==k for f in rows) for k in ['imagery','not_detected','error','pending']}
        result={'type':'FeatureCollection','metadata':{'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'source':SOURCE,'boundary':'data/batas_provinsi_riau_dissolve.geojson','gridDegrees':STEP,'sampleZoom':ZOOM,
            'method':'Up to 9 sample tiles per approximately 20 km cell; stop after first nonblank image. Not an exhaustive coverage survey.',
            'counts':counts,'total':len(rows)},'features':[{k:v for k,v in r.items() if not k.startswith('_')} for r in rows]}
        with open(args.output+'.tmp','w') as f:json.dump(result,f,separators=(',',':'))
        os.replace(args.output+'.tmp',args.output)
        print(counts,flush=True)
    def examine(row):
        p=row['properties'];p['samples']=[]
        for lon,lat in row['_points']:
            result=probe(lon,lat);p['samples'].append(result)
            if result['state']=='imagery':
                p.update(state='imagery',target=[result['lat'],result['lon']]);return
        p['state']='error' if any(s['state']=='error' for s in p['samples']) else 'not_detected'
    save()
    pending=[r for r in rows if r['properties']['state'] in ('pending','error')]
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(args.workers,24))) as pool:
        futures=[pool.submit(examine,r) for r in pending]
        for n,f in enumerate(concurrent.futures.as_completed(futures),1):
            f.result()
            if n%10==0:save()
    save()

if __name__=='__main__':main()
