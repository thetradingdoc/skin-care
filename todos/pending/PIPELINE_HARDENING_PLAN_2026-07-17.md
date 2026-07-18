# Capture pipeline hardening plan — 2026-07-17 (updated, 15 steps)

See Cursor plan: `pipeline_hardening_audit_6bc4d9a6.plan.md`

## Locked product answers

- **Languages:** some (`en/es/fr/zh/ja/ko`), else kept as written — not all languages.
- **DICOM:** rejected permanently this pass; save the report PDF/photo.
- **Save without images:** yes; empty OCR fails closed.

## Fifteen steps (summary)

1. Policy on confirm + provenance + forged provenance adversarial test
2. Optical classify wipe + drug validator
3. Empty OCR fail closed
4. Denorm clear + dates + language + explicit encryption vs denorm decision
5. DICOM/video/zip + PDF magic + scoped AV PDF adversarial tests
6. Client catalog parity (fail on drift)
7. Reminder backfill (one-time migration, not “next confirm”)
8. Bill `amount_cents` template regression ($84.00)
9. Deploy + device MRI + Allerton
10. Phase Templates-B (~2.5–3.5d) for skin/bill/mark/other — P1, not timeboxed polish
11. Architecture: concrete GPT-classify revisit trigger (≥25 corrections / 30d or ≥5%)
12. **`ai_or_manual = automated_unmetered`** for PDF text-layer; audit cap proxies
13. **Multi-tag mixed provenance** — per-field scrub in one session
14. **Physician export** renders optical + imaging shapes (not medication-only)
15. **One-account E2E sequence** — optical → skin → bill → Spanish imaging PDF

## Related named follow-ons (not indefinite)

- **Skin body-region generalization (a):** [`SKIN_BODY_REGION_GENERALIZATION_PLAN_2026-07-17.md`](./SKIN_BODY_REGION_GENERALIZATION_PLAN_2026-07-17.md) — after Part B (c) face-requirement removal.
- **Cloud Run serving digest assert:** `touche-prod-gate-2026-07-17/FOLLOWUP_CLOUDRUN_SERVING_REVISION_ASSERT.md`
- **MRI / PDF page-raster OCR:** see `MRI_RADIOLOGY_PDF_AUDIT_2026-07-17.md` (page-raster when text layer empty remains a tracked vision path, not an unspoken later).
