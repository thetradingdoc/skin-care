# DEC — Skiñcare brand supersedes Touche UI lock

**Status:** Locked  
**Date:** 2026-07-21  
**Scope:** Patient app UI brand (display name + ink/ground tokens)  
**Related:** [`PIH_V2_ADAPTATIONS.md`](./PIH_V2_ADAPTATIONS.md), [`GATE_P0.md`](../../../todos/pending/pih-v2-gates/GATE_P0.md), plan `pih_design_phased_plan_8a6995cc.plan.md`

---

## Context (original lock)

An early draft of the PIH design phased plan locked:

> **live touche + `#E31919`**, not Downloads skiñcare/wine — **do not reopen**

That meant: keep the then-live Touche consumer face (display name **touche**, brand-ink red `#E31919`) and **not** adopt the Downloads `skincare-final-design-v2` skiñcare / wine palette.

That draft lock was never written as a standalone DEC. It lived only in chat history, an intermediate plan edit, and early phase scaffolding — which is why reviewers could not treat brand as review-safe without reconstructing the flip.

---

## Supersession (current lock)

That lock was **explicitly reversed** by product instruction.

| Role | Value |
|------|--------|
| Display brand | **skiñcare** |
| Brand ink / tab bar | wine **`#3D000B`** |
| Page ground | **`#F3F1EF`** |
| Accent red (CTA / Be bold / commerce accents) | **`#E31919` / `#e31919`** — retained **only** where Downloads uses red for CTAs / Be bold, **not** as brand ink |

**Touche / brand-ink `#E31919` as the locked app UI brand is superseded.**  
UI must not present **touche** / **touche labs™** as the product name. Commerce hostnames (`trytouche.com`, ASC / Expo name `touche`, etc.) remain an ops/legal cutover list — not a reason to keep Touche as the in-app display brand.

---

## Source of the flip

1. **Explicit product instruction** in session (replace all touche with skiñcare; adopt Downloads wine/ground).
2. Reflected in the current plan file’s **“Brand decision (locked)”** section:

   - File: `~/.cursor/plans/pih_design_phased_plan_8a6995cc.plan.md`
   - Approx. lines **128–131**:

     > **Skiñcare / wine `#3D000B` / ground `#F3F1EF`** — replace touche / brand-ink `#E31919` in app UI. Accent red `#e31919` only where Downloads uses it for CTAs/Be bold.

3. Implemented under Phase 0 (`GATE_P0.md`) and summarized in `PIH_V2_ADAPTATIONS.md`.

This DEC is the **standalone** artifact for that supersession. Plan text and P0 output are corroborating evidence, not substitutes for this record.

---

## Authority

**This record supersedes** any earlier plan text, gate file, code comment, brand README, or verify checklist that still states **touche + `#E31919` as the locked consumer/app UI brand** (or “not Downloads skiñcare/wine — do not reopen”).

If such wording is found, treat it as **stale**, not authoritative. Prefer:

1. This DEC  
2. `PIH_V2_ADAPTATIONS.md` Brand table  
3. Current plan “Brand decision (locked)”  
4. Live tokens: `patient-app/constants/v4DesignTokens.ts` (wine / ground / CTA red)

Do **not** reopen the Touche brand-ink lock without a new product decision that explicitly supersedes this DEC.
