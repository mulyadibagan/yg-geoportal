# Riau restoration clusters — 16 November 2026

The staff restoration page loads the reviewed province-wide analysis through the existing staff authorization flow. The primary workspace provides an SVG overview, cascading regency/subdistrict/village filters, cluster classes, searchable tables, row drill-down, unit details and CSV downloads. Existing reference maps and review tools remain available in a collapsed section.

The source package is `Prioritas_Restorasi_Riau_20261116.zip`. It contains 733 unique reference units (P1 12, P2 92, P3 78, D 543, X 8), 192 evidence cells and 2,093 administrative name clusters. Administrative boundaries are a 2018 reference, including ambiguous or unidentified areas. These are indicative verification classes, not final ecological priorities. Evidence-cell counts are not hectares; overlapping units must not be summed across regions.

`js/restoration-riau.js` contains interaction logic only. The HTML map paths, administrative relationships and analysis data are kept in an authenticated object at `internal/restoration/riau-dashboard-v1.json`. Public repository source includes only an AES-256-GCM encrypted envelope, excluded from Pages by the existing `internal-data/` exclusion. The random decryption key belongs exclusively in the repository secret `RESTORATION_RIAU_PAYLOAD_KEY`. It is never shipped to the browser or Worker.

The publishing workflow validates the decrypted data, requires both existing R2 buckets to have no active public domains, uploads the private object, deploys the existing Worker and verifies that anonymous GET requests are denied. No new staff roles or permissions are introduced. Do not merge until the data key has been configured and the integration tests have passed.

The frontend starts only after the existing backend catalogue has authorized the staff session. The data endpoint independently verifies that session. A session change during loading fails closed. Table pagination affects the rendered rows; CSV exports all filtered table rows. Changing the table level upward clears incompatible child filters.
