# Web consumer smoke checklist

**Last reviewed:** 2026-06-12

Run against production: `https://myskinandcare.com` + `https://api.callsomo.com`.

| # | Step | Pass | Notes |
|---|------|------|-------|
| 1 | Landing `/` → `/scan` → `/reveal` → `/concerns` loads | [ ] | Vision + concern pre-select |
| 2 | `/app/sign-in?intent=signup&from=skin-age-landing` → OTP email arrives with wordmark | [ ] | Gmail/desktop |
| 3 | After OTP → Home (not journey-choose) with routine template | [ ] | `journey_modes: routine` set |
| 4 | Refresh `/app` while signed in → stays on Home (within session TTL) | [ ] | 60 min idle / 24h max |
| 5 | Home shows Morning + Evening routine groups | [ ] | Not flat PM-only list |
| 6 | Scan tab → barcode or manual add → Verdict screen | [ ] | BFI/conflicts when graph up |
| 7 | Track tab → spot capture → timeline entry | [ ] | |
| 8 | Progress tab → photo grid / BFI | [ ] | |
| 9 | Profile → goals, subscribe CTA, sign out | [ ] | |
| 10 | Legal URLs 200 | [ ] | `/patients/legal/privacy.html`, `terms.html` |

## Automated helpers

```bash
npm run build:consumer-hosting
node scripts/verify-consumer-hosting.cjs --live https://myskinandcare.com
cd middleware-platform && npm run test:e2e:redesign-parity
```

## Sign-off

All steps pass: [ ]
