# Follow-up — Cloud Run traffic must match latest revision / built image (APP-01)

**Status:** **partially fixed** (2026-07-17/18) — deploy script + ad hoc wrapper + latest-serving assert.  
**Not a kernel-level universal guard:** raw `gcloud run …` outside the wrapper can still leave traffic on an old revision.

## Gap (still true for bare gcloud)

`gcloud run deploy` / `gcloud run services update` can report success while **100% traffic stays on a prior revision**. `/health` still passes on the old revision.

Observed repeatedly 2026-07-17 (Step 9) and again 2026-07-18 when binding `UPLOAD_TOKEN_SECRET`: new revision **`00193-v5p`** created; traffic remained on **`00192-rh9`** until manual `update-traffic`.

## What is enforced in-repo now

| Path | Guard |
|------|--------|
| `./scripts/deploy-to-gcp.sh` (prod/staging deploy) | Post-deploy digest assert via `assert-cloudrun-serving-digest.cjs` |
| Ad hoc config (secrets, env, memory, traffic) | **`./scripts/gcloud-run-with-serving-assert.sh`** — runs `gcloud run …` then `--require-latest-serving` |
| Assert alone | `node scripts/assert-cloudrun-serving-digest.cjs --require-latest-serving` (fails if `latestCreated ≠ traffic@100%`) |

## Required discipline (cannot skip)

After **any** mutating Cloud Run command that is **not** run through the wrapper or deploy script:

```bash
# Prefer the wrapper:
./scripts/gcloud-run-with-serving-assert.sh services update somo-middleware \
  --region=us-central1 --update-secrets=FOO=bar:latest

# Or, if you already ran bare gcloud:
node scripts/assert-cloudrun-serving-digest.cjs --require-latest-serving
# If FAIL LATEST_CREATED_NOT_SERVING:
gcloud run services update-traffic somo-middleware --region=us-central1 \
  --to-revisions=LATEST_CREATED=100
node scripts/assert-cloudrun-serving-digest.cjs --require-latest-serving
```

Emergency bypass only: `SKIP_SERVING_DIGEST_ASSERT=1` (never for production ops as policy).

## Why a true universal guard is not feasible today

GCP does not run our assert as a platform policy on every `gcloud` invocation. Options that would be universal (org policy, Cloud Build-only mutations, custom binary wrapping `gcloud` on every laptop) are out of scope for this wave. **Enforce via wrapper + agent rule + this doc.**

## Agent / human rule

See `.cursor/rules/cloudrun-serving-assert.mdc` — any agent or human changing Cloud Run config must use the wrapper or run the assert before reporting success.
