> **SUPERSEDED** — see [`DEC_BRAND_SKINCARE_SUPERSEDES_TOUCHE.md`](../patient-app/design/DEC_BRAND_SKINCARE_SUPERSEDES_TOUCHE.md) for current brand.

# Brand documentation index — Touche

> **Last reviewed:** 2026-07-17  
> **Superseded product naming:** docs that still say the consumer product is “Skin & Care” are **historical**. Locked consumer brand: **Touche** · **Be Bold** · **Skincare & medical journal** (tulip/rose motif).  
> **Product IA SSOT:** [`../product/TOUCHE_AGENTIC_ARCHITECTURE.md`](../product/TOUCHE_AGENTIC_ARCHITECTURE.md)

## Unified brand: Touche (consumer)

One user-facing **consumer** brand for the Expo app, marketing, and patient web: **Touche**. Hostnames like `callsomo.com`, `api.callsomo.com`, and GCP project `somo-*` are **infrastructure identifiers** — not the consumer face. Provider/Kelly/RCM surfaces may still show Skin & Care chrome until a separate provider brand pass.

**Capture chrome:** Compact orange **touche** (`ToucheMarkCompact`) — surface map [`WORDMARK_BY_SURFACE.md`](./WORDMARK_BY_SURFACE.md). Camera-first nav claims in [`TOUCHE_CAMERA_FIRST.md`](../product/TOUCHE_CAMERA_FIRST.md) are superseded.

| Doc | Purpose |
|-----|---------|
| [DOMAIN_MAP.md](./DOMAIN_MAP.md) | Consumer vs shared API hosts (no DNS change in this task) |
| [BUNDLE_ID_DECISION.md](./BUNDLE_ID_DECISION.md) | Keep `com.skinandcare.app` for App Store continuity |
| [POSITIONING.md](./POSITIONING.md) | **Historical** Skin & Care journal positioning — superseded for consumer lock |
| [SKIN_AND_CARE_GUIDELINES.md](./SKIN_AND_CARE_GUIDELINES.md) | Logo, palette, typography, tokens (paths still use Skin & Care filenames) |
| [SKIN_AND_CARE_REPO.md](./SKIN_AND_CARE_REPO.md) | Workspace, GitHub, EAS/TestFlight, DNS notes (**historical** product name in title) |
| [LOGO_AND_ICON_SSOT.md](./LOGO_AND_ICON_SSOT.md) | Tulip wordmark, compact touche mark, favicon, panda — paths and code SSOT |
| [WORDMARK_BY_SURFACE.md](./WORDMARK_BY_SURFACE.md) | Which mark per surface (landing vs capture chrome vs email) |
| [BRAND_IP_AND_LICENSES.md](./BRAND_IP_AND_LICENSES.md) | Trademarks, Be Vietnam Pro OFL, logo build-script archive |

**Product name (consumer):** Touche (not “Skin & Care”, not “MySkinAndCare”). App host `app.trytouche.com`. Marketing `trytouche.com`.

## Domains (user-facing vs infra)

| Role | User-facing | Infra ID (unchanged until migration) |
|------|-------------|--------------------------------------|
| Consumer marketing + funnel | `trytouche.com` (primary); `myskinandcare.com` redirects | Firebase `somo-4ddf6` / `myskinandcare` site |
| Consumer app | `app.trytouche.com` | Same hosting / Expo web |
| Provider portal + shared web shell | `callsomo.com` (may still show Skin & Care UI) | Same hosting project |
| Shared API | `api.callsomo.com` / `api.myskinandcare.com` | Cloud Run `somo-middleware` |

Detail: [`DOMAIN_MAP.md`](./DOMAIN_MAP.md).

**Shared API deploy:** [somo-platform](https://github.com/richiejeremiah/somo-platform) only — see [`../deployment/OPERATIONS.md#somo-cloud-run-deploy`](../deployment/OPERATIONS.md#somo-cloud-run-deploy).

## Design system

- **Tokens:** [`unified-dashboard/assets/css/skin-care-tokens.css`](../../unified-dashboard/assets/css/skin-care-tokens.css)
- **Consumer landing:** [`unified-dashboard/skin-care-landing/`](../../unified-dashboard/skin-care-landing/)
- **Landing wordmark + tulip:** [`unified-dashboard/assets/brand/tulip-mark.svg`](../../unified-dashboard/assets/brand/tulip-mark.svg) — [`LogoWordmark`](../../unified-dashboard/skin-care-landing/src/components/DoveIcon.jsx)
- **Landing favicon:** [`skin-care-landing/public/favicon.svg`](../../unified-dashboard/skin-care-landing/public/favicon.svg)
- **Panda mark (checkout / provider):** [`unified-dashboard/assets/images/logo-panda.svg`](../../unified-dashboard/assets/images/logo-panda.svg)
- **Email wordmark PNG:** [`unified-dashboard/assets/brand/email-wordmark.png`](../../unified-dashboard/assets/brand/email-wordmark.png) — `npm run brand:email-wordmark`
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
