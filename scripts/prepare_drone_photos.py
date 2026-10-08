"""Make bounded processing copies; retain source JPEG and copy geolocation metadata."""
import argparse
import json
from pathlib import Path
import subprocess
from PIL import Image

def prepare(source_list, destination, max_dimension=4096):
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    summary = []
    for line in Path(source_list).read_text().splitlines():
        source = Path(line)
        if not source.is_file():
            raise ValueError('source_photo_missing')
        output = destination / f"{len(summary):04d}-{source.name}"
        with Image.open(source) as image:
            image.load()
            old_size = image.size
            image = image.convert('RGB')
            image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            image.save(output, 'JPEG', quality=95, subsampling=0)
            width, height = image.size
        subprocess.run(['exiftool', '-overwrite_original', '-TagsFromFile', str(source),
                        '-all:all', '-ThumbnailImage=', '-PreviewImage=',
                        f'-EXIF:ExifImageWidth={width}', f'-EXIF:ExifImageHeight={height}',
                        str(output)], check=True, capture_output=True)
        # Native DJI calibration values are pixel-based; scale them with the image.
        values = json.loads(subprocess.check_output(['exiftool', '-j', '-n',
            '-CalibratedFocalLength', '-CalibratedOpticalCenterX', '-CalibratedOpticalCenterY', str(output)]))[0]
        ratio = width / old_size[0]
        calibrated = [f'-XMP-drone-dji:{key}={float(values[key])*ratio}' for key in
            ['CalibratedFocalLength', 'CalibratedOpticalCenterX', 'CalibratedOpticalCenterY']
            if isinstance(values.get(key), (float, int))]
        if calibrated:
            subprocess.run(['exiftool', '-overwrite_original', *calibrated, str(output)], check=True, capture_output=True)
        summary.append({'name': source.name, 'originalSize': list(old_size), 'processingSize': [width, height]})
    return summary

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source_list')
    parser.add_argument('destination')
    parser.add_argument('summary')
    parser.add_argument('--max-dimension', type=int, default=4096)
    args = parser.parse_args()
    Path(args.summary).write_text(json.dumps(prepare(args.source_list, args.destination, args.max_dimension), indent=2))
