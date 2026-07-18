# HIPAA — consumer app scope (medical tracker)

**Last updated:** 2026-07-16 (P8.04 — multi-record medical tracker rebuild)

Not legal advice. For BAA checklist and blob retention see [`../compliance/README.md`](../compliance/README.md).

## Product positioning

Touche consumer is a **personal medical record tracker** (wellness + self-reported health documents), **not** clinical diagnosis. Capture tags: `skin` | `bill` | `prescription` | `mark` | `lab` | `other`. App Store copy: [`../runbooks/APP_STORE_SUBMISSION.md`](../runbooks/APP_STORE_SUBMISSION.md).

## Architecture reflected here (post Phases 0–7)

| Surface | Treatment |
|---------|-----------|
| **Facts store** | `patient_record_facts` — tagged structured JSON, optional media refs, optional `raw_extract_text` |
| **Tag enum** | Six canonical tags only (same on Tag UI, confirm, calendar legend, orchestration) |
| **Pre-auth binding** | Anonymous `pending_captures` + `capture_token` claimed on OTP verify (P2.20–27) |
| **Metering** | AI reads metered (`ai_capture_usage`); manual path free; burst 10/24h + monthly free tier |
| **Physician export** | Retrieval-only pack / share link — **no AI narrative** |
| **Shelf Ask/Learn** | Labeled `ai_suggestion`, diagnosis vocabulary rejected |

## PHI in consumer flows

| Data | Treatment |
|------|-----------|
| Capture photos / PDFs | Stored under opaque media refs; signed URL TTL (P2.29); AV scan on upload (P8.02) |
| `raw_extract_text` | Retention-enforced purge after confirm window (P8.03) — structured facts retained |
| Email (OTP) | Auth only; never in audit event payloads |
| Routine / shelf / allergens | Per patient session; server events use ids not content |
| UI audit events | **No PHI** — paths and coarse enums only |

## First-party analytics

No Google Analytics / Segment on consumer surfaces. Audit data stays in our SQLite/Postgres (`funnel_*`, `patient_portal_events`).

## Retention

- Confirmed **structured facts**: retained for the account lifetime (until account delete).
- **Media + raw OCR text**: purged on schedule after confirm (default 90 days) — see `patient-record-retention` job (P8.03). This is enforced code, not policy-only language.
- Funnel journeys expire after 7 days (`expires_at` on create).

## Encryption at rest (named limitation)

Application-layer **AES-256-GCM** for structured fact fields / raw extract text (`patient-record-field-crypto.js`). **No customer-managed key rotation / KMS workflow yet** — rotating keys would require a migration tool that is not shipped. Public wording: Privacy Policy at `https://app.trytouche.com/privacy` and [`TOUCHE_AGENTIC_ARCHITECTURE.md`](../product/TOUCHE_AGENTIC_ARCHITECTURE.md).

## Vendors requiring BAA review

Cloud Run, Firebase Hosting, Stripe (payments / AI credits), email provider, Azure Blob / local media, LLM inference — maintain list in compliance doc; consumer events do not forward to third-party analytics.
