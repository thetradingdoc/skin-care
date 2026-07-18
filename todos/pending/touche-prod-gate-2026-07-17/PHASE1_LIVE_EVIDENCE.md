# Touche Phase 1 — Production environment gate (live evidence)

**Date:** 2026-07-17T15:44–15:46Z  
**API under test:** `https://api.callsomo.com` (TestFlight `eas.json` target)  
**Also checked:** `https://api.myskinandcare.com` → **503 Server Error**  
**Method:** Live HTTP probes + OTP send; gcloud env/schema **blocked** (auth token expired)  
**Standing gate script:** `middleware-platform/scripts/verify-touche-prod-capture.cjs`  
  (`npm run verify:touche-prod-capture --prefix middleware-platform`)

This report is production reality, not code review.

---

## Executive blocker

**The medical-tracker HTTP surface is not deployed on `api.callsomo.com`.**

| Path | Live HTTP | Body |
|------|-----------|------|
| `GET /api/patient/records/calendar` | **404** | `Endpoint not found` |
| `POST /api/patient/records/anonymous` | **404** | `Endpoint not found` |
| `POST /api/patient/records/capture` | **404** | `Endpoint not found` |
| `GET /api/patient/progress/aggregates` | **404** | `Endpoint not found` |
| `GET /api/patient/marks` | **404** | `Endpoint not found` |
| `GET /api/patient/ai/usage` | **404** | `Endpoint not found` |
| `GET /api/patient/export/physician.pdf` | **404** | `Endpoint not found` |
| `GET /api/patient/me` | **401** | `x-session-id required` (route **exists**) |
| `GET /api/patient/journal/calendar-range` | **401** | route **exists** (legacy journal) |

**Implication:** Items 1–3 (ClamAV / durable media / encryption via capture), item 6 (migrations via facts tables), and item 7 (E2E smoke) **cannot pass** until a Cloud Run revision that includes `registerPatientRecordRoutes` / medical-progress / AI monetization is actually serving this host. Local/repo code having those routes is irrelevant to TestFlight until deploy.

`GET /health` → `{"status":"ok",…}` — the API process is up; it is an **older / incomplete patient surface**.

---

## Per-item (live)

### 1. ClamAV — **FAIL / BLOCKED (cannot prove running)**

- **Evidence:** `POST /api/patient/records/anonymous` with a real JPEG returned **404 Endpoint not found**, so fail-closed AV on medical upload was **never exercised**.
- **Not proven:** ClamAV process, `CLAMAV_SOCKET` / `CLAMAV_BIN` on Cloud Run.
- **gcloud:** `gcloud run services describe` failed — *Reauthentication failed* (need `gcloud auth login`).
- **Verdict:** Treat as **not verified**. After medical routes deploy, the standing script will FAIL on `AV_NOT_CONFIGURED` if ClamAV is missing.

### 2. Durable media (not `local://`) — **FAIL / BLOCKED**

- **Evidence:** No successful upload; no `media_uri` to inspect.
- **Cannot confirm** Azure vs `local://` until capture returns a URI.
- `api.myskinandcare.com` is **503** — not an alternate healthy API.

### 3. `PATIENT_RECORD_FACTS_ENCRYPTION_KEY` — **FAIL / NOT VERIFIED (highest priority when routes land)**

- **Evidence:** No Cloud Run env dump (gcloud auth dead). No fact row to decrypt.
- **Risk named in review remains open:** if unset, code falls through to billing / `SESSION_SECRET` / `'dev-billing-key'`.
- **Next proof:** `VERIFY_GCLOUD=1 npm run verify:touche-prod-capture` after `gcloud auth login`, asserting the key name is present (script prints presence only, not the secret).

### 4. OTP email — **API PASS / INBOX UNPROVEN**

| Probe | Result |
|-------|--------|
| `POST /api/patient/verify/send` `{"email":"touche-prod-gate-probe@example.com"}` | **HTTP 200** `success:true`, `session_id` issued, message “Verification code sent…” |
| Same to `richard@callsomo.com` | **HTTP 200** `success:true`, `session_id=9fcf53b8-5d86-45eb-8ec7-4692cd80bd5d` |

- **Does not prove** the message landed in an inbox (spam, SES/SendGrid config, etc.).
- **Human required:** check `richard@callsomo.com` (and spam) for the OTP from this session around 2026-07-17 ~15:44Z.
- Earlier probe without browser-like UA returned `Request blocked` (botGuard) — real clients should send a normal User-Agent.

### 5. Vision / OpenAI (`FACE_READ_VISION_ENABLED`) — **FAIL**

| Probe | Result |
|-------|--------|
| `POST /api/public/face-read` (1×1 JPEG) | **HTTP 502** `{"success":false,"error":"fetch failed",…}` |

- Face-read handler proxies to `FACE_READ_INFERENCE_BASE_URL` first; **502 fetch failed** means inference host unreachable / TLS / crash — vision LLM branch never proven.
- Flag `FACE_READ_VISION_ENABLED` **not** observable via this response.
- **Verdict:** Vision E2E against production **does not work** right now.

### 6. Migrations 065–074 — **FAIL / NOT VERIFIED**

- No SQL access; medical routes 404 strongly suggest the **running revision may predate** the medical-tracker migrations entirely.
- **Required next:** after deploy, query `schema_migrations` for versions `065`…`074` (or table existence: `patient_record_facts`, `ai_capture_usage`, `pending_captures`, …).

### 7. E2E smoke (capture → confirm → Calendar → Progress → physician PDF) — **FAIL / BLOCKED**

- Impossible against current prod: capture/calendar/progress/export all **404**.
- Legacy journal path exists (401 without session) — not the facts SSOT TestFlight app expects.

### 8. Standing script `verify:touche-prod-capture` — **BUILT + RUN**

```bash
cd middleware-platform
SKIP_OTP=1 npm run verify:touche-prod-capture
# after gcloud auth:
# VERIFY_GCLOUD=1 TOUCHE_PROD_OTP_EMAIL=you@domain.com npm run verify:touche-prod-capture
```

Live run exits **non-zero** with FAILs matching the above (routes 404, vision 502, encryption unverified, e2e blocked). Evidence JSON under `todos/pending/touche-prod-gate-YYYY-MM-DD/`.

---

## What works on this host today

- `/health`, `/health/ready`, `/health/live`
- Patient auth OTP **send API** (200 success claims)
- Some legacy patient routes (`/me`, journal calendar-range) auth-gated
- Public face-read **route exists** but upstream fetch **502**

## What must happen before TestFlight can use this API honestly

1. **Deploy** skin-and-care middleware revision that registers medical-tracker routes to the service behind `api.callsomo.com`.
2. Re-run `npm run verify:touche-prod-capture` until critical checks PASS.
3. `gcloud auth login` + `VERIFY_GCLOUD=1` for encryption / ClamAV / Azure env presence.
4. Human confirms OTP inbox delivery.
5. Fix face-read inference (`FACE_READ_INFERENCE_BASE_URL` healthy) and confirm vision flag.
6. Only then run authenticated capture→PDF smoke.

---

## Honesty note

I did **not** invent “ClamAV is fine” or “encryption is set.” Those are **unverified**. The strongest live proof from this session is negative: **medical capture APIs are missing on the TestFlight API host**, so the app’s new facts/orchestration path cannot succeed in production until deploy.
