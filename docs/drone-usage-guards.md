# Drone usage controls

The existing account-wide Cloudflare budget alert was changed from USD 10 to USD 1
of usage-based charges, preserving its recipient. This is an early warning, not a
spending cap, and does not include the fixed Workers subscription. It applies to
the whole account, including other applications. No subscription was purchased.

## Admission limits

The WebGIS Worker has separate native rate-limit bindings for these workloads:

| Workload | Limit | Identity |
| --- | --- | --- |
| Private Dayun asset-link batches | 20/minute, up to 64 files each | SHA-256 of verified staff session token |
| New Dayun analysis requests | 2/minute | SHA-256 of verified staff session token |
| Legacy proxied Dayun file reads | 120/minute | SHA-256 of verified staff session token |
| New public drone upload jobs | 8/minute | SHA-256 of Cloudflare-provided connecting IP |

The public job limit allows four users sharing Wi-Fi to submit together. Private
staff limits use separate session identities and do not pool their counters by IP.
Staging and production have different namespaces. Pending job admission is also
limited to four; the existing upload limits of 800 images / 8 GB per job remain.

Login, per-point correction writes, fruit decisions, progress reads and existing
job completion requests never use these counters. A missing deployed limiter
returns 503 on the guarded expensive route, rather than silently allowing it.
Rate-limit rejection includes HTTP 429 and Retry-After: 60. The browser pauses
signing retries for that interval; it does not pause point saves or staff login.

Cloudflare's native counters are per-location and eventually consistent. They are
burst admission controls, not exact monthly accounting. Rejected requests still
invoke the Worker and count as requests. This cannot stop account-wide billing or
reserve an exact quota for login, and does not restore today's exhausted allowance.

## Browser controls

At most two complete R2 response-body transfers run simultaneously per viewer tab.
Queued downloads are discarded on logout. Unchanged source manifests retain their
valid signed batches instead of reissuing them when reopening a block. Native TIFF
blobs use an in-memory LRU bounded by six crops and 96 MiB; no imagery is persisted
to browser storage. Session checks and signed URL expiry remain unchanged.

## Validation and operation

Tests verify four independent sessions, per-session throttling, denied anonymous
requests before rate counting, no raw staff token in limiter keys, cooldown, body
transfer concurrency, logout, manifest reuse, and four concurrent point saves while
the imagery limiter is exhausted. Existing conflict and idempotency tests remain.
Live four-device throughput still requires available Workers allowance.

Review the USD 1 alert when it arrives: identify the product causing charges before
changing limits. Never respond by disabling the staff Worker or correction routes.
For a sustained attack, ingress protection upstream of the Worker is required;
these application controls cannot guarantee a total dollar ceiling.

To roll back, deploy the previous Worker and browser assets together. Existing
private R2 objects and saved corrections are not moved, deleted or rewritten.
