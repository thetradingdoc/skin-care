# STEP 8 — Care Program checkout (re-verify — iOS platform split)

Mock reference: frame 8  
Live route: `/billing/care-checkout`  
Backend: `POST /api/patient/billing/care-program/checkout` → URL opened with **`Linking.openURL` only**

Mock: `…/STEP_8_mock_care_checkout.png`  
Live (iOS external UX): `…/STEP_8_live_care_checkout_ios_external.png`

## Finding (pre-fix)
Previous Section 2 verify used **`WebBrowser.openAuthSessionAsync`** — that was **in-app** checkout hosting. **Not** the corrected platform split.

## Current iOS behavior (evidence)
- Screen = plan/pricing info only (no Stripe Elements, no WebView).
- CTA literal: **`Continue in browser — $39.00/mo`**
- Note literal: *Checkout opens in your browser. After you pay, return to the app — we confirm your plan from billing status, not from an in-app checkout form.*
- Open path: `openBillingCheckoutUrl` → `Linking.openURL` (never AuthSession).

## Claim-safe copy (literal)
```
A guided tracking tool: habit checklist, weekly reminders, mark-compare timeline for your plan. This is not medical treatment and does not replace a dermatologist.
```

## Checklist
- [x] Pricing/plan info only in-app
- [x] External-link CTA (`Linking.openURL`)
- [x] No AuthSession / WebView / Elements
- [x] Claim-safe sentence verbatim
- [x] Fail closed when Price ID unset (unchanged)

**Verdict: MATCH (untested checkout — Price ID unset)** — iOS platform split implemented + re-verified
