# STEP 0b — Design system primitives

**Live route:** `/dev/design-primitives`  
**Evidence:** `todos/pending/section1-onboarding-verify-2026-07-19/screenshots/STEP_0b_primitives_sheet.png`

## Checklist
- [x] `--red: #E31919` (NOT #ba200a, NOT #F7591F — retired list shown on sheet; no assignment in ToucheMarkCompact)
- [x] `--black: #0B0B0C`
- [x] `--white: #FFFFFF`
- [x] Font: Poppins ExtraBold (display), Manrope (body) — loaded via AppFontsProvider
- [x] Tulip mark component with color prop; exact `TULIP_PATH` from tulip-mark.svg
- [x] Track FAB: solid red, 4px white ring, white center dot (verified on dark strip)
- [x] Back-nav header: chevron + label
- [x] Tab line-icons: calendar grid, bottle, trending-up, person

## Code
- `patient-app/constants/v4DesignTokens.ts`
- `patient-app/components/v4/{ToucheTulipMark,TrackFab,BackNavHeader,TabLineIcon}.tsx`
- `patient-app/components/ToucheMarkCompact.tsx` (color prop; red default)
- `patient-app/components/ui/AppFontsProvider.tsx` (Poppins + Manrope)
- `patient-app/app/(tabs)/_layout.tsx` (line-icons + Track FAB)
- `patient-app/app/dev/design-primitives.tsx`
- Test: `patient-app/lib/__tests__/v4-design-tokens.test.ts` PASS

**Verdict: MATCH**

Proceed to Step 1 Welcome.
