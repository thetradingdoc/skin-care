# Section 2 prerequisite — Stripe Price IDs

**Environment:** production Cloud Run `somo-middleware`  
**Serving revision:** `somo-middleware-00212-m4h` @ 100% (APP-01 digest MATCH)  
**Checked:** 2026-07-19 via `gcloud run services describe`

| Env var | Status on serving revision |
|---------|----------------------------|
| `STRIPE_PRICE_CARE_PROGRAM` | **UNSET** |
| `STRIPE_PRICE_PLUS` | **UNSET** |
| `STRIPE_PRICE_AI_CREDIT_PACK` | **UNSET** |

Related Stripe prices that *are* set (voice/clinic topups — **not** consumer Care/Plus/credits):
`STRIPE_PRICE_STARTER`, `PRACTICE`, `CLINIC_PRO`, `TOPUP_*`.

**Implication for Steps 7–11:** UI can be built and visually verified. Every checkout path must report **“UI verified, checkout untested — Price ID unset”**. Do not use fake/mock Price IDs. Backend must fail closed when Price IDs are missing.

**Post-deploy probe:** `POST …/subscription/cancel` without session → **401** `x-session-id required` (route mounted; not 404).
