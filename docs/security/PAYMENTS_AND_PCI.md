# Payments and PCI

**Last updated:** 2026-06-12

## PCI scope

Card data stays in Stripe.js / hosted checkout. Server stores tokenized IDs only.

Redaction: [`services/payment-security.js`](../../middleware-platform/services/payment-security.js) — never log PAN, CVV, `client_secret`, OTP, email in payment logs.

## Webhooks

Stripe `constructEvent` signature verification before state changes ([`routes/stripe-webhook-handler.js`](../../middleware-platform/routes/stripe-webhook-handler.js)).

## Incidents

Severity model and process: [`../middleware-platform/README.md`](../middleware-platform/README.md) § Incident response.

Predeploy checklist: same README § Predeploy security checklist.

## Deploy gate

```bash
cd middleware-platform && npm run release:security-gate
```
