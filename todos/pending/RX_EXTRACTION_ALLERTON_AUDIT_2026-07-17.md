# Prescription extraction audit — Allerton Eye Care optical Rx

**Date:** 2026-07-17  
**Fixture:** Allerton Eye Care glasses Rx (project’s original real-world capture)  
**Image:** device photo used in session (PHI photo not committed; OCR transcript fixture redacted)

## PART A — Where data was lost

### A1. OCR / vision vs structuring

| Layer | Result for Allerton photo |
|---|---|
| **Image readability** | **PASS.** Local macOS Vision OCR (`VNRecognizeTextRequest`) on the exact photo transcribed clinic header, SPH/CYL/AXIS grid values (−0.25 / −0.75 / 145 / 045), “Rx for glasses only”, and “Rx expires 7/7/202†” (trailing `7` misread as `†`). |
| **GPT-4o vision (local)** | **Not re-run locally** — `OPENAI_API_KEY` absent from `middleware-platform/.env`. |
| **GPT-4o vision (prod, prior device run)** | **Partial proof PASS.** Confirm UI showed Drug = `for glasses only`, which can only come from OCR text containing `Rx for glasses only` → vision did read at least the remarks line on prod. |
| **Structuring (`structurePrescription`)** | **FAIL (primary loss).** Pre-fix regex treated `Rx for glasses only` as a medication name. SPH/CYL/AXIS/PD/clinic/expiry were never parsed. Expiry was hints-only. |

**Verdict:** Data was **not** primarily lost in vision/OCR. The document is readable. Loss was in the **structuring layer** (medication-shaped regex + 4-field schema), compounded by confirm UI only showing Drug / Strength / Prescriber / Expires.

OCR fixture used for regression: `middleware-platform/__tests__/fixtures/allerton-eye-rx.ocr.txt`  
Audit transcript copy: `/tmp/touche-rx-audit/allerton-macos-vision.txt`

**PD note:** Human-readable form has PD `70`; macOS OCR in this run did **not** emit `70` next to pupillary distance (grid noise). Strength summary therefore may omit PD until OCR improves or we add a vision structured prompt.

### A2. Manual entry field set (screen 2m)

`patient-app/app/capture/manual-entry.tsx` for **all** tags including `prescription`:

- Tag chip (skin / bill / prescription / mark / lab / other)
- Free-text **“what happened / what is it”** (`note`)
- **date** (YYYY-MM-DD)

It does **not** match the AI confirm schema (Drug / Strength / Prescriber / Expiry). There are **no** SPH / CYL / AXIS / PD fields.

Worse: before this fix, manual `note` was dropped for prescription — validator required `drug` and structurer defaulted to `unknown`, ignoring `note`. SPH/CYL/AXIS/PD had **nowhere to go** on manual entry either (only a blob note, and even that wasn’t persisted into Rx structured fields).

## PART B — Fixes shipped

1. **`prescription-ocr-parser.js`** — dedicated parser (optical vs medication), blocklist for remark “drugs”, expiry + clinic/prescriber extraction, OD/OS strength summary.
2. **`structurePrescription`** — uses parser; maps manual `note` → drug/note; stops greedy `Rx …` remark capture.
3. **Validator** — optional `note`, `rx_kind` (`medication` \| `optical` \| `unknown`).
4. **Confirm UI** — optical labels (Type / Rx OD-OS / Clinic / Notes).
5. **Tests** — `__tests__/prescription-ocr-allerton.test.js` (6 passing).

### Post-fix structure on Allerton OCR fixture

- drug: `Glasses prescription`
- strength: `OD -0.25/-0.75x145; OS -0.25/-0.75x045`
- prescriber: `ALLERTON EYE CARE`
- expiry: `2027-07-07`
- note: remarks
- rx_kind: `optical`

## Still open (larger product fix)

- First-class optical schema (OD/OS objects, PD) instead of packing into `strength`
- Structured GPT prompt for Rx (JSON fields) vs plain OCR text
- Manual entry: tag-specific fields for prescription / optical
- Deploy middleware + rebuild app for device verify
- Re-run GPT-4o when `OPENAI_API_KEY` available to compare to macOS OCR transcript
