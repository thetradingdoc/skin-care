# STEP 3 — Why are you here (persona picker)

Mock reference: frame 3  
Live route: `/onboarding/why`  
Backend wiring: `setPendingRoutineConcern` + `setOnboardingConcernId` → post-auth `POST /api/patient/routine/template`

Mock screenshot: `…/STEP_3_mock_why.png`  
Live screenshot: `…/STEP_3_live_why.png`

## Checklist
- [x] Visual: title/tagline/four personas/Continue match mock intent
- [x] No “12-week track” copy in this screen source
- [x] Back-nav present
- [x] **All four personas persist** (re-verified 2026-07-19):

| Persona tile | Expected `pending_routine_concern` | Observed | Observed `onboarding_concern_id` | OK |
|--------------|--------------------------------------|----------|----------------------------------|-----|
| Dark marks | `hyperpigmentation` | `hyperpigmentation` | `hyperpigmentation` | yes |
| Active breakouts | `acne` | `acne` | `acne` | yes |
| Sensitive/reactive | `rosacea` | `rosacea` | `rosacea` | yes |
| General wellness | `general_wellness` | `general_wellness` | `general_wellness` | yes |

**Verdict: MATCH** (visual + wiring for all four personas)

