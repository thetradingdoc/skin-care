# server.js decomposition

**Last reviewed:** 2026-06-10

## Current state

| File | Lines (approx.) | Role |
|------|-----------------|------|
| [`middleware-platform/server.js`](../../middleware-platform/server.js) | ~10,400 | Express entry: env, middleware stack, static hosting, ~215 inline `app.*` handlers, route mounts, listen |
| [`middleware-platform/bootstrap/static-hosting.js`](../../middleware-platform/bootstrap/static-hosting.js) | ~150 | Consumer landing + unified-dashboard static assets (Phase 1 extract) |
| [`middleware-platform/routes/*.js`](../../middleware-platform/routes/) | 100+ modules | HTTP handlers — **preferred home for new endpoints** |

`server.js` remains the process entry point. Do not change `require('./server')` paths.

## What still lives in server.js (and why)

1. **Boot & security** — dotenv, env validation, JWT/FHIR guards, Stripe init
2. **Global middleware** — CORS, rate limits, sanitization, correlation IDs
3. **Static hosting** — marketing SPA, `/patients`, `/business`, `/admin` HTML portals
4. **Legacy inline routes** — health, diagnostics, admin HTML fallbacks, webhook upgrade handler
5. **Route mounting** — `app.use('/api/...')` for ~80 route modules
6. **Patient portal deps** — `patientRouteDeps` / `patientPortalDeps` built from helpers defined inline (~lines 7700–7870)
7. **Process lifecycle** — listen, WebSocket upgrade, graceful shutdown

## Decomposition phases

### Phase 1 — Done

- [`bootstrap/static-hosting.js`](../../middleware-platform/bootstrap/static-hosting.js) — consumer landing static paths
- Patient + funnel routes use `register*Routes(app, deps)` pattern in `routes/patient-*.js`

### Phase 2 — Done (2026-06-10)

| Extract | Target | Status |
|---------|--------|--------|
| Patient portal SQLite migrations | [`database/migrations/patient-portal.js`](../../middleware-platform/database/migrations/patient-portal.js) | Done 2026-06-10 |
| Patient route registration | `bootstrap/register-patient-routes.js` + `build-patient-route-deps.js` | Done 2026-06-10 |
| API route manifest | `bootstrap/register-api-routes.js` | Done 2026-06-10 |
| Health routes | `routes/health.js` | Done 2026-06-10 |

### Phase 3 — Deferred (platform heritage)

- Kelly / Retell inline handlers → already mostly in `webhooks/` + `routes/voice.js`
- RCM / admin inline handlers → `routes/admin-platform.js` (still large)

## Rules for new work

1. **New HTTP endpoint** → `routes/<domain>.js` + `register*Routes(app, deps)` — never add large handlers to `server.js`.
2. **New patient/mobile API** → `routes/patient-*.js` or `routes/public-funnel-*.js`; register next to existing patient block.
3. **Changing mount order** — run Playwright consumer sign-in + skin-age journey specs after any patient route extract.

## Verification after server.js edits

```bash
cd middleware-platform
npm test
npm run test:e2e-consumer-sign-in
npm run test:e2e-skin-care-landing
```

## Related

- [`middleware-platform/ARCHITECTURE.md`](../../middleware-platform/ARCHITECTURE.md)
- [`docs/development/CODE_REVIEW_2026-06.md`](../development/CODE_REVIEW_2026-06.md)
- [`RUNTIME_ENTRYPOINTS_AND_ROUTE_OWNERSHIP.md`](./RUNTIME_ENTRYPOINTS_AND_ROUTE_OWNERSHIP.md) (if present)
