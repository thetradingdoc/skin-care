# STEP 7 — Choose your plan (re-verify — iOS platform split)

Mock reference: frame 7  
Live route: `/billing/choose-plan`  
Backend: `GET /api/patient/billing/subscription`

Mock: `…/STEP_7_mock_choose_plan.png`  
Live (iOS external UX): `…/STEP_7_live_choose_plan_ios_external.png`

## Platform split
- This screen has **no checkout** (navigate only).
- On iOS: note present — *"On iPhone, Care and Plus checkout continue in your browser — there is no in-app payment form."*
- Plus → `/capture/unlock-ai`; Care → `/billing/care-checkout` (both external-browser CTAs).

## Checklist
- [x] Free / Plus $9.99 / Care $29–49 cards
- [x] Subscription tier from GET (not hardcoded)
- [x] No WebView / AuthSession / Elements on this route
- [x] iOS external-checkout note visible
- [x] Tool-first framing

**Verdict: MATCH (untested checkout — Price ID unset)** — iOS platform-split note verified
