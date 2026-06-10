# Senior code review — Skin & Care workspace

**Last reviewed:** 2026-06-10  
**Scope:** Patient signup → mobile app journey (complete), middleware, patient-app, consumer landing, docs hygiene.

---

## Executive summary

The **consumer patient journey** (web funnel → OTP sign-in → Expo app Today/Plan/Progress) is **feature-complete** and production-deployed. The codebase inherits a large **Somo platform monolith** (~21k-line `database.js`, ~10k-line `server.js`) alongside focused Skin & Care surfaces. Refactoring should continue **incrementally by domain** — not big-bang rewrites — with tests after each extract.

### What is in good shape

| Area | Assessment |
|------|------------|
| Patient OTP + session | `patient-auth.js`, `patient-portal-service.js`, `email-service.js` — branded layout, clean inbox metadata |
| Consumer funnel | `skin-care-landing/` (Vite/React), `public-funnel-*`, `patient-funnel-bridge` |
| Mobile app | `patient-app/` — Expo Router, typecheck in CI, EAS profiles |
| Brand SSOT | Tulip wordmark, email PNG, CI `check:brand` |
| Email | `skin-care-email-layout.js`, category subjects (`Email verification`) |
| Tests | ~94 Jest suites in middleware; Playwright for landing + consumer sign-in |

### Highest-risk god files (do not rewrite in one PR)

| File | Lines | Risk | Refactor strategy |
|------|------:|------|-------------------|
| `middleware-platform/database.js` | ~20,700 | **Critical** — every route imports `require('./database')` | Phase 2: extract migrations + repositories by domain; keep facade stable |
| `middleware-platform/server.js` | ~10,400 | **High** — mount order + inline deps | Phase 2: `bootstrap/register-*-routes.js`; never reorder mounts casually |
| `services/kelly-agent-service.js` | ~6,600 | Medium (voice commerce) | Kelly Rails V2 is parallel path; legacy retained for Retell |
| `services/kelly-tool-executor.js` | ~3,700 | Medium | Split by tool category when touching voice |
| `routes/admin-platform.js` | ~3,650 | Low for Skin & Care | B2B only |
| `unified-dashboard/patients/checkout-chat.js` | ~3,600 | Medium | Agentic checkout; split UI modules if extended |

---

## Patient journey architecture (complete)

```text
myskinandcare.com (skin-care-landing)
  → /scan, /reveal, /concerns
  → POST /api/public/face-read, funnel match/journey
  → /app/sign-in (Expo web or native)
  → POST /api/patient/verify/send → Email verification
  → POST /api/patient/verify/confirm → session cookie
  → patient-app/(tabs): today, plan, progress, account
```

Key files:

- Landing: `unified-dashboard/skin-care-landing/src/pages/`
- API: `routes/patient-auth.js`, `routes/public-face-read.js`, `routes/patient-funnel-bridge.js`, `routes/patient-routine.js`
- Mobile: `patient-app/app/sign-in.tsx`, `app/onboarding/reveal.tsx`, `lib/patient-session.ts`
- Journey doc: [`docs/user-journey/JOURNEY.md`](../user-journey/JOURNEY.md)

---

## Refactoring completed (2026-06-10)

1. **Patient portal migrations extracted** → [`middleware-platform/database/migrations/patient-portal.js`](../../middleware-platform/database/migrations/patient-portal.js)
2. **Patient portal repository** → [`middleware-platform/database/repositories/patient-portal.js`](../../middleware-platform/database/repositories/patient-portal.js)
3. **Server bootstrap** — `register-patient-routes.js`, `register-api-routes.js`, `routes/health.js`, `build-patient-route-deps.js`
4. **Journal tab split** — `patient-app/components/journal/journalTypes.ts`, `journalStyles.ts`
5. **Patient-app Vitest** — `lib/__tests__/patient-session.test.ts`
6. **Email inbox UX** — `formatSmtpFrom()`, subject `Email verification`, safe preheaders (prior session)
7. **Docs** — `RUNTIME_ENTRYPOINTS_AND_ROUTE_OWNERSHIP.md`, `CODE_REVIEW_REFACTOR_TODOS.md`

---

## Recommended next refactors (priority order)

### P1 — Patient domain (low blast radius)

1. `database/repositories/patient-portal.js` — session CRUD, OTP storage (SQL currently inline in `patient-portal-service` / `database.js`)
2. `bootstrap/register-patient-routes.js` — single ordered registration for all `registerPatient*` calls
3. Split `patient-app/app/(tabs)/_journal.tsx` (~1,766 lines) into tab subcomponents

### P2 — Server thinning

1. `bootstrap/register-api-routes.js` — signup, credits, commerce, voice mounts
2. Move remaining inline `app.get/post` health/diagnostic handlers to `routes/health.js`

### P3 — Platform heritage (only when needed)

1. Kelly agent service decomposition
2. `checkout-chat.js` component split
3. Postgres sync helpers in `database.js` → `database/sync/`

---

## Code smells & tech debt

| Smell | Location | Mitigation |
|-------|----------|------------|
| Dual SQLite/Postgres branches | `database.js` | Repository layer + single write path per entity |
| Parallel Kelly paths | `kelly-agent-service` vs `kelly-rails-*` | Feature flag `KELLY_RAILS_V2`; document in ops runbook |
| Static HTML + Vite SPA | `unified-dashboard/patients/` vs `skin-care-landing/` | Consumer = Vite only; legacy HTML for provider portals |
| `callsomo.com` defaults | email, API fallbacks | Intentional shared infra; consumer URLs use `myskinandcare.com` in app `.env` |
| No patient-app unit tests | `patient-app/` | Vitest for `lib/patient-session.ts`; journal tab split in `components/journal/*` |
| Archived `littlelab-landing` refs | `docs/architecture/` | Historical; active SPA is `skin-care-landing` |

---

## Testing matrix

| Command | What it guards |
|---------|----------------|
| `npm test --prefix middleware-platform` | Unit/integration (~94 suites) |
| `npm run test:e2e-consumer-sign-in --prefix middleware-platform` | OTP funnel |
| `npm run test:e2e-skin-care-landing --prefix middleware-platform` | Landing routes |
| `npm run typecheck --prefix patient-app` | Mobile types |
| `npm test --prefix patient-app` | Vitest (`patient-session`) |
| `npm run ci:local` (root) | Guardrails + middleware Jest + security gate |
| `npm run check:docs-stale-strings` | Doc drift |
| `npm run verify:patient-otp-email` | Live OTP smoke (production) |

**After `database.js` or `server.js` changes:** run full middleware Jest + consumer Playwright specs.

---

## Documentation status (2026-06-10)

| Doc | Status |
|-----|--------|
| Root `README.md` | Updated — consumer + middleware layout |
| `docs/README.md` | Current hub; `SERVER_DECOMPOSITION.md` link fixed |
| `docs/email/README.md` | Current — OTP subject, From format |
| `docs/user-journey/JOURNEY.md` | Current funnel map |
| `docs/Brand/*` | Current wordmark SSOT |
| `docs/deployment/OPERATIONS.md` | Large archive; search-only for history |
| `middleware-platform/ARCHITECTURE.md` | Updated migration paths |

Run `npm run check:docs-stale-strings` before release.

---

## Phase 2 refactor completion (2026-06-10)

| Item | Status |
|------|--------|
| `database/repositories/patient-portal.js` + Jest | Done |
| `bootstrap/build-patient-route-deps.js` + `register-patient-routes.js` | Done |
| `bootstrap/register-api-routes.js` | Done |
| `routes/health.js` | Done |
| Vitest + `patient-session.test.ts` + CI step | Done |
| Journal tab split (`components/journal/*`) | Done |
| `RUNTIME_ENTRYPOINTS_AND_ROUTE_OWNERSHIP.md` | Done |

See [`todos/pending/CODE_REVIEW_REFACTOR_TODOS.md`](../../todos/pending/CODE_REVIEW_REFACTOR_TODOS.md) for task checklist. P3 (Kelly/checkout/database sync) remains deferred.

---

## Security notes

- OTP codes must not appear in email preheaders (Gmail subject leak) — enforced in `email-service.js`
- Patient sessions: CSRF, rotation, rate limits in `patient-auth.js`
- Production requires `REQUIRE_JWT_FOR_FHIR`, `JWT_SECRET` — validated in `server.js` boot
- Rotate Gmail app passwords if exposed in chat logs

---

## Verdict

**Ship-ready for patient mobile journey.** Phase 2 extraction (patient portal repo, bootstrap route modules, health routes, Vitest, journal tab split) is **complete** as of 2026-06-10. Monolith size is **managed debt**, not a blocker. Avoid full rewrites of `database.js` or `server.js` without a dedicated multi-sprint plan.
