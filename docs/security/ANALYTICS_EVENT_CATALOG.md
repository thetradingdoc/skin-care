# Analytics event catalog

**Last updated:** 2026-06-12

Code SSOT: [`lib/funnel-analytics.js`](../../middleware-platform/lib/funnel-analytics.js), [`lib/portal-analytics-events.js`](../../middleware-platform/lib/portal-analytics-events.js).

## Funnel `event_type` (anonymous, public API)

| Event | When |
|-------|------|
| `page_view` | Route change on landing SPA |
| `consent_accepted` | Photo analysis consent on `/scan` |
| `click_shutter` | Camera capture |
| `click_upload` | File picker upload |
| `concern_selected` | Primary concern chosen |
| `signup_cta` | Sign-up CTA tapped |
| `quick_check_completed` | Quick check step done |
| `reveal_cta` | Reveal CTA |
| `funnel_queued` | Event queued before `journey_id` exists |

## Portal `event` (authenticated, `/api/patient/analytics/event`)

| Event | When |
|-------|------|
| `home_summary_viewed` | Home progress summary loaded |
| `home_viewed` | Home tab viewed |
| `scan_tab_opened` | Scan tab opened |
| `progress_viewed` | Progress tab opened |
| `account_viewed` | Account tab opened |
| `journey_choose_completed` | Journey mode chosen |
| `billing_*` | Billing funnel steps (see patient-profile routes) |

## Server-emitted `patient_portal_events`

Routine saves, shelf scans, BFI thresholds, handoff tickets, billing — emitted in route handlers via `recordPatientPortalEvent`.

## Funnel handoff (`/api/patient/funnel/event`)

| Event | When |
|-------|------|
| `auth_handoff_continue_web` | User continues on web after funnel |
| `auth_handoff_app_link_shown` | App deep link shown |
| `auth_handoff_app_link_failed` | App link failed |

Client helper: [`patient-app/lib/trackFunnelEvent.ts`](../../patient-app/lib/trackFunnelEvent.ts).

## Checkout `dataLayer` (informational, not persisted)

Web [`checkout-chat.js`](../../unified-dashboard/patients/checkout-chat.js) and app [`checkoutAnalytics.ts`](../../patient-app/lib/checkoutAnalytics.ts): `checkout_chat_open`, `quote_shown`, `pay_started`, `pay_success`, etc. Browser-only unless `__checkoutAnalyticsSink` wired.
