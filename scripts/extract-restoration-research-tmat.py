"""Read a checksum-pinned published TMAT workbook; no scores or workbook edits."""
import collections
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys
import tempfile
import zipfile
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
MD5 = '7dbad64f0455f79acffbfe0f43e8bb2e'
SHA256 = '7ce0f333e4338c2334898240338bc00d2ef634e5f0ae3b949ebc32b2358c3752'

def extract(filename):
    private = (ROOT / 'private-data').resolve(strict=True)
    source = Path(filename).resolve(strict=True)
    if private != ROOT / 'private-data' or not source.is_relative_to(private):
        raise ValueError('Source must remain inside private-data')
    if source.stat().st_size > 1024 * 1024:
        raise ValueError('Workbook exceeds bound')
    raw = source.read_bytes()
    if hashlib.md5(raw).hexdigest() != MD5 or hashlib.sha256(raw).hexdigest() != SHA256:
        raise ValueError('Published workbook checksum mismatch')
    with zipfile.ZipFile(source) as archive:
        if len(archive.infolist()) > 2000 or sum(x.file_size for x in archive.infolist()) > 16 * 1024 * 1024:
            raise ValueError('Expanded workbook exceeds bound')
    workbook = openpyxl.load_workbook(source, read_only=True, data_only=False, keep_links=False)
    try:
        sheet = workbook['Panel a']
        if sheet.max_row > 10000 or sheet.max_column != 3:
            raise ValueError('Unexpected source dimensions')
        if sheet['A3'].value != 'Date' or sheet['C3'].value != 'Groundwater level (m)':
            raise ValueError('Unexpected source headers')
        rows = []
        for number, cells in enumerate(sheet.iter_rows(min_row=4, max_col=3, values_only=True), 4):
            date, _, value = cells
            valid_date = isinstance(date, (dt.date, dt.datetime))
            numeric = isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
            rows.append({'sourceRow': number, 'sourceDateCell': f'A{number}', 'sourceWaterCell': f'C{number}',
                         'sourceDate': date.isoformat() if valid_date else date,
                         'calendarDate': date.strftime('%Y-%m-%d') if valid_date else None,
                         'nativeWaterLevelM': value, 'numericValue': numeric,
                         'missingValue': value is None, 'scoringValidated': False})
    finally:
        workbook.close()
    by_date = collections.defaultdict(list)
    for row in rows:
        if row['calendarDate']:
            by_date[row['calendarDate']].append(row)
    days = sorted(by_date)
    absent_days = []
    if days:
        cursor, last = dt.date.fromisoformat(days[0]), dt.date.fromisoformat(days[-1])
        while cursor <= last:
            if cursor.isoformat() not in by_date:
                absent_days.append(cursor.isoformat())
            cursor += dt.timedelta(days=1)
    audit = {'access': 'staff_only', 'records': len(rows), 'numericValues': sum(r['numericValue'] for r in rows),
             'missingValues': sum(r['missingValue'] for r in rows),
             'invalidValues': sum(not r['numericValue'] and not r['missingValue'] for r in rows),
             'invalidDates': sum(r['calendarDate'] is None for r in rows),
             'firstDate': days[0] if days else None, 'lastDate': days[-1] if days else None,
             'repeatedDates': [d for d, values in by_date.items() if len(values) > 1],
             'conflictingDates': [d for d, values in by_date.items() if len({json.dumps(r['nativeWaterLevelM']) for r in values}) > 1],
             'absentCalendarDaysWithinFileRange': absent_days,
             'completeInstrumentPeriodValidated': False, 'analysisUnitApproved': False, 'score': None}
    metadata = {'access': 'staff_only', 'source': 'https://zenodo.org/records/7728463', 'version': 'v.03',
                'url': 'https://zenodo.org/records/7728463/files/Deshmukh_ED_Fig.%202.xlsx?download=1',
                'retrievedVia': 'Official public file link in Chrome; no authentication bypass',
                'license': 'CC BY 4.0', 'creator': 'Chandra Shekhar Deshmukh', 'publicationYear': 2023,
                'sheet': 'Panel a', 'headerRow': 3, 'dateColumn': 'A', 'waterColumn': 'C',
                'representation': 'Published date-indexed mean of three piezometers, not raw individual logger readings',
                'unit': 'm', 'signConvention': 'Positive above and negative below peat hollow surface',
                'measurementDatum': 'Peat hollow surface (article figure caption); instrument-specific calibration not supplied by workbook',
                'seriesCoordinate': None, 'individualPiezometerCoordinates': None, 'timezone': None,
                'dailyAggregationAndGapFillingQA': None, 'instrumentCalibrationReference': None,
                'methodContext': 'Article methods describe Solinst Levelogger Model 3001 pressure transducers, 30-minute logging; this does not prove raw 30-minute records or per-device QA in the workbook',
                'metadataReferences': ['https://doi.org/10.1038/s41586-023-05860-9', 'https://www.nature.com/articles/s41586-023-05860-9/figures/5'],
                'fieldReview': {
                    'unit': {'status': 'documented', 'evidence': 'Workbook Panel a!C3'},
                    'datumAndSign': {'status': 'documented-at-series-level', 'evidence': 'Article Extended Data Figure 2 caption'},
                    'instrumentAndNativeCadence': {'status': 'method-context-only', 'evidence': 'Article environmental variable measurements; not per-device provenance of this averaged series'},
                    'timezone': {'status': 'not-established', 'reason': 'Local-time references for flux analysis do not establish the daily workbook aggregation timezone'},
                    'calibration': {'status': 'not-established-for-TMAT', 'reason': 'CO2 analyser and N2O gas calibration statements do not calibrate water-level pressure transducers'},
                    'piezometerLocations': {'status': 'missing', 'reason': 'Tower coordinates and figure locations cannot replace individual coordinates for the three-piezometer mean'},
                    'aggregationAndGapQA': {'status': 'missing', 'reason': 'Flux gap-filling methods and a complete date column do not establish GWL gap-filling or instrument completeness'}},
                'readiness': {'readyForUnitScoring': False, 'blockedBy': ['individual-piezometer-identity-and-coordinates',
                    'daily-aggregation-timezone', 'measurement-calibration-and-offset', 'groundwater-aggregation-and-gap-QA',
                    'hydrological-representativeness-and-unit-linkage', 'reviewed-indicator-normalization']},
                'workbookMd5': MD5, 'workbookSha256': SHA256, 'bytes': len(raw), 'openpyxlVersion': openpyxl.__version__,
                'scoringValidated': False, 'limitations': ['No copying station coordinates from a tower into an averaged series.',
                'Excel midnight date labels are not verified measurement clock times.', 'No interpolation, missing-to-zero conversion, or ecological normalization.',
                'No automatic mapping of a transect average to restoration units.']}
    output = Path(tempfile.mkdtemp(prefix='restoration-research-tmat-', dir=private))
    shutil.copyfile(source, output / 'source.xlsx')
    for name, data in [('native-rows.json', rows), ('audit.json', audit), ('metadata.json', metadata)]:
        (output / name).write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    manifest = {'access': 'staff_only', 'createdAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'sourceSha256': SHA256,
                'files': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in output.iterdir()}, 'scoringValidated': False}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    return {'output': str(output), **audit}

if __name__ == '__main__':
    try:
        if len(sys.argv) != 2:
            raise ValueError('Provide the private original research workbook')
        print(json.dumps(extract(sys.argv[1]), indent=2))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
