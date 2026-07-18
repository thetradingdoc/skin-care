# Field templates architecture — 2026-07-17

## Honest scope

**This pass (shipped):** template SSOT, classify→extract (heuristic), optical/medication/lab/imaging templates, confirm+manual wired for prescription/lab, denorm columns (075), Allerton + MRI regressions green.

**Still Phase 2 (not under-reported):**
- GPT classify when heuristics are ambiguous (hook only — `classifyTemplate` is heuristic-first)
- Skin / bill / mark / other confirm screens still mostly hardcoded (catalog stubs exist; UI not fully migrated)
- Client catalog is a **mirrored** TypeScript module (parity-tested), not a runtime import of middleware JS
- Backfill of `expiry_date`/`provider` for pre-075 rows happens on next confirm/update, not a bulk decrypt migration

## Template schema (actual structure)

```js
{
  id: 'prescription.optical',       // catalog id
  tag: 'prescription',
  subtype: 'optical',
  label: 'Optical / glasses prescription',
  fields: [
    { key: 'date', type: 'date', required: true, denorm: 'issue_date', label: 'Date' },
    { key: 'practice', type: 'string', denorm: 'provider', label: 'Practice / location' },
    { key: 'od_sph', type: 'diopter', unit: 'D', group: 'distance_od', label: 'Right (OD) SPH' },
    { key: 'od_cyl', type: 'diopter', unit: 'D', group: 'distance_od', ... },
    { key: 'od_axis', type: 'axis', unit: '°', ... },
    { key: 'os_sph'|'os_cyl'|'os_axis', ... },
    { key: 'multifocal', type: 'enum', enum: ['yes','no','unknown'] },
    { key: 'tint', type: 'enum', enum: ['yes','no','unknown'] },
    { key: 'pd', type: 'number', unit: 'mm' },
    { key: 'expiry', type: 'date', denorm: 'expiry_date' },
    { key: 'note', type: 'text' },
    { key: 'drug', type: 'string' },  // display title for shelf/reminders
  ]
}
```

Types coerced in `apply-template.js`: `diopter` / `axis` / `date` / `enum` / `number` / `boolean` / `string` / `text`.  
Missing optional fields → `fields_absent: ['pd', ...]` (never silent omit from template awareness).

SSOT path: `middleware-platform/services/record-field-templates/`  
Client mirror: `patient-app/lib/record-field-templates.ts`  
API: `GET /api/patient/records/field-templates`

## Denormalized (075) — why

| Column | Why |
|--------|-----|
| `fact_subtype` | Filter optical vs medication vs imaging without decrypt |
| `expiry_date` | Rx reminder jobs + Progress without JSON reach-in |
| `provider` | Sort/filter by clinic/prescriber |
| `issue_date` | Parallel to `entry_date` (from structured.date) |

Optical SPH/CYL/AXIS/PD stay in encrypted `structured_json` only.

Reminders: prefer `row.expiry_date`, fall back to JSON for pre-migration rows.  
Progress: `expiry` / `provider` / `subtype` from denorm when present.

## Classify → extract

`classifyTemplate(tag, ocrText)` → `prescription.optical` | `.medication` | `lab.imaging_report` | …  
then `extractFieldsForTemplate` → `applyTemplate`.

## Allerton regression

`record-field-templates.test.js` + `prescription-ocr-allerton.test.js` — **PASS** after refactor (optical OD/OS, expiry, fields_absent includes `pd`).
