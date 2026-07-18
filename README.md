# Touche — skincare & medical journal (consumer)

**Last reviewed:** 2026-07-17

**GitHub:** [github.com/richiejeremiah/skin-care](https://github.com/richiejeremiah/skin-care) (repo/folder name remains `skin-and-care` — infra identifier)  
**Consumer brand:** **Touche** · **Be Bold** · **Skincare & medical journal**  
**Consumer app host:** `app.trytouche.com`  
**Marketing:** [trytouche.com](https://trytouche.com) (myskinandcare.com redirects)  
**Consumer API:** `https://api.myskinandcare.com` (shared middleware on Cloud Run)  
**Legacy / shared API host:** `https://api.callsomo.com` (same stack — shared infra identifier)

**Product SSOT (current):** [`docs/product/TOUCHE_AGENTIC_ARCHITECTURE.md`](docs/product/TOUCHE_AGENTIC_ARCHITECTURE.md) — 5-tab shell (Progress lander), facts store, `orchestrateCapture`. Shopify commerce locks remain in the superseded [`TOUCHE_CAMERA_FIRST.md`](docs/product/TOUCHE_CAMERA_FIRST.md) historical record.  
**Platform SSOT:** [`ARCHITECTURE.md`](ARCHITECTURE.md) · [docs/LOCAL.md](docs/LOCAL.md) · [docs/CLOUD.md](docs/CLOUD.md) · [docs/MOBILE.md](docs/MOBILE.md) · [iOS cold-start crash](docs/patient-app/IOS_COLD_START_CRASH.md)

**Touche** ships a consumer Expo app (medical tracker / Progress lander + capture) plus concern-based routines. Optional Stripe `care_program` exists as a **buried** journal subscription, not primary monetization (product commerce is Shopify).

This is a **standalone workspace** — not a branch mirror of somo. Platform fixes are ported from `somo-platform` `main` when needed (cherry-pick or manual merge). Repo folder and GCP/service names may still say Skin & Care / Somo; that is infra, not the consumer face.

---

## Quick start (mobile)

```bash
cd patient-app
cp .env.example .env
npm ci
npx expo start
```

`npm ci` installs Expo deps including `@react-native-async-storage/async-storage` (required for web / session persistence). Production API is set in `.env.example` and EAS profiles (`preview` / `production`).

## Push workflow

```bash
git checkout main
# ... commit changes ...
git push origin main
```

Mobile CI (typecheck + EAS preview) runs on push to `main` when `patient-app/` changes.

See [`docs/Brand/SKIN_AND_CARE_REPO.md`](docs/Brand/SKIN_AND_CARE_REPO.md) for porting platform fixes, EAS, and domain notes. Brand index: [`docs/Brand/README.md`](docs/Brand/README.md).

## iOS / TestFlight

| Step | Command / doc |
|------|----------------|
| EAS profiles | `patient-app/eas.json` |
| Launch checklist | `docs/archive/pre-rebuild/todos/IOS_SKINCARE_TRACKER_LAUNCH_TODOS.md` (archived) |
| Preview build | `cd patient-app && eas build --platform ios --profile preview` |
| App Store submit | `eas submit --platform ios --profile production` (after ASC setup) |

Bundle ID: `com.skinandcare.app` (kept for App Store continuity — see [`docs/Brand/BUNDLE_ID_DECISION.md`](docs/Brand/BUNDLE_ID_DECISION.md))  
App Store display name: **Touche**

## Middleware (shared platform)

Local API for development:

```bash
npm ci --prefix middleware-platform
npm start --prefix middleware-platform
```

CORS allowlist includes `https://app.trytouche.com` and `*.trytouche.com` (TOUCH-038). See `middleware-platform/server.js`.

**Do not deploy middleware from this repo.** Production API deploy runs on **somo-platform** `main` only.

## Repo layout

| Path | Purpose |
|------|---------|
| `patient-app/` | Expo React Native app (**Touche** consumer) |
| `middleware-platform/` | Shared API (local dev; prod at api.myskinandcare.com / api.callsomo.com) |
| `livekit-agents/` | Voice agents (platform) |
| `unified-dashboard/` | Consumer landing, patient/provider/admin web portals, Firebase hosting |
| `docs/Brand/` | Brand runbooks (Touche consumer; Skin & Care historical) |
| `docs/development/CODE_REVIEW_2026-06.md` | Senior code review, god-file map, refactor phases |

## Code review & monolith refactor

Patient signup → mobile app is **complete**. Platform monolith (`database.js`, `server.js`) is refactored incrementally — see **[docs/development/CODE_REVIEW_2026-06.md](docs/development/CODE_REVIEW_2026-06.md)** and **[docs/architecture/SERVER_DECOMPOSITION.md](docs/architecture/SERVER_DECOMPOSITION.md)**.

## Platform upstream

When you need a middleware or patient API fix that landed in somo first:

```bash
git remote add somo-platform https://github.com/richiejeremiah/somo-platform.git  # one-time
git fetch somo-platform
git cherry-pick <commit>   # or merge somo-platform/main into a port branch
```

Document what you ported in the commit message.
