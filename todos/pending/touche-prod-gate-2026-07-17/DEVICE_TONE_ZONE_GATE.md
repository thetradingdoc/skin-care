# Device gate — tone fix + zone overlay (2026-07-17 evening)

## App (client) — INSTALLED

| Item | Result |
|------|--------|
| Device | iPhone X `c1b4d3db…` iOS 16.7.14 unlocked |
| Build | Release `xcodebuild` **BUILD SUCCEEDED** |
| Install | `ios-deploy` **InstallComplete** |
| Bundle markers (UTF-16) | `which area is this`, `approximate region`, `confirm-skin-zone-overlay`, `SESSION_REQUIRED` present |

## Middleware — SERVING DIGEST MATCH

| Item | Value |
|------|--------|
| Image | `gcr.io/somo-callsomo/somo-middleware:6ef6f83` |
| Built digest | `sha256:5566e93748079b7c97af6c714c3d69090471af572e715f2d6b6e3542bc9b88bf` |
| Serving revision | **`somo-middleware-00191-58k` @ 100%** (after explicit `update-traffic`; deploy alone left traffic on `00190-hh6`) |
| Assert | **PASS: SERVING_DIGEST_MATCH** |
| Health | `https://api.callsomo.com/health/live` → 200 |
| Upload hygiene | `.gcloudignore` now excludes `.playwright-browsers/` (was ~400MB bloat) |

## Live screenshot (old draft — before middleware MATCH)

| Check | Observed |
|-------|----------|
| "not found in document" on Area | **Gone** (shows `—`) |
| AI SUGGESTS tone disclaimer | Still present on **that** draft (old prompt) |
| Zone overlay | Needs a **new** capture (`preview_uri` + server `visual_pointer`) |

## Human checklist — NOW

1. Force-quit touche → reopen (discard old confirm draft).
2. **New** skin capture of the same photo.
3. Confirm must show: no dark-skin-tone limitation sentence; Area not “not found in document”; photo + approximate zone marker; AI SUGGESTS text still there.
4. Optional Step 9 leftover: Allerton OS SPH `-0.25`, scroll, Looks right without `CAPTURE_TOKEN_REQUIRED`.
