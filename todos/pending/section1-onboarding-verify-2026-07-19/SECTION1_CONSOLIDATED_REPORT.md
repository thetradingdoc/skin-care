# Section 1 consolidated report — Onboarding (Steps 0a → 6)

**Date:** 2026-07-19  
**Stopped before Section 2 (Billing)** — awaiting your review to continue.

---

## STEP 0a — Playwright baseline

| | |
|--|--|
| Folder | `todos/pending/touche-full-screen-audit-2026-07-19/` |
| Shots | 75 PNGs under `screenshots/` |
| Summary | `AUDIT_SUMMARY.md` (70 routes · OK 64 · FAIL 6) |
| Verdict | **COMPLETE** (pre-restyle truth locked before any UI work) |

---

## STEP 0b — Wave 0 primitives

| | |
|--|--|
| Evidence | `todos/pending/section1-onboarding-verify-2026-07-19/screenshots/STEP_0b_primitives_sheet.png` |
| Route | `/dev/design-primitives` |
| Report | `STEP_0b_PRIMITIVES.md` |
| Verdict | **MATCH** (`#E31919` / `#0B0B0C` / `#FFFFFF`, Poppins+Manrope, tulip+color, FAB+white ring, back-nav, tab line-icons) |

---

## Steps 1–6

| Step | Screen | Live | Mock shot | Live shot | Verdict |
|------|--------|------|-----------|-----------|---------|
| 1 | Welcome | `/welcome` | `STEP_1_mock_welcome.png` | `STEP_1_live_welcome.png` | **MATCH** |
| 2 | Consent | `/capture/consent` | `STEP_2_mock_consent.png` | `STEP_2_live_consent.png` | **MATCH** |
| 3 | Why are you here | `/onboarding/why` | `STEP_3_mock_why.png` | `STEP_3_live_why.png` | **MATCH** (+ persist `pending_routine_concern=hyperpigmentation`) |
| 4 | Plan preview | `/onboarding/plan-preview` | `STEP_4_mock_plan.png` | `STEP_4_live_plan.png` | **MATCH** (local UI + live prod `claim-safe` on `00211-96g`) |
| 5 | Sign in | `/sign-in` | `STEP_5_mock_signin.png` | `STEP_5_live_signin.png` | **MATCH** |
| 6 | OTP entry | `/auth/otp-entry` | `STEP_6_mock_otp.png` | `STEP_6_live_otp.png` | **MATCH** |
| 6b | OTP error | `/auth/otp-error` | (template-shared) | `STEP_6_live_otp_error.png` | **MATCH** |

All individual reports: `todos/pending/section1-onboarding-verify-2026-07-19/STEP_*.md`  
All screenshots: `todos/pending/section1-onboarding-verify-2026-07-19/screenshots/`

---

## Wiring / backend summary (Section 1)

| Step | FE | BE |
|------|----|----|
| 1 | Static | — |
| 2 | Static → Why | — |
| 3 | Persona save | `pending_routine_concern` + `onboarding_concern_id`; post-auth `POST …/routine/template` |
| 4 | Plan UI | **`GET …/preview/claim-safe`** (`buildClaimSafePreview`) — must be on serving revision for prod |
| 5–6 | OTP form | `verify/send` + `verify/confirm`; error/resend intact |

---

## Explicitly not started
- Section 2 Billing (Steps 7–11)
- Capture / tabs

**Ready for your review.** Say when to continue to Section 2.
