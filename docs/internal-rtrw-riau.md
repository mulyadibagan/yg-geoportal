# Internal RTRW Riau ingest

This repository is public. Never commit RTRW/RDTR source or working geometry.

## Required object

R2 key:

`internal/spatial-planning/rtrw-riau-2018-2038.geojson`

The Worker exposes it only through authenticated staff route:

`/api/staff/rtrw-riau-2018-2038`

## Dataset status

The GeoJSON is a working internal analysis layer. The legal reference is Perda Provinsi Riau No. 10 Tahun 2018. Geometry must not be described as a legal boundary unless its provenance is independently verified against the official spatial dataset/lampiran.

Recommended top-level metadata:

```json
{
  "metadata": {
    "status": "working_internal",
    "legalBasis": "Perda Provinsi Riau No. 10 Tahun 2018",
    "sourceOrganisation": "...",
    "sourceDataset": "...",
    "sourceDate": "...",
    "retrievedAt": "...",
    "crs": "EPSG:4326",
    "notes": "..."
  }
}
```

## Before upload

Run:

`npm run validate:rtrw -- <path-to-geojson>`

Do not upload when validation fails. Keep the original source archive outside this public repository.

## Security checks

Anonymous request to the staff endpoint must return 401. A valid staff session may receive the R2 object. There is no public fallback to GitHub.
