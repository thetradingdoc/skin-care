# Skin & Care brand guidelines

> **Last reviewed:** 2026-06-06

Consumer-facing product name: **Skin & Care**. Use this guide for patient web, marketing landing, checkout, and shared consumer tokens.

## Logo

| Asset | Path | Use |
|-------|------|-----|
| **Panda mark** | `unified-dashboard/assets/images/logo-panda.svg` | Nav, auth, checkout, provider sidebar icon, email header |
| **Brand copy (SSOT)** | `unified-dashboard/assets/brand/logo-panda.svg` | Synced to middleware `public/assets/brand/` via `npm run brand:sync` |

- Prefer **SVG** (`logo-panda.svg`) in HTML; scale with CSS height/width.
- Pair the panda with the wordmark **Skin & Care** (Gloock for display, DM Sans for UI) when space allows.
- **Do not** use legacy Somo gecko PNGs or deprecated wordmark SVGs.

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
| Display / wordmark | Gloock | `--font-display` |

Load via Google Fonts or existing patient/checkout `<link>` tags.

## Design tokens file

Import **`skin-care-tokens.css`** on consumer and provider shell pages that need shared `--brand-*`, `--primary`, shadows, and checkout step tokens.

Provider portal layout styles live in `provider-portal.css` (imports `skin-care-tokens.css`).

## Favicons

Regenerate from the panda mark:

```bash
npm run brand:favicons
npm run brand:sync
```

Source: `unified-dashboard/assets/brand/logo-panda.svg`.

## Related docs

- [LOGO_AND_ICON_SSOT.md](./LOGO_AND_ICON_SSOT.md)
- [SKIN_AND_CARE_REPO.md](./SKIN_AND_CARE_REPO.md)
- [Transactional email layout](../../middleware-platform/lib/skin-care-email-layout.js)
