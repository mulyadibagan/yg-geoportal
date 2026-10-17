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

Use **Simpan privat & perbarui hitungan** after editing. Staff-only GET/POST
`/api/staff/drone/analysis/<label>/review` stores corrections under
`drone/analysis/dayun/reviews/<label>/<source-run>/<trial-id-sha256>/`. The existing DroneQueue
coordinator serializes each source's saves. Every save retains an immutable
version and then updates the private head. A stale expected revision gets 409;
failed saves preserve local edits. No census/monitoring endpoint is involved.
Export remains available for backup and conflict recovery. Imports reject wrong
source runs, duplicate IDs, unknown statuses and coordinates outside the sample.
Original candidate IDs must remain; reject a candidate instead of deleting it.
The page removes both review and feedback layers on session lock/source change.

Mark a window fully reviewed only after deciding every candidate and adding
missed plants. Completed windows with at least three accepted plants can
calibrate a threshold on existing native-template proposals. The first completed
window calibrates; other completed windows receive separate held-out metrics.
The proposal pool starts at similarity 0.30; threshold tuning cannot learn new
crown appearance or recover absent proposals. A zero-match calibration leaves
the baseline threshold unchanged. Accepted additions restore missed crowns in
reviewed windows, with their origin explicitly recorded as reviewer labels.
The blue overlay shows provisional automatic proposals after feedback.

Metrics match one-to-one within 12 native pixels. Labels are staff judgements,
not independent field truth. C contains template exemplars: a held-out window
does not establish independent species/count validation. Whole-gawangan census
counts remain untouched and validated counts remain null. With no completed
labels the status is waiting, never a claimed improvement. A new imagery run
starts a separate review history; labels are not silently transferred.

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
