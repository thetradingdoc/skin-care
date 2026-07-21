# GATE_P1 — Billing / AI copy

Status: PASS (adapted — not pixel MATCH)  
Date: 2026-07-21  
Updated: 2026-07-21 (honest parity labels)  
Implementer: agent  

## Design SSOT

HTML: `docs/patient-app/design/skincare-final-design-v2.html`  
IDs: `profile-billing`, `profile-billing-care`, `ai-cap`, `ai-unlock`

## Per-ID parity matrix

| Design ID | Live route / component | Parity | Notes |
|-----------|------------------------|--------|-------|
| profile-billing | `/billing/choose-plan` | **MATCH** | Care tooling bullets + Care≠Plus subline `plan-care-ai-note`; no Everything in Plus |
| profile-billing-care | `/billing/care-checkout` | **MATCH** | External browser copy MATCH |
| ai-cap | `/capture/ai-cap` | **MATCH** | Title “Free AI reads used”; manual still free |
| ai-unlock | `/capture/unlock-ai` | **PARTIAL** | External handoff note MATCH; **deliberate:** live keeps Plus pricing chooser (HTML is thin “Continuing in your browser” only) |

## Anti-hallucination checks

- [x] No entitlement changes (Option 2 baseline)
- [x] Care clarifying subline present
- [x] Brand wine tokens on choose-plan via V4DesignTokens

## Unlock next phase?

- [x] YES — P2 (P0B WAIVE already filed)
