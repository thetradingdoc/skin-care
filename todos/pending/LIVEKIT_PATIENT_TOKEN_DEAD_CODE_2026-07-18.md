# Finding — LiveKit patient video token / `module.exports` placement (2026-07-18)

**Status:** **corrected** — Wave 2 report overstated this as “unreachable dead code.”

## Claim (Wave 2)

`module.exports = router` appeared before `router.get('/patient/video/token')`, so the patient endpoint was thought unreachable.

## Verification

CommonJS exports the **same object by reference**. Routes registered after `module.exports = router` still attach to that object:

```text
livekit routes: ["/token", "/token", "/patient/video/token"]
patient/video/token registered: true
```

Proven with a live `require('./routes/livekit')` stack dump on 2026-07-18.

## History

- File entered this repo in commit `709eb57` (2026-06-06) with mid-file `module.exports` **and** the patient route after it — same pattern from day one.
- Moving `module.exports` to the end (Wave 2) is still good style; it did **not** resurrect a previously dead route.

## Callers (who relies on what)

| Client | Endpoint | Status |
|--------|----------|--------|
| [`unified-dashboard/patients/video-call.html`](../../unified-dashboard/patients/video-call.html) | `GET /api/livekit/patient/video/token` | **Intended patient path** — was **reachable** despite mid-file export |
| [`unified-dashboard/business/video-call.html`](../../unified-dashboard/business/video-call.html) | `POST /api/livekit/token` | Provider/landing path — always worked |
| Docs / archived landing | `POST /api/livekit/token` | Same open POST path |

## Finding (honest)

This was a **style/maintainability smell**, not a silent patient-feature outage. No evidence the patient video token was 404 for six weeks due to export order.

**Separate, real Wave 2 security work on this file:** SEC-14 auth on `POST /token`, plus residual **SEC-14R** (weak `x-provider-id`-only auth) tracked in the remediation plan.
