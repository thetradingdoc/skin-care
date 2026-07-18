# APP-02 — PDF text-layer provenance tradeoff (locked 2026-07-17/18)

## Decision

PDF **text-layer** extraction:

- **Never** calls `tryConsume` / meterGuard.
- **No** meter-then-refund path (`pdf_text_layer_unmetered` deleted).
- Persists `ai_or_manual: **manual**` (not `ai`, not a third enum).

Do **not** add `automated_unmetered` to the schema.

## Conscious tradeoff

Automated PDF text-layer extraction is **permanently indistinguishable from true manual entry** in:

- every `patient_record_facts.ai_or_manual` value
- every analytics / progress query that keys off `ai_or_manual`

There is **no** durable DB flag that means “a machine extracted this without billing AI.”

That is intentional: **honest metering + engineering simplicity** over complete extraction-source provenance on this one path.

## Where provenance still lives

| Signal | Meaning |
|--------|---------|
| `perceive_method === 'pdf-text-layer'` | Response / orchestration (not always a DB column) |
| `used_ai === false` + `metered === false` | Orchestration response |
| `field_provenance: document` | Parser-stamped fields where applicable |

If product later needs “automated but free” as a first-class analytics dimension, that is a **new enum migration** — out of scope for APP-02.
