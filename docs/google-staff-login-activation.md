# Google login activation for WebGIS

Merged on 13 October 2026: website PR #11 and WebGIS PR #367.

## Deployment order
1. Website staff broker: deploy migration 0005 and Worker, keeping existing website login.
2. Deploy the updated EditorAuthentication in the CURRENT Apps Script deployment used by WebGIS. Preserve its deployment URL. Google session introspection must be reachable from UrlFetchApp.
3. Deploy WebGIS Worker and login page only after an authenticated Apps Script smoke test succeeds.

## Acceptance
- Google Workspace user can open staff-reports and donor modules using the new token.
- Missing, expired, revoked token is rejected.
- PKCE wrong verifier/state and code replay fail.
- kups-finance scope is denied by general staff data APIs and Apps Script.
- Legacy login remains during migration.
- Logout revokes Google WebGIS token.
- A changed/disabled website user cannot retain access.

## Limits
The current Google OAuth app admits YG Workspace accounts. External KUPS email login requires an explicit allowlist and a separate restricted onboarding flow; no external email is enabled by this change.
The finance application itself is not yet implemented. Do not grant kups-finance until its destination and API are ready.
No financial records are published in GitHub.

## Activation evidence — 13 October 2026
- Website staff broker and database migration deployed successfully.
- Live Apps Script EditorAuthentication updated and active deployment advanced to version 172, preserving its endpoint URL.
- WebGIS login page deployed with Google as the primary login.
- An existing YG Google account completed login and reached the admin dashboard; 160 server reports and donor data loaded. Internal RSPO group polygons also loaded.
- Logout returned the browser to the login page, and subsequent Google login reused the website session without another WebGIS password.
- WebGIS Cloudflare deployment run 38427819142 started after cancelling obsolete run 37519910554, which had blocked concurrency since 7 October. Staging and production Workers deployed successfully; gateway smoke test passed.

The acceptance list above defines required security behavior; only the explicitly recorded checks here are live verification evidence.
