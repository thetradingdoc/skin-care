# STEP 10 — AI credits / Plus unlock (re-verify — iOS platform split)

Mock reference: frame 10  
Live route: `/capture/unlock-ai`  
Backend: `POST …/ai/plus/checkout` + `…/ai/credits/checkout` → **`Linking.openURL`**

Mock: `…/STEP_10_mock_unlock_ai.png`  
Live (iOS external UX): `…/STEP_10_live_unlock_ai_ios_external.png`

## Finding (pre-fix)
Prior iOS path was **G-IAP full hide** (paused copy, no pricing CTAs). That is **not** “pricing + external-link CTA.” Corrected now.

## Current iOS behavior (evidence)
- Plus + 20-credit pack **pricing cards visible**
- CTA literal: **`Continue in browser — Plus`**
- Note: *Checkout opens in your browser. After you pay, return to the app — we confirm Plus from billing status.*
- Manual escape still present: **Log manually instead**
- No AuthSession / WebView / Elements

## Tests
`lib/__tests__/billing-ios-platform-split.test.ts` + updated unlock gate suite — **20/20 passed**

**Verdict: MATCH (untested checkout — Price ID unset)** — iOS platform split implemented + re-verified
