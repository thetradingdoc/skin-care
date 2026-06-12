# Skin & Care brand guidelines

> **Last reviewed:** 2026-06-09

Consumer-facing product name: **Skin & Care**. Use this guide for patient web, marketing landing, checkout, and shared consumer tokens.

## Logo

Two marks — see [LOGO_AND_ICON_SSOT.md](./LOGO_AND_ICON_SSOT.md) for full paths and implementation.

| Asset | Path | Use |
|-------|------|-----|
| **Consumer tulip wordmark (SSOT)** | [`logo-wordmark.css`](../../unified-dashboard/assets/css/logo-wordmark.css) + [`LogoWordmark`](../../unified-dashboard/skin-care-landing/src/components/DoveIcon.jsx) | **All** consumer and B2B headers — landing, funnel, sign-in, About, Contact, provider sidebar, auth pages, emails (via `email-wordmark.png`) |
| **Panda mark** | `unified-dashboard/assets/images/logo-panda.svg` | Checkout **chat assistant avatar only** — not header wordmark |
| **Brand copy (SSOT)** | `unified-dashboard/assets/brand/logo-panda.svg` | Synced to middleware `public/assets/brand/` via `npm run brand:sync` |

- **Wordmark typography:** both words at **weight 700** — `skin` = Be Vietnam Pro **Bold Italic**, `care` = **Bold** upright. Tulip sits **between** the words, elevated above the baseline.
- **SSOT CSS:** [`unified-dashboard/assets/css/logo-wordmark.css`](../../unified-dashboard/assets/css/logo-wordmark.css) — all consumer web surfaces must import it (or use components that do).
- **Landing / About / Contact / Sign-in** must match visually. Do not use baked `logo-wordmark.png` or the old PNG compositor script.
- **Headers everywhere:** use the **skin + tulip + care** wordmark — never plain "Skin & Care" or panda + text in nav/auth headers.
- **Checkout chat:** panda may appear as the **assistant avatar** only.
- **Landing hero copy** still uses Gloock (`--font-display`); logo text uses Be Vietnam Pro only.
- **Do not** use legacy Somo gecko PNGs or deprecated bird-arc / dove wordmark assets on the landing.

## Intellectual property

**Skin & Care owns** the tulip icon, the skin + tulip + care wordmark lockup, and the consumer landing favicon. These are proprietary brand marks — not licensed for third-party use without permission.

**Be Vietnam Pro** (wordmark typeface) is third-party font software under the [SIL Open Font License 1.1](https://openfontlicense.org). Skin & Care does not own or trademark the typeface. License text: [`assets/brand/fonts/OFL-BeVietnamPro.txt`](../../unified-dashboard/assets/brand/fonts/OFL-BeVietnamPro.txt).

**Trademark notice** (footers, app stores, legal pages):

> Skin & Care™, the Skin & Care tulip mark, and the skin + tulip + care wordmark are trademarks of Skin & Care. Unauthorized use is prohibited.

Full IP inventory, OFL checklist, and logo build-script archive: [BRAND_IP_AND_LICENSES.md](./BRAND_IP_AND_LICENSES.md).

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

## Consumer UI (patient app + landing funnel)

In-app and funnel surfaces use a **white** page shell (not cream) for uniformity with the web scan funnel.

| Token | Hex | Role |
|-------|-----|------|
| `pageBg` / funnel shell | `#ffffff` | Page background (patient app roots, funnel steps) |
| `fabBg` / consumer CTA | `#111111` | Primary buttons (Continue, Scan, Add product) |
| `card` | `#fffdf9` | Tab bar, cards, panels |

Rules:

- **Primary actions** in consumer flows: black `#111`, not billing blue `#314db6` (blue remains for links and provider portal).
- **Onboarding / funnel steps** (`/scan`, journey chooser, sign-in): no header wordmark — back link + content only.
- **Marketing home** (`/`): full wordmark header unchanged.

RN SSOT: `patient-app/constants/appTokens.ts`.

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
