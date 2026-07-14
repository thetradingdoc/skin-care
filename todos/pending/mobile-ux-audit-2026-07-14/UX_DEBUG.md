# UX_DEBUG

Generated: 2026-07-14 (Playwright Expo web @ 390×844, API stubs)  
Package: `todos/pending/mobile-ux-audit-2026-07-14/`

Diagnostic only — not a redesign.

## Severity table (current)

| Severity | Surface | Issue | Evidence |
| --- | --- | --- | --- |
| high | hosting/static | Bare `/app` paints **blank white**; `/app/index` → Expo **Unmatched Route** (path strips to `/index`). True index→`resolveInitialRoute` E2E blocked on consumer static hosting. | Initial blank 01–12; recapture notes in COVERAGE_GAPS |
| high | sign-in | **Back** opens marketing `myskinandcare.com/` instead of in-app prior / dismiss | `14-auth-signin-after-back.png`, BUTTON_INVENTORY fail |
| high | sign-in OTP | Top **Back** same — leaves app; does **not** return to email step | BUTTON_INVENTORY fail; use “Use a different email” works |
| medium | sign-in | Persistent **“Sign in required.”** toast/banner on clean Sign-in (auth gate residue / global toast) | `13-auth-signin-email.png` |
| medium | home | Greeting truncates email local-part (“Good morning, Invento…”) | `17-tab-home-populated.png` |
| medium | verdict | Primary destructive CTA **“Don't use it”** not found in inventory click (label/accessibility mismatch); Keep anyway works | BUTTON_INVENTORY |
| medium | routine-capture Cancel | Cancel landed on `/app/_journal` (legacy hidden tab) — odd back target | BUTTON_INVENTORY observedUrl |
| low | journal | `/journal/capture` **flag-off skip** — `JOURNAL_CAPTURE_ENABLED=false` | `33-feature-journal-capture-attempt.png` |
| low | home celebrate | `?celebrate=1` / `?photo=1` states captured; celebrate banner may be subtle vs expected hero | `18` / `19` |

## Confirmed working (sample)

- Send code → OTP; Use a different email → email step  
- Connection error banner + Retry (`04-cold-me-flaky-connection.png`)  
- Tabs Home/Track/Scan/Progress/Profile  
- Progress spot row → `/track/spot_neck_1`  
- Profile Edit skin profile, Change program, Sign out  
- Scan search by name / Add product  
- Compare CTA → `/compare`  
- Log progress photo → `/routine/capture`  
- Seeded P1–P7 destination UIs (journey-choose, pick, bio, empty Scan, Track, watch Home, routine Home)

## C/P matrix status

| ID | Outcome UI | Shot | Notes |
| --- | --- | --- | --- |
| C1 | Sign-in (no session) | `01-…` | OK |
| C2 | Home (session healthy) | `02-…` | Seeded destination (static index boot broken) |
| C3 | Sign-in after auth-dead clear | `03-…` | Same chrome as C1; no connection banner |
| C4 | `?error=connection` | `04-…` | Banner + Retry visible |
| C5 | Fail-safe Sign-in | `05-…` | Same as C1 |
| P1–P7 | See JOURNEYS embeds | `06`–`12` | Seeded to match `resolvePostAuthRoute` outcomes; unit tests remain SSOT for router math |

## Explicit follow-ups (COVERAGE_GAPS.md)

- Session idle / max-age **redirect timing** (Profile copy captured)  
- `patientapp://auth?ticket=…` handoff  
- SecureStore / true camera / native splash  
- Wire static `/app` SPA fallback so index cold-start is testable on web
