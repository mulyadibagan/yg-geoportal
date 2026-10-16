# Existing Dayun GeoTIFF analysis

Use `Inspect existing Dayun GeoTIFF` for the two existing Agro_ABC/Agro_DEF orthomosaics. Do not submit these TIFFs to the JPEG/OpenDroneMap reconstruction queue.

This job reads `data/dayun-map.geojson` and generates original-resolution, georeferenced crops per gawangan, overview images, metadata, a coverage CSV, and a machine-readable download status. It never writes census records, Google Drive permissions, or public map catalogs. `green_proxy_percent` includes weeds/trees and must not be interpreted as pineapple area, survival, or plant counts. The flight date remains unverified.

## Private Drive access

The GitHub Actions environment `yg-webgis-staging` may provide the secret `DRIVE_CREDENTIALS_JSON`. Acceptable credential types are `service_account` or `authorized_user`; use an identity with read access to the selected files and Drive API enabled. The downloader requests only `drive.readonly`. Share source files/folders with that identity as Viewer, or use an already-authorized user identity. Never commit credentials, upload keys as artifacts, paste them into logs, or make private source files public to fix a download.

Without this secret the downloader uses the existing public-link route. Access from the ChatGPT Drive connector does not grant access to the GitHub runner. A successful connector folder listing is not proof that an unauthenticated runner can download a file.

Authenticated downloads use Drive API `files.get`, `alt=media`, and `supportsAllDrives=true`. Partial data is bound to the source ID, size, version and checksum; a server that ignores Range restarts the file rather than appending duplicate bytes. Before replacing the target, size, TIFF header and the provider MD5 (when available) are verified. Credentials and provider error bodies are never logged.

## Results and failures

Artifacts `dayun-ortho-Agro_ABC` and `dayun-ortho-Agro_DEF` are retained for 30 days. `download-status.json` is uploaded even if the download fails. Access failures, quota/rate limits, changed source size, incomplete downloads and checksum failures have distinct error codes. A failed download is not a successful image analysis. Restart a failed workflow after fixing the source access; no background retry is promised.

Validation: `python -m unittest discover -s tests -p test_drive_geotiff.py -v`. The raster inspector has also been exercised on a synthetic georeferenced RGBA raster to verify crop coordinates, original resolution, validity mask and area, and that no pineapple count is inferred.

References: https://developers.google.com/workspace/drive/api/guides/manage-downloads and https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get
