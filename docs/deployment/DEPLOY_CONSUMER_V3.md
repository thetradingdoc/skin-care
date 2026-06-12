# Deploy Consumer v3 + Agentic Stack

## Staging smoke

1. Set Cloud Run env (see `.env.staging.example`): all consumer flags `=1`, `REDIS_URL`, `LANGGRAPH_USE_POSTGRES=true` when Postgres available.
2. Deploy middleware; verify migrations `057_patient_goals` / `0003_patient_goals.sql`.
3. Build and deploy patient-app hosting (`npm run dev:consumer-local` build pipeline).
4. Run tests:

```bash
cd middleware-platform
npm run test:consumer-prod-ready
LIVE_JOURNEY_SKIP=0 npm run test:e2e:live-journey
CONSUMER_STAGING_LIVE=1 npm run test:e2e:staging-smoke
```

5. Manual QA: signup OTP → journey choose → routine pick → Home BFI → Scan → Verdict insight → Track timeline → Progress → Account goals.

## Production

1. Set prod env flags **explicitly** (generator defaults prod consumer flags to `0`).
2. Set `STRIPE_PRICE_CARE_PROGRAM` on Cloud Run (non-secret env var; see `generate-cloudrun-env-yaml.cjs`).
3. Verify env: `node scripts/verify-prod-consumer-env.cjs --file .env.production`.
4. Deploy middleware (`./scripts/deploy-to-gcp-production.sh`) + hosting bundle (`npm run deploy:consumer-hosting`).
5. Run prod smoke:

```bash
cd middleware-platform
npm run test:e2e:redesign-parity
CONSUMER_STAGING_LIVE=1 STAGING_API_BASE=https://api.myskinandcare.com npm run test:e2e:staging-smoke
```

6. Monitor logs for `goals_seed_failed`, `cache_miss`, `graph_unavailable`.

**Env SSOT:** `middleware-platform/scripts/verify-prod-consumer-env.cjs` — requires `FEATURE_V3_INSIGHTS=1`, `LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT=1`, `NEXT_GEN_PIPELINE=1`, `STRIPE_PRICE_CARE_PROGRAM`.
