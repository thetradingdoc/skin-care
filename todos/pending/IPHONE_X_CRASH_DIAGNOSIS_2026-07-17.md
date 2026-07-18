# iPhone X crash diagnosis + Debug install (2026-07-17)

Device: iPhone X · UDID `c1b4d3db94068c987ed69543123d4aa95fefded4` · iOS 16.7.14  
IPS: `~/Downloads/toucheSkinJournal-2026-07-13-141640.ips` (TF18), `…-145306.ips` (TF19)

## 1. Crash root cause

**Verdict: real app JS fatal → native abort — not an environment/signing/iOS-version crash.**

| Field | TF18 (`141640`) | TF19 (`145306`) |
|-------|-----------------|-----------------|
| Exception | `EXC_CRASH` / `SIGABRT` | same |
| Lifetime | ~1220 ms | ~509 ms |
| Team / signing | `33PP5ZAK59`, `entitledBeta: true` | same |
| App UUID | `6cea14e9-011d-3feb-898b-e53c60e56869` | **identical** |
| Faulting path | `objc_exception_throw` → `NSInvocation invoke/invokeWithTarget` → `abort()` | same offsets |

- Main thread was mid `UINavigationBar` / `setNavigationBarHidden` (concurrent UI from cold-start `router.replace`).
- Hermes + `com.facebook.react.JavaScript` threads present → RN JS runtime was up.
- IPS has **no `Error.message`** (modern IPS limitation). Prior investigation SSOT (`docs/patient-app/IOS_COLD_START_CRASH.md`) proved the JS fatals were:
  1. Missing `EXConstants.bundle/app.config` (path-with-spaces Expo script bug)
  2. `window.location.hostname` on native (`window` without `location`)
- **Not** iOS 17+ API, **not** provisioning mismatch (TestFlight store signing valid).

### Fixes present in current tree (before this Debug build)

- `scripts/ensure-exconstants-app-config.sh` + postinstall (patch applied)
- `config.ts` gates hostname to web only
- `app.config.js` strips `experiments.baseUrl` on native
- Splash: no `preventAutoHideAsync`; early `hideAsync` in `index.js` / `_layout.tsx`
- `capture-fatal` boot trap

This Debug `.app` was verified to contain `EXConstants.bundle/app.config` with `scheme: patientapp` and **no** `experiments.baseUrl`.

## 2. iOS 16.7 compatibility

| Check | Result |
|-------|--------|
| Expo SDK | **54.0.33** → official min **iOS 15.1+** |
| Xcode project `IPHONEOS_DEPLOYMENT_TARGET` | **15.1** |
| iPhone X ceiling | **16.7.x** (hard) — **above** 15.1 floor |
| Today’s JS (capture UI, IAP gate, encryption is server-side) | No iOS 17-only native APIs found |
| `newArchEnabled` | **false** |

**Compatible.** Do not upgrade to Expo 56/57 (min iOS 16.4+) without abandoning this device.

## 3. Device registration

App Store Connect (team **33PP5ZAK59**):

- Name: `iPhoneX-crash`
- UDID: `c1b4d3db94068c987ed69543123d4aa95fefded4`
- Status: **ENABLED**
- Model: iPhone X
- Added: 2026-07-13

Local Debug build used Automatic signing + `DEVELOPMENT_TEAM=33PP5ZAK59` and installed successfully (profile issued at build time).

## 4. Debug build + install (done)

- Built: `/tmp/touche-iphone-x-derived/Build/Products/Debug-iphoneos/toucheSkinJournal.app`
- Installed via `ios-deploy` → **InstallComplete**
- Bundle: `com.skinandcare.app`

### Re-install / iterate locally

```bash
# 1) Cable in, unlock, Trust
idevice_id -l
# expect: c1b4d3db94068c987ed69543123d4aa95fefded4
ideviceinfo -k ProductVersion   # 16.7.14
ideviceinfo -k PasswordProtected  # must be false

# 2) Rebuild (optional) from space-free symlink if present
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
cd /tmp/skin-and-care/patient-app/ios   # or patient-app/ios
xcodebuild -workspace toucheSkinJournal.xcworkspace -scheme toucheSkinJournal \
  -configuration Debug \
  -destination 'platform=iOS,id=c1b4d3db94068c987ed69543123d4aa95fefded4' \
  -allowProvisioningUpdates \
  -derivedDataPath /tmp/touche-iphone-x-derived \
  DEVELOPMENT_TEAM=33PP5ZAK59 \
  build

# 3) Install
APP=/tmp/touche-iphone-x-derived/Build/Products/Debug-iphoneos/toucheSkinJournal.app
ios-deploy --id c1b4d3db94068c987ed69543123d4aa95fefded4 --bundle "$APP"

# 4) Cold-open ×3 on device → must reach Sign in (no instant SIGABRT)
```

**Gate before TF20:** Sign-in green ×3 on a **Release** local build (not Debug/Metro).

---

## Addendum — Debug “No script URL” (2026-07-17 afternoon)

After USB install of the Debug build, device showed Metro’s standard:

`No script URL provided. Make sure the packager is running… unsanitizedScriptURLString = (null)`

### Not a regression of TF18/19 fixes

| Check | Result |
|-------|--------|
| `EXConstants.bundle/app.config` in Debug `.app` | Present; `scheme: patientapp`; **no** `baseUrl` |
| `main.jsbundle` in Debug `.app` | **Absent** (expected) |
| `AppDelegate.bundleURL()` Debug path | `RCTBundleURLProvider` → `.expo/.virtual-metro-entry` (needs live Metro) |
| Release path | `Bundle.main.url(forResource: "main", withExtension: "jsbundle")` |

This fails **before** app JS runs — packager URL is null. Not EXConstants / hostname.

### Expected Debug Metro URL

- Build stamped LAN IP in `ip.txt`: **`192.168.169.247`** (matches Mac `en0`)
- Default Metro port: **8081**
- Device must reach: `http://192.168.169.247:8081` (same Wi‑Fi, or USB + `iproxy`/Metro tunnel)

### Recommendation for Phase 5 (30–60 min VoiceOver)

Use a **Release local build** (embedded `main.jsbundle`) — no Metro session to drop mid-walkthrough.

**Release build installed 2026-07-17:**  
`/tmp/touche-iphone-x-release-derived/Build/Products/Release-iphoneos/toucheSkinJournal.app`  
(`main.jsbundle` ~10.2 MB present; EXConstants intact; `ios-deploy` InstallComplete)

```bash
# Reinstall if needed (unlock phone first):
ios-deploy --id c1b4d3db94068c987ed69543123d4aa95fefded4 \
  --bundle /tmp/touche-iphone-x-release-derived/Build/Products/Release-iphoneos/toucheSkinJournal.app
```

Optional Metro Debug path (only if you need live reload):

```bash
cd patient-app
npx expo start --localhost   # or: npx react-native start --host 192.168.169.247
# Same Wi‑Fi as phone, or: npm run ios with USB + packager; open Debug app while Metro is up
```

**Gate before TF20:** Sign-in green ×3 on this **Release** local build (not Debug/Metro).

## 5. Cold-start IA cutover (2026-07-17, afternoon)

**Missed cutover, not intentional.** TOUCH-013 (2026-07-14) sent every signed-out cold start to `/try-verdict` (camera-first “Check a product”). Medical-tracker Phase B made Welcome → Consent → Capture the real onboarding; cold routing was never updated.

**Fix in tree:** `resolveInitialRoute()` + `app/index.tsx` failsafe now land on `/welcome`. try-verdict stays reachable via Shopify/try-handoff marketing entry (noindex), not as App Store default.

**Device note:** Rebuild + reinstall Release completed **2026-07-17 ~12:50 EDT** (`InstallComplete`). Bundle includes `/welcome` + Medical Tracker Welcome copy; try-verdict remains in binary for marketing funnel only. Fresh cold start (no session) should open Welcome — delete app data / reinstall if an old session still lands elsewhere.

**AV heuristic fix 2026-07-17 ~13:35 EDT:**

| Step | Result |
|------|--------|
| Heuristic narrowing | JPEG/PNG/HEIC/WebP skip PE/`eval(`/`.exe `; script patterns kept; PDF full set |
| ClamAV maxBuffer | Was 2KB → caused `AV_UNAVAILABLE` once images reached ClamAV; raised to 8MiB |
| Prod traffic | `somo-middleware-00182-hmx` @ 100% |
| Prod gate JPEG (MZ-in-entropy fixture) | **HTTP 200 success** |
| Prod gate PE bytes | **HTTP 403 AV_HEURISTIC_BLOCKED** (still blocked) |
| iOS rebuild | Not required (server-side). Retry Take Photo / Upload on installed Release |

Tests: `av-image-heuristic-false-positive.test.js` (real `sample-device.jpg` with mid-file `MZ`).

