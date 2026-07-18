# Module owners — Touche vs shared platform

**Status:** ARCH-01 map (living)  
**Last updated:** 2026-07-17  
**Product SSOT:** [`TOUCHE_AGENTIC_ARCHITECTURE.md`](./TOUCHE_AGENTIC_ARCHITECTURE.md)  
**Platform SSOT:** [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md)

Owns **code ownership boundaries** inside the shared monolith. Does not imply separate deploys.

## Explicit non-goal (ARCH-05)

**No Cloud Run service split in this plan’s horizon.** Touche and Kelly/RCM continue to ship on shared `somo-middleware` until a future RFC after in-repo boundaries still fail. Do not propose extraction as the default next step.

## Touche-owned trees

| Area | Paths |
|------|--------|
| Consumer app | `patient-app/` |
| Capture HTTP + orchestration | `middleware-platform/routes/patient-records.js`, `patient-medical-progress.js`, `patient-ai-monetization.js`; `services/capture-orchestration/**` |
| Medical-tracker rails | `middleware-platform/services/medical-tracker-rails/**` |
| Medical-tracker domain | `middleware-platform/services/medical-tracker-domain/**` |
| Facts store | `middleware-platform/repositories/patient-record-facts-repo.js`, `middleware/patient-record-facts.js`, migrations `067_`–`076_` (facts/capture related) |
| Field templates | `middleware-platform/services/record-field-templates/**` (+ `patient-app/lib/record-field-templates.ts` mirror) |
| Consumer landing | `unified-dashboard/skin-care-landing/` |
| Isolation CI | `middleware-platform/scripts/verify-medical-tracker-isolation.cjs` |

**Rule:** New Touche features land in repos/services above — **not** new god-file logic in `database.js` / `server.js` (ARCH-03).

## Platform-owned (Kelly / RCM / provider)

| Area | Paths (representative) |
|------|------------------------|
| Voice / Kelly | `livekit-agents/`, Kelly graphs, Retell routes |
| RCM / coding / Stedi | `routes` under RCM, insurance, prior-auth, pdf-coding, perception/coding graphs |
| Provider / admin portals | `unified-dashboard/` provider/admin shells (non-landing) |
| Shared auth / billing infra | Stripe webhooks, merchant, invoices, video-consult, livekit (telehealth) |
| Deploy / GCP | `scripts/deploy-to-gcp-*.sh`, Cloud Run `somo-middleware` |

Touche must not import Kelly/perception/coding into capture persist paths — enforced by isolation script.

## Shared process, separate ownership

| Layer | Owner note |
|-------|------------|
| Cloud Run process | Shared deploy (somo-platform `main`) |
| `server.js` mounts | Platform owns wiring; Touche owns route modules it registers |
| `database.js` | Platform god-object — Touche uses migrations + repos only |
| CORS / env | Platform ops; Touche documents `app.trytouche.com` allowlist needs |

## Related

- Remediation plan Section 4: [`../../todos/pending/TOUCHE_REMEDIATION_ARCHITECTURE_PLAN_2026-07-17.md`](../../todos/pending/TOUCHE_REMEDIATION_ARCHITECTURE_PLAN_2026-07-17.md)
