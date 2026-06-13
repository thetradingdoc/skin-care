# Observability and UI audit

**Last updated:** 2026-06-12

First-party **security observability** — not third-party marketing analytics.

## Tables

| Table | When | Auth |
|-------|------|------|
| `funnel_journeys` | Anonymous journey row | Public create |
| `funnel_journey_events` | Pre-auth UI steps | Public POST with `journey_id` |
| `patient_portal_events` | Post-auth UI + server actions | Session required |

## APIs

### Anonymous funnel

```http
POST /api/public/funnel/journey
Body: { "visitor_id": "vis_..." }

POST /api/public/funnel/journey/:id/event
Body: { "event_type": "page_view", "payload": { "pathname": "/scan", "ts": "...", "visitor_id": "..." } }
```

Implementation: [`routes/public-funnel-journey.js`](../../middleware-platform/routes/public-funnel-journey.js), allowlist [`lib/funnel-analytics.js`](../../middleware-platform/lib/funnel-analytics.js).

Client: [`skin-care-landing/src/lib/trackUIEvent.js`](../../unified-dashboard/skin-care-landing/src/lib/trackUIEvent.js).

### Stitch at signup

```http
POST /api/patient/funnel/bridge
Body: { "journey_id": "fj_...", ... }
```

Sets `funnel_journeys.linked_session_id` / `linked_patient_id`. Client: [`patient-app/lib/skin-age-journey.ts`](../../patient-app/lib/skin-age-journey.ts).

### Post-auth portal UI

```http
POST /api/patient/analytics/event
Body: { "event": "home_viewed", "metadata": {} }
```

Whitelist: [`lib/portal-analytics-events.js`](../../middleware-platform/lib/portal-analytics-events.js). Client: [`patient-app/lib/trackPortalEvent.ts`](../../patient-app/lib/trackPortalEvent.ts).

## PHI rules

**Never** in event payloads: email, phone, name, OTP, photos, `face_read`, free-text health answers, ZIP, addresses.

Allowed: `pathname`, `ts`, `visitor_id`, `journey_id`, coarse enums (`camera_type`, `cta_id`, `modes` as comma-separated mode ids).

## SQL timelines

```sql
-- Anonymous funnel by journey
SELECT event_type, payload_json, created_at
FROM funnel_journey_events
WHERE journey_id = ?
ORDER BY created_at;

-- Linked journey
SELECT fje.*
FROM funnel_journeys fj
JOIN funnel_journey_events fje ON fje.journey_id = fj.id
WHERE fj.linked_session_id = ?
ORDER BY fje.created_at;

-- Post-auth portal
SELECT event_name, metadata_json, created_at
FROM patient_portal_events
WHERE session_id = ?
ORDER BY created_at;
```

## Visitor cookie

Landing sets `sc_visitor_id` (7-day TTL) before scan consent. Linked on journey create via `anonymous_visitor_id` column (migration `058_funnel_visitor_id`).
