# Body-region skin vs face-only architecture (2026-07-17)

## PART A — Root cause (definitive)

### Live prod responses (anonymous `tag=skin`, `ai_or_manual=ai`)

Synthetic but clearly non-face body frames (lower leg / shoulder / neck JPEGs) against `api.callsomo.com`:

| Image | HTTP | `error_code` | Stage | `quality.quality_issues` | Message |
|-------|------|--------------|-------|--------------------------|---------|
| lower-leg | **422** | **`QUALITY_GATE_FAILED`** | **Vision/perceive** (after unmetered gate + meter) | **`['not_a_face']`** | Retake photo |
| shoulder | **422** | **`QUALITY_GATE_FAILED`** | same | **`['not_a_face']`** | Retake photo |
| neck | (same pattern expected — see probe log) | | | | |

Meter is refunded with reason `vision_quality_reject` (unit test confirms `insertFact` never called).

### Stage audit

| Stage | Face-only? | Evidence |
|-------|------------|----------|
| Unmetered quality gate (`quality-gate.js`) | **No** | Size/MIME/blur heuristics only; unit test: leg JPEG `ok: true` |
| AV | **No** | Independent of subject |
| Vision prompt (`face-read-vision.js`) | **Yes — explicit** | “analyzing a **face** photo”; “If clearly not a face (arm, hand, torso): `reject_reason=wrong_subject`”; “If no face: `not_a_face`” |
| Perceive → orchestrate | **Yes** | Any `reject_reason` → HTTP 422 `QUALITY_GATE_FAILED` (misnamed: not the unmetered gate) |
| Structure / policy / overlay | **Not reached** on these failures | Overlay is client-only; does not cause the 422 |

User-facing copy after normalize can also say: *“This looks like a body part — we need your face for this scan.”* (`wrong_subject` path).

### Central answer

**Yes — in practice `skin` is face-only today**, regardless of the tag name. The daily face habit loop’s vision stack (`face-read-vision`) was wired into medical-tracker `skin`/`mark` without a body-region path. The visual overlay’s face-landmark anchors are a **second** face assumption (UI honesty problem), not the capture hard-fail.

Regression lock: `__tests__/body-skin-face-only-reject.test.js`.

---

## PART B — Product gap + how to close it

Real photos (leg / shoulder / neck patches) are neither “face check-in” nor “single mole with `compare_group_id`.” That is a real gap in the six-tag model as implemented.

| Option | Meaning | Verdict |
|--------|---------|---------|
| **(a)** Generalize `skin` to any body region | Prompt + zones + Area free-text; overlay not face-mesh | Correct end-state for medical-tracker “skin log” |
| **(b)** Stretch `mark` to patches | Overloads compare-over-time mole UX | Poor fit for diffuse patches |
| **(c)** Smallest fix: stop requiring a face; keep tags | Prompt accepts clear skin of any site; Area = free text; overlay = center/label unless face zones present | **Right first ship** — matches “skin never meant face-only” |

**Recommended sequence:** ship **(c)** immediately (unblock captures + honest overlay fallback), then **(a)** for body-region zone enum / Area UX. Keep `mark` for discrete compare-group spots.

**Ship status (2026-07-17/18):** **(c) middleware LIVE** — rev `somo-middleware-00192-rh9`, digest `sha256:31d38fbe…`, **SERVING_DIGEST_MATCH** after `update-traffic`. Live API: leg+neck → **201 drafts** (no `not_a_face`); shoulder schematic → **422 `not_skin`** (kept quality check). Evidence: [`touche-prod-gate-2026-07-17/BODY_SKIN_C_DEPLOY_EVIDENCE.md`](./touche-prod-gate-2026-07-17/BODY_SKIN_C_DEPLOY_EVIDENCE.md). **iPhone X app path + cold-start still blocked (device not on USB).** **(a)** tracked P1: [`SKIN_BODY_REGION_GENERALIZATION_PLAN_2026-07-17.md`](./SKIN_BODY_REGION_GENERALIZATION_PLAN_2026-07-17.md) — only after device gate.

---

## PART C — Meta-commentary ban was too narrow (message truncated; this is the known hole)

Morning fix banned tone/race limitation narration. Still **instructed** in the same prompt:

```
plain_language: "The photo lighting made it harder to read skin details.
A retake in better light will give clearer results."
```

Also still in onboarding reveal UI: “Estimate may vary on deep skin tones — retake in good light…”

Same failure mode: model (or product copy) narrating its own limitations at the user. Ban should cover lighting/retake meta and self-accuracy commentary in `scan_summary` / `plain_language`, not only race/tone.

---

## Overlay note (device feedback)

Face-landmark ellipses on non-face photos (or empty zones) read as **wrong**, not “approximate.” Until body zones exist: only draw face ellipses when `zones` intersect face enum; otherwise center marker + label, or hide marker and keep Area text only.
