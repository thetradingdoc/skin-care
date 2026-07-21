# PIH v2 adaptations (locked)

**Design SSOT:** [`skincare-final-design-v2.html`](./skincare-final-design-v2.html)  
**Plan:** Skiñcare PIH phased implementation with phase gates.

## Brand

| Token | Value |
|-------|--------|
| Display brand | skiñcare |
| Wine (ink / tab bar) | `#3D000B` |
| Ground (page) | `#F3F1EF` |
| Accent red (CTA / Be bold) | `#E31919` |

UI strings that said `touche` / `touche labs™` are replaced with **skiñcare**. Commerce hostnames (`trytouche.com`, ASC id) remain ops/legal cutover — listed in GATE_P0; UI must not present “touche” as the product name.

## Claim-safe

- Do **not** ship HTML Welcome/o7 wording that promises an AI-guided program will **clear** dark marks in 12 weeks.
- Keep Why → plan-preview spine; Cause (`o3`) and Meet Kelly (`o4`) are **additive** only.
- Protocol / plan cards = habit checklists only — no efficacy timelines.

## Monetization

- **Care ≠ Plus AI (Option 2 DONE):** Care is tooling only; meter still `tier === 'plus'`. Choose Plan must include clarifying subline (HTML `profile-billing`).
- **JOURNAL20 / 20%** — sole app-member discount code.
- Free = unlimited manual tracking; AI metered separately.

## Kelly

- Framing: **`snapshot_coach`** — no memory of prior conversations ([`progress-kelly-framing-note.js`](../../../middleware-platform/services/progress-kelly-framing-note.js)).
- `client_action`: `render` | `render_fallback` | `suppress`; `nothing_new` → hide module.
- Mark-switch race: paint only when `payloadMarkId === selectedMarkId`.
- Progress “restyle” is visual-only — do not rebuild stack logic away from this contract.

## Region

- `CAP-REGION-01` deferred. Location chips on confirm / mark flow only — no capture Region machine.

## Keep (not in lean HTML mock)

- 6-tag medical capture, thesis, OPQRST, routine nudge.

## Known limits (punchlist — never silent-close)

- Some Kelly paths still `console.warn`-only (no durable prod audit trail).
- Pass-1 guardrail false-positive over-block of safe copy not systematically tested live.

## System N/A

- `notif` (push system UI) — not an in-app route.
