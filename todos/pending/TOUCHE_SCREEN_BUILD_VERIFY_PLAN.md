# Touche v4.1 — Screen-by-Screen Build & Verify Plan

**Updated:** 2026-07-19 (status sync after Sections 1–6)

**Design mock:** `docs/patient-app/design/touche_redesign_v4_complete.html` (34 frames)  
**Parity suite:** `middleware-platform/e2e/design-parity-medical-tracker.spec.cjs`

---

## Verification bar (how “done” is defined now)

**Automated suite bar (current):** Steps marked **DONE** below are green in
`npm run test:e2e:design-parity` — functionally wired, claim-safety / API-backed
where required. That is **not** full visual MATCH to the mock (hex/font/icon/screenshot
checklist).

**Visual MATCH bar (deferred):** Full mock↔live visual parity (pill CTAs, icon set,
font application, screenshot crops) is tracked as punch **VIS-WAVE5-01** — one end-of-build
sweep across all sections, not per-section. Do not block Section 7+ on it.

**Original STEP report format** (mock crop + live PNG + 7-item checklist) remains the
aspirational MATCH bar for Wave 5; until then, suite green + data rules apply.

**Data rule (Steps 3, 4, and 23–34):** Visual chrome without confirming the listed
endpoint returns **real** (not placeholder) data is a **FAIL**. Empty honesty states
still require the GET to run and return a truthful empty payload.

---

## Status summary

| Range | Status |
|-------|--------|
| Steps **1–14**, **16–28** | **DONE** (automated suite — functional / claim-safety / API) |
| Step **15** Region | **DEFERRED** — punch **CAP-REGION-01** |
| Steps **29–31** | **DONE** (automated suite — Progress/Alerts restyled + API) |
| Steps **32–34** | **DONE** (automated suite — Profile hub / share / allergens) |
| Template-shared states | **DONE** (automated suite — clone-from-parent) |
| Wave 5 visual sweep | **LOGGED** — punch **VIS-WAVE5-01** (do not start yet) |
| Wave 4 final gate | **NOT RUN** — wait for go-ahead |

**Flagged, not resolved:** Track hub still shows extra rows (Log / Daily check-in /
Gallery / Photos) beyond the mock’s minimal “Ready when you are” + FAB. Product
decision pending — punch **UI-TRACK-HUB-01**. Do not trim or keep as “final” until decided.

---

## Step 0 — Prerequisites

| Step | Item | Status |
|------|------|--------|
| 0a | Playwright full-screen baseline | Done (dated audit folder exists) |
| 0b | Wave 0 tokens / tulip / FAB / back-nav / tab icons | Done (primitives in use) |

---

## Steps 1–6 — Onboarding — **DONE** (suite)

| Step | Screen | Status | Notes |
|------|--------|--------|-------|
| 1 | Welcome | DONE | Suite: tokens + copy |
| 2 | Consent | DONE | Back-nav + cards |
| 3 | Why / persona | DONE | Persists concern_id |
| 4 | Plan preview (claim-safe) | DONE | Exact approved copy + ban-list |
| 5 | Sign in | DONE | |
| 6 | OTP entry (+ error) | DONE | |

---

## Steps 7–11 — Billing — **DONE** (suite; checkout may be untested)

| Step | Screen | Status | Notes |
|------|--------|--------|-------|
| 7 | Choose your plan | DONE | |
| 8 | Care checkout | DONE | Claim-safe verbatim; iOS external browser |
| 9 | Subscribed | DONE | Poll/reopen; Price IDs may be unset |
| 10 | Unlock AI | DONE | G-IAP / external path |
| 11 | Billing manage | DONE | |

If Stripe Price IDs unset: UI verified; live checkout untested — do not imply E2E pay.

---

## Steps 12–18 — Capture — **DONE except 15**

| Step | Screen | Status | Notes |
|------|--------|--------|-------|
| 12 | Track hub | DONE | White + red FAB; **see UI-TRACK-HUB-01** for extra rows |
| 13 | Photo / upload | DONE | `/capture` exists |
| 14 | Tag picker (6-tag) | DONE | Enum cross-check vs API |
| 15 | Region picker | **DEFERRED** | CAP-REGION-01; free-text confirm interim |
| 16 | Loading | DONE | Active-step copy only |
| 17 | Confirm — skin | DONE | Cancel → discard dialog |
| 18 | Cancel / discard | DONE | Discard + Keep editing |

---

## Steps 19–22 — Reveal / thesis / mark — **DONE** (suite)

| Step | Screen | Status | Notes |
|------|--------|--------|-------|
| 19 | Reveal | DONE | |
| 20 | Thesis (skin) | DONE | Exact claim-safe copy; FE hardcoded (not claim-safe API) — comments on all 6 tag variants |
| 21 | Mark picker | DONE | |
| 22 | Mark compare | DONE | Honesty + no-% DOM |

---

## Steps 23–25 — Calendar — **DONE** (suite)

| Step | Screen | Backend | Status |
|------|--------|---------|--------|
| 23 | Calendar — list | `GET …/records/calendar` | DONE |
| 24 | Calendar — month | same | DONE |
| 25 | Calendar — empty | same | DONE |

---

## Steps 26–28 — Shelf — **DONE** (suite)

| Step | Screen | Backend | Status |
|------|--------|---------|--------|
| 26 | Shelf — list | `GET …/shelf/products` + spend-summary | DONE |
| 27 | Shelf — empty | products empty ≠ load-failed | DONE |
| 28 | Shelf — Rx | No Buy; refill CTA | DONE (negative assertion green) |

---

## Steps 29–31 — Progress + Alerts — **DONE** (suite)

| Step | Screen | Mock frame | Backend (required) | Status |
|------|--------|-----------|--------------------|--------|
| 29 | Progress — populated | 29 | aggregates + calendar + marks + routine/template | DONE — no invented improvement % |
| 30 | Progress — empty | 30 | Same three GETs | DONE — empty ≠ load-failed |
| 31 | Alerts | 31 | `GET …/alerts/feed` | DONE — shop/verdict CTAs stripped |

---

## Steps 32–34 — Profile — **DONE** (suite)

| Step | Screen | Backend | Status / callouts |
|------|--------|---------|-------------------|
| 32 | Profile — hub | `…/me` + `…/routine/template` + `…/billing/subscription` | DONE — identity/plan/billing from GETs; sign-out clears session |
| 33 | Share with doctor | physician.pdf + physician-share | DONE — **both paths asserted**: real link success when API returns url; honest error when API fails (never fake OK). PDF uses binary fetch. |
| 34 | Allergens & notifications | allergens GET/POST; notifs local | DONE — allergen POST→GET round-trip; **notifications are local-only** (on-screen honesty) |

---

## After Step 34 — template-shared states — **DONE** (suite)

Clone chrome from named parent — verified individually (not assumed via inheritance).

| State | Clone from | Status / distinct assert |
|-------|------------|--------------------------|
| Camera denied | 13 | DONE — denial copy, not Step 13 capture chrome |
| Vision fail | 16 | DONE — failure copy + error_code; not spinner |
| Manual entry | 17 | DONE — TemplateFieldsForm per tag |
| Confirm — bill | 17 | DONE — `bill.default` fields |
| Confirm — rx | 17 | DONE — `prescription.medication` + shelf Yes/No; no Buy |
| Confirm — lab | 17 | DONE — `lab.result` fields |
| Confirm — other | 17 | DONE — `other.default` fields |
| Confirm — mark | 17 | DONE — `mark.default` + zone overlay |
| OTP error | 6 | DONE — resend posts `verify/send` |
| Get-the-app | 1 | DONE — Welcome tokens + tulip |
| Progress — bill-only | 29 | DONE — skin module omitted when aggregates omit skin |
| Calendar — day detail | 23 | DONE — API fact opens detail sheet |
| Shelf — OTC item | 26 | DONE — **OTC shows Buy; Rx sibling does not** (shared component, no leak) |
| OPQRST | 19–20 | DONE — restyle only |
| Routine nudge | 3–4 | DONE — restyle only |

---

## Wave 4 final gate — **RAN 2026-07-19**

```
node scripts/check-ios-no-inapp-checkout.cjs
cd middleware-platform && npm test -- --testPathPattern='claim-safe-preview-banned' --runInBand
cd middleware-platform && npm run test:e2e:design-parity
```

**Result:** all three PASS (design-parity 49/49). Phase A full-screen audit re-run: FAIL 6 → 4 (calendar + progress fixed as side effect; confirm bill/rx/lab + `/compare` still FAIL). Wave 5 visual sweep still deferred.

Do **not** mark Phase 6 in `TOUCHE_APP_STORE_V1_PLAN.md` complete until Wave 5 acceptance (or explicit waiver) plus known opens below are resolved or waived.

Narrate only on fail / judgment call / section go-ahead.

Phase 6 in `TOUCHE_APP_STORE_V1_PLAN.md` only when Steps 1–34 + template-shared are
suite-green **and** Wave 5 visual sweep is accepted (or explicitly waived).

---

## Execution rules

1. Remaining work waits on go-ahead: Wave 4 final gate, then Wave 5 visual sweep (**VIS-WAVE5-01**).
2. Automated suite = routine green; narrate on fail / judgment / section complete.
3. Flag mock deviations; don’t silently “improve” claim-risk copy.
4. If blocked, stop and report — don’t invent routes (Step 15 pattern).
5. Backend + real data on Steps 23–34: prove response shaped the UI.
