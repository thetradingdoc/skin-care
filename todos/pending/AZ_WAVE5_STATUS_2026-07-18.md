# AZ-03 / AZ-04 / AZ-05 / AZ-06 — Wave 5 status (honest)

| ID | Status | Notes |
|----|--------|-------|
| **AZ-01** | **Partial** | Inventory **script** shipped (`inventory:azure-media`). **Prod DB run still required** before AZ-06 — see `AZ01_AZURE_MEDIA_INVENTORY_2026-07-18.md`. |
| **AZ-02** | **Done** | GCS-first in `patient-record-media.js` + `__tests__/az02-gcs-first-media.test.js`. |
| **AZ-03** | **Partial** | Documented misnomer on `gcs-billing-storage.js`; **not** renamed/folded yet (call sites still use it). |
| **AZ-04** | **Open** | App Insights + Azure ACS email + secret bindings **not removed** this wave (needs careful dead-path audit + deploy secret cleanup). |
| **AZ-05** | **Open** | Bicep / startup / Azure deploy docs **not archived** this wave. Guardrail `guardrail-no-azure-deploy.cjs` stays. |
| **AZ-06** | **Blocked** | Do **not** drop `@azure/storage-blob` until AZ-01 prod inventory is empty. |

Owner for AZ-01 prod run: ops (same class as APP-05R credentials).
