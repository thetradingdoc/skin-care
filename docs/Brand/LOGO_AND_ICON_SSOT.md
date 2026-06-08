# Logo, icon, and favicon — single source of truth

> **Last reviewed:** 2026-06-08

Skin & Care uses **two valid brand marks** depending on surface. Do not mix them.

| Mark | Surface | Doc section |
|------|---------|-------------|
| **Tulip wordmark** | Consumer marketing landing (`skin-care-landing`) | [Consumer wordmark](#consumer-wordmark-lockup) |
| **Panda mark** | Checkout, patient auth, provider shell, transactional email | [Panda mark](#panda-mark) |

---

## Consumer wordmark lockup

Live React wordmark: **skin** + **tulip** + **care** (lowercase, no ampersand in the logo).

| Property | Spec |
|----------|------|
| Text | `skin` + `care` (lowercase) |
| `skin` font | Be Vietnam Pro **Bold Italic** (700 italic) |
| `care` font | Be Vietnam Pro **Bold** (700 normal) |
| Mark color | `#000000` |
| Background | `#ffffff` (landing hero/header) |
| Tulip position | Centered in the gap between words, elevated above the baseline |
| Header height | 52px — `LogoWordmark height={52}` |
| Footer height | 28px — `LogoWordmark height={28}` |
| Accessible label | `aria-label="skin care"` |

### Layout (CSS)

Defined in `unified-dashboard/skin-care-landing/src/styles/landing.css`:

| Token | Value | Role |
|-------|-------|------|
| `--logo-height` | `52px` (inline from component) | Scales wordmark |
| `.sc-logo-wordmark` `gap` | `0.03em` | Space between skin / tulip / care |
| `.sc-logo-mark-slot` `width` | `0.62em` | Reserved horizontal slot |
| `.sc-logo-mark-slot` `margin-top` | `-0.48em` | Lifts tulip above baseline |
| `.sc-logo-mark` `width` | `0.9em` | Tulip render width |
| `.sc-logo-mark` `aspect-ratio` | `600 / 215` | Tulip proportions |

### Code integration

| Item | Path |
|------|------|
| Components | `unified-dashboard/skin-care-landing/src/components/DoveIcon.jsx` — `LogoWordmark`, `LogoMark`, `DoveIcon` |
| Header | `src/components/SiteHeader.jsx` |
| Footer | `src/components/Footer.jsx` |
| Styles + `@font-face` | `src/styles/landing.css` |

**Implementation notes:**

- Wordmark is **live text + inline SVG**, not a baked PNG.
- Tulip path is the `TULIP_PATH` constant in `DoveIcon.jsx` (must stay in sync with `tulip-mark.svg`).
- Hero headlines and body copy on the landing page still use **Gloock** via `--font-display`; only the header/footer logo uses Be Vietnam Pro.

---

## Tulip icon (SSOT)

Pixel-traced from the brand PSD. Solid **black fill** (not stroke).

| Asset | Path |
|-------|------|
| **SVG (canonical)** | `unified-dashboard/assets/brand/tulip-mark.svg` |
| PNG (raster export) | `unified-dashboard/assets/brand/tulip-mark.png` |

| SVG property | Value |
|--------------|-------|
| `viewBox` | `0 0 600 215` |
| Aspect ratio | **600∶215** (~2.79∶1) |
| Fill | `#000000` |

Standalone usage: `DoveIcon` default export (props: `width`, `height`, `className`).

---

## Logo fonts (consumer wordmark)

Hosted under `unified-dashboard/assets/brand/fonts/`:

| File | Weight / style | Used for |
|------|------------------|----------|
| `BeVietnamPro-BoldItalic.ttf` | 700 italic | `skin` |
| `BeVietnamPro-Bold.ttf` | 700 normal | `care` |
| `BeVietnamPro-Italic.ttf` | 400 italic | Loaded; not used in current wordmark |

`@font-face` declarations: `skin-care-landing/src/styles/landing.css` (bundled by Vite in production). Be Vietnam Pro is licensed under **SIL OFL 1.1** — see [`OFL-BeVietnamPro.txt`](../../unified-dashboard/assets/brand/fonts/OFL-BeVietnamPro.txt) and [BRAND_IP_AND_LICENSES.md](./BRAND_IP_AND_LICENSES.md). Skin & Care does **not** own the typeface; we bundle it for the wordmark only.

Upstream: [Be Vietnam Pro](https://github.com/bettergui/BeVietnamPro).

---

## Intellectual property

The **tulip mark**, **skin + tulip + care wordmark lockup**, and **landing favicon** are proprietary **Skin & Care** brand assets. Be Vietnam Pro is third-party font software under OFL.

Full ownership, trademark notice, font compliance, and design-archive lineage: [BRAND_IP_AND_LICENSES.md](./BRAND_IP_AND_LICENSES.md).

---

## Favicon (consumer landing)

Tulip on white rounded square. Replaces the deprecated bird-arc favicon.

| File | Path | Size |
|------|------|------|
| SVG (primary) | `skin-care-landing/public/favicon.svg` | 32×32 viewBox |
| PNG fallback | `skin-care-landing/public/favicon-32x32.png` | 32×32 |
| PNG (assets mirror) | `skin-care-landing/public/assets/images/favicon-32x32.png` | 32×32 |
| Apple touch | `skin-care-landing/public/apple-touch-icon.png` | 180×180 |
| Large PNG | `skin-care-landing/public/assets/images/favicon-180x180.png` | 180×180 |
| Shared SVG copy | `unified-dashboard/assets/images/favicon.svg` | synced with landing |

**Composition:** white `#ffffff` rounded rect (`rx=6`) + tulip path scaled with  
`translate(16 16.5) scale(0.074) translate(-300 -107)`.

**HTML references:** `skin-care-landing/index.html` (`/favicon.svg`, PNG fallbacks, `/assets/images/favicon.svg`).

PNG fallbacks are generated from `tulip-mark.png` composited on a white canvas.

---

## Panda mark

Used on **non-landing** consumer and provider surfaces.

| Asset | Path | Use |
|-------|------|-----|
| Panda SVG | `unified-dashboard/assets/images/logo-panda.svg` | Nav, auth, checkout, provider sidebar, email header |
| Brand copy (SSOT) | `unified-dashboard/assets/brand/logo-panda.svg` | Synced via `npm run brand:sync` |

Pair with **Skin & Care** in Gloock + DM Sans where space allows. See [SKIN_AND_CARE_GUIDELINES.md](./SKIN_AND_CARE_GUIDELINES.md).

### Panda favicons (checkout / provider / shared web)

```bash
npm run brand:favicons
npm run brand:sync
```

Source: `unified-dashboard/assets/brand/logo-panda.svg`.

Do **not** overwrite landing tulip favicons with panda output without updating this doc.

---

## Deprecated — do not use on landing

| Item | Reason |
|------|--------|
| `skin-care-landing/scripts/build-logo-wordmark.py` | Deprecated PNG compositor — see [BRAND_IP_AND_LICENSES.md](./BRAND_IP_AND_LICENSES.md) and `assets/brand/scripts/build-logo-wordmark-portable.py` |
| `logo-wordmark.png`, `logo-wordmark@2x.png` | Baked PNG compositor output |
| Old bird-arc `DoveIcon` stroke paths | Wrong mark shape |
| `dove-mark.png`, `logo-dove.svg` for header | Superseded by `tulip-mark.svg` |
| Crimson Pro for logo `skin` | Replaced by Be Vietnam Pro Bold Italic |
| Times New Roman for logo `skin` | Replaced by Be Vietnam Pro Bold Italic |

---

## Related docs

- [BRAND_IP_AND_LICENSES.md](./BRAND_IP_AND_LICENSES.md) — trademarks, OFL, build-script archive
- [SKIN_AND_CARE_GUIDELINES.md](./SKIN_AND_CARE_GUIDELINES.md) — palette, typography, tokens
- [README.md](./README.md) — brand doc index
- [Transactional email layout](../../middleware-platform/lib/skin-care-email-layout.js) — panda mark in email
