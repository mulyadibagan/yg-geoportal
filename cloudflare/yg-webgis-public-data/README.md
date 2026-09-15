# YG WebGIS public data Worker

Gateway read-only untuk snapshot publik YG WebGIS. Resource ini harus selalu memakai prefix `yg-webgis-*` dan tidak boleh berbagi binding dengan `kompilasichord-*`.

## Local verification

```sh
npm ci
npm test
npx wrangler deploy --dry-run --env staging
```

## Environments

- `staging`: `yg-webgis-public-data-staging` + `yg-webgis-public-snapshots-staging`.
- `production`: deklarasi reservasi nama saja; jangan deploy sebelum zone, DNS, cache, fallback, dan rollback selesai direview.

Workflow `.github/workflows/publish-cloudflare-snapshots.yml` hanya manual dan hanya menargetkan staging.
