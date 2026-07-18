# App Store Readiness Report — Touche

**Date:** 2026-07-17  
**Product:** Touche (bundle `com.skinandcare.app`, ASC App ID `6778105762`)  
**Gate:** Phase F per `plan (2).md`  
**Live web host checked:** `https://app.trytouche.com`  
**Device build:** No new VoiceOver device session was performed in this phase (see §3). TestFlight / EAS profiles exist; this report does not invent a device pass.

This document is the submission gate. It is not a claim that everything is finished. Open items in §8 are binding for the submission decision.

---

## 1. Screenshot / CTA parity — v10 frames vs live app

### Count reconciliation

| Source | Count |
|--------|-------|
| On-disk `touche_v10.html` | **45** labeled `.tframe` cells (mock HTML still behind the app on 6-tag parity) |
| Plan (2) header | Claims **52** frames |
| Canonical inventory for this report | **51** frames — full six-tag confirm / reveal / thesis parity |

Plan’s **52** is treated as an off-by-one relative to “45 + six missing tag variants” (confirm other, reveal lab, real reveal other, thesis mark/lab/other). Live patient-app implements **all 51**. Screenshot parity therefore uses **route + UI state**, not 51 unique URLs.

Web verification base: `https://app.trytouche.com/app/…` (Expo export under `/app`). Device: same routes in the native shell; §3 VoiceOver remains open.

### Frame-by-frame inventory

#### Onboarding / capture machine

| Frame | Name | Live route | Web / device status | Notes |
|-------|------|------------|---------------------|-------|
| 0 | Welcome | `/welcome` | Present | Brand `touche`, product `Medical Tracker`, 20 AI reads line |
| 1 | Consent | `/capture/consent` | Present | Copy aligned to Privacy Policy in this phase (§7) |
| 2a | Capture | `/capture` | Present | Shared Track shutter entry |
| 2b | Camera denied | `/capture/camera-denied` | Present | |
| 2c | Vision fail | `/capture/vision-fail` | Present | |
| 2m | Manual entry | `/capture/manual-entry` | Present | Six tags |
| 3 | Tag it | `/capture/tag` | Present | |
| 4 | Loading | `/capture/loading` | Present | Orchestration gate + capture |
| 5-skin … 5-other | Confirm ×6 | `/capture/confirm/{skin,bill,rx,mark,lab,other}` | Present | HTML mock still missing `5-other`; app has it |
| 5b-skin … 5b-other | Reveal ×6 | `/capture/reveal/*` | Present | HTML mislabeled mark as other; app has real lab/other |
| 6-skin … 6-other | Thesis ×6 | `/capture/thesis/*` | Present | mark/lab/other in app, not in HTML mock |
| 7 | Auth | `/sign-in` | Present | |
| 7b | OTP entry | `/auth/otp-entry` | Present | |
| 7c | OTP error | `/auth/otp-error` | Present | |
| 8 | Get the app | `/get-the-app` | Present | |
| 9 | OPQRST-lite | `/capture/opqrst-lite` | Present | Skin-only, skippable |
| 10 | Routine nudge | `/capture/routine-nudge` | Present | Pick also `/routine/pick` |

#### Calendar tab

| Frame | Name | Live route | Status | Notes |
|-------|------|------------|--------|-------|
| T1 | Calendar month | `/(tabs)/calendar` | Present | `mode=month` |
| T1b | Calendar list | same | Present as **state** | Not a separate route |
| T2 | Day detail | same | Present as **state** | Modal / selected day |
| T2b | Calendar empty | same | Present as **state** | Empty when no days |

#### Shelf tab

| Frame | Name | Live route | Status | Notes |
|-------|------|------------|--------|-------|
| T3 | Shelf inventory | `/(tabs)/shelf` | Present | `GET /shelf/products` only (no demo inject) |
| T4-skincare | OTC item + Buy | same + shop/checkout | Present as **row CTA** | No `/shelf/[id]` PDP |
| T4-rx | Rx item never Buy | same + `/shelf/rx-refill-info` | Present | SSOT `shelf-commerce-cta` |
| T4b | Shelf empty | same | Present as **state** | |

#### Track / monetization

| Frame | Name | Live route | Status | Notes |
|-------|------|------------|--------|-------|
| T5 | Track → capture | `/(tabs)/track` → `/capture` | Present | |
| T5b | Daily AI suggests | `/capture/daily-ai-suggests` | Present | |
| T6 | AI cap | `/capture/ai-cap` | Present | |
| T7 | Welcome bonus | `/capture/welcome-bonus` | Present | |
| T8 | Unlock AI | `/capture/unlock-ai` | Present | **CTA broken** — see §5 |

#### Progress / Profile

| Frame | Name | Live route | Status | Notes |
|-------|------|------------|--------|-------|
| T9 | Progress populated | `/(tabs)/progress` | Present | Post-auth lander |
| T9-billonly | Progress bill-only | same | Present as **state** | Skin module gated |
| T9b | Progress empty | same | Present as **state** | |
| T10 | Profile hub | `/(tabs)/account` | Present | |
| T11 | Language | `/profile/language` | Present | Honest English-only stub |
| T12 | Share with doctor | `/profile/share-with-doctor` | Present | PDF + share |

### Frames with no corresponding live screen

**None of the 51 canonical frames lack a live screen.** Several are states on a shared tab route (Calendar list/day/empty, Shelf empty, Progress empty/bill-only, Shelf OTC/Rx row CTAs). That is intentional IA, not a missing product surface.

**Mock HTML lag (not an app gap):** `5-other`, `5b-lab`, real `5b-other`, `6-mark`, `6-lab`, `6-other` exist in the app and are absent or mislabeled in `touche_v10.html`.

**Related retired paths (not v10 frames):** `/check`, `/severity`, `/_journal`, `/track/[spotId]` are Redirect stubs into capture / calendar / mark-compare (Phase D).

---

## 2. Backend-integration proof table (Phases A–D)

“Verified” here means a **test that exercises a real side effect** (HTTP/DB/orchestration), or is explicitly marked **wiring-only** where that is all that exists. Failures under default AV without bypass are called out.

| Screen / surface | Backend endpoint(s) | Test that proves effect (or best available) | Pass / fail / gap |
|------------------|---------------------|---------------------------------------------|-------------------|
| Capture loading (AI orchestrate) | `POST …/records/capture/gate`, `POST …/records/capture` | `middleware-platform/__tests__/phase-b-capture-confirm.test.js`, `patient-records-http.test.js`; client `phase-b-capture-orchestration.test.ts` | **PASS** (effect). `capture-orchestration.test.js` needs `PATIENT_RECORD_AV_DEV_BYPASS=1` or fails AV |
| Confirm ×6 | `POST …/records/:id/confirm` | `phase-b-capture-confirm.test.js`, `confirm-field-edit-persist.test.js`, `patient-records-http.test.js` | **PASS** |
| Six-tag structurers | capture orchestration services | `capture-orchestration.test.js` (`structureByTag` ×6) | **PASS** with AV bypass |
| Reveal ×6 / Thesis ×6 | none (UI after confirm) | `p7-18-23-reveal-screens.test.ts` | Wiring **PASS** — no backend effect by design |
| Mark picker / compare | `GET …/marks`, `GET …/marks/compare-group/:id` | `track-marks-calendar-progress-same-row.test.js` | **PASS** |
| Progress (T9) | `GET …/progress/aggregates`, `GET …/records/calendar`, `GET …/marks` | `progress-calendar-same-facts-row.test.js` | **PASS** |
| Calendar (T1) | `GET …/records/calendar` | same + `p7-26-30-calendar.test.ts` wiring | Effect **PASS** |
| Track list | `GET …/marks` | `track-marks-calendar-progress-same-row.test.js` | **PASS** |
| Share with doctor (T12) | `GET …/export/physician.pdf`, `POST …/export/physician-share` | `phase-a-t12-physician-export.test.js` | **PASS** |
| Profile / Track AI usage chip | `GET …/ai/usage` | `ai-capture-meter.test.js` (service); screen is source-wiring only | Service **PASS**; screen→HTTP **GAP** |
| Unlock AI (T8) | `POST …/ai/credits/checkout` | monetization route tests exist; screen does not open checkout URL | Screen integration **FAIL** for real checkout (§5) |
| try-allergens → evaluate | `POST /api/public/routine/evaluate` | `mapPrimary-false-safe.test.cjs`; evidence script `public-try-evaluate.evidence.js` | mapPrimary **PASS**; evaluate HTTP via evidence script, not vitest |
| try-reveal false-safe | stashed verdict + optional `GET …/commerce/status` | `mapPrimary-false-safe.test.cjs` | **PASS** (adversarial: unknown/error ≠ Safe) |
| Shelf tab | `GET …/shelf/products`; Ask/Learn `POST …/shelf/ask-learn` | `phase-c-rx-never-buy.test.ts` / `.js` | CTA SSOT **PASS**; full HTTP Buy-hidden E2E **GAP** |
| Shop catalog / PDP | `GET …/shop/catalog`, `GET …/shop/products/:handle` | `phase-c-rx-never-buy.test.js` (Rx fixture excluded from browse) | Classification **PASS**; PDP Buy-hidden HTTP **GAP** |
| Verdict / barcode depth | shelf products + client SSOT | `phase-c-rx-never-buy.test.ts` | Unit **PASS**; scan→verdict HTTP **GAP** |
| check / severity retired | none (Redirect → `/capture`) | `phase-d-legacy-retirement.test.ts` | Wiring **PASS** |
| `_journal` retired | Redirect → calendar | `phase-d-legacy-retirement.test.ts` | Wiring **PASS** |
| track/[spotId] retired | Redirect → mark-compare | `phase-d-legacy-retirement.test.ts` | Wiring **PASS** |
| Track capture dual-write stopped | `POST …/records/capture` only | `phase-d-legacy-retirement.test.ts` (no `createSpot` writers) | Wiring **PASS**; live “spots not inserted” HTTP **GAP** |
| Routine overlay prior photo | `GET …/records/calendar` (not journal calendar-range) | `phase-d-legacy-retirement.test.ts` | Wiring **PASS** |

### Gaps that still matter for “verified”

1. Profile/Track AI meter UI has no HTTP assertion that the meter row reflects the API.  
2. Unlock-AI screen does not prove checkout URL open.  
3. Shop PDP / barcode Buy absence for Rx is SSOT-unit, not HTTP E2E.  
4. Phase D redirects are source contracts, not live router E2E.  
5. Several orchestration suites are AV-environment fragile without bypass.

---

## 3. p8-12 real device VoiceOver pass — **BLOCKED (no device in session)**

This item does **not** close from CI, and it was **not** completed in this close-out either.

**Attempt (2026-07-17):** `idevice_id -l` returned no paired devices; Xcode `simctl` is not available in this environment (`xcrun: unable to find utility "simctl"`). No physical iPhone/iPad was attached for a VoiceOver session.

**What exists instead:** P8.09 CI source contracts (labels / tap targets / Dynamic Type floor on shell + onboarding). That is a regression floor only.

**Navigability findings from a real device VoiceOver session:** *none — session could not be run. Blocked on hardware access, not waived.*

**Status for submission:** **BLOCKED / OPEN**. Requires a human with a physical device: VoiceOver on through Welcome → consent → capture → OTP → Progress, then Calendar, Shelf, Track, Progress, Profile, with findings written here.

---

## 4. Permissions audit

### What is requested, and when

| Permission | Rationale (source) | When requested | Matches Privacy Policy? |
|------------|-------------------|----------------|-------------------------|
| **Camera** | `app.json` `NSCameraUsageDescription` / expo-camera plugin — journal capture for skin, prescriptions, bills, marks, labs, other | Point of use in `capture/index.tsx` (and track/routine capture) on Take photo — **not** at launch | **Yes** after this-phase copy update (was “daily progress photos” only; that underspecified six-tag medical journal use) |
| **Photo library** | `NSPhotoLibraryUsageDescription` / image-picker — upload a capture instead of camera | Point of use on Upload/pick — **not** at launch | **Yes** after same update |
| **Notifications** | No dedicated Info.plist usage string in `app.json`; in-app copy on Profile notifications | Opt-in from Profile (“Allow notifications”) via `push-reminders.ts` — **not** at launch. `registerPushDeviceToken` is defined but not wired from launch | Aligns with “only if you opt in.” In-app blurb updated to say “capture” not retired “Check photos.” |

`_layout.tsx` does not request camera, library, or notification permission on cold start.

### Cross-check vs live Privacy Policy (`https://app.trytouche.com/privacy`)

Privacy states captures are photos/PDFs the user chooses; no ad SDKs; AI optional; AV on medical uploads. Permission rationales now describe journal capture, not advertising. **Aligned.**

**Ship note:** Updated `app.json` strings apply to the **next native binary** build. The web host does not show iOS permission sheets. Submission must use a build that includes these Info.plist strings.

---

## 5. Dead-functionality sweep

Checked: Shelf Ask/Learn, Rx refill, shop Buy, profile hub rows, try-reveal commerce, Alert stubs, empty `onPress`, “coming soon” UI strings.

### Working (not dead)

- Ask/Learn → `POST /api/patient/shelf/ask-learn` with reply text on error.  
- Rx refill → `/shelf/rx-refill-info`.  
- Profile Language / Share / Alerts / Notifications / Consent → real routes.  
- Shop Buy → checkout handoff when commerce on and Buy allowed.

### Dead or defective CTAs (full list)

**Fixed in Phase F close-out (adversarial tests in `phase-f-cta-fixes.test.ts`):**

1. ~~Unlock AI “Choose”~~ — now `Linking.openURL(res.url)` or visible `unlock-checkout-error`; no silent Profile navigate.  
2. ~~try-reveal “Swap / Buy →”~~ — requires `variantId`/`handle` via `checkoutHandoffHref`; otherwise blocked CTA + `reveal-buy-error`.  
3. ~~Shelf `$24.00` fallback~~ — missing `priceLabel` shows `shelf-buy-price-unavailable`, never a fabricated price.  
4. ~~Unknown classification fail-open Buy~~ — `canShowBuyCta` fail-closed (same allowlist as barcode-depth); empty/`treatment` never Buy.

**Still open:**

1. **Progress “See day 1 vs today →”** (`(tabs)/progress.tsx`) — navigates to `/compare`, which loads **legacy journal/routine compare**, not `patient_record_facts`. **Miswired relative to Progress facts SSOT.** (Not in this fix batch.)

2. **Language stub** (`profile/language.tsx`) — honest “more app languages coming”; Done works. Unfinished surface, not a dead button.

**No empty `onPress` stubs or “Coming soon” dead ends found** beyond the language honesty line. Prior Ask/Learn and Rx-refill dead buttons are fixed.

---

## 6. Crash / error-path check

For screens in §2 with real backend calls:

| Screen | Failure handling | Verdict |
|--------|------------------|---------|
| Capture loading | Orchestration maps failure → vision-fail / ai-cap / etc. routes | **Handled** |
| Confirm ×6 | `use-capture-confirm` sets error text | **Handled** |
| try-allergens | `setError` + visible red text | **Handled** |
| Share with doctor | Status text on catch | **Handled** (error styling weak — still green “safe” token) |
| Unlock AI | Silent catch; navigates away | **Missing** |
| Shelf tab | `catch { setProducts([]) }` | **Missing** — network/500 looks like empty inventory |
| Calendar | `catch { setDays([]) }` | **Missing** — looks like empty month |
| Progress | `.catch(() => null/[])` on loads | **Missing** — looks like empty Progress |
| Mark compare | `catch { setEntries([]) }` | **Missing** — “No photos…” |
| Progress alerts module | catch → empty | **Missing** |

**Implication:** Tab shells fail closed into empty states. That avoids crashes and hangs, but **hides outages** as “you have no data.” Unlock AI is worse: it pretends success. Submission risk is product trust more than process crash, except Unlock AI / try-reveal Buy which are actively misleading.

---

## 7. Data-practice consistency check

### Sources compared

- Live Privacy Policy: `https://app.trytouche.com/privacy` (redeployed this phase with training sentence).  
- In-app: `capture/consent.tsx`, `profile/consent-privacy.tsx` (updated this phase).  
- Behavior: six-tag capture, AI orchestration, AES-256-GCM without KMS, 90/30 retention job, ClamAV fail-closed.

### Drift found and fixed in this phase

| Drift | Fix |
|-------|-----|
| Consent omitted AI, encryption/KMS, 90/30 retention, AV, six tags | Both consent bodies now state those practices and point to Privacy Policy |
| Capture consent claimed “no training outside models”; Privacy omitted it | Privacy AI section now states uploads are **not** used to train outside (third-party) models; both consents use the same claim |
| Profile vs capture consent split | Bodies unified |
| Notifications copy still said “Check photos” | Updated to “capture” |
| Camera/library Info.plist still “daily progress photos” only | Updated to six-tag journal language (next native build) |

### Remaining honesty notes (not contradictions)

- Consent screens summarize; Privacy Policy remains the long-form SSOT (linked from both UIs).  
- In-app consent changes ship with the next patient-app web/native deploy; Privacy Policy text is **already live**. Until the next app hosting deploy that includes rebuilt Expo JS, web consent screens may still show the shorter pre-fix strings while Privacy is current. **Native binary** also needs a new EAS build for Info.plist + consent bundle.

---

## 8. Known open items (honest state)

These are not footnotes. They are the product state you are choosing to accept or block on.

1. **Encryption key rotation / KMS — not built.** Application-layer AES-256-GCM exists; no customer-managed rotation/KMS workflow; rotating keys needs a migration tool that does not exist. Disclosed in Privacy Policy and architecture docs. **Accepted risk if submitted as disclosed.**

2. **`capture_token` residual race.** Binding at `verify/send` closed possession-only claim. Attacker who calls `verify/send` **first** with a stolen token can still bind it to their OTP session (`pending-capture-claim.js` / architecture § Anonymous capture_token). **Open security residual.**

3. **OBF / barcode Rx classification limitation (Phase C) — partially closed.** Client Buy gate is now **fail-closed** for unknown classification (empty / `treatment` default / non-skincare), matching barcode-depth (`hasKnownBuyableClassification` / `canShowBuyCta`). Residual: OBF may still mis-tag a true Rx as skincare text — that remains a catalog-quality risk, not fail-open-on-unknown.

4. **Phase D API-sunset leftovers.** Product dual-write from patient-app track capture is stopped; Redirect stubs in place. Still pending cleanup: orphaned `components/journal/*`, unused spot UI cards, middleware `dualWriteSpotMark` if any non-app client still posts spots snapshots. **Not blocking UI paths; still open debt.**

5. **Shopify Support URL interim (Phase E).** ASC Support URL is `https://app.trytouche.com/welcome` until `trytouche.com` Shopify is confirmed stable. Marketing apex remains Shopify; myskinandcare **301**s live. **Open ops follow-up, not a Privacy URL blocker.**

6. **p8-12 VoiceOver device pass — BLOCKED** on no attached device in this session (§3). Still required before treating a11y as cleared.

7. **Dead / miswired CTAs:** Unlock AI, try-reveal Buy, $24 fallback, unknown-Buy **fixed**. Progress compare → legacy journal **still open**.

8. **Tab error UX (§6):** Shelf / Calendar / Progress failures masquerade as empty. **Open polish / trust issue.**

9. **Test gaps (§2):** No HTTP E2E for Rx Buy absence on PDP; Phase D redirects wiring-only; AI meter screen HTTP gap; AV bypass fragility in some suites.

10. **Expo display name** in `app.json` still includes “Skin Journal” in `expo.name` while ASC Name draft is `Touche`. Align before store listing freeze.

11. **Mock HTML** still 45 frames; app is on 51. Update mock when convenient — does not block binary, does confuse future screenshot passes.

---

## Submission recommendation

| Gate | Result |
|------|--------|
| Privacy Policy URL live with required disclosures | **Met** (`https://app.trytouche.com/privacy`) |
| Terms live | **Met** |
| Metadata drafted vs real Apple docs | **Met** (runbook) |
| v10 frame coverage in app | **Met** (51; states on shared routes) |
| Backend proof for core capture / facts / Rx CTA SSOT / false-safe | **Mostly met** with named gaps |
| VoiceOver device pass | **Not met — BLOCKED** (no device attached) |
| Dead CTA list empty | **Mostly met** — Progress compare → legacy journal still open |
| Consent ↔ Privacy ↔ behavior | **Aligned in source + live Privacy**; app bundle redeploy/native build still required for in-app consent + Info.plist |
| Honest open-items list | **This §8** |

**Decision for the reader:** Touche is closer to App Store *materials* readiness (legal URLs, metadata draft, core capture/facts architecture, Phase E SEO/redirects) than to *product* readiness for a clean review. Blocking for a responsible submit, unless explicitly accepted: **§3 VoiceOver**, **§5 Unlock AI / false Buy / Progress compare**, and conscious acceptance of **§8 items 1–3** (KMS, capture_token race, OBF Rx default).

Phase F report ends here. Closing the build means either fixing the blockers above or recording an explicit human waiver against named open items — not marking them done.
