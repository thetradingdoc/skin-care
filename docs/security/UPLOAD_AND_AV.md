# Upload security and antivirus

**Last updated:** 2026-07-17

## MIME validation

[`utils/mime-validate.js`](../../middleware-platform/utils/mime-validate.js) — magic bytes for PDF, JPEG, PNG, HEIC.

## Antivirus

[`services/antivirus-service.js`](../../middleware-platform/services/antivirus-service.js):

### Medical / patient-record uploads (capture orchestration)

- **Fail-closed.** Uses `scanPatientRecordBuffer`.
- Requires ClamAV: set `CLAMAV_SOCKET` (gate) and/or `CLAMAV_BIN` (CLI path; default `clamscan`).
- Heuristics alone are **not** sufficient.
- ClamAV/scan errors → upload rejected (`AV_UNAVAILABLE` / `AV_SCAN_ERROR`).
- Missing ClamAV → `AV_NOT_CONFIGURED` (403).

**Compressed-image / PDF heuristic narrowing (2026-07-17):** When buffer magic is JPEG / PNG / WebP / HEIC-HEIF, **or** `%PDF-` appears within the first 1KB, only the binary-entropy false-positive patterns are skipped (PE `MZ` / ELF / `eval(` / `.exe ` substrings — common in compressed streams). **`script` / `javascript:` / `vbscript:` heuristics still run for PDFs and images** — those are real attack vectors (embedded JS in PDFs), not FP-prone entropy noise. Non-image/non-PDF types keep the full heuristic set.

**ClamAV is the real scanner:** When ClamAV is configured, every medical upload — including every PDF that passed heuristics — is still scanned with `clamscan` on the full temp file. Heuristics are a fast pre-filter only; they never replace ClamAV. Missing ClamAV → `AV_NOT_CONFIGURED` (or explicit non-prod `PATIENT_RECORD_AV_DEV_BYPASS=1` heuristic-only with a loud warn).

**ClamAV on images (honest):** ClamAV runs `clamscan` on the temp file bytes — genuine signature matching against the CVD DB, not a no-op. Coverage on images is **weaker than on executables/scripts**: it catches known malware signatures, many polyglots, and EXE-renamed-as-image when signatures match, but it does **not** deeply decode pixels for steganography and will not invent detections for novel image-borne threats. Narrowing entropy heuristics therefore accepts a real gap (random mid-file `MZ` no longer blocked by heuristics on images/PDFs); that gap is the false-positive class, not intentional PE-at-start (still blocked because PE magic ≠ image/PDF magic). A PE renamed `.pdf` has no `%PDF-` magic → full heuristics → blocked.

**Ops note (2026-07-17):** `scanWithClamAV` previously used `maxBuffer: 2048`, which caused Node to abort clamscan on normal output and return `AV_UNAVAILABLE` for every image that reached ClamAV. Buffer raised to 8MiB.

**Local / CI tradeoff:** without ClamAV, medical uploads fail. That is intentional.

Explicit non-production escape hatch (never honored when `NODE_ENV=production`):

```bash
PATIENT_RECORD_AV_DEV_BYPASS=1
```

Logs a loud warning and runs heuristic-only. Do not use in staging/prod.

### Legacy portal / documents (`scanBuffer` / `scanFile`)

- Enable: `ENABLE_ANTIVIRUS_SCAN=1` or `PATIENT_RECORD_AV_SCAN=1`
- When enabled: also fail-closed without ClamAV (no silent heuristic-only allow)

## Route coverage

| Route | MIME | AV |
|-------|------|-----|
| Capture orchestration (six tags) | Yes | **Fail-closed** `scanPatientRecordBuffer` |
| Upload portal | Yes | Yes |
| Patient documents | Yes | Yes |
| Public face-read | Size limit | Yes |

## Production

Install ClamAV on the runtime image and set `CLAMAV_SOCKET` or `CLAMAV_BIN`. Do not set `PATIENT_RECORD_AV_DEV_BYPASS` outside local/CI.
