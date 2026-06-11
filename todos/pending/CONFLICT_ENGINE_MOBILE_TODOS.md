# Conflict Engine — implementation checklist

**Status:** Complete (2026-06-10). Primary wedge: ingredient conflict detection end-to-end.

## Backend (B0–B3)

- [x] B0-1 Migration `patient_bio_profiles`, lineup snapshots, shelf columns
- [x] B0-2 GET/PUT `/api/patient/bio-profile`
- [x] B0-3 Funnel + onboarding hydration
- [x] B0-4 `buildBioProfileContext`
- [x] B0-5 Contraindication pass in evaluate
- [x] B0-6/7 Shelf scan + manual add APIs
- [x] B0-8/9 `patient-lineup-resolver-service`
- [x] B0-10 `ingredient_canonical_ids_json`
- [x] B0-11/12 DailyLineup + `computeLineupHash`
- [x] B0-13 `patient_routine_lineup_snapshots`
- [x] B1-1/2 GET/POST `/api/patient/routine/evaluate`
- [x] B1-3 Layering-check delegates to evaluate
- [x] B1-5 `patient-routine-evaluate-service`
- [x] B1-6 POST evaluate-pair
- [x] B1-7 `barrier-load-calculator`
- [x] B1-8/9 BHA alias dedup + class_overload codes
- [x] B1-10 BFI labels
- [x] B1-11 Evidence snippets in evaluate
- [x] B2-1 Lineup preview API
- [x] B2-2 Photo upload tags lineup_hash + verdict
- [x] B2-3 Calendar enrich verdict + BFI
- [x] B2-4 Verdict history API
- [x] B3-1 Public evaluate API
- [x] B3-2 Bio gate for full verdict
- [x] B3-3 Rate limit + bot guard
- [x] NEW-4 Barrier insight API
- [x] NEW-5 Streak percentile API
- [x] NEW-6 Verdict action API
- [x] NEW-7 Improvement metrics in progress-summary

## Mobile (M0–M5)

- [x] M0-1 `conflict-types.ts`
- [x] M0-2 `conflict-api.ts`
- [x] M0-3 `conflict-helpers.ts` + `conflictTokens.ts`
- [x] M1-1 5-tab bar — Scan centered
- [x] M1-2 Scan screen with barcode + shelf list
- [x] M1-4 Verdict screen components
- [x] M1-6 SuggestedFixCard AM/PM split
- [x] M1-9 Manual add sheet
- [x] M1-11 Navigate to verdict after scan
- [x] NEW-1 SpacingTimer
- [x] NEW-2 BarrierScoreRing animation
- [x] NEW-3 RoutineStepRow on Today
- [x] NEW-4 Dip insight on Progress
- [x] NEW-5 Streak percentile copy
- [x] NEW-6 VerdictActions
- [x] NEW-7 ImprovementBar on Progress
- [x] NEW-8 Live shelf pills on Scan
- [x] M2-1 Bio calibration onboarding
- [x] M2-2 Partial verdict banner on Today
- [x] M2-3 Bio edit on Profile
- [x] M2-4 Bio prompt via bootstrap gate
- [x] M3-1 Today uses `/routine/evaluate`
- [x] M3-4 Conflicts metric → Scan tab
- [x] M3-5/6 Capture preflight + post-upload toast
- [x] M4-1/2 Progress photo timeline + verdict tags
- [x] M4-3 BarrierGrid8
- [x] M4-4/5 Timeline link
- [x] M5-1/3 Scan-first bootstrap routing
- [x] Plan header BFI/conflict link

## Tests & docs (T6)

- [x] T6-1–T6-3 Jest: BFI, lineup hash, layering helpers
- [x] T6-9 Vitest: conflict-helpers
- [x] T6-11 E2E scan → verdict (`e2e/conflict-engine-mobile.spec.cjs`, `playwright.conflict-engine.config.cjs`)
- [x] T6-12 This file
- [x] T6-13 JOURNEY.md conflict wedge section
- [x] T6-14 Metrics: `conflict.evaluate.*`, `bfi.elevated.*` (see runbook)
- [x] T6-15 Runbook: `docs/runbooks/CONFLICT_ENGINE.md`

## Out of scope (this wave)

- Pinecone as verdict source
- Full journal day-detail redesign
- Climate/humidity service
- Kelly chat as primary UX
