# STEP 11 — Billing management

Mock reference: frame 11  
Live route: `/billing/manage` (also Profile → **Manage billing**)  
Backend: `GET /api/patient/billing/subscription`  
Cancel: `POST /api/patient/billing/subscription/cancel` → Stripe `cancel_at_period_end` when `stripe_subscription_id` present; otherwise fail closed

Mock screenshot: `…/STEP_11_mock_billing_manage.png`  
Live screenshot: `…/STEP_11_live_billing_manage.png`

## Prerequisite
Price IDs unset → no real Stripe subscription on free accounts. Cancel is wired to a **real** endpoint that returns a clear error when no Stripe sub id is on file (`STRIPE_SUBSCRIPTION_MISSING`) — not a UI-only stub.

## Checklist
- [x] Dedicated Billing screen (not Profile-only row)
- [x] Plan card from GET subscription (evidence: Free / $0)
- [x] Payment method / history rows (honest empty: “Not on file yet” / “No invoices yet”)
- [x] Cancel plan calls `POST …/subscription/cancel` (not a no-op)
- [x] Free users see “Choose a plan” → `/billing/choose-plan`

## Code
- FE: `patient-app/app/billing/manage.tsx`
- BE: enriched GET + cancel in `routes/patient-billing-portal.js` + `cancelCareProgramSubscription` in `care-program-billing-service.js`
- Profile row: `account.tsx` → Manage billing

**Verdict: MATCH (untested checkout — Price ID unset)**  
UI + GET wired; cancel is a real API (fail-closed without Stripe sub). Full cancel-at-period-end E2E needs a live subscription after Price IDs are set.
