# Deploy Consumer v3 + Agentic Stack

## Staging smoke

1. Set Cloud Run env (see `.env.staging.example`): all consumer flags `=1`, journal flags `=1`, `REDIS_URL`, `LANGGRAPH_USE_POSTGRES=true` when Postgres available.
2. Deploy middleware; verify migrations through `059_patient_journal`.
3. Build and deploy patient-app hosting (`npm run dev:consumer-local` build pipeline).
4. Run tests:

```bash
cd middleware-platform
npm run test:consumer-prod-ready
npm run test:journal-ui-audit
LIVE_JOURNEY_SKIP=0 npm run test:e2e:live-journey
CONSUMER_STAGING_LIVE=1 STAGING_SMOKE_OTP=1 npm run test:e2e:staging-smoke
```

5. Manual QA — **journal-first path:**
   - Signup OTP → journey choose → **Keep a skin diary** → Home (not routine pick)
   - Log photo → no 503 (`JOURNAL_MODE_STANDALONE=1`)
   - Condition chips + note → saves via `PATCH /journal/daily-entry`
   - Progress → polaroid hero, sparkline metrics, photo timeline
   - Trigger insight card after multiple entries (`TRIGGER_INSIGHTS_ENABLED=1`)

6. Manual QA — **routine path (legacy):**
   - Journey choose → Improve my skin routine → routine pick → Home BFI → Scan → Verdict → Progress

## Production

1. Set prod env flags **explicitly** (generator defaults prod consumer + journal flags to `0`).
2. Set `STRIPE_PRICE_CARE_PROGRAM` on Cloud Run (non-secret env var; see `generate-cloudrun-env-yaml.cjs`).
3. Verify env: `node scripts/verify-prod-consumer-env.cjs --file .env.production`.
4. Deploy middleware (`./scripts/deploy-to-gcp-production.sh`) + hosting bundle (`npm run deploy:consumer-hosting`).
5. Run prod smoke:

```bash
cd middleware-platform
npm run test:e2e:redesign-parity
npm run test:journal-ui-audit
CONSUMER_STAGING_LIVE=1 STAGING_API_BASE=https://api.myskinandcare.com STAGING_SMOKE_OTP=1 npm run test:e2e:staging-smoke
```

6. Monitor logs for `JOURNAL_MODE_DISABLED`, `journal_photo_failed`, `TRIGGER_INSIGHTS_FAILED`, `goals_seed_failed`, `cache_miss`, `graph_unavailable`.

**Env SSOT:** `middleware-platform/scripts/verify-prod-consumer-env.cjs` — requires `FEATURE_V3_INSIGHTS=1`, `LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT=1`, `NEXT_GEN_PIPELINE=1`, `JOURNAL_MODE_STANDALONE=1`, `TRIGGER_INSIGHTS_ENABLED=1`, `IMPROVEMENTS_API_ENABLED=1`, `STRIPE_PRICE_CARE_PROGRAM`.
