# Skin body-region generalization — follow-on (a) — 2026-07-17

**Status:** Named P1 follow-on after Part B **(c)** (face-requirement removed).  
**Owner:** Medical-tracker capture / vision (same lane as Templates-B + GPT-classify trigger).  
**Not deferred indefinitely** — same discipline as pipeline Step 11 (GPT-classify revisit trigger) and PDF page-raster OCR audit.

## Shipped already (c) — do not re-litigate

- Hard face reject removed (`not_a_face` / `wrong_subject` neutralized).
- Legitimate rejects kept: `too_blurry` | `too_dark` | `not_skin`.
- `observed_region` free-text → `body_area`; face `zones` only when face present.
- Overlay: face ellipses only when zones ∩ face layout; else center marker + labels.
- Self-referential commentary banned as a **category** (AI + static copy).

## Goal of (a)

Make `skin` a true any-body-region log: vision schema, Area UX, and overlay geometry that do not assume facial anatomy.

## Work items

### A1 — Vision prompt + schema (no face-assumed anatomy)

- [ ] Rewrite wellness vision prompt so default output does not reference face parts unless a face is present.
- [ ] Split or parameterize “daily face check-in” vs “medical-tracker skin log” if face habit loop still needs face-specific scores (`dark_circles`, apparent age).
- [ ] Keep `not_diagnosis` + equity confidence floor **without** narrating limitations.

### A2 — Body-region Area model

- [ ] Choose one SSOT:
  - **Enum + free-text other:** e.g. `face | scalp | neck | chest | back | abdomen | arm | hand | leg | foot | other` + `area_detail` free text, **or**
  - **Free-text only** with soft suggestions (no silent facial default).
- [ ] Confirm UI: never blank-default to a facial zone for body photos; never invent `forehead` etc. from empty vision zones.
- [ ] Wire confirm `body_area` + absent-field affordance to the chosen model.

### A3 — Overlay / pointer for non-face

- [ ] Extend visual pointer beyond face-landmark ellipses (coarse body-region anchors or label-only).
- [ ] Keep schema lock: no `%` / moisture scores on pointer.
- [ ] Mark compare stays discrete-spot UX; do not overload with diffuse patches.

### A4 — Tests + device gate

- [ ] Fixture set: leg / shoulder / neck / arm / torso → draft + non-face overlay path.
- [ ] Face photo still gets face zones when present.
- [ ] Regression: `too_blurry` / `not_skin` still 422.
- [ ] Device: iPhone X Release re-verify after middleware deploy + serving digest MATCH.

## Priority

| Item | Priority | Depends on |
|------|----------|------------|
| A1 prompt/schema | **P1** | (c) shipped |
| A2 Area model | **P1** | A1 |
| A3 overlay geometry | **P1** | A2 |
| A4 device gate | **P0 gate** | A1–A3 + deploy |

## Out of scope for (a)

- New sixth-tag subtype for “body patch” (keep `skin` + `mark` split).
- Inventing percentage health overlays.
- DICOM / radiology (separate track).

## Exit criteria

1. Body photos never receive face-mesh overlay or face-default Area.
2. Vision prose never assumes “cheeks / T-zone / under-eye” for non-face subjects.
3. Named tests + one device pass logged under `touche-prod-gate` evidence.
