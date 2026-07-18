# BRAND-02 residual count (2026-07-18)

**Pattern:** `Skin & Care` (case-sensitive)  
**Scope:** repo excluding `node_modules`, `hosting-dist*`, `docs/archive`, `.pr-worktrees`, `.sandbox*`

Machine-readable: [`BRAND02_RESIDUAL_COUNT_2026-07-18.json`](./BRAND02_RESIDUAL_COUNT_2026-07-18.json)

## Headline numbers

| Bucket | Matches | Files |
|--------|---------|-------|
| **HTML** | **109** | 43 |
| **Email** (services + layout + related scripts/tests) | **39** | 8 |
| **HTML + email (trackable residual for copy sweep)** | **148** | — |
| Docs (`.md` / docs/) | 196 | 50 |
| Other JS/TS/code | 108 | 54 |
| Tests | 8 | 4 |
| Other | 25 | 13 |
| **Repo total remaining** | **485** | — |

Plan baseline mentioned ~**467** total — same order of magnitude; remaining total is **485** under this scan (docs/historical mentions can raise the count even as consumer surfaces clear).

## Closed this remediation (working-tree proof)

Uncommitted diff net for lines containing `Skin & Care`:

- Removed: **34**
- Added: **13**
- **Net closed: 21**

(Wave 5 also added Be Bold / Touche surfaces that do not use “Skin & Care”; those are BRAND-01, not BRAND-02 match reductions.)

## Effort read

| Scope | Matches left | Rough size |
|-------|--------------|------------|
| HTML + email only | **148** | **~1 eng-day** |
| + platform JS/TS (excl. docs) | ~256 | ~2–3d |
| Full remaining incl. docs | **485** | **~1 week** (much is historical/docs SSOT wording) |

Consumer app + landing + waitlist: only **~2** matches left under this scan.

## Email file breakdown

| File | Matches |
|------|---------|
| `middleware-platform/services/email-service.js` | 25 |
| `middleware-platform/__tests__/email-service-from.test.js` | 4 |
| `middleware-platform/services/trial-alerts.js` | 4 |
| `middleware-platform/services/voice-billing-alerts.js` | 2 |
| `middleware-platform/lib/skin-care-email-layout.js` | 1 |
| `middleware-platform/services/reminder-scheduler.js` | 1 |
| scripts (OTP / Cloud Run email) | 2 |

Tracked on punch list: [`REMEDIATION_OPEN_PUNCHLIST_2026-07-18.md`](./REMEDIATION_OPEN_PUNCHLIST_2026-07-18.md).
