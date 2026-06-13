# Security architecture

**Last updated:** 2026-06-12

Defense-in-depth for Skin & Care consumer + middleware (`api.callsomo.com`).

## Rings

1. **Edge** — CORS allowlist ([`middleware-platform/server.js`](../../middleware-platform/server.js)), Helmet CSP ([`middleware/security.js`](../../middleware-platform/middleware/security.js)), per-surface rate limits ([`middleware/rate-limiter.js`](../../middleware-platform/middleware/rate-limiter.js)).
2. **Identity** — Patient OTP + `requirePatientSession` ([`middleware/patient-session.js`](../../middleware-platform/middleware/patient-session.js)), CSRF for cookie auth, session rotation.
3. **Uploads** — Magic-byte MIME ([`utils/mime-validate.js`](../../middleware-platform/utils/mime-validate.js)), optional AV ([`services/antivirus-service.js`](../../middleware-platform/services/antivirus-service.js)). See [UPLOAD_AND_AV.md](./UPLOAD_AND_AV.md).
4. **Payments** — Stripe tokenization only; webhook signature verification. See [PAYMENTS_AND_PCI.md](./PAYMENTS_AND_PCI.md).
5. **Agents** — Tool allowlists per lane; max iterations. See [AGENT_SECURITY.md](./AGENT_SECURITY.md).
6. **Observability** — First-party audit tables (`funnel_journey_events`, `patient_portal_events`). See [OBSERVABILITY_AND_UI_AUDIT.md](./OBSERVABILITY_AND_UI_AUDIT.md).

## CORS

Allowed origins: `myskinandcare.com`, `callsomo.com` subdomains, dev localhost. Custom headers include `x-session-id`, `x-client-date` ([`lib/cors-allowed-headers.js`](../../middleware-platform/lib/cors-allowed-headers.js)).

## Input sanitization

`sanitizeInput` strips `<`/`>` from request bodies (basic XSS mitigation).

## Logging

[`services/payment-security.js`](../../middleware-platform/services/payment-security.js) redacts PCI + PII keys. Application Insights optional with PHI scrub hook ([`middleware/application-insights.js`](../../middleware-platform/middleware/application-insights.js)).
