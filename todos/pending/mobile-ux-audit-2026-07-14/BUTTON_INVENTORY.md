# BUTTON_INVENTORY

Generated: 2026-07-14T14:08:19.114Z

| Screen | Button | Action | Result | Notes |
| --- | --- | --- | --- | --- |
| Sign-in | Go back | Stay in-app (router.back or replace INDEX) — never marketing home | **pass** | TOUCH-004: no LANDING_ORIGIN / window.location.assign on Back |
| Sign-in | Send code | Advance to OTP | **pass** | http://127.0.0.1:5195/app/sign-in |
| Sign-in OTP | Go back (top) | Stay in-app (same onBack as email step) | **pass** | TOUCH-005: never opens marketing site |
| Sign-in OTP | Use a different email | Reset to email step | **pass** | http://127.0.0.1:5195/app/sign-in |
| Sign-in | Retry | Re-run cold start | **pass** | — |
| Track | Track tab visible | Render spot list | **pass** | — |
| Scan | or search by name | Open manual add | **pass** | http://127.0.0.1:5195/app/scan |
| Scan | Add product | Open manual add FAB | **pass** | http://127.0.0.1:5195/app/scan |
| Profile | Edit skin profile | Open bio calibration | **pass** | http://127.0.0.1:5195/app/onboarding/bio-calibration |
| Profile | Change program | Open routine pick | **pass** | http://127.0.0.1:5195/app/routine/pick |
| Profile | Subscribe | Stripe checkout (external) | **skip** | Opens external Stripe WebBrowser |
| Profile | Sign out | Clear session → sign-in | **pass** | http://127.0.0.1:5195/app/sign-in |
| Progress | Spot row (Neck spot) | Open track/[id] | **pass** | http://127.0.0.1:5195/app/track/spot_neck_1 |
| Verdict | Don't use it | Remove → Scan | **fail** | Control not found: Don't use it |
| Verdict | Keep anyway | Keep → Scan | **pass** | http://127.0.0.1:5195/app/scan |
| Routine capture | Cancel | Navigate back | **pass** | http://127.0.0.1:5195/app/_journal |
| Routine pick | Acne program card | Select program | **pass** | http://127.0.0.1:5195/app/routine/pick |
| Tab bar | Track | Navigate to Track | **pass** | http://127.0.0.1:5195/app/track |
| Tab bar | Scan | Navigate to Scan | **pass** | http://127.0.0.1:5195/app/scan |
| Tab bar | Progress | Navigate to Progress | **pass** | http://127.0.0.1:5195/app/progress |
| Tab bar | Profile | Navigate to Profile | **pass** | http://127.0.0.1:5195/app/account |
| Tab bar | Home | Navigate to Home | **pass** | http://127.0.0.1:5195/app/home |
| Home | Log progress photo | Open routine capture | **pass** | http://127.0.0.1:5195/app/routine/capture?date=2026-07-14 |
| Progress | Compare day 1 to today | Open compare | **pass** | http://127.0.0.1:5195/app/compare?dateA=2026-07-14&dateB=2026-01-15 |

Summary: 20 pass / 3 fail / 1 skip
