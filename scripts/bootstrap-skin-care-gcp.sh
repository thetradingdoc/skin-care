#!/usr/bin/env bash
# Bootstrap GCP + Firebase for Skin & Care (myskinandcare.com / api.myskinandcare.com).
# Requires: gcloud + firebase CLI as doctorjay254@gmail.com, billing enabled.
#
# Usage:
#   export BILLING_ACCOUNT_ID=<your-billing-id>   # required on first run
#   ./scripts/bootstrap-skin-care-gcp.sh
#
# Optional overrides: SKIN_CARE_GCP_PROJECT, SKIN_CARE_FIREBASE_PROJECT, BILLING_ACCOUNT_ID
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/skin-care-deploy-env.sh
source "$ROOT/scripts/lib/skin-care-deploy-env.sh"

export GCP_PROJECT="${GCP_PROJECT:-$SKIN_CARE_GCP_PROJECT}"
export GCP_REGION="${GCP_REGION:-$SKIN_CARE_GCP_REGION}"
export GCS_DB_BUCKET="${GCS_DB_BUCKET:-$SKIN_CARE_GCS_DB_BUCKET}"

echo "==> Skin & Care GCP bootstrap"
echo "    Account:  ${SKIN_CARE_GCLOUD_ACCOUNT}"
echo "    Project:  ${GCP_PROJECT}"
echo "    API host: ${SKIN_CARE_API_HOST}"
echo "    UI host:  ${SKIN_CARE_UI_HOST}"

gcloud config set account "${SKIN_CARE_GCLOUD_ACCOUNT}"
gcloud config set project "$GCP_PROJECT"

if ! gcloud projects describe "$GCP_PROJECT" &>/dev/null; then
  if [[ -z "${BILLING_ACCOUNT_ID:-}" ]]; then
    echo "ERROR: Set BILLING_ACCOUNT_ID before first run (gcloud billing accounts list)."
    exit 1
  fi
  echo "==> Create project $GCP_PROJECT"
  gcloud projects create "$GCP_PROJECT" --name="Skin and Care"
  gcloud billing projects link "$GCP_PROJECT" --billing-account="$BILLING_ACCOUNT_ID"
fi

echo "==> Enable APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com \
  storage.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
  firebase.googleapis.com firebasehosting.googleapis.com --project="$GCP_PROJECT"

echo "==> Provision secrets (copy from somo or fill .env.staging)"
GCP_PROJECT="$GCP_PROJECT" "$ROOT/scripts/provision-staging-secrets.sh" || true

echo "==> GCS bucket"
gsutil mb -p "$GCP_PROJECT" -l "$GCP_REGION" "gs://${GCS_DB_BUCKET}" 2>/dev/null || true

echo ""
echo "==> Next steps (manual):"
echo "  1. Firebase Console → add project → Hosting → custom domains myskinandcare.com + www"
echo "  2. Fill Secret Manager secrets for middleware"
echo "  3. Deploy API:"
echo "       source scripts/lib/skin-care-deploy-env.sh"
echo "       USE_GCP_SECRETS=1 ./scripts/deploy-to-gcp.sh"
echo "  4. Map API domain:"
echo "       gcloud beta run domain-mappings create --service=somo-middleware \\"
echo "         --domain=api.myskinandcare.com --region=$GCP_REGION --project=$GCP_PROJECT"
echo "  5. IONOS DNS — see docs/runbooks/MYSKINANDCARE_IONOS_DNS.md"
echo "  6. Build + deploy consumer hosting:"
echo "       npm run build:consumer-hosting"
echo "       npm run deploy:consumer-hosting"
echo ""
