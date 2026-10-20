# Private manual fruit mapping

Tools → Analisis Orthomosaic → Agro_ABC → A/B/C → **Titik buah** is manual only. Staff use **Tambah titik buah** on ready original pixels and **Hapus titik buah**, or select up to 250 visible fruit markers with a mouse rectangle. Each added point is a confirmed staff fruit annotation; no second confirmation step is needed. Filled pink diamonds distinguish fruit from orange pineapple circles. Zone and unique block totals refresh from each successful save, and the selected zone follows a new fruit point. Failed saves retain the exact operation for retry and explicitly report that they are not saved.

Automatic fruit shortlists are disabled in the service response and defensively hidden in the viewer. This includes unreviewed, previously confirmed and regenerated automatic proposals. Old clients cannot confirm or reactivate automatic fruit points (`automatic_fruiting_disabled`, HTTP 409). Rejections from old clients still work for recovery. Immutable shortlists and archived revisions remain private historical evidence; they do not contribute fruit counts. Do not re-enable shortlist presentation or run the old shortlist script to populate the staff map.

The existing staff-only `GET/POST /api/staff/drone/analysis/Agro_ABC/fruiting-review?block=A` endpoint and DroneQueue coordinator remain in use. Manual features must have the block-specific `*-fruit-manual-*` ID and `manual_fruiting_review` origin. Source run, proposal path, revised polygon membership and native-image coverage are validated. Existing manual records, notes, coordinates and point versions are preserved. New imagery runs retain separate histories.

Per-point versions merge independent staff edits. Same-point conflicts return 409, and exact retries are idempotent. Rectangle removal is atomic and writes one archived version plus one head. Responses and stored records remain private/no-store under `drone/analysis/dayun/fruit-reviews/Agro_ABC/<run>/<block>/`. No census, plant corrections, planting, ethrel, fertilizer, harvest or monitoring records are written.

Per-gawangan counts use unique polygon IDs. A point in overlapping zones may be listed in each zone; block totals must not be obtained by summing overlapping rows. Counts describe staff annotations, not a validated estimate of all fruit. No production points are added or deleted just for tests.


## One fruit annotation per pineapple

New fruit points must reference an active pineapple ID through `plant_id`. Staff enable **Tambah titik buah**, then click the pineapple marker. Map-centre clicks match only if a plant is within 20 cm and the second-nearest candidate is at least 15 cm farther away; otherwise staff must click a plant marker explicitly. No pineapple point is created automatically and no census value changes.

The existing fruit coordinator serializes writes and rejects a second active annotation for an occupied parent (`fruiting_plant_already_marked`), including concurrent submissions from different laptops. Deleting fruit frees that association while preserving the pineapple. Existing annotation IDs, evidence coordinates, notes and history remain. Links follow stable plant IDs; linked zone counts derive from the current parent geometry. Deleted/rejected/missing parents leave the fruit annotation visible with a review flag, rather than silently erasing staff work.

Old annotations may be matched spatially only under the same conservative uniqueness rule. Ambiguous or missing matches remain visible as **Perlu dihubungkan**. Select one and use **Hubungkan ke titik nanas**, then click its parent. A nearby unresolved old annotation blocks a new addition until it is linked. Existing duplicate annotations are retained and flagged but contribute only once per parent to counts. No old point is automatically deleted, moved or accepted as a species label. Spatial links carry `link_method: spatial_unique`; explicit associations carry `manual_selection`.
