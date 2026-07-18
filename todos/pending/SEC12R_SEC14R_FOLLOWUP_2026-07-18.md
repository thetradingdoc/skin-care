# SEC-12R / SEC-14R — scheduled Wave 2 residuals (2026-07-18)

**Status:** **Wave 5 — implementation completed in code** (gates present; re-verify with adversarial tests if CI gaps remain). Originally scheduled follow-up — **did not block Wave 3** (Touche P2).  
**Plan:** [`TOUCHE_REMEDIATION_ARCHITECTURE_PLAN_2026-07-17.md`](./TOUCHE_REMEDIATION_ARCHITECTURE_PLAN_2026-07-17.md) (repo mirror) · todos `sec-12r-14r`.

## Wave 5 evidence (code)

| ID | Evidence |
|----|----------|
| **SEC-12R** | [`video-consult.js`](../../middleware-platform/routes/video-consult.js): `requireVideoConsultAgent`, `requireVideoConsultStaff`, `requireVideoConsultStaffOrAgent`; agent routes use agent secret; staff/SSE/vision/session/transcript/vitals/summary/assistant gated |
| **SEC-14R** | [`livekit.js`](../../middleware-platform/routes/livekit.js): `requireLivekitTokenAuth` — validated patient `x-session-id`, validated `customer_session`, or signed provider/user JWT; **no** bare `x-provider-id` / `x-clinic-id` as auth |

Residual (optional hardening, not Wave 5 doc blocker): expand adversarial Jest coverage if any route class lacks a dedicated fail-closed test.

## SEC-12R — video-consult PHI residual (original checklist)

**Size: ~1–1.5 engineer-days** (historical estimate)

Wave 2 closed: agent secret fail-closed in prod-like; gated `patient-chart`, `session/:roomId`, `GET vitals`.

Wave 5: remaining routes below are wired to staff/agent/staff-or-agent helpers (see evidence table).

| Route | Likely class | Wave 5 |
|-------|----------------|--------|
| `GET /sse/:roomId` | staff/agent (PHI stream) | gated |
| `GET /vision/session/:sessionId`, metrics | staff/agent | gated |
| `POST /vision/capture-events`, metrics/inc | agent secret | `requireVideoConsultAgent` |
| `GET /review-tasks` | staff | gated |
| `GET/POST transcript-translation` | staff/agent | gated |
| `POST /end-session` | staff/agent | gated |
| `POST vitals`, `summary`, `client-transcript`, `thread-event` | staff/agent | gated |
| `GET /assistant/:roomId` | staff | gated |
| `POST /agent-events` | already `verifyAgentAuth` | keep / re-test prod fail-closed |

## SEC-14R — LiveKit weak provider auth (original)

**Size: ~0.5–1 engineer-day** (historical estimate)

Historical gap: `requireLivekitTokenAuth` accepted bare `x-provider-id` / `x-clinic-id`. **Replaced** with real `customer_session` / signed JWT; patient `x-session-id` path retained.

**Combined schedule (historical):** after Wave 3 Touche P2, or parallel with Wave 5 — **tracked; code gates landed**.
