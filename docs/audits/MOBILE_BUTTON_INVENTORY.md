# Mobile App Button Inventory (Playwright Audit)

Generated: 2026-06-11T02:27:15.862Z

Test surface: Expo **web export** at `/app/*` (not native iOS/Android).

## Summary

| Metric | Count |
|--------|------:|
| Total audited | 61 |
| Pass | 51 |
| Fail | 0 |
| Skip | 10 |

## Existing spec coverage (prior suites)

| Screen | Button | Action | Result | Source |
|--------|--------|--------|--------|--------|
| Sign-in | Go back | Return to landing | pass | consumer-sign-in.spec.cjs |
| Sign-in | Send code | Advance to OTP step | pass | consumer-sign-in-otp.spec.cjs |
| Sign-in | Continue | Verify OTP → routine pick | pass | consumer-sign-in-otp.spec.cjs |
| Verdict | Keep anyway | Keep on shelf → Scan | pass | conflict-engine-mobile.spec.cjs |
| Scan | Page load | Scan hub renders | partial | conflict-engine-mobile.spec.cjs |
| Onboarding | Build my routine | Reveal → concerns | partial | skin-age-journey.spec.cjs |
| Onboarding | Upload selfie | Face read flow | partial | skin-age-journey.spec.cjs |

## Full button audit

| Screen | Button | Expected action | Route | Result | Notes |
|--------|--------|-------------------|-------|--------|-------|
| Tab bar | Today | Navigate to Today tab | `/app/(tabs)/today` | **pass** |  |
| Tab bar | Progress | Navigate to Progress tab | `/app/(tabs)/today` | **pass** |  |
| Tab bar | Scan | Navigate to Scan tab | `/app/(tabs)/today` | **pass** |  |
| Tab bar | Plan | Navigate to Plan tab | `/app/(tabs)/today` | **pass** |  |
| Tab bar | Profile | Navigate to Account tab | `/app/(tabs)/today` | **pass** |  |
| Today | Conflicts chip | Open Scan tab | `/app/(tabs)/today` | **pass** |  |
| Today | See all (photo history) | Open Progress | `/app/(tabs)/today` | **pass** |  |
| Today | More about this phase | Toggle phase notes | `/app/(tabs)/today` | **pass** |  |
| Today | Take today's photo (FAB) | Open capture flow | `/app/(tabs)/today` | **pass** |  |
| Today | Complete skin profile banner | Open bio calibration | `/app/(tabs)/today` | **skip** | Hidden when bio profile_complete=true in mock |
| Progress | Open journal timeline | Open timeline tab | `/app/(tabs)/progress` | **pass** |  |
| Scan | or search by name | Open manual add modal | `/app/(tabs)/scan` | **pass** |  |
| Scan | Add product (FAB) | Open manual add modal | `/app/(tabs)/scan` | **pass** |  |
| Scan | Shelf product row | Open verdict | `/app/(tabs)/scan` | **pass** |  |
| Scan | Allow camera | Request camera permission | `/app/(tabs)/scan` | **skip** | Camera permission varies in headless Chromium |
| Plan | Scan header link | Open Scan tab | `/app/(tabs)/plan` | **pass** |  |
| Account | Edit skin profile | Open bio calibration | `/app/(tabs)/account` | **pass** |  |
| Account | Subscribe | Start Stripe checkout | `/app/(tabs)/account` | **skip** | Opens external Stripe via WebBrowser |
| Account | Bills & receipts | Open money tab | `/app/(tabs)/account` | **pass** |  |
| Account | Change program | Open routine pick | `/app/(tabs)/account` | **pass** |  |
| Account | Sign out | Clear session → sign-in | `/app/(tabs)/account` | **pass** |  |
| Sign-in | Go back | Return to landing | `/app/sign-in` | **pass** |  |
| Sign-in | Send code | Advance to OTP step | `/app/sign-in` | **pass** |  |
| Sign-in | Use a different email | Reset to email step | `/app/sign-in` | **pass** |  |
| Bio calibration | Acne condition chip | Select condition | `/app/onboarding/bio-calibration` | **pass** |  |
| Bio calibration | Continue | Advance step | `/app/onboarding/bio-calibration` | **pass** |  |
| Verdict | Share | Share verdict | `/app/verdict/shelf_e2e_retinol` | **pass** |  |
| Verdict | Don't use it | Remove from shelf → Scan | `/app/verdict/shelf_e2e_retinol` | **pass** |  |
| Verdict | Keep anyway | Keep on shelf → Scan | `/app/verdict/shelf_e2e_retinol` | **pass** |  |
| Bio calibration | Back | Previous step | `/app/onboarding/bio-calibration` | **skip** | Flaky step navigation in headless web export |
| Routine pick | Acne program card | Select program | `/app/routine/pick` | **pass** |  |
| Routine pick | Start tracking | Create template → Today | `/app/routine/pick` | **pass** |  |
| Routine capture | Cancel | Navigate back | `/app/routine/capture` | **pass** |  |
| Routine capture | Allow camera | Request permission | `/app/routine/capture` | **skip** | Camera permission varies in headless Chromium |
| Timeline | Photos tab | Switch to photos view | `/app/(tabs)/timeline` | **pass** |  |
| Timeline | Calendar tab | Switch to calendar view | `/app/(tabs)/timeline` | **pass** |  |
| Timeline | List tab | Switch to list view | `/app/(tabs)/timeline` | **pass** |  |
| Timeline | Documents tab | Switch to documents view | `/app/(tabs)/timeline` | **pass** |  |
| Money | Capture receipt or bill | Open scan entry | `/app/(tabs)/money` | **pass** |  |
| Home | First capture CTA | Open scan entry | `/app/(tabs)/home` | **pass** |  |
| Insights | Manage plan | No-op stub | `/app/(tabs)/insights` | **skip** | Intentional no-op stub in code |
| Insights | Sign out | Sign out → home | `/app/(tabs)/insights` | **pass** |  |
| Explore | Open checkout chat | Open checkout chat | `/app/(tabs)/explore` | **pass** |  |
| Scan entry | Scan receipt | Open capture-scan | `/app/scan-entry` | **pass** |  |
| Scan entry | Upload EOB/PDF | Open capture-upload | `/app/scan-entry` | **pass** |  |
| Scan entry | Add bill manually | Open manual bill | `/app/scan-entry` | **pass** |  |
| Scan entry | Add payment manually | Open manual payment | `/app/scan-entry` | **pass** |  |
| Scan entry | Close | Close modal | `/app/scan-entry` | **pass** |  |
| Capture scan | Close | Close screen | `/app/capture-scan` | **pass** |  |
| Capture upload | Choose file | File picker | `/app/capture-upload` | **skip** | Native file picker not automatable in headless web |
| Capture manual bill | Save bill | Save manual bill | `/app/capture-manual-bill` | **pass** |  |
| Capture manual bill | Cancel | Cancel form | `/app/capture-manual-bill` | **pass** |  |
| Capture manual payment | Save payment | Save manual payment | `/app/capture-manual-payment` | **pass** |  |
| Capture complete | Open timeline | Open timeline tab | `/app/capture-complete` | **pass** |  |
| Checkout chat | Pay without chat | Skip chat checkout | `/app/checkout-chat` | **skip** | Opens external Stripe checkout |
| Checkout chat | Go to Home | Navigate home tab | `/app/checkout-chat` | **pass** |  |
| Onboarding scan | Skip for now | Skip to concerns | `/app/onboarding/scan` | **pass** |  |
| Onboarding concerns | Not sure — skip | Skip to signup | `/app/onboarding/concerns` | **pass** |  |
| Onboarding concerns | Continue | Save concerns → signup | `/app/onboarding/concerns` | **pass** |  |
| Appointments (legacy) | Send verification code | Send OTP | `/app/(tabs)/index` | **skip** | Legacy index hidden tab; Expo web may mount today instead of index route |
| Appointments (legacy) | Sign out | Sign out | `/app/(tabs)/index` | **skip** | Index redirects to Today when session + template exist |

## How to re-run

```bash
cd middleware-platform
npx playwright install chromium
npx playwright test --config playwright.mobile-button-inventory.config.cjs
node scripts/generate-mobile-button-report.cjs
```
