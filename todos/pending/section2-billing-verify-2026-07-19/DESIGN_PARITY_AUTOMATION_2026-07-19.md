# Design-parity automation — built + Sections 1–2 retroactive run

**Date:** 2026-07-19  
**Status:** Suite green on Sections 1–2. **Not starting Capture** until you confirm.

---

## What was built

| Artifact | Purpose |
|----------|---------|
| `middleware-platform/e2e/design-parity-medical-tracker.spec.cjs` | Playwright assertions (tokens, back-nav, copy, routes, persona persist, claim-safe) |
| `middleware-platform/playwright.design-parity.config.cjs` | Boots Expo web + forces external-checkout CTA copy |
| `middleware-platform/e2e/helpers/design-parity-assert.cjs` | `getComputedStyle` hex checks, back-nav, banned-claim helpers |
| `scripts/check-ios-no-inapp-checkout.cjs` | Static CI gate: no AuthSession / WebView / Stripe Elements outside allowlist |
| `middleware-platform/__tests__/claim-safe-preview-banned.test.js` | Backend claim-safe banned-string unit tests |
| CI hooks | `ci.yml` + `skin-care-mobile.yml` run the static gate (+ claim-safe unit on mobile workflow) |

**Run:**
```bash
node scripts/check-ios-no-inapp-checkout.cjs
cd middleware-platform && npm test -- --testPathPattern='claim-safe-preview-banned' --runInBand
cd middleware-platform && npm run test:e2e:design-parity
```

---

## Retroactive Sections 1–2 — results

### Static / unit
| Check | Result |
|-------|--------|
| `check-ios-no-inapp-checkout` (299 files) | **PASS** |
| `claim-safe-preview-banned` (5 tests) | **PASS** |

### Playwright `test:e2e:design-parity` — **12/12 PASS** (~50s)

| # | Assertion | Result |
|---|-----------|--------|
| 1 | Welcome — `#FFFFFF` bg, `#E31919` CTA, Be Bold. copy | PASS |
| 2 | Consent — back-nav DOM, 3 cards, `#0B0B0C` CTA | PASS |
| 3 | Why — 4 personas → `pending_routine_concern` + `onboarding_concern_id` | PASS |
| 4 | Plan preview — claim-safe honesty, no banned timelines | PASS |
| 5 | Sign-in — back-nav + white bg | PASS |
| 6 | OTP entry + error — back-nav | PASS |
| 7 | Choose plan — Free/Plus/Care + black CTA | PASS |
| 8 | Care checkout — verbatim dermatologist claim + Continue in browser | PASS |
| 9 | Subscribed — no fake success on free stub | PASS |
| 10 | Unlock AI — Plus + pack cards visible | PASS |
| 11 | Billing manage — plan card + payment row | PASS |
| API | Live `…/preview/claim-safe` ×4 concerns, no `"expect"` / banned strings | PASS |

---

## Going forward (your model)

- After each Capture+ step: run `npm run test:e2e:design-parity` (extend the spec per new screen).
- **No narrated MATCH reports** for routine greens — suite pass is the evidence.
- Human report only when: (a) suite fails / needs a decision, (b) subjective visual call, or (c) section fully green → ask go-ahead for next section.

**Ready to start Section 3 under this automated model when you confirm.** Still waiting.
