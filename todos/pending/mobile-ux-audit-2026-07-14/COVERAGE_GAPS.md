# COVERAGE_GAPS

Explicit holes so they are not silent.

| Gap | Why Playwright can't cover | Follow-up |
| --- | --- | --- |
| SecureStore / true SecureStore session | Web uses localStorage | Device smoke |
| True camera shutter / permissions | Fake media only | Device smoke |
| Splash / cold native chrome | Expo web ≠ native splash | Device smoke |
| `patientapp://auth?ticket=…` handoff | Custom URL scheme | Device/TestFlight deep-link smoke |
| Idle / max-age session expiry timing | Clock/idle hard to fake reliably on web stubs | Device smoke; Profile copy captured in `tab-profile-session-copy` |
| `/journal/capture` live path | `JOURNAL_CAPTURE_ENABLED=false` compile-time | Flip flag + rebuild hosting, or keep skip |

Native `.ipa` / TestFlight photo set is out of scope for this diagnostic pass.


## Static export cold-boot limitation (audit finding)

- Navigating to bare `/app` paints a **blank white** shell (no hydrate) in Chromium against `hosting-dist-consumer`.
- `/app/index` resolves as Expo **Unmatched Route** (client path strips to `/index`).
- C1–C5 / P1–P7 screenshots were therefore captured as **seeded destination routes** matching each `resolvePostAuthRoute` / cold-start *outcome* (same stubs + storage the router would use). Branch logic remains covered by `patient-app/lib/__tests__/useOnboardingGate.test.ts`; SPA index redirect is a **hosting/export gap**, not “gates missing.”

## TOUCH-003 cold-boot retest (2026-07-14)

After TOUCH-002 SPA fix, C1–C5 / P1–P7 re-ran via **bare `/app` only** (script `scripts/playwright-mobile-audit-rerun-cp-coldboot.cjs`).
No seeded destination URLs. Report: `rerun-cp-coldboot.json`.
