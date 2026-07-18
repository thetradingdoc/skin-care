#!/usr/bin/env bash
# APP-01 — Run any `gcloud run …` mutating command, then assert serving == latest created.
#
# Universal guard for ad hoc Cloud Run config changes (secrets, env, memory, traffic).
# The deploy script covers image digests; this wrapper covers services update / deploy /
# update-traffic paths that historically left 100% traffic on a prior revision.
#
# Usage:
#   ./scripts/gcloud-run-with-serving-assert.sh services update somo-middleware \
#     --region=us-central1 --update-secrets=UPLOAD_TOKEN_SECRET=upload-token-secret:latest
#
#   ./scripts/gcloud-run-with-serving-assert.sh services update-traffic somo-middleware \
#     --region=us-central1 --to-revisions=REV=100
#
# Env: GCP_PROJECT / CLOUDRUN_GCP_PROJECT, GCP_REGION / CLOUDRUN_REGION, CLOUDRUN_SERVICE
# Bypass (emergency only): SKIP_SERVING_DIGEST_ASSERT=1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/cloudrun-deploy-env.sh
source "$ROOT/scripts/lib/cloudrun-deploy-env.sh"

PROJECT="${GCP_PROJECT:-$CLOUDRUN_GCP_PROJECT}"
REGION="${GCP_REGION:-$CLOUDRUN_REGION}"
SERVICE="${CLOUDRUN_SERVICE}"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <gcloud-run-args...>   (gcloud run is prepended)" >&2
  echo "Example: $0 services update \$SERVICE --region=\$REGION --update-env-vars=FOO=bar" >&2
  exit 2
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "ERROR: gcloud CLI not found" >&2
  exit 1
fi

echo "==> gcloud run $*"
gcloud run "$@" --project="$PROJECT"

if [[ "${SKIP_SERVING_DIGEST_ASSERT:-}" == "1" ]]; then
  echo "WARNING: SKIP_SERVING_DIGEST_ASSERT=1 — not asserting serving revision"
  exit 0
fi

# Prefer service name from args when present (services update|deploy|update-traffic SERVICE)
SVC_ARG=""
prev=""
for a in "$@"; do
  if [[ "$prev" == "update" || "$prev" == "deploy" || "$prev" == "update-traffic" || "$prev" == "describe" ]]; then
    if [[ "$a" != -* ]]; then
      SVC_ARG="$a"
      break
    fi
  fi
  prev="$a"
done
SERVICE_RESOLVED="${SVC_ARG:-$SERVICE}"

echo "==> APP-01 assert: latestCreated must receive 100% traffic ($SERVICE_RESOLVED)"
GCP_PROJECT="$PROJECT" GCP_REGION="$REGION" CLOUDRUN_SERVICE="$SERVICE_RESOLVED" \
  node "$ROOT/scripts/assert-cloudrun-serving-digest.cjs" \
    --project "$PROJECT" --region "$REGION" --service "$SERVICE_RESOLVED" \
    --require-latest-serving
