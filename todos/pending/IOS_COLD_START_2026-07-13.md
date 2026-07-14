# iOS cold start — 2026-07-13 progress

## Done

- Identified JS fatal path (`RCTExceptionsManager`) vs native guessing
- Proven missing `EXConstants.bundle/app.config` (path-space Expo script bug) + `hostname` on native `window`
- Fixed: ensure-exconstants postinstall script, `config.ts` Platform.OS web gate, splash/session timeouts, light nav chrome, Reanimated cold-path strip
- Production fatal ingest (`client-fatal`) + boot capture (no Alert / no swallow in ship code)
- Docs: `docs/patient-app/IOS_COLD_START_CRASH.md`, ARCHITECTURE §7.1.1

## Remaining

- [ ] iPhone X: cold open ×3 → Sign in (email / Send code), no SIGABRT
- [ ] Explicit approve → push branch / EAS TestFlight **build 20**
- [ ] Prefer symlink or space-free path for local Xcode builds when possible

## Supersedes

Treat older “baseUrl is the only crash” and “Reanimated alone” notes as incomplete. Canonical runbook: [`docs/patient-app/IOS_COLD_START_CRASH.md`](../../docs/patient-app/IOS_COLD_START_CRASH.md).
