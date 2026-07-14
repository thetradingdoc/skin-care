# iOS cold-start crash — 2026-07-13

**Status:** Local fix landed; TestFlight 20 blocked until iPhone X Sign-in is green ×3.  
**Audience:** Anyone debugging `toucheSkinJournal` SIGABRT / blank screen on launch.

## Symptoms

- App opens then closes in ~0.2–1.2s, **or** stuck logo, **or** white/black empty UI
- IPS: `SIGABRT`, `RCTFormatError` → `RCTExceptionsManager reportFatal` → `NSInvocation`
- Queue: `com.facebook.react.ExceptionsManagerQueue`
- **Web / Playwright cold start can be green** while the physical device fails (different runtime)

## What it is (and isn’t)

This is a **JS fatal** reported to native via the React Native exceptions bridge (`RCTFatal`). It is **not** primarily camera permissions, nav-bar UIKit, or a random ObjC module unless the JS stack says so.

Do **not** chase a single hypothesis with repeated Release rebuilds until you have `Error.message`.

## Proven causes (this investigation)

1. **Missing `EXConstants.bundle/app.config`**  
   - `expo-linking` throws: *needs access to the expo-constants manifest…*  
   - Local clone under a path with spaces (`…/Voice Agent/…`) breaks Expo’s `get-app-config-ios.sh`: unquoted `basename $PROJECT_DIR` returns `Voice`, script exits without writing `app.config`.  
   - Fix: `patient-app/scripts/ensure-exconstants-app-config.sh` (npm `postinstall`); confirm file is inside the built `.app`.

2. **`window.location.hostname` on native**  
   - RN may define `window` without `location` → *Cannot read property 'hostname' of undefined*  
   - Fix: gate in `patient-app/config.ts` with `Platform.OS === 'web'`.

3. **Splash / session hang (blank UI)**  
   - `SplashScreen.preventAutoHideAsync` without reliable hide; SecureStore hang on sign-in gate  
   - Fix: never prevent auto-hide; force `hideAsync`; timeout SecureStore + session check.

4. **False / incomplete leads (do not reopen without evidence)**  
   - `experiments.baseUrl=/app` alone (still strip on native via `app.config.js`, but TF 18 IPS already lacked `/app` poison)  
   - Reanimated worklets alone (stripped from cold path; still keep babel careful)

## How to capture `Error.message`

| Method | Notes |
|--------|--------|
| Temporary Alert swallow (lab only) | Swallow fatal → `Alert.alert` → remove before shipping |
| `POST /api/patient/public/client-fatal` | Boot + ErrorUtils sync XHR; read with `GET …/recent?token=` (`CLIENT_FATAL_READ_TOKEN`) |
| `idevicecrashreport` | Confirms SIGABRT path; usually **no** JS message in modern IPS |
| Debug + Metro | Needs device reaching packager host; tunnel/LAN often flakes |

**Rule:** Do not Release-rebuild to “try another guess” until message is known.

## Local build checklist (Mac)

```bash
cd patient-app
npm ci   # runs ensure-exconstants-app-config.sh
# Confirm patch:
grep 'basename "\$PROJECT_DIR"' node_modules/expo-constants/scripts/get-app-config-ios.sh

# After xcodebuild / run:ios:
#   toucheSkinJournal.app/EXConstants.bundle/app.config must exist
#   JSON must include "scheme":"patientapp"
```

Prefer building from a path **without spaces** (e.g. `/tmp/skin-and-care` symlink) in addition to the script.

## Related files

- `patient-app/app.config.js` — strip `experiments.baseUrl` on native  
- `patient-app/index.js` + `lib/capture-fatal-boot.js` + `lib/capture-fatal.ts` — early capture  
- `patient-app/config.ts` — web-only `window.location`  
- `middleware-platform/routes/public-client-fatal.js` — ingest  

## Out of scope next

After device Sign-in is green ×3: strip leftover diag if any, then EAS TestFlight build 20 (explicit approve). Do not push or deploy middleware solely for this crash doc.
