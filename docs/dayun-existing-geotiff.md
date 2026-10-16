# Existing Dayun GeoTIFF analysis

Use `Inspect existing Dayun GeoTIFF` for the two existing Agro_ABC/Agro_DEF orthomosaics. Do not submit these TIFFs to the JPEG/OpenDroneMap reconstruction queue.

This job reads `data/dayun-map.geojson` and generates original-resolution, georeferenced crops per gawangan, overview images, metadata, a coverage CSV, and a machine-readable download status. It never writes census records, Google Drive permissions, or public map catalogs. `green_proxy_percent` includes weeds/trees and must not be interpreted as pineapple area, survival, or plant counts. The flight date remains unverified.

## Private Drive access

The GitHub Actions environment `yg-webgis-staging` may provide the secret `DRIVE_CREDENTIALS_JSON`. Acceptable credential types are `service_account` or `authorized_user`; use an identity with read access to the selected files and Drive API enabled. The downloader requests only `drive.readonly`. Share source files/folders with that identity as Viewer, or use an already-authorized user identity. Never commit credentials, upload keys as artifacts, paste them into logs, or make private source files public to fix a download.

The Dayun workflow passes `--require-auth` and fails with `drive_credentials_missing` before any public-link request when credentials are absent. The downloader retains its optional legacy public-link route for other callers. Access from the ChatGPT Drive connector does not grant access to the GitHub runner. A successful connector folder listing is not proof that an unauthenticated runner can download a file.

Authenticated downloads use Drive API `files.get`, `alt=media`, and `supportsAllDrives=true`. Partial data is bound to the source ID, size, version and checksum; a server that ignores Range restarts the file rather than appending duplicate bytes. Before replacing the target, size, TIFF header and the provider MD5 (when available) are verified. Credentials and provider error bodies are never logged.

## Results and failures

Only `download-status.json` is uploaded as an Actions artifact, retained for 30 days. This repository is public: private imagery and analytical outputs must not be placed in its Actions artifacts or committed. Access failures, quota/rate limits, changed source size, incomplete downloads and checksum failures have distinct error codes. A failed download is not a successful image analysis.

The inspector produces a dissolved per-gawangan coverage GeoJSON, CSV, original-resolution georeferenced RGBA crops, overview, metadata, a short report and a review checklist. Coverage uses the **entire dissolved gawangan area** as denominator, including the portion outside the source. Nodata within raster and area outside raster are separate. Pixel-center rasterization has boundary uncertainty of about one pixel. Sources remain separate; do not sum overlapping ABC/DEF areas. Geographic CRS area/GSD in metres remains unavailable rather than treating degrees as metres.

`analysis-status.json` marks completion of coverage processing only. Recognizable planted area, row gaps and pineapple counts remain null until native-resolution samples and independent manual counts have been reviewed. `review.json` proposes samples and low-coverage gawangan checks, not detected missing-plant locations. Metadata dates are retained as evidence; neither TIFF export time nor upload time is promoted to flight date.

The existing `orthomosaic-internal.html` module now has a Dayun panel backed by staff-authenticated `/api/staff/drone/analysis/Agro_ABC` and `Agro_DEF` routes. Files must be explicitly listed in the result manifest, use `private, no-store`, and are never added to the public drone catalogue. No census write path is involved.

## Private persistence with a mandatory privacy gate

`scripts/dayun_private_storage.py` provides checkpoint/restore and result upload using the existing Wrangler/Cloudflare identity. Approved destination: bucket `yg-webgis-public-snapshots`, prefix `drone/analysis/dayun/`. Source chunks are 128 MiB, content-addressed with SHA-256, bound to Drive source identity, and advertised only after all chunks have uploaded. Completed downloads also retain a metadata identity sidecar so processing retries can reuse a verified source. A corrupt restored chunk never becomes a usable partial download. Result manifests are updated only after all files upload. Cancellation before a checkpoint completes can lose progress since the last complete checkpoint; there is no periodic checkpoint during an active download yet.

The owner approved this destination on 16 October 2026. Using the existing Wrangler identity, Cloudflare API verification confirmed managed `r2.dev` access disabled and no custom bucket domains. A 56-byte nonsensitive marker was uploaded and downloaded successfully at `drone/analysis/dayun/audit/20261016-private-storage-probe.txt`; bytes matched. No original imagery has been transferred. `scripts/verify_dayun_r2_privacy.py` records a sanitized result and fails closed on missing permissions, unavailable checks, public access, or any custom domain. The storage helper repeats the check at most 60 seconds apart during transfers and rejects keys outside the approved prefix. It never changes bucket access settings. The Worker serves only manifest-listed result files after staff authentication, with no public checkpoint route. Configuring another Worker to expose this prefix or changing bucket public access would invalidate this privacy arrangement.

The updated workflow verifies R2 privacy, verifies authenticated Drive metadata and source size, restores private checkpoints, downloads/verifies the TIFF, preserves the source/checkpoint, inspects it, and saves private output/status. Install the existing Worker package dependencies (`npm ci --ignore-scripts`) before invoking the helper. Do not upload credentials or imagery to GitHub caches/artifacts. This update remains a draft PR until actual-source execution and review; local verification is not proof that the GitHub environment token has every required API permission.

## Audit on 16 October 2026 (Asia/Bangkok)

- Main inspected at `0a89abaf`; latest observed Dayun run: https://github.com/mulyadibagan/yg-geoportal/actions/runs/38882891433.
- Both job logs have empty `DRIVE_CREDENTIALS_JSON`, `drive_access_denied`, and skipped crop stages. The environment settings show only `CLOUDFLARE_API_TOKEN`; repository secrets show only `FIRMS_MAP_KEY`. No Google credential or workload-identity configuration was found in the inspected engine/workflows. Existing Apps Script Drive access and staff Google sign-in do not provide a runner Drive token.
- Drive connector metadata confirms names/sizes supplied by the owner. Raw DEF download was rejected by the connector's 268,435,456-byte limit; this does not test the runner identity's access.
- Actual GeoJSON: 87 gawangan features, 60 unique IDs, 23 multipart IDs, all six blocks. Census attributes were read only, never rewritten.
- Local private-mode attempts for ABC and DEF stop with `drive_credentials_missing`. Neither source has been downloaded, cropped or visually analyzed in this task. CRS, GSD, flight date, actual nodata, row gaps and plant counts remain unknown.

Account-owner setup is explained in [dayun-drive-credentials.md](dayun-drive-credentials.md). Prefer an existing dedicated reader; if none exists, a dedicated service account with Viewer access only to the two TIFFs bounds effective access. The downloader requests only `drive.readonly`. Enter the credential directly in the existing GitHub environment secret, never in chat or the repository. No public sharing, project-wide role, or domain-wide delegation is needed. Google Cloud Console currently asks the owner to reverify their account before existing project/credential configuration can be inspected further.

Validation: `python -m unittest discover -s tests -p test_drive_geotiff.py -v`. The raster inspector has also been exercised on a synthetic georeferenced RGBA raster to verify crop coordinates, original resolution, validity mask and area, and that no pineapple count is inferred.

References: https://developers.google.com/workspace/drive/api/guides/manage-downloads and https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get
