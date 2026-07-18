# Visual observation pointer — Part B (2026-07-17)

Status: **built** (named-zone overlay UI + schema lock). Device confirm **blocked** — no physical iPhone attached.

## Shipped

| Layer | What |
|-------|------|
| Structure | `structureSkin` / `structureMark` emit `visual_pointer` (zones only; no findings on `ai_suggestion`) |
| Policy | `assertVisualPointerOnStructured` rejects `%` / score fields on persist |
| Client | `ObservationZoneOverlay` + face-landmark ellipses; caption `approximate region — AI suggests` |
| Confirm | Skin + mark show photo + overlay beside AI SUGGESTS |
| Mark-compare | Side-by-side photos with shared/entry `visual_pointer` via existing `compare_group_id` API |

## Explicitly not built

Percentage scores, composite health/age scores, heatmaps, model pixel bboxes.
