#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN_LIVE="${VERIFY_PROD_LIVE:-0}"
RUN_STAGING="${CONSUMER_STAGING_LIVE:-0}"

echo "==> patient-app typecheck + unit tests"
cd "$ROOT/patient-app"
npm run typecheck
npm test

echo "==> middleware consumer unit + billing tests"
cd "$ROOT/middleware-platform"
npm test -- --testPathPattern='consumer-|patient-goals|patient-consumer-profile-routes|patient-shelf-scan|home-next|insight-route|insight-schema|care-program|stripe-webhook-care|patient-journal' --runInBand

echo "==> journal UI audit E2E (stubbed consumer hosting)"
npm run test:journal-ui-audit

echo "==> v3 redesign mobile E2E"
npm run test:e2e-v3-redesign

echo "==> consumer prod-ready E2E (mocked)"
npm run test:consumer-prod-ready

echo "==> skin-age journey E2E"
npm run test:e2e-skin-age-journey

echo "==> consumer prod extra E2E (OTP, Today/Progress, billing)"
node "$ROOT/scripts/ensure-consumer-hosting-built.cjs"
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright test --config playwright.consumer-prod-extra.config.cjs

if [[ "$RUN_STAGING" == "1" ]]; then
  echo "==> staging consumer smoke (live API + journal)"
  CONSUMER_STAGING_LIVE=1 STAGING_SMOKE_OTP="${STAGING_SMOKE_OTP:-1}" npm run test:e2e:staging-smoke
fi

if [[ "$RUN_LIVE" == "1" ]]; then
  echo "==> live consumer journey"
  LIVE_JOURNEY_SKIP=0 npm run test:e2e:live-journey
  node "$ROOT/scripts/verify-consumer-hosting.cjs" --live https://myskinandcare.com
fi

echo "verify-prod-ready: all automated gates passed"
