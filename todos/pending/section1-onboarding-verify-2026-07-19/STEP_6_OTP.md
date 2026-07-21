# STEP 6 — OTP entry (+ template-shared OTP error)

Mock reference: frame 6  
Live routes: `/auth/otp-entry`, `/auth/otp-error`  
Backend: `POST /api/patient/verify/confirm`, `POST /api/patient/verify/send` (resend)

Mock screenshot: `…/STEP_6_mock_otp.png`  
Live screenshots:  
- `…/STEP_6_live_otp.png`  
- `…/STEP_6_live_otp_error.png`

## Checklist
- [x] Back-nav on entry
- [x] Title “Enter the code”
- [x] Confirm control present
- [x] OTP error screen still present after restyle
- [x] Error copy `that code's wrong or expired`
- [x] Resend control (`otp-error-resend`) present

**Verdict: MATCH**
