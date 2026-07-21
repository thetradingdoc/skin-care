# Section 2 consolidated report — Billing (Steps 7–11)

**Date:** 2026-07-19  
**Stopped before Section 3 (Capture)** — awaiting your review.

---

## iOS platform-split correction (blocking follow-up)

**Finding:** Section 2 was **first verified against the pre-correction flow** (`WebBrowser.openAuthSessionAsync` on Care checkout). That was **not** the iOS external-browser split.

**Implemented now:**
- Care / Plus / Profile Care → `openBillingCheckoutUrl` → **`Linking.openURL` only**
- iOS screens show pricing/plan info + **Continue in browser** CTAs
- No Stripe Elements / WebView in these paths (never were); AuthSession **removed**
- Step 9 polls on **focus + AppState active** (app reopen after external pay)

Evidence: `IOS_PLATFORM_SPLIT_FINDING.md`, `IOS_PLATFORM_SPLIT_EVIDENCE.json`, screenshots `*_ios_external.png`  
Tests: `billing-ios-platform-split.test.ts` — pass

---

## Prerequisite — Stripe Price IDs

| Env var | Status |
|---------|--------|
| `STRIPE_PRICE_CARE_PROGRAM` | **UNSET** |
| `STRIPE_PRICE_PLUS` | **UNSET** |
| `STRIPE_PRICE_AI_CREDIT_PACK` | **UNSET** |

Serving: `somo-middleware-00212-m4h` (cancel route mounted). Price IDs still unset.

---

## Steps 7–11 (post platform-split re-verify for 7/8/10)

| Step | Route | Verdict |
|------|-------|---------|
| 7 | `/billing/choose-plan` | **MATCH (untested checkout)** + iOS external note |
| 8 | `/billing/care-checkout` | **MATCH (untested checkout)** + `Continue in browser` |
| 9 | `/billing/subscribed` | **MATCH (untested checkout)** + reopen/AppState poll |
| 10 | `/capture/unlock-ai` | **MATCH (untested checkout)** + pricing + external CTA |
| 11 | `/billing/manage` | **MATCH (untested checkout)** (unchanged this pass) |

---

## Explicitly not started
- Section 3 Capture (Steps 12+)
