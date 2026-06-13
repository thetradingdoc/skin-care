'use strict';

/** Client-allowed POST /api/patient/analytics/event names. */
const ALLOWED_CLIENT_PORTAL_EVENTS = new Set([
  'home_summary_viewed',
  'home_viewed',
  'scan_tab_opened',
  'progress_viewed',
  'account_viewed',
  'journey_choose_completed',
  'billing_first_scan_started',
  'billing_review_completed',
  'billing_event_tracked',
  'billing_upgrade_prompt_shown',
]);

module.exports = { ALLOWED_CLIENT_PORTAL_EVENTS };
