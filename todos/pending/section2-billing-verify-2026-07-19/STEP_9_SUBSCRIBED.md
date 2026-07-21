# STEP 9 — Subscribed confirmation (reopen path)

Live route: `/billing/subscribed`  
Evidence shot: `…/STEP_9_live_subscribed_reopen_path.png`

## Primary scenario (post platform split)
After **external browser** payment, user returns to the app. Confirmation must come from **`GET /api/patient/billing/subscription`**, not from an in-app checkout redirect.

## Implemented
- `useFocusEffect` → poll on screen focus
- `AppState` `'active'` → re-poll on app reopen
- Success only if tier is `care_program` or `plus` + `status: active`
- Reopen copy: *Checking billing status after you return to the app — not trusting an in-app checkout redirect alone.*

## Not E2E-proven
Price IDs unset → cannot complete a real external payment and observe webhook activation. Logic + wiring verified; live paid reopen still blocked on ops Price IDs.

**Verdict: MATCH (untested checkout — Price ID unset)** — reopen/poll path wired; paid E2E deferred
