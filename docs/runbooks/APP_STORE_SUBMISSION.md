# App Store Connect — Touche iOS submission

**App:** Touche  
**Bundle ID:** `com.skinandcare.app` (confirm in ASC if renamed)  
**ASC App ID:** `6778105762`  
**Version:** `1.0.0`  
**Build:** Select latest processed build from EAS `testflight` profile  
**Apple Team ID:** `33PP5ZAK59`  
**Primary language:** English (U.S.)

Use this doc to clear every blocker on the **App Store** version page before **Submit for Review**.

**Phase E (2026-07-17):** Privacy Policy URL must be a public standalone page. Canonical:

```
https://app.trytouche.com/privacy
```

Terms: `https://app.trytouche.com/terms`

---

## Pre-submit checklist

| # | Section (App Store Connect) | Status | Action |
|---|-----------------------------|--------|--------|
| 1 | **App Information → Content Rights** | ☐ | See [Content Rights](#content-rights) |
| 2 | **App Store → Version → Build** | ☐ | **Add Build** → pick processed `1.0.0 (N)` |
| 3 | **App Store → App Review Information → Contact** | ☐ | Fill first name, last name, phone, email |
| 4 | **App Privacy → Privacy Policy URL** | ☐ | `https://app.trytouche.com/privacy` |
| 5 | **App Privacy → Data collection questionnaire** | ☐ | Admin completes — see [App Privacy](#app-privacy-nutrition-label) |
| 6 | **English (U.S.) → Name / Subtitle / Description / Keywords** | ☐ | Copy from [listing metadata](#english-us--listing-metadata-phase-e) |
| 7 | **English (U.S.) → Support URL** | ☐ | `https://app.trytouche.com/welcome` |
| 8 | **App Review → Sign-in** | ☐ | OTP demo account — see [App Review sign-in](#app-review-sign-in) |
| 9 | **Version → Copyright** | ☐ | e.g. `© 2026 touche labs` |

---

## English (U.S.) — listing metadata (Phase E)

Limits verified against Apple’s current docs (not inventing numbers):

| Field | Official limit | Source |
|-------|----------------|--------|
| **Name** | 2–30 characters | [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/) |
| **Subtitle** | ≤ 30 characters | same |
| **Keywords** | up to **100 bytes** of content; comma-separated; Apple’s product-page guidance says separate with commas and no spaces between terms (spaces allowed inside multi-word phrases) | [Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/) · [Creating Your Product Page](https://developer.apple.com/app-store/product-page/) · [App Store search](https://developer.apple.com/app-store/search/) |
| **Description** | ≤ 4000 characters | Platform version information |
| **Promotional Text** | commonly cited as 170 characters in ASC UI — confirm in Connect when pasting | ASC version page |

Apple search guidance: do **not** repeat words already in the app name, subtitle, or category; avoid generic “app”; don’t use other companies’ names.

### Name (required)

```
Touche
```

(6 characters)

### Subtitle (≤ 30 characters)

```
Skincare & medical journal
```

(26 characters — matches marketing + Welcome positioning)

### Primary category

**Health & Fitness**

(Secondary optional — leave unset unless product wants **Medical**; Medical invites extra review scrutiny for a personal journal that is explicitly not diagnosis.)

### Keywords (≤ 100 bytes; paste as one line)

```
prescription log,skin diary,bill tracker,lab results,photo log,rx shelf,ingredient check,allergy
```

(96 characters — does not repeat “Touche”, “skincare”, “medical”, or “journal” from name/subtitle; omits “app” and category name words.)

### Promotional Text (optional)

```
One place for your skin, prescriptions, and bills. 20 AI reads free each month — manual entries always free.
```

### Description (required)

```
Touche is your skincare and medical journal — one place for your skin, your prescriptions, your bills, and other health facts you choose to keep.

HOW IT WORKS
• Capture a photo or PDF with one of six tags: skin, bill, prescription, mark, lab, or other
• Optional AI reads draft fields for you to confirm (20 free AI reads each month; manual entry is always free)
• See history on Calendar, Track, and Progress — the same facts store everywhere
• Shelf checks products against your routine; prescription items never get a Buy button

KEY FEATURES
• Six-tag medical journal capture
• Optional AI field extraction you always review
• Product shelf and ingredient / allergen checks
• Email OTP sign-in — no password to remember
• Wellness / self-tracking only — not a medical diagnosis

IMPORTANT
Touche does not provide medical advice, diagnosis, prescribing, or emergency services. Always consult a qualified professional for medical decisions.

Privacy: https://app.trytouche.com/privacy
Terms: https://app.trytouche.com/terms
Support: support@trytouche.com
```

### URLs (legal & support)

| Field | URL |
|-------|-----|
| **Privacy Policy URL** | `https://app.trytouche.com/privacy` |
| **Terms of Use** | `https://app.trytouche.com/terms` |
| **Support URL** (required) | `https://app.trytouche.com/welcome` (Phase E — use this in App Store Connect now). Revisit when `trytouche.com` Shopify storefront is confirmed stable; not a blocker for submission today. |
| **Marketing URL** (optional) | `https://trytouche.com` |

### Copyright

```
© 2026 touche labs
```

### Version

```
1.0.0
```

---

## Content Rights

**App Store Connect → App Information → Content Rights**

For Touche (original app, own photography/copy, licensed fonts from Google Fonts on web only):

- Select: **No, it does not contain, show, or access third-party content**  
  *or*, if you use stock/marketing assets with licenses: **Yes** and confirm you have the rights.

App icon and in-app UI are first-party.

---

## App Privacy (nutrition label)

**App Store Connect → App Privacy** (Admin role required)

**Privacy Policy URL:**

```
https://app.trytouche.com/privacy
```

### Suggested data types to declare

| Category | Data type | Linked to user? | Used for tracking? | Purpose |
|----------|-----------|-----------------|--------------------|---------|
| Contact Info | Email Address | Yes | No | App Functionality, Account |
| User Content | Photos or Videos | Yes | No | App Functionality |
| User Content | Other User Content (documents, structured facts, notes) | Yes | No | App Functionality |
| Purchases | Purchase History | Yes | No | App Functionality (if AI credits / paid features enabled) |
| Identifiers | User ID | Yes | No | App Functionality |
| Usage Data | Product Interaction | Optional | No | Analytics (first-party only; no ad SDK) |

**Health & Fitness:** Declare **Photos** under User Content. The app is a personal medical journal / wellness tracker, not a clinical EHR — follow ASC prompts carefully if you also declare Health data types for document captures.

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
2. **Username:** a dedicated review inbox you control, e.g. `appreview@trytouche.com` or your monitored email
3. **Password:** ASC often requires a non-empty field — put a placeholder and explain OTP in Notes

**Recommended:** Create `appreview@…` (or use your email), ensure OTP emails deliver in &lt;1 minute, and monitor the inbox during review.

### Notes for reviewer (4,000 chars max)

```
Touche — App Review notes

SIGN-IN (email OTP, no password)
Primary web sign-in URL: https://app.trytouche.com/sign-in
1. Open the app → Sign in (or use the web URL above)
2. Enter the review email below
3. Check that inbox for a one-time code and enter it in the app
4. No password is used

Review account email: [REVIEW_EMAIL]

WHAT TO LOOK AT
• Welcome → Get started → capture consent → capture flow (six tags)
• Privacy Policy linked from consent / Profile: https://app.trytouche.com/privacy
• Shelf: prescription products must not show Buy
• Progress / Calendar read confirmed facts only

POSITIONING
Touche is a personal skincare and medical journal (wellness / self-tracking). It does not diagnose or prescribe.
```

---

## Screenshots (6.7" iPhone — recommended order)

1. **Welcome** — brand touche, Medical Tracker, 20 AI reads line  
2. **Capture** — six-tag picker  
3. **Progress / Calendar** — facts timeline  
4. **Shelf** — product list with Rx without Buy  
5. **Try / evaluate** (optional) — Safe / Caution / Hard-no  
6. **Profile** — consent / account

Capture from the current rebuild, not the pre-rebuild diary-only UI.

---

## Legacy note

Older drafts referred to “Skin & Care” / myskinandcare.com diary copy. Those URLs and names are retired for submission; use this Phase E section as the source of truth.
