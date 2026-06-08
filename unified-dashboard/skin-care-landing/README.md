# Skin & Care landing

Minimal consumer marketing SPA for **Skin & Care** — served at `http://localhost:4000/` and production consumer hosts.

## Web-first skin age funnel

| Route | Step |
|-------|------|
| `/` | Landing — split hero, brand nav, three feature columns |
| `/scan` | Camera / upload → face-read (no account) |
| `/reveal` | Skin age estimate |
| `/concerns` | Pick concerns → funnel match |
| `/patients/patient-login.html?intent=signup&from=skin-age-landing` | OTP signup → dashboard |

Pre-signup state lives in **`sessionStorage`** (`sc_onboarding_*` keys). After OTP, [`skin-age-journey.js`](../assets/js/skin-age-journey.js) activates the routine template and clears storage.

**Native app:** returning users only (sign-in). New users start at `/scan` on the web.

## Brand (logo + favicon)

Consumer landing uses the **tulip wordmark** (`skin` + tulip + `care`) — live React text + SVG, not a baked PNG.

| Item | Location |
|------|----------|
| Wordmark component | `src/components/DoveIcon.jsx` — `LogoWordmark` |
| Tulip SVG (SSOT) | `../assets/brand/tulip-mark.svg` |
| Favicon | `public/favicon.svg` |
| Full spec | [`docs/Brand/LOGO_AND_ICON_SSOT.md`](../../docs/Brand/LOGO_AND_ICON_SSOT.md) |

Checkout and provider surfaces still use the **panda mark** — see the same doc.

## Build

```bash
cd unified-dashboard/skin-care-landing && npm install && npm run build
```

Or from repo root:

```bash
npm run build:skin-care-landing
```

## Dev (Vite only, port 5180)

```bash
cd unified-dashboard/skin-care-landing && npm run dev
```

Copy `.env.example` to `.env.local` and set `VITE_FACE_READ_MOCK=1` when GPU inference is down.

Landing-only dev serves static files locally — **no middleware required** for funnel navigation through signup HTML:

- `/`, `/scan`, `/reveal`, `/concerns` — landing SPA (React Router)
- `/assets/*` — portal assets
- `/patients/*` — signup/login HTML
- `/about.html` — research lab about page (Vite dev middleware)
- `/contact.html` — contact form
- `/manifest.webmanifest` — PWA manifest

Only `/api` is proxied to `VITE_API_PROXY` (default `http://127.0.0.1:4000`).

**If the browser shows `504 Outdated Optimize Dep` for react.js:** a stale Vite process is still on port 5180. Stop it, then run `npm run dev:clean` (clears `.vite` cache and restarts with `--force`). The dev script uses `--strictPort` so a second server cannot silently move to another port.

**OTP / face-read** need an API unless mocked:

- Run middleware on `:4000`, or
- `VITE_FACE_READ_MOCK=1` for scan, and login with `&api=https://api.myskinandcare.com` (or `http://127.0.0.1:4000` locally)

## Full stack on :4000

```bash
cd middleware-platform && npm run start:landing
```

## Env

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_FACE_READ_MOCK` | off | Return mock skin age when inference unavailable |
| `VITE_IOS_APP_URL` | empty | TestFlight or App Store link when available |
| `VITE_ANDROID_APP_URL` | empty | Google Play link when available |
| `VITE_API_PROXY` | `http://127.0.0.1:4000` | Vite dev proxy target for `/api` only |
