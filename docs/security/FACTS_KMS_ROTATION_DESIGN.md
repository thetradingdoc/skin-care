# Facts encryption — KMS / key rotation design

**Status:** STOR-05 design — **implement later**  
**Last updated:** 2026-07-17  
**Depends on:** STOR-01 / SEC-05 fail-closed encryption key (no `dev-billing-key` in prod)

Design only. Do not roll keys in production from this doc alone.

## Goals

- Rotate `patient_record_facts` field-crypto material without dual-plaintext windows
- Keep denorm queryables (`entry_date`, `fact_subtype`, …) as the deliberate plaintext exception already documented in product SSOT
- Support Cloud KMS (GCP) as source of truth for DEK/KEK; app holds short-lived unwrap only

## Current posture (as of Wave 5 docs)

| Piece | Today | Target |
|-------|--------|--------|
| App crypto | `patient-record-field-crypto.js` + env key | Fail-closed if unset in prod (SEC-05 / STOR-01) |
| KMS | Not wired for facts | GCP KMS CMEK or envelope encrypt |
| Rotation | Manual / none | Versioned key id stamped on ciphertext |

## Proposed envelope shape

1. **KEK** in GCP KMS (project `somo-callsomo` or dedicated; infra name OK).  
2. **DEK** per environment (or per epoch); wrapped by KEK; unwrapped into process memory on boot / refresh.  
3. Ciphertext metadata includes `key_version` (or `kid`) so decrypt can select historical DEKs during rotation.  
4. Encrypt-path uses **current** version only; decrypt-path accepts N prior versions until rewrap job finishes.

## Rotation sequence (implement later)

1. Create KMS key version N+1; mint new DEK; wrap and store alongside N.  
2. Deploy app that can decrypt N and N+1; encrypt with N+1.  
3. Background rewrap job: decrypt with N → encrypt with N+1 for rows still on N (batched; respect downtime).  
4. After metrics show zero N ciphertexts, disable decrypt for N (keep audit trail).  
5. Never delete KEK versions that still decrypt live rows.

## Explicit non-goals (this design pass)

- No big-bang re-encrypt of all facts in one deploy
- No Azure Key Vault path (GCS/GCP-first)
- No changing denorm plaintext policy in this task
- No scheduling the rewrap job until SEC-05 fail-closed is green in prod

## Threat notes

| Risk | Mitigation |
|------|------------|
| Old DEK left in env / Secret Manager forever | Version list + destroy after rewrap complete |
| Rewrap reads all PHI into worker | Same authz as facts repo; audit log; rate-limited batches |
| Mis-set kid → mass decrypt fail | Canary decrypt on boot; dual-read window |

## Related

- Product encryption notes: [`../product/TOUCHE_AGENTIC_ARCHITECTURE.md`](../product/TOUCHE_AGENTIC_ARCHITECTURE.md)
- Remediation Section 8: [`../../todos/pending/TOUCHE_REMEDIATION_ARCHITECTURE_PLAN_2026-07-17.md`](../../todos/pending/TOUCHE_REMEDIATION_ARCHITECTURE_PLAN_2026-07-17.md)
- Crypto service: `middleware-platform/services/patient-record-field-crypto.js`
