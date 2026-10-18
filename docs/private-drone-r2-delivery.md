# Private Dayun imagery without a Worker request for each asset

The Dayun staff viewer keeps the existing private R2 buckets. No r2.dev URL or
public custom domain is enabled. Staff login, correction saves and progress reads
keep their existing authenticated API and Durable Object coordination.

After the viewer loads a source manifest, its static files use the R2 S3 endpoint.
The API checks the active staff token, accepts at most 64 manifest-listed filenames,
and returns GET-only SigV4 links valid for five minutes. The browser batches links,
keeps them only in memory, refreshes expiring links and clears them on session lock.
R2 requests omit staff Authorization headers and browser credentials. Responses
request `private, no-store`; failed signing never silently falls back to proxying
the imagery through the Worker. Links are bearer capabilities: anyone receiving a
copied link can read that one asset until it expires. Do not share signed links.

The API, including login and signing, still shares the account's Workers quota.
This removes the *image byte requests* from that quota; it does not create a
separate allowance or restore a free allowance already exhausted that day.
The general job COG viewer remains on its existing authenticated route; the direct
path applies to manifest-listed Dayun analysis assets used to mark pineapple plants.

## Deployment

`deploy-drone-service.yml` runs `configure-private-drone-r2.mjs` using the existing
GitHub environment deployment identity. The script verifies both buckets have no
public domains, derives the S3 credential from the existing token (no new token),
checks a signed 16-byte TIFF range and rejects unsigned reads before configuration,
preserves existing CORS rules and adds GET/HEAD/Range access for the two WebGIS
origins. Signing credentials are sent to Wrangler secret bulk over stdin, never
written to files or logs. The API token itself is not installed on the Worker.
Staging signs only its staging bucket; production signs only its production bucket.

The existing deployment token must support R2 S3 access. If the precheck fails,
the configuration script stops without changing CORS or secrets. If no R2 CORS
configuration exists, treat only an explicit HTTP 404 as an empty configuration;
permission or network failures must stop deployment.

## Verification and rollback

Run the Worker test suite and browser logic tests. Tests cover denied anonymous and
unlisted requests, AWS signature calculation, direct downloads without staff tokens,
link expiry/retry/logout, four simultaneous additions and idempotent saves. Existing
same-point conflict tests must pass. Live four-device work still needs validation
with real staff sessions; tests do not measure real-world throughput.

After deployment, open a Dayun block and inspect Network: imagery must come from
`*.r2.cloudflarestorage.com`; only small `asset-links` requests and correction APIs
reach the Worker. A signed Range request must return 206 with CORS and an unsigned
request must fail. A completed image fetch is not permission to place a point until
the native TIFF pixels have rendered.

Rollback the viewer and Worker to their previous deployment together. Restore the
previous CORS rules from the deployment's in-memory snapshot if configuration fails.
The new CORS rule alone grants no anonymous object access. Existing private objects,
correction heads and review history are not moved or rewritten by this change.
