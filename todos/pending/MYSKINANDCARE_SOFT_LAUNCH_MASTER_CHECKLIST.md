# Soft launch master checklist (repo mirror)

**Cursor plan:** `~/.cursor/plans/pr1_soft-launch_safety_2208da17.plan.md`  
**Brand SSOT:** [`MYSKINANDCARE_BRAND_CONSISTENCY.md`](MYSKINANDCARE_BRAND_CONSISTENCY.md)


# Soft launch → TestFlight → first users (master plan)

**Last updated:** July 12, 2026  
**Goal:** First TestFlight push to real device with working photo loop + serum CTA  
**Brand truth (myskinandcare):** *"We don't just sell you a serum — we prove it's working."*  
**Brand truth (touche labs™):** *"Science-backed supplements and skincare."*  
**Brand architecture:** myskinandcare = relationship; touche labs™ = lab that proves it — they complete, never compete.  
**Architecture SSOT:** repo `ARCHITECTURE.md` — Expo iOS `com.skinandcare.app`, Firebase `myskinandcare`, API `api.callsomo.com` / `api.myskinandcare.com`, EAS TestFlight, Stripe `care_program`, face-read inference separate.  
**Repo mirror:** `todos/pending/MYSKINANDCARE_SOFT_LAUNCH_MASTER_CHECKLIST.md`

## Task totals (one ID = one todo — not grouped)

| Status | Count |
|--------|------:|
| **Total tasks** | **171** |
| Pending | 165 |
| Completed | 6 |

| Block | IDs | Count |
|-------|-----|------:|
| 0 Ops & hosting | OPS-1…8, SHOP-1…5, ENV-1…4 | 17 |
| 1 PR1 path safety | PR1-1…26, PR1-V1…V7 | 33 |
| 2 Branding & UI | UX-1…11, BRAND-1…10, ASO-1…8 | 29 |
| 3 TestFlight & smoke | TF-1…8, SMOKE-1…14 | 22 |
| PR2 Skin-age (arch gap) | PR2-1…4 | 4 |
| 4 Serum revenue | PR3-1…10 | 10 |
| 5 First users | GATE-1…7, USER-1…5, METRICS-1…6 | 18 |
| BLOCK BRAND consistency | BRAND-ARCH / R1–R6 / TP-1…13 / ECO-1…8 | 28 |
| Human decisions | DEC-1…10 | 10 |

**Architecture review deltas vs older PR1-only plan:**
- Hosted funnel is Firebase (`unified-dashboard/skin-care-landing` + `firebase.consumer.json`) — OPS block is blocking, not optional.
- Photo loop uses patient routine APIs + Azure/GCS storage — ENV-2 / PR2-2 before claiming SMOKE-7.
- Weekly skin-age is middleware + `FACE_READ_VISION_ENABLED` + `inference/face-read` — PR2 after smoke core, required for honest SMOKE-14.
- touche / Shopify is out of PR1 code; BRAND + PR3 after SMOKE-1…9.
- Added PR1-24…26 (journal/capture parity + typecheck) missing from the pasted list but required by original path-safety plan.

---

## How to read this

Each block must be complete before the next. Do not skip forward. **Every checkbox below is its own tracked todo in the YAML frontmatter.**

```
BLOCK 0 — Ops & hosting
    ↓
BLOCK 1 — PR1 code fixes (path safety)
    ↓
BLOCK 2 — Branding & UI fixes
    ↓
BLOCK 3 — TestFlight build & smoke  ← soft-launch code train ends here for device proof
    ↓
PR2 — Skin-age / storage honesty (architecture)
    ↓
BLOCK 4 — PR3 serum revenue links
    ↓
BLOCK 5 — First users push
```

---

## BLOCK 0 — Ops & hosting (before any code)

### 0A — myskinandcare.com hosting

- [ ] **OPS-1** Deploy Firebase consumer hosting — myskinandcare.com currently returns "Site Not Found" (HTTP 404). Acquisition front door is completely broken.
- [ ] **OPS-2** Confirm custom domain DNS: `myskinandcare.com` + `www.myskinandcare.com` pointing to Firebase
- [ ] **OPS-3** `/scan` route live (even if face-check is disabled — page must load)
- [ ] **OPS-4** Privacy policy page live at `myskinandcare.com/privacy` (required for App Store)
- [ ] **OPS-5** Terms of service page live at `myskinandcare.com/terms` (required for App Store)
- [ ] **OPS-6** Landing hero copy: `"The #1 Skincare Journal"` + `"Log one photo a day and see what changes"` + CTA `"Get the journal"` (not `"Check your skin"` — face-check not ready)
- [ ] **OPS-7** Landing footer: `Skincare by touche labs™ · trytouche.com` + link
- [ ] **OPS-8** No broken `/scan` as primary acquisition CTA until face-check fixed (Phase 4)

### 0B — Shopify

- [ ] **SHOP-1** Rename store to **touche labs™** in Shopify Admin → Settings → Store details
- [ ] **SHOP-2** Confirm Suppliful test order flows: place a real test order, confirm fulfilment kicks off
- [x] **SHOP-3** Vendor = touche on all 11 products
- [x] **SHOP-4** Skin / Body collections created
- [x] **SHOP-5** Tags on all 11 products

### 0C — API & environment

- [ ] **ENV-1** Confirm `JOURNAL_MODE_STANDALONE` value in prod Cloud Run env (must be `0` for soft launch — PR1 hides the path client-side)
- [ ] **ENV-2** Confirm Azure Blob storage configured and writing on `api.callsomo.com` — do a test photo upload against prod API
- [ ] **ENV-3** Confirm `STRIPE_PRICE_CARE_PROGRAM` set in prod (or confirm free-only for soft launch — decision needed)
- [ ] **ENV-4** Confirm `FACE_READ_VISION_ENABLED` status on prod (if on, weekly skin-age runs; if off, hide chip)

---

## BLOCK 1 — PR1 code fixes (path safety)

> Exact file changes. One checkbox = one todo.

### 1A — `patient-app/app/(tabs)/home.tsx`

- [x] **PR1-1** Add `const JOURNAL_CAPTURE_ENABLED = false` constant (already in `home.tsx` L61)
- [ ] **PR1-2** Update `openCapture` + `pickFromLibrary`: no template → `ROUTINE_PICK_HREF`; has template → `/routine/capture`; journal path gated behind flag
- [ ] **PR1-3** Gate `JournalLogCta` / `patchJournalDailyEntry` / journal chips behind `JOURNAL_CAPTURE_ENABLED`
- [ ] **PR1-4** Add `useEffect` that calls `load()` when `params.refresh === '1'`
- [ ] **PR1-5** Add `// PR1 soft-launch safety — 2026-07-12` header comment

### 1B — `patient-app/app/onboarding/journey-choose.tsx`

- [ ] **PR1-6** Change `useState<Set<JourneyMode>>(new Set(['routine']))` — default routine not watch
- [ ] **PR1-7** Add comment: `// soft-launch default: routine. Revert when JOURNAL_MODE_STANDALONE=1 in prod`

### 1C — `patient-app/lib/pending-capture-uri.ts`

- [ ] **PR1-8** Convert `setPendingCaptureUri` to async — write to `SecureStore.setItemAsync`
- [ ] **PR1-9** Convert `consumePendingCaptureUri` to async — read from SecureStore, delete after read
- [ ] **PR1-10** Convert `peekPendingCaptureUri` to async — read from SecureStore without deleting
- [ ] **PR1-11** SecureStore failure → fall back to in-memory + `console.warn`
- [ ] **PR1-12** Keep web `sessionPersist*` path unchanged

### 1D — `patient-app/app/routine/capture.tsx`

- [ ] **PR1-13** Load pending URI in `useEffect` instead of sync consume at render
- [ ] **PR1-14** On success: `router.replace` with `celebrate=1&refresh=1` params

### 1E — `patient-app/app/(tabs)/progress.tsx`

- [ ] **PR1-15** Add `useFocusEffect` → call `load()` on tab focus

### 1F — `patient-app/hooks/useOnboardingGate.ts`

- [ ] **PR1-16** Non-401 `/me` error → return `/sign-in?error=connection` without clearing session
- [ ] **PR1-17** 401 → clear session → `SIGN_IN_HREF` (unchanged)

### 1G — `patient-app/app/sign-in.tsx`

- [ ] **PR1-18** Read `error=connection` via `useLocalSearchParams`
- [ ] **PR1-19** Show: `"Connection error — check your network and try again."`
- [ ] **PR1-20** Optional: "Retry" button → `router.replace('/')` to re-run cold start

### 1H — `patient-app/lib/resolve-post-auth-route.ts`

- [ ] **PR1-21** Outer catch: if no local modes → `JOURNEY_CHOOSE_HREF` (was `HOME_HREF`)
- [ ] **PR1-22** If local modes exist → try `resolveWithModes` → fallback `HOME_HREF`

### 1I — `middleware-platform/routes/patient-journal.js`

- [ ] **PR1-23** Add comment above `journalStandaloneEnabled()`: soft-launch client hides journal capture until this flag is `1`

### 1J — Architecture parity (added from original PR1 plan)

- [ ] **PR1-24** `journal/capture.tsx`: load pending URI in `useEffect` (same as routine)
- [ ] **PR1-25** `journal/capture.tsx`: success replace with `celebrate=1&refresh=1`
- [ ] **PR1-26** Typecheck / vitest on touched PR1 files

### PR1 verification (each item is its own todo)

- [ ] **PR1-V1** Cold start no session → sign-in (not empty Home)
- [ ] **PR1-V2** Journey-choose opens with **routine** selected
- [ ] **PR1-V3** Continue without template → routine/pick (not journal 503)
- [ ] **PR1-V4** With template → routine capture works → celebrate + Home refreshes
- [ ] **PR1-V5** Progress tab focus reloads data
- [ ] **PR1-V6** Non-401 `/me` → connection error screen
- [ ] **PR1-V7** `grep -r "trytouche\|shopify" patient-app/` returns no new strings from PR1

---

## BLOCK 2 — Branding & UI fixes

### 2A — Proof brand

- [ ] **UX-1** Progress hero: primary Compare CTA `"See day 1 vs today →"` → `/compare` (after 7+ photo days). Do not ship without this.
- [ ] **UX-2** Home: honest timeline banner — surface `phase.expect` + `total_weeks` as visible callout
- [ ] **UX-3** Progress subtitle — replace `"Small changes. Real results."` with `"Your skin data. Your proof."`
- [ ] **UX-4** Track copy — replace `"We'll measure and watch it"` with `"Log photos and compare over time"`

### 2B — UI bug fixes (Playwright audit)

- [ ] **UX-5** Fix `"1 conflicts"` → `"1 conflict"` (`MetricChipRow`)
- [ ] **UX-6** Remove duplicate photo CTAs — one CTA on Home
- [ ] **UX-7** Collapse triple barrier copy — one source, one string
- [ ] **UX-8** Replace flame emoji streak pill with brand-safe text chip or icon
- [ ] **UX-9** Fix Progress timeline date labels → relative days
- [ ] **UX-10** Fix calendar icon on Progress → real calendar or remove tap target
- [ ] **UX-11** BFI grid empty state: `"Log photos to unlock barrier insights"`

### 2C — touche labs™ branding in-app

- [ ] **BRAND-1** Profile: `"Shop Skin Collection →"` → Skin collection + UTM
- [ ] **BRAND-2** Profile: `care_program` clarification `"Journal subscription · separate from product orders"`
- [ ] **BRAND-3** App footer / about: `"Powered by touche labs™"` + trytouche.com
- [ ] **BRAND-4** Home after `phase.label`: `"Recommended for this phase"` placeholder (PR3 fills)

### 2D — touche labs™ branding on Shopify (manual)

- [ ] **BRAND-5** Theme footer text ecosystem line
- [ ] **BRAND-6** Footer link to myskinandcare.com
- [ ] **BRAND-7** Checkout header: `"touche labs™"` not `"touche"`
- [ ] **BRAND-8** Order confirmation email subject touche labs™
- [ ] **BRAND-9** SEO meta title
- [ ] **BRAND-10** SEO meta description

### 2E — App Store listing

- [ ] **ASO-1** App name: `"myskinandcare — Skin Journal"`
- [ ] **ASO-2** Subtitle: `"Track. Prove. Glow."`
- [ ] **ASO-3** Description headline: proves your routine is working
- [ ] **ASO-4** Keywords list
- [ ] **ASO-5** Screenshots: Day 1 → Day 30 compare → serum → streak
- [ ] **ASO-6** Privacy policy URL in ASC
- [ ] **ASO-7** Privacy questionnaire completed
- [ ] **ASO-8** Age rating: 4+

---

## BLOCK 3 — TestFlight build & smoke (end of soft-launch code train for device proof)

### 3A — Build

- [ ] **TF-1** Apple Developer: `com.skinandcare.app` in App Store Connect
- [ ] **TF-2** ASC App ID `6778105762` confirmed active
- [ ] **TF-3** `eas login` with correct account
- [ ] **TF-4** `eas build --platform ios --profile testflight`
- [ ] **TF-5** `eas submit --platform ios` → TestFlight
- [ ] **TF-6** Add 5–10 internal testers
- [ ] **TF-7** Testers install via TestFlight on physical iPhone

### 3B — Physical smoke (real iPhone)

- [ ] **SMOKE-1** Cold start → sign-in
- [ ] **SMOKE-2** Email → OTP → authenticated
- [ ] **SMOKE-3** Journey-choose **routine** pre-selected
- [ ] **SMOKE-4** Continue → routine/pick → concern → template
- [ ] **SMOKE-5** Bio-calibration complete
- [ ] **SMOKE-6** Home: phase, streak 0, photo CTA
- [ ] **SMOKE-7** Photo CTA → camera → upload completes
- [ ] **SMOKE-8** Celebrate → Home streak = 1 + refreshed score
- [ ] **SMOKE-9** Progress: streak 1 + today's thumbnail
- [ ] **SMOKE-10** Library pick → kill app → reopen → photo still available
- [ ] **SMOKE-11** Scan → add product → conflict verdict
- [ ] **SMOKE-12** Profile care_program → Stripe or graceful error
- [ ] **SMOKE-13** Airplane mode → connection error screen
- [ ] **SMOKE-14** After 7 photo days: skin-age chip or `"Pending"` — not silent empty

### 3C — Invite

- [ ] **TF-8** Write TestFlight invite email (subject + body + link + reply-if-breaks)

---

## PR2 — Skin-age / storage (architecture gap; before claiming SMOKE-14 / revenue honesty)

- [ ] **PR2-1** `patient-routine.js`: stop swallowing weekly skin-age failures (log + surface Pending)
- [ ] **PR2-2** Confirm photo upload + blob path on prod API (with ENV-2; blocks SMOKE-7)
- [ ] **PR2-3** Hide or show Progress skin-age chip from `FACE_READ_VISION_ENABLED` (with ENV-4)
- [ ] **PR2-4** Document skin-age / face-read soft-launch contract in ARCHITECTURE or runbook

---

## BLOCK 4 — PR3: serum revenue links

> Do not start until SMOKE-1 through SMOKE-9 pass on device.

- [ ] **PR3-1** Create `patient-app/constants/touche-sku-map.json` (Retinol / Vit C / Niacinamide)
- [ ] **PR3-2** `GET /api/patient/routine/phase`: return `recommended_products[]` filtered by concern + week
- [ ] **PR3-3** Home: `"Recommended by touche labs™"` when products.length > 0
- [ ] **PR3-4** Serum card component: name + copy + `"Shop →"`
- [ ] **PR3-5** Shop button: `shop_url` + UTM in in-app Safari
- [ ] **PR3-6** Events: `routine_reco_shown`, `shop_click`
- [ ] **PR3-7** Conflict caution if shelf retinoid + Retinol recommended
- [ ] **PR3-8** Confirm Shopify analytics `utm_source=journal`
- [ ] **PR3-9** Shopify discount `JOURNAL20` 20% off Skin collection
- [ ] **PR3-10** Profile shows `JOURNAL20`

### Concern → serum matrix (reference for PR3-1/2)

| Concern | Serum | Slot | Show from | Notes |
| --- | --- | --- | --- | --- |
| `anti_aging` | Vitamin C | AM antioxidant | Week 1+ | Before SPF |
| `anti_aging` | Niacinamide | AM/PM barrier | Week 3+ | Recovery nights |
| `anti_aging` | Retinol | PM retinoid | Week 3+ | Pea-size, SPF next day |
| `acne` | Niacinamide | AM | Week 3+ | With gentle SPF |
| `acne` | Retinol | PM retinoid | Week 5+ | Never same night as BHA |
| `acne` | Vitamin C | — | OMIT | Doesn't belong in acne protocol |
| `hyperpigmentation` | Vitamin C | AM | Week 3+ | Under SPF 50 mandatory |
| `hyperpigmentation` | Niacinamide | PM | Week 3+ | With ceramide moisturizer |
| `hyperpigmentation` | Retinol | PM | Week 9+ | 2–3× per week only |
| `hyperpigmentation_dark_skin` | Vitamin C | AM | Week 5+ | Tinted SPF with iron oxide |
| `hyperpigmentation_dark_skin` | Niacinamide | PM | Week 5+ | One active at a time |
| `hyperpigmentation_dark_skin` | Retinol | PM | Week 17+ | Optional, stop if PIH |
| `barrier_repair` | Niacinamide | AM/PM | Week 5+ only | No actives W1–4 |
| `barrier_repair` | Vitamin C / Retinol | — | NEVER W1–4 | Reset = no actives |
| `rosacea` | Niacinamide | PM | Week 5+ | Patch test first |
| `rosacea` | Vitamin C | — | OMIT | Patch-test risk |
| `rosacea` | Retinol | — | NEVER | Avoid retinoids unless prescribed |

---

## BLOCK 5 — First users push

### 5A — Readiness gate

- [ ] **GATE-1** myskinandcare.com live and loading
- [ ] **GATE-2** PR1 merged and on prod
- [ ] **GATE-3** All 14 SMOKE items pass on real device
- [ ] **GATE-4** Shopify store renamed to touche labs™
- [ ] **GATE-5** At least Niacinamide serum rec card for acne
- [ ] **GATE-6** Support channel live (email or iMessage)
- [ ] **GATE-7** Feature flag to hide Body recs / shop CTAs without deploy

### 5B — Cohort

- [ ] **USER-1** Identify 20–50 first testers
- [ ] **USER-2** Concern pick + first photo within 24h of install
- [ ] **USER-3** Day 1 check-in message
- [ ] **USER-4** Day 7 check-in message
- [ ] **USER-5** Day 30 win message

### 5C — Metrics

- [ ] **METRICS-1** D1 retention photo (target >60%)
- [ ] **METRICS-2** D7 retention (target >30%)
- [ ] **METRICS-3** D30 retention (target >15%)
- [ ] **METRICS-4** Shop CTR (target >10%)
- [ ] **METRICS-5** Shopify conversion of shop taps (target >5% month 1)
- [ ] **METRICS-6** Photo upload 503 rate (target 0%)

---


---

## BLOCK BRAND — Brand consistency system (one ID = one todo)

**Architecture one-rule:** myskinandcare is the relationship. touche labs™ is the lab that proves it. They never compete. They complete each other.

**Critical failure mode:** If touche labs™ appears without journal context (standalone ad, cold Shopify, TikTok showing only a supplement), the proof truth collapses. Every external touche touchpoint must CTA: *"Track it in the journal → myskinandcare.com."*

### Brand architecture

- [x] **BRAND-ARCH-1** Document SSOT → `todos/pending/MYSKINANDCARE_BRAND_CONSISTENCY.md`

### The 6 consistency rules

- [ ] **BRAND-R1** One tagline, two expressions — never swap (journal: *We don't just sell you a serum — we prove it's working.* / touche: *Science-backed supplements and skincare.*)
- [ ] **BRAND-R2** touche labs™ always has the ™ — every instance
- [ ] **BRAND-R3** Recommendation bridge always *"Recommended by touche labs™"* — not "we recommend"
- [ ] **BRAND-R4** `care_program` ≠ product subscription — Profile: *"Journal subscription · separate from product orders."* Shopify: no care_program
- [ ] **BRAND-R5** Proof claim lives on myskinandcare only — never "prove it's working" on trytouche.com
- [ ] **BRAND-R6** Cross-links go both ways (journal footer ↔ Shopify footer ↔ Profile shop link)

### Every touchpoint mapped

- [ ] **BRAND-TP-1** App tagline: `"The #1 Skincare Journal"`
- [ ] **BRAND-TP-2** App proof line: `"Prove it's working"`
- [ ] **BRAND-TP-3** In-app serum card: `"Recommended by touche labs™"`
- [ ] **BRAND-TP-4** App footer: `"Skincare by touche labs™"`
- [ ] **BRAND-TP-5** Web landing headline: `"Log one photo a day and see what changes"`
- [ ] **BRAND-TP-6** Web landing footer: `"Powered by touche labs™ · trytouche.com"` (lock vs Rule 6 `"Skincare by…"` wording)
- [ ] **BRAND-TP-7** Shopify store name: `"touche labs™"`
- [ ] **BRAND-TP-8** Shopify meta title: `"touche labs™ — Supplements & Skincare Backed by Real Science"`
- [ ] **BRAND-TP-9** Shopify footer: `"Part of the myskinandcare ecosystem · myskinandcare.com"`
- [ ] **BRAND-TP-10** Order confirmation: `"Your touche labs™ order is confirmed"`
- [ ] **BRAND-TP-11** App Store name: `"myskinandcare — Skin Journal"`
- [ ] **BRAND-TP-12** App Store subtitle: `"Track. Prove. Glow."`
- [ ] **BRAND-TP-13** Profile discount: `"Your 20% off code: JOURNAL20"`

### Ecosystem enforcement (ads / Shopify / audits)

- [ ] **BRAND-ECO-1** Shopify homepage CTA: `"Track it in the journal → myskinandcare.com"`
- [ ] **BRAND-ECO-2** Every ad / influencer post points back to the journal
- [ ] **BRAND-ECO-3** TikTok / cold Shopify: never product-only without journal context + CTA
- [x] **BRAND-ECO-4** Write brand consistency SSOT under `todos/pending/` → `todos/pending/MYSKINANDCARE_BRAND_CONSISTENCY.md`
- [ ] **BRAND-ECO-5** Grep audit: no bare `touche labs` without ™
- [ ] **BRAND-ECO-6** Audit: no prove-it's-working language on trytouche / Shopify
- [ ] **BRAND-ECO-7** Audit: no care_program language on Shopify
- [ ] **BRAND-ECO-8** Align OPS-7 / BRAND-3 / BRAND-5 strings to these rules

## Human decisions (each is a tracked todo)

- [ ] **DEC-1** Azure storage confirmed on `api.callsomo.com`?
- [ ] **DEC-2** `JOURNAL_MODE_STANDALONE` is `0` in prod?
- [ ] **DEC-3** Free journal only vs `care_program` active?
- [ ] **DEC-4** `FACE_READ_VISION_ENABLED` on or off?
- [ ] **DEC-5** Serum CTAs from launch day vs wait for D7 data?
- [ ] **DEC-6** Retinol "Recommended by touche labs" ok with pregnancy PDP warning?
- [ ] **DEC-7** Who runs the 14-item TestFlight smoke?
- [ ] **DEC-8** First cohort 20–50 identified? source?
- [ ] **DEC-9** Support channel email or iMessage?
- [ ] **DEC-10** When to flip `JOURNAL_CAPTURE_ENABLED` for diary/watch?

---

## What NOT to build before TestFlight push

- No face-check / `/scan` as acquisition (deploy page but do not promote)
- No Body supplement recs (Creatine/Maca especially)
- No Android
- No push notifications / SMS reminders
- No Kelly voice for journal patients
- No Pinecone skincare namespace
- No custom Shopify app for the journal
- No subscription required to buy a serum
- No in-app chat

---

## Push order summary

```
Today / this week:
  OPS-1 → deploy myskinandcare.com
  SHOP-1 → rename to touche labs™
  ENV-1 to ENV-4 → confirm prod environment

Next (parallel):
  PR1-1 … PR1-26 + PR1-V1 … PR1-V7
  UX-1 … UX-11
  BRAND-1 … BRAND-10
  BRAND-ARCH / BRAND-R* / BRAND-TP* / BRAND-ECO*
  ASO-1 … ASO-8

Then:
  TF-1 … TF-7 → EAS build + TestFlight
  SMOKE-1 … SMOKE-14 → physical device
  TF-8 → invite email

Then:
  PR2-1 … PR2-4 → skin-age honesty
  PR3-1 … PR3-10 → serum SKU map + revenue
  GATE / USER / METRICS → first 20–50 users
```

**TOTAL TASKS: 171** (165 pending · 6 completed)
