# JOURNEYS

Diagnostic walkthrough *(C/P matrices: seeded destination screenshots for each outcome; static `/app` index boot is blank/unmatched — see COVERAGE_GAPS.md)* of Expo web `/app` @ 390×844 with API stubs. Native TestFlight not covered.

## New user (web-first)

1. Landing / scan / reveal / concerns (web discovery shots if present on hosting dist)
![web-landing-home](screenshots/42-web-landing-home.png)

![web-landing-scan](screenshots/43-web-landing-scan.png)

![web-signin-signup-intent](screenshots/46-web-signin-signup-intent.png)

2. OTP signup intent → post-auth gates → Home/Scan (see post-auth matrix).

## Returning user

1. Cold `/app` → sign-in (C1) or direct post-auth (C2).
2. Daily loop: Home photo → Track → Scan verdict → Progress compare → Profile.
![tab-home-populated](screenshots/17-tab-home-populated.png)

![feature-routine-capture-writable](screenshots/29-feature-routine-capture-writable.png)

![tab-track-with-spot](screenshots/20-tab-track-with-spot.png)

![feature-verdict](screenshots/28-feature-verdict.png)

![tab-progress](screenshots/22-tab-progress.png)

![tab-profile-session-copy](screenshots/24-tab-profile-session-copy.png)


## Cold-start matrix (C1–C5)

### C1 — `cold-no-session-signin`

![cold-no-session-signin](screenshots/01-cold-no-session-signin.png)

### C2 — `cold-me-ok-postauth`

![cold-me-ok-postauth](screenshots/02-cold-me-ok-postauth.png)

### C3 — `cold-me-auth-dead-signin`

![cold-me-auth-dead-signin](screenshots/03-cold-me-auth-dead-signin.png)

### C4 — `cold-me-flaky-connection`

![cold-me-flaky-connection](screenshots/04-cold-me-flaky-connection.png)

### C5 — `cold-index-timeout-signin`

![cold-index-timeout-signin](screenshots/05-cold-index-timeout-signin.png)


## Post-auth matrix (P1–P7)

### P1 — `postauth-journey-choose`

![postauth-journey-choose](screenshots/06-postauth-journey-choose.png)

### P2 — `postauth-routine-pick`

![postauth-routine-pick](screenshots/07-postauth-routine-pick.png)

### P3 — `postauth-bio-calibration`

![postauth-bio-calibration](screenshots/08-postauth-bio-calibration.png)

### P4 — `postauth-empty-shelf-scan`

![postauth-empty-shelf-scan](screenshots/09-postauth-empty-shelf-scan.png)

### P5 — `postauth-spot-only-track`

![postauth-spot-only-track](screenshots/10-postauth-spot-only-track.png)

### P6 — `postauth-watch-only-home`

![postauth-watch-only-home](screenshots/11-postauth-watch-only-home.png)

### P7 — `postauth-setup-complete-home`

![postauth-setup-complete-home](screenshots/12-postauth-setup-complete-home.png)


## Journal capture

**Flag-off skip:** `JOURNAL_CAPTURE_ENABLED=false` in `patient-app/constants/feature-flags.ts`. Stubs cannot flip the Metro-bundled constant. Attempted navigation still captured:

![feature-journal-capture-attempt](screenshots/33-feature-journal-capture-attempt.png)

