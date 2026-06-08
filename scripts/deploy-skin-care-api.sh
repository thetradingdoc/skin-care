#!/usr/bin/env bash
# Deploy middleware API to Skin & Care GCP (api.myskinandcare.com).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/skin-care-deploy-env.sh
source "$ROOT/scripts/lib/skin-care-deploy-env.sh"

export USE_GCP_SECRETS="${USE_GCP_SECRETS:-1}"
export CLOUDRUN_PROFILE="${CLOUDRUN_PROFILE:-staging}"

echo "Deploying API to ${CLOUDRUN_GCP_PROJECT} → ${CLOUDRUN_API_HOST}"
"$ROOT/scripts/deploy-to-gcp.sh"

echo ""
echo "Map domain (if not done):"
echo "  gcloud beta run domain-mappings create --service=${CLOUDRUN_SERVICE} \\"
echo "    --domain=api.myskinandcare.com --region=${CLOUDRUN_REGION} --project=${CLOUDRUN_GCP_PROJECT}"
