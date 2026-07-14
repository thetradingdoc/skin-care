# iOS Skin & Care Tracker — Launch Todos

**Last updated:** 2026-06-07  
**Workspace:** `/Users/ojrichard/Voice Agent/skin-and-care`  
**GitHub:** [richiejeremiah/skin-care](https://github.com/richiejeremiah/skin-care)  
**Domain:** [myskinandcare.com](https://myskinandcare.com) (consumer marketing; API stays `api.callsomo.com`)  
**Brand:** Skin & Care · **Bundle ID:** `com.skinandcare.app`

---

## P0 — Repo + iOS build configuration

- [x] Standalone workspace (copy of somo, decoupled from branch-mirror workflow)
- [x] GitHub repo [richiejeremiah/skin-care](https://github.com/richiejeremiah/skin-care) — `main` only
- [x] CI — `.github/workflows/skin-care-mobile.yml` (typecheck + EAS preview on push)
- [x] Runbook — `docs/Brand/SKIN_AND_CARE_REPO.md`
- [x] `patient-app/eas.json` — development, preview, **testflight**, production profiles
- [x] `patient-app/app.json` — name, slug, bundle ID, camera/photo permissions, expo-camera plugin, export compliance
- [x] TestFlight runbook — `docs/runbooks/TESTFLIGHT.md`
- [x] `npm run verify:testflight` / `build:testflight` / `submit:testflight` scripts
- [x] Typecheck passes (`npm run typecheck` in `patient-app`)
- [ ] Delete superseded [skin-and-care](https://github.com/richiejeremiah/skin-and-care) repo if still exists (manual: `gh auth refresh -s delete_repo` then `gh repo delete richiejeremiah/skin-and-care --yes`)
- [ ] Add `EXPO_TOKEN` secret on **skin-care** GitHub repo (optional, for CI preview builds)
- [ ] Apple Developer account + App Store Connect app for **`com.skinandcare.app`** (manual)
- [ ] EAS link + TestFlight build (manual — requires interactive `eas login`):
  ```bash
  cd patient-app
  npm ci
  npx eas login
  npx eas init          # writes extra.eas.projectId to app.json — commit that
  npm run verify:testflight
  npm run build:testflight
  npm run submit:testflight
  ```
  Or one-shot: `npx eas build --platform ios --profile testflight --auto-submit`
- [ ] App Store Connect → TestFlight → **Internal Testing** → add your Apple ID email
- [ ] iPhone: install **TestFlight** app → open invite → install **Skin & Care**

## P0b — Domain (myskinandcare.com)

- [x] Legal pages in repo: `/patients/legal/privacy.html`, `/patients/legal/terms.html` (linked from skin-care-landing footer)
- [x] DNS cutover checklist in `docs/Brand/SKIN_AND_CARE_REPO.md` (code prep complete; operator DNS pending)
- [ ] DNS for myskinandcare.com → consumer landing / funnel (operator — parallel to TestFlight)
- [ ] Privacy policy URL live on myskinandcare.com (required for App Store — after DNS)
- [ ] Terms of service URL live on myskinandcare.com (after DNS)

## P1 — Auth and onboarding

- [x] `patient-app/app/sign-in.tsx` — email OTP, Skin & Care brand
- [x] `patient-app/hooks/useRequirePatientSession.ts` — gate Today, Timeline, routine pick
- [x] Account tab → `/sign-in` on sign out / unsigned
- [x] Deep link `patientapp://auth?ticket=…` (existing handoff)

## P2 — care_program billing (backend)

- [x] `care-program-billing-service.js` — checkout + activation
- [x] `POST /api/patient/billing/care-program/checkout`
- [x] Stripe webhook `care_program` activation (server.js existing hook)
- [ ] Set `STRIPE_PRICE_CARE_PROGRAM` in production env on **somo-platform** deploy (Stripe Dashboard → recurring price)
- [ ] Optional: `CARE_PROGRAM_MONTHLY_CENTS=4900` display pricing

## P3 — Subscription UI (mobile)

- [x] Account tab — tier, pricing, Subscribe via Stripe Checkout (WebBrowser)
- [x] Deep link `patientapp://subscription/success|cancel`
- [x] Wallet link gated on `GET /api/patient/features` (`wallet_enabled`)

## P4 — Polish

- [x] Clinical disclaimer on Today
- [x] Remove dev demo copy from primary sign-in path
- [x] `__tests__/care-program-billing-service.test.js`

## P5 — TestFlight smoke (manual)

Run on physical iPhone against `https://api.callsomo.com`:

1. [ ] Fresh install → Sign in (email OTP)
2. [ ] Pick concern (e.g. acne) → Today loads week/phase
3. [ ] Log photo → celebrate banner → Timeline shows logged day
4. [ ] Compare two photo days
5. [ ] Account → Subscribe → Stripe test card → return → tier `care_program`
6. [ ] Sign out → sign in again → template persists

## P6 — App Store Connect (manual, before public release)

- [ ] Privacy policy URL (myskinandcare.com)
- [ ] Terms of service URL (myskinandcare.com)
- [ ] Screenshots (Today, capture, Timeline, Account)
- [ ] App Privacy questionnaire (photos, email)
- [ ] Export compliance / encryption declaration

## Env reference

```bash
# patient-app (EAS preview/production)
EXPO_PUBLIC_API_BASE_URL=https://api.callsomo.com

# middleware-platform (production — set on somo-platform Cloud Run, not this repo deploy)
STRIPE_SECRET_KEY=sk_...
STRIPE_PRICE_CARE_PROGRAM=price_...
CARE_PROGRAM_MONTHLY_CENTS=4900
```

## Deferred (not this launch)

- Kelly / floating chat on Today
- In-app dermatologist booking
- Android Play Store
- Native video consult
