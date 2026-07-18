# Body-skin (c) deploy + live evidence — 2026-07-17/18

**Gate standard:** live evidence + serving digest MATCH (not `/health` alone).  
**Artifacts:** `/tmp/touche-body-skin-deploy/`, `/tmp/touche-body-skin/` (exact session JPEGs).

## Verdict (honest)

| Gate | Status |
|------|--------|
| 1. Middleware deploy + **SERVING_DIGEST_MATCH** | **PASS** |
| 2. Live API re-probe exact leg/shoulder/neck | **PARTIAL PASS** — face-only reject gone; 2/3 drafts; shoulder = `not_skin` (legitimate, not `not_a_face`) |
| 3. iPhone X app path (confirm + overlay + AI SUGGESTS) | **IN PROGRESS** — installed; awaiting tap-through (screenshot watcher running) |
| 4. Cold-start ×3 | **PASS** — Welcome / Medical Tracker / Get started ×3 |

**Do not start Part 2 (A1–A4) until device confirm screenshots clear for the three photos.** Middleware face-requirement fix is live-proven; cold-start is clean.

---

## 1. Middleware serving

| Item | Evidence |
|------|----------|
| Image tag | `gcr.io/somo-callsomo/somo-middleware:body-skin-c-202607180124` |
| Built digest | `sha256:31d38fbe676656b46428f7e889f12ba004ef3611468f8c4ae8856e23a0b18d75` |
| Created revision | `somo-middleware-00192-rh9` (4Gi) |
| After bare `run deploy` | Traffic **stayed on** `00191-58k` @ old digest `5566e937…` — **MISMATCH** (same gap as follow-up) |
| After `update-traffic …00192-rh9=100` | **100%** `somo-middleware-00192-rh9` |
| Serving digest | `sha256:31d38fbe…0b18d75` |
| Assert | **`SERVING_DIGEST_MATCH`** (`/tmp/touche-body-skin-deploy/digest-assert.txt`) |
| Memory | **4Gi** |
| `/health` | `ok` (necessary but not sufficient — digest assert is the gate) |

Deploy log: `/tmp/touche-body-skin-deploy/deploy.log`  
Traffic fix: `/tmp/touche-body-skin-deploy/update-traffic.log`

---

## 2. Live API — exact session images

**Endpoint:** `POST https://api.callsomo.com/api/patient/records/anonymous`  
`tag=skin`, `ai_or_manual=ai`, files from `/tmp/touche-body-skin/{lower-leg,shoulder,neck}.jpg`

**Before (this session, prior rev):** all three → **422** `QUALITY_GATE_FAILED` / `quality_issues: ['not_a_face']`.

**After (rev `00192`, digest MATCH):**

| Image | HTTP | Result | `body_area` | `visual_pointer` | AI text (excerpt) | Self-ref hits |
|-------|------|--------|-------------|------------------|-------------------|---------------|
| lower-leg | **201** | draft + fact `prf_68213f21-…` | `arm` | `zones: []`, `labels: ['arm']` | “The skin shows a prominent red spot. Overall tone is even.” | **none** |
| neck | **201** | draft + fact `prf_3eb3fc97-…` | `arm` | `zones: []`, `labels: ['arm']` | “The skin shows a prominent red patch… hydration appears good.” | **none** |
| shoulder | **422** | `QUALITY_GATE_FAILED` | — | — | — | — |
| shoulder quality | | `quality_issues: ['not_skin']` (×2 tries) | | | | |

JSON: `/tmp/touche-body-skin-deploy/live-probes/{lower-leg,shoulder,neck}.json`

### Interpretation (not code-review)

- **`not_a_face` is gone** on the live path that previously failed all three.
- Session images are **synthetic schematics** (tan shapes + red mark on charcoal), not camera photos. Vision accepted leg/neck as skin-like; **rejected shoulder triangle as `not_skin`** — that is the *kept* quality check, not a regression of face-only.
- Empty `zones` + `zone_labels: ['arm']` is the overlay contract for non-face (center marker + label path) once the app confirms.
- `body_area: arm` on leg/neck schematics is model free-text imprecision on abstract shapes — tracked under follow-on **(a)** Area model, not a silent facial default.

---

## 3. iPhone X — install + cold-start PASS

| Item | Evidence |
|------|----------|
| Device | UDID `c1b4d3db…`, `iPhone10,3`, iOS **16.7.14**, unlocked |
| Install | `ios-deploy` → **InstallComplete** (`/tmp/touche-body-skin-ios-derived/.../toucheSkinJournal.app`) |
| Bundle markers | `ObservationZoneOverlay`, `center-mark` present; banned copy absent |
| Cold-start ×3 | **PASS** — OCR on `fg-{1,2,3}.png`: **touche / Medical Tracker / Get started** each time |
| Screenshots | `/tmp/touche-body-skin-deploy/device/fg-{1,2,3}.png` |

## 4. In-app three-photo confirm — awaiting tap-through

| Item | Status |
|------|--------|
| DCIM push | AFC → `IMG_914884.JPG` (leg), `IMG_916315.JPG` (shoulder), `IMG_914355.JPG` (neck) under `/DCIM/100APPLE/` |
| Photos index | Raw AFC may not show in Recents; if missing, AirDrop `/tmp/touche-body-skin/*.jpg` |
| Confirm / overlay / AI SUGGESTS | Screenshot watcher: `/tmp/touche-body-skin-deploy/device/capture-watch/` |

---

## Exit criteria for unlocking Part 2 (a)

1. [x] Serving digest MATCH on body-skin-c image  
2. [x] Live API: no `not_a_face` on exact session images  
3. [~] Live API: drafts for body-like schematics (2/3; shoulder `not_skin` OK)  
4. [x] Cold-start ×3  
5. [ ] Device confirm: draft + center marker (not face ellipses) + clean AI SUGGESTS  

Until 5: confirm-screen gate still open. Named follow-on: [`SKIN_BODY_REGION_GENERALIZATION_PLAN_2026-07-17.md`](../SKIN_BODY_REGION_GENERALIZATION_PLAN_2026-07-17.md).

