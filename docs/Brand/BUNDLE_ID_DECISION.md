# Bundle ID decision — keep `com.skinandcare.app`

**Status:** locked recommendation (BRAND-05)  
**Date:** 2026-07-17  
**App Store display name:** **Touche**  
**Bundle ID:** `com.skinandcare.app`

## Recommendation

**Keep `com.skinandcare.app`.** Do not silent-change the iOS (or Android) application ID as part of the Touche brand cutover.

## Why

| Option | Effect |
|--------|--------|
| **Keep current ID** | Continuity for existing TestFlight / App Store listing, receipts, push, and deep-link associations |
| **New ID** | Treated by Apple as a **new app** — new listing, lost reviews/install base, dual submission ops |

Consumer brand (name, tagline, subtitle, icon/wordmark) is independent of the reverse-DNS identifier. Infra and store IDs may lag the consumer face.

## Explicit non-goals

- Do not rename EAS project slug `skin-care` via string replace (Expo support if ever migrating)
- Do not treat bundle ID as proof of product name in docs or CI
- Do not change ASC App ID / Team IDs in-repo without moving them to EAS secrets (SEC-34)

## Related

- [`README.md`](./README.md) — brand index
- [`../runbooks/TESTFLIGHT.md`](../runbooks/TESTFLIGHT.md) — TestFlight install (display name Touche; bundle unchanged)
