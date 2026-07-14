# myskinandcare × touche labs™ — Soft Launch Todos

**Last updated:** 2026-07-12  
**Store:** [trytouche.com](https://trytouche.com) (`f1spzg-1m.myshopify.com`)  
**Auth verified:** Shopify CLI store auth as `doctorjay254@gmail.com`  
**Related:** [`MYSKINANDCARE_PR1_AND_UI_EXECUTION.md`](MYSKINANDCARE_PR1_AND_UI_EXECUTION.md) (PR1a+PR1b + UI tasks), [`MYSKINANDCARE_UI_UX_AUDIT.md`](MYSKINANDCARE_UI_UX_AUDIT.md), [`IOS_SKINCARE_TRACKER_LAUNCH_TODOS.md`](IOS_SKINCARE_TRACKER_LAUNCH_TODOS.md), [`SKIN_AGE_JOURNEY_E2E_TODOS.md`](SKIN_AGE_JOURNEY_E2E_TODOS.md)

---

## Brand model (lock this)

```
myskinandcare.com  = journal (acquisition + data moat)
touche labs™       = product science brand (serums + body)
Shopify + Suppliful = checkout + fulfilment
Stripe care_program = optional software entitlement (NOT bottles)
```

**SEO / footer target**

| Surface | Line |
|---------|------|
| myskinandcare | `myskinandcare — The #1 AI Skincare Journal \| Powered by touche labs™` |
| trytouche | `touche labs™ — Supplements & Skincare Backed by Real Science` |
| Journal footer | `© 2026 myskinandcare · Skincare by touche labs™` |
| Shopify footer | `touche labs™ · Part of the myskinandcare ecosystem` |

---

## Live Shopify catalog (2026-07-12 pull)

**Tags:** every product has `tags: []` — must add before journal mapping.  
**Vendor:** inconsistent (`My Store` vs `touche`) — normalize to `touche labs`.  
**Collections already useful:** `skin-by-touche-labs` (3), `body-by-touche-labs` (8).

### Skin (serums → routine slots)

| Title | Handle | SKU | Price | Product GID | Variant GID | Journal slot |
|-------|--------|-----|-------|-------------|-------------|--------------|
| Retinol Serum — Smoother Skin | `retinol-and-peptide-face-serum` | EVL0REPE | $36.99 | `914262…` use full GID below | `47468976308355` | PM retinoid (acne / anti_aging / hyperpigmentation phases with retinoid) |
| Vitamin C Serum — Brighter Skin | `vitamin-c-serum` | FMN0VITC | $27.99 | Product `9142643196035` | `47469005635715` | AM antioxidant (anti_aging, hyperpigmentation, dark_skin) |
| Niacinamide Serum | `niacinamide-serum` | EVL0NCNS | $29.99 | Product `9144425742467` | `47477824913539` | AM/PM barrier / acne / rosacea / barrier_repair late phases |

Full GIDs:

- Retinol Product: `gid://shopify/Product/9142636216451` · Variant: `gid://shopify/ProductVariant/47468976308355`
- Vit C Product: `gid://shopify/Product/9142643196035` · Variant: `gid://shopify/ProductVariant/47469005635715`
- Niacinamide Product: `gid://shopify/Product/9144425742467` · Variant: `gid://shopify/ProductVariant/47477824913539`

PDP base: `https://trytouche.com/products/{handle}`

### Body (supplements → Phase 5 journal recs)

| Title | Handle | SKU | Price | ProductType | Soft-launch priority |
|-------|--------|-----|-------|-------------|----------------------|
| Collagen Peptides | `hydrolyzed-collagen-peptides-type-1-3` | RLC8COLL | $44.99 | Skin, Hair & Nail Health | P1 — anti_aging / barrier |
| Magnesium Glycinate | `magnesium-glycinate` | VOX4MGNE | $24.99 | Vitamins & Minerals | P1 — stress / sleep / flare chips |
| Omega-3 Fish Oil | `omega-3-epa-180mg-dha-120mg` | RLC4FISS | $24.99 | Fish Oil & Omega… | P2 — barrier / inflammation |
| Vitamin D3 | `vitamin-d3-2-000-iu` | RLC3VTD3 | $19.99 | Vitamins & Minerals | P2 — general body |
| NMN | `nmn` | JTP55NMNC | $44.99 | Specialty Supplements | P2 — anti_aging only, careful claims |
| Ashwagandha | `ashwagandha` | VOX4ASHW | $19.99 | Specialty Supplements | P2 — stress tags |
| Creatine + Electrolytes | `creatine-hydration-powder` | JTP0CRHY | $32.99 | Muscle Builders | P3 — out of skin journal path for soft launch |
| Maca Plus | `maca-plus` | VOX4MACA | $29.99 | Sexual & Reproductive… | P3 — out of skin journal path for soft launch |

### Other collections (cleanup later)

`longevity`, `heart-metabolic-health`, `sleep-stress-support`, `skin` (Spotless Skin), `xx-longevity`, `xy-longevity`, `muscle-growth`, `sexual-libido`, `bones-joints`, `stress-less-1` — keep or archive after Skin/Body are canonical.

---

## Phase 0 — Ground truth (2–3 days)

- [ ] **P0.1** Export catalog sheet: handle, SKU, GIDs, price, collection membership (this file is the seed)
- [ ] **P0.2** Lock serum → routine slot map (table above); legal review on Retinol pregnancy warning + Vit C SPF copy
- [ ] **P0.3** Confirm prod middleware flags: `JOURNAL_MODE_STANDALONE`, face-read URL, storage; decide if `STRIPE_PRICE_CARE_PROGRAM` is required for soft launch
- [ ] **P0.4** Soft-launch audience = **routine users first** (watch-only secondary)
- [ ] **P0.5** Claims policy doc: what journal may say for serums vs Body supplements (FDA disclaimer already on PDPs)
- [ ] **P0.6** Decide Creatine + Maca: **exclude from journal recs** until post soft launch

---

## Phase 1 — Shopify catalog hygiene (parallel with iOS)

### Tags (currently empty — do this)

- [ ] **S1.1** Tag all **Skin** products: `skin`, `touche-labs`, `serum`
  - Retinol: also `slot:retinoid`, `concern:anti_aging`, `concern:acne`, `concern:hyperpigmentation`
  - Vit C: also `slot:vitamin_c`, `concern:anti_aging`, `concern:hyperpigmentation`, `concern:hyperpigmentation_dark_skin`
  - Niacinamide: also `slot:niacinamide`, `concern:acne`, `concern:barrier_repair`, `concern:rosacea`, `concern:anti_aging`
- [ ] **S1.2** Tag all **Body** products: `body`, `touche-labs`, `supplement`
  - Collagen: `concern:anti_aging`, `priority:p1`
  - Magnesium: `concern:stress`, `priority:p1`
  - Omega-3: `priority:p2`
  - D3: `priority:p2`
  - NMN: `concern:anti_aging`, `priority:p2`
  - Ashwagandha: `concern:stress`, `priority:p2`
  - Creatine: `priority:p3`, `journal:exclude`
  - Maca: `priority:p3`, `journal:exclude`
- [ ] **S1.3** Normalize **vendor** on all 11 SKUs → `touche labs`
- [ ] **S1.4** Verify **Skin by touche labs** contains exactly Retinol, Vit C, Niacinamide
- [ ] **S1.5** Verify **Body by touche labs** contains exactly the 8 supplements
- [ ] **S1.6** Hide or deprioritize legacy collections from storefront nav (XX/XY, Spotless Skin, etc.) — keep Skin + Body primary
- [ ] **S1.7** Confirm checkout + Suppliful fulfilment on one Skin + one Body test order
- [ ] **S1.8** Create journal cohort discount code e.g. `JOURNAL20`
- [ ] **S1.9** Draft Shopify footer + SEO meta title (apply in Phase 3 if theme work slips)

---

## Phase 2 — Ship iOS journal (TestFlight) — foundation

### Ops / Apple

- [ ] **I2.1** Apple Developer + App Store Connect app `com.skinandcare.app`
- [ ] **I2.2** EAS: `verify:testflight` → `build:testflight` → `submit:testflight`
- [ ] **I2.3** Internal testers install via TestFlight
- [ ] **I2.4** DNS: myskinandcare.com live; Privacy + Terms URLs for App Store
- [ ] **I2.5** Optional: set `STRIPE_PRICE_CARE_PROGRAM` on prod (skip if soft launch is free journal only)

### Demo-breakers (must fix before testers)

- [ ] **I2.6** Enable `JOURNAL_MODE_STANDALONE=1` (+ related journal flags) **or** hide watch → `/journal/capture` until on
- [ ] **I2.7** Physical smoke: OTP → pick concern → photo → Progress → compare
- [ ] **I2.8** Surface weekly skin-age / vision failures (no empty `catch` in routine photo path)
- [ ] **I2.9** Persist pending library photo (SecureStore/file) — kill-app safe
- [ ] **I2.10** After photo upload, refetch Home + Progress (no stale streak)
- [ ] **I2.11** Offline `/me` error → clear error / sign-in (don’t empty Home)
- [ ] **I2.12** Soft-hide legacy surfaces from primary path: `checkout-chat`, money, billing captures
- [ ] **I2.13** Clinical disclaimer visible on Home
- [ ] **I2.14** TestFlight invite email copy (how to log day 1)

**Exit:** ≥5 internal users complete a photo day without support.

---

## Phase 3 — Serums → routines (first revenue loop)

- [ ] **R3.1** Add sidecar map (prefer `middleware-platform/routines/touche-sku-map.json` or fields on `concern-routines.json`) with live handles/GIDs above
- [ ] **R3.2** API/progress-summary exposes `recommended_products[]` for current concern + phase
- [ ] **R3.3** Home / phase UI: “Recommended by touche labs™” card → open PDP in Safari/WebBrowser
- [ ] **R3.4** UTM on all shop links: `utm_source=journal&utm_medium=routine&utm_campaign={concern_id}&utm_content={handle}`
- [ ] **R3.5** Conflict caution: if shelf already has retinoid + recommending Retinol → show layering warning
- [ ] **R3.6** Analytics events: `routine_reco_shown`, `shop_click` (purchase webhook later)
- [ ] **R3.7** myskinandcare landing footer: Shop → `skin-by-touche-labs` + powered-by line
- [ ] **R3.8** Do **not** bundle serums into Stripe `care_program`

**Minimum mapping for launch**

| Concern | Phase gate | Serums to show |
|---------|------------|----------------|
| `anti_aging` | W1+ Vit C; W3+ Retinol; Niacinamide when in steps | Vit C, Niacinamide, Retinol |
| `acne` | Niacinamide early; Retinol when retinoid phase | Niacinamide, Retinol |
| `hyperpigmentation` / `_dark_skin` | Vit C when brightening; Retinol late | Vit C, Retinol, Niacinamide |
| `barrier_repair` | Niacinamide only W5+ (no Retinol W1–4) | Niacinamide |
| `rosacea` | Niacinamide; **no Retinol** unless derm path | Niacinamide |

**Exit:** Acne (or anti_aging) user taps serum → trytouche.com PDP → can purchase.

---

## Phase 4 — touche labs storefront refresh

- [ ] **T4.1** Store display name / emails → **touche labs™**
- [ ] **T4.2** Theme footer cross-link to myskinandcare.com
- [ ] **T4.3** SEO meta titles (both sites) + Organization schema `sameAs`
- [ ] **T4.4** Nav: Skin / Body only as primary merchandising
- [ ] **T4.5** Optional: Shopify subscriptions (selling plans) for Body P1 SKUs only
- [ ] **T4.6** Journal discount `JOURNAL20` live and documented for first cohort

---

## Phase 5 — Fix “Check your skin” hook (AFTER iOS is solid)

> Do not use broken `/scan` as primary acquisition until this phase exits.

- [ ] **F5.1** Audit web `/scan`: MediaPipe gate, reject reasons, vision env flags
- [ ] **F5.2** Remove debug `127.0.0.1` ingest telemetry from landing (`useFaceGuide.js`, `main.jsx`)
- [ ] **F5.3** Align face-read payload contract web ↔ iOS (`face-read-api.ts` vs `faceReadApi.js`)
- [ ] **F5.4** Reveal honesty: no fake zones; clear empty-findings state when vision off
- [ ] **F5.5** Port corrected scan UX to iOS (alignment gate), then keep web in sync
- [ ] **F5.6** Optional: soft concern suggestion from face-read (never hard-force wrong program)
- [ ] **F5.7** Only then: marketing CTA “Check your skin” as primary hook

**Until then:** invite + “Get the journal” → OTP / TestFlight.

---

## Phase 6 — Body supplements via journal data

- [ ] **B6.1** Deterministic rules v0 (no LLM): e.g. `anti_aging` → Collagen (± NMN); stress/flare chips → Magnesium; optional Omega-3
- [ ] **B6.2** Gate Body block behind N photo days (e.g. ≥7) or phase ≥2
- [ ] **B6.3** UI separation: **Skin routine** vs **Body support** (never mix pills into AM/PM step list)
- [ ] **B6.4** Exclude Creatine + Maca from journal (`journal:exclude` tags)
- [ ] **B6.5** Claims review for Collagen skin language (PDP already hedges — journal must match)
- [ ] **B6.6** Shop links to Body PDPs with UTMs

---

## Phase 7 — Soft launch → first users (ops)

- [ ] **L7.1** Cohort of 20–50 (TikTok / waitlist)
- [ ] **L7.2** Day-0 script: install → OTP → pick concern → photo day 1 within 24h
- [ ] **L7.3** Support channel (email / iMessage) for week 1
- [ ] **L7.4** Metrics: D1/D7 photo retention, `shop_click`, purchase (manual Shopify check OK at first)
- [ ] **L7.5** Feature flags: hide Body recs / shop CTAs instantly if needed
- [ ] **L7.6** Feedback → bug vs product triage
- [ ] **L7.7** Soft-launch DoD checklist (below) signed off

### Soft-launch definition of done

- [ ] TestFlight photo loop works on real devices
- [ ] Privacy + Terms live on myskinandcare.com
- [ ] Skin collection (3 serums) buyable; Body exists but not pushed hard
- [ ] ≥1 concern shows touche labs serum with working PDP + UTM
- [ ] Acquisition does **not** depend on broken Check-your-skin
- [ ] Support path + feature flags
- [ ] care_program ≠ product subscription (clear in copy)

---

## Phase 8 — Agent, medical library, reminders (post soft launch)

### Current state (do not invent)

| System | Role today |
|--------|------------|
| Pinecone `doctorlittle` | Medical coding / clinical RAG — **not** Touché SKUs |
| SQLite `ingredient_rag_chunks` | Skincare FTS for consumer rails |
| Twilio / Retell / Kelly | Clinic voice — **not** journal daily reminders |
| Push (`expo-notifications`) | **Not** in patient-app |
| Journal chat on Home | Deferred |

### Build waves

- [ ] **A8.1** Weekly in-app **report** (streak, phase, BFI, what changed) on Progress
- [ ] **A8.2** Reminders v1: email or Twilio SMS “log today’s photo”
- [ ] **A8.3** Expo push notifications for photo streak / phase change
- [ ] **A8.4** Narrow journal **chat**: shelf/layering Qs via consumer-rails + SQLite RAG (not open diagnosis)
- [ ] **A8.5** Grow derm/ingredient library in SQLite; optional Pinecone namespace `skincare` (do **not** pollute `doctorlittle`)
- [ ] **A8.6** Analysis notifications: day logged, weekly skin-age if available, conflict alerts
- [ ] **A8.7** Voice coaching (Kelly slice) only after chat quality bar met
- [ ] **A8.8** Body recs grounded in library snippets + citations under Body cards

### Maintenance cadence

| Cadence | Work |
|---------|------|
| Weekly | Failed uploads, 503s, face-read rejects; top shop clicks vs purchases |
| Biweekly | +5–10 derm/ingredient chunks; re-embed if using vectors |
| Monthly | Phase copy from flare feedback; new SKU only if maps to a slot |
| Quarterly | Claims + privacy; Pinecone BAA if journal data becomes clinical |

---

## Dependency order (do not thrash)

```
Shopify tags + vendor (Phase 1)
    → TestFlight photo loop (Phase 2)
        → Serum deep links in routines (Phase 3)
            → Store brand/SEO (Phase 4)
                → Fix Check your skin (Phase 5)
                    → First users (Phase 7) can overlap 3–4
                        → Body recs (Phase 6)
                            → Agent / library / reminders (Phase 8)
```

---

## Quick reference — shop URLs for engineering

```
https://trytouche.com/products/retinol-and-peptide-face-serum
https://trytouche.com/products/vitamin-c-serum
https://trytouche.com/products/niacinamide-serum
https://trytouche.com/products/hydrolyzed-collagen-peptides-type-1-3
https://trytouche.com/products/magnesium-glycinate
https://trytouche.com/products/omega-3-epa-180mg-dha-120mg
https://trytouche.com/products/vitamin-d3-2-000-iu
https://trytouche.com/products/nmn
https://trytouche.com/products/ashwagandha
https://trytouche.com/products/creatine-hydration-powder
https://trytouche.com/products/maca-plus

Collections:
https://trytouche.com/collections/skin-by-touche-labs
https://trytouche.com/collections/body-by-touche-labs
```
