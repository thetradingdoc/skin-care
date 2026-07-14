# MARKET_GAP

IA-grounded gap analysis. Diagnostic only — not a redesign spec.
Evidence slugs refer to files under `screenshots/`.

## 1. Complex multi-concern care

- **Have:** Multi-select at journey-choose; routine/pick concern → template.
- **Gap:** One active template; one bio pass. No concern priority or concurrent routines. Verdict evaluates a single active plan.
- **Gap type:** `data-model` (+ `engine`) before UI.
- **UX direction:** Concern-priority on bio-calibration; multi-concern cues on verdict.
- **Audit evidence:** `screenshots/34-gate-journey-choose.png`, `screenshots/35-gate-routine-pick.png`, `screenshots/28-feature-verdict.png`

## 2. Ingredient transparency + allergen exclusion

- **Have:** Scan → OBF/INCI → verdict; bio conditions/prescriptions.
- **Gap:** No acrylate/allergen *exclusion filter*; verdicts advisory (caution), not hard-gated.
- **Gap type:** Small UI + `engine` flag on existing screens.
- **UX direction:** Allergen step on bio (acrylates named); distinct hard-exclude vs soft-caution on verdict.
- **Audit evidence:** `screenshots/36-gate-bio-calibration.png`, `screenshots/28-feature-verdict.png`

## 3. Hyper-personalization (env / lifestyle / budget / hormones)

- **Have:** Bio + funnel segments.
- **Gap:** No location/budget/lifestyle in gates; no hormonal-cycle axis.
- **Gap type:** Progressive profiling on Profile — not a new gate.
- **UX direction:** Extend Profile edit-bio; hormone opt-in on Track later.
- **Audit evidence:** `screenshots/36-gate-bio-calibration.png`, `screenshots/24-tab-profile-session-copy.png`, gate screens as negative evidence for lifestyle fields.

## 4. Progress beyond photos

- **Have:** Progress BFI strip, streak, compare-two-dates.
- **Gap:** No cost-per-use, expiry, or concern-rating time-series.
- **Gap type:** `screen` extension — cheapest theme.
- **UX direction:** Optional severity on daily photo; Progress graphs; cost/expiry fields on Scan add-product.
- **Audit evidence:** `screenshots/22-tab-progress.png`, `screenshots/21-tab-scan-with-shelf.png`, `screenshots/29-feature-routine-capture-writable.png`

## 5. Local availability / regional environment

- **Have:** Global shelf eval only.
- **Gap:** Sourcing before UI.
- **Gap type:** `sourcing` — deprioritize UI.
- **UX direction:** Optional unused Profile location field only if needed for pipeline.
- **Audit evidence:** `screenshots/21-tab-scan-with-shelf.png`

## 6. At-home ↔ professional bridge

- **Have:** Care program / Subscribe on Profile; specialist funnel bits on web.
- **Gap:** No procedure object; no recovery-mode capture.
- **Gap type:** Small data-model + capture variant.
- **UX direction:** Procedure date on Profile care-program; routine/capture recovery branch.
- **Audit evidence:** `screenshots/24-tab-profile-session-copy.png`, `screenshots/29-feature-routine-capture-writable.png`

## Prioritized backlog (build cost × signal)

| Priority | Theme | Why |
| --- | --- | --- |
| 1 | Progress ratings/cost/expiry (#4) | Fits existing screens; no new gates |
| 2 | Allergen exclusion bio+verdict (#2) | High-severity pain; small surface |
| 3 | Multi-concern priority (#1) | Needs data-model before UI |
| 4 | Procedure-aware routine mode (#6) | Cheap after #1 template logic |
| 5 | Progressive profiling (#3) | Ride Profile edit-bio |
| 6 | Regional availability (#5) | Sourcing first |

## Structural sequencing flag

Themes **#1, #2, #3** all touch **bio-calibration** and **verdict**. Sequence or assign a **single design owner** before parallel tickets — avoid three uncoordinated schema changes on the same two screens.
