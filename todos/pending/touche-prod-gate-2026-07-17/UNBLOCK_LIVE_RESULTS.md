# Phase 1 unblock — live results after deploy (2026-07-17)

## Deploy

| Item | Value |
|------|--------|
| Service | `somo-middleware` behind `api.callsomo.com` |
| Image | `gcr.io/somo-callsomo/somo-middleware:6ef6f83` (@sha256:d429f32f…) |
| Live revision | **`somo-middleware-00180-z4l` at 100%** (was stuck on `00178` — traffic was pinned; cut over explicitly) |
| Face-read inference | ingress restored `all` → revision `face-read-inference-00005-72d` |

**Root cause of earlier 404s:** traffic pinned to July 15 revision `00178`, so image deploys created `00179`/`00180` but never received traffic until `gcloud run services update-traffic --to-revisions=…00180=100`.

## Gate re-run

```text
SKIP_OTP=1 VERIFY_GCLOUD=1 npm run verify:touche-prod-capture
→ GATE PASSED
```

Evidence: `todos/pending/touche-prod-gate-2026-07-17/verify-touche-prod-capture.json`

| Check | Result |
|-------|--------|
| Medical routes | **PASS** (401 auth gate, not 404) |
| ClamAV | **PASS** — anonymous capture HTTP 201 (not `AV_NOT_CONFIGURED`) |
| Durable media | **PASS** — `storage_provider: gcs`; object live at `gs://somo-prod-patient-media-somo-callsomo/patients/.../sample1.jpg` (191831 bytes) |
| Encryption | **PASS** — resolves from **`PATIENT_RECORD_FACTS_ENCRYPTION_KEY`** via Secret Manager `patient-record-facts-encryption-key` (**not** billing / session / `dev-billing-key`) |
| Vision | **PASS** — `POST /api/public/face-read` HTTP 200 |
| Migrations 065–074 | Live write to `patient_record_facts` + pending capture path succeeded |
| OTP inbox | **Human confirm still required** (no re-send until you say the earlier mail arrived) |
| Authenticated E2E | Script ready: `npm run smoke:touche-prod-e2e` — needs OTP code or session |

## Encryption (item 2) — definitive

Before fix (live Cloud Run env):

- `PATIENT_RECORD_FACTS_ENCRYPTION_KEY`: **absent**
- `BILLING_DATA_ENCRYPTION_KEY`: **absent**
- `SESSION_SECRET`: **absent**
- **Resolved from: `literal:dev-billing-key`** ← catastrophic

After fix:

- Created Secret Manager secret `patient-record-facts-encryption-key` (random 32-byte hex)
- Bound on Cloud Run as `PATIENT_RECORD_FACTS_ENCRYPTION_KEY=secretRef:patient-record-facts-encryption-key`
- Gate evidence: `"resolvedFrom":"PATIENT_RECORD_FACTS_ENCRYPTION_KEY","valueKind":"secretRef"`

## Face-read 502 (item 3) — two independent faults

1. **`face-read-inference` had `ingress=internal`** from 2026-06-13 pause → public URL returned Google Frontend 404. Restored `ingress=all`; direct `POST /v1/face-read` → HTTP 200.
2. **Middleware env was `FACE_READ_INFERENCE_BASE_URL=http://localhost:8765`** → Node `fetch failed` / API 502. Updated to `https://face-read-inference-xrrr4znsoa-uc.a.run.app` + `FACE_READ_VISION_ENABLED=1`.
3. After traffic cutover to `00180`, `POST https://api.callsomo.com/api/public/face-read` → **HTTP 200**.

## Also fixed / noted

- Created `gs://somo-prod-patient-media-somo-callsomo` + wired `GCS_MEDIA_BUCKET` (Azure secrets were never present on this GCP host).
- Created missing `gs://somo-prod-db-somo-callsomo` (env already pointed at it; bucket 404’d — facts would not sync on SIGTERM until this existed).
- Dockerfile now installs ClamAV (`CLAMAV_BIN=clamscan`) with `ca-certificates` + `freshclam`.
- Standing gate: `verify:touche-prod-capture`; authenticated smoke: `smoke:touche-prod-e2e`.

## Your action (blocks Phase 5 handoff)

1. **OTP:** Check `richard@callsomo.com` inbox + spam for the earlier verification code. Reply with the code (or “not found — resend”), then:

```bash
cd middleware-platform
TOUCHE_PROD_OTP_EMAIL=richard@callsomo.com TOUCHE_PROD_OTP_CODE=###### \
  npm run smoke:touche-prod-e2e
```

2. Prefer future deploys with traffic to latest (avoid pinning forever to one revision), e.g. after `gcloud run deploy` run `gcloud run services update-traffic somo-middleware --to-latest`.
