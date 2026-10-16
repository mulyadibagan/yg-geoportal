#!/usr/bin/env bash
# Owner/admin applies this once in Google Cloud Shell after reviewing the exact
# trust below. Never disable the organization's service-account key policy.
set -euo pipefail
PROJECT=yg-staff-dashboard
POOL=webgisyg-dayun
PROVIDER=github-main
SERVICE_ACCOUNT=webgisyg-dayun-reader@yg-staff-dashboard.iam.gserviceaccount.com
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com drive.googleapis.com --project "$PROJECT"
if ! gcloud iam workload-identity-pools describe "$POOL" --project "$PROJECT" --location global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL" --project "$PROJECT" --location global --display-name 'WebGISYG Dayun reader'
fi
CONDITION="assertion.repository_id=='1297989887' && assertion.repository_owner_id=='48111628' && assertion.ref=='refs/heads/main' && assertion.workflow_ref=='mulyadibagan/yg-geoportal/.github/workflows/inspect-dayun-geotiff.yml@refs/heads/main' && assertion.environment=='yg-webgis-staging'"
MAPPING='google.subject=assertion.sub,attribute.repository_id=assertion.repository_id'
if gcloud iam workload-identity-pools providers describe "$PROVIDER" --project "$PROJECT" --location global --workload-identity-pool "$POOL" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc "$PROVIDER" --project "$PROJECT" --location global --workload-identity-pool "$POOL" --issuer-uri https://token.actions.githubusercontent.com --attribute-mapping "$MAPPING" --attribute-condition "$CONDITION"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --project "$PROJECT" --location global --workload-identity-pool "$POOL" --issuer-uri https://token.actions.githubusercontent.com --attribute-mapping "$MAPPING" --attribute-condition "$CONDITION"
fi
gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT" --project "$PROJECT" --role roles/iam.workloadIdentityUser --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository_id/1297989887" --condition=None
printf 'Set GitHub environment variable DAYUN_GOOGLE_WIF_PROVIDER to:\nprojects/%s/locations/global/workloadIdentityPools/%s/providers/%s\n' "$PROJECT_NUMBER" "$POOL" "$PROVIDER"
