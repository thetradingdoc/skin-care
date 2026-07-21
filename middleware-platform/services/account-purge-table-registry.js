'use strict';

/**
 * Account-purge table registry (Phase 1 App Store deletion gate).
 *
 * Every patient-keyed table must appear in exactly one of:
 * - PURGED — deleted or identity-anonymized by purgePatientAccount
 * - RETAINED_WITH_REASON — deliberately kept; reason required (legal/ops)
 *
 * Unclassified tables fail the coverage test unless temporarily listed in
 * GRANDFATHERED_UNCLASSIFIED (existing backlog only — no NEW gaps).
 *
 * Do NOT invent RETAINED reasons for billing/credits/shopify/waitlist/funnel
 * until product/legal decides.
 */

/** Tables purgePatientAccount currently deletes or anonymizes (2026-07-21). */
const PURGED = Object.freeze([
  'patient_record_facts',
  'patient_record_media_tokens',
  'pending_captures',
  'capture_sessions',
  'patient_physician_share_tokens',
  'patient_physician_share_access_log',
  'patient_spot_snapshots',
  'patient_spots',
  'patient_journal_entries',
  'patient_routine_daily_media',
  'patient_routine_daily_item_logs',
  'patient_routine_daily_entries',
  'patient_routine_template_items',
  'patient_routine_templates',
  'patient_routine_lineup_snapshots',
  'patient_bio_profiles',
  'patient_allergen_exclusions',
  'patient_product_list_items',
  'patient_product_lists',
  'patient_onboarding_step3_products',
  'patient_onboarding_step3_state',
  'patient_onboarding_enrichment_queue',
  'patient_consumer_profiles',
  'patient_goals',
  'shopify_order_dead_letters',
  'patient_portal_events',
  'email_verification_codes',
  'skin_age_readings',
  // linked_* NULLed — journey row may remain; still "handled" for account unlink
  'funnel_journeys',
  // identity stripped (email/phone/resource_json); row kept for FK
  'fhir_patients',
  'patient_sessions',
  'patient_portal_sessions',
  'progress_kelly_nudge_state',
  // tombstone insert (audit), not patient PHI payload
  'patient_account_deletions',
]);

/**
 * Deliberate exclusions — EMPTY until product/legal decides.
 * Shape: { table_name: 'reason string (required)' }
 *
 * Do not pre-fill patient_billing_*, ai_credits_*, shopify_orders, waitlist,
 * funnel_journey_events here — those must fail as unclassified until decided.
 */
const RETAINED_WITH_REASON = Object.freeze({});

/**
 * Temporary allowlist — Layer 1 audit 2026-07-21.
 * Grandfathered: pending product/legal classification. Do NOT add new names here
 * to silence a CI failure; classify as PURGED (wire purge) or RETAINED_WITH_REASON.
 *
 * Staleness tripwire: GRANDFATHERED_UNCLASSIFIED_DEADLINE_ISO — after that date,
 * coverage fails if this list is still non-empty. When it fires: classify the
 * backlog, or extend the deadline with a new comment explaining why.
 */
const GRANDFATHERED_UNCLASSIFIED_DEADLINE_ISO = '2026-10-19'; // 2026-07-21 + 90 days

const GRANDFATHERED_UNCLASSIFIED = Object.freeze([
  // grandfathered — pending product/legal classification (Layer 1 audit 2026-07-21)
  'ai_capture_usage',
  'ai_credits_balance',
  'ai_credits_ledger',
  'ai_decisions_rcm',
  'ai_welcome_bonus',
  'appointments',
  'audit_events',
  'case_records',
  'case_report_media',
  'coding_decisions',
  'copay_payments',
  'ehr_connections',
  'ehr_encounters',
  'ehr_sync_jobs',
  'eligibility_checks',
  'fhir_bulk_export_jobs',
  'fhir_communications',
  'fhir_consents',
  'fhir_diagnostic_reports',
  'fhir_document_references',
  'fhir_encounters',
  'fhir_observations',
  'fhir_provenance',
  'funnel_journey_events',
  'insurance_claims',
  'invoices',
  'leads',
  'ledger_accounts',
  'notification_jobs',
  'patient_billing_care_episodes',
  'patient_billing_coverage_contexts',
  'patient_billing_deletion_requests',
  'patient_billing_documents',
  'patient_billing_episode_events',
  'patient_billing_event_documents',
  'patient_billing_events',
  'patient_billing_payment_attempts',
  'patient_billing_retention_policies',
  'patient_billing_subscriptions',
  'patient_coding_history',
  'patient_device_push_tokens',
  'patient_document_download_tokens',
  'patient_document_extracts',
  'patient_documents',
  'patient_emergency_flags',
  'patient_external_ids',
  'patient_insurance',
  'patient_merge_events',
  'patient_orchestrate_sessions',
  'patient_pricing',
  'patient_push_outbox',
  'patient_uploads',
  'payment_receipts',
  'prescriptions',
  'prior_auth_requests',
  'session_result_edits',
  'session_result_snapshots',
  'shopify_order_line_items',
  'shopify_orders',
  'stripe_card_transactions',
  'stripe_cardholders',
  'stripe_cards',
  'triage_rag_results',
  'triage_sessions',
  'upload_tokens',
  'video_consult_ai_decisions',
  'video_consult_risk_events',
  'video_consult_sessions',
  'visit_feedbacks',
  'waitlist',
]);

/** Columns that mark a table as patient-linked for discovery. */
const PATIENT_LINK_COLUMN_RE =
  /\b(patient_id|owner_key|owner_id|linked_patient_id|claimed_session_id)\b/i;

/** Email-keyed account surfaces purge already handles (include in discovery). */
const EMAIL_KEYED_ACCOUNT_TABLES = new Set([
  'email_verification_codes',
  'shopify_order_dead_letters',
  'patient_sessions',
  'patient_portal_sessions',
  'waitlist',
  'shopify_orders',
]);

/**
 * Account-adjacent tables that lack a literal patient_id column but still hold
 * user-linked data (via journey_id / order_id / session_id). Always require
 * classification — do not let them silently escape discovery.
 */
const FORCE_INCLUDE_TABLES = Object.freeze([
  'funnel_journey_events',
  'shopify_order_line_items',
  'session_result_snapshots',
  'session_result_edits',
]);

function purgedSet() {
  return new Set(PURGED);
}

function retainedSet() {
  return new Set(Object.keys(RETAINED_WITH_REASON));
}

function grandfatheredSet() {
  return new Set(GRANDFATHERED_UNCLASSIFIED);
}

function classifyTable(name) {
  const n = String(name || '').toLowerCase();
  if (purgedSet().has(n)) return { status: 'PURGED' };
  if (retainedSet().has(n)) {
    return { status: 'RETAINED_WITH_REASON', reason: RETAINED_WITH_REASON[n] };
  }
  return { status: 'UNCLASSIFIED' };
}

/**
 * Unclassified patient-keyed tables that are NOT on the grandfather allowlist.
 * Empty => coverage gate passes (for new-gap prevention).
 */
function listNewUnclassifiedGaps(discovered) {
  const gf = grandfatheredSet();
  const gaps = [];
  for (const row of discovered || []) {
    const name = String(row.name || '').toLowerCase();
    const c = classifyTable(name);
    if (c.status === 'UNCLASSIFIED' && !gf.has(name)) {
      gaps.push({ name, sources: row.sources || [] });
    }
  }
  return gaps;
}

module.exports = {
  PURGED,
  RETAINED_WITH_REASON,
  GRANDFATHERED_UNCLASSIFIED,
  GRANDFATHERED_UNCLASSIFIED_DEADLINE_ISO,
  PATIENT_LINK_COLUMN_RE,
  EMAIL_KEYED_ACCOUNT_TABLES,
  FORCE_INCLUDE_TABLES,
  purgedSet,
  retainedSet,
  grandfatheredSet,
  classifyTable,
  listNewUnclassifiedGaps,
};
