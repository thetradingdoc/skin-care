# Skin & Care landing

Minimal consumer marketing SPA for **Skin & Care** — served at `http://localhost:4000/` and production consumer hosts.

## Web-first Skincare Journal funnel

Positioning SSOT: [`docs/Brand/POSITIONING.md`](../../docs/Brand/POSITIONING.md) — *The #1 Skincare Journal.*

| Route | Step |
|-------|------|
| `/` | Landing — journal hero, CTA *Check your skin* |
| `/scan` | Camera / upload → face-read (no account) |
| `/quick-check` | Skin feel + routine habit + optional trigger |
| `/reveal` | Findings + branched CTA (diary → signup, routine → concerns) |
| `/concerns` | What to watch (optional skip for diary users) |
| `/for/:slug` | SEO landing pages (sensitive skin, flare log, etc.) |
| `/app/sign-in?intent=signup&from=skin-age-landing` | OTP signup → Expo web app |

Pre-signup state lives in **`sessionStorage`** (`sc_onboarding_*` keys). After OTP, [`skin-age-journey.ts`](../../patient-app/lib/skin-age-journey.ts) sets `journey_modes` from funnel segment and activates routine template only for routine-ready users.

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

Copy `.env.example` to `.env.local`. Face-read needs middleware + teamkelly — see [docs/runbooks/FACE_READ_INFERENCE.md](../../docs/runbooks/FACE_READ_INFERENCE.md).

Landing-only dev serves static files locally — **no middleware required** for funnel navigation through signup HTML:

- `/`, `/scan`, `/reveal`, `/concerns` — landing SPA (React Router)
- `/assets/*` — portal assets
- `/patients/*` — signup/login HTML
- `/about.html` — research lab about page (Vite dev middleware)
- `/contact.html` — contact form
- `/manifest.webmanifest` — PWA manifest

Only `/api` is proxied to `VITE_API_PROXY` (default `http://127.0.0.1:4000`).

**If the browser shows `504 Outdated Optimize Dep` for react.js:** a stale Vite process is still on port 5180. Stop it, then run `npm run dev:clean` (clears `.vite` cache and restarts with `--force`). The dev script uses `--strictPort` so a second server cannot silently move to another port.

**OTP / face-read** need middleware with `FACE_READ_INFERENCE_BASE_URL` (teamkelly):

- Run middleware on `:4000` with inference configured, or
- Point login at prod API: `&api=https://api.myskinandcare.com`

## Full stack on :4000

```bash
cd middleware-platform && npm run start:landing
```

## Env

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_IOS_APP_URL` | empty | TestFlight or App Store link when available |
| `VITE_ANDROID_APP_URL` | empty | Google Play link when available |
| `VITE_API_PROXY` | `http://127.0.0.1:4000` | Vite dev proxy target for `/api` only |
