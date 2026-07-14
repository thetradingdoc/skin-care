# Skin & Care — daily skin tracking app

**Last reviewed:** 2026-07-13

**GitHub:** [github.com/richiejeremiah/skin-care](https://github.com/richiejeremiah/skin-care)  
**Consumer domain:** [myskinandcare.com](https://myskinandcare.com) (marketing + web funnel)  
**Consumer API:** `https://api.myskinandcare.com` (shared middleware on Cloud Run)  
**Legacy API:** `https://api.callsomo.com` (same stack — shared infra identifier)

**Architecture:** [docs/LOCAL.md](docs/LOCAL.md) · [docs/CLOUD.md](docs/CLOUD.md) · [docs/MOBILE.md](docs/MOBILE.md) · [iOS cold-start crash](docs/patient-app/IOS_COLD_START_CRASH.md)

Skin & Care is a consumer iOS app for daily photo tracking, concern-based routines (acne, anti-aging, hyperpigmentation, barrier repair, rosacea), and optional `care_program` subscription.

This is a **standalone workspace** — not a branch mirror of somo. Platform fixes are ported from `somo-platform` `main` when needed (cherry-pick or manual merge).

---

## Quick start (mobile)

```bash
cd patient-app
cp .env.example .env
npm ci
npx expo start
```

Production API is set in `.env.example` and EAS profiles (`preview` / `production`).

## Push workflow

```bash
git checkout main
# ... commit changes ...
git push origin main
```

Mobile CI (typecheck + EAS preview) runs on push to `main` when `patient-app/` changes.

See [`docs/Brand/SKIN_AND_CARE_REPO.md`](docs/Brand/SKIN_AND_CARE_REPO.md) for porting platform fixes, EAS, and domain notes.

## iOS / TestFlight

| Step | Command / doc |
|------|----------------|
| EAS profiles | `patient-app/eas.json` |
| Launch checklist | `todos/pending/IOS_SKINCARE_TRACKER_LAUNCH_TODOS.md` |
| Preview build | `cd patient-app && eas build --platform ios --profile preview` |
| App Store submit | `eas submit --platform ios --profile production` (after ASC setup) |

Bundle ID: `com.skinandcare.app`

## Middleware (shared platform)

Local API for development:

```bash
npm ci --prefix middleware-platform
npm start --prefix middleware-platform
```

**Do not deploy middleware from this repo.** Production API deploy runs on **somo-platform** `main` only.

## Repo layout

| Path | Purpose |
|------|---------|
| `patient-app/` | Expo React Native app (Skin & Care) |
| `middleware-platform/` | Shared API (local dev; prod at api.myskinandcare.com) |
| `livekit-agents/` | Voice agents (platform) |
| `unified-dashboard/` | Consumer landing (`skin-care-landing/`), patient/business/admin web portals, Firebase hosting |
| `docs/Brand/` | Brand runbooks |
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
