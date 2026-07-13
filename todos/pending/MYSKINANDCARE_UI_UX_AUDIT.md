# myskinandcare × touche labs — UI/UX Audit Report

**Generated:** 2026-07-12  
**Brand lens:** *“We don’t just sell you a serum — we prove it’s working.”*  
**Method:** Playwright Chromium @ 390×844 against:
1. Live `https://myskinandcare.com` (and www)
2. Local Expo **web** export of `patient-app` at `/app/*` with stubbed patient APIs  
**Artifacts:** [`ux-audit-artifacts/`](ux-audit-artifacts/)  
**Re-run:** `node scripts/playwright-myskinandcare-ux-audit.cjs`

### Limit (read this first)

Playwright **cannot** attach to the native TestFlight binary. This audit covers the same expo-router screens/components iOS uses, rendered as Expo web. Camera shutter, SecureStore kill-behavior, and true device performance still need a **physical TestFlight smoke**.

---

## Executive summary (5 bullets)

1. **`myskinandcare.com` is down** — Firebase Hosting “Site Not Found” (HTTP 404) on `/` and `/scan`. Acquisition front door is broken. `trytouche.com` and `api.callsomo.com` respond 200.
2. **In-app shell works** — Home / Track / Scan / Progress / Profile render with Gloock + cream palette; tab bar is clear; clinical disclaimer present on Home/Track.
3. **Proof brand is not in the UI** — no “prove it’s working,” no honest week timeline as hero, no Day-1 vs Today compare CTA on Progress. Habit/BFI dominate.
4. **touche labs is invisible in-app** — zero shop CTAs, zero “Recommended by touche labs™,” Profile has care_program Stripe but not Skin collection.
5. **Soft-launch demo risks remain in code** — watch default → journal 503; stale Progress after photo; library URI kill; offline `/me` → empty Home (see codebase audit / PR1).

| Severity | Count (this run) |
|----------|-----------------:|
| critical | 2 (live host down + acquisition offline) |
| high | 8 |
| medium | 9 |
| low | 3 |
| working / pass | noted below |

---

## Live hosts

| URL | Result | UX impact |
|-----|--------|-----------|
| `https://myskinandcare.com/` | **404** Firebase “Site Not Found” | Cannot acquire users; App Store privacy/terms URLs also at risk |
| `https://www.myskinandcare.com/` | **404** same | Same |
| `https://myskinandcare.com/scan` | **404** | Check-your-skin hook offline |
| `https://trytouche.com/` | **200** Shopify live | Store works; journal cannot deep-link yet |
| `https://api.callsomo.com/health/live` | **200** | API up for TestFlight builds |

**Ops task (before marketing):** deploy consumer hosting / finish Firebase custom domain for `myskinandcare` site (`deploy:consumer-hosting` / DNS checklist in brand repo docs).

---

## Screen-by-screen (iOS shell — Playwright + screenshots)

### Home — `/(tabs)/home` — [`app-home.png`](ux-audit-artifacts/app-home.png)

**Working**
- Greeting + week kicker (`Day 15 · Week 3 of 12`)
- BFI ring (62), conflict chip, streak, daily photo black CTA
- Tab bar: Home / Track / Scan / Progress / Profile
- Disclaimer: “Not a diagnosis…”

**Broken / weak UX**
| Issue | Where it comes from | Severity |
|-------|---------------------|----------|
| Barrier copy repeated 3× (“under mild stress” / “Under stress” / “Barrier under stress”) | `home.tsx` + evaluate `hero_title` / `barrier_label` / subtitle all rendered | **HIGH** |
| Grammar: “1 conflicts” | Metric chip pluralization in `MetricChipRow` / home chips | **MEDIUM** |
| Duplicate photo CTAs (“Log today’s photo” NextAction + “Take today’s photo” card) | `NextActionCard` + `DailyPhotoCta` both on today | **MEDIUM** |
| Flame emoji streak pill | `home.tsx` streakPill | **MEDIUM** (brand noise) |
| No proof headline / no touche rec | Missing product UI | **HIGH** vs brand strategy |
| No honest timeline callout (phase.expect exists in API stub but buried) | Anticipation card only when not logged — easy to miss | **HIGH** retention |

**Buttons**
| Control | Function | Status |
|---------|----------|--------|
| Suggested “Log today’s photo” | Next action → capture | Works (redundant) |
| Conflicts chip | → Scan | Works |
| Take today’s photo | → `/routine/capture` | Works (when template) |
| See all (photo history) | → Progress | Works |
| More about this phase | Expand notes | Works |

---

### Track — `/(tabs)/track` — [`app-track.png`](ux-audit-artifacts/app-track.png)

**Working**
- Clear ATM hierarchy: Take photo (black) / Upload gallery / See photos
- Plain-language copy; disclaimer good
- Best-aligned screen with “proof over time” for **spots**

**Broken / weak UX**
| Issue | Source | Severity |
|-------|--------|----------|
| “We’ll measure and watch it” overclaims — snapshot analysis is **heuristic**, not CV measurement | `track.tsx` copy + `spot-snapshot-service.js` | **HIGH** trust |
| Gallery upload uses pending URI (native kill loses photo) | `pending-capture-uri.ts` | **CRITICAL** demo (code) |

---

### Scan — `/(tabs)/scan` — [`app-scan.png`](ux-audit-artifacts/app-scan.png)

**Working**
- Add product FAB / shelf path present
- Conflict engine wedge matches positioning (“safety check”)

**Broken / weak UX**
| Issue | Source | Severity |
|-------|--------|----------|
| Empty shelf states need stronger empty CTA in stub | `scan.tsx` | **LOW** |
| No bridge to “buy touche” after avoid/caution | Phase 3 missing | **MEDIUM** |

---

### Progress — `/(tabs)/progress` — [`app-progress.png`](ux-audit-artifacts/app-progress.png)

**Working**
- Streak hero (4 days) — good for retention habit
- Improvement bars (redness / clarity / skin age) when metrics exist
- Photo timeline thumbs + “See all”

**Broken / weak UX**
| Issue | Source | Severity |
|-------|--------|----------|
| Subtitle “Small changes. **Real results.**” overclaims | `progress.tsx` | **MEDIUM** — fights proof brand honesty |
| Barrier 8-day grid empty placeholders while other metrics show — looks broken | `BarrierGrid8` + verdict history stub/empty | **HIGH** |
| Timeline labels “Day 1 / 10 / 11 / Today” confusing | date formatting in progress thumbs | **MEDIUM** |
| **No Compare CTA** for Day 1 vs today — compare route exists but under-promoted | `compare.tsx` not linked as hero | **HIGH** retention unlock |
| Calendar icon → Home, not a real calendar | `progress.tsx` `onPress` → `HOME_HREF` | **MEDIUM** |

---

### Profile — `/(tabs)/account` — [`app-account.png`](ux-audit-artifacts/app-account.png)

**Working**
- Journey toggles (diary / routine / spot) visible
- Subscribe / Edit skin profile / Change journey
- care_program software path present

**Broken / weak UX**
| Issue | Source | Severity |
|-------|--------|----------|
| No Shop / touche labs / trytouche link | not built | **MEDIUM** |
| care_program can be confused with product subscription | copy on Account | **MEDIUM** — keep separate in copy |

---

### Journey choose / Sign-in / Routine pick / Compare

Playwright run with a **pre-seeded session** redirected several deep links to Home (session gate). Treat functional status from code + prior inventories:

| Screen | Working? | Notes |
|--------|----------|-------|
| Sign-in OTP | Yes (prior e2e) | Needs `?error=connection` (PR1) |
| Journey choose | Yes | **Defaults watch** — soft-launch hazard until PR1 |
| Routine pick | Yes | Concern cards; no serum map |
| Compare | Exists | Must become Progress hero CTA |

---

## Brand strategy vs UI (gap matrix)

| Strategy claim | In UI today? | Task |
|----------------|--------------|------|
| Prove the serum is working | No | Home/Progress proof framing + compare |
| Daily photo = anchor habit | Partial (streak + CTA) | Deduplicate CTAs; kill emoji; celebrate refresh (PR1) |
| Honest timelines (8–24 weeks) | Buried in phase notes | Surface `phase.expect` as Day-1 banner |
| Week-4 comparison unlock | Compare route only | Progress hero: “See day 1 vs today” |
| touche labs recommendations | No | PR3 serum cards |
| Beauty-from-within Body | No | Phase 5 after serums |
| Landing acquisition | **404** | Deploy Firebase consumer site |
| SEO keywords (tracker / before-after) | N/A while site 404 | Landing + App Store listing after host live |

---

## What is working (keep)

- v3 five-tab IA (Home / Track / Scan / Progress / Profile)
- Typography (Gloock display + DM Sans) and cream page bg
- Photo-first routine day model (one photo = day)
- Track ATM simplicity
- Scan as safety check (positioning-aligned)
- Clinical disclaimers on key surfaces
- API health + Shopify storefront live

---

## What is not working (fix order)

### P0 — blocks any soft launch

1. Deploy / fix **myskinandcare.com** Firebase hosting (404).  
2. **PR1** path safety (journal hide, routine default, pending URI, `/me`, refresh).  
3. Physical TestFlight smoke on device.

### P1 — proof brand / retention UX

4. Progress: primary **Compare day 1 ↔ today** button → `/compare`.  
5. Home: collapse triple barrier copy; fix “1 conflicts”; one photo CTA.  
6. Home: show honest timeline from `phase.expect` / total_weeks.  
7. Progress: replace “Real results” with proof-honest subtitle.  
8. Track: soften “measure” copy → “log and compare over time.”

### P2 — touche / revenue UI

9. Home phase card: “Recommended by touche labs™” (PR3 matrix).  
10. Profile + landing footer: Shop Skin collection.  
11. Proof line on landing once host is live.

### P3 — polish

12. Remove flame emoji; brand-safe streak chip.  
13. Timeline date labels (consistent relative days).  
14. Calendar button → real calendar or remove.  
15. Empty BFI grid empty-state copy (“Log photos to unlock”).

---

## UI/UX task checklist (execution)

- [ ] **UX-HOST** Deploy consumer Firebase so myskinandcare.com ≠ Site Not Found  
- [ ] **UX-PR1** Soft-launch path safety (see PR1 plan)  
- [ ] **UX-COMPARE** Progress hero CTA → `/compare` (week 1+ / day 7+)  
- [ ] **UX-TIMELINE** Home banner: concern-specific week expectation  
- [ ] **UX-BFI-COPY** Deduplicate barrier strings; pluralize conflicts  
- [ ] **UX-PHOTO-CTA** Single daily photo CTA on Home  
- [ ] **UX-PROGRESS-COPY** Honest subtitle (drop “Real results”)  
- [ ] **UX-TRACK-COPY** Remove “measure” overclaim  
- [ ] **UX-PROOF-LANDING** Proof line + #1 Journal + touche footer (after host live)  
- [ ] **UX-TOUCHÉ-HOME** Serum rec cards (PR3)  
- [ ] **UX-STREAK** Non-emoji streak  
- [ ] **UX-TF-SMOKE** Human TestFlight: OTP → routine → photo → Progress → Compare  

---

## Playwright method notes

- Script: [`scripts/playwright-myskinandcare-ux-audit.cjs`](../../scripts/playwright-myskinandcare-ux-audit.cjs)  
- Session stub caused some routes to land on Home — deep-link coverage is partial; screenshots for Home/Track/Scan/Progress/Account are reliable.  
- Older [`docs/audits/MOBILE_BUTTON_INVENTORY.md`](../../docs/audits/MOBILE_BUTTON_INVENTORY.md) is **stale** (Today/Plan tabs) — do not use as SSOT.

---

## Bottom line for Jay

The **product idea matches the customer** (proof > hype). The **current UI still sells habit + BFI**, not proof + touche. Worst operational finding: **the marketing domain is a Firebase empty site.** Fix hosting + PR1, then make Compare + honest timelines the retention spine, then serum CTAs. Native TestFlight remains mandatory — Playwright does not replace it.
