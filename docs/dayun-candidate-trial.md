# Private native-crop candidate review

The existing internal orthomosaic viewer loads `candidate-trial.json` only through
the staff API and only when listed in the current source manifest. A trial is
bound to the exact source run. No imagery, point coordinates, or private trial
configuration belongs in this repository.

Staff select a sample, open its original TIFF, and review numbered candidates.
Orange means unreviewed, green accepted by the reviewer, red rejected. Points
can be dragged; missing candidates can be added within the sample window.
Counts describe that window only. Acceptance is a reviewer label, not an
independently validated whole-gawangan estimate.

Corrections stay in memory. Export JSON before closing, switching sources, or
refreshing. The file can be loaded again for exactly the same trial/source run.
Imports reject duplicate IDs, unknown statuses and coordinates outside the
sample. Corrections do not write to a server or any census/monitoring endpoint.
The page removes its marker layer on session lock or source change.

`scripts/propose_dayun_candidates.py --config <private-config.json> --output <private-directory>`
uses native RGB, alpha masking, grayscale normalized template matching with
rotations/scales, and duplicate suppression. Install optional
`opencv-python-headless`, plus the existing rasterio, NumPy and Pillow tools.
The private config specifies source run, TIFF paths, native 512px windows,
template centers and optional visual candidate centers. Automated outputs are
retained separately when visual candidates are supplied. Similarity is not a
species probability. Template exemplars are calibration data; they cannot serve
as independent precision/recall evidence.

Keep trial JSON, CSV, GeoJSON, reports and previews under the approved private R2
result prefix. Upload all files before adding them to the result manifest.
Existing source rasters and census files remain unchanged.
