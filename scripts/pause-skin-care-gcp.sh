#!/usr/bin/env bash
# Pause Skin & Care consumer stack on GCP (no delete).
# Requires: gcloud auth login, firebase login
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SNAPSHOT="$ROOT/.gcp-pause-snapshot.json"
PROJECT="${GCP_PROJECT:-somo-callsomo}"
REGION="${GCP_REGION:-us-central1}"
FIREBASE_PROJECT="${FIREBASE_PROJECT:-somo-4ddf6}"
FIREBASE_SITE="${FIREBASE_SITE:-myskinandcare}"

echo "==> 1. Snapshot current Cloud Run settings"
node "$ROOT/scripts/write-gcp-pause-snapshot.cjs"

echo "==> 2. Pause Cloud Run (min=0, max=1, ingress=internal)"
# Note: Cloud Run rejects max-instances=0; internal ingress blocks public API traffic.
for SVC in somo-middleware face-read-inference; do
  if gcloud run services describe "$SVC" --region="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
    gcloud run services update "$SVC" \
      --region="$REGION" \
      --project="$PROJECT" \
      --min-instances=0 \
      --max-instances=1 \
      --ingress=internal
  else
    echo "    skip missing service: $SVC"
  fi
done

echo "==> 3. Stop Cloud SQL instances (if any)"
while IFS= read -r INSTANCE; do
  [[ -z "$INSTANCE" ]] && continue
  echo "    stopping $INSTANCE"
  gcloud sql instances patch "$INSTANCE" --project="$PROJECT" --activation-policy=NEVER
done < <(gcloud sql instances list --project="$PROJECT" --format='value(name)' 2>/dev/null || true)

echo "==> 4. Disable Firebase hosting ($FIREBASE_SITE)"
(cd "$ROOT/unified-dashboard" && npx firebase-tools hosting:disable --site "$FIREBASE_SITE" --project "$FIREBASE_PROJECT" --force)

echo "==> 5. Disable GitHub deploy workflows (if gh available)"
if command -v gh >/dev/null 2>&1; then
  gh workflow disable deploy-staging.yml 2>/dev/null || true
  gh workflow disable deploy-journal-production.yml 2>/dev/null || true
else
  echo "    gh not found — disable workflows manually in GitHub"
fi

node -e "
const fs=require('fs');
const p=process.argv[1];
const d=JSON.parse(fs.readFileSync(p,'utf8'));
d.pausedAt=new Date().toISOString();
d.pauseNote='max-instances=0 invalid on Cloud Run; paused with min=0 max=1 ingress=internal';
for (const s of d.services) {
  s.pausedMinInstances='0';
  s.pausedMaxInstances='1';
  s.pausedIngress='internal';
}
fs.writeFileSync(p, JSON.stringify(d,null,2)+'\n');
" "$SNAPSHOT"

echo "==> 6. Verify paused"
API_CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "https://api.callsomo.com/health/live" || echo "000")
WEB_CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "https://myskinandcare.com/" || echo "000")
echo "    api.callsomo.com/health/live -> HTTP $API_CODE (expect 404 or error)"
echo "    myskinandcare.com -> HTTP $WEB_CODE (expect 404)"
echo ""
echo "pause-skin-care-gcp: complete (snapshot: $SNAPSHOT)"
echo "Resume: ./scripts/resume-skin-care-gcp.sh"
