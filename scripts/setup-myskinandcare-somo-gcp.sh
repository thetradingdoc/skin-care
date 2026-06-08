#!/usr/bin/env bash
# Option B: wire myskinandcare.com + api.myskinandcare.com on existing Somo GCP.
# Account: richard@callsomo.com
#   Firebase Hosting → somo-4ddf6
#   Cloud Run API     → somo-callsomo / somo-middleware
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIREBASE_PROJECT="${FIREBASE_HOSTING_PROJECT:-somo-4ddf6}"
CLOUDRUN_PROJECT="${CLOUDRUN_GCP_PROJECT:-somo-callsomo}"
CLOUDRUN_REGION="${CLOUDRUN_REGION:-us-central1}"
CLOUDRUN_SERVICE="${CLOUDRUN_SERVICE:-somo-middleware}"
API_DOMAIN="${MYSKINANDCARE_API_DOMAIN:-api.myskinandcare.com}"
GCLOUD_ACCOUNT="${GCLOUD_ACCOUNT:-richard@callsomo.com}"

if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "ERROR: gcloud is not authenticated."
  echo "  Firebase login alone is not enough — run this first (no trailing comment):"
  echo "    gcloud auth login"
  echo "  Then re-run: npm run setup:myskinandcare:somo"
  exit 1
fi

gcloud config set account "$GCLOUD_ACCOUNT"
gcloud config set project "$CLOUDRUN_PROJECT"

echo "==> Firebase Hosting site (consumer — separate from callsomo.com default site)"
cd "$ROOT/unified-dashboard"
if npx firebase-tools hosting:sites:list --project "$FIREBASE_PROJECT" --json 2>/dev/null | grep -q 'sites/myskinandcare'; then
  echo "  Site myskinandcare already exists — skipping create"
else
  npx firebase-tools hosting:sites:create myskinandcare --project "$FIREBASE_PROJECT" --non-interactive
fi
cd "$ROOT"

echo "==> Cloud Run domain mapping: $API_DOMAIN → $CLOUDRUN_SERVICE"
if ! gcloud beta run domain-mappings describe \
  --domain="$API_DOMAIN" \
  --region="$CLOUDRUN_REGION" \
  --project="$CLOUDRUN_PROJECT" >/dev/null 2>&1; then
  if ! gcloud beta run domain-mappings create \
    --service="$CLOUDRUN_SERVICE" \
    --domain="$API_DOMAIN" \
    --region="$CLOUDRUN_REGION" \
    --project="$CLOUDRUN_PROJECT"; then
    echo ""
    echo "WARN: Domain mapping failed — verify myskinandcare.com with Google first:"
    echo "  gcloud domains verify myskinandcare.com"
    echo "  (Add the TXT record Search Console shows in IONOS, then re-run this script.)"
  fi
fi

echo ""
echo "==> Required IONOS DNS (api)"
if gcloud beta run domain-mappings describe \
  --domain="$API_DOMAIN" \
  --region="$CLOUDRUN_REGION" \
  --project="$CLOUDRUN_PROJECT" \
  --format='table(metadata.name,status.conditions.status,status.resourceRecords[].name,status.resourceRecords[].rrdata)' 2>/dev/null; then
  :
else
  echo "  (mapping not active yet)"
  echo "  CNAME  api  →  ghs.googlehosted.com"
fi

echo ""
echo "==> Firebase custom domains (manual — console only)"
echo "  https://console.firebase.google.com/project/$FIREBASE_PROJECT/hosting/sites/myskinandcare"
echo "  On site **myskinandcare** (not default): add myskinandcare.com and www.myskinandcare.com"
echo ""
echo "==> Expected IONOS DNS (website) — match Firebase console if different"
echo "  A     @    →  199.36.158.100"
echo "  TXT   @    →  hosting-site=myskinandcare"
echo "  CNAME www  →  myskinandcare.web.app"
echo ""
echo "==> Deploy consumer hosting"
echo "  npm run deploy:consumer-hosting"
echo ""
echo "==> Verify"
echo "  npm run gcp:skin-care:check"
echo "  node scripts/verify-consumer-hosting.cjs --live https://myskinandcare.com"
