# Google login activation for WebGIS

Prepared branch: google-webgis-login-20261013 in both repositories.

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

## Deployment blocker
Repository updates do not deploy the existing Apps Script service. No Apps Script deployment tool is available in this session. The live login page remains unchanged until that service is updated and verified.
