# Remediation punch list — still open / ops-owned (2026-07-18)

**Purpose:** Single tracked list of what remains after Waves 1–5. Not scattered across wave reports.  
**Parent plan:** [`TOUCHE_REMEDIATION_ARCHITECTURE_PLAN_2026-07-17.md`](./TOUCHE_REMEDIATION_ARCHITECTURE_PLAN_2026-07-17.md)

| ID | Item | Owner | Size | Status / proof gate |
|----|------|-------|------|---------------------|
| **APP-05R** | Maestro Cloud secrets + first green device nightly (`MAESTRO_CLOUD_API_KEY`, project id, app artifact; optional `TOUCHE_SMOKE_API_BASE`) | Eng ops (GitHub Actions / Maestro) | 0.5–1d once creds exist | Tracked: [`APP05R_MAESTRO_CLOUD_CREDENTIALS_2026-07-18.md`](./APP05R_MAESTRO_CLOUD_CREDENTIALS_2026-07-18.md). Scaffolding already green without secrets. |
| **AZ-01** | Production DB inventory for `azure://` / `blob.core.windows.net` | Eng (this session ran it) | Done for GCS-synced prod SQLite | **Ran 2026-07-18:** full scan **0** azure-like cell hits across **314** tables. Evidence: [`AZ01_PROD_FULLSCAN_2026-07-18.json`](./AZ01_PROD_FULLSCAN_2026-07-18.json), notes in [`AZ01_AZURE_MEDIA_INVENTORY_2026-07-18.md`](./AZ01_AZURE_MEDIA_INVENTORY_2026-07-18.md). Snapshot has 5 facts all `gs://` — thin consumer DB, not a large Kelly corpus. |
| **OPS-DB-01** | Prod GCS object still named `middleware-staging.db` inside **prod** bucket `somo-prod-db-somo-callsomo` while Cloud Run `DB_PATH=/var/data/middleware-prod.db` | Eng ops | 0.5d | **Named finding from AZ-01** — harmless today (sync works), same class as deploy-traffic naming/identity lies. Fix: rename GCS object → `middleware-prod.db`, set `GCS_DB_OBJECT` explicitly, update sync scripts/docs; never leave a staging name as the live prod identity. |
| **AZ-04** | Remove App Insights + Azure ACS email paths + secret bindings | Eng | 1–2d | **Unblocked on DB refs (0 azure rows)**; still code/deploy cleanup. Do not start until product confirms email path is SMTP-only in prod. |
| **AZ-05** | Archive Bicep / startup / dead Azure deploy docs; keep `guardrail-no-azure-deploy.cjs` | Eng | 0.5–1d | Open; safe after AZ-01 proof (done). |
| **AZ-06** | Drop `@azure/storage-blob` (and dead write helpers) | Eng | 0.5–1d | **Conditionally unblocked:** prod SQLite inventory empty. Still must remove/guard code write sites (3 remain — see inventory `code_refs`) and confirm no Azure env in Cloud Run before delete. |
| **AZ-03** | Rename/fold misnamed `gcs-billing-storage.js` into GCS-first media path | Eng | 1–2d | Partial (comment only). Not required for AZ-06 if callers migrate off Azure branch. |
| **BRAND-02** | Residual “Skin & Care” consumer/platform copy sweep | Eng / copy | See counts | **HTML+email: 148 matches** (109 HTML / 39 email). Repo total remaining **485** (excl. worktrees/archive/hosting-dist). Detail: [`BRAND02_RESIDUAL_COUNT_2026-07-18.json`](./BRAND02_RESIDUAL_COUNT_2026-07-18.json). HTML+email alone ≈ **1 eng-day**; full docs+platform code ≈ **1 week**. Consumer app/landing/waitlist already ~2. |
| **LEG-02** | Confirm unmounted route files; delete or mount-behind-auth | Eng | 1–2d | Partial — Redirect stubs kept (LEG-04); full delete pass open. |
| **STOR-06** | Residual orphan GC (`skipPersist` policy, historical gs:// sweep, cron) | Eng | 1–2d | Partial — structure/policy delete shipped; residuals in [`STOR06_ORPHAN_GC_STATUS_2026-07-18.md`](./STOR06_ORPHAN_GC_STATUS_2026-07-18.md). |
| **STOR-05** | KMS rotation **implement** (design done) | Eng / security | 3–5d | Design: `docs/security/FACTS_KMS_ROTATION_DESIGN.md`. |
| **ARCH-04** | Dual-write sunset **execution** (journal/spots → facts only) | Eng | 2–4 weeks calendar | Plan only: [`ARCH04_DUAL_WRITE_SUNSET_2026-07-18.md`](./ARCH04_DUAL_WRITE_SUNSET_2026-07-18.md). LEG-03 headers already on. |

## Explicitly closed (do not re-open without new evidence)

SEC-01…31 (as waved), SEC-12R, SEC-14R, APP-01…04, APP-06…08, APP-05 scaffolding (not device cloud), BRAND-01/03–06 (BRAND-02 residual above), AZ-02, ARCH-01/02/05, DOC-01…05, LEG-01/03/04, RAG-01…03 design-only, STOR-01…04.

## Next recommended order

1. **OPS-DB-01** — rename prod GCS object off `middleware-staging.db` (cheap identity fix; prevents future “which DB is live?” mistakes).  
2. **AZ-04 → AZ-05 → AZ-06** (DB inventory clear) — still verify Cloud Run has no `AZURE_*` bindings before SDK delete.  
3. **BRAND-02 HTML+email day** (148) if consumer polish is the priority.  
4. **APP-05R** whenever Maestro credentials are provisioned.  
5. **STOR-06 residuals / STOR-05 implement / ARCH-04 / LEG-02** as capacity allows.
