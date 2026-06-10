#!/usr/bin/env bash
# Deploy face-read inference to Cloud Run (CPU OpenCV DNN).
#
# Usage: npm run deploy:face-read-inference
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/cloudrun-deploy-env.sh
source "$ROOT/scripts/lib/cloudrun-deploy-env.sh"

PROJECT="${GCP_PROJECT:-$CLOUDRUN_GCP_PROJECT}"
REGION="${GCP_REGION:-$CLOUDRUN_REGION}"
SERVICE="${FACE_READ_CLOUDRUN_SERVICE:-face-read-inference}"
IMAGE="gcr.io/${PROJECT}/${SERVICE}:$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M)"
GCLOUD_ACCOUNT="${GCLOUD_ACCOUNT:-richard@callsomo.com}"

gcloud config set account "$GCLOUD_ACCOUNT" >/dev/null
gcloud config set project "$PROJECT" >/dev/null

echo "==> Build $IMAGE"
gcloud builds submit "$ROOT/inference/face-read" --tag "$IMAGE" --project "$PROJECT"

echo "==> Deploy Cloud Run $SERVICE"
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --project "$PROJECT" \
  --platform managed \
  --allow-unauthenticated \
  --no-invoker-iam-check \
  --memory 2Gi \
  --cpu 2 \
  --timeout 120 \
  --concurrency 4 \
  --min-instances 0 \
  --max-instances 3 \
  --port 8080

URL="$(gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" --format='value(status.url)')"
echo ""
echo "Inference URL: $URL"
echo "Wire middleware:"
echo "  FACE_READ_INFERENCE_BASE_URL=$URL npm run configure:face-read-inference"
