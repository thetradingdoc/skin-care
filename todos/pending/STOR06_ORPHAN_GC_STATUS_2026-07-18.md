# STOR-06 — Blob orphan GC (Wave 5 status)

**Status:** **partial → improved** — reject-after-persist paths now call `deleteRecordMedia` (structure + policy). Pending purge already existed. AZ/GCS historical inventory still open.

## Mid-work gap (named 2026-07-18)

`persistRecordMedia` runs **before** structure validation and persist policy. Quality/OCR fails return earlier (no orphan), but **structure/policy failure left blobs**. Fixed in Wave 5: `deleteRecordMedia` on those two paths.

## Shipped

| Piece | Evidence |
|-------|----------|
| `deleteRecordMedia` | `patient-record-media.js` |
| Orchestrate delete on structure/policy fail | `capture-orchestration/index.js` |
| Tests | `__tests__/stor06-orphan-media-gc.test.js` |
| Pending expire purge | `purge-pending-captures.js` |

## Still open (do not round up)

| Gap | Notes |
|-----|-------|
| `skipPersist` after media write | May leave intentional draft media — product decision |
| Historical azure:// without facts | AZ-01 prod inventory |
| Cron sweep of unreferenced gs:// | Not built |

## Done when (full STOR-06)

All three residual rows closed + prod inventory empty of orphans.
