# App Store Connect — Skin & Care iOS submission

**App:** Skin & Care  
**Bundle ID:** `com.skinandcare.app`  
**ASC App ID:** `6778105762`  
**Version:** `1.0.0`  
**Build:** Select latest processed build (e.g. **1.0.0 (7)** from EAS `testflight` profile)  
**Apple Team ID:** `33PP5ZAK59`  
**Primary language:** English (U.S.)

Use this doc to clear every blocker on the **App Store** version page before **Submit for Review**.

---

## Pre-submit checklist

| # | Section (App Store Connect) | Status | Action |
|---|-----------------------------|--------|--------|
| 1 | **App Information → Content Rights** | ☐ | See [Content Rights](#content-rights) |
| 2 | **App Store → Version → Build** | ☐ | **Add Build** → pick processed `1.0.0 (N)` |
| 3 | **App Store → App Review Information → Contact** | ☐ | Fill first name, last name, phone, email |
| 4 | **App Privacy → Privacy Policy URL** | ☐ | Paste URL below |
| 5 | **App Privacy → Data collection questionnaire** | ☐ | Admin completes — see [App Privacy](#app-privacy-nutrition-label) |
| 6 | **English (U.S.) → Description** | ☐ | Copy from below |
| 7 | **English (U.S.) → Keywords** | ☐ | Copy from below |
| 8 | **English (U.S.) → Support URL** | ☐ | Copy from below |
| 9 | **App Review → Sign-in** | ☐ | OTP demo account — see [Review sign-in](#app-review-sign-in) |
| 10 | **Version → Copyright** | ☐ | e.g. `© 2026 Skin & Care` |

---

## URLs (legal & support)

| Field | URL |
|-------|-----|
| **Privacy Policy URL** | `https://myskinandcare.com/patients/legal/privacy.html` |
| **Terms of Use** (optional link in description) | `https://myskinandcare.com/patients/legal/terms.html` |
| **Support URL** (required) | `https://myskinandcare.com/contact.html` |
| **Marketing URL** (optional) | `https://myskinandcare.com` |

Support email (also on privacy page): `support@skinandcare.com`

---

## English (U.S.) — copy-paste fields

### Promotional Text (optional, 170 chars max)

```
The skincare journal for daily photo tracking. Log one photo a day, see flares and reactions over time—no routine required to start.
```

### Description (required, 4,000 chars max)

```
Skin & Care is your skincare journal—track your skin with one photo a day and see what changes over time.

Track your skin with one photo a day. See what's causing flares, reactions, or breakouts—without adding a single new product. Your skin diary, not a routine plan.

HOW IT WORKS
• Start with a quick face check—your baseline photo for the journal
• Log one photo a day, same angle, to build a visual timeline
• Note what to watch—redness, breakouts, dryness, or sensitive-skin reactions
• Optional: follow a phased care plan or scan products before you try them

KEY FEATURES
• Daily photo journal and timeline
• Face check to start your log
• Product shelf and ingredient safety scan
• Optional concern-based care programs (8–24 weeks)
• Email sign-in—no password to remember
• Wellness tracking only—not a medical diagnosis

WHO IT’S FOR
Anyone whose skin reacts easily—or anyone who wants a reliable record of how their skin changes day to day. Measurement and journaling, not hype.

IMPORTANT
Skin & Care is a wellness tracking tool. It does not provide medical advice, diagnosis, or emergency services. Always consult a qualified professional for medical decisions.

Privacy: https://myskinandcare.com/patients/legal/privacy.html
Terms: https://myskinandcare.com/patients/legal/terms.html
Support: https://myskinandcare.com/contact.html
```

### Subtitle (30 chars max)

```
Find your skin triggers
```

### Keywords (required, 100 chars max, comma-separated, no spaces after commas)

```
skincare journal,skin tracker,acne diary,skin diary,flare log,reactive skin,sensitive skin
```

(Character count: ~90 — adjust if ASC rejects.)

### Category

**Health & Fitness** (not Lifestyle or Self Care).

### Screenshots (6.7" iPhone — recommended order)

1. **Home** — “Log today’s photo” CTA, condition chips, trigger insight card  
2. **Progress** — streak hero + photo timeline + trigger tags  
3. **Onboarding** — three journey cards (diary default)  
4. **Track** — spot watch empty state  
5. **Scan** — product shelf with verdict badges  
6. **Profile** — journey toggles (diary / routine / spot)

Capture from journal-first build after `JOURNAL_MODE_STANDALONE=1` is enabled on API.

### Support URL (required)

```
https://myskinandcare.com/contact.html
```

### Marketing URL (optional)

```
https://myskinandcare.com
```

### Copyright (required, 200 chars max)

```
© 2026 Skin & Care
```

(Update year and legal entity if your ASC account uses a company name.)

### Version

```
1.0.0
```

---

## Content Rights

**App Store Connect → App Information → Content Rights**

For Skin & Care (original app, own photography/copy, licensed fonts from Google Fonts on web only):

- Select: **No, it does not contain, show, or access third-party content**  
  *or*, if you use stock/marketing assets with licenses: **Yes** and confirm you have the rights.

App icon and in-app UI are first-party. Routine content is authored in-repo (`middleware-platform/data/routines/concern-routines.json`).

---

## App Privacy (nutrition label)

**App Store Connect → App Privacy** (Admin role required)

**Privacy Policy URL:**

```
https://myskinandcare.com/patients/legal/privacy.html
```

### Suggested data types to declare

| Category | Data type | Linked to user? | Used for tracking? | Purpose |
|----------|-----------|-----------------|--------------------|---------|
| Contact Info | Email Address | Yes | No | App Functionality, Account |
| User Content | Photos or Videos | Yes | No | App Functionality |
| User Content | Other User Content (routine logs, notes) | Yes | No | App Functionality |
| Purchases | Purchase History | Yes | No | App Functionality (if subscription enabled) |
| Identifiers | User ID | Yes | No | App Functionality |
| Usage Data | Product Interaction | Optional | No | Analytics (only if you send analytics events) |

**Health & Fitness:** Declare **Photos** under User Content. Only add **Health** if you explicitly collect health records; the app positions itself as wellness tracking, not clinical records.

**Data not collected:** Precise location, contacts, browsing history, advertising data (unless you add ad SDKs later).

After questionnaire: **Publish** privacy details so the version page stops showing the Admin warning.

---

## App Review Information

### Contact Information (required)

| Field | Value |
|-------|-------|
| First name | `[YOUR_FIRST_NAME]` |
| Last name | `[YOUR_LAST_NAME]` |
| Phone number | `[YOUR_PHONE_E164]` |
| Email | `[YOUR_EMAIL]` |

Use a phone/email you answer during review (Apple may call).

### App Review sign-in

The app uses **email OTP** (no username/password). On the review form:

1. Check **Sign-in required**
2. **Username:** a dedicated review inbox you control, e.g. `appreview@skinandcare.com` or your monitored email
3. **Password:** enter `N/A — email OTP` is not accepted; instead use **Notes** below

**Recommended:** Create `appreview@…` (or use your email), ensure OTP emails deliver in &lt;1 minute, and monitor the inbox during review.

### Notes for reviewer (4,000 chars max)

```
Skin & Care — App Review notes

SIGN-IN (email OTP, no password)
Primary web sign-in URL: https://myskinandcare.com/app/sign-in
1. Open the app → Sign in (or use the web URL above)
2. Enter this email: [REVIEW_EMAIL@YOURDOMAIN.com]
3. Tap Send code — a 6-digit OTP arrives by email within ~1 minute (check spam)
4. Enter the code to complete sign-in

FIRST-TIME FLOW AFTER SIGN-IN
1. If prompted, pick a concern (e.g. Acne) and tap Start tracking
2. Today tab shows the current phase and routine steps
3. Tap to log today’s photo (Camera permission) — optional for review
4. Timeline tab shows logged days

TABS
• Today — daily routine + photo log
• Timeline — photo journal
• Shelf — products on your shelf
• Account — profile and subscription (Stripe test/live per build config)

PERMISSIONS
• Camera — daily progress photos only (NSCameraUsageDescription in Info.plist)
• No microphone

NETWORK
App calls production API: https://api.callsomo.com

WELLNESS DISCLAIMER
App is for routine tracking and education, not diagnosis or emergency care.

CONTACT DURING REVIEW
[YOUR_NAME] — [YOUR_PHONE] — [YOUR_EMAIL]
```

Replace bracketed placeholders before submit.

### Attachment (optional)

Screenshot PDF of Today + Timeline after sign-in helps if OTP is flaky.

---

## Build selection

1. **TestFlight → Builds** — confirm build status is **Ready to Submit** (not Processing)
2. **App Store → iOS App → 1.0.0 → Build → Add Build**
3. Select **1.0.0 (7)** or latest build from EAS (`patient-app`, profile `testflight` / `production`)

EAS submit config: `patient-app/eas.json` → `submit.testflight.ios.ascAppId`

Rebuild if needed:

```bash
cd patient-app
npm run build:testflight:asc
npm run submit:testflight:asc
```

---

## App Store Version Release

Choose one:

- **Manually release this version** — recommended for first launch (you control go-live)
- **Automatically release this version** — goes live immediately after approval

---

## Export compliance

Already set in `patient-app/app.json`:

```json
"ITSAppUsesNonExemptEncryption": false
```

Answer **No** to custom encryption on ASC export compliance if prompted (standard HTTPS only).

---

## Age rating

Typical for this app: **4+** or **12+** depending on questionnaire answers about medical/wellness content. Answer honestly; no unrestricted web, no gambling, no mature content.

---

## Quick reference — app metadata

| Item | Value |
|------|-------|
| Display name | Skin & Care |
| Subtitle (optional, 30 chars) | `Skincare journal & photo log` |
| Category (primary) | Health & Fitness |
| Category (secondary) | Lifestyle |
| Bundle ID | com.skinandcare.app |
| SKU | skin-care-ios |
| API base (production build) | https://api.callsomo.com |
| Web signup URL | https://myskinandcare.com/scan |

---

## Related docs

- [TESTFLIGHT.md](./TESTFLIGHT.md) — build & TestFlight install
- Privacy page source: `unified-dashboard/patients/legal/privacy.html`
- Contact page source: `unified-dashboard/contact.html`
