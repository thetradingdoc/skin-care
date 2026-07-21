# Touche redesign v4 ↔ backend gap review (2026-07-19)

**Design SSOT (locked):** [`docs/patient-app/design/touche_redesign_v4_complete.html`](../../docs/patient-app/design/touche_redesign_v4_complete.html) — **34 labeled frames** (v4.1: adds Photo/upload; real 6-tag; region flagged pending) + template-shared states.  
**Execution plan:** [`TOUCHE_SCREEN_BUILD_VERIFY_PLAN.md`](./TOUCHE_SCREEN_BUILD_VERIFY_PLAN.md) — evidence-gated Steps 0→34.  
**Supersedes for Wave 1+ UI:** `touche_final_all_screens.html` (45 frames) — kept in-repo as **legacy state matrix** only.

**Verdict:** v4.1 closes the Photo/upload + 6-tag mock gaps. Onboarding still needs **FE+BE** for persona save + claim-safe plan preview (not visual-only). Region route remains unconfirmed. Checkout ops-blocked on Stripe Price IDs.

---

## What v4 got right (vs live product direction)

| Area | Design | Backend / app |
|------|--------|----------------|
| Brand | `#E31919`, tulip, Be Bold, white Track hub + red FAB | Phase 6 tokens still orange in places — restyle only |
| Journey spine | Welcome → Consent → Why → Plan preview → Sign-in → OTP | Matches tool-first PIH direction; **live still capture-leaning** |
| Persona | Dark marks / acne / sensitive / general | Maps to `concern-routines.json` + `/api/public/routines/concerns` — **copy/API labels differ** |
| Claim-safe | Plan/thesis: habits, no fade timelines | Live thesis + JSON `expect` still claim-heavy — **rewrite required before surfacing** |
| Capture order | Track → Photo → Tag → Region (skin/mark) → Loading | Live: **Photo → Tag → Loading** (no region in path). Region only on legacy `track/capture` BodyMap — Step 15 stop-and-confirm |
| Shelf Rx | Refill-only, never Buy | Aligned with claim-safe Shelf rules |
| Monetization | Free / Plus / Care Program framed as tool | APIs exist (`care-program/checkout`, AI credit pack, Plus) — **prod Price IDs unset** |
| Profile | Billing row + plan change | Partial on Account; Billing management screen is new chrome |

---

## What you missed (design vs backend)

### A. Template-shared — intentionally not redrawn (must stay in gap matrix)

Footer says these share chrome; **do not drop from parity or Playwright**:

| State | Live route | Risk if ignored |
|-------|------------|-----------------|
| Camera denied | `/capture/camera-denied` | First-run dead end |
| Vision fail / retry | `/capture/vision-fail` | No manual escape in screenshots |
| Manual entry (6-tag) | `/capture/manual-entry` | AI-cap / denied escape |
| Confirm × bill/rx/mark/lab/other | `/capture/confirm/*` | Backend already 6-tag; design only shows skin |
| Reveal × non-skin | `/capture/reveal/*` | Same |
| Thesis × bill/rx/lab/other | `/capture/thesis/*` | Same |
| OTP error / resend | sign-in OTP path | Auth failure UX |
| Get-the-app interstitial | web / deep-link path | Web→native handoff |
| Calendar day detail | Calendar day state | Mixed-type day |
| Shelf OTC item | Shelf row detail | Buy OK for OTC |
| Progress bill-only | Progress state | Skin module must **hide**, not empty |
| Language stub | `/profile/language` | Gate item 4 |
| AI burst / welcome bonus | `/capture/ai-burst`, `welcome-bonus` | Meter edge cases |
| Capture 2a photo/upload | `/capture` | **Now drawn as frame 13** in v4.1 — verify route before inventing |

### B. Real capability mismatches (not just missing frames)

1. **Tag enum** — v4.1 mock now shows **six** tags (aligned with API). Live `/capture/tag` already has 6 — restyle + MATCH.
2. **Region picker not in capture machine** — Mock flags ⚠ pending. Live `body_location` only on BodyMap / confirm fields. **STOP at Step 15** until Phase A confirms path.
3. **Auth timing** — Design: auth before pricing/capture. Live: Progress lander post-auth; capture often available earlier. Decide one spine before Wave 1.
4. **“Why are you here” ≠ current concerns screen** — Live `onboarding/concerns` still says “12-week track” (claim-risk). Design personas (Dark marks / …) need API id mapping (`hyperpigmentation`, etc.) + claim-safe labels.
5. **Plan preview** — No dedicated live screen; closest is `routine/pick` + template POST. Design model B (plan as context) is correct; **do not ship JSON `expect` fade timelines**.
6. **OPQRST + routine nudge** — Still in live capture post-skin path; **confirmed keep** (template-shared) — restyle only, not hide.
7. **Alerts** — Design is honest reminders. Live `alerts.tsx` can still route toward shop/verdict paths — **claim-safe audit required**.
8. **Billing** — UI can match frames 7–11 today; checkout **fails** until `STRIPE_PRICE_CARE_PROGRAM`, `STRIPE_PRICE_PLUS`, `STRIPE_PRICE_AI_CREDIT_PACK` bound on serving revision. iOS Unlock still purchase-gated (G-IAP).
9. **Font** — Poppins ≠ Garet; licensing open (design flag, not backend).

### C. Explicitly out of store binary (design must not imply)

Conflict / Hard-no / interaction scores / “this is working” % — still suppressed. v4 is clean here. Do not reintroduce from Shelf/Alerts.

---

## 34-frame gap matrix (func × action) — v4.1

| # | Frame | Live route / state | Func OK? | Action |
|---|-------|--------------------|----------|--------|
| 1 | Welcome | `/welcome` | Yes | Restyle (tulip lockup, `#E31919` CTA) |
| 2 | Consent | `/capture/consent` (+ profile consent) | Yes | Restyle copy hierarchy |
| 3 | Why are you here | `onboarding/concerns` / `routine/pick` | Partial | **Rebuild FE+BE** — map concern IDs; save selection; kill “12-week” copy |
| 4 | Plan preview | Missing dedicated; API `…/routines/:id/preview` | Partial | **New screen** + claim-safe projection (no raw `expect`) |
| 5 | Sign in | `/sign-in` | Yes | Restyle |
| 6 | OTP entry | same | Yes | Restyle; OTP error template-shared |
| 7–11 | Billing cluster | Account / unlock-ai / checkout APIs | Ops-blocked prices | Visual MATCH; checkout untested if Price unset |
| 12 | Track hub | `/(tabs)/track` | Yes | White hub + red FAB |
| 13 | Photo / upload | `/capture` | Yes | Restyle (now in mock) |
| 14 | Tag picker (6-tag) | `/capture/tag` | Yes | Restyle; assert 6 tags |
| 15 | Region picker | Legacy BodyMap only | **No** | **DEFERRED post-Monday (2026-07-19)** — free-text confirm fields interim; see punch **CAP-REGION-01** |
| 16 | Loading | `/capture/loading` | Yes | Restyle |
| 17 | Confirm — skin | `/capture/confirm/skin` | Yes | Restyle + cancel |
| 18 | Cancel / discard | cancel paths | Partial | Restyle dialog |
| 19–22 | Reveal / Thesis / Mark picker / compare | `/capture/reveal|thesis|mark-*` | Yes | Claim-safe thesis copy |
| 23–25 | Calendar list/month/empty | calendar tab | Yes | Restyle |
| 26–28 | Shelf list/empty/Rx | shelf tab | Yes | Rx never Buy |
| 29–31 | Progress populated/empty + Alerts | progress + `/alerts` | Partial alerts | Strip shop/verdict |
| 32–34 | Profile / Share / Allergens+notif | account + profile/* | Yes | Billing row on hub |

Full numbered STEPs + evidence format: [`TOUCHE_SCREEN_BUILD_VERIFY_PLAN.md`](./TOUCHE_SCREEN_BUILD_VERIFY_PLAN.md).

---

## Legacy matrix note (superseded numbering)

Use the **34-frame** table above and [`TOUCHE_SCREEN_BUILD_VERIFY_PLAN.md`](./TOUCHE_SCREEN_BUILD_VERIFY_PLAN.md) Steps 1–34 as SSOT.

**Template-shared (must still ship):** camera-denied, vision-fail, manual-entry, confirm×5 non-skin, reveal/thesis non-skin, OTP error, get-app, OPQRST, routine nudge (**keep**), calendar day, shelf OTC, Progress bill-only, language, ai-cap/burst/bonus.

---

## Phase line-by-line (status / not done well / improve / missing)

### Phase A — Playwright baseline
- **Status:** Not started against v4.1.
- **Not done well:** Older audits target stale IA; button inventory still Home/Scan-shaped.
- **Improve:** Date a new folder; crawl 5-tab shell + capture + billing stubs.
- **Missing:** Button matrix JSON; FAIL/dead CTA list; journey smokes for Why→Plan→Auth.

### Phase B — Functionality inventory
- **Status:** FE+BE onboarding matrix now in the Cursor plan; formal `TOUCHE_FUNCTIONALITY_INVENTORY.md` still needed.
- **Improve:** One row per capability with endpoint + UI + Playwright + **v4.1 frame #**.
- **Missing:** Stripe env bind evidence; region-step ownership; Alerts claim-safe audit.

### Phase C — Design journey contract
- **Status:** SSOT **v4.1 (34 frames)** + evidence verify plan.
- **Not done well:** Prior pass missed Photo/upload frame (fixed in v4.1).
- **Improve:** Canonical spine = Welcome → Consent → Why → Plan → Auth → OTP → (optional plan paywall) → Progress; capture via Track → Photo → Tag → Region?.
- **Missing:** Region route confirmation; claim-safe plan preview FE.

### Phase D — Implement (waves → now numbered Steps)
- **0b / Wave 0:** Tokens `#E31919`, Manrope/Poppins, FAB, back headers — **not started**.
- **Steps 1–6:** Cold start + persona + plan preview — **rebuild FE+BE**, not paint.
- **Steps 7–11:** Billing — visual; checkout gated.
- **Steps 12–34 + template-shared:** Capture/tabs — evidence MATCH each.
- **Wave 4:** Parity suite 100% green before Phase 6 checkbox.
- **Wave 3:** Billing/AI — UI ok; **commerce gated**.
- **Wave 4:** Parity suite on 33 + template-shared landmarks.

### Phase E — Out of scope (unchanged)
Password auth; shop storefront; Hard-no/conflict in binary; BRAND-02 full sweep; Shopify product subs as Care Program.

---

## Backend ops blockers (not design bugs)

| Blocker | Effect |
|---------|--------|
| `STRIPE_PRICE_CARE_PROGRAM` / `PLUS` / `AI_CREDIT_PACK` unset on prod | Checkout frames cannot complete |
| iOS Unlock purchase OFF (G-IAP) | Frame 10 must not claim “buy” |
| Claim-unsafe `expect` strings in `concern-routines.json` | Must rewrite before Plan preview / Progress plan card |
| SEC-01 Stedi `test_` key | Unrelated to UI; still ship-gate |

---

## Immediate next (execution order)

1. Treat this file + v4 HTML as design contract.  
2. Phase A Playwright baseline (do not redesign first).  
3. Formal functionality inventory table.  
4. Expand gap matrix to **33 + template-shared** rows.  
5. Wave 0 tokens only after A–C exit criteria.
