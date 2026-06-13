# Skin Age Journey — full implementation + E2E



**Last updated:** 2026-06-10  

**Workspace:** `skin-and-care`  

**Journey UX ref:** `skincare_app_full_journey.html` (7 screens)  

**Technical ref:** `myskinandcare_face_scan_plan.html`  

**Flow doc:** [`docs/user-journey/JOURNEY.md`](../../docs/user-journey/JOURNEY.md)



**Decision (2026-06-12):** Do **not** merge RAG into `concern-routines.json`. Funnel/template SSOT = [`middleware-platform/routines/concern-routines.json`](../../middleware-platform/routines/concern-routines.json) + [`concern-routine-service.js`](../../middleware-platform/services/concern-routine-service.js). Rich display SSOT = [`middleware-platform/data/routines/all_routines.json`](../../middleware-platform/data/routines/all_routines.json) + `GET /api/skinrag/routine/:concern` (`FEATURE_SKINRAG_ROUTINES=1`). Deprecate static file for **display** only after all 6 concerns proven in prod.



```mermaid

flowchart LR

  landing[Landing /]

  scan[/scan]

  quick[/quick-check]

  reveal[/reveal]

  concerns[/concerns]

  signup[/app/sign-in OTP]

  today[Today tab]

  progress[Progress tab]

  landing --> scan --> quick --> reveal --> concerns --> signup --> today --> progress

```



---



## Phase 0 — Unblock live journey (P0)



**Goal:** Scan → reveal → concerns → signup works on `www.myskinandcare.com`.



### Backend



- [x] **P0-B1** Verify/deploy CORS on `api.callsomo.com` for `myskinandcare.com` + `www` (`/api/public/face-read`, `/api/public/funnel/match`, `/api/patient/verify/*`). Extend `scripts/verify-consumer-hosting.cjs` live checks.

- [x] **P0-B2** Live smoke in deploy runbook: `npm run smoke:consumer-journey` + funnel match POST + OTP OPTIONS preflight.

- [x] **P0-B3** Document ephemeral image policy in `docs/runbooks/FACE_READ_INFERENCE.md`.



### Web UI/UX (screens 2–4)



- [x] **P0-U1** `ScanPage.jsx`: store `sc_onboarding_face_photo_url` after capture in `skinAgeStorage.js`.

- [x] **P0-U2** `RevealPage.jsx`: show user photo + age badge; placeholder only if URL missing.

- [x] **P0-U3** Hide zone cards when `zone_ages_estimated === true`; gate `enrichZoneAges` until Phase 2.

- [x] **P0-U4** Copy audit: disclaimers + fix “nothing saved” where image is transmitted.



### Data / consent



- [x] **P0-D1** Pre-scan consent screen; `sc_onboarding_consent` in sessionStorage.

- [x] **P0-D2** Privacy policy § face photos (transit, ephemeral, GCS after account).

- [x] **P0-D3** Sign-in privacy/terms line for signup intent.



---



## Phase 1 — Routines + scan→plan chain (P0)



### Backend — routine data



- [x] **P1-B1** Merge RAG content into `concern-routines.json` (6 concerns incl. `hyperpigmentation_dark_skin`).

- [x] **P1-B2** Fix `barrier_repair` `weeks_9_12` vs `total_weeks: 8`.

- [x] **P1-B3** Weekly normaliser in `concern-routine-service.js` → per-week array; expose on phase API + `GET /api/public/routines/:concern/week/:n`.

- [x] **P1-B4** Add `hyperpigmentation_dark_skin` to VALID_CONCERNS, ConcernsPage, funnel match.

- [x] **P1-B5** Extend `funnel-match-keywords.js` for dark-skin routing + “We spotted two things”.



### Backend — funnel persistence



- [x] **P1-B6** Anonymous `journey_id` + `funnel_journey_events`; server bridge at OTP.



### App UI/UX (screens 5–7)



- [x] **P1-U1** Concerns: “We spotted two things” + duration per concern.

- [x] **P1-U2** Preselect note from real multi-signal match.

- [x] **P1-U3** Today header: greeting + Day N · Week X of Y.

- [x] **P1-U4** Check-in hero card styling parity.

- [x] **P1-U5** Phase card: label, week range, progress bar, AM/PM steps.

- [x] **P1-U6** Photo history strip + “See all”.

- [x] **P1-U7** Post-signup first photo overlay verified.

- [x] **P1-U8** Progress metric cards polish.

- [x] **P1-U9** Progress photo timeline grid + tap navigation.

- [x] **P1-U10** AI insight block enrichment.

- [ ] **P1-U11** Landing hero copy (product decision — deferred).

- [ ] **P1-U12** Social proof row (product decision — deferred).



---



## Phase 2 — Real scan signals + compounding (P1)



### Backend



- [x] **P2-B1** GPT-4o Vision path: concern scores 0–3 + optional age; `model_id: gpt-4o-vision-v1` (`FACE_READ_VISION_ENABLED=1`).

- [x] **P2-B2** Remove fake `enrichZoneAges` when vision enabled (vision bypasses synthetic zones).

- [x] **P2-B3** Vision scores → `buildConcernSuggestions`.

- [x] **P2-B4** `skin_age_readings` table + migration `029_skin_age_journey.js`.

- [x] **P2-B5** Weekly re-score on 7th streak photo.



### UI/UX



- [x] **P2-U1** Reveal: real zone/concern chips from vision (when `zone_ages_estimated !== true`).

- [x] **P2-U2** Progress: skin age trend baseline → latest.

- [x] **P2-U3** Upload path: MediaPipe face check before `postFaceRead` (`faceDetectUpload.js`).

- [x] **P2-U4** Reveal v2: findings list, zone overlay, face age vs computed skin age delta (`computeSkinAge.js`).

- [x] **P2-U5** Scan gate reject UX: show `user_message`, stay on `/scan` (no navigate on reject).

- [x] **P2-U6** Reveal redesign: State A (score row, finding cards, zone dots) + State B (retry tips, no age when vision empty); dark-skin vision prompt (`poor_lighting` finding).

- [x] **P2-U7** Reveal spec parity: skin health score meters (Hydration/Clarity/Evenness/Barrier), zone labels/lines, real-age card, reveal-scoped CTAs, `health_scores` API + client fallback, `age_unreliable`.



---



## E2E test matrix



**Config:** `middleware-platform/playwright.skin-age-journey.config.cjs`  

**Spec:** `middleware-platform/e2e/skin-age-journey.spec.cjs`



| ID | Test | Scope |

|----|------|--------|

| E2E-01 | Landing CTA → `/scan` | Screen 1 |

| E2E-02 | Scan: oval + shutter disabled until aligned | Screen 2 |

| E2E-03 | Upload fixture → face-read → `/quick-check` | Screen 2→3 |

| E2E-04 | Quick-check: both questions required | Screen 3 |

| E2E-05 | Reveal: score row + findings with plain_language | Screen 4 |

| E2E-06 | Reveal: no legacy zone age row | Screen 4 |

| E2E-16 | Reveal State B: vision failed → retry tips, no age | Screen 4 |

| E2E-17 | poor_lighting finding → State A (not retry) | Screen 4 |

| E2E-07 | Concerns: preselect from richer face_read | Screen 5 |

| E2E-15 | Gate reject stays on scan with user_message | Screen 2 |

| E2E-08 | Concerns CTA → sign-in with funnel params | Screen 5→signup |

| E2E-09 | Sign-in OTP (test mode) | Signup |

| E2E-10 | Post-verify → Today with template | Screen 6 |

| E2E-11 | Today: streak, check-in, phase steps | Screen 6 |

| E2E-12 | Progress: baseline/goal skin age | Screen 7 |

| E2E-13 | Live smoke: CORS + face-read | Prod |

| E2E-14 | Consent gate blocks scan | P0-D1 |



### Supporting test infra



- [x] **E2E-T1** `npm run test:e2e-skin-age-journey` in `middleware-platform/package.json`.

- [x] **E2E-T2** Fixture JPEG in upload tests.

- [x] **E2E-T3** OTP test helper (sign-in page load + sessionStorage handoff).

- [x] **E2E-T4** Unit tests: weekly normaliser + funnel match vision mock + `face-read-vision.test.js` + `face-read-merge.test.js`.



---



## Success criteria



1. Live: landing → scan → quick-check → reveal (user face) → concerns → OTP → Today with week-1 routine.

2. No fake zone numbers without vision Phase 2.

3. Progress shows baseline skin age from funnel bridge.

4. E2E-01–E2E-10, E2E-14–E2E-17 green against consumer hosting bundle (E2E-11/12 patient-app covered by API/unit tests).

5. Consent captured before first photo analysis.

6. Reveal State B never shows misleading age when vision returns no findings; `poor_lighting` finding shows State A retry guidance instead of grey error box.


