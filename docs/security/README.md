# Security documentation (SSOT)

**Last updated:** 2026-06-12

This folder is the **single source of truth** for platform security architecture, consumer HIPAA boundaries, UI audit/observability, uploads, agents, and payments. Legal/compliance depth remains in [`../compliance/README.md`](../compliance/README.md).

## Document map

| File | Topic |
|------|--------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Defense-in-depth: CORS, Helmet, rate limits, sessions, CSRF, webhooks |
| [OBSERVABILITY_AND_UI_AUDIT.md](./OBSERVABILITY_AND_UI_AUDIT.md) | Funnel + portal event tables, API contracts, SQL timelines |
| [ANALYTICS_EVENT_CATALOG.md](./ANALYTICS_EVENT_CATALOG.md) | Whitelisted event names (funnel + portal + checkout) |
| [HIPAA_CONSUMER.md](./HIPAA_CONSUMER.md) | Consumer app PHI boundaries, retention, BAA pointers |
| [UPLOAD_AND_AV.md](./UPLOAD_AND_AV.md) | MIME validation, antivirus, per-route coverage |
| [AGENT_SECURITY.md](./AGENT_SECURITY.md) | Kelly / consumer rails tool allowlists |
| [PAYMENTS_AND_PCI.md](./PAYMENTS_AND_PCI.md) | PCI scope, log redaction, incident pointers |
| [SECURITY.md](./SECURITY.md) | Secret scanning, dependency audit |

## Related (outside this folder)

- [Compliance index](../compliance/README.md) — BAA, blob retention, PHI messaging
- [Auth](../auth/AUTH.md) — admin vs provider vs patient surfaces
- [Middleware depth](../middleware-platform/README.md) — incident response anchors
- [Architecture LIVE](../architecture/LIVE.md) — runtime security middleware

## CI gates

```bash
cd middleware-platform && npm run release:security-gate
```

Runs redaction tests + forbidden-data scan before deploy.

## Practices

- Never commit `.env`; rotate leaked credentials immediately.
- Webhook signature validation: Stripe, Twilio, Stedi (see `middleware-platform/.env.example`).
- UI audit events: **no PHI** in payloads (see ANALYTICS_EVENT_CATALOG.md).
