> **SUPERSEDED** — see [`DEC_BRAND_SKINCARE_SUPERSEDES_TOUCHE.md`](../patient-app/design/DEC_BRAND_SKINCARE_SUPERSEDES_TOUCHE.md) for current brand.

# Wordmark by surface

> **Last reviewed:** 2026-07-14

Use this guide when adding a new page, email, or export. **Landing / marketing** still use the **skin + tulip + care** lockup (solid **#000000**). **Camera-first Check chrome** uses the compact orange **touche** mark — not the skin‧care lockup.

## Quick reference

| Surface | Implementation | Asset / code |
|---------|----------------|--------------|
| **SSOT (landing)** | Live HTML wordmark | [`logo-wordmark.css`](../../unified-dashboard/assets/css/logo-wordmark.css) + [`LogoWordmark`](../../unified-dashboard/skin-care-landing/src/components/DoveIcon.jsx) |
| Funnel, sign-in, about, contact, B2B auth, provider sidebar | Same lockup as landing | [`wordmark-snippet.html`](../../unified-dashboard/assets/brand/wordmark-snippet.html) or [`wordmark-html.js`](../../unified-dashboard/assets/js/wordmark-html.js) + `logo-wordmark.css` |
| Expo app — marketing / non-Check surfaces | skin‧care lockup where still used | [`BrandWordmark`](../../patient-app/components/BrandWordmark.web.tsx) / [`BrandWordmark.tsx`](../../patient-app/components/BrandWordmark.tsx) — imports [`tulip-path.js`](../../unified-dashboard/assets/brand/tulip-path.js) |
| **Expo Check / bottle / spot chrome** | Compact **touche** mark `#F7591F` | [`ToucheMarkCompact`](../../patient-app/components/ToucheMarkCompact.tsx) — **do not** use `BrandWordmark` here (TOUCH-009) |
| Transactional email (all templates) | Raster composite PNG (layout mirrors landing CSS) | [`email-wordmark.png`](../../unified-dashboard/assets/brand/email-wordmark.png) via [`skin-care-email-layout.js`](../../middleware-platform/lib/skin-care-email-layout.js) |
| Favicon (consumer) | Tulip on white | [`favicon.svg`](../../unified-dashboard/skin-care-landing/public/favicon.svg) |
| Checkout chat assistant avatar only | Panda illustration (not header wordmark) | [`logo-panda.svg`](../../unified-dashboard/assets/images/logo-panda.svg) |

## Do not use

| Asset / pattern | Why |
|-----------------|-----|
| `BrandWordmark` / skin‧care lockup on Check / spot chrome | Superseded by `ToucheMarkCompact` (camera-first) |
| `assets/images/logo-wordmark.png` | Deprecated compositor — **serif italic** `skin` + old dove, not Be Vietnam Pro + tulip |
| `build-logo-wordmark.py` / `build-logo-wordmark-portable.py` | Removed — use landing SSOT + `brand:email-wordmark` |
| `favicon.svg` upscaled as email logo | Wrong crop; blurry |
| `tulip-mark.png` alone at &lt;40px width in email | Tulip vanishes in Gmail — use full `email-wordmark.png` |
| Plain text "Skin & Care" or panda + text in headers | Not the consumer lockup |
| `SKIN_CARE_EMAIL_WORDMARK_MODE=html` | Removed — use `email-wordmark.png` only |

## Typography (consumer wordmark)

| Part | Font | Weight / style |
|------|------|----------------|
| `skin` | Be Vietnam Pro | 700 italic |
| `care` | Be Vietnam Pro | 700 upright |
| Tulip | SVG / PNG mark | Solid `#000000` fill |

Fonts: [`unified-dashboard/assets/brand/fonts/`](../../unified-dashboard/assets/brand/fonts/) (SIL OFL 1.1).

## Regenerate email wordmark

```bash
npm run brand:email-wordmark
```

Outputs:

- `unified-dashboard/assets/brand/email-wordmark.png` (1×)
- `unified-dashboard/assets/brand/email-wordmark@2x.png` (2×)

Script: [`build-email-wordmark.py`](../../unified-dashboard/assets/brand/scripts/build-email-wordmark.py)

After regenerating, redeploy:

1. Consumer hosting (so PNG is on `myskinandcare.com/assets/brand/`)
2. Middleware (email HTML references the URL)

## Email layout overrides

| Env var | Effect |
|---------|--------|
| `SKIN_CARE_EMAIL_LOGO_URL` | Replace wordmark with custom `<img>` (escape hatch only) |

## CI

`npm run check:brand` includes `check-brand-wordmark-assets.cjs` — fails if email layout regresses to deprecated PNGs or tiny tulip-only images.

## Related docs

- [LOGO_AND_ICON_SSOT.md](./LOGO_AND_ICON_SSOT.md)
- [SKIN_AND_CARE_GUIDELINES.md](./SKIN_AND_CARE_GUIDELINES.md)
- [BRAND_IP_AND_LICENSES.md](./BRAND_IP_AND_LICENSES.md)
