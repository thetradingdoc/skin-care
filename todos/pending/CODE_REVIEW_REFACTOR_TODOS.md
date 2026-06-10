# Code review refactor — tasks

**Last updated:** 2026-06-10  
**SSOT:** [`docs/development/CODE_REVIEW_2026-06.md`](../../docs/development/CODE_REVIEW_2026-06.md)  
**Server plan:** [`docs/architecture/SERVER_DECOMPOSITION.md`](../../docs/architecture/SERVER_DECOMPOSITION.md)

Patient signup → mobile app journey is **complete**. This file tracked monolith thinning and doc hygiene from the June 2026 senior code review. **P1/P2 complete as of 2026-06-10.**

---

## P1-A — Patient portal repository

- [x] Add `middleware-platform/database/repositories/patient-portal.js`
- [x] Wire facade from `database.js` (`Object.assign` pattern)
- [x] Refactor `patient-portal-service.js` to use repository methods
- [x] Add `__tests__/patient-portal-repository.test.js`
- [x] Update `middleware-platform/ARCHITECTURE.md`

**Test gate:** `npm test --prefix middleware-platform` + `npm run test:e2e-consumer-sign-in --prefix middleware-platform`

---

## P1-B — Patient route bootstrap

- [x] Add `bootstrap/build-patient-route-deps.js`
- [x] Add `bootstrap/register-patient-routes.js` (`registerConsumerFunnelRoutes`, `registerPatientPortalRoutes`)
- [x] Slim `server.js` — preserve mount order at both call sites
- [x] Update `SERVER_DECOMPOSITION.md` Phase 2 status

**Test gate:** Jest + `test:e2e-consumer-sign-in` + `test:e2e-skin-care-landing`

---

## P1-C — Journal tab split

- [x] Create `patient-app/components/journal/*` (Photos, Calendar, List, Documents, types, styles)
- [x] Reduce `app/(tabs)/_journal.tsx` to thin shell (data load, segment control, modals, tab routing)

**Test gate:** `npm run typecheck --prefix patient-app` + `npm run lint --prefix patient-app`

---

## P2-A — Core API route manifest

- [x] Add `bootstrap/register-api-routes.js` (`registerCoreApiRoutes`)
- [x] Replace signup → commerce `app.use` block in `server.js`

**Test gate:** `npm test --prefix middleware-platform`

---

## P2-B — Health routes

- [x] Add `routes/health.js` (`registerHealthRoutes`)
- [x] Remove inline `/health*` from `server.js`

**Test gate:** Jest + dev `curl /health/live`

---

## P2-C — Patient-app Vitest

- [x] Add Vitest to `patient-app/package.json`
- [x] Add `lib/__tests__/patient-session.test.ts`
- [x] Wire `test:patient-app` in root `package.json` + CI

**Test gate:** `npm test --prefix patient-app`

---

## Docs hygiene

- [x] Create `docs/architecture/RUNTIME_ENTRYPOINTS_AND_ROUTE_OWNERSHIP.md`
- [x] Fix `todos/pending/README.md` broken `CODEBASE_REVIEW_ROADMAP` link
- [x] Fix `docs/middleware-platform/README.md` littlelab paths → `skin-care-landing` (live path clarified; archive refs retained)
- [x] Document `KELLY_RAILS_V2` in ops/dev docs
- [x] Update `CODE_REVIEW_2026-06.md` completion section

**Test gate:** `npm run check:docs-stale-strings`

---

## P3 — Deferred (platform heritage)

Do not start until touching voice/RCM/checkout:

- [ ] Split `kelly-agent-service.js` / `kelly-tool-executor.js`
- [ ] Split `unified-dashboard/patients/checkout-chat.js`
- [ ] Extract Postgres sync from `database.js` → `database/sync/`
- [ ] Thin `routes/admin-platform.js`

---

## Final verification

- [x] `npm test --prefix middleware-platform` (415+ tests)
- [x] `npm run test:e2e-consumer-sign-in --prefix middleware-platform`
- [x] `npm run test:e2e-skin-care-landing --prefix middleware-platform`
- [x] `npm run typecheck --prefix patient-app`
- [x] `npm test --prefix patient-app`
- [x] `npm run check:docs-stale-strings`
