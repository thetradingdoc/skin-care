# Skin & Care — daily skin tracking app

**GitHub:** [github.com/richiejeremiah/skin-care](https://github.com/richiejeremiah/skin-care)  
**Consumer domain:** [myskinandcare.com](https://myskinandcare.com) (marketing + web funnel)  
**API:** `https://api.callsomo.com` (shared Somo middleware — deploy from [somo-platform](https://github.com/richiejeremiah/somo-platform) only)

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
| `middleware-platform/` | Shared API (local dev; prod at api.callsomo.com) |
| `livekit-agents/` | Voice agents (platform) |
| `unified-dashboard/` | Provider / business dashboards (Somo brand) |
| `docs/Brand/` | Brand runbooks |

## Platform upstream

When you need a middleware or patient API fix that landed in somo first:

```bash
git remote add somo-platform https://github.com/richiejeremiah/somo-platform.git  # one-time
git fetch somo-platform
git cherry-pick <commit>   # or merge somo-platform/main into a port branch
```

Document what you ported in the commit message.
