# Upload security and antivirus

**Last updated:** 2026-06-12

## MIME validation

[`utils/mime-validate.js`](../../middleware-platform/utils/mime-validate.js) — magic bytes for PDF, JPEG, PNG, HEIC.

## Antivirus

[`services/antivirus-service.js`](../../middleware-platform/services/antivirus-service.js):

- Enable: `ENABLE_ANTIVIRUS_SCAN=1`
- Optional: `CLAMAV_SOCKET` or `clamscan` CLI
- Heuristic patterns (PE/ELF, script tags) when enabled
- **Fail-open on scan errors** (logs + allows) — document for prod hardening

## Route coverage

| Route | MIME | AV |
|-------|------|-----|
| Upload portal | Yes | Yes |
| Patient documents | Yes | Yes |
| Public face-read | Size limit | **Yes** (buffer scan added) |
| Routine photos | Via documents path | Per documents flow |

## Production

Set `ENABLE_ANTIVIRUS_SCAN=1` on Cloud Run for document uploads. Review fail-open vs fail-closed per route class.
