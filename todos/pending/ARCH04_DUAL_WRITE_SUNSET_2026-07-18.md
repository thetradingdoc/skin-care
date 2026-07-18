# ARCH-04 — Dual-write sunset plan (journal / spots → facts only)

**Status:** plan only — **do not delete** spots/journal APIs yet.  
**Depends on:** LEG-03 deprecation headers (shipped Wave 5); LEG-01 orphan journal UI deleted.

## Current state

| Path | Behavior |
|------|----------|
| `patient-record-dual-write.js` | Writes facts + legacy journal/spots rows |
| `routes/patient-journal.js` | Still mounted; dual-write on some paths |
| `routes/patient-spots.js` | Soft-deprecated (LEG-03 `Deprecation` / `Sunset` headers) |
| Progress / Calendar / Track | Facts SSOT (`patient_record_facts`) |

## Sunset sequence (do not reorder)

1. **Metrics** — confirm dual-write volume trending down; spots write count via LEG-03 metric.
2. **Client** — already non-writing for spots (Wave/Phase D); keep Redirect stubs (LEG-04).
3. **Read cutover** — ensure no remaining client reads spots/journal summary for Progress (already gated by tests).
4. **Stop dual-write** — feature flag `DUAL_WRITE_LEGACY=0` default off in prod after 14 days green metrics.
5. **Migrate residual** — one-shot script: spots/journal rows without facts counterparts → facts (or abandon with audit).
6. **Unmount** — remove spots/journal write routes; keep read-only archive endpoint if needed for support.
7. **Delete tables** — only after AZ-style inventory proves zero hot reads (separate change).

## Non-goals

- No big-bang table drop in this horizon.
- No Cloud Run split (ARCH-05).

## Effort

~2–4 weeks calendar after Wave 5 close; not started as code in Wave 5 beyond this plan + LEG-03.
