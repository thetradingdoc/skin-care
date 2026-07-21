# Section 1 follow-ups (2026-07-19) — before Section 2

## 1) The six Step 0a route FAILs + onboarding overlap

From `touche-full-screen-audit-2026-07-19/audit-report.json` (`ok: false`, count = 6):

| # | Route | What failed |
|---|-------|-------------|
| 1 | `/capture/confirm/bill` | `not_found` — draft fields show “not found in document — tap to enter” (stub/draft wiring) |
| 2 | `/capture/confirm/rx` | `not_found` — same pattern for Rx confirm fields |
| 3 | `/capture/confirm/lab` | `not_found` — same pattern for Lab confirm fields |
| 4 | `/calendar` | `empty_despite_stub` — UI empty while calendar stub returned data |
| 5 | `/progress` | `empty_despite_stub` — empty while aggregates stub returned data (contract mismatch) |
| 6 | `/compare` | `legacy_compare` — legacy compare still reachable (redirected to mark-picker) |

**Onboarding overlap check (explicit):**  
None of these 6 routes are in the Section 1 MATCH set.

Section 1 MATCH routes for comparison:  
`/welcome`, `/capture/consent`, `/onboarding/why`, `/onboarding/plan-preview`, `/sign-in`, `/auth/otp-entry`, `/auth/otp-error`.

Baseline status of those that existed at 0a time: **all `ok: true`** (`/welcome`, `/capture/consent`, `/sign-in`, `/auth/otp-entry`, `/auth/otp-error`).  
`/onboarding/why` and `/onboarding/plan-preview` were **not in the 0a crawl** (added after baseline).

Therefore: **no downgrade** of Steps 1–6 from the six route FAILs.

**Note (not one of the 6):** many routes including Welcome/Consent/Sign-in/OTP logged React #418 hydration `pageerror` events while still `ok: true`. That is a separate quality issue, not counted in the FAIL-6 list.

## 2) Step 3 — all four personas

| Persona tile | Expected | `pending_routine_concern` | `onboarding_concern_id` | OK |
|--------------|----------|---------------------------|-------------------------|-----|
| Dark marks | `hyperpigmentation` | `hyperpigmentation` | `hyperpigmentation` | yes |
| Active breakouts | `acne` | `acne` | `acne` | yes |
| Sensitive/reactive | `rosacea` | `rosacea` | `rosacea` | yes |
| General wellness | `general_wellness` | `general_wellness` | `general_wellness` | yes |

**Step 3 remains MATCH** (all four persist correctly).

## 3) Step 4 — downgrade, deploy, live upgrade, literal copy

- Recorded interim verdict: **MATCH (local) — not yet live-verified**
- Deployed: `somo-middleware-00211-96g` @ 100%, digest `sha256:f920186a…2274`, APP-01 assert OK
- Live curl `…/preview/claim-safe` OK; raw `…/preview` still has `expect` (projection separate)
- Upgraded verdict: **MATCH**

### Literal copy (live API, Dark marks / `hyperpigmentation`)

DARK MARKS PLAN  
What this plan typically involves  
Morning  
Gentle cleanse, vitamin C, daily SPF — logged as habits, not prescribed doses.  
Evening  
Azelaic acid and a retinoid on alternating nights, with a moisturizer to buffer irritation.  
Stop & reassess if  
Burning, spreading redness, or new dark patches appear — that's a signal to slow down, not push through.  
This is a reference habit-set, not a prescription or a promised timeline. Everyone's skin responds differently.  
Use this plan  
Skip for now  

**Section 2 (Billing) not started.**
