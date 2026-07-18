# Radiology MRI PDF audit — 2026-07-17

**Fixture:** `Report_MR_RodriguezMedinaMoisesMaximiliano.pdf` (Spanish left-knee MRI)  
**Package also contained:** DICOM series under `IMAGENES/` + local viewers — **not ingested**

## Per-part status

| Part | Status | Notes |
|------|--------|--------|
| **A** PDF text-layer routing | **Built** | Usable layer → `pdf-text-layer`, unmetered. Empty/weak → `pdf-scan-vision` on embedded JPEGs (metered). Automatic. |
| **B** Imaging-report subtype | **Built** | `lab_kind: imaging_report`; Findings ≠ Conclusion; external images note. Confirm UI labels “from your document”. |
| **C** Diagnosis vocab provenance | **Built** | Document-sourced fields exempt; `ai_suggestion` + user skin notes still fail closed. Dual tests. |
| **D** DICOM out of scope | **Built** (doc + behavior) | `media_type` stays `photo\|pdf`. External QR/link → note only. Named in `TOUCHE_AGENTIC_ARCHITECTURE.md`. |
| **E** Spanish language | **Built** (gap fixed) | Stub previously returned `fr` (accent overlap). Spanish markers now checked before French → `es`. |
| **AV PDF FP** | **Built** (unblocking) | Real MRI PDF was `AV_HEURISTIC_BLOCKED` via MZ-in-embedded-JPEG; `%PDF-` now skips binary-entropy FPs (scripts still blocked). |

## Tests

`middleware-platform/__tests__/imaging-mri-es-report.test.js` — 11 passing  
AV PDF cases in `av-image-heuristic-false-positive.test.js`

## Deploy note

Middleware must be redeployed for PDF text-layer + policy + AV PDF fix. App rebuild needed for imaging confirm UI fields.
