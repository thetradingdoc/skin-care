# Logo, icon, and favicon — single source of truth

> **Last reviewed:** 2026-07-14

The **landing page wordmark** (skin + tulip + care) remains the SSOT for **marketing / funnel / email** headers. **Check / capture chrome** uses a different mark: compact orange **touche** (`ToucheMarkCompact`, `#F7591F`) — see [WORDMARK_BY_SURFACE.md](./WORDMARK_BY_SURFACE.md). Product IA: [`docs/product/TOUCHE_AGENTIC_ARCHITECTURE.md`](../product/TOUCHE_AGENTIC_ARCHITECTURE.md).

| Mark | Surface | Doc section |
|------|---------|-------------|
| **Tulip wordmark** | Landing, funnel, sign-in, static pages, B2B auth, provider sidebar, all emails | [Consumer wordmark](#consumer-wordmark-lockup) |
| **touche compact** | Check + spot chrome (camera-first) | [Camera-first Check mark](#camera-first-check-mark) |
| **Panda mark** | Checkout chat assistant avatar only | [Panda mark](#panda-mark) |

---

## Camera-first Check mark

| Property | Spec |
|----------|------|
| Component | [`patient-app/components/ToucheMarkCompact.tsx`](../../patient-app/components/ToucheMarkCompact.tsx) |
| Text | `touche` (lowercase) + tulip path |
| Color | `#F7591F` |
| Surfaces (shipped) | Check, bottle, spot capture |
| Do not use | `BrandWordmark` / skin‧care lockup on these surfaces |

---

## Consumer wordmark lockup

Live React wordmark: **skin** + **tulip** + **care** (lowercase, no ampersand in the logo).

| Property | Spec |
|----------|------|
| Text | `skin` + `care` (lowercase) |
| `skin` font | Be Vietnam Pro **Bold Italic** — **font-weight 700** + italic |
| `care` font | Be Vietnam Pro **Bold** — **font-weight 700** upright |
| Both words | **700 weight** (skin is bold-italic, care is bold upright — never 400 on `skin`) |
| Mark color | `#000000` |
| Background | `#ffffff` (landing hero/header) |
| Tulip position | Centered in the gap between words, elevated above the baseline |
| Header height | 52px — `LogoWordmark height={52}` |
| Footer height | 28px — `LogoWordmark height={28}` |
| Accessible label | `aria-label="skin care"` |

### Layout (CSS)

**SSOT stylesheet:** [`unified-dashboard/assets/css/logo-wordmark.css`](../../unified-dashboard/assets/css/logo-wordmark.css) — import this file; do not duplicate wordmark rules.

| Token | Value | Role |
|-------|-------|------|
| `--logo-height` | `52px` (inline from component) | Scales wordmark |
| `.sc-logo-wordmark` `gap` | `0.03em` | Space between skin / tulip / care |
| `.sc-logo-mark-slot` `width` | `0.62em` | Reserved horizontal slot |
| `.sc-logo-mark-slot` `margin-top` | `-0.48em` | Lifts tulip above baseline |
| `.sc-logo-mark` `width` | `0.9em` | Tulip render width |
| `.sc-logo-mark` `aspect-ratio` | `600 / 215` | Tulip proportions |

### Code integration

| Surface | Implementation |
|---------|----------------|
| Landing + funnel header/footer | `DoveIcon.jsx` → `LogoWordmark` + `logo-wordmark.css` via `landing.css` |
| About / Contact static pages | Same HTML structure + `sc-static-pages.css` → `@import logo-wordmark.css` |
| Expo web sign-in | `patient-app/components/BrandWordmark.tsx` — web: same CSS classes; native: `expo-font` + em-slot layout |
| Consumer `/app` production | `app/index.html` links `/assets/css/logo-wordmark.css` |

| Item | Path |
|------|------|
| Shared CSS | `unified-dashboard/assets/css/logo-wordmark.css` |
| React (web landing) | `unified-dashboard/skin-care-landing/src/components/DoveIcon.jsx` |
| React (Expo web) | `patient-app/components/BrandWordmark.web.tsx` — plain HTML + `logo-wordmark.css` |
| React (Expo native) | `patient-app/components/BrandWordmark.tsx` — `expo-font` + em-slot layout |
| Tulip SVG | `unified-dashboard/assets/brand/tulip-mark.svg` |

**Implementation notes:**

- Wordmark is **live text + inline SVG** (or `img` of tulip on static HTML), not a baked PNG.
- Tulip path is exported from [`tulip-path.js`](../../unified-dashboard/assets/brand/tulip-path.js) (must stay in sync with `tulip-mark.svg`).
- Hero headlines and body copy on the landing page still use **Gloock** via `--font-display`; only the wordmark uses Be Vietnam Pro.

### Parity checklist (new consumer pages)

- [ ] Import `logo-wordmark.css` (or use `LogoWordmark` / `BrandWordmark` component)
- [ ] `skin` renders at **700 italic**; `care` at **700** upright
- [ ] Tulip in `.sc-logo-mark-slot` with **negative top margin** (elevated), not vertically centered in a flex row
- [ ] Header `--logo-height: 52px` unless footer context (`28px`)
- [ ] Do not use system UI fonts, `font-weight: 400` on `skin`, or duplicate `@font-face` without BoldItalic

### Anti-patterns

- Thin italic `skin` (400) — wrong on sign-in before parity fix
- Missing `BeVietnamPro-BoldItalic.ttf` `@font-face` — breaks About/Contact
- Copy-pasting wordmark CSS into new files instead of importing `logo-wordmark.css`
- Flexbox `align-items: center` on the wordmark row (flattens tulip elevation)

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

`@font-face` declarations: `unified-dashboard/assets/css/logo-wordmark.css` (imported by landing, static pages, and consumer `/app`). Be Vietnam Pro is licensed under **SIL OFL 1.1** — see [`OFL-BeVietnamPro.txt`](../../unified-dashboard/assets/brand/fonts/OFL-BeVietnamPro.txt) and [BRAND_IP_AND_LICENSES.md](./BRAND_IP_AND_LICENSES.md). Skin & Care does **not** own the typeface; we bundle it for the wordmark only.

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

## Transactional email wordmark

Consumer OTP and other Skin & Care emails use a **solid black raster composite** (not live HTML, not deprecated `logo-wordmark.png`).

| Asset | Path | Regenerate |
|-------|------|------------|
| Email wordmark 1× | `unified-dashboard/assets/brand/email-wordmark.png` | `npm run brand:email-wordmark` |
| Email wordmark 2× | `unified-dashboard/assets/brand/email-wordmark@2x.png` | same |

Script: [`build-email-wordmark.py`](../../unified-dashboard/assets/brand/scripts/build-email-wordmark.py). Layout: [`skin-care-email-layout.js`](../../middleware-platform/lib/skin-care-email-layout.js). See [WORDMARK_BY_SURFACE.md](./WORDMARK_BY_SURFACE.md).

---

## Panda mark

Used only as the **checkout chat assistant** illustration — not in headers or emails.

| Asset | Path | Use |
|-------|------|-----|
| Panda SVG | `unified-dashboard/assets/images/logo-panda.svg` | Checkout chat widget avatar |
| Brand copy (SSOT) | `unified-dashboard/assets/brand/logo-panda.svg` | Synced via `npm run brand:sync` |

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
| `build-logo-wordmark.py` / `build-logo-wordmark-portable.py` | **Removed** — use landing SSOT + `npm run brand:email-wordmark` |
| `logo-wordmark.png`, `logo-wordmark@2x.png` | **Removed** — deprecated serif + dove compositor |
| Old bird-arc `DoveIcon` stroke paths | Wrong mark shape |
| `dove-mark.png`, `logo-dove.svg` for header | Superseded by `tulip-mark.svg` |
| Crimson Pro for logo `skin` | Replaced by Be Vietnam Pro Bold Italic |
| Times New Roman for logo `skin` | Replaced by Be Vietnam Pro Bold Italic |

---

## Related docs

- [BRAND_IP_AND_LICENSES.md](./BRAND_IP_AND_LICENSES.md) — trademarks, OFL, build-script archive
- [SKIN_AND_CARE_GUIDELINES.md](./SKIN_AND_CARE_GUIDELINES.md) — palette, typography, tokens
- [README.md](./README.md) — brand doc index
- [WORDMARK_BY_SURFACE.md](./WORDMARK_BY_SURFACE.md) — which wordmark asset per surface (web vs email)
- [Transactional email layout](../../middleware-platform/lib/skin-care-email-layout.js) — `email-wordmark.png` (solid black composite)
