# Step 9 — Production deploy + device / live capture evidence (2026-07-17)

**Verdict: PASS (with notes)** — middleware + 076 live; iPhone X cold-starts pass; Allerton optical OD/OS/expiry pass on live API; Spanish MRI PDF pass (text-layer / `es` / Findings·Conclusion / AV allow). Serving-revision assert still tracked as follow-up (not fixed today).

## 1. Middleware serving (final)

| Item | Evidence |
|------|----------|
| Serving revision | **`somo-middleware-00189-8ml`** @ **100%** traffic |
| Image | `gcr.io/somo-callsomo/somo-middleware:step9-optical-d-202607172016` digest **`sha256:4c15a1ab…528f46`** |
| Memory | **4Gi** (step9mem bump retained; PDF capture OOMed at 2Gi on `step9b`) |
| API host | `https://api.callsomo.com` `/health` → `ok` |
| Built ↔ serving | **MATCH** asserted manually after `update-traffic` (deploy alone left traffic on prior rev — see follow-up) |

Earlier path: Cloud Build Steps 1–8 image `sha256:d09fb518…` → `step9b` (2Gi) → `step9mem` (4Gi) → optical hotfixes `00186`→`00187`→`00188`→**`00189`**.

## 2. Production 076 backfill — LIVE PASS

From Cloud Run logs on revision **`somo-middleware-step9b`** at `2026-07-17T19:19:29Z`:

```
[076 denorm backfill] env=production seen=2 processed=2 skipped_populated=0 failed=0
```

Not `BLOCKED_NO_KEY`. Encryption key present (Secret Manager).

## 3. iPhone X — rebuild / cold-start ×3 — PASS

| Item | Evidence |
|------|----------|
| Device | UDID `c1b4d3db…`, `iPhone10,3`, iOS **16.7.14** |
| Build | Release install via `ios-deploy` → InstallComplete (`com.skinandcare.app`) |
| Bundle markers | `TemplateFieldsForm`, `bill.default`, `money_cents`, `prescription.optical` present in `main.jsbundle` |
| Cold-start ×3 | Kill/relaunch ×3 via `idevicedebug run`; screenshots `/tmp/touche-step9-device/fg-{1,2,3}.png` → Welcome / Medical Tracker / **Get started** — no instant crash |

## 4. Allerton optical — PASS (live API = app capture path)

**Method:** `POST https://api.callsomo.com/api/patient/records/anonymous` with the real Allerton Rx photo (`media_type=photo`, `tag=prescription`, `ai_or_manual=ai`). Same orchestration as the installed app. In-app Files/camera UI not Maestro-automated.

| Field | Live result (`allerton6`, revision `00189`) |
|-------|-----------------------------------------------|
| `template_id` | `prescription.optical` |
| `od_sph` / `od_cyl` / `od_axis` | **-0.25 / -0.75 / 145** |
| `os_sph` / `os_cyl` / `os_axis` | **-0.25 / -0.75 / 045** |
| `pd` | **70** |
| `expiry` | **2027-07-07** |
| `prescriber` | ALLERTON EYE CARE |

**Finding fixed during Step 9:** live GPT vision OCR layouts vary (compact R/L rows, labeled SPH lines, braced `R {`, garbled mid-form `DISTANCE`). Fixture-only parser left `od_*`/`os_*` in `fields_absent` while expiry/clinic still populated. Hardened `prescription-ocr-parser.js` (row + triplet fallbacks; do not anchor on mid-form `DISTANCE`). Regression fixtures: `allerton-eye-rx.vision-*.ocr.txt` (10 tests green).

## 5. Spanish MRI PDF — PASS (live API)

**Fixture:** `middleware-platform/__tests__/fixtures/mri-rodilla-es.pdf`  
**Method:** anonymous capture `tag=lab`, `media_type=pdf` on 4Gi revision (after OOM on 2Gi).

| Check | Result |
|-------|--------|
| HTTP | **201** (`mri3`) |
| AV | **Not blocked** |
| Text-layer | Local `extractText` → `method: pdf-text-layer`, `used_ai: false`, **3101** chars; live `raw_extract_text` length **3101** (matches) — not vision |
| Language | `source_language` / structured **`es`** |
| Template | `lab.imaging_report` |
| Findings / Conclusion | Split populated (findings ~2175 chars, conclusion ~300 chars) |

## 6. Tracked follow-up (not fixed today)

**Deploy gate gap:** assert serving Cloud Run revision image digest matches the digest just built — do not treat `/health` alone as deploy success.  
See [`FOLLOWUP_CLOUDRUN_SERVING_REVISION_ASSERT.md`](./FOLLOWUP_CLOUDRUN_SERVING_REVISION_ASSERT.md).

Reproduced repeatedly this session: `gcloud run deploy` created `00186`/`00187`/`00188`/`00189` while traffic stayed on the prior revision until explicit `update-traffic`.

## Exit criteria checklist

1. [x] Connect iPhone X + rebuild/reinstall Steps 1–8 app  
2. [x] Cold-start kill/relaunch ×3  
3. [x] Allerton optical OD/OS/expiry on live capture path  
4. [x] Spanish MRI PDF text-layer / `es` / Findings·Conclusion / AV allow  
5. [x] Deploy-revision assert logged as follow-up (not implemented today)

## Next

**Step 10** — six-tag template migration (skin / bill / mark / other; bill partially done in Step 8).
