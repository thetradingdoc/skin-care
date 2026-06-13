#!/usr/bin/env bash
# Journal-first staging → production deploy (run after: gcloud auth login && firebase login --reauth)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MP="$ROOT/middleware-platform"

echo "==> 1. Local preflight"
bash "$ROOT/scripts/verify-prod-ready.sh"

echo "==> 2. Staging middleware deploy (journal flags in middleware-platform/.env)"
CLOUDRUN_PROFILE=staging "$ROOT/scripts/deploy-to-gcp.sh"
curl -fsS "https://api.callsomo.com/health/live" | grep -q alive

echo "==> 3. Staging live smoke + journal API"
cd "$MP"
CONSUMER_STAGING_LIVE=1 STAGING_SMOKE_OTP="${STAGING_SMOKE_OTP:-1}" npm run test:e2e:staging-smoke

echo "==> 4. Prod env verify"
node "$MP/scripts/verify-prod-consumer-env.cjs" --file "$MP/.env.production"

echo "==> 5. Production middleware"
"$ROOT/scripts/deploy-to-gcp-production.sh"

echo "==> 6. Consumer hosting"
cd "$ROOT"
npm run build:consumer-hosting
npm run verify:consumer-hosting
npm run deploy:consumer-hosting
node scripts/verify-consumer-hosting.cjs --live https://myskinandcare.com

echo "==> 7. Post-deploy smoke"
cd "$MP"
CONSUMER_STAGING_LIVE=1 STAGING_API_BASE=https://api.myskinandcare.com npm run test:e2e:staging-smoke
npm run test:e2e:redesign-parity
npm run test:journal-ui-audit
VERIFY_PROD_LIVE=1 CONSUMER_STAGING_LIVE=1 bash "$ROOT/scripts/verify-prod-ready.sh"

echo "==> 8. TestFlight (patient-app)"
cd "$ROOT/patient-app"
npm run verify:testflight
echo "Run: npm run build:testflight — then device-smoke-checklist.md + APP_STORE_SUBMISSION.md"

echo "journal-first-deploy: complete"
