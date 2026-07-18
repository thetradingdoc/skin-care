# AZ-01 — Azure media inventory (2026-07-18)

**Status:** **Prod inventory RAN** (GCS-synced Cloud Run SQLite). Result: **0** `azure://` / `blob.core.windows.net` cell hits.

## Prod run evidence

| Field | Value |
|-------|--------|
| When (UTC) | 2026-07-18 ~03:10Z |
| Cloud Run service | `somo-middleware` (us-central1) |
| `DB_PATH` env | `/var/data/middleware-prod.db` |
| `GCS_DB_BUCKET` | `somo-prod-db-somo-callsomo` |
| GCS object downloaded | `gs://somo-prod-db-somo-callsomo/middleware-staging.db` (**naming quirk** — object name is `middleware-staging.db` inside the **prod** bucket; no volume mount on service → sync object is the live SQLite source). Tracked separately as **OPS-DB-01** on [`REMEDIATION_OPEN_PUNCHLIST_2026-07-18.md`](./REMEDIATION_OPEN_PUNCHLIST_2026-07-18.md). |
| Local snapshot | `middleware-platform/tmp/middleware-prod-gcs-snapshot-20260718T0310Z.db` |
| Full-DB scan | [`AZ01_PROD_FULLSCAN_2026-07-18.json`](./AZ01_PROD_FULLSCAN_2026-07-18.json) — **314 tables, 0 azure-like hits** |
| Candidate-table script | `npm run inventory:azure-media` → `total_azure_like_rows: 0` |
| Facts spot-check | 5 `patient_record_facts` rows; all `storage_provider=gcs` / `gs://…` |

### Caveat (honest)

This SQLite is a **thin** consumer DB (5 facts, 0 customers/appointments in snapshot). It is still the DB Cloud Run is configured to sync for `somo-middleware` via `GCS_DB_BUCKET`. It is **not** a large Kelly/RCM corpus — if a second datastore ever holds media refs, that would need a separate inventory (none found configured as SQLite volume on this service).

## Code write sites still present (not DB rows)

Inventory `code_refs.count: 3` — constructors in:

- `services/gcs-billing-storage.js`
- `services/patient-record-dual-write.js`
- `services/patient-record-media.js` (legacy Azure fallback only after GCS)

These block **AZ-06** package delete until removed/guarded, even with 0 DB rows.

## Script

- `middleware-platform/scripts/inventory-azure-media-refs.cjs`
- `npm run inventory:azure-media` (requires `DB_PATH`)

## AZ-06 gate

| Gate | State |
|------|--------|
| Prod DB azure refs empty | **Met** (this run) |
| Code write sites gone / fail-closed | **Open** |
| Cloud Run `AZURE_*` bindings absent | **Verify before delete** |
| Drop `@azure/storage-blob` | **Blocked on code + env verify only** |

See punch list: [`REMEDIATION_OPEN_PUNCHLIST_2026-07-18.md`](./REMEDIATION_OPEN_PUNCHLIST_2026-07-18.md).
