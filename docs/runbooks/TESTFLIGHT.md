# TestFlight — Skin & Care iOS (physical device)

Install **Skin & Care** on your iPhone via Apple TestFlight. Builds use production API `https://api.callsomo.com` (configured in `patient-app/eas.json` → `testflight` profile).

## Prerequisites (one-time)

| Requirement | Notes |
|-------------|--------|
| **Apple Developer Program** | [developer.apple.com](https://developer.apple.com/programs/) — $99/year |
| **App Store Connect app** | Bundle ID **`com.skinandcare.app`**, name **Skin & Care** |
| **Expo account** | [expo.dev](https://expo.dev) — free tier works for builds |
| **EAS CLI** | `npm i -g eas-cli` or `npx eas-cli` |

Privacy/terms URLs for App Store Connect (can use callsomo.com until myskinandcare.com DNS is live):

- Privacy: `https://callsomo.com/patients/legal/privacy.html`
- Terms: `https://callsomo.com/patients/legal/terms.html`

## Step 1 — Link Expo project

Run **one command at a time** (do not paste inline `#` comments — zsh can mis-parse them):

```bash
cd patient-app
npm ci
npx eas-cli login
npx eas-cli init
```

`eas init` writes `expo.extra.eas.projectId` into `app.json`. Commit that change.

Optional: create an [Expo access token](https://expo.dev/accounts/[account]/settings/access-tokens) and add **`EXPO_TOKEN`** to GitHub repo secrets for CI builds.

## Step 2 — App Store Connect

1. [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → **+** → New App
2. Platform: iOS  
3. Name: **Skin & Care**  
4. Bundle ID: **com.skinandcare.app** (register in [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) if missing)
5. SKU: e.g. `skin-care-ios`

You do **not** need App Store review for **internal** TestFlight testers.

## Step 3 — Verify locally

```bash
cd patient-app
npm run verify:testflight
npm run typecheck
```

Fix any FAIL lines before building.

## Step 4 — Build for TestFlight

EAS builds in the cloud (no Mac required for compile, but Apple credentials are needed first time):

```bash
cd patient-app
npm run build:testflight
```

First run: EAS prompts for Apple Team ID and can create/manage signing credentials. Choose **Let EAS handle credentials** unless you have existing certs.

Watch build: link printed in terminal or [expo.dev](https://expo.dev) → your project → Builds.

## Step 5 — Submit to TestFlight

When the build finishes:

```bash
cd patient-app
npm run submit:testflight
```

First submit: sign in with Apple ID (app-specific password if 2FA). EAS uploads the `.ipa` to App Store Connect.

Alternatively, one-shot build + auto-submit:

```bash
npx eas-cli build --platform ios --profile testflight --auto-submit
```

## Step 6 — Install on your iPhone

1. App Store Connect → your app → **TestFlight**
2. Wait for **Processing** (often 5–30 minutes)
3. **Internal Testing** → add your Apple ID email as an internal tester (up to 100, no beta review)
4. On iPhone: install Apple **TestFlight** app
5. Open invite email or TestFlight → **Skin & Care** → **Install**

## Step 7 — Smoke test on device

Uses live API — no local middleware required.

1. Open app → **Sign in** with email OTP (`/api/patient/auth/*`)
2. Pick a concern → **Today** loads
3. Log a photo (camera permission)
4. **Timeline** shows the logged day
5. **Account** → subscription flow (Stripe) optional

If sign-in fails with network errors, confirm the build used `EXPO_PUBLIC_API_BASE_URL=https://api.callsomo.com` (see build logs on expo.dev).

## Profiles reference

| Profile | Distribution | Use |
|---------|--------------|-----|
| `development` | internal + dev client | Local debugging |
| `preview` | internal (ad hoc link) | Quick device install **without** TestFlight |
| **`testflight`** | **store** | **TestFlight** (this guide) |
| `production` | store | App Store release (same API env today) |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `No bundle identifier` | Set `ios.bundleIdentifier` in `app.json` |
| `Missing eas.projectId` | Run `npx eas init` |
| Build fails signing | `npx eas credentials` → iOS → reset provisioning |
| TestFlight stuck Processing | Wait; check email for export compliance (we set `ITSAppUsesNonExemptEncryption: false`) |
| OTP email not received | Check spam; verify prod middleware email config |
| Camera crash | Settings → Skin & Care → enable Camera |

## CI (optional)

On push to `main`, `.github/workflows/skin-care-mobile.yml` triggers an EAS **preview** (internal) build when `EXPO_TOKEN` is set. For TestFlight, run **`npm run build:testflight`** locally or add a manual workflow with profile `testflight`.
