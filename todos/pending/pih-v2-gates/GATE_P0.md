# GATE_P0 — Brand + contract

Status: PASS  
Date: 2026-07-21  
Implementer: agent  
Reviewer: pending human spot-check screenshots

## Design SSOT

HTML: `docs/patient-app/design/skincare-final-design-v2.html`  
Adaptations: `docs/patient-app/design/PIH_V2_ADAPTATIONS.md`  
IDs in scope: foundation (no frame IDs required for PASS) — full 49-ID stub below

## Deliverables

- [x] HTML file present in `docs/patient-app/design/`
- [x] Adaptations doc lists claim-safe / locks / known limits
- [x] Tokens: wine `#3D000B`, ground `#F3F1EF`, accent `#E31919`
- [x] Welcome `WELCOME_BRAND = 'skiñcare'`; Account shop/powered-by; push title; tab bar wine
- [x] Ops hostname list (UI no longer says touche as product name):

| Touchpoint | Status |
|------------|--------|
| `trytouche.com` store origin | Keep until DNS/legal cutover |
| `app.trytouche.com` privacy/terms | Keep URLs; copy may still cite host |
| ASC / `expo` name `touche` | Ops follow-up — not changed this gate |
| Shopify collection path | Keep |

## Per-ID inventory stub (49) — status after P0

| Design ID | Status after P0 |
|-----------|-----------------|
| o1 | brand chrome updated (claim-safe body) — pending full MATCH P7 |
| o2–o9, o8b | pending |
| progress, progress-empty, compare, alerts | pending P2 |
| export, export-gated, export-fail | pending P3 |
| calendar, calendar-month, calendar-day, calendar-networkfail | pending P7 |
| shelf, shelf-empty, shelf-add, shelf-nomatch | pending P5 |
| track-* (10) | pending P4 |
| profile* (billing later P1; rest P6) | pending |
| ai-cap, ai-unlock | pending P1 |
| notif | N/A system UI |

## Anti-hallucination checks

- [x] No new user-facing screens outside phase scope
- [x] Brand skiñcare + wine on Welcome / tab / Account powered-by
- [x] Locks documented in adaptations

## Tests / evidence

- Updated `v4-design-tokens.test.ts`, `phase-e-public-legal-seo.test.ts` welcome brand assert

## Unlock next phase?

- [x] YES — Status PASS → unlock **P0b**
