# Existing Dayun GeoTIFF analysis

Use `Inspect existing Dayun GeoTIFF` for the two existing Agro_ABC/Agro_DEF orthomosaics. Do not submit these TIFFs to the JPEG/OpenDroneMap reconstruction queue.

## Staff workflow: paste a Drive link

Staff paste an ABC/DEF file link in the existing `orthomosaic-internal.html` and select **Analisis citra**. A staff-authenticated POST to `/api/staff/drone/analysis/requests` validates the host/file ID against the two registered Dayun sources. Folder links, arbitrary hosts and unregistered images are rejected. The existing DroneQueue uses a separate instance/path for these requests; JPEG reconstruction and census data are untouched. Repeated clicks reuse an active request.

The existing inspection workflow polls every five minutes. `process_dayun_analysis_requests.py` reads pending requests, calls the existing downloader/crop inspector/private R2 storage, and reports state to the existing UI. `coverage_ready` explicitly means coverage/crops are available, not validated pineapple counts. Access/configuration errors become `blocked`; processing/storage errors become `failed`. Expired processing leases can be retried. A previous complete result manifest is retained if a later run fails.

The preferred machine connection is now WIF/ADC without a JSON key; organization key-creation policy stays enforced. See [credential setup](dayun-drive-credentials.md). This code and its setup script do not establish an operational Google connection by themselves. The WIF setup is prepared but has not been applied, the branch is not deployed, and original TIFF processing/count validation remains unverified.

Only ABC/DEF are registered in this Dayun change. Public preview publication is not enabled yet; originals, detailed outputs and downloads remain staff-only. A reviewed low-resolution preview may be published separately later, without granting public original-image access.

This job reads `data/dayun-map.geojson` and generates original-resolution, georeferenced crops per gawangan, overview images, metadata, a coverage CSV, and a machine-readable download status. It never writes census records, Google Drive permissions, or public map catalogs. `green_proxy_percent` includes weeds/trees and must not be interpreted as pineapple area, survival, or plant counts. The flight date remains unverified.

## Private Drive access

The GitHub Actions environment `yg-webgis-staging` may provide the secret `DRIVE_CREDENTIALS_JSON`. Acceptable credential types are `service_account` or `authorized_user`; use an identity with read access to the selected files and Drive API enabled. The downloader requests only `drive.readonly`. Share source files/folders with that identity as Viewer, or use an already-authorized user identity. Never commit credentials, upload keys as artifacts, paste them into logs, or make private source files public to fix a download.

The Dayun processor requires authenticated downloads and fails with `drive_credentials_missing` before any public-link request when neither federated runner credentials nor the legacy secret is available. The downloader retains its optional legacy public-link route for other callers. Connector access does not grant the GitHub runner access; a folder listing is not proof that a runner can download its files.

Authenticated downloads use Drive API `files.get`, `alt=media`, and `supportsAllDrives=true`. Partial data is bound to the source ID, size, version and checksum; a server that ignores Range restarts the file rather than appending duplicate bytes. Before replacing the target, size, TIFF header and the provider MD5 (when available) are verified. Credentials and provider error bodies are never logged.

## Results and failures

The current request-driven workflow uploads no Actions artifacts. Request state, imagery and analytical outputs stay in private R2. This repository is public: private imagery and analytical outputs must not be placed in its Actions artifacts or committed. Access failures, quota/rate limits, changed source size, incomplete downloads and checksum failures have distinct error codes. A failed download is not a successful image analysis.

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

On 17 October the owner completed Google verification and created `webgisyg-dayun-reader`; ABC/DEF Viewer access was saved, with general access restricted. Organization policy blocks service-account key creation. The connection therefore moves to WIF without changing that policy; setup has been prepared but not applied. The Console currently shows the WIF introductory page, with no existing pool displayed. See [setup](dayun-drive-credentials.md). No public sharing, project-wide machine role, or domain-wide delegation is needed.

Validation: `python -m unittest discover -s tests -p test_drive_geotiff.py -v`. The raster inspector has also been exercised on a synthetic georeferenced RGBA raster to verify crop coordinates, original resolution, validity mask and area, and that no pineapple count is inferred.

References: https://developers.google.com/workspace/drive/api/guides/manage-downloads and https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get


## Reusing private image bytes while editing

The internal viewer reuses complete TIFF/PNG/JPEG downloads in staff-session memory, keyed by the allowlisted image source. Repeated zooms, pans and reopening a block reuse these bytes without another Worker authorization batch or R2 transfer, even after the old signed link expires. Concurrent requests for the same image share one transfer. Range requests and JSON analysis/review records remain uncached. New imagery identities invalidate old bytes.

Memory is bounded to 192 MiB / 128 image files with least-recently-used eviction. Ready native TIFF readers are also retained within the existing bounded viewport pool when zooming below zoom 22; native layers are hidden below that zoom and the overview cannot authorize point editing. Returning to the detail zoom reuses readers. A removed/failed layer can reopen from cached bytes.

This cache exists only in the current page session. Logout/account changes, closing/reloading the page or eviction require a fresh authorized download. Imagery and signed links are never placed in browser persistent storage, shared HTTP caches or public routes. Staff edits still use their existing private revision API and are unaffected by image-cache eviction. Downloads for new areas and periodic team synchronization still consume requests; this does not promise zero Worker usage.


### Penyimpanan satu kali hubungan buah lama

`dayun-fruit-link-job.js` memproses permintaan privat berisi tepat 21 pasangan
melalui koordinator buah produksi yang sama dengan editor staf. Permintaan
berada pada `drone/analysis/dayun/maintenance/fruit-links-21-20261020/request.json`;
ID penanda dan pasangan tidak disimpan dalam repository. Tidak ada route HTTP
baru, credential baru, atau perubahan akses bucket. Handler scheduled hanya
aktif untuk environment produksi dan tidak melakukan apa pun tanpa permintaan.

Setiap pasangan diperiksa kembali terhadap revisi terbaru dan harus masih
merupakan pasangan spasial unik. Status, catatan, koordinat dan ID lama
dipertahankan. Konflik versi gagal tanpa menimpa pekerjaan staf, sehingga
pekerjaan dapat dicoba ulang. Pasangan yang sudah diubah tim atau tidak lagi
jelas tetap utuh dan dilaporkan untuk pemeriksaan. Hasil privat disimpan pada
`result.json`; hasil lengkap membuat pengulangan tidak menulis kembali.
Jadwal sementara harus dikembalikan ke konfigurasi awal setelah hasil
terverifikasi. Sensus dan koreksi titik nanas tidak ditulis oleh tugas ini.
