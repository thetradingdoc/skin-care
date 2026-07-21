'use strict';

/**
 * Progress Kelly framing — LOCKED for Phase 1.
 *
 * Snapshot-coach is the locked design: Kelly reads today's confirmed facts
 * fresh on every call and does not imply memory of prior conversations.
 * This is a deliberate product choice, not a gap.
 *
 * Do not build last-N turn memory without a new explicit product decision
 * and its own spec. Repeat-nudge avoidance uses last message_type + date
 * only (see progress-kelly-nudge-state.js) — never prior body text.
 */

module.exports = {
  framing: 'snapshot_coach',
  memory: 'stateless_locked_phase1',
  pending_product_signoff: false,
  repeat_nudge: 'type_and_date_only',
};
