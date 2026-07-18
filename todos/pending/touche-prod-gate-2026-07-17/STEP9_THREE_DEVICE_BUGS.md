# Step 9 — Three device bugs (OS SPH / scroll / CAPTURE_TOKEN) — 2026-07-17

**Status:** middleware **DEPLOYED + SERVING DIGEST MATCH**; app rebuild + authenticated on-device confirm **BLOCKED (no iPhone attached)**.

## Root causes (separate)

### 1. OS SPH = axis (045)
`sectionNums` in `prescription-ocr-parser.js` accepted axis-like ints (`045`) into SPH/CYL (only filtered `abs > 180`). Strength became `OS 045/-0.75x045`; `classify-extract` wrote `os[1]` → `os_sph`. Validator `asString` did not reject it.

### 2. Confirm does not scroll
`SecondTierChrome` had **no ScrollView** + `justifyContent: 'space-between'`. `TemplateFieldsForm` is a plain field list. Optical (14+) and imaging Findings/Conclusion clipped above the CTA.

### 3. CAPTURE_TOKEN_REQUIRED on authenticated confirm
Client `confirmRecordFact` used `if (!sid || via === 'anonymous_capture')`. Auth captures set `via: 'authenticated_capture'` and never stash a token. Transient `!sid` (SecureStore) wrongly entered the anonymous path → `CAPTURE_TOKEN_REQUIRED`.

## Fixes shipped

| Area | Change |
|------|--------|
| Parser | SPH/CYL reject `abs > 20` and `/^\d{3,}$/`; diopter gate in classify-extract + validator |
| Chrome | Sticky footer + ScrollView for main content |
| Confirm | Route by `via`; auth missing session → `SESSION_REQUIRED`, not token error |

## Middleware deploy (serving-revision discipline)

| Item | Value |
|------|--------|
| Image | `gcr.io/somo-callsomo/somo-middleware:step9-devicebugs-202607172032` |
| Digest | `sha256:5859067661913e379094a5ab6698e07d474b91be6b9de230bf799687bfdec22e` |
| Serving revision | **`somo-middleware-00190-hh6` @ 100%** |
| Assert | **PASS: SERVING_DIGEST_MATCH** (explicit `update-traffic` after deploy left traffic on old rev) |
| Memory | 4Gi |

## Live API check (Allerton photo, post-deploy)

HTTP 201 on `api.callsomo.com` anonymous capture:

| Field | Value |
|-------|--------|
| `os_sph` | **-0.25** (was 045 — **fixed**) |
| `os_cyl` / `od_sph` | -0.75 / -0.25 |
| `os_axis` / `od_axis` | Follow vision OCR row labels (this run labeled L=145, R=045 — axis swap is OCR labeling, not the SPH leak) |

## Device re-verify — BLOCKED

`idevice_id` / `xctrace` show **no physical iPhone** (MacBook + simulators only).

Still required after phone reconnect:

1. Rebuild/reinstall patient-app (ScrollView + confirm routing are **client**).
2. Authenticated Allerton capture → confirm: OS SPH `-0.25`, scroll to CTA, **Looks right** saves without `CAPTURE_TOKEN_REQUIRED`.

## Step 10

Do **not** start six-tag template migration until on-device checklist above is clean.

## App rebuild / reinstall (2026-07-17 evening)

| Item | Result |
|------|--------|
| Device | iPhone X UDID `c1b4d3db…` iOS 16.7.14 unlocked |
| Build | Release `xcodebuild` → **BUILD SUCCEEDED** (`/tmp/touche-iphone-x-release-derived`) |
| Install | `ios-deploy` → **InstallComplete** |
| Bundle markers | `SESSION_REQUIRED`, `authenticated_capture`, `Looks right`, `template-fields-` present in `main.jsbundle` |
| Middleware | still `somo-middleware-00190-hh6` digest MATCH (OS SPH server fix) |

### Still need human on-device pass (authenticated)

1. Open **touche** → sign in if needed.
2. Capture Allerton Rx photo (Camera/Files) as **prescription**.
3. On confirm: **OS SPH = -0.25** (not 045); scroll all fields to **Looks right**.
4. Tap **Looks right** — must save with **no** `CAPTURE_TOKEN_REQUIRED`.

