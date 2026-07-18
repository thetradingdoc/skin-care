# Domain map — consumer vs shared API

**Status:** documentation only (BRAND-04) — **no DNS change** in this task.  
**Last updated:** 2026-07-17  
**Brand SSOT:** [`README.md`](./README.md)

Consumer face is **Touche**. Shared API and GCP identifiers may keep historical Skin & Care / Somo / Callsomo names.

## Consumer-facing hosts

| Host | Role | Notes |
|------|------|--------|
| `trytouche.com` | Marketing / Shopify storefront | Primary consumer marketing apex |
| `app.trytouche.com` | Expo web + legal (privacy/terms) | App host; CORS allowlisted |
| `myskinandcare.com` | Legacy marketing apex | 301 → trytouche / app legal (Firebase) |

## Shared / infrastructure hosts (not the consumer brand)

| Host | Role | Notes |
|------|------|--------|
| `api.callsomo.com` | Shared Cloud Run API | Primary prod API host today; infra brand ≠ consumer |
| `api.myskinandcare.com` | Alias to same middleware | Consumer-oriented DNS name; same `somo-middleware` service |
| `callsomo.com` | Provider / shared web shell | May still show Skin & Care UI |

## What this doc does not do

- Does **not** cut over DNS, TLS, or Firebase site bindings
- Does **not** rename Cloud Run `somo-middleware`, GCP project, or buckets
- Does **not** change App Store bundle ID (see [`BUNDLE_ID_DECISION.md`](./BUNDLE_ID_DECISION.md))

## Related

- [`SKIN_AND_CARE_REPO.md`](./SKIN_AND_CARE_REPO.md) — EAS / domain cutover notes
- [`../product/TOUCHE_AGENTIC_ARCHITECTURE.md`](../product/TOUCHE_AGENTIC_ARCHITECTURE.md) — product SSOT
