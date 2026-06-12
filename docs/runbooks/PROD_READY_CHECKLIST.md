# Production readiness checklist — iOS + web consumer

**Last updated:** 2026-06-12

Automated gate (run locally before release):

```bash
./scripts/verify-prod-ready.sh
# Optional live tiers (operator env):
CONSUMER_STAGING_LIVE=1 ./scripts/verify-prod-ready.sh
STAGING_SMOKE_OTP=1 STAGING_DB_PATH=... CONSUMER_STAGING_LIVE=1 ./scripts/verify-prod-ready.sh
VERIFY_PROD_LIVE=1 CONSUMER_STAGING_LIVE=1 ./scripts/verify-prod-ready.sh
```

**Operator blockers before prod middleware deploy:**

- Set `STRIPE_PRICE_CARE_PROGRAM=price_...` in Cloud Run prod (currently missing on `somo-middleware`)
- Then: `./scripts/deploy-to-gcp-production.sh` and `node middleware-platform/scripts/verify-prod-consumer-env.cjs --file .env`

---

## Automated (must pass)

| Step | Command | Owner |
|------|---------|-------|
| Patient-app typecheck + vitest | `cd patient-app && npm run typecheck && npm test` | CI / dev |
| Consumer unit + billing tests | `cd middleware-platform && npm test -- --testPathPattern='consumer-|care-program|stripe-webhook-care'` | CI |
| Consumer prod-ready E2E | `npm run test:consumer-prod-ready` | CI |
| Skin-age journey E2E | `npm run test:e2e-skin-age-journey` | CI |
| Extra E2E (OTP, Home/Progress, billing) | `npm run test:e2e:consumer-prod-extra` | CI |
| Consumer env vars | `node middleware-platform/scripts/verify-prod-consumer-env.cjs --file .env` | Operator |
| Hosting bundle | `npm run build:consumer-hosting && node scripts/verify-consumer-hosting.cjs --live https://myskinandcare.com` | Operator |

---

## Manual — Apple / TestFlight

| Step | Verify with |
|------|-------------|
| Apple Developer + App Store Connect app (`com.skinandcare.app`) | [TESTFLIGHT.md](./TESTFLIGHT.md) |
| `npx eas login` + `npm run verify:release` in `patient-app` | EAS dashboard |
| First TestFlight build | `npm run build:testflight` |
| Internal testers added | TestFlight app |
| **Device smoke (8 steps)** | [device-smoke-checklist.md](../../patient-app/scripts/device-smoke-checklist.md) |
| **Web consumer smoke (10 steps)** | [WEB_CONSUMER_SMOKE.md](./WEB_CONSUMER_SMOKE.md) |
| App Store metadata (screenshots, privacy questionnaire) | App Store Connect |

---

## Manual — DNS + legal

| Step | Verify with |
|------|-------------|
| DNS: `myskinandcare.com` → consumer Firebase hosting | `curl -I https://myskinandcare.com` |
| Privacy policy live | `https://myskinandcare.com/patients/legal/privacy.html` → 200 |
| Terms live | `https://myskinandcare.com/patients/legal/terms.html` → 200 |

---

## Manual — Stripe + Cloud Run

| Step | Verify with |
|------|-------------|
| Create recurring price in Stripe Dashboard | `STRIPE_PRICE_CARE_PROGRAM=price_...` |
| Set on Cloud Run (prod) | `node scripts/verify-prod-consumer-env.cjs` |
| Webhook endpoint → `checkout.session.completed` | `stripe-webhook-care-program.test.js` |
| Consumer flags `=1` on prod (not generator defaults) | [DEPLOY_CONSUMER_V3.md](../deployment/DEPLOY_CONSUMER_V3.md) |
| Deploy middleware + hosting | `./scripts/deploy-to-gcp-production.sh` + `npm run deploy:consumer-hosting` |

---

## Post-deploy smoke

```bash
cd middleware-platform
CONSUMER_STAGING_LIVE=1 npm run test:e2e:staging-smoke
# Optional live OTP round-trip (requires STAGING_DB_PATH or STAGING_EMAIL_CODE):
STAGING_SMOKE_OTP=1 CONSUMER_STAGING_LIVE=1 npm run test:e2e:staging-smoke
npm run test:e2e:redesign-parity
```

Manual QA path: signup OTP → journey choose → routine pick → Home BFI → Scan → Verdict → Track → Progress → Account goals → Subscribe.

---

## API URLs

| Surface | Canonical API |
|---------|---------------|
| iOS TestFlight / EAS | `https://api.callsomo.com` |
| Web consumer hosting | `https://api.callsomo.com` (via `api-base.js`) |
| Alias (when DNS live) | `https://api.myskinandcare.com` |
