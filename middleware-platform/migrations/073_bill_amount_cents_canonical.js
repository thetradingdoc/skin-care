'use strict';

/**
 * Migrate bill structured_json to canonical amount_cents (integer minor units).
 *
 * Dominant write path historically stored `amount` as major units (dollars) after
 * OCR cents/100. Validator also accepted amount_cents via `amount ?? amount_cents`
 * without converting — those rows may store cents in the `amount` field (ambiguous).
 *
 * Recoverable rule (deterministic):
 * - If amount_cents already present → keep Math.round(amount_cents), drop amount
 * - Else if amount present → treat as major units → amount_cents = round(amount * 100)
 * - If BOTH present and disagree after conversion → flag needs_review (do not overwrite)
 *
 * Unrecoverable: amount that was already wrongly stored as cents-as-dollars cannot be
 * distinguished from a large real charge — flagged when amount is integer >= 1000 and
 * amount_cents was also present with amount === amount_cents (classic conflation).
 */

const factsRepo = require('../repositories/patient-record-facts-repo');
const {
  encryptStructuredJson,
  extractEntryDate,
} = require('../services/patient-record-field-crypto');

function migrateBillFactStructured(sj) {
  if (!sj || typeof sj !== 'object') {
    return { status: 'skip', structured: sj };
  }
  const next = { ...sj };
  const hasCents = next.amount_cents != null && next.amount_cents !== '';
  const hasAmount = next.amount != null && next.amount !== '';

  if (hasCents && !hasAmount) {
    // Already canonical
    const cents = Math.round(Number(next.amount_cents));
    if (!Number.isFinite(cents) || cents < 0) {
      return { status: 'needs_review', reason: 'amount_cents_not_numeric', structured: next };
    }
    if (next.amount_cents !== cents) {
      next.amount_cents = cents;
      return { status: 'migrated', structured: next };
    }
    return { status: 'skip', structured: next };
  }

  if (hasCents && hasAmount) {
    const cents = Math.round(Number(next.amount_cents));
    const fromMajor = Math.round(Number(next.amount) * 100);
    if (Number.isFinite(cents) && Number.isFinite(fromMajor) && cents !== fromMajor) {
      // Classic conflation: amount_cents and amount both 8400
      if (Math.round(Number(next.amount)) === cents) {
        return {
          status: 'needs_review',
          reason: 'amount_equals_amount_cents_ambiguous',
          structured: next,
        };
      }
      return {
        status: 'needs_review',
        reason: 'amount_and_amount_cents_disagree',
        structured: next,
      };
    }
    next.amount_cents = cents;
    delete next.amount;
    return { status: 'migrated', structured: next };
  }

  if (hasAmount) {
    const major = Number(next.amount);
    if (!Number.isFinite(major)) {
      return { status: 'needs_review', reason: 'amount_not_numeric', structured: next };
    }
    next.amount_cents = Math.round(major * 100);
    delete next.amount;
    return { status: 'migrated', structured: next };
  }

  return { status: 'skip', structured: next };
}

function up(db) {
  if (!db) return { migrated: 0, needs_review: [], skipped: 0 };
  // Caller (ensurePatientRecordFactsTable) already applied 067/068/072 — do not re-enter.
  const rows = db
    .prepare(`SELECT id, structured_json FROM patient_record_facts WHERE tag = 'bill'`)
    .all();

  let migrated = 0;
  let skipped = 0;
  const needsReview = [];

  for (const row of rows) {
    let fact;
    try {
      fact = factsRepo.mapRow(row);
    } catch (_) {
      needsReview.push({ id: row.id, reason: 'decrypt_failed' });
      continue;
    }
    const result = migrateBillFactStructured(fact.structured_json || {});
    if (result.status === 'skip') {
      skipped += 1;
      continue;
    }
    if (result.status === 'needs_review') {
      needsReview.push({ id: row.id, reason: result.reason, structured: result.structured });
      continue;
    }
    const entryDate = extractEntryDate(result.structured);
    const cipher = encryptStructuredJson(result.structured);
    db.prepare(
      `UPDATE patient_record_facts SET
         structured_json = ?,
         entry_date = COALESCE(?, entry_date),
         updated_at = datetime('now')
       WHERE id = ?`,
    ).run(cipher, entryDate, row.id);
    migrated += 1;
  }

  return { migrated, skipped, needs_review: needsReview };
}

module.exports = {
  up,
  migrateBillFactStructured,
};
