#!/usr/bin/env bash
# Point Cloud Run middleware at teamkelly (GPU face-read inference).
#
# Usage:
#   FACE_READ_INFERENCE_BASE_URL=https://YOUR-VM:8765 npm run configure:face-read-inference
#   npm run configure:face-read-inference -- https://YOUR-VM:8765
#
# Local dev (middleware .env):
#   FACE_READ_INFERENCE_BASE_URL=http://127.0.0.1:8765
#
# See docs/runbooks/FACE_READ_INFERENCE.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/cloudrun-deploy-env.sh
source "$ROOT/scripts/lib/cloudrun-deploy-env.sh"

BASE="${FACE_READ_INFERENCE_BASE_URL:-${1:-}}"
BASE="${BASE%/}"

if [[ -z "$BASE" ]]; then
  echo "ERROR: Set FACE_READ_INFERENCE_BASE_URL or pass the inference base URL as the first argument."
  echo "  Example: FACE_READ_INFERENCE_BASE_URL=https://34.123.45.67:8765 npm run configure:face-read-inference"
  exit 1
fi

if [[ ! "$BASE" =~ ^https?:// ]]; then
  echo "ERROR: URL must start with http:// or https:// (got: $BASE)"
  exit 1
fi

if [[ "$BASE" =~ ^https?://(127\.0\.0\.1|localhost)(:|/|$) ]]; then
  echo "ERROR: localhost/127.0.0.1 does not work on Cloud Run (each container is isolated)."
  echo "       Use a reachable GPU host (public HTTPS or VPC internal IP)."
  echo "       Current broken prod value was: http://localhost:8765"
  exit 1
fi

GCLOUD_ACCOUNT="${GCLOUD_ACCOUNT:-richard@callsomo.com}"
GCP_PROJECT="${GCP_PROJECT:-$CLOUDRUN_GCP_PROJECT}"
REGION="${GCP_REGION:-$CLOUDRUN_REGION}"
SERVICE="${CLOUDRUN_SERVICE:-somo-middleware}"

if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "ERROR: gcloud not authenticated. Run: gcloud auth login"
  exit 1
fi

gcloud config set account "$GCLOUD_ACCOUNT" >/dev/null
gcloud config set project "$GCP_PROJECT" >/dev/null

echo "==> Health-check inference at $BASE"
if curl -fsS --max-time 8 "${BASE}/health" >/dev/null 2>&1; then
  echo "    OK — /health reachable"
else
  echo "WARN: ${BASE}/health not reachable from this machine."
  echo "      Cloud Run must reach it too (firewall, HTTPS, or internal IP + VPC — see runbook)."
  if [[ "${FORCE_FACE_READ_CONFIGURE:-}" != "1" ]]; then
    echo "      Re-run with FORCE_FACE_READ_CONFIGURE=1 to update Cloud Run anyway."
    exit 1
  fi
fi

echo "==> Update Cloud Run $SERVICE ($GCP_PROJECT / $REGION)"
gcloud run services update "$SERVICE" \
  --region="$REGION" \
  --project="$GCP_PROJECT" \
  --update-env-vars "FACE_READ_INFERENCE_BASE_URL=${BASE}"

echo ""
echo "==> Smoke test (public API)"
API_BASE="${MYSKINANDCARE_API_HOST:-https://api.callsomo.com}"
echo "    API_BASE_URL=$API_BASE node patient-app/scripts/smoke-face-read.cjs"
API_BASE_URL="$API_BASE" node "$ROOT/patient-app/scripts/smoke-face-read.cjs" || true

echo ""
echo "Done. FACE_READ_INFERENCE_BASE_URL=$BASE on $SERVICE"
