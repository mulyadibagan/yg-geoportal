# Meritech Riau discovery grid

This is a sampled navigation index, not the provider's official imagery footprint. The angular grid is 0.18 degrees (about 20 km in Riau), clipped to the repository's province boundary. Each cell is checked at up to nine zoom-17 tile samples, stopping at the first decoded nonuniform image. A positive cell means at least one tested tile contains image content; it does not imply continuous coverage throughout the cell or verify the acquisition method/date. Clicking a positive cell uses its actual successful sample coordinate.

States: `imagery` = nonblank sample; `not_detected` = all sampled tiles blank or missing; `error` = unresolved network/HTTP/decode failure and no hit; `pending` = not examined. Negative samples never establish full absence of coverage. Small unsampled image patches may be missed. Bounds and sample details are saved in the JSON.

Both the index overlay and the image overlay are opt-in. No Meritech image request or index fetch occurs on page load. Navigating to a cell does not enable imagery. The page fetches the saved index only; it does not scan Meritech.

To rebuild (Python 3): install requests, Pillow and shapely; run `python scripts/build-meritech-index.py --workers 8`. Existing completed cells are retained and failed/pending cells are retried. To resurvey completed cells, remove the existing output in an isolated checkout first. Validate with `python -m unittest discover -s tests -p test_meritech_index.py` and `node --test tests/meritech-ui.test.cjs`. Publish the refreshed `data/meritech-riau-index.json` through the normal review/deployment process.
