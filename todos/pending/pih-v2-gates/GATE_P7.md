# GATE_P7 — Polish + full 49-ID matrix

Status: PASS (implementation stream complete; parity is adapted, not full MATCH)  
Date: 2026-07-21  
Updated: 2026-07-21 (honest 49-ID matrix — replaces blanket PASS rollup)  
Implementer: agent  

PIH overlay onto existing routes correctly produces **adapted** screens, not HTML clones.  
**PARTIAL** = deliberate / reasonable simplification unless noted as a known limit.

## Phase work

- [x] Calendar network-fail copy close MATCH (`calendar-load-failed`)
- [x] Meet Kelly additive (`/onboarding/meet-kelly`) — snapshot-coach safe body
- [x] Cause chips on Why (Dark marks) — optional subtype
- [x] Welcome claim-safe (no “clear in 12 weeks”)
- [x] Wine/skiñcare tokens from P0
- [ ] Design-parity Playwright expansion — residual (run when browsers reinstalled)
- [ ] Known limits remain open: console.warn audit; Pass-1 FP; Kelly live account proof; track-checkin backend; shelf-add catalog hit

## Full 49-ID rollup (authoritative)

Tally after 2026-07-21 corrections: **18 MATCH · 30 PARTIAL · 0 MISSING · 1 N/A**

| # | ID | Verdict | One-line reason |
|---|----|---------|-----------------|
| 1 | o1 | **MATCH** | Welcome skiñcare + claim-safe body (intentional vs HTML “clear in 12 weeks”) |
| 2 | o2 | **MATCH** | `/capture/consent` |
| 3 | o3 | **PARTIAL** | Cause chips on Why, not dedicated beat; cause not persisted — additive overlay |
| 4 | o4 | **MATCH** | `/onboarding/meet-kelly`, snapshot-coach-safe |
| 5 | o5 | **PARTIAL** | No dedicated “Begin your plan”; folded into Track/capture (PIH overlay) |
| 6 | o6 | **PARTIAL** | Location chips on skin confirm only; Region machine deferred |
| 7 | o7 | **MATCH** | plan-preview + claim-safe API |
| 8 | o8 | **PARTIAL** | Sign-in works; **human decision pending:** residual `trytouche.com` in legal/privacy URLs — do not auto-fix |
| 9 | o8b | **MATCH** | `/auth/otp-error` |
| 10 | o9 | **MATCH** | `/get-the-app` |
| 11 | progress | **PARTIAL** | Chrome present; Compare CTA green vs HTML wine; layout not pixel-cloned |
| 12 | progress-empty | **MATCH** | Copy MATCH |
| 13 | compare | **PARTIAL** | Existing mark-compare (overlay) |
| 14 | alerts | **PARTIAL** | Existing alerts feed |
| 15 | export | **PARTIAL** | Simplified card; PDF → share-with-doctor |
| 16 | export-gated | **MATCH** | ≥2 photos via marks-list `photo_count` sum |
| 17 | export-fail | **MATCH** | Copy + retry |
| 18 | calendar | **PARTIAL** | Existing calendar tab |
| 19 | calendar-month | **PARTIAL** | Month mode exists |
| 20 | calendar-day | **PARTIAL** | Day detail exists |
| 21 | calendar-networkfail | **PARTIAL** | Fail UI; body adapted vs HTML “Nothing's been lost” |
| 22 | shelf | **PARTIAL** | JOURNAL20 banner; not HTML pre-seed composition |
| 23 | shelf-empty | **PARTIAL** | Empty + CTA → add |
| 24 | shelf-add | **PARTIAL** | UI stub — search always → nomatch (catalog deferred) |
| 25 | shelf-nomatch | **MATCH** | Screen + CTAs |
| 26 | track-mark | **MATCH** | FAB → mark-picker |
| 27 | track-camera | **PARTIAL** | Existing capture |
| 28 | track-permdenied | **PARTIAL** | Existing camera-denied |
| 29 | track-guidance | **MATCH** | Dedicated + skip-once |
| 30 | track-loading | **PARTIAL** | Existing |
| 31 | track-visionfail | **PARTIAL** | Existing |
| 32 | track-confirm | **PARTIAL** | Location chips skin-only |
| 33 | track-discard | **PARTIAL** | Existing dialog |
| 34 | track-reveal | **PARTIAL** | Existing reveal/* |
| 35 | track-checkin | **PARTIAL** | UI + hub link; backend check-in may 404 (local ack) |
| 36 | profile | **PARTIAL** | Account + JOURNAL20; not pixel-matched |
| 37 | profile-protocol | **PARTIAL** | Claim-safe habits screen |
| 38 | profile-share | **PARTIAL** | Existing share route |
| 39 | profile-allergens | **PARTIAL** | Existing allergens |
| 40 | profile-notifications | **PARTIAL** | Prefs shared with allergens; deny → notif-denied |
| 41 | profile-notif-denied | **MATCH** | Wired from notifications when OS reports denied |
| 42 | profile-billing | **MATCH** | Care clarifying line (GATE_P1) |
| 43 | profile-billing-care | **MATCH** | External checkout note |
| 44 | profile-records | **PARTIAL** | Advanced hub |
| 45 | profile-delete | **MATCH** | Fixed purge path incl. `patient_record_facts` |
| 46 | profile-signout | **MATCH** | Dedicated sign-out |
| 47 | ai-cap | **MATCH** | Title parity |
| 48 | ai-unlock | **PARTIAL** | External note + retained pricing chooser |
| 49 | notif | **N/A** | System push UI — out of scope |

Per-phase detail: `GATE_P1.md` … `GATE_P6.md`.

## Flag for human (do not auto-fix)

- **o8 / legal URLs:** `sign-in.tsx` (and similar) still cite `app.trytouche.com` privacy/terms. Brand DEC supersedes Touche as **display** brand; whether legal hostnames must change is a product/legal call — leave until decided.

## Unlock

Plan complete for implementation stream. Residual punchlist: `KELLY_LIVE_ACCOUNT_PROOF`, Playwright reinstall, audit/Pass-1, track-checkin API, shelf catalog hit, trytouche legal URL decision.
