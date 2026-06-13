# Redesign v3 Audit Report

Generated: 2026-06-11T16:58:07.198Z

## Summary

- **HTML mockup screens:** 8
- **Mockup tap targets:** 63 (all static / not configured)
- **Mockup issues:** 5 structural
- **Live app screens tested:** 9
- **Live buttons:** pass 18, fail 0, skip 2

## HTML mockup — screens and functions

### 1. Step 1 — choose your journey (once, forever)

- **Intended route:** `/app/onboarding/journey-choose`
- **Journey:** shared
- **Functions:**
  - Select watch vs routine journey mode
  - Dual-mode note (both journeys allowed)
- **Buttons / tap targets:**
  - `Watch something on my skin
A spot, growth, mole, or mark I w` — not_configured_static_mockup
  - `Improve my skin routine
Track acne, check if products clash,` — not_configured_static_mockup
  - `Home` — not_configured_static_mockup
  - `Track` — not_configured_static_mockup
  - `Scan` — not_configured_static_mockup
  - `Progress` — not_configured_static_mockup
  - `Profile` — not_configured_static_mockup
- **Mock data:**
```json
{
  "status_tags": [
    "Watch"
  ]
}
```

### 2. Journey A — Grandma tracks a growth (ATM-simple)

- **Intended route:** `/app/(tabs)/track`
- **Journey:** watch
- **Functions:**
  - ATM entry: camera capture, gallery upload, view timeline
- **Buttons / tap targets:**
  - `Take a photo now
Point at the spot, tap the button` — not_configured_static_mockup
  - `Upload from gallery
Use a photo you already took` — not_configured_static_mockup
  - `See my photos so far
Compare how it has changed` — not_configured_static_mockup
  - `Home` — not_configured_static_mockup
  - `Track` — not_configured_static_mockup
  - `Scan` — not_configured_static_mockup
  - `Progress` — not_configured_static_mockup
  - `Profile` — not_configured_static_mockup
- **Mock data:**
```json
{}
```

### 3. Journey A — photo capture (guides the grandmother)

- **Intended route:** `/app/track/capture`
- **Journey:** watch
- **Functions:**
  - Spot capture with body map and size reference
- **Buttons / tap targets:**
  - `Cancel` — not_configured_static_mockup
  - `Save photo` — not_configured_static_mockup
  - `Home` — not_configured_static_mockup
  - `Track` — not_configured_static_mockup
  - `Scan` — not_configured_static_mockup
  - `Progress` — not_configured_static_mockup
  - `Profile` — not_configured_static_mockup
  - `Tap anywhere to capture
Hold still
Put a coin next to it for` — not_configured_static_mockup
- **Mock data:**
```json
{}
```

### 4. Journey A — spot timeline (the proof loop)

- **Intended route:** `/app/track/[spotId]`
- **Journey:** watch
- **Functions:**
  - Spot timeline comparison strip
  - Growth summary card
  - Doctor alert card
- **Buttons / tap targets:**
  - `Find a dermatologist` — not_configured_static_mockup
  - `Find a dermatologist` — not_configured_static_mockup
  - `Back` — not_configured_static_mockup
  - `Home` — not_configured_static_mockup
  - `Track` — not_configured_static_mockup
  - `Scan` — not_configured_static_mockup
  - `Progress` — not_configured_static_mockup
  - `Profile` — not_configured_static_mockup
- **Mock data:**
```json
{
  "dates": [
    "Jun 1",
    "Jun 8",
    "Jun 13",
    "Today"
  ],
  "growth_copy": [
    "Size appears stable",
    "Worth showing a doctor"
  ]
}
```

### 5. Today — Whoop-style, routine-aware

- **Intended route:** `/app/(tabs)/home`
- **Journey:** routine
- **Functions:**
  - BFI ring and barrier insight
  - Routine step states
  - Daily photo CTA
  - Metric chips (conflicts, streak, skin age)
- **Buttons / tap targets:**
  - `Take today's photo
14 day streak
Yesterday: conflict` — not_configured_static_mockup
  - `Home` — not_configured_static_mockup
  - `Track` — not_configured_static_mockup
  - `Scan` — not_configured_static_mockup
  - `Progress` — not_configured_static_mockup
  - `Profile` — not_configured_static_mockup
- **Mock data:**
```json
{
  "bfi_values": [
    "barrier too low tonight\nCeramide moisturiser\nApply generously\nDAILY PHOTO\nTake today's photo\n14"
  ],
  "percentages": [
    "5%"
  ],
  "streak_days": [
    "14\nday streak",
    "14 day streak"
  ],
  "status_tags": [
    "Safe"
  ]
}
```

### 6. Scan — barcode + live shelf status

- **Intended route:** `/app/(tabs)/scan`
- **Journey:** routine
- **Functions:**
  - Barcode scanner area
  - Shelf product list with verdict tags
  - Add product FAB
- **Buttons / tap targets:**
  - `Add product` — not_configured_static_mockup
  - `Add product` — not_configured_static_mockup
  - `Home` — not_configured_static_mockup
  - `Track` — not_configured_static_mockup
  - `Scan` — not_configured_static_mockup
  - `Progress` — not_configured_static_mockup
  - `Profile` — not_configured_static_mockup
  - `CeraVe Retinol Serum
PM · clashes with your BHA
Conflict` — not_configured_static_mockup
  - `The Ordinary Niacinamide
AM · pH watch — wait 20 min after a` — not_configured_static_mockup
  - `La Roche-Posay SPF 50
AM · safe with your routine
Safe` — not_configured_static_mockup
- **Mock data:**
```json
{
  "product_names": [
    "CeraVe Retinol Serum\nPM · clashes with your BHA\nConflict\nThe Ordinary Niacinamide\nAM · pH watch — wait 20 min after acid\nWatch\nLa Roche-Posay SPF 50\nAM · safe with your routine\nSafe\nAdd product\nHome\nTrack\nScan\nProgress\nProfile"
  ],
  "status_tags": [
    "Conflict",
    "Watch",
    "Safe"
  ]
}
```

### 7. Verdict — personalized for your profile

- **Intended route:** `/app/verdict/[productId]`
- **Journey:** routine
- **Functions:**
  - Personalized verdict hero
  - Conflict list
  - Suggested fix card
  - Remove / keep actions
- **Buttons / tap targets:**
  - `Remove from shelf` — not_configured_static_mockup
  - `Keep anyway` — not_configured_static_mockup
  - `Remove from shelf` — not_configured_static_mockup
  - `Keep anyway` — not_configured_static_mockup
  - `Back` — not_configured_static_mockup
  - `Home` — not_configured_static_mockup
  - `Track` — not_configured_static_mockup
  - `Scan` — not_configured_static_mockup
  - `Progress` — not_configured_static_mockup
  - `Profile` — not_configured_static_mockup
- **Mock data:**
```json
{
  "scores": [
    "24/100"
  ],
  "product_names": [
    "CeraVe SA Cleanser\n24/100\nHigh risk for you personally\nSalicylic acid conflicts with your retinol. Your rosacea makes this worse.\nWHY IT'S FLAGGED FOR YOU\nBHA destroys your retinol\nSalicylic acid breaks down retinol on contact. Both products become useless. Move to separate days.\nCritical\nRosacea + BHA = flare risk\nYour profile flags rosacea. BHA triggers vascular flushing in rosacea skin.\nHigh\nTHE FIX\nUse PHA cleanser instead\nGluconolactone exfoliates gently, safe with retinol, and doesn't trigger rosacea pathways.\nRemove from shelf\nKeep anyway\nHome\nTrack\nScan\nProgress\nProfile"
  ],
  "status_tags": [
    "High",
    "Critical"
  ]
}
```

### 8. Progress — both journeys in one view

- **Intended route:** `/app/(tabs)/progress`
- **Journey:** shared
- **Functions:**
  - BFI ring and barrier insight
  - Routine step states
  - Daily photo CTA
  - Metric chips (conflicts, streak, skin age)
  - Streak + percentile
  - 8-day barrier grid
  - Barrier dip insight
  - Improvement metrics bars
  - Spot tracking row
- **Buttons / tap targets:**
  - `Home` — not_configured_static_mockup
  - `Track` — not_configured_static_mockup
  - `Scan` — not_configured_static_mockup
  - `Progress` — not_configured_static_mockup
  - `Profile` — not_configured_static_mockup
  - `Neck spot
18 days · size stable · 4 photos` — not_configured_static_mockup
- **Mock data:**
```json
{
  "bfi_values": [
    "barrier dropped 23"
  ],
  "percentages": [
    "12%",
    "+18%",
    "-34%"
  ],
  "streak_days": [
    "14\nDay streak"
  ]
}
```

## Live patient-app — button results

### journey-choose: Step 1 — choose your journey

- **Route:** `/app/onboarding/journey-choose`
| Button | Action | Result | Issue |
|--------|--------|--------|-------|
| Watch something on my skin | toggle_watch | pass |  |
| Improve my skin routine | toggle_routine | pass |  |
| Continue | navigate_after_choose | pass |  |

### track-atm: Journey A — ATM-simple

- **Route:** `/app/(tabs)/track`
| Button | Action | Result | Issue |
|--------|--------|--------|-------|
| Take a photo now | open_capture | pass |  |
| Upload from gallery | gallery_capture | skipped | Native picker |
| See my photos so far | open_spot_timeline | pass |  |

### track-capture: Journey A — photo capture

- **Route:** `/app/track/capture`
| Button | Action | Result | Issue |
|--------|--------|--------|-------|
| Cancel | go_back | pass |  |
| Save photo | save_photo | pass |  |

### spot-timeline: Journey A — spot timeline

- **Route:** `/app/track/spot_neck_1`
- **Mock-aligned data visible:** neck_spot
| Button | Action | Result | Issue |
|--------|--------|--------|-------|
| /back/i | go_back | pass |  |
| Find a dermatologist | external_link | skipped | Opens external AAD URL |
| Add another photo | add_photo | pass |  |

### home: Today — Whoop-style

- **Route:** `/app/(tabs)/home`
- **Mock-aligned data visible:** streak_14, bfi_62
| Button | Action | Result | Issue |
|--------|--------|--------|-------|
| /Take today's photo/i | routine_capture | pass |  |
| Conflicts | open_scan | pass |  |

### scan: Scan — barcode + shelf

- **Route:** `/app/(tabs)/scan`
- **Mock-aligned data visible:** shelf_products
| Button | Action | Result | Issue |
|--------|--------|--------|-------|
| Add product | manual_add | pass |  |
| CeraVe Retinol Serum | open_verdict | pass |  |

### verdict: Verdict — personalized

- **Route:** `/app/verdict/shelf_cerave_retinol`
- **Mock-aligned data visible:** bfi_62, shelf_products
| Button | Action | Result | Issue |
|--------|--------|--------|-------|
| /don't use it|remove from shelf/i | remove_product | pass |  |
| /keep anyway/i | keep_product | pass |  |

### progress: Progress — both journeys

- **Route:** `/app/(tabs)/progress`
- **Mock-aligned data visible:** streak_14, bfi_62, percentile_top_12, neck_spot
| Button | Action | Result | Issue |
|--------|--------|--------|-------|
| Neck spot | open_spot | pass |  |

### account: Profile — not in mockup

- **Route:** `/app/(tabs)/account`
- **Mockup gap:** Profile tab screen missing from HTML spec
| Button | Action | Result | Issue |
|--------|--------|--------|-------|
| Sign out | sign_out | pass |  |
| Change program | routine_pick | pass |  |

## Side-by-side gap analysis

| Feature | Live status | Issue |
|---------|-------------|-------|
| Journey choose mode cards | Implemented | App has Continue CTA; mockup does not |
| Track ATM 3 actions | Implemented | track.tsx |
| Capture coin/body guide | Implemented | SpotCaptureFrame + BodyMapPicker |
| Timeline photo thumbs | Implemented | SpotTimelineStrip renders SessionImage when URL present |
| Growth size bars 55%→52% | Implemented | GrowthSummaryCard dynamic bars from size_signal |
| Find a dermatologist | Implemented | Links to AAD URL |
| Home BFI ring 62 | API-driven | /routine/evaluate |
| Skip retinol step | API-driven | routine_step_states from evaluate |
| Scan barcode animation | Implemented | Real camera vs mock CSS animation |
| Verdict PHA fix | API-driven | suggested_fix from evaluate |
| Progress Top 12% | API-driven | /home/streak-percentile |
| BFI 8-day grid | Implemented | Needs verdict-history API |
| Dip insight 23pts | Implemented | pattern_count + drop_points in barrier-insight |
| Improvement metric bars | API-driven | improvement_metrics from progress-summary |
| Progress spot row | Implemented | spot-store + size stable label on SpotRowCard |
| Profile tab screen | Missing from mockup | Account exists in app only |
| HTML tab bars (40) | N/A | Decorative in static spec |
| FEATURE_V3_INSIGHTS | Implemented | ProductInsightCard on Verdict when flag enabled |

## Mock data catalog (HTML hardcoded)

| Domain | Values |
|--------|--------|
| Spot timeline | Neck spot, 18 days; Jun 1/8/13/Today; same/watch/alert tags |
| Growth | Size appears stable; bars 55% → 52% |
| Home | BFI 62, 2 conflicts, streak 14, skin age -5 |
| Routine | Gentle cleanser safe; Retinol skip; Ceramide todo |
| Scan shelf | CeraVe Retinol (Conflict), TO Niacinamide (Watch), LRP SPF (Safe) |
| Verdict | CeraVe SA Cleanser 24/100; BHA+retinol; rosacea; PHA fix |
| Progress | Streak 14, Top 12%; BFI grid 82,88,61,74,85,91,62,—; clarity +18%, redness -34%, age -5y |

## Issues not configured

### HTML mockup (expected)
- All buttons are non-functional (no JS)
- Tab bars do not navigate
- Mode cards have no selection handler
- CSS design tokens not loaded in standalone file

### Live app gaps vs mockup
- **Home BFI ring 62:** API-driven — /routine/evaluate
- **Skip retinol step:** API-driven — routine_step_states from evaluate
- **Verdict PHA fix:** API-driven — suggested_fix from evaluate
- **Progress Top 12%:** API-driven — /home/streak-percentile
- **Improvement metric bars:** API-driven — improvement_metrics from progress-summary
- **Profile tab screen:** Missing from mockup — Account exists in app only

## How to re-run

```bash
node scripts/playwright-redesign-mockup-audit.mjs
node scripts/build-consumer-hosting.cjs
cd middleware-platform && npx playwright test --config playwright.redesign-parity.config.cjs
node scripts/generate-redesign-audit-report.mjs
```

---

## Journal-first UI audit (2026-06-12)

Automated via `middleware-platform/e2e/journal-first-ui-audit.spec.cjs` against consumer hosting.

**Inventory:** `middleware-platform/playwright-report/journal-ui-audit-inventory.json`

### Summary

| Category | Passed | Failed |
|----------|--------|--------|
| Functional flows | 7 | 0 |
| Design parity | 10 | 0 |

### Functional (all pass)

- Onboarding: 3 journey cards; diary Continue routes to Home
- Diary Home: journal CTA, condition chips, trigger insight; no routine gate
- Journal capture route loads
- Tab bar: 5 tabs navigate
- Progress: title + skin improvements when stubbed
- Account: spot journey toggle visible

### Design parity (all pass)

- Gloock display typography on onboarding + progress titles
- Progress subtitle "Small changes. Real results."
- Cream polaroid streak hero (empty streak)
- Calendar header button
- 4 sparkline metric cards (Redness, Breakouts, Texture, Hydration)
- Timeline "See all" link
- Tab bar brand blue active state
- Home recent photo strip for journal users
- Continue CTA `#111`

### Screenshots

`middleware-platform/playwright-report/journal-ui-audit-screenshots/`

### Re-run

```bash
cd middleware-platform && npm run test:journal-ui-audit
cd middleware-platform && npm run test:e2e-v3-redesign
```

---

## Live staging QA (journal-first deploy)

**Automated local gate:** `bash scripts/verify-prod-ready.sh` — pass (2026-06-13).

**Staging API pre-deploy probe:** `GET /api/patient/journal/trigger-insights` on `api.callsomo.com` returned **404 Endpoint not found** — journal routes require middleware deploy with migration `059` and env flags (`JOURNAL_MODE_STANDALONE=1`, etc.). Env SSOT verified via `generate-cloudrun-env-yaml.cjs` (staging profile).

**Manual diary QA** (run after staging deploy on `https://myskinandcare.com/app`):

| Step | Check | Status |
|------|-------|--------|
| 1 | Sign in → journey → **Keep a skin diary** → Home (not routine pick) | Pending deploy |
| 2 | Log photo → no 503 | Pending deploy |
| 3 | Condition chip + note saves | Pending deploy |
| 4 | Progress → polaroid / sparklines / timeline | Pending deploy |
| 5 | Trigger insight after 2+ entries | Pending deploy |

**Deploy orchestration:** `./scripts/journal-first-deploy.sh` (requires `gcloud auth login` + `firebase login --reauth`).
