# Meritech verified tile navigation

The map displays `data/meritech-riau-tiles.json`, never the earlier 20 km discovery cells. Each feature is the exact extent of one zoom-17 XYZ tile (about 306 m per side in Riau) whose decoded image is nonblank. Tile boundaries are not official survey footprints; a tile can contain a partly blank margin. No interpolation fills the gaps between verified tiles.

Below zoom 15 the map shows location markers. At zoom 15 and above it shows unfilled tile outlines. Clicking a marker or outline zooms to a verified tile at zoom 17. The boundary overlay and imagery overlay are independently opt-in; no index, tile boundary or source imagery loads on page opening. Clicking a marker never enables imagery by itself.

The initial verification checks the previously discovered image-positive seed tile and its eight immediate neighbours, restricted to tiles intersecting Riau. This is a verified subset, not exhaustive Meritech coverage. Regions without outlines must not be interpreted as having no imagery.

The older `data/meritech-riau-index.json` remains an input discovery survey (276 cells at 0.18 degrees, about 20 km), but its coarse polygons are no longer rendered. Its positive cells only identified sample coordinates.

Rebuild using Python 3 with requests, Pillow and shapely: `python scripts/build-meritech-tiles.py --workers 8`. It resumes from `data/meritech-riau-tiles.json.checkpoint.json`; remove that local checkpoint to reverify completed tiles. The checkpoint contains probe results, including blank/missing/errors; publish only the final verified output through review. Failed probes are never promoted to imagery or absence of coverage.

Validate imagery classification with `python -m unittest discover -s tests -p test_meritech_index.py` and UI behavior with `node --test tests/meritech-ui.test.cjs`. Source acquisition dates, resolution and capture method remain unverified.
