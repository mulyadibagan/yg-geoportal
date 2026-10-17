"""Native RGB diagnostics and stratified review samples, never a plant census.

Vegetation is a visible-colour proxy only. Low vegetation is a review location,
not a diagnosed row gap, dead plant, or missing pineapple.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.windows import Window, bounds
from shapely.geometry import shape, box, mapping
from shapely.ops import transform
from pyproj import Transformer
from PIL import Image, ImageDraw


def colour_masks(rgb):
    f = rgb.astype('float32')
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    total = np.maximum(r + g + b, 1)
    # Fixed RGB heuristic; deliberately does not identify species or plant health.
    vegetation = ((2 * g - r - b) / total > .08) & (g > r * 1.05) & (g > b * 1.05) & (g > 35)
    dark = np.max(rgb, axis=2) < 45
    return vegetation & ~dark, dark


def detail(directory, cell_pixels=256):
    root = Path(directory)
    result = json.loads((root / 'analysis.json').read_text())
    features = json.loads((root / 'zones.geojson').read_text())['features']
    project = Transformer.from_crs(4326, 32648, always_xy=True).transform
    zones = [(f['properties']['id'], shape(f['geometry'])) for f in features]
    sums = {key: dict(zone_id=key, polygon_area_m2=transform(project, geom).area,
                     valid_area_m2=0., vegetation_proxy_area_m2=0., dark_area_m2=0.,
                     rasterized_area_m2=0., cells=0, review_cells=0) for key, geom in zones}
    cells, choices = [], {key: [] for key, _ in zones}
    digests = []
    for n, tile in enumerate(result['native_tiles'], 1):
        path = root / tile['file']
        digests.append({'file': tile['file'], 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
        with rasterio.open(path) as ds:
            if ds.crs.to_epsg() != 4326 or ds.count < 4:
                raise ValueError('expected_georeferenced_native_rgb_alpha')
            rgb = np.moveaxis(ds.read([1, 2, 3]), 0, -1)
            valid = ds.read(4) > 0
            vegetation, dark = colour_masks(rgb)
            tile_box = box(*ds.bounds)
            pixel_area = transform(project, tile_box).area / (ds.width * ds.height)
            for key, geom in zones:
                if not geom.intersects(tile_box):
                    continue
                inside = geometry_mask([mapping(geom)], valid.shape, ds.transform, invert=True)
                usable = inside & valid
                s = sums[key]
                s['rasterized_area_m2'] += int(inside.sum()) * pixel_area
                s['valid_area_m2'] += int(usable.sum()) * pixel_area
                s['vegetation_proxy_area_m2'] += int((usable & vegetation).sum()) * pixel_area
                s['dark_area_m2'] += int((usable & dark).sum()) * pixel_area
                for y in range(0, ds.height, cell_pixels):
                    for x in range(0, ds.width, cell_pixels):
                        sl = np.s_[y:min(y + cell_pixels, ds.height), x:min(x + cell_pixels, ds.width)]
                        count = int(inside[sl].sum())
                        if count * pixel_area < 1:
                            continue
                        mask = usable[sl]
                        good = int(mask.sum())
                        coverage = good / count
                        veg = float((mask & vegetation[sl]).sum() / good) if good else None
                        shade = float((mask & dark[sl]).sum() / good) if good else None
                        flags = []
                        if coverage < .95:
                            flags.append('incomplete_image')
                        if shade is not None and shade > .25:
                            flags.append('dark_pixels_review')
                        if veg is not None and veg < .15 and shade < .25 and coverage >= .95:
                            flags.append('low_visible_vegetation_review')
                        win = Window(x, y, min(cell_pixels, ds.width-x), min(cell_pixels, ds.height-y))
                        cell = {'type': 'Feature', 'geometry': mapping(geom.intersection(box(*bounds(win, ds.transform)))),
                                'properties': {'id': f'{key}-{path.stem}-{x}-{y}', 'zone_id': key,
                                               'area_m2': round(count * pixel_area, 3), 'coverage_fraction': round(coverage, 4),
                                               'vegetation_proxy_fraction': None if veg is None else round(veg, 4),
                                               'dark_fraction': None if shade is None else round(shade, 4),
                                               'flags': flags, 'native_tile': tile['file'],
                                               'pixel_window': [int(win.col_off), int(win.row_off), int(win.width), int(win.height)],
                                               'pineapple_count': None}}
                        cells.append(cell)
                        s['cells'] += 1
                        s['review_cells'] += bool(flags)
                        if coverage >= .95 and good * pixel_area >= 2 and shade < .25:
                            choices[key].append(cell)
        print(f'Native diagnostics {n}/{len(result["native_tiles"])}', flush=True)
    samples = []
    (root / 'detail').mkdir(exist_ok=True)
    for key, options in choices.items():
        # Deterministic strata include low, median and high visible vegetation.
        # They are not a random accuracy sample and cannot estimate recall/precision.
        ordered = sorted(options, key=lambda c: (c['properties']['vegetation_proxy_fraction'], c['properties']['id']))
        chosen = []
        for label, idx in [('low', 0), ('median', len(ordered)//2), ('high', len(ordered)-1)]:
            if ordered and ordered[idx] not in [c for _, c in chosen]:
                chosen.append((label, ordered[idx]))
        sheet = Image.new('RGB', (3*512, 560), 'white')
        draw = ImageDraw.Draw(sheet)
        for index, (label, cell) in enumerate(chosen):
            p = cell['properties']
            with rasterio.open(root / p['native_tile']) as ds:
                x, y, w, h = p['pixel_window']
                cx, cy = x+w//2, y+h//2
                win = Window(max(0, min(ds.width-512, cx-256)), max(0, min(ds.height-512, cy-256)), min(512, ds.width), min(512, ds.height))
                rgb = np.moveaxis(ds.read([1, 2, 3], window=win), 0, -1)
                patch = Image.fromarray(rgb)
                sheet.paste(patch, (index*512, 48))
                draw.text((index*512+8, 8), f'{key} / {label} / vegetation proxy {p["vegetation_proxy_fraction"]:.1%}', fill='black')
                sample = {'zone_id': key, 'stratum': label, 'cell_id': p['id'], 'native_tile': p['native_tile'],
                          'pixel_window': [int(win.col_off), int(win.row_off), int(win.width), int(win.height)],
                          'bounds': list(bounds(win, ds.transform)), 'sheet': f'detail/{key}.jpg', 'species_validated': False}
                samples.append(sample)
        if chosen:
            sheet.save(root / 'detail' / f'{key}.jpg', quality=95)
    rows = []
    for key, geom in zones:
        s = sums[key]
        valid = s['valid_area_m2']
        s.update(coverage_fraction=s['valid_area_m2']/s['rasterized_area_m2'] if s['rasterized_area_m2'] else None,
                 vegetation_proxy_fraction=s['vegetation_proxy_area_m2']/valid if valid else None,
                 dark_fraction=s['dark_area_m2']/valid if valid else None,
                 pineapple_count_validated=None, row_gap_area_validated_m2=None, census_changed=False,
                 sample_sheet=f'detail/{key}.jpg' if choices[key] else None)
        rows.append({k: round(v, 4) if isinstance(v, float) else v for k, v in s.items()})
    output = {'schema': 'dayun-block-detail-v1', 'block': result['block'], 'source_run': result['source_run'],
              'capture_date': result.get('capture_date'), 'capture_date_status': result.get('capture_date_status'),
              'method': {'cell_pixels': cell_pixels, 'resolution': 'native', 'colour_proxy': 'ExG/brightness RGB heuristic, not species classification',
                         'vegetation_exg_threshold': .08, 'dark_max_rgb_threshold': 45,
                         'area_crs': 'EPSG:32648', 'area_method': 'projected native tile area divided by native pixel count; pixel-centre polygon masks',
                         'sampling': 'deterministic low/median/high visible vegetation per zone; not a representative accuracy validation sample'},
              'zones': rows, 'samples': samples, 'cell_count': len(cells), 'review_cell_count': sum(bool(c['properties']['flags']) for c in cells),
              'census_changed': False, 'limitations': [
                  'RGB vegetation proxy includes weeds, trees and pineapple. It cannot establish planted area or plant species.',
                  'Dark pixels can be shadows or dark soil; obscured plants cannot be counted reliably.',
                  'Low vegetation cells are review locations, not confirmed row gaps or dead pineapple.',
                  'Source active/dead polygons are categories, not an imagery health diagnosis. Overlap areas are reported per zone, not summed into a block total.',
                  'Count precision and recall, missing plants, row gaps and boundary displacement require independent review; no living count is produced.']}
    (root/'detail-analysis.json').write_text(json.dumps(output, ensure_ascii=False), encoding='utf-8')
    (root/'detail-cells.geojson').write_text(json.dumps({'type':'FeatureCollection','features':cells}), encoding='utf-8')
    with (root/'detail-gawangan.csv').open('w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
    (root/'detail-provenance.json').write_text(json.dumps({'source_run':result['source_run'], 'native_tiles':digests,
                                                        'zones_sha256':hashlib.sha256((root/'zones.geojson').read_bytes()).hexdigest(),
                                                        'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}))
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', required=True)
    args = parser.parse_args()
    output = detail(args.directory)
    print(json.dumps({k:output[k] for k in ['cell_count','review_cell_count','census_changed']}))
