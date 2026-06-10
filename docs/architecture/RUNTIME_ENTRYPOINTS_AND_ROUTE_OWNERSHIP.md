# Runtime entry points and route ownership

**Last reviewed:** 2026-06-10

## Process entry points

| Entry | Path | Role |
|-------|------|------|
| HTTP API | [`middleware-platform/server.js`](../../middleware-platform/server.js) | Express app, static hosting, route mounts |
| Database facade | [`middleware-platform/database.js`](../../middleware-platform/database.js) | Stable `require('./database')` — repositories re-exported |
| Retell voice WS | [`middleware-platform/webhooks/retell-websocket.js`](../../middleware-platform/webhooks/retell-websocket.js) | Voice LLM WebSocket |
| Consumer landing | [`unified-dashboard/skin-care-landing/`](../../unified-dashboard/skin-care-landing/) | Vite SPA at `/` |
| Mobile app | [`patient-app/`](../../patient-app/) | Expo Router — Today, Plan, Progress |

## Route ownership (Skin & Care consumer)

| Domain | Route module | Registered via |
|--------|--------------|----------------|
| Face read / skin age | `routes/public-face-read.js` | `bootstrap/register-patient-routes.js` |
| Funnel match / journey | `routes/public-funnel-*.js` | `registerConsumerFunnelRoutes` |
| Patient OTP / session | `routes/patient-auth.js` | `registerPatientPortalRoutes` |
| Routine / shelf / billing | `routes/patient-routine.js`, `patient-shelf.js`, … | `registerPatientPortalRoutes` |
| Core B2B API | `routes/signup.js`, `credits.js`, … | `bootstrap/register-api-routes.js` |
| Health | `routes/health.js` | `registerHealthRoutes` |

## Bootstrap modules (server.js decomposition)

| Module | Purpose |
|--------|---------|
| [`bootstrap/static-hosting.js`](../../middleware-platform/bootstrap/static-hosting.js) | Consumer + portal static assets |
| [`bootstrap/register-api-routes.js`](../../middleware-platform/bootstrap/register-api-routes.js) | Signup, admin, RAG, public commerce |
| [`bootstrap/register-patient-routes.js`](../../middleware-platform/bootstrap/register-patient-routes.js) | Funnel + patient portal mounts |
| [`bootstrap/build-patient-route-deps.js`](../../middleware-platform/bootstrap/build-patient-route-deps.js) | Validators + `patientRouteDeps` |

## Related

- [`SERVER_DECOMPOSITION.md`](./SERVER_DECOMPOSITION.md)
- [`docs/development/CODE_REVIEW_2026-06.md`](../development/CODE_REVIEW_2026-06.md)
