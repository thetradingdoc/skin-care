# Expo Go — test Skin & Care on your iPhone (no TestFlight)

Use this path first. You do **not** need Apple Developer, TestFlight, or EAS builds.

The app runs inside **Expo Go** and talks to production API `https://api.callsomo.com`.

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
3. Fresh install → **onboarding** (scan → reveal → concerns → signup) → Today.

## Onboarding test checklist

| Step | Screen | Verify |
|------|--------|--------|
| 1 | `onboarding/scan` | Camera permission; capture or **Skip for now** |
| 2 | `onboarding/reveal` | Skin age number shown (mock if `EXPO_PUBLIC_FACE_READ_MOCK=1`) |
| 3 | `onboarding/concerns` | Chips load; pick 1–2; continue |
| 4 | `onboarding/signup` | Email OTP → lands on Today with celebrate + photo prompt |
| 5 | Today | Day 1 overlay; log photo dismisses overlay; Account tab appears after first photo |

**Mock face-read (no GPU):** add to `patient-app/.env`:

```bash
EXPO_PUBLIC_FACE_READ_MOCK=1
```

Restart: `npx expo start --clear`.

**Smoke test (middleware + optional teamkelly):**

```bash
node patient-app/scripts/smoke-face-read.cjs
```

Set `FACE_READ_INFERENCE_BASE_URL=http://127.0.0.1:8765` in middleware `.env` for real inference.

## Returning user

Sign in from Account or `sign-in` route — skips onboarding if session + template exist.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Network request failed | Confirm `.env` has `https://api.callsomo.com`, restart with `npx expo start --clear` |
| QR won't connect | Use `npm run start:device` (tunnel) |
| Stale login after URL change | Account tab → Sign out, sign in again |
| Camera permission | iOS Settings → Expo Go → Camera |

## When you are ready for TestFlight

See `docs/runbooks/TESTFLIGHT.md` — requires Apple Developer ($99/yr) and EAS cloud build.
