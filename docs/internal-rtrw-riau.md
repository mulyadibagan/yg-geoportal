# Internal RTRW Riau ingest

This repository is public. Never commit RTRW/RDTR source or working geometry.

## Required object

R2 key:

`internal/spatial-planning/rtrw-riau-2018-2038.geojson`

The exact source response and its provenance manifest are archived without a
public route at:

- `internal/spatial-planning/source/rtrw-riau-2018-2038-raw.geojson`
- `internal/spatial-planning/rtrw-riau-2018-2038-manifest.json`

The Worker exposes it only through authenticated staff route:

`/api/staff/rtrw-riau-2018-2038`

## Verified source

- Organisation: Badan Informasi Geospasial — Sekretariat Kebijakan Satu Peta.
- Service: `PUBLIK/PERENCANAAN_RUANG`, layer `RTRWP` (14).
- Filter: `UPPER(wadmpr)='RIAU'`.
- Inventory verified on 20 September 2026: 33 polygon features, 23 spatial-plan
  classes, EPSG:4326, and `Perda No.10 Tahun 2018` on every feature.
- Service URL:
  `https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/PERENCANAAN_RUANG/MapServer/14`

The display object is simplified to 5% with keep-shapes, cleaned, and rounded
to 0.000001 degrees. The exact source response remains in the unserved archive
key above.

## Dataset status

The GeoJSON is a working internal analysis layer. The legal reference is Perda
Provinsi Riau No. 10 Tahun 2018 and must be read together with Putusan MA No.
63 P/HUM/2019. The display geometry must not be described as a legal boundary
or as a replacement for the official Perda attachment.

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

Use the manual GitHub Actions workflow `Ingest internal RTRW Riau` to download
the current official response, validate the fixed inventory, build the display
object, and upload both the internal display and the unserved source archive.

## Security checks

Anonymous request to the staff endpoint must return 401. A valid staff session may receive the R2 object. There is no public fallback to GitHub.
