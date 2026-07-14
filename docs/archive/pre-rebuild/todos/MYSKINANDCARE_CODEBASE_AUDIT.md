# myskinandcare × touche labs — Codebase Audit

**Date:** 2026-07-12  
**Scope:** Analysis only — no code changes  
**API assumed:** `https://api.callsomo.com`  
**Related:** [`MYSKINANDCARE_TOUCHELABS_SOFT_LAUNCH_TODOS.md`](MYSKINANDCARE_TOUCHELABS_SOFT_LAUNCH_TODOS.md)

---

## Executive summary

- The v3 journal loop (OTP → journey → concern → **one progress photo = day complete**) is largely built for **routine** users; TestFlight smoke is still unchecked and several silent failures will look like “AI isn’t working.”
- **Watch / diary** Home routes to `/journal/capture` and journal check-in APIs, which return **503 `JOURNAL_MODE_DISABLED`** unless `JOURNAL_MODE_STANDALONE=1` (prod generator defaults this to `0`).
- **No Shopify / touche product IDs, handles, or URLs** exist in `patient-app` or `middleware-platform` (only a stub `shopify: { connected: false }` in customer-account). Revenue loop is not in code yet.
- Weekly skin-age on every 7th completed photo day runs in `patient-routine.js` via `analyzeWithVision`; failures are **swallowed** (`catch (_) {}`) with no client signal.
- Pending library URI on native is **in-memory only** (`pending-capture-uri.ts`); kill between pick and capture loses the photo. Web persists to session storage.

---

## File-by-file findings

### `patient-app/app/(tabs)/home.tsx`

| | |
|--|--|
| **Does today** | Session-gated Home: loads template/daily/phase/progress-summary/calendar/next-actions/trigger-insights; branches UI for journal-first vs routine; photo CTA; BFI ring; AM/PM steps; celebrate banner; bio incomplete banner; clinical disclaimer. |
| **Supposed to** | Whoop-style Today: daily photo check-in + routine guidance + conflict metrics ([`V3_SCREEN_MAP.md`](../../docs/patient-app/design/V3_SCREEN_MAP.md)). |
| **Broken / missing / overclaiming** | `journalMode = (watch && !routine) \|\| !templateActive` — **any user without a template** gets journal UI/CTA, not only watch. Watch photo → `/journal/capture` (flag-gated). `patchJournalDailyEntry` / `fetchTriggerInsights` fail soft or toast on 503. Flame emoji streak pill vs brand rules. No touche shop CTAs. |
| **Demo break** | Watch-only (default on journey-choose) → daily photo → journal API 503. Soft-launch demo must force **routine + template** or enable journal flag. |

### `patient-app/app/(tabs)/progress.tsx`

| | |
|--|--|
| **Does today** | Streak hero, 8-day BFI grid, barrier insight, improvement bars / journal spark cards, trigger tags, photo timeline, spot list. |
| **Supposed to** | Unified Progress for both journeys. |
| **Broken / missing / overclaiming** | Journal improvements/triggers soft-fail when flags off. Skin-age bars only appear if readings exist (weekly vision often silent-fail). No auto-refresh after Home photo (user must pull). Copy “Small changes. Real results.” is stronger than data often supports. |
| **Demo break** | Empty Progress after first photo until manual refresh — looks broken. |

### `patient-app/app/routine/capture.tsx`

| | |
|--|--|
| **Does today** | Front camera + ghost overlay; optional symptoms; shutter uploads immediately via `uploadRoutineProgressPhoto`; library path via `consumePendingCaptureUri`; celebrate → Home. |
| **Supposed to** | Progress photo check-in for routine users. |
| **Broken / missing / overclaiming** | Native shutter skips confirm step (auto-upload). Library path depends on in-memory pending. Preflight “Today’s stack” is shelf evaluate, not CV of the selfie. No compression beyond quality 0.7. |
| **Demo break** | Camera permission deny with no library fallback on native camera screen; kill-app after library pick loses URI. |

### `patient-app/app/journal/capture.tsx`

| | |
|--|--|
| **Does today** | Camera → review with condition chips/note → `postJournalDailyPhoto`. |
| **Supposed to** | Standalone diary photo log. |
| **Broken / missing / overclaiming** | No client-side check for `JOURNAL_MODE_STANDALONE`; 503 surfaces as toast. Unused imports (`useEffect`, `ScrollView` noise). |
| **Demo break** | Any watch / no-template path that lands here without flag = failed photo demo. |

### `patient-app/app/onboarding/journey-choose.tsx`

| | |
|--|--|
| **Does today** | Multi-select watch / routine / spot; **defaults `watch` selected**; saves profile; `resolvePostAuthRoute({ journeyModes })`. |
| **Supposed to** | First-run journey picker. |
| **Broken / missing / overclaiming** | Soft-launch wants routine-first but UI defaults watch. Subtitle “12-week program” understates 8–24 week variance. |
| **Demo break** | Testers who tap Continue without toggling → watch → journal 503 path. |

### `patient-app/app/index.tsx`

| | |
|--|--|
| **Does today** | Splash spinner → `resolveInitialRoute()` → replace. |
| **Supposed to** | Cold-start router. |
| **Broken / missing / overclaiming** | No error UI if resolve hangs. |
| **Demo break** | Low if session/API healthy. |

### `patient-app/lib/resolve-post-auth-route.ts`

| | |
|--|--|
| **Does today** | Modes from server → hints → local; empty → `JOURNEY_CHOOSE_HREF`; spot-only → Track; watch-only → **Home**; routine → pick / bio / Scan / Home. |
| **Supposed to** | Post-auth gate ([V3 map](../../docs/patient-app/design/V3_SCREEN_MAP.md) says watch-only → Track — **doc drift**). |
| **Broken / missing / overclaiming** | Outer `catch` with no local modes → **`HOME_HREF`** (skips journey-choose). Spots unused in watch-only branch. |
| **Demo break** | Network blip after auth can dump new user on empty Home. |

### `patient-app/lib/routine-capture.ts`

| | |
|--|--|
| **Does today** | Ensure daily entry → multipart POST `/api/patient/routine/daily/:id/photo`. |
| **Supposed to** | Thin client for photo-day completion. |
| **Broken / missing / overclaiming** | No retry/offline queue. |
| **Demo break** | Failures bubble as capture errors (OK if message clear). |

### `patient-app/lib/pending-capture-uri.ts` *(supporting)*

| | |
|--|--|
| **Does today** | Web: session persist. Native: module `let pendingNative`. |
| **Supposed to** | Hand off library URI to capture screen. |
| **Broken / missing / overclaiming** | Native not kill-safe. |
| **Demo break** | Library → kill → capture empty. |

### `patient-app/hooks/useOnboardingGate.ts` *(supporting)*

| | |
|--|--|
| **Does today** | No session → sign-in; `/me` OK → post-auth; **401** clear → sign-in; **other errors still `resolvePostAuthRoute()`**. |
| **Broken** | Offline / 500 on `/me` still enters app. |
| **Demo break** | Flaky network → empty Home / wrong gates. |

### `middleware-platform/routines/concern-routines.json`

| | |
|--|--|
| **Does today** | Six concern programs with AM/PM ingredient slots + phased `weekly_schedule`. |
| **Supposed to** | Canonical care plans. |
| **Broken / missing / overclaiming** | Ingredient classes only — **no SKU / Shopify handles**. |
| **Demo break** | None if template creates; overclaim if UI implies branded products. |

### `middleware-platform/routes/patient-routine.js`

| | |
|--|--|
| **Does today** | Template/daily/phase/photo; photo path uploads buffer, evaluates lineup, `applyPhotoDayCompletion` (score 100), optional journal backfill if flag, **every 7th photo day** `analyzeWithVision` → `skin_age_readings` in empty catch. |
| **Supposed to** | Routine photo = day logged + periodic skin-age. |
| **Broken / missing / overclaiming** | Silent skin-age failure. Storage module named GCS, often Azure/local. |
| **Demo break** | Photo upload itself works if storage configured; Progress skin-age stays “—” without explanation. |

### `middleware-platform/routes/patient-journal.js` *(supporting)*

| | |
|--|--|
| **Does today** | Gates `daily-photo` / `daily-entry` on `JOURNAL_MODE_STANDALONE === '1'` → else **503**. |
| **Demo break** | Watch path without flag. |

### `middleware-platform/services/health-turn-service.js`

| | |
|--|--|
| **Status** | **FILE NOT FOUND** — no `health-turn*` under repo. Skip; not part of consumer journal path. |

### `todos/pending/MYSKINANDCARE_TOUCHELABS_SOFT_LAUNCH_TODOS.md`

| | |
|--|--|
| **Does today** | Execution checklist: Shopify catalog (live GIDs), phases 0–8, serum matrix, Body exclude Creatine/Maca. |
| **Gap vs code** | Plan assumes tags/vendor work and serum map; **code has neither**. |

### `todos/pending/MYSKINANDCARE_USER_JOURNEY_AND_LAUNCH_TODOS.md`

| | |
|--|--|
| **Status** | **FILE DOES NOT EXIST** (planned, not written). |

### `todos/pending/README.md`

| | |
|--|--|
| **Does today** | Tier 1 lists soft-launch + iOS + skin-age E2E. |
| **Note** | Soft-launch file present; journey narrative SSOT missing. |

### `docs/patient-app/design/V3_SCREEN_MAP.md`

| | |
|--|--|
| **Does today** | Tab IA + post-auth rules. |
| **Drift** | Watch-only → Track in doc; code sends watch-only → **Home**. Persona A labeled `watch` but spot is separate mode. |

### `docs/Brand/POSITIONING.md`

| | |
|--|--|
| **Does today** | Journal-first; face check = hook; don’t lead with recommendations for reactive users. |
| **Tension** | Soft-launch Phase 3 serum CTAs must stay **routine-path / secondary**, not diary lead. |

---

## Answers to specific questions

### Is `JOURNAL_MODE_STANDALONE` checked? What if unset?

| Location | Behavior |
|----------|----------|
| [`patient-journal.js`](../../middleware-platform/routes/patient-journal.js) `journalStandaloneEnabled()` | Default `'0'` → **503** `JOURNAL_MODE_DISABLED` on `daily-photo` / `daily-entry` |
| [`patient-routine.js`](../../middleware-platform/routes/patient-routine.js) ~900 | If `'1'`, backfills journal from routine photo; else skip |
| [`generate-cloudrun-env-yaml.cjs`](../../middleware-platform/scripts/generate-cloudrun-env-yaml.cjs) | Staging `'1'`, else `'0'` |
| **patient-app** | **Never checks the flag** — always calls journal APIs when journal UI active |

### Watch-mode user taps daily photo CTA on Home?

1. `journalMode` true (watch && !routine, or no template).  
2. `openCapture` → `/journal/capture?date=…`.  
3. Upload → `POST /api/patient/journal/daily-photo`.  
4. If flag off → **503** → toast error.  
Also: condition chips call `patchJournalDailyEntry` → same gate.

### Kill app between library pick and upload?

Native: `setPendingCaptureUri` stores in `pendingNative` only → **URI lost**; capture opens without library image.  
Web: session storage survives tab reload better.

### `resolvePostAuthRoute` for brand-new user, no journey modes?

Returns **`JOURNEY_CHOOSE_HREF`** (`/onboarding/journey-choose`) when modes empty from server/local/hints.  
Exception: top-level `catch` with no local profile → **`HOME_HREF`**.

### Weekly skin-age: where / on failure?

In `POST .../routine/daily/:id/photo` after completion: if `COUNT(DISTINCT entry_date) % 7 === 0`, call `analyzeWithVision` + `insertSkinAgeReading`.  
On any error: **`catch (_) {}`** — no log to client, no retry flag. Progress skin-age stays empty.

### Shopify IDs / handles / URLs in patient-app or middleware?

**None** for touche products. Grep: no `trytouche`, no serum handles/SKUs, no product GIDs. Only `customer-account.js` stub `shopify: { connected: false }`.

### Legacy screens still in router tree?

**Root stack** ([`app/_layout.tsx`](../../patient-app/app/_layout.tsx)): `checkout-chat`, `scan-entry`, `capture-scan`, `capture-upload`, `capture-manual-bill`, `capture-manual-payment`, `capture-review`, `capture-complete`.  

**Hidden tabs** ([`(tabs)/_layout.tsx`](../../patient-app/app/(tabs)/_layout.tsx)): `timeline`, `money`, `shelf`, `_journal`, `today`.  

Do not wire new soft-launch work to these.

---

## Gap list (by severity)

### CRITICAL — breaks TestFlight demo on device

1. Watch / no-template Home → journal photo → **503** if `JOURNAL_MODE_STANDALONE` not `1`.  
2. Journey-choose **defaults watch** — testers hit CRITICAL #1 unless they opt into routine.  
3. TestFlight / ASC / EAS smoke never completed (ops).  
4. Offline/`/me` non-401 still enters app → empty/broken Home.  
5. Native library pending URI lost on process kill.

### HIGH — wrong or misleading for first users

6. V3 doc vs code: watch-only Track vs Home.  
7. Weekly skin-age failures invisible; UI still shows “skin age” chip.  
8. Spot “analysis” heuristic elsewhere (overclaim vs CV).  
9. Progress not invalidated after photo — stale streak.  
10. Positioning: diary users must not get product-push lead; code has no shop yet but Phase 3 must respect this.  
11. No touche mapping in routines JSON while Soft Launch todos assume Phase 3 revenue.

### MEDIUM — missing for soft launch, not blocking routine photo

12. Shopify tags/vendor hygiene (store ops).  
13. Serum deep links + UTM + Home “Recommended by touche labs”.  
14. Feature flag to hide Body / shop CTAs.  
15. `STRIPE_PRICE_CARE_PROGRAM` optional for free soft launch.  
16. Compress / HEIC pipeline.  
17. Legacy stack screens still registered (confusion risk).

### LOW — Phase 4+

18. Check-your-skin web fix (MediaPipe, debug ingest, contract parity).  
19. Body supplement recs (Collagen/Magnesium first; Creatine/Maca exclude).  
20. Push / SMS reminders / journal chat / Pinecone `skincare` namespace.  
21. Voice/Kelly coaching.  
22. Android.  
23. Write missing journey SSOT doc if still desired.

---

## Concern-to-serum mapping proposal

Live PDPs:  
- Vit C — `https://trytouche.com/products/vitamin-c-serum` (FMN0VITC)  
- Niacinamide — `https://trytouche.com/products/niacinamide-serum` (EVL0NCNS)  
- Retinol — `https://trytouche.com/products/retinol-and-peptide-face-serum` (EVL0REPE)

| Concern | Serum | Slot | Phase to show | Suggested routine-card copy |
|---------|-------|------|---------------|------------------------------|
| `anti_aging` | Vitamin C Serum | AM antioxidant | Weeks 1–2+ (Foundation) | “AM: touche labs Vitamin C — antioxidant before SPF.” |
| `anti_aging` | Niacinamide Serum | AM after Vit C / PM recovery | Weeks 3–4+ | “Layer touche labs Niacinamide for barrier support on recovery nights.” |
| `anti_aging` | Retinol Serum | PM retinoid | Weeks 3–4+ (intro); escalate 5–12 | “PM: touche labs Retinol — pea-size, sandwich method, SPF next morning.” |
| `acne` | Niacinamide Serum | AM | Weeks 3–4+ (BHA phase) | “AM: touche labs Niacinamide with your gentle SPF routine.” |
| `acne` | Retinol Serum | PM retinoid nights | Weeks 5–8+ | “PM retinoid nights: touche labs Retinol — never same night as BHA.” |
| `acne` | Vitamin C | — | Soft-launch: **omit or late only** | Acne schedule doesn’t lead with Vit C; don’t force. |
| `hyperpigmentation` | Vitamin C Serum | AM | Weeks 3–6+ | “AM: touche labs Vitamin C under SPF 50 — brightening needs sun protection.” |
| `hyperpigmentation` | Niacinamide Serum | PM | Weeks 3–6+ | “PM: touche labs Niacinamide with ceramide moisturizer.” |
| `hyperpigmentation` | Retinol Serum | PM | Weeks when retinoid added (later schedule) | “PM: touche labs Retinol 2–3×/week if tolerated — SPF non-negotiable.” |
| `hyperpigmentation_dark_skin` | Vitamin C | AM | Weeks 5–8+ | “AM: touche labs Vitamin C under **tinted** SPF (iron oxide).” |
| `hyperpigmentation_dark_skin` | Niacinamide | PM | Weeks 5–8+ | “PM: touche labs Niacinamide — one active at a time.” |
| `hyperpigmentation_dark_skin` | Retinol | PM | Weeks 17–24 only if tolerated | “Optional PM Retinol 2×/week — stop if irritation (PIH risk).” |
| `barrier_repair` | Niacinamide | AM/PM | **Weeks 5–8 only** | “Stabilisation: touche labs Niacinamide — only active after full reset.” |
| `barrier_repair` | Vit C / Retinol | — | **Do not recommend** W1–4 | Reset phase = no actives. |
| `rosacea` | Niacinamide | PM (W5–8); AM option W9–12 | Weeks 5–8+ | “PM: touche labs Niacinamide to calm reactivity — patch test first.” |
| `rosacea` | Vitamin C | — | Cautious / omit soft launch | Notes say patch-test only; skip shop CTA initially. |
| `rosacea` | Retinol | — | **Never** in soft launch | Key rules: avoid retinoids unless prescribed. |

---

## 10 questions that need human answers before code changes

1. Soft-launch cohort: **routine-only** testers, or must watch/diary work day one?  
2. Prod `JOURNAL_MODE_STANDALONE`: enable `1`, or hide journal capture until later?  
3. Journey-choose default: keep **watch**, or change default to **routine** for soft launch?  
4. Is Azure/local media upload confirmed working on `api.callsomo.com` for routine photos?  
5. Is `FACE_READ_VISION_ENABLED` on for weekly skin-age, or should Progress hide skin-age until reliable?  
6. Soft launch: show **serum shop CTAs** on Home, or wait until post-TestFlight photo retention?  
7. Claims: may journal say “Recommended by touche labs” for Retinol (pregnancy warning on PDP)?  
8. Care_program Stripe: required for soft launch or free journal only?  
9. Who owns Shopify tag/vendor updates vs engineering SKU map file?  
10. Primary acquisition until face-check fixed: TestFlight invite only, or web “Get the journal” without `/scan`?

---

## Suggested first 3 PRs (order)

### PR1 — Soft-launch path safety (no Shopify yet)
- Enable or respect journal flag: either set `JOURNAL_MODE_STANDALONE=1` in prod **or** stop routing no-template/watch users to `/journal/capture` until enabled.  
- Journey-choose: default **routine** for soft launch (or force dual select).  
- `resolveInitialRoute`: non-401 `/me` failures → sign-in or explicit offline screen (not silent Home).  
- Persist native pending capture URI (SecureStore / file).  

### PR2 — Demo-hardening for photo loop
- After successful routine/journal upload, invalidate/refetch Home + Progress (or pass celebrate + force reload).  
- Surface weekly skin-age failure (log + omit chip / “pending”) — remove empty swallow or add server metric.  
- Physical TestFlight smoke checklist executed against PR1 build.  

### PR3 — touche serum map (revenue wedge)
- Add `touche-sku-map.json` (handles/GIDs from Soft Launch todos) + API field on phase/progress-summary.  
- Home routine card: “Recommended by touche labs™” → open PDP with UTMs (Safari).  
- Enforce concern matrix (no Retinol for rosacea/barrier W1–4).  

---

## AOB

- Do not start Check-your-skin rewrites until PR1–2 pass on device.  
- Pinecone `doctorlittle` remains medical coding — not product recs.  
- Soft-launch execution checkboxes remain in [`MYSKINANDCARE_TOUCHELABS_SOFT_LAUNCH_TODOS.md`](MYSKINANDCARE_TOUCHELABS_SOFT_LAUNCH_TODOS.md).  
- Journey narrative SSOT file still missing if stakeholders need the who/journey doc separately.
