#!/usr/bin/env bash
# Resume Skin & Care consumer stack from .gcp-pause-snapshot.json (no redeploy required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SNAPSHOT="$ROOT/.gcp-pause-snapshot.json"
PROJECT="${GCP_PROJECT:-somo-callsomo}"
REGION="${GCP_REGION:-us-central1}"
FIREBASE_PROJECT="${FIREBASE_PROJECT:-somo-4ddf6}"
FIREBASE_SITE="${FIREBASE_SITE:-myskinandcare}"
ENABLE_WORKFLOWS="${ENABLE_WORKFLOWS:-1}"

if [[ ! -f "$SNAPSHOT" ]]; then
  echo "ERROR: Missing $SNAPSHOT — run ./scripts/pause-skin-care-gcp.sh first or restore snapshot manually."
  exit 1
fi

read_setting() {
  node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
const svc=d.services.find(s=>s.name===process.argv[2]);
if (!svc) process.exit(1);
console.log([svc.minInstances, svc.maxInstances, svc.ingress].join('\t'));
" "$SNAPSHOT" "$1"
}

echo "==> 1. Enable Firebase hosting ($FIREBASE_SITE)"
(cd "$ROOT/unified-dashboard" && npx firebase-tools hosting:enable --site "$FIREBASE_SITE" --project "$FIREBASE_PROJECT")

echo "==> 2. Restore Cloud Run services from snapshot"
for SVC in somo-middleware face-read-inference; do
  if ! gcloud run services describe "$SVC" --region="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
    echo "    skip missing service: $SVC"
    continue
  fi
  IFS=$'\t' read -r MIN MAX INGRESS <<< "$(read_setting "$SVC")"
  echo "    $SVC min=$MIN max=$MAX ingress=$INGRESS"
  gcloud run services update "$SVC" \
    --region="$REGION" \
    --project="$PROJECT" \
    --min-instances="$MIN" \
    --max-instances="$MAX" \
    --ingress="$INGRESS"
done

echo "==> 3. Start Cloud SQL instances (if listed in snapshot)"
SQL_LIST=$(node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log((d.cloudSqlInstances||[]).join('\n'));" "$SNAPSHOT")
while IFS= read -r INSTANCE; do
  [[ -z "$INSTANCE" ]] && continue
  echo "    starting $INSTANCE"
  gcloud sql instances patch "$INSTANCE" --project="$PROJECT" --activation-policy=ALWAYS
done <<< "$SQL_LIST"

if [[ "$ENABLE_WORKFLOWS" == "1" ]] && command -v gh >/dev/null 2>&1; then
  echo "==> 4. Re-enable GitHub deploy workflows"
  gh workflow enable deploy-staging.yml 2>/dev/null || true
  gh workflow enable deploy-journal-production.yml 2>/dev/null || true
else
  echo "==> 4. Skipping GitHub workflows (ENABLE_WORKFLOWS=$ENABLE_WORKFLOWS)"
fi

node -e "
const fs=require('fs');
const p=process.argv[1];
const d=JSON.parse(fs.readFileSync(p,'utf8'));
d.resumedAt=new Date().toISOString();
fs.writeFileSync(p, JSON.stringify(d,null,2)+'\n');
" "$SNAPSHOT"

echo "==> 5. Verify resumed"
curl -fsS "https://api.callsomo.com/health/live" | grep -q alive && echo "    api.callsomo.com health: OK" || echo "    api.callsomo.com health: not ready yet (cold start)"
curl -sS -o /dev/null -w "    myskinandcare.com -> HTTP %{http_code}\n" --max-time 15 "https://myskinandcare.com/" || true
echo ""
echo "resume-skin-care-gcp: complete"
echo "If website is stale, run: npm run deploy:consumer-hosting"
