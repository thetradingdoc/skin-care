# GATE_P3 — Export

Status: PASS (adapted — not pixel MATCH)  
Date: 2026-07-21  
Updated: 2026-07-21 (honest parity; real `photo_count`)  
Implementer: agent  

## Per-ID parity matrix

| Design ID | Live route | Parity | Notes |
|-----------|------------|--------|-------|
| export | `/export` | **PARTIAL** | Report card + Generate PDF / Share link. **Deliberate:** simplified card (no Cause/day-pair detail); Generate PDF navigates to share-with-doctor |
| export-gated | `/export/gated` | **MATCH** | Copy MATCH; gate = **≥2 photos with media** via marks-list `photo_count` sum |
| export-fail | `/export/fail` | **MATCH** | Retry → export |

## Gate rule (authoritative)

- Product rule: **≥2 photos** (not the discarded “1 photo enough” open question).
- Implementation: `GET /api/patient/marks` returns per-mark `photo_count` (`1` if `media_url` present, else `0`). Export sums `photo_count`; redirects to gated when sum `< 2`.
- **Historical note:** before 2026-07-21 this used a mark-id proxy (`id ? 1`) because `photo_count` was missing — that is fixed.

## Unlock next phase?

- [x] YES → P4
