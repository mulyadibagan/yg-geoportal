"""Private review priorities, NOT a validated fruit-stage detector or census.

Rank compact pale crown centres by native-pixel resemblance to one owner example.
Limit review workload per dissolved gawangan; never interpret that cap as abundance.
Inputs are existing original tiles, selected crown candidates, and pale-centre screen.
"""
import argparse
import csv
import hashlib
import json
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from dayun_negative_filter import NativePatches


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def native_crop(reader, row, half):
    sx, sy = row['source_pixel']
    tx, ty = map(int, re.search(r'x(\d+)_y(\d+)', row['native_tile']).groups())
    rgb, valid = reader.read(row['native_tile'])
    x, y = sx-tx, sy-ty
    if x < half or y < half or x+half+1 > rgb.shape[1] or y+half+1 > rgb.shape[0]:
        return None
    if not valid[y-half:y+half+1, x-half:x+half+1].all():
        return None
    return rgb[y-half:y+half+1, x-half:x+half+1]


def resemblance(rgb, template):
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype('float32')
    return max(float(cv2.matchTemplate(gray, np.ascontiguousarray(np.rot90(template,k)), cv2.TM_CCOEFF_NORMED).max()) for k in range(4))


def pale_centre(rgb):
    gray = cv2.GaussianBlur(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), (0,0), .65)
    sat = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)[20:45,20:45,1]
    cut = gray[20:45,20:45]
    mask = ((cut >= max(108,float(np.quantile(cut,.84)))) & (sat < 110)).astype('uint8')
    count, labels, stats, centres = cv2.connectedComponentsWithStats(mask,8)
    for i in range(1,count):
        _,_,w,h,area = stats[i]
        if 3 <= area <= 70 and np.hypot(*(centres[i]-12)) <= 8 and max(w,h) <= 15 and min(w,h)>1:
            return True
    return False


def shortlist(rows, zone_ids, limit=5):
    selected = {}
    for zone in sorted(set(zone_ids)):
        ranked = sorted((r for r in rows if zone in r['zones']), key=lambda r: (-r['similarity'], r['id']))
        kept = []
        for row in ranked:
            if any(np.hypot(*(np.array(row['source_pixel'])-r['source_pixel'])) < 55 for r in kept):
                continue
            kept.append(row)
            selected[row['id']] = row
            if len(kept) == limit:
                break
    return list(selected.values())


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--native-root', type=Path, required=True)
    p.add_argument('--analysis-root', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    args = p.parse_args()
    example_id = 'A-radial-x14277-y24744'
    original_a = load(args.analysis_root/'A/publish/candidates.geojson')['features']
    example = next(f for f in original_a if f['properties']['id'] == example_id)
    reader = NativePatches(args.native_root/'A/assets', [.00921675]*2)
    reference = native_crop(reader, example['properties'], 6)
    if reference is None:
        raise ValueError('reference_native_pixels_missing')
    template = cv2.cvtColor(reference, cv2.COLOR_RGB2GRAY).astype('float32')
    outputs = {}
    for block in 'ABC':
        reader = NativePatches(args.native_root/block/'assets', [.00921675]*2)
        analysis = load(args.analysis_root/block/'publish/analysis.json')
        originals = {f['properties']['id']: f for f in load(args.analysis_root/block/'publish/candidates.geojson')['features']}
        rows = []
        eligible = []
        for feature in sorted(originals.values(), key=lambda f: f['properties']['native_tile']):
            row = feature['properties']
            rgb = native_crop(reader, row, 32)
            if rgb is None or not pale_centre(rgb):
                continue
            row = {**row, 'coordinates': feature['geometry']['coordinates']}
            rows.append(row)
            rgb = native_crop(reader, row, 12)
            if rgb is None:
                continue
            row['similarity'] = resemblance(rgb, template)
            if row['similarity'] >= .65:
                eligible.append(row)
        active_ids = [z['id'] for z in analysis['zones'] if z['kind'] == 'active_source']
        chosen = shortlist(eligible, active_ids)
        if block == 'A' and not any(r['id'] == example_id for r in chosen):
            chosen.append({**example['properties'], 'coordinates': example['geometry']['coordinates'], 'similarity': 1.0})
        features = []
        out = args.out/block
        out.mkdir(parents=True, exist_ok=True)
        for row in chosen:
            f = originals[row['id']]
            features.append({'type': 'Feature', 'geometry': f['geometry'], 'properties': {
                'id': row['id'], 'zones': sorted(set(f['properties']['zones'])),
                'source_pixel': row['source_pixel'], 'native_tile': row['native_tile'],
                'similarity': round(row['similarity'], 6), 'status': 'pending',
                'owner_example': row['id'] == example_id, 'fruiting_validated': False,
                'confidence': 'unvalidated', 'note': '', 'origin': 'visual_shortlist'}})
        result = {'schema': 'dayun-fruiting-shortlist-v1', 'source_run': analysis['source_run'],
                  'block': block, 'boundary_revision': analysis.get('boundary_revision'),
                  'method': 'native pale-centre screen + 13px single-example grayscale NCC with 4 rotations, >=0.65; top 5 per active gawangan, 55px separation',
                  'reference_id': example_id, 'reference_sha256': hashlib.sha256(reference.tobytes()).hexdigest(),
                  'input_candidates': len(originals), 'pale_centres_screened': len(rows),
                  'eligible_similar_centres': len(eligible), 'maximum_per_zone': 5,
                  'coverage': 'review shortlist only; not exhaustive; manual additions not automatically screened',
                  'limitations': ['Kemiripan satu contoh belum mengidentifikasi buah; daun muda, kayu dan pantulan cahaya bisa serupa.',
                                  'Maksimum 5 usulan per gawangan untuk pemeriksaan awal, ditambah contoh pemilik. Bukan jumlah tanaman berbuah.',
                                  'Belum diuji presisi/recall tahap buah. Tim perlu memeriksa citra asli atau mengonfirmasi di lapangan.',
                                  'Koreksi jumlah tanaman dan data sensus tidak diubah.'],
                  'type': 'FeatureCollection', 'features': features, 'census_changed': False}
        (out/'fruiting.json').write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
        cols = 5
        sheet = Image.new('RGB', (cols*180, max(1, (len(features)+cols-1)//cols)*202), 'white')
        draw = ImageDraw.Draw(sheet)
        for i, f in enumerate(features):
            r = f['properties']; rgb = native_crop(reader, r, 44)
            if rgb is None:
                continue
            im = Image.fromarray(rgb).resize((178, 178), Image.Resampling.NEAREST)
            pen = ImageDraw.Draw(im); pen.ellipse((79, 79, 99, 99), outline='#ffae00', width=1)
            x, y = i % cols*180, i//cols*202
            sheet.paste(im, (x, y+24)); draw.text((x+3, y+3), '/'.join(r['zones'])+' #'+str(i+1), fill='black')
        sheet.save(out/'fruiting-preview.jpg', quality=92)
        with (out/'fruiting-gawangan.csv').open('w', encoding='utf-8', newline='') as file:
            writer = csv.writer(file); writer.writerow(['gawangan', 'usulan_awal_belum_dikonfirmasi', 'jumlah_berbuah_tervalidasi'])
            for zone in sorted(set(active_ids)):
                writer.writerow([zone, sum(zone in f['properties']['zones'] for f in features), 'belum tersedia'])
        outputs[block] = {'proposals': len(features), 'eligible': len(eligible)}
        print(json.dumps({block: outputs[block]}), flush=True)
    (args.out/'receipt.json').write_text(json.dumps(outputs), encoding='utf-8')


if __name__ == '__main__':
    main()
