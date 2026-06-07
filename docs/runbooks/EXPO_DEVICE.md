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
3. Sign in with email OTP.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Network request failed | Confirm `.env` has `https://api.callsomo.com`, restart with `npx expo start --clear` |
| QR won't connect | Use `npm run start:device` (tunnel) |
| Stale login after URL change | Account tab → Sign out, sign in again |
| Camera permission | iOS Settings → Expo Go → Camera |

## When you are ready for TestFlight

See `docs/runbooks/TESTFLIGHT.md` — requires Apple Developer ($99/yr) and EAS cloud build.
