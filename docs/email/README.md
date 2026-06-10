# Email (transactional + local dev)

**Last updated:** 2026-06-10

## Transactional HTML (production)

| Piece | Path |
|-------|------|
| Shared layout (logo, colors, footer) | [`middleware-platform/lib/skin-care-email-layout.js`](../../middleware-platform/lib/skin-care-email-layout.js) |
| Template implementations | [`middleware-platform/services/email-service.js`](../../middleware-platform/services/email-service.js), [`invoice-service.js`](../../middleware-platform/services/invoice-service.js) |
| Brand rules | [`docs/Brand/LOGO_AND_ICON_SSOT.md`](../Brand/LOGO_AND_ICON_SSOT.md) § Transactional email |

## GCP production (Cloud Run)

Skin & Care on **GCP** (`somo-callsomo` / `somo-middleware`) uses **SMTP**, not Azure Communication Services.

| Setting | Typical value |
|---------|----------------|
| `EMAIL_PROVIDER` | `smtp` |
| `SMTP_HOST` | `smtp.gmail.com` (Google Workspace) or `smtp.sendgrid.net` |
| `SMTP_USER` / `SMTP_FROM` | `richard@callsomo.com` (bare address is fine) |
| `SMTP_PASSWORD` | Gmail [app password](https://myaccount.google.com/apppasswords) or SendGrid API key |

**From display name:** `email-service.js` wraps bare `SMTP_FROM` as `Skin & Care <address>` so Gmail shows **Skin & Care**, not the mailbox local part. You can also set `SMTP_FROM=Skin & Care <richard@callsomo.com>` explicitly.

**Preheader rule:** Never put OTP codes or secrets in the email preheader — Gmail appends preheader text to the subject in the inbox list. Codes belong in the HTML body only.

**Configure Cloud Run (no full redeploy needed):**

```bash
# 1. Add SMTP_* to middleware-platform/.env
# 2. Push env + secret to Cloud Run (removes legacy Azure vars)
bash scripts/configure-cloudrun-patient-email.sh

# 3. Audit
bash scripts/audit-cloudrun-email-config.sh

# 4. Live OTP smoke
EMAIL=you@gmail.com npm run verify:patient-otp-email
```

Patient OTP subject: **Email verification** (From: **Skin & Care**)

Legacy Azure (`AZURE_COMMUNICATION_CONNECTION_STRING`) is **deprecated** on GCP; set `EMAIL_PROVIDER=azure` only if you intentionally opt back in.

## Local SMTP setup

Add to `middleware-platform/.env`:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM=your-email@gmail.com
# Or: SMTP_FROM=Skin & Care <your-email@gmail.com>
BASE_URL=http://localhost:4000
```

Gmail app passwords: https://myaccount.google.com/apppasswords

Test:

```bash
cd middleware-platform
node scripts/test-email-payment-link.js
```

Interactive setup: `node scripts/configure-local-email.js`

## Related

- [Setup index](../setup/README.md)
- [GCP cutover](../runbooks/CALLSOMO_GCP_CUTOVER.md)
- Archived voice-checkout email debugging (2026): [archive/email-voice-checkout-verification-2026.md](../archive/email-voice-checkout-verification-2026.md)
