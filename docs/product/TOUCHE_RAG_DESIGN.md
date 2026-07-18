# Touche RAG design (forward-looking only)

**Status:** design sketch — **RAG-01 / RAG-02 / RAG-03**  
**Last updated:** 2026-07-17  
**Do not schedule build** until Sections 1–6 P0/P1 in [`../../todos/pending/TOUCHE_REMEDIATION_ARCHITECTURE_PLAN_2026-07-17.md`](../../todos/pending/TOUCHE_REMEDIATION_ARCHITECTURE_PLAN_2026-07-17.md) are done.

This document is **not** an implementation ticket. No Pinecone/index provisioning, no ingest job, no tool wiring in this horizon.

---

## RAG-01 — Namespace, schema sketch, non-goals

### Namespace

| Field | Value |
|-------|--------|
| Vector namespace | **`touche-derm-edu-v1`** |
| Rationale | Explicitly avoid prior Pinecone namespace collision class of incident; version suffix allows future wipe/replace |

### Placement

Sit **beside** `medical-tracker-rails`, never inside the capture persist path (`orchestrateCapture` → policy → `insertFact`). Retrieval is education/context for allowlisted tools only — not a write path into `patient_record_facts`.

### Index schema sketch (design)

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | Stable chunk id |
| `namespace` | const | `touche-derm-edu-v1` |
| `text` | string | Chunk body (policy-approved extract only) |
| `embedding` | vector | Model TBD at build time |
| `source_uri` | string | Provenance pointer (doc id / URL hash) |
| `source_kind` | enum | e.g. `derm_edu`, `product_label_public` — **not** raw PHI dumps |
| `license` / `retention_class` | string | For purge / ToS |
| `ingested_at` | ISO timestamp | |
| `policy_stamp` | string | Same discipline as imaging quote provenance |

Patient-specific corpora (if ever): same ownership + encryption posture as facts; **prefer non-PHI derm education corpus first**.

### Non-goals (this design)

- No diagnosis vocabulary in model **output** (retrieval for education ≠ clinical decision)
- No ingest of unverified OCR / raw capture blobs
- No coupling to capture meter or confirm UI
- No Cloud Run service split to “host RAG” (see [`MODULE_OWNERS.md`](./MODULE_OWNERS.md) ARCH-05)

---

## RAG-02 — Threat model vs medical-tracker policy / isolation

| Threat | Mitigation (design) |
|--------|---------------------|
| RAG used to bypass `policy.js` on persist | Tools never write facts; persist still goes through `assertOrchestrationPersistPolicy` |
| Kelly / coding graphs pull Touche corpus | Isolation: forbid imports; RAG tools only via `medical-tool-executor` allowlist |
| Namespace collision / wrong index | Hard-coded `touche-derm-edu-v1`; CI assert on config constant when built |
| PHI leakage into shared edu index | Default corpus = non-PHI; patient corpora require ownership checks identical to facts |
| Prompt injection via retrieved chunks | Allowlist tools; strip/refuse diagnosis-shaped **touche-generated** prose; document-sourced quotes remain labeled |
| Cost / data exfiltration via public retrieve | Auth + rate limits; no anonymous bulk retrieve of patient corpora |

Isolation script (`verify-medical-tracker-isolation.cjs`) remains the boundary for Kelly/perception/coding — RAG must not reopen that gate.

---

## RAG-03 — Build gate

**Do not schedule RAG build / index provisioning / tool PRs until:**

1. Section 1 security **P0 + P1** closed (or explicitly waived in writing)
2. Sections 2–6 brand/docs/legacy items that touch the same trees are not mid-flight blockers
3. This design doc is reviewed against live `policy.js` + isolation script

Until then: **design only; effort for build = 0**.

## Related

- Product SSOT: [`TOUCHE_AGENTIC_ARCHITECTURE.md`](./TOUCHE_AGENTIC_ARCHITECTURE.md)
- Rails policy: `middleware-platform/services/medical-tracker-rails/policy.js`
- Tool executor: `middleware-platform/services/medical-tracker-rails/medical-tool-executor.js`
