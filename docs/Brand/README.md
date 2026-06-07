# Brand documentation index

> **Last reviewed:** 2026-06-07

## Unified brand: Skin & Care

One user-facing brand for **consumer** (app, marketing, patient web) and **provider** (signup, portal, voice billing). Hostnames like `callsomo.com` and `api.callsomo.com` are **infrastructure identifiers only** until DNS cutover.

| Doc | Purpose |
|-----|---------|
| [SKIN_AND_CARE_GUIDELINES.md](./SKIN_AND_CARE_GUIDELINES.md) | Logo, journal palette, typography, tokens |
| [SKIN_AND_CARE_REPO.md](./SKIN_AND_CARE_REPO.md) | Workspace, GitHub, **myskinandcare.com**, EAS/TestFlight, DNS cutover |
| [LOGO_AND_ICON_SSOT.md](./LOGO_AND_ICON_SSOT.md) | Logo, icon, favicon paths |

**Product name:** Skin & Care (not "MySkinAndCare").

## Domains (user-facing vs infra)

| Role | User-facing | Infra ID (unchanged until migration) |
|------|-------------|--------------------------------------|
| Consumer marketing + funnel | `myskinandcare.com` (target) | Firebase `somo-4ddf6` |
| Provider portal + shared web shell | `callsomo.com` (Skin & Care UI) | Same hosting project |
| Shared API | `api.callsomo.com` | Cloud Run `somo-middleware` |

**Shared API deploy:** [somo-platform](https://github.com/richiejeremiah/somo-platform) only — see [`../deployment/OPERATIONS.md#somo-cloud-run-deploy`](../deployment/OPERATIONS.md#somo-cloud-run-deploy).

## Design system

- **Tokens:** [`unified-dashboard/assets/css/skin-care-tokens.css`](../../unified-dashboard/assets/css/skin-care-tokens.css)
- **Consumer landing:** [`unified-dashboard/skin-care-landing/`](../../unified-dashboard/skin-care-landing/)
- **Logo:** [`unified-dashboard/assets/images/logo-panda.svg`](../../unified-dashboard/assets/images/logo-panda.svg)
- **Email layout:** [`middleware-platform/lib/skin-care-email-layout.js`](../../middleware-platform/lib/skin-care-email-layout.js)

## Guardrails

- `npm run check:brand` — bans **Somo** in user-facing UI paths (`unified-dashboard`, `middleware-platform/public`, `patient-app`)
- `npm run check:legacy-hosts` — bans retired hosts; allows `myskinandcare.com` in config/docs
- `npm run check:brand-consumer-strings` — bans dodgecall/doclittle in services and routes
- `node scripts/check-brand-runtime-copy.cjs` — Kelly prompts and billing alert templates

## Related

- [docs/README.md](../README.md)
- [docs/meta/CANONICAL_DOC_MAP.md](../meta/CANONICAL_DOC_MAP.md)
- [QA_MATRIX.md](./QA_MATRIX.md)
