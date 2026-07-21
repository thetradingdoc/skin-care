# STEP 4 — Plan preview (claim-safe)

Mock reference: frame 4  
Live route: `/onboarding/plan-preview`  
Backend: `GET /api/public/routines/:id/preview/claim-safe` via `buildClaimSafePreview()`

Mock screenshot: `…/STEP_4_mock_plan.png`  
Live screenshot (local UI): `…/STEP_4_live_plan.png`

## Deploy + live verify (2026-07-19)
- Revision **`somo-middleware-00211-96g` @ 100%**
- Digest **`sha256:f920186a7290e11a9c774da239fa7f5917a5717cf131299c2ecad187a10a2274`**
- APP-01: `LATEST_CREATED_SERVING` + digest `MATCH`
- Live curl: `https://api.callsomo.com/api/public/routines/hyperpigmentation/preview/claim-safe` → `claim_safe: true`, no `expect`
- Raw `/preview` still returns `week_one.expect` (projection is separate, not a client filter)

## Literal copy currently returned by live claim-safe API (Dark marks / hyperpigmentation)

```
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
```

## Checklist
- [x] Back-nav (FE)
- [x] Claim-safe projection on backend (not client filter)
- [x] No “visible improvement by week N” in claim-safe payload
- [x] Local UI MATCH against mock
- [x] Prod deploy + digest assert
- [x] Live prod API re-verify

**Verdict: MATCH** (local UI + live prod API verified)
