# HIPAA — consumer app scope

**Last updated:** 2026-06-12

Not legal advice. For BAA checklist and blob retention see [`../compliance/README.md`](../compliance/README.md).

## Product positioning

Skin & Care consumer is **wellness tracking**, not clinical diagnosis. App Store copy: [`../runbooks/APP_STORE_SUBMISSION.md`](../runbooks/APP_STORE_SUBMISSION.md).

## PHI in consumer flows

| Data | Treatment |
|------|-----------|
| Selfie / scan photos | Session storage until signup; server face-read returns estimates only |
| Email (OTP) | Auth only; never in audit event payloads |
| Routine / shelf / BFI | Stored per patient session; server events use ids not content |
| UI audit events | **No PHI** — paths and coarse enums only |

## First-party analytics

No Google Analytics / Segment on consumer surfaces. Audit data stays in our SQLite/Postgres (`funnel_*`, `patient_portal_events`).

## Retention

Align funnel event retention with [`../compliance/README.md`](../compliance/README.md) data retention policy. Funnel journeys expire after 7 days (`expires_at` on create).

## Vendors requiring BAA review

Cloud Run, Firebase Hosting, Stripe (payments), email provider, Azure Blob (uploads), LLM inference — maintain list in compliance doc; consumer events do not forward to third-party analytics.
