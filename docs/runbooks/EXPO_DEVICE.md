# Expo Go — test Skin & Care on your iPhone (no TestFlight)

Use this path first. You do **not** need Apple Developer, TestFlight, or EAS builds.

**Last reviewed:** 2026-06-12

The native app runs inside **Expo Go** and talks to production API `https://api.callsomo.com` (same middleware as `https://api.myskinandcare.com`).

## 1. Install Expo Go on iPhone

App Store → search **Expo Go** → install.

## 2. Configure API URL

Run one command at a time:

```bash
cd patient-app
cp .env.example .env
```

Edit `.env` — for production API on your phone, use:

```bash
EXPO_PUBLIC_API_BASE_URL=https://api.callsomo.com
```

Verify:

```bash
npm run verify:expo
```

## 3. Start dev server

Same Wi‑Fi as your Mac (simplest):

```bash
npm start
```

If QR scan fails or you are on different networks, use tunnel:

```bash
npm run start:device
```

## 4. Open on iPhone

1. Open **Camera** app → scan the QR code in the terminal (or Expo Dev Tools in browser).
2. Tap the banner → opens **Expo Go** with Skin & Care.
3. Fresh install → **sign-in** (OTP). New users: complete web funnel at `myskinandcare.com/scan` first.

## Onboarding test checklist

| Step | Screen | Verify |
|------|--------|--------|
| 1 | `onboarding/scan` | Camera permission; capture or **Skip for now** |
| 2 | `onboarding/reveal` | Findings + score row, or retry tips if vision empty (parity with web `/reveal`) |
| 3 | `onboarding/concerns` | Chips load; pick 1–2; continue |
| 4 | `onboarding/signup` | Email OTP → lands on Home with celebrate + photo prompt |
| 5 | Today | Day 1 overlay; log photo dismisses overlay; Account tab appears after first photo |

**Face-read (GPU):** middleware must have `FACE_READ_INFERENCE_BASE_URL` (teamkelly). See [FACE_READ_INFERENCE.md](FACE_READ_INFERENCE.md).

Restart Expo after `.env` changes: `npx expo start --clear`.

**Smoke test (middleware + teamkelly):**

```bash
node patient-app/scripts/smoke-face-read.cjs
```

Set `FACE_READ_INFERENCE_BASE_URL=http://127.0.0.1:8765` in middleware `.env` for real inference.

## Returning user

Sign in from Account or `sign-in` route — skips onboarding if session + template exist.

## Local web patient app (v3) — `npm run dev:consumer-local`

Use this for **local sign-in and v3 tab testing** against `middleware-dev.db` only (never production API/DB).

**Terminal 1 — middleware:**

```bash
cd middleware-platform
DB_PATH=./middleware-dev.db npm run dev
```

**Terminal 2 — static UI + `/api` proxy:**

```bash
npm run dev:consumer-local
```

Open **http://127.0.0.1:5194/app/sign-in**. API calls go to same-origin `/api/...` and are proxied to `http://127.0.0.1:4000`.

**Verify:**

```bash
npm run verify:local-consumer-dev
```

**Do not** serve `hosting-dist-consumer` (production build) on localhost — it calls `api.callsomo.com` and fails CORS with "Failed to fetch". See [ENV_AND_DB_SSOT.md](../Database/ENV_AND_DB_SSOT.md).

**Expo web hot reload (alternative):**

```bash
cd patient-app
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:4000 npx expo start --web
```

## Web mobile sign-in (`/app/sign-in`) — production

The Expo web bundle is hosted at **`https://www.myskinandcare.com/app/sign-in`** (mobile Safari/Chrome). It is **not** the same as Expo Go — it runs in the browser and calls `https://api.callsomo.com` cross-origin.

**Pre-deploy / production smoke:**

```bash
node scripts/verify-consumer-hosting.cjs --live https://www.myskinandcare.com
```

This verifies MaterialIcons fonts, landing pages, and **CORS preflight** for `POST /api/patient/verify/send` from `myskinandcare.com`.

**Automated tests:**

```bash
npm run test:e2e-consumer-sign-in --prefix middleware-platform
```

Includes OTP UI flow (mocked API) in `e2e/consumer-sign-in-otp.spec.cjs`. Live CORS-only check:

```bash
CONSUMER_SIGNIN_LIVE=1 npm run test:e2e-consumer-sign-in --prefix middleware-platform
```

**If sign-in fails in mobile browser:**

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Console: CORS / preflight blocked | Middleware missing `myskinandcare.com` in allowlist | `./scripts/deploy-to-gcp-production.sh`, then re-run live verify |
| `Request blocked` in API response | `botGuard` (curl-like UA) — rare in real browsers | Use Safari/Chrome; do not test OTP with bare `curl` |
| Network request failed | Wrong API URL in stale hosting bundle | `npm run build:consumer-hosting` + `npm run deploy:consumer-hosting` |
| Code sent but no email | Production middleware missing Azure/SMTP — API used to return fake `success` | Set `AZURE_COMMUNICATION_CONNECTION_STRING` + `AZURE_EMAIL_SENDER` on Cloud Run: `bash scripts/configure-cloudrun-patient-email.sh`, then `node scripts/verify-patient-otp-email-live.cjs` |
| API says "We could not send email right now" | Email not configured on Cloud Run | Same as above; see `todos/pending/PRODUCTION_READINESS_TASKS.md` § Azure Email |
| `setValueWithKeyAsync is not a function` after Continue | Expo web `SecureStore` shim missing in static export | Fixed in `patient-app/lib/patient-session.ts` (localStorage fallback); rebuild + redeploy consumer hosting |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Network request failed (Expo Go) | Confirm `.env` has `https://api.callsomo.com`, restart with `npx expo start --clear` |
| Failed to fetch on `localhost:5194` | Production API build on local static server — use `npm run dev:consumer-local` instead |
| QR won't connect | Use `npm run start:device` (tunnel) |
| Stale login after URL change | Account tab → Sign out, sign in again |
| Camera permission | iOS Settings → Expo Go → Camera |

## When you are ready for TestFlight

See `docs/runbooks/TESTFLIGHT.md` — requires Apple Developer ($99/yr) and EAS cloud build.
