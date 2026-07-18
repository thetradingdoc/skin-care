# Engineering retro patterns — 2026-07-17 (TestFlight / device day)

Named patterns surfaced during iPhone X Phase 5 prep. Keep this short; expand only when a pattern recurs.

## PATTERN: Mock-mirrors-bug (not reality)

**Statement:** Mocks and test scaffolding need periodic sanity-checking against real device / integration behavior, not just internal consistency.

**What happened (twice on 2026-07-17):**

1. **Audit script phase scope** — completed-test audit / phase scope scaffolding agreed with itself while mis-scoping which phases were actually done vs claimed.
2. **Capture FormData upload** — `appendUploadToForm` / `uriToUploadFile` were called with swapped positional args on the medical capture path. Unit mocks were written to match that broken call shape (`(form, 'file', file)`), so Vitest stayed green while every real Take Photo / Upload sent the string `"file"` instead of image bytes → production gate `QUALITY_GATE_FAILED` / empty media → screen 2c.

**Why internal consistency is insufficient:** A mock that implements the *caller's* mistaken contract will always pass. The failure mode only appears when bytes hit multer / ClamAV / vision on a real device or a live HTTP fixture.

**Minimum countermeasures (no giant process):**

- Prefer **options objects** over same-typed positional args when a swap is silent at compile time (done for upload helpers).
- Prefer **one real fixture path** per critical I/O (e.g. HEIC device file through quality gate; multipart with actual Buffer) in the same PR as the mock.
- When fixing a device bug, **rewrite the mock to the corrected API** — do not leave the mock encoding the bug.
- Spot-check: if production/device fails and unit tests are green, search mocks for the failing call signature first.

**Related:** `patient-app/lib/upload-uri.ts`, `lib/__tests__/capture-formdata-and-2c-routing.test.ts`, `middleware-platform/__tests__/heic-device-capture-pipeline.test.js`
