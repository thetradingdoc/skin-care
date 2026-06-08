# Skin & Care brand guidelines

> **Last reviewed:** 2026-06-08

Consumer-facing product name: **Skin & Care**. Use this guide for patient web, marketing landing, checkout, and shared consumer tokens.

## Logo

Two marks — see [LOGO_AND_ICON_SSOT.md](./LOGO_AND_ICON_SSOT.md) for full paths and implementation.

| Asset | Path | Use |
|-------|------|-----|
| **Consumer landing wordmark** | `unified-dashboard/assets/brand/tulip-mark.svg` + `LogoWordmark` in `skin-care-landing` | Marketing landing header/footer: **skin** + tulip + **care** (Be Vietnam Pro) |
| **Panda mark** | `unified-dashboard/assets/images/logo-panda.svg` | Nav, auth, checkout, provider sidebar icon, email header |
| **Brand copy (SSOT)** | `unified-dashboard/assets/brand/logo-panda.svg` | Synced to middleware `public/assets/brand/` via `npm run brand:sync` |

- **Landing:** live text wordmark (`skin` bold-italic + tulip + `care` bold). Do not use baked `logo-wordmark.png` or the old PNG compositor script.
- **Checkout / provider:** prefer **SVG** panda (`logo-panda.svg`); pair with **Skin & Care** in Gloock + DM Sans when space allows.
- **Landing hero copy** still uses Gloock (`--font-display`); logo text uses Be Vietnam Pro only.
- **Do not** use legacy Somo gecko PNGs or deprecated bird-arc / dove wordmark assets on the landing.

## Color palette (consumer journal)

Matches `patient-app/constants/journalTokens.ts` and `unified-dashboard/assets/css/skin-care-tokens.css`.

| Token | Hex | Role |
|-------|-----|------|
| `--sc-cream` / `--brand-cream` | `#f8f3ea` | Page background |
| `--sc-card` | `#fffdf9` | Cards, panels |
| `--sc-ink` / `--brand-black` | `#1f2937` | Primary text |
| `--sc-muted` / `--brand-gray` | `#6b7280` | Secondary text |
| `--sc-line` / `--brand-border` | `#e9e2d6` | Borders, dividers |
| `--sc-brand-blue` / `--brand-accent` / `--primary` | `#314db6` | Primary CTA, links |
| `--brand-accent-hover` / `--primary-hover` | `#283fa0` | Hover states |
| `--sc-accent` | `#57bfd4` | Secondary accent |
| `--sc-terracotta` | `#c16e52` | Warm highlight |
| `--sc-success` | `#4f8a5b` | Success states |

## Typography

| Role | Font | CSS variable |
|------|------|--------------|
| UI / body | DM Sans | `--font-ui` |
| Display / headlines | Gloock | `--font-display` |
| Landing logo wordmark | Be Vietnam Pro (Bold Italic + Bold) | `@font-face` in `skin-care-landing/src/styles/landing.css` |

Load Gloock and DM Sans via Google Fonts or existing patient/checkout `<link>` tags. Logo fonts are self-hosted under `assets/brand/fonts/` — see [LOGO_AND_ICON_SSOT.md](./LOGO_AND_ICON_SSOT.md).

## Design tokens file

Import **`skin-care-tokens.css`** on consumer and provider shell pages that need shared `--brand-*`, `--primary`, shadows, and checkout step tokens.

Provider portal layout styles live in `provider-portal.css` (imports `skin-care-tokens.css`).

## Favicons

| Surface | Source | Paths |
|---------|--------|-------|
| **Consumer landing** | Tulip mark | `skin-care-landing/public/favicon.svg`, `favicon-32x32.png`, `apple-touch-icon.png` — see [LOGO_AND_ICON_SSOT.md](./LOGO_AND_ICON_SSOT.md) |
| **Checkout / provider / shared web** | Panda mark | Regenerate with `npm run brand:favicons` then `npm run brand:sync` from `assets/brand/logo-panda.svg` |

Do not overwrite landing tulip favicons when running panda favicon scripts.

## Related docs

- [LOGO_AND_ICON_SSOT.md](./LOGO_AND_ICON_SSOT.md)
- [SKIN_AND_CARE_REPO.md](./SKIN_AND_CARE_REPO.md)
- [Transactional email layout](../../middleware-platform/lib/skin-care-email-layout.js)
