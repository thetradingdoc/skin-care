# Environment and database SSOT

**Last updated:** 2026-06-11

Single source of truth for which API host and SQLite file each environment uses. **Local dev must never call production API or production/staging GCS buckets.**

## Matrix

| Layer | Local dev | Staging (Cloud Run) | Production |
|-------|-----------|---------------------|------------|
| Patient UI | `http://127.0.0.1:5194/app` (static + `/api` proxy) | `https://myskinandcare.com/app` | same |
| API host | `http://127.0.0.1:4000` (via same-origin `/api` proxy) | `https://api.callsomo.com` (`STAGING=1`) | `https://api.callsomo.com` (`STAGING=0`) |
| SQLite file | `middleware-dev.db` | `middleware-staging.db` | `middleware-prod.db` |
| GCS durability | none | `somo-staging-db-somo-callsomo` | `somo-prod-db-somo-callsomo` |
| Consumer build | `hosting-dist-consumer-local` (relative `/api`) | `hosting-dist-consumer` | same as staging deploy target |

## Rules

1. **Local:** `DB_PATH=./middleware-dev.db` when running middleware. Use `npm run dev:consumer-local` for patient web UI — never serve `hosting-dist-consumer` (production API baked in) on localhost.
2. **Staging deploy:** `./scripts/deploy-to-gcp.sh` with `CLOUDRUN_PROFILE=staging` → staging DB + bucket.
3. **Production deploy:** `./scripts/deploy-to-gcp-production.sh` → prod DB + bucket; sets `STAGING=0` on image deploy.
4. **Consumer Firebase deploy:** `npm run deploy:consumer-hosting` only deploys UI static assets; API remains Cloud Run.

## Commands

```bash
# Terminal 1 — local API + dev DB
cd middleware-platform && DB_PATH=./middleware-dev.db npm run dev

# Terminal 2 — local patient app (v3) with API proxy
npm run dev:consumer-local

# Verify local stack
npm run verify:local-consumer-dev

# Production patient UI (real OTP, production API/DB)
npm run deploy:consumer-hosting
# → https://myskinandcare.com/app/sign-in
```

## Deploy scripts and env vars

| Script | Profile | `DB_PATH` | `GCS_DB_BUCKET` |
|--------|---------|-----------|---------------|
| `scripts/deploy-to-gcp.sh` | staging (default) | `/var/data/middleware-staging.db` | `somo-staging-db-somo-callsomo` |
| `scripts/deploy-to-gcp-production.sh` | production | `/var/data/middleware-prod.db` | `somo-prod-db-somo-callsomo` |
| `middleware-platform/scripts/generate-cloudrun-env-yaml.cjs` | per `CLOUDRUN_PROFILE` | same as above | same as above |

## Build outputs

| Script | Output dir | API URL in bundle |
|--------|------------|-------------------|
| `npm run build:consumer-hosting` | `unified-dashboard/hosting-dist-consumer` | `https://api.callsomo.com` |
| `npm run build:consumer-hosting-local` | `unified-dashboard/hosting-dist-consumer-local` | relative `/api` (proxied) |

## Related docs

- [OPERATIONS.md](./OPERATIONS.md) — schema and migrations
- [../runbooks/EXPO_DEVICE.md](../runbooks/EXPO_DEVICE.md) — Expo Go + local web patient app
