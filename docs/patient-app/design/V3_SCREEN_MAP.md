# Patient App v3 Screen Map

**Source mock:** [v3-redesign-source.html](./v3-redesign-source.html)  
**Last updated:** 2026-06-12

## Product framing

Two journeys, one app, shared photo loop:

| Persona | Journey | UX bar |
|---------|---------|--------|
| User A — spot/growth watcher | `watch` | 3 taps max, plain language |
| User B — routine/conflict tracker | `routine` | BFI ring, scan shelf, program steps |

App positioning SSOT: **The #1 Skincare Journal.** Face check = hook; daily photo log = product. See [`docs/Brand/POSITIONING.md`](../../Brand/POSITIONING.md).

## Tab bar (5 tabs)

| Tab | Route | Icon (Tabler outline) |
|-----|-------|------|
| Home | `/(tabs)/home` | `ti-home` |
| Track | `/(tabs)/track` | `ti-camera` |
| Scan | `/(tabs)/scan` | `ti-scan` |
| Progress | `/(tabs)/progress` | `ti-chart-bar` |
| Profile | `/(tabs)/account` | `ti-user` |

Typography: **Gloock** (display) + **DM Sans** (body) via `AppFontsProvider`.

## Route map

| Screen ID | Route | Journey | v3 mock label |
|-----------|-------|---------|-----------------|
| journey-choose | `/onboarding/journey-choose` | both | Step 1 — choose your journey |
| home | `/(tabs)/home` | B (primary) | Today — Whoop-style |
| track-hub | `/(tabs)/track` | A | Journey A — ATM-simple |
| track-capture | `/track/capture` | A | Photo capture + body map |
| spot-timeline | `/track/[spotId]` | A | Spot timeline |
| scan | `/(tabs)/scan` | B | Scan — barcode + shelf |
| verdict | `/verdict/[productId]` | B | Verdict |
| progress | `/(tabs)/progress` | both | Progress — unified |
| profile | `/(tabs)/account` | both | Profile |
| routine-capture | `/routine/capture` | B | Daily progress photo |
| timeline | `/(tabs)/timeline` | both | Internal (hidden tab) |

## Post-auth routing

1. No journey mode → `/onboarding/journey-choose`
2. `watch` only, no spots → `/(tabs)/track`
3. `routine`, no template → `/routine/pick`
4. Incomplete bio → `/onboarding/bio-calibration`
5. Empty shelf → `/(tabs)/scan`
6. Default → `/(tabs)/home`

## Component mapping

| v3 CSS class | RN component | Location |
|--------------|--------------|----------|
| `.mode-card` | `JourneyModeCard` | `components/v3/` |
| `.atm-btn` | `AtmActionButton` | `components/v3/` |
| `.spot-photo` | `SpotCaptureFrame` | `components/v3/` |
| `.body-map` | `BodyMapPicker` | `components/v3/` |
| `.growth-card` | `GrowthSummaryCard` | `components/v3/` |
| `.alert-card` | `DoctorAlertCard` | `components/v3/` |
| `.ring-wrap` | `BarrierScoreRing` | `components/conflict/` |
| `.metric-chips` | `MetricChipRow` | `components/v3/` |
| `.step-list` | `RoutineStepRow` | `components/conflict/` |
| `.photo-cta` | `DailyPhotoCta` | `components/v3/` |
| `.verdict-hero` | `CompatibilityScoreCard` | `components/conflict/` |
| `.conflict-item` | `ConflictCard` | `components/conflict/` |
| `.fab-btn` | `PrimaryFab` | `components/v3/` |
| `.section-label` | `SectionLabel` | `components/v3/` |

## Design tokens (brand SSOT)

| Token | Hex | Use |
|-------|-----|-----|
| cream | `#f8f3ea` | Page background |
| card | `#fffdf9` | Cards, tab bar |
| ink | `#1f2937` | Primary text |
| muted | `#6b7280` | Secondary text |
| line | `#e9e2d6` | Borders |
| brandBlue | `#314db6` | Links |
| fabBg | `#111111` | Primary CTA / FAB |
| watchAmber | `#FAEEDA` | Journey A accents |
| routineGreen | `#E1F5EE` | Journey B safe state |

## Copy strings (v3)

### Journey chooser
- Title: "What brings you here?"
- Sub: "Pick what fits — you can change it anytime."
- Diary card: "Keep a skin diary" / "One photo a day. See what's changing and find your triggers — no routine needed."
- Routine card: "Improve my skin routine" / "Product conflicts and a guided 12-week program."
- Spot card: "Watch a spot or mark" / "Track a mole, growth, or area of concern over time."
- Footer: "You can enable more than one."

### Track hub
- Title: "Track a spot"
- Sub: "Take a photo. We'll measure and watch it with you. No forms. No medical words."
- Disclaimer: "Not a diagnosis. If you're worried, see a doctor. We're just helping you track changes over time."

## Web skin-age funnel (landing SPA → `/app`)

| Step | URL |
|------|-----|
| Scan | `myskinandcare.com/scan` |
| Reveal | `/reveal` |
| Concerns | `/concerns` |
| Signup | `/app/sign-in?intent=signup&from=skin-age-landing` |

Session: `sessionStorage` (`sc_onboarding_*`). On OTP, `completeSkinAgeJourney()` sets template + `journey_modes: ['routine']`.

## Profile tab (`/(tabs)/account`)

- Journey mode toggle (watch / routine)
- Goals card (`GET /api/patient/goals`)
- Bio calibration link
- Care program subscribe (Stripe checkout)
- Session note: 60 min idle / 24h absolute TTL
- Sign out

## Storage (client)

| Data | Web | Native |
|------|-----|--------|
| Session | `localStorage` | SecureStore |
| Skin-age funnel | `sessionStorage` | N/A |
| Onboarding | `localStorage` via `local-persist` | SecureStore |
| Pending photo handoff | `sessionStorage` | in-memory |

## Deprecated (removed in v3)

- Tab: `today` → `home`
- Tab: `plan` (merged into home)
- Tab: `_journal` (hidden; use track + progress)
- Legacy tabs: explore, insights, more, products, routine, profile duplicate, index login tab
