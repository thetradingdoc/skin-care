# Touche prod capture gate

- API: https://api.callsomo.com
- At: 2026-07-17T16:10:36.692Z
- PASS 14 · WARN 2 · FAIL 0

- **PASS** `health`: API /health ok
- **PASS** `route:/api/patient/records/calendar`: Mounted (auth gate HTTP 401)
- **PASS** `route:/api/patient/progress/aggregates`: Mounted (auth gate HTTP 401)
- **PASS** `route:/api/patient/marks`: Mounted (auth gate HTTP 401)
- **PASS** `route:/api/patient/ai/usage`: Mounted (auth gate HTTP 401)
- **PASS** `route:/api/patient/export/physician.pdf`: Mounted (auth gate HTTP 401)
- **PASS** `clamav`: Anonymous capture accepted (AV did not fail-closed as AV_NOT_CONFIGURED)
- **PASS** `media`: Durable GCS media observed
- **PASS** `encryption_key`: Facts cipher resolves from PATIENT_RECORD_FACTS_ENCRYPTION_KEY (secretRef); value not printed
- **PASS** `clamav_env`: CLAMAV_SOCKET or CLAMAV_BIN present on Cloud Run
- **PASS** `media_env`: GCS_MEDIA_BUCKET set (somo-prod-patient-media-somo-callsomo)
- **PASS** `vision_env`: FACE_READ_VISION_ENABLED=1
- **WARN** `otp_email`: SKIP_OTP=1 — email side effect skipped
- **PASS** `vision`: Face-read HTTP 200 — inspect face_read payload for vision vs CV-only
- **PASS** `migrations_065_074`: Live write succeeded (patient_record_facts + pending_captures path) — tables from migrations 065–074 are present on the running prod DB
- **WARN** `e2e_smoke`: Routes mounted — full authenticated smoke not run in this script (needs session). Use patient OTP session next.
