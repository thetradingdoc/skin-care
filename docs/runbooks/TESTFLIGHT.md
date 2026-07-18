# TestFlight — Touche iOS (physical device)

Install **Touche** on your iPhone via Apple TestFlight. Builds use production API **`https://api.callsomo.com`** (see `patient-app/eas.json` → `testflight` profile). When DNS is live, **`https://api.myskinandcare.com`** is an alias to the same middleware.

## Prerequisites (one-time)

| Requirement | Notes |
|-------------|--------|
| **Apple Developer Program** | [developer.apple.com](https://developer.apple.com/programs/) — $99/year |
| **App Store Connect app** | Bundle ID **`com.skinandcare.app`** (kept), display name **Touche** |
| **Expo account** | [expo.dev](https://expo.dev) — free tier works for builds |
| **EAS CLI** | `npm i -g eas-cli` or `npx eas-cli` |

Privacy/terms URLs for App Store Connect:

- Privacy: `https://app.trytouche.com/privacy`
- Terms: `https://app.trytouche.com/terms`

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
3. Name: **Touche** (App Store display name)  
4. Bundle ID: **com.skinandcare.app** (register in [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) if missing — do not change for brand cutover)
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
npm run doctor:testflight   # prints blockers + exact commands
npm run build:testflight
```

### Apple login (required first build)

EAS asks for your **Apple Developer** account — not your Expo password.

| Field | Value |
|-------|--------|
| Apple ID | Full email from App Store Connect (e.g. `you@email.com`) |
| Password | **App-specific password** from [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords |
| Team ID | `33PP5ZAK59` (pre-set in `eas.json`) |

**Do not** use your normal Apple password if 2FA is on. **Do not** use a username like `doctorjay` — use the full Apple ID email.

If you see **error -20209 (account locked)**: unlock at [iforgot.apple.com](https://iforgot.apple.com), wait 15–30 minutes, then retry.

Optional non-interactive build (set in terminal, never commit):

```bash
export EXPO_APPLE_ID="your-apple-id@email.com"
export EXPO_APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export EXPO_APPLE_TEAM_ID="33PP5ZAK59"
npm run build:testflight
```

### App Store Connect API key (no app-specific password)

1. App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API** → copy **Issuer ID**
2. Save `AuthKey_*.p8` under `docs/password/` (gitignored)
3. Copy `docs/password/asc.env.example` → `docs/password/asc.env` and paste Issuer ID
4. Build:

```bash
cd patient-app
npm run build:testflight:asc:submit
```

First run: choose **Let EAS handle credentials** unless you have existing certs.

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
5. Open invite email or TestFlight → **Touche** → **Install**

## Step 7 — Smoke test on device

Uses live API — no local middleware required.

1. Open app → **Sign in** with email OTP (`/api/patient/auth/*`)
2. Journey choose → pick concern → **Home** loads
3. Log a photo (camera permission)
4. **Progress** shows the logged day
5. **Account** → subscription flow (Stripe) optional

If sign-in fails with network errors, confirm the build used `EXPO_PUBLIC_API_BASE_URL=https://api.myskinandcare.com` (see build logs on expo.dev).

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
| Apple account locked (-20209) | [iforgot.apple.com](https://iforgot.apple.com) → unlock → app-specific password → retry build |
| Invalid Apple username/password | Use full Apple ID email + app-specific password (not Expo/Gmail password) |
| `Couldn't find any builds` on submit | Build must finish first — check [expo.dev](https://expo.dev) → Builds |
| Build fails signing | `npx eas credentials` → iOS → reset provisioning |
| TestFlight stuck Processing | Wait; check email for export compliance (we set `ITSAppUsesNonExemptEncryption: false`) |
| OTP email not received | Check spam; verify prod middleware email config |
| Camera crash | Settings → Touche → enable Camera |

## CI (optional)

On push to `main`, `.github/workflows/skin-care-mobile.yml` triggers an EAS **preview** (internal) build when `EXPO_TOKEN` is set. For TestFlight, run **`npm run build:testflight`** locally or add a manual workflow with profile `testflight`.
