"""Recount existing private Dayun sources on revised polygons, never census data.

Uses the existing native crop, radial detector, checkpoint and correction modules.
All inputs/outputs containing staff labels belong in the private working area.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import numpy as np
import rasterio
from rasterio.features import geometry_mask
from shapely.geometry import shape, box
from shapely.prepared import prep
from analyze_dayun_block import analyze
from count_dayun_block import count_block
from dayun_candidate_quality import scaled_radii
from dayun_checkpoint_reader import CheckpointReader
from dayun_geographic_metrics import area, pixel_area


SOURCES = {
    'Agro_ABC': ('ABC', '11kWmzkdTWVuxrDJMOYk3JfN34xeoZNRx', 13677790714, 'ed607f7c49d72c1d044e4cc36a07492b'),
    'Agro_DEF': ('DEF', '14d-Hui0iwSvHQtCbZJa3InBOlQ3OdGNo', 3432485808, '4ee6ef467b88f2ba5231aeee1ed7ee31'),
}


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')


def transfer_model(model, training_gsd, target_gsd, source_run, block):
    """Physical scale transfer is explicit and never presented as new validation."""
    result = copy.deepcopy(model)
    ratio = np.mean(training_gsd) / np.mean(target_gsd)
    result.update(training_source_run=model['source_run'], source_run=source_run,
                  source_model_signature=model['model_signature'], training_gsd_m=training_gsd,
                  target_gsd_m=target_gsd, radii_native_pixels=scaled_radii(model['radii_native_pixels'], training_gsd, target_gsd),
                  suppression_native_pixels=max(1, round(model['suppression_native_pixels'] * ratio)),
                  matching_tolerance_native_pixels=max(1, round(model.get('matching_tolerance_native_pixels', 12) * ratio)),
                  target_block=block, evaluated_on_target_block=False, historical_metrics_only=True)
    if block != 'A':
        result['transferred_from_block'] = 'A'
    result['limitations'] = list(model.get('limitations', [])) + [
        'Physical GSD transfer of the existing A seedling model; no measured precision or full-count recall on the revised target block.',
        'Frozen threshold and RGB exposure guard can miss other crown sizes or lighting; candidates require staff review.',
    ]
    result['model_signature'] = hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest()
    return result


def review_grid(analysis, candidates, source_grid):
    """Compact, lossless source-pixel lookup for private correction requests."""
    zone_ids = [z['id'] for z in analysis['zones']]
    indices = {key: i for i, key in enumerate(zone_ids)}
    points = []
    for feature in candidates['features']:
        p = feature['properties']; x, y = p['source_pixel']
        if p['id'] != f"{analysis['block']}-radial-x{x}-y{y}" or not p['zones']:
            raise ValueError('invalid_native_candidate_identity')
        points.append([x, y, [indices[key] for key in p['zones']]])
    return dict(schema='dayun-review-grid-v1', block=analysis['block'], source_run=analysis['source_run'],
                transform=source_grid['transform'], width=source_grid['width'], height=source_grid['height'],
                zones=zone_ids, points=points)


def measure_native_coverage(directory, zones):
    """Visit original-grid core masks once; polygon parts are already dissolved."""
    root = Path(directory)
    analysis = load(root / 'analysis.json')
    indexed = [(f['properties']['id'], shape(f['geometry'])) for f in zones['features']]
    prepared = [(key, geom, prep(geom)) for key, geom in indexed]
    counts = {key: dict(polygon_pixels=0, valid_pixels=0) for key, _ in indexed}
    for tile in analysis['native_tiles']:
        with rasterio.open(root / tile['file']) as ds:
            valid = ds.read(4) > 0
            extent = box(*ds.bounds)
            for key, geom, prepared_geom in prepared:
                if not prepared_geom.intersects(extent):
                    continue
                mask = geometry_mask([geom.__geo_interface__], valid.shape, ds.transform, invert=True)
                counts[key]['polygon_pixels'] += int(mask.sum())
                counts[key]['valid_pixels'] += int((mask & valid).sum())
    rows = []
    for key, geom in indexed:
        unit = pixel_area(geom.centroid.x, geom.centroid.y, *analysis['resolution_crs_units'])
        polygon_area = area(geom)
        row = dict(zone_id=key, **counts[key], polygon_area_ha=polygon_area / 10000,
                   valid_area_ha=counts[key]['valid_pixels'] * unit / 10000,
                   valid_coverage_percent=min(100, counts[key]['valid_pixels'] * unit / polygon_area * 100),
                   nodata_area_ha=(counts[key]['polygon_pixels'] - counts[key]['valid_pixels']) * unit / 10000)
        rows.append(row)
    return rows


def run(args):
    blocks, file_id, size, md5 = SOURCES[args.label]
    if args.block not in blocks:
        raise ValueError('block_source_mismatch')
    index = load(Path(args.cache) / 'checkpoint.json')
    identity = index['identity']
    if identity.get('id') != file_id or int(identity['size']) != size or identity.get('md5Checksum') != md5:
        raise ValueError('checkpoint_source_identity_mismatch')
    manifest, metadata, training_metadata = load(args.manifest), load(args.metadata), load(args.training_metadata)
    root = Path(args.output)
    root.mkdir(parents=True, exist_ok=True)
    config = root / 'native-config.json'
    write(config, dict(source_run=manifest['run'], samples=[], templates=[]))
    native = root / 'assets'
    analyze('checkpoint', config, native, args.map, args.block, cache=args.cache,
            prepare_only=True, source_label=args.label, checkpoint_index=index)
    analysis = load(native / 'analysis.json')
    analysis.update(resolution_crs_units=metadata['resolution_crs_units'], source_label=args.label)
    write(native / 'analysis.json', analysis)
    model = transfer_model(load(args.model), training_metadata['gsd_m'], metadata['gsd_m'], manifest['run'], args.block)
    review = load(args.review) if args.review and Path(args.review).exists() else None
    if review and review['review']['source_run'] != manifest['run']:
        raise ValueError('review_source_mismatch')
    changes = (review or {}).get('review', {}).get('changes', [])
    positive = [f for f in changes if f['properties'].get('origin') == 'manual_addition' and f['properties']['status'] == 'accepted']
    rejected = [f['geometry']['coordinates'] for f in changes if f['properties']['status'] == 'rejected']
    write(root / 'frozen-model.json', model)
    reader = CheckpointReader(args.label, args.cache, index)
    with rasterio.Env(GDAL_CACHEMAX=256*1024*1024), rasterio.open('source.tif', opener=reader.opener) as ds:
        if ds.crs.to_string() != metadata['crs'] or list(ds.res) != metadata['resolution_crs_units']:
            raise ValueError('source_metadata_grid_mismatch')
        counted = count_block(native, root / 'count', ds, source_identity=identity, calibration=model,
                              rejected=rejected, manual_points=positive, review_version=(review or {}).get('version'))
    coverage = measure_native_coverage(native, load(native / 'zones.geojson'))
    write(root / 'coverage.json', dict(block=args.block, source_run=manifest['run'], zones=coverage, census_changed=False))
    write(root / 'completed.json', dict(block=args.block, label=args.label, source_run=manifest['run'],
                                       candidate_count=counted['candidate_count'], native_tiles=len(counted['native_tiles']),
                                       boundary_revision=load(args.map)['boundaryRevision'], census_changed=False))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--label', choices=list(SOURCES), required=True)
    p.add_argument('--block', choices=list('ABCDEF'), required=True)
    for name in ['cache', 'manifest', 'metadata', 'training-metadata', 'model', 'output']:
        p.add_argument('--' + name, required=True)
    p.add_argument('--review')
    p.add_argument('--map', default='data/dayun-map.geojson')
    run(p.parse_args())
